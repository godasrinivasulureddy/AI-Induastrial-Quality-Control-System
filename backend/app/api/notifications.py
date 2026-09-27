from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_active_user, get_db
from app.crud.platform import platform as crud_platform
from app.models.user import User as DBUser
from app.schemas.notification import Notification

router = APIRouter()


@router.get("/", response_model=List[Notification], tags=["Notifications"])
async def read_notifications(
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_active_user),
):
    return crud_platform.list_notifications(db, user_id=current_user.id, limit=80)


@router.patch("/{notification_id}/read", response_model=Notification, tags=["Notifications"])
async def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_active_user),
):
    notification = crud_platform.mark_notification_read(db, notification_id=notification_id, user_id=current_user.id)
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    return notification
