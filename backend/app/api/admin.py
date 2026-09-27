from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_active_admin, get_db
from app.crud.user import user as crud_user
from app.models.prediction import Prediction
from app.models.system_log import SystemLog
from app.models.uploaded_file import UploadedFile
from app.models.user import User as DBUser
from app.schemas.system import SystemLog as SystemLogSchema, UploadedFile as UploadedFileSchema
from app.schemas.user import User

router = APIRouter()


@router.get("/overview", tags=["Admin"])
async def read_admin_overview(
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_active_admin),
) -> Dict[str, Any]:
    return {
        "users": db.query(DBUser).count(),
        "predictions": db.query(Prediction).count(),
        "uploads": db.query(UploadedFile).count(),
        "logs": db.query(SystemLog).count(),
    }


@router.get("/users", response_model=List[User], tags=["Admin"])
async def read_admin_users(
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_active_admin),
):
    return crud_user.get_multi(db, skip=0, limit=500)


@router.get("/uploads", response_model=List[UploadedFileSchema], tags=["Admin"])
async def read_uploads(
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_active_admin),
):
    return db.query(UploadedFile).order_by(UploadedFile.created_at.desc()).limit(200).all()


@router.get("/logs", response_model=List[SystemLogSchema], tags=["Admin"])
async def read_system_logs(
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_active_admin),
):
    return db.query(SystemLog).order_by(SystemLog.timestamp.desc()).limit(200).all()
