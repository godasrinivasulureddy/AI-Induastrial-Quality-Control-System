from datetime import datetime
from typing import Any, Dict

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_active_user, get_db
from app.crud.prediction import prediction as crud_prediction
from app.crud.activity import activity as crud_activity
from app.models.user import User as DBUser

router = APIRouter()


@router.get("/quality-summary", tags=["Reports"])
async def read_quality_report(
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_active_user),
) -> Dict[str, Any]:
    predictions = crud_prediction.get_multi_by_owner(db, owner_id=current_user.id, skip=0, limit=1000)
    total = len(predictions)
    defective = sum(1 for item in predictions if item.prediction_label == "defective")
    average_confidence = sum((item.confidence_score or 0) for item in predictions) / total if total else 0
    return {
        "generated_at": datetime.utcnow(),
        "owner": current_user.username,
        "summary": {
            "total_predictions": total,
            "defective": defective,
            "non_defective": total - defective,
            "average_confidence": round(average_confidence, 4),
        },
        "recommendations": [
            "Review high-confidence defect samples before shipment release.",
            "Use the heatmap output to align inspection stations with recurring defect regions.",
            "Retrain the detector with confirmed defect samples when confidence drifts below 70%.",
        ],
        "export_formats": ["json", "browser-print-pdf"],
    }


@router.post("/log-activity", tags=["Reports"])
async def log_report_activity(
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_active_user),
):
    crud_activity.log(db, current_user.id, "report_export", "Exported quality report")
    return {"status": "logged"}
