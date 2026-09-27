import anyio
import logging
import uuid
from pathlib import Path
from typing import Any, List
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_active_user, get_db

logger = logging.getLogger("app.api.predictions")
from app.crud.prediction import prediction as crud_prediction
from app.crud.activity import activity as crud_activity
from app.models.user import User as DBUser
from app.schemas.prediction import (
    Prediction,
    PredictionCreate,
    FramePredictionRequest,
    InferenceResponse,
    Detection,
)
from app.services.ai_service import (
    ai_inference_service,
    ProductModelUnavailable,
    ProductModelVersionChanged,
)

class ClassifyResponse(BaseModel):
    product: str
    predicted_class: str
    confidence: float
    model_used: str
    model_version: str
    prediction_id: int
    job_id: str
    image_path: str
    timestamp: datetime
    review_required: bool
    model_uncertain: bool

ROOT_DIR = Path(__file__).resolve().parents[3]
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

def validate_image_bytes(content: bytes) -> str:
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if content.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    raise ValueError("Unsupported image format. Only valid PNG or JPEG images are allowed.")


ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/jpg"}

router = APIRouter()


@router.post("/", response_model=Prediction, status_code=status.HTTP_201_CREATED, tags=["Predictions"])
async def create_prediction(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_active_user),
) -> Any:
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported image format. Please upload PNG or JPEG files.",
        )

    content = await file.read()

    # 1. Enforce empty file limit
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    # 2. Enforce size limit
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Uploaded file is too large. Maximum size is 10 MB.",
        )

    # 3. Enforce magic-bytes content check
    try:
        validate_image_bytes(content)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    safe_filename = Path(file.filename).name
    filename = f"{uuid.uuid4().hex}_{safe_filename}"
    save_path = UPLOAD_DIR / filename

    try:
        save_path.write_bytes(content)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save uploaded file: {exc}",
        )

    try:
        result = await anyio.to_thread.run_sync(
            ai_inference_service.predict_image, str(save_path)
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference pipeline failed: {exc}",
        )

    # Map output results into prediction schema
    detections_list = []
    for det in result.get("detections", []):
        detections_list.append(Detection(**det))

    prediction_in = PredictionCreate(
        image_path=f"uploads/{filename}",
        prediction_label=result["prediction_label"],
        confidence_score=result["confidence_score"],
        source=result["source"],
        model_version=result["model_version"],
        heatmap_path=result.get("heatmap_path"),
        detections=detections_list,
    )

    created_prediction = crud_prediction.create(db, obj_in=prediction_in, owner_id=current_user.id)
    crud_activity.log(db, current_user.id, "prediction", f"Uploaded prediction: {result['prediction_label']}")
    return created_prediction


@router.post("/classify", response_model=ClassifyResponse, tags=["Predictions"])
async def classify_product(
    file: UploadFile = File(...),
    product_type: str = Form(...),
    job_id: uuid.UUID | None = Form(None),
    expected_model_version: str | None = Form(None),
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_active_user),
) -> Any:
    try:
        model_metadata = ai_inference_service.resolve_product_model(product_type, expected_model_version)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except ProductModelUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except ProductModelVersionChanged as exc:
        raise HTTPException(status_code=409, detail=str(exc))

    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported image format. Please upload PNG or JPEG files.",
        )

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Uploaded file is too large.")

    try:
        validate_image_bytes(content)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    job_id = job_id or uuid.uuid4()
    safe_filename = Path(file.filename or "image").name
    # Retain job provenance in the existing image_path column without a schema change.
    filename = f"{job_id.hex}_{uuid.uuid4().hex}_{safe_filename}"
    save_path = UPLOAD_DIR / filename

    try:
        save_path.write_bytes(content)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to save uploaded file: {exc}")

    try:
        result = await anyio.to_thread.run_sync(
            ai_inference_service.predict_product, str(save_path), product_type, model_metadata["model_version"]
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Inference pipeline failed: {exc}")

    prediction_in = PredictionCreate(
        image_path=f"uploads/{filename}",
        prediction_label=result["prediction_label"],
        confidence_score=result["confidence_score"],
        source=product_type,
        model_version=result["model_version"],
        heatmap_path=result.get("heatmap_path"),
        detections=[],
    )
    created_prediction = crud_prediction.create(db, obj_in=prediction_in, owner_id=current_user.id)
    try:
        crud_activity.log(db, current_user.id, "prediction", f"Classified {product_type}: {result['prediction_label']}")
    except Exception:
        # The prediction is already committed: an activity failure must not invite a duplicate retry.
        db.rollback()
        logger.exception("Activity log failed for prediction %s", created_prediction.id)

    return ClassifyResponse(
        product=product_type,
        predicted_class=result["prediction_label"],
        confidence=result["confidence_score"],
        model_used=result["model_id"],
        model_version=result["model_version"],
        prediction_id=created_prediction.id,
        job_id=str(job_id),
        image_path=created_prediction.image_path,
        timestamp=created_prediction.timestamp,
        review_required=result["review_required"],
        model_uncertain=result["model_uncertain"],
    )


@router.post("/frame", response_model=InferenceResponse, tags=["Predictions"])
async def predict_frame_api(
    payload: FramePredictionRequest,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_active_user),
) -> Any:
    try:
        result = await anyio.to_thread.run_sync(
            ai_inference_service.predict_frame, payload.image_data, payload.confidence_threshold, payload.product_type
        )
    except ProductModelUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Camera frame inference failed: {exc}",
        )

    if payload.save_detection:
        try:
            detections_list = []
            for det in result.get("detections", []):
                detections_list.append(Detection(**det))

            prediction_in = PredictionCreate(
                image_path=result.get("image_path"),
                prediction_label=result.get("prediction_label"),
                confidence_score=result.get("confidence_score"),
                source=result.get("source"),
                model_version=result.get("model_version"),
                heatmap_path=result.get("heatmap_path"),
                detections=detections_list,
            )
            crud_prediction.create(db, obj_in=prediction_in, owner_id=current_user.id)
        except Exception as exc:
            logger.error("Failed to auto-save frame: %s", exc, exc_info=True)

    return {
        "prediction_label": result["prediction_label"],
        "confidence_score": result["confidence_score"],
        "source": result["source"],
        "model_version": result["model_version"],
        "object_detection_available": result.get("object_detection_available", False),
        "object_model_version": result.get("object_model_version"),
        "detections": result.get("detections", []),
        "heatmap_path": result.get("heatmap_path"),
        "timestamp": result.get("timestamp", datetime.utcnow()),
        "fps": result.get("fps"),
        "processing_ms": result.get("processing_ms"),
    }


@router.get("/status", response_model=dict, tags=["Predictions"])
async def get_prediction_status() -> dict:
    return ai_inference_service.status()


@router.get("/me", response_model=List[Prediction], tags=["Predictions"])
async def read_my_predictions(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: DBUser = Depends(get_current_active_user),
):
    return crud_prediction.get_multi_by_owner(db, owner_id=current_user.id, skip=skip, limit=limit)


@router.post("/delete-multiple", tags=["Predictions"])
async def delete_multiple_predictions(
    ids: List[int],
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_active_user),
):
    deleted = 0
    for pred_id in ids:
        pred = crud_prediction.get(db, prediction_id=pred_id)
        if pred and pred.owner_id == current_user.id:
            crud_prediction.remove(db, prediction_id=pred_id)
            deleted += 1
    if deleted:
        crud_activity.log(db, current_user.id, "prediction_delete", f"Deleted {deleted} prediction(s)")
    return {"deleted": deleted}
