"""Real checkpoint/API regression tests with a disposable DB and artifact directory.

Run from backend: .venv/Scripts/python.exe -B tests/test_model_isolation.py [--serve]
--serve keeps the isolated API on 127.0.0.1:8765 for the browser regression suite.
Never imports app.main or opens the production database.
"""
import os
import sys
import json
import uuid
import hashlib
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
RUN = ROOT / "reports" / "phase2_validation" / ("run_" + uuid.uuid4().hex[:8])
RUN.mkdir(parents=True)
os.environ["DATABASE_URL"] = "sqlite:///" + (RUN / "test.db").as_posix()
os.environ["SECRET_KEY"] = "isolated-validation-only-not-a-production-secret"
os.environ["AI_ALLOW_DOWNLOAD"] = "false"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["TF_NUM_INTRAOP_THREADS"] = "2"
os.environ["TF_NUM_INTEROP_THREADS"] = "2"
sys.path.insert(0, str(ROOT / "backend"))

from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.database.base import Base, engine, SessionLocal
from app.models.user import User
from app.models import activity, camera_session, notification, prediction, system_log, uploaded_file, user_setting, password_reset_token
from app.api import predictions, reports
from app.api.dependencies import get_current_active_user, get_db
from app.services import ai_service

assert str(engine.url).endswith("test.db")
assert str(engine.url) != "sqlite:///C:/AIQCS/backend/sql_app.db"
Base.metadata.create_all(engine)
with SessionLocal() as db:
    db.add(User(id=1, email="test@example.invalid", username="isolation_test", hashed_password="unused", is_active=True, is_admin=False, role="student"))
    db.commit()

for name in ("uploads", "heatmaps"):
    (RUN / name).mkdir()
predictions.UPLOAD_DIR = RUN / "uploads"
ai_service.UPLOAD_DIR = RUN / "uploads"
ai_service.HEATMAP_DIR = RUN / "heatmaps"
service = ai_service.ai_inference_service
app = FastAPI()
app.include_router(predictions.router, prefix="/predictions")
app.include_router(reports.router, prefix="/reports")

def test_user():
    return User(id=1, username="isolation_test", email="test@example.invalid", is_active=True, role="student")

app.dependency_overrides[get_current_active_user] = test_user

@app.get("/auth/me")
def auth_fixture():
    return {"id": 1, "username": "isolation_test", "email": "test@example.invalid", "is_active": True, "is_admin": False, "role": "student"}

@app.get("/settings/me")
def settings_fixture():
    return {"id": 1, "user_id": 1, "theme": "dark", "accent_color": "cyan", "notifications_enabled": False, "voice_notifications": False, "confidence_threshold": 0.55, "detection_sensitivity": 0.5, "language": "en", "dashboard_density": "comfortable", "auto_save_detections": False}

@app.get("/notifications/")
def notifications_fixture():
    return []

TRACE = []
trace_lock = threading.Lock()
context = threading.local()
original_predict_product = service.predict_product

def traced_product(path, product, expected_version=None):
    context.request = {"input_path": path, "input_sha256": hashlib.sha256(Path(path).read_bytes()).hexdigest(), "requested_product": product}
    try:
        return original_predict_product(path, product, expected_version)
    finally:
        context.request = None

service.predict_product = traced_product
for product, model in service.keras_models.items():
    original = model.predict
    def traced_predict(*args, _product=product, _original=original, _model=model, **kwargs):
        record = {**(getattr(context, "request", None) or {}), "actual_model_product": _product, "actual_model_object_id": id(_model), "model_version": service.product_model_metadata[_product]["model_version"]}
        with trace_lock:
            TRACE.append(record)
            (RUN / "inference_trace.json").write_text(json.dumps(TRACE, indent=2), encoding="utf-8")
        return _original(*args, **kwargs)
    model.predict = traced_predict

IMAGES = {p: next((ROOT / "dataset" / p / "non_defective").glob("*.jpg")) for p in ai_service.PRODUCT_MODEL_FILES}
client = TestClient(app)

def submit(product, filename=None, job=None, version=None, content=None):
    data = {"product_type": product, "job_id": job or str(uuid.uuid4())}
    if version is not None:
        data["expected_model_version"] = version
    payload = content if content is not None else IMAGES.get(product, IMAGES["mobile"]).read_bytes()
    return client.post("/predictions/classify", data=data, files={"file": (filename or product + "_fresh.jpg", payload, "image/jpeg")})

class ModelIsolationTests(unittest.TestCase):
    def test_01_real_models_single_fresh_inputs_and_persistence(self):
        for product in ai_service.PRODUCT_MODEL_FILES:
            with self.subTest(product=product):
                before = len(TRACE)
                job = str(uuid.uuid4())
                response = submit(product, job=job)
                self.assertEqual(response.status_code, 200, response.text)
                result = response.json()
                self.assertEqual(result["product"], product)
                self.assertEqual(result["job_id"], job)
                self.assertEqual(result["model_used"], product + "_model")
                self.assertEqual(len(TRACE), before + 1)
                self.assertEqual(TRACE[-1]["actual_model_product"], product)
                self.assertEqual(TRACE[-1]["input_sha256"], hashlib.sha256(IMAGES[product].read_bytes()).hexdigest())
                self.assertIn(uuid.UUID(job).hex, result["image_path"])
                with SessionLocal() as db:
                    row = db.get(prediction.Prediction, result["prediction_id"])
                    self.assertEqual(row.source, product)
                    self.assertEqual(row.model_version, result["model_version"])
                    self.assertEqual(row.image_path, result["image_path"])
                    self.assertIsNotNone(row.timestamp)

    def test_02_unknown_missing_and_changed_models_fail_before_save(self):
        count = len(list(predictions.UPLOAD_DIR.iterdir()))
        self.assertEqual(submit("plastic_bottles").status_code, 400)
        self.assertEqual(submit("nonsense").status_code, 400)
        with patch.dict(service.keras_models, {"cars": None}):
            # Simulate an unavailable checkpoint by removing its cache entry.
            cached = service.keras_models.pop("cars")
            self.assertEqual(submit("cars").status_code, 503)
        self.assertEqual(submit("mobile", version="wrong-version").status_code, 409)
        self.assertEqual(len(list(predictions.UPLOAD_DIR.iterdir())), count)

    def test_03_classifier_failure_never_calls_another_model(self):
        before = len(TRACE)
        with patch.object(service.keras_models["cars"], "predict", side_effect=RuntimeError("controlled inference failure")):
            response = submit("cars", filename="failed_car.jpg")
        self.assertEqual(response.status_code, 500)
        self.assertEqual(len(TRACE), before)

    def test_04_concurrent_products_keep_their_models_and_inputs(self):
        before = len(TRACE)
        with ThreadPoolExecutor(max_workers=3) as pool:
            responses = list(pool.map(lambda p: submit(p, filename=p + "_concurrent.jpg"), ai_service.PRODUCT_MODEL_FILES))
        self.assertTrue(all(x.status_code == 200 for x in responses), [x.text for x in responses])
        calls = TRACE[before:]
        self.assertEqual(len(calls), 3)
        for event in calls:
            self.assertEqual(event["requested_product"], event["actual_model_product"])
            self.assertEqual(event["input_sha256"], hashlib.sha256(IMAGES[event["requested_product"]].read_bytes()).hexdigest())

    def test_05_stale_upload_is_never_scanned(self):
        stale = predictions.UPLOAD_DIR / "old_cardboard.jpg"
        stale.write_bytes(IMAGES["cardboard_boxes"].read_bytes())
        before = len(TRACE)
        response = submit("cars", filename="new_car_only.jpg")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(TRACE), before + 1)
        self.assertTrue(TRACE[-1]["input_path"].endswith("new_car_only.jpg"))

    def test_06_history_and_report_read_without_inference(self):
        before = len(TRACE)
        history = client.get("/predictions/me").json()
        report = client.get("/reports/quality-summary").json()
        self.assertEqual(report["summary"]["total_predictions"], len(history))
        self.assertTrue(all(row["owner_id"] == 1 for row in history))
        self.assertEqual(len(TRACE), before)

    def test_07_empty_unsupported_and_corrupt_files(self):
        self.assertEqual(submit("cars", content=b"").status_code, 400)
        self.assertEqual(submit("cars", content=b"not an image").status_code, 400)
        self.assertEqual(submit("cars", content=b"\xff\xd8\xffbroken").status_code, 500)

    def test_08_activity_failure_does_not_hide_committed_prediction(self):
        with patch.object(predictions.crud_activity, "log", side_effect=RuntimeError("controlled activity failure")):
            response = submit("mobile", filename="activity_failure.jpg")
        self.assertEqual(response.status_code, 200, response.text)
        with SessionLocal() as db:
            self.assertIsNotNone(db.get(prediction.Prediction, response.json()["prediction_id"]))

    def test_09_legacy_image_endpoint_still_works(self):
        response = client.post("/predictions/", files={"file": ("legacy_fresh.jpg", IMAGES["mobile"].read_bytes(), "image/jpeg")})
        self.assertEqual(response.status_code, 201, response.text)
        self.assertIn("id", response.json())

if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(ModelIsolationTests)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    summary = {"tests_run": result.testsRun, "failures": [(str(t), e) for t, e in result.failures], "errors": [(str(t), e) for t, e in result.errors], "passed": result.wasSuccessful(), "run_directory": str(RUN), "production_database_used": False, "model_files_changed": False}
    (RUN / "backend_results.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    (ROOT / "reports/phase2_validation/latest_run.json").write_text(json.dumps({"run_directory": str(RUN)}), encoding="utf-8")
    print(json.dumps(summary), flush=True)
    if not result.wasSuccessful():
        sys.exit(1)
    if "--serve" in sys.argv:
        import uvicorn
        uvicorn.run(app, host="127.0.0.1", port=8765)
