from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List
from sqlalchemy import func

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_active_user, get_db
from app.crud.activity import activity as crud_activity
from app.models.prediction import Prediction
from app.models.user import User as DBUser
from app.schemas.analytics import AnalyticsSummary

router = APIRouter()


def _confidence_band(score: float) -> str:
    if score >= 0.85:
        return "High"
    if score >= 0.65:
        return "Medium"
    return "Review"


@router.get("/summary", response_model=AnalyticsSummary, tags=["Analytics"])
async def read_analytics_summary(
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_active_user),
) -> Dict[str, Any]:
    # 1. Total and defective counts utilizing fast database-level aggregates
    total = db.query(func.count(Prediction.id)).filter(Prediction.owner_id == current_user.id).scalar() or 0
    defective = db.query(func.count(Prediction.id)).filter(
        Prediction.owner_id == current_user.id, 
        Prediction.prediction_label == "defective"
    ).scalar() or 0
    non_defective = total - defective

    # 2. Average confidence score on the database layer
    avg_conf_val = db.query(func.avg(Prediction.confidence_score)).filter(Prediction.owner_id == current_user.id).scalar()
    avg_conf = float(avg_conf_val) if avg_conf_val is not None else 0.0

    # 3. Fast oldest timestamp resolution for inspection rate
    oldest = db.query(func.min(Prediction.timestamp)).filter(Prediction.owner_id == current_user.id).scalar()
    if oldest and total > 1:
        hours = max(1.0, (datetime.utcnow() - oldest).total_seconds() / 3600)
        rate = total / hours
    else:
        rate = float(total)

    # 4. Defect distribution grouped by database
    dist_rows = db.query(Prediction.prediction_label, func.count(Prediction.id)).filter(
        Prediction.owner_id == current_user.id
    ).group_by(Prediction.prediction_label).all()
    distribution = [{"name": row[0] or "unknown", "value": row[1]} for row in dist_rows]

    # 5. Fast confidence bands count queries
    high_band = db.query(func.count(Prediction.id)).filter(
        Prediction.owner_id == current_user.id, 
        Prediction.confidence_score >= 0.85
    ).scalar() or 0
    med_band = db.query(func.count(Prediction.id)).filter(
        Prediction.owner_id == current_user.id, 
        Prediction.confidence_score >= 0.65, 
        Prediction.confidence_score < 0.85
    ).scalar() or 0
    review_band = total - high_band - med_band
    confidence_bands = [
        {"name": "High", "value": high_band},
        {"name": "Medium", "value": med_band},
        {"name": "Review", "value": review_band}
    ]

    # 6. Monthly trends using lightweight projection capped at 1000 items
    monthly_data = db.query(Prediction.prediction_label, Prediction.timestamp).filter(
        Prediction.owner_id == current_user.id
    ).order_by(Prediction.timestamp.desc()).limit(1000).all()

    monthly: dict[str, dict[str, Any]] = defaultdict(lambda: {"month": "", "defective": 0, "non_defective": 0, "total": 0})
    for label, timestamp in reversed(monthly_data):
        month = timestamp.strftime("%b %Y")
        monthly[month]["month"] = month
        monthly[month]["total"] += 1
        if label == "defective":
            monthly[month]["defective"] += 1
        else:
            monthly[month]["non_defective"] += 1

    insights: List[str] = []
    recommendations: List[str] = []
    defect_rate = (defective / total * 100) if total else 0
    if total == 0:
        insights.append("No predictions have been recorded yet.")
        recommendations.append("Upload a calibrated product image to establish the first quality baseline.")
    else:
        insights.append(f"{total} inspections recorded with {avg_conf * 100:.1f}% average confidence.")
        insights.append(f"Current defect rate is {defect_rate:.1f}%.")
        if defect_rate > 30:
            recommendations.append("Review the latest defective samples and inspect upstream process drift.")
        if avg_conf < 0.7:
            recommendations.append("Add more labeled samples or lower sensitivity only after manual validation.")
        if not recommendations:
            recommendations.append("Quality trend is stable. Continue monitoring with camera auto-save enabled.")

    return {
        "total_predictions": total,
        "defective_count": defective,
        "non_defective_count": non_defective,
        "defect_rate": round(defect_rate, 2),
        "average_confidence": round(avg_conf, 4),
        "prediction_rate_per_hour": round(rate, 2),
        "distribution": distribution,
        "confidence_bands": confidence_bands,
        "monthly_trends": list(monthly.values())[-12:],
        "insights": insights,
        "recommendations": recommendations,
    }


@router.get("/activity", tags=["Analytics"])
async def read_activity_feed(
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_active_user),
) -> List[dict[str, Any]]:
    activities = crud_activity.get_by_user(db, user_id=current_user.id, skip=0, limit=30)
    return [
        {
            "id": item.id,
            "type": item.activity_type,
            "description": item.description,
            "timestamp": item.timestamp,
        }
        for item in activities
    ]
