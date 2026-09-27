from typing import List

from sqlalchemy.orm import Session

from app.models.activity import Activity
from app.schemas.activity import ActivityCreate


class CRUDActivity:
    def get_by_user(self, db: Session, user_id: int, skip: int = 0, limit: int = 100) -> List[Activity]:
        return (
            db.query(Activity)
            .filter(Activity.user_id == user_id)
            .order_by(Activity.timestamp.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def create(self, db: Session, obj_in: ActivityCreate, user_id: int) -> Activity:
        db_obj = Activity(
            user_id=user_id,
            activity_type=obj_in.activity_type,
            description=obj_in.description,
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def get_activity_calendar(self, db: Session, user_id: int, days: int = 365) -> list:
        """Get activity counts grouped by date for the past N days."""
        from datetime import datetime, timedelta
        from sqlalchemy import func, String
        cutoff = datetime.utcnow() - timedelta(days=days)
        date_col = func.date(Activity.timestamp, type_=String).label("activity_date")
        rows = (
            db.query(
                date_col,
                func.count(Activity.id).label("count"),
            )
            .filter(Activity.user_id == user_id, Activity.timestamp >= cutoff)
            .group_by(date_col)
            .order_by(date_col)
            .all()
        )
        return [{"date": r.activity_date, "count": r.count} for r in rows]

    def log(self, db: Session, user_id: int, activity_type: str, description: str) -> Activity:
        """Quick helper to log an activity."""
        db_obj = Activity(user_id=user_id, activity_type=activity_type, description=description)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj


activity = CRUDActivity()
