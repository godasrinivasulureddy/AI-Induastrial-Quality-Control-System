import base64
import hashlib
import json
import logging
import os
import uuid
from threading import Lock
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import cv2
import numpy as np

from app.core.config import settings

logger = logging.getLogger("app.services.ai_service")

ROOT_DIR = Path(__file__).resolve().parents[3]
UPLOAD_DIR = ROOT_DIR / "uploads"
HEATMAP_DIR = ROOT_DIR / "analytics" / "heatmaps"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
HEATMAP_DIR.mkdir(parents=True, exist_ok=True)

# Fixed YOLO detection threshold — always low (0.25) so small/partial objects
# like cell phones are not filtered out by the quality confidence slider.
YOLO_OBJECT_THRESHOLD: float = 0.25

# Classes that are treated as inspectable products in Quality mode.
# 'person' is intentionally excluded so a person holding a product is not
# labelled as the defective/non-defective subject.
PRODUCT_CLASSES: set = {
    "cell phone", "laptop", "keyboard", "mouse", "remote",
    "bottle", "cup", "wine glass", "bowl",
    "book", "vase", "scissors", "toothbrush",
    "tv", "monitor", "clock",
    "car", "truck", "bus", "bicycle", "motorcycle",
    "suitcase", "backpack", "handbag", "umbrella",
    "chair", "couch", "bed", "dining table",
    "microwave", "oven", "toaster", "refrigerator", "sink",
    "airplane", "boat",
    "object", "product", "defect",
}

# Classifier score band where the model is uncertain (typically 0.50–0.57
# for the current undertrained model). Predictions in this range should be
# flagged as uncertain rather than presented as confident PASS/FAIL.
MODEL_UNCERTAIN_BAND = (0.50, 0.57)

PRODUCT_MODEL_FILES = {
    "mobile": "mobile_model.h5",
    "cardboard_boxes": "cardboard_boxes_model.h5",
    "cars": "cars_model.h5",
    "plastic_bottles": "plastic_bottles_model.h5",
    "steel_surface": "steel_surface_model.h5",
}


class ProductModelUnavailable(RuntimeError):
    pass


class ProductModelVersionChanged(RuntimeError):
    pass


class AIInferenceService:
    """YOLO-ready inference service with a deterministic OpenCV fallback.

    The fallback keeps the product usable during development when trained YOLO
    weights are not present. Drop a YOLOv8 model path into AI_MODEL_PATH to use
    real object detection without changing the API contract.
    """

    def __init__(self) -> None:
        self.model = None
        self.tf_model = None
        self.keras_models = {}
        self.product_model_metadata = {}
        self.product_model_locks = {product: Lock() for product in PRODUCT_MODEL_FILES}
        self.model_version = "fallback-cv-v1"
        self.source = "opencv-heuristic"
        self.model_path = str((ROOT_DIR / settings.AI_MODEL_PATH).resolve())
        self.tf_model_path = str((ROOT_DIR / settings.TF_DEFECT_MODEL_PATH).resolve())
        self.load_errors = []

        # Lazy Load product-specific TensorFlow Keras models
        try:
            self._models_dir = ROOT_DIR / "AI_Quality_Control_System" / "models"
            for pt, filename in PRODUCT_MODEL_FILES.items():
                model_file = self._models_dir / filename
                if model_file.is_file():
                    try:
                        checksum = hashlib.sha256(model_file.read_bytes()).hexdigest()
                        self.product_model_metadata[pt] = {
                            "model_id": model_file.stem,
                            "model_version": f"{model_file.stem}:sha256:{checksum}",
                            "model_checksum": checksum,
                        }
                        self.keras_models[pt] = None
                    except Exception as exc:
                        msg = f"Metadata checksum failed for {pt}: {exc}"
                        logger.error(msg)
                        self.load_errors.append(msg)
            
            if self.keras_models:
                self.source = "tf-classifier"
                # Keep legacy variables populated for backwards compatibility
                if "mobile" in self.keras_models:
                    self.model_version = "mobile_model"
                    self.model_path = str(self._models_dir / "mobile_model.h5")
        except Exception as e:
            msg = f"Could not load TensorFlow classifiers: {e}"
            logger.error(msg, exc_info=True)
            self.load_errors.append(msg)
            self.source = "opencv-heuristic"

        # Always attempt to load YOLO model for object detection
        try:
            from ultralytics import YOLO  # type: ignore
            logger.info("Attempting to load YOLOv8 model for object detection...")
            
            # Resolve paths
            yolo_path = ROOT_DIR / settings.AI_MODEL_PATH
            if not yolo_path.exists():
                yolo_path = ROOT_DIR / "backend" / "yolov8n.pt"
            
            allow_download = os.getenv("AI_ALLOW_DOWNLOAD", "false").lower() in ("true", "1", "yes")
            
            # Check if file/directory actually exists to prevent automatic internet download
            if yolo_path.exists():
                logger.info("Loading YOLO model from local path: %s", yolo_path.resolve())
                self.model = YOLO(str(yolo_path))
                self.model_path = str(yolo_path.resolve())
                self.model_version = yolo_path.stem
                logger.info("✓ YOLO model loaded successfully from %s", self.model_path)
            elif allow_download and (settings.AI_MODEL_PATH.endswith(".pt") or settings.AI_MODEL_PATH == "yolov8n"):
                logger.info("YOLO local path not found. Downloading standard model since AI_ALLOW_DOWNLOAD is enabled: %s", settings.AI_MODEL_PATH)
                self.model = YOLO(settings.AI_MODEL_PATH)
                self.model_path = settings.AI_MODEL_PATH
                self.model_version = "yolov8n"
                logger.info("✓ YOLO model downloaded and loaded successfully.")
            else:
                msg = f"YOLO model file not found locally at {yolo_path.resolve()} and online download is disabled."
                logger.warning(msg)
                self.load_errors.append(msg)
        except ImportError:
            logger.info("ultralytics not available, skipping YOLO loading")
        except Exception as e:
            msg = f"Could not load YOLO model: {e}"
            logger.error(msg, exc_info=True)
            self.load_errors.append(msg)
            self.model = None

    @property
    def model_loaded(self) -> bool:
        return bool(self.keras_models) or self.model is not None

    def status(self) -> Dict[str, Any]:
        return {
            "model_loaded": self.model_loaded,
            "tf_model_loaded": bool(self.keras_models),
            "yolo_model_loaded": self.model is not None,
            "tf_model_path": self.tf_model_path,
            "yolo_model_path": self.model_path if self.source == "yolov8" else str((ROOT_DIR / settings.AI_MODEL_PATH).resolve()),
            "source": self.source,
            "model_version": self.model_version,
            "using_fallback": not self.model_loaded,
            "load_errors": getattr(self, "load_errors", []),
            "fallback_reason": self.load_errors[-1] if self.load_errors else None,
            "product_models": {
                product: {
                    "available": product in self.keras_models,
                    **self.product_model_metadata.get(product, {}),
                }
                for product in PRODUCT_MODEL_FILES
            },
        }

    def resolve_product_model(self, product_type: str, expected_version: Optional[str] = None) -> Dict[str, str]:
        if product_type not in PRODUCT_MODEL_FILES:
            raise ValueError(f"Unsupported product type: {product_type}")
        if product_type not in self.keras_models or product_type not in self.product_model_metadata:
            raise ProductModelUnavailable(f"Trained model unavailable for {product_type}")
        metadata = self.product_model_metadata[product_type]
        if expected_version is not None and expected_version != metadata["model_version"]:
            raise ProductModelVersionChanged("Model version changed during this job. Start a new job.")
        return dict(metadata)

    def predict_product(self, image_path: str, product_type: str, expected_version: Optional[str] = None) -> Dict[str, Any]:
        """Classify exactly this input with the requested trained model; never substitute another model."""
        metadata = self.resolve_product_model(product_type, expected_version)
        result = self._tf_classify(image_path, 0.55, product_type, strict=True)
        result.update(metadata)
        result["heatmap_path"] = self._write_heatmap(image_path)
        result["timestamp"] = datetime.utcnow()
        return result

    def _read_image(self, image_path: str) -> np.ndarray:
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError("Image could not be read")
        return image

    def _fallback_detect(self, image: np.ndarray, threshold: float = 0.55) -> Dict[str, Any]:
        """Improved fallback detection with more balanced classification."""
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        edges = cv2.Canny(blurred, 50, 150)  # More sensitive edge detection
        
        # Calculate multiple feature scores
        edge_density = float(edges.sum()) / (255 * edges.size)  # Normalized edge ratio
        texture_score = float(gray.std()) / 256.0  # Normalized texture variance
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()  # Sharpness measure
        
        # Weighted scoring - less aggressive thresholding
        raw_score = (edge_density * 0.4) + (texture_score * 0.3) + (min(1.0, laplacian_var / 1000.0) * 0.3)
        
        # More conservative classification threshold (configurable)
        is_defective = raw_score > float(settings.AI_FALLBACK_THRESHOLD)
        label = "defective" if is_defective else "non-defective"
        
        # More realistic confidence scores
        if is_defective:
            confidence = min(0.95, 0.55 + raw_score * 0.4)
        else:
            confidence = min(0.98, 0.75 + (1 - raw_score) * 0.2)

        # Detect contours for detailed annotations
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        h, w = gray.shape[:2]
        min_area = max(100, int(w * h * 0.003))
        detections: List[Dict[str, Any]] = []
        
        for contour in sorted(contours, key=cv2.contourArea, reverse=True)[:5]:  # Only top 5
            area = cv2.contourArea(contour)
            if area < min_area:
                continue
            x, y, bw, bh = cv2.boundingRect(contour)
            area_ratio = area / (w * h)
            
            # Only add detections for actual defects
            if is_defective and area_ratio > 0.001:
                detections.append(
                    {
                        "label": "surface defect",
                        "confidence": round(min(0.92, confidence - 0.1 + area_ratio * 2), 4),
                        "box": {
                            "x": round(x / w, 4),
                            "y": round(y / h, 4),
                            "width": round(bw / w, 4),
                            "height": round(bh / h, 4),
                        },
                    }
                )

        if label == "defective" and not detections:
            # Only add default detection if we're actually predicting defective with high confidence
            if confidence > 0.6:
                detections.append(
                    {
                        "label": "suspected defect region",
                        "confidence": round(float(confidence - 0.1), 4),
                        "box": {"x": 0.1, "y": 0.1, "width": 0.8, "height": 0.8},
                    }
                )

        # model_uncertain is always True for the OpenCV fallback since it is a
        # heuristic, not a trained classifier.
        return {
            "prediction_label": label,
            "confidence_score": round(float(confidence), 4),
            "review_required": True,
            "model_uncertain": True,
            "detections": detections,
            "source": self.source,
            "model_version": self.model_version,
        }

    def _yolo_detect(self, image_path: str, threshold: float = YOLO_OBJECT_THRESHOLD) -> Optional[Dict[str, Any]]:
        """Run YOLO object detection. Always uses YOLO_OBJECT_THRESHOLD (0.25),
        NOT the quality confidence slider, so small products like phones are
        not inadvertently filtered out."""
        if self.model is None:
            return None
        # Hardcoded low threshold — separate from quality review threshold
        results = self.model.predict(image_path, conf=YOLO_OBJECT_THRESHOLD, verbose=False)
        detections: List[Dict[str, Any]] = []
        image = self._read_image(image_path)
        h, w = image.shape[:2]
        for result in results:
            boxes = getattr(result, "boxes", None)
            if boxes is None:
                continue
            names = getattr(result, "names", {})
            for box in boxes:
                cls_index = int(box.cls[0])
                confidence = float(box.conf[0])
                x1, y1, x2, y2 = [float(v) for v in box.xyxy[0]]
                detections.append(
                    {
                        "label": str(names.get(cls_index, "defect")),
                        "confidence": round(confidence, 4),
                        "class_id": cls_index,
                        "bbox": [round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)],
                        "box": {
                            "x": round(x1 / w, 4),
                            "y": round(y1 / h, 4),
                            "width": round((x2 - x1) / w, 4),
                            "height": round((y2 - y1) / h, 4),
                        },
                    }
                )

        return {
            "detections": detections,
            "object_detection_available": True,
            "object_model_version": self.model_version,
        }

    def _get_model(self, product_type: str):
        if product_type not in self.keras_models:
            return None
        with self.product_model_locks[product_type]:
            if self.keras_models[product_type] is not None:
                return self.keras_models[product_type]
            try:
                from tensorflow.keras.models import load_model  # type: ignore
                model_file = self._models_dir / PRODUCT_MODEL_FILES[product_type]
                logger.info("Lazy loading TensorFlow classifier for %s from %s...", product_type, model_file)
                model = load_model(str(model_file))
                if tuple(model.input_shape[1:]) != (224, 224, 3) or tuple(model.output_shape[1:]) != (2,):
                    raise ValueError("Expected a 224x224 RGB classifier with two class scores")
                self.keras_models[product_type] = model
                logger.info("✅ TensorFlow classifier for %s lazy-loaded successfully!", product_type)
                return model
            except Exception as e:
                msg = f"Failed to lazy load model {product_type}: {e}"
                logger.error(msg)
                self.load_errors.append(msg)
                return None

    def _tf_classify(self, image_path: str, threshold: float = 0.5, product_type: str = "mobile", strict: bool = False) -> Optional[Dict[str, Any]]:
        model = self._get_model(product_type)
        if model is None:
            if strict:
                raise ProductModelUnavailable(f"Trained model unavailable for {product_type}")
            logger.warning("No Keras model found for product type: %s", product_type)
            return None

        try:
            from tensorflow.keras.applications.mobilenet_v2 import preprocess_input  # type: ignore
            image = cv2.imread(image_path)
            if image is None:
                raise ValueError("Image could not be read")
            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            image = cv2.resize(image, (224, 224))
            arr = image.astype("float32")
            arr = preprocess_input(arr)
            arr = np.expand_dims(arr, axis=0)
            with self.product_model_locks[product_type]:
                preds = model.predict(arr, verbose=0)[0]
            if len(preds) != 2 or not np.isfinite(preds).all():
                raise ValueError("Classifier returned invalid class scores")
            prob_defective = float(preds[0])
            prob_good = float(preds[1])

            is_good = prob_good >= prob_defective
            label = "non-defective" if is_good else "defective"
            confidence = prob_good if is_good else prob_defective

            # review_required = True when model is not confident enough vs threshold
            review_required = confidence < threshold

            # model_uncertain = True when the classifier score falls in the known
            # dead zone (0.50–0.57) where the current model outputs nearly the
            # same value regardless of whether the image is defective or not.
            # In this band the result should NOT be presented as a confident PASS/FAIL.
            lo, hi = MODEL_UNCERTAIN_BAND
            model_uncertain = bool(lo <= confidence <= hi)

            detections = []
            if not is_good:
                detections = [
                    {
                        "label": "defect",
                        "confidence": round(confidence, 4),
                        "box": {"x": 0.0, "y": 0.0, "width": 1.0, "height": 1.0},
                    }
                ]

            return {
                "prediction_label": label,
                "confidence_score": round(confidence, 4),
                "review_required": review_required,
                "model_uncertain": model_uncertain,
                "detections": detections,
                "source": "tf-classifier",
                "model_version": f"{product_type}_model" if product_type in self.keras_models else self.model_version,
            }
        except Exception as e:
            logger.error("TF classification failed: %s", e, exc_info=True)
            if strict:
                raise
            return None

    def _write_heatmap(self, image_path: str) -> Optional[str]:
        try:
            image = self._read_image(image_path)
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            edges = cv2.Canny(gray, 80, 180)
            heat = cv2.applyColorMap(edges, cv2.COLORMAP_TURBO)
            overlay = cv2.addWeighted(image, 0.72, heat, 0.28, 0)
            file_name = f"heatmap_{uuid.uuid4().hex}.jpg"
            output_path = HEATMAP_DIR / file_name
            cv2.imwrite(str(output_path), overlay)
            return f"analytics/heatmaps/{file_name}"
        except Exception:
            return None

    def predict_image(self, image_path: str, confidence_threshold: float = 0.55, product_type: str = "mobile") -> Dict[str, Any]:
        result = self._tf_classify(image_path, confidence_threshold, product_type, strict=True)
        result["heatmap_path"] = self._write_heatmap(image_path)
        result["timestamp"] = datetime.utcnow()
        return result

    def save_frame(self, image_data: str) -> str:
        # 1. Reject empty base64 payloads
        if not image_data or not isinstance(image_data, str):
            raise ValueError("Empty image payload")

        # 2. Safely handle data URLs (e.g. data:image/png;base64,...)
        if "," in image_data:
            image_data = image_data.split(",", 1)[1]

        image_data = image_data.strip()
        if not image_data:
            raise ValueError("Empty image payload")

        # 3. Add missing base64 padding safely if needed
        padding = len(image_data) % 4
        if padding:
            image_data += "=" * (4 - padding)

        # 4. Catch base64 decoding errors cleanly
        try:
            payload = base64.b64decode(image_data, validate=True)
        except Exception as exc:
            raise ValueError(f"Invalid base64 image data: {exc}")

        # 5. Validate decoded bytes are a real image using cv2.imdecode result check
        try:
            nparr = np.frombuffer(payload, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None or img.size == 0:
                raise ValueError("Corrupted image data or unsupported format")
        except Exception as exc:
            raise ValueError(f"Invalid image format or corrupted image payload: {exc}")

        # 6. Save the validated image to disk (only written to disk after verification)
        filename = f"camera_{uuid.uuid4().hex}.jpg"
        path = UPLOAD_DIR / filename
        try:
            path.write_bytes(payload)
        except Exception as exc:
            raise ValueError(f"Failed to save decoded image: {exc}")

        return str(path)

    def predict_frame(self, image_data: str, confidence_threshold: float = 0.55, product_type: str = "mobile") -> Dict[str, Any]:
        import time
        start_time = time.time()

        path = self.save_frame(image_data)
        
        # 1. Run standard defect inspection (strict product matching)
        defect_result = self.predict_image(path, confidence_threshold, product_type=product_type)
        
        # 2. Run object detection if YOLO is available (always at YOLO_OBJECT_THRESHOLD=0.25,
        #    never at the quality/review confidence_threshold from the UI slider).
        object_detections = []
        object_model_ver = None
        obj_available = self.model is not None

        if obj_available:
            yolo_res = self._yolo_detect(path)  # threshold arg intentionally omitted → 0.25
            if yolo_res and "detections" in yolo_res:
                object_detections = yolo_res["detections"]
                object_model_ver = yolo_res.get("object_model_version")

        # 3. Determine whether a product-like object was detected by YOLO.
        #    Exclude 'person' — a person holding a product is not the inspected subject.
        product_boxes = [
            d for d in object_detections
            if d.get("label", "").lower() in PRODUCT_CLASSES
        ]
        product_detected = len(product_boxes) > 0
        product_detection_warning: Optional[str] = None
        if not product_detected and obj_available:
            # YOLO ran but found no product-like object (possibly only person, or empty frame)
            product_detection_warning = "Product object not detected clearly"

        end_time = time.time()
        processing_ms = (end_time - start_time) * 1000
        fps = 1000.0 / processing_ms if processing_ms > 0 else 0.0

        return {
            "prediction_label": defect_result["prediction_label"],
            "confidence_score": defect_result["confidence_score"],
            "review_required": defect_result.get("review_required", False),
            "model_uncertain": defect_result.get("model_uncertain", False),
            "product_detected": product_detected,
            "product_detection_warning": product_detection_warning,
            "source": defect_result["source"],
            "model_version": defect_result["model_version"],
            "object_detection_available": obj_available,
            "object_model_version": object_model_ver,
            "detections": object_detections,
            "heatmap_path": defect_result.get("heatmap_path"),
            "image_path": f"uploads/{Path(path).name}",
            "timestamp": defect_result.get("timestamp", datetime.utcnow()),
            "fps": round(fps, 2),
            "processing_ms": round(processing_ms, 1)
        }

    def predict_video(self, video_path: str, confidence_threshold: float = 0.55, max_frames: int = 12) -> Dict[str, Any]:
        try:
            max_frames = int(max_frames)
        except (ValueError, TypeError):
            max_frames = 12
        max_frames = max(1, min(max_frames, 30))

        capture = cv2.VideoCapture(video_path)
        if not capture.isOpened():
            raise ValueError("Video could not be opened")
        frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        step = max(1, frame_count // max_frames) if frame_count else 12
        results: List[Dict[str, Any]] = []
        index = 0
        sampled = 0
        while capture.isOpened() and sampled < max_frames:
            ok, frame = capture.read()
            if not ok:
                break
            if index % step == 0:
                temp_path = UPLOAD_DIR / f"video_frame_{uuid.uuid4().hex}.jpg"
                cv2.imwrite(str(temp_path), frame)
                try:
                    results.append(self.predict_image(str(temp_path), confidence_threshold))
                finally:
                    temp_path.unlink(missing_ok=True)
                sampled += 1
            index += 1
        capture.release()
        if not results:
            raise ValueError("No readable frames were found")
        defect_frames = [item for item in results if item["prediction_label"] == "defective"]
        avg_confidence = sum(item["confidence_score"] for item in results) / len(results)
        detections = [det for item in results for det in item.get("detections", [])[:3]]
        return {
            "prediction_label": "defective" if defect_frames else "non-defective",
            "confidence_score": round(float(avg_confidence), 4),
            "detections": detections[:20],
            "source": self.source,
            "model_version": f"{self.model_version}:video",
            "heatmap_path": None,
            "timestamp": datetime.utcnow(),
        }

    @staticmethod
    def dumps_detections(detections: List[Dict[str, Any]]) -> str:
        return json.dumps(detections, separators=(",", ":"))


ai_inference_service = AIInferenceService()
