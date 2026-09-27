import anyio
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import jwt

from app.core.config import settings
from app.database.base import SessionLocal
from app.services.ai_service import ai_inference_service
from app.crud.prediction import prediction as crud_prediction
from app.schemas.prediction import PredictionCreate, Detection

logger = logging.getLogger("app.api.realtime")

router = APIRouter()


def get_user_id_from_token(token: str) -> int | None:
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        return int(payload.get("sub"))
    except Exception:
        return None


@router.websocket("/detections")
async def websocket_detections(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            try:
                payload = await websocket.receive_json()
            except ValueError:
                await websocket.send_json({"error": "Invalid JSON format or empty packet."})
                continue

            image_data = payload.get("image_data")
            threshold = float(payload.get("confidence_threshold", 0.55))
            save_detection = bool(payload.get("save_detection", False))
            token = payload.get("token")

            if not image_data:
                await websocket.send_json({"error": "image_data is required"})
                continue

            if save_detection and not token:
                await websocket.send_json({"error": "Authentication token is required to save detections."})
                continue

            result = await anyio.to_thread.run_sync(
                ai_inference_service.predict_frame, image_data, threshold
            )

            if save_detection:
                user_id = get_user_id_from_token(token)
                if user_id is None:
                    await websocket.send_json({"error": "Invalid or expired token."})
                    continue
                db = SessionLocal()
                try:
                    detections_list = [Detection(**det) for det in result.get("detections", [])]
                    prediction_in = PredictionCreate(
                        image_path=result.get("image_path"),
                        prediction_label=result["prediction_label"],
                        confidence_score=result["confidence_score"],
                        source=result["source"],
                        model_version=result["model_version"],
                        heatmap_path=result.get("heatmap_path"),
                        detections=detections_list,
                    )
                    await anyio.to_thread.run_sync(
                        lambda: crud_prediction.create(db, obj_in=prediction_in, owner_id=user_id)
                    )
                except Exception as db_exc:
                    logger.error("WebSocket auto-save failed: %s", db_exc, exc_info=True)
                finally:
                    db.close()

            await websocket.send_json(
                {
                    "prediction_label": result["prediction_label"],
                    "confidence_score": result["confidence_score"],
                    "detections": result.get("detections", []),
                    "source": result["source"],
                    "model_version": result["model_version"],
                    "heatmap_path": result.get("heatmap_path")
                }
            )
    except WebSocketDisconnect:
        return
