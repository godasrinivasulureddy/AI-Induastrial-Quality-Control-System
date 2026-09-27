
from typing import Optional, List

from sqlalchemy.orm import Session

from app.models.prediction import Prediction
from app.schemas.prediction import PredictionCreate


class CRUDPrediction:
    def get(self, db: Session, prediction_id: int) -> Optional[Prediction]:
        return db.query(Prediction).filter(Prediction.id == prediction_id).first()

    def create(self, db: Session, obj_in: PredictionCreate, owner_id: int) -> Prediction:
        import json
        detections_val = None
        if obj_in.detections is not None:
            # detections is a list of Pydantic Detection models or dictionaries
            serialized_list = []
            for det in obj_in.detections:
                if hasattr(det, "dict"):
                    serialized_list.append(det.dict())
                else:
                    serialized_list.append(det)
            detections_val = json.dumps(serialized_list)

        db_obj = Prediction(
            image_path=obj_in.image_path,
            prediction_label=obj_in.prediction_label,
            confidence_score=obj_in.confidence_score,
            source=obj_in.source or "heuristic",
            model_version=obj_in.model_version or "fallback-cv-v1",
            heatmap_path=obj_in.heatmap_path,
            detections_json=detections_val,
            owner_id=owner_id
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj


    def get_multi_by_owner(self, db: Session, owner_id: int, skip: int = 0, limit: int = 100) -> List[Prediction]:
        return (
            db.query(Prediction)
            .filter(Prediction.owner_id == owner_id)
            .order_by(Prediction.timestamp.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def remove(self, db: Session, prediction_id: int) -> Optional[Prediction]:
        obj = db.query(Prediction).filter(Prediction.id == prediction_id).first()
        if obj:
            db.delete(obj)
            db.commit()
        return obj

prediction = CRUDPrediction()
