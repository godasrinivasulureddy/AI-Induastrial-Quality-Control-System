from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_active_user, get_db
from app.crud.activity import activity as crud_activity
from app.crud.platform import platform as crud_platform
from app.models.user import User as DBUser
from app.schemas.activity import ActivityCreate
from app.schemas.settings import UserSetting, UserSettingUpdate

router = APIRouter()


@router.get("/me", response_model=UserSetting, tags=["Settings"])
async def read_my_settings(
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_active_user),
):
    return crud_platform.get_or_create_settings(db, user_id=current_user.id)


@router.put("/me", response_model=UserSetting, tags=["Settings"])
async def update_my_settings(
    payload: UserSettingUpdate,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_active_user),
):
    settings = crud_platform.get_or_create_settings(db, user_id=current_user.id)
    updated = crud_platform.update_settings(db, settings=settings, obj_in=payload)
    crud_activity.create(
        db,
        obj_in=ActivityCreate(activity_type="settings_update", description="Settings updated"),
        user_id=current_user.id,
    )
    return updated
