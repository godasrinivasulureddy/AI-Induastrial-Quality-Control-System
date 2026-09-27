from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.crud.user import user as crud_user
from app.crud.activity import activity as crud_activity
from app.schemas.user import User, UserCreate
from app.api.dependencies import get_db, get_current_active_user, get_current_active_admin
from app.models.user import User as DBUser

router = APIRouter()

@router.post("/", response_model=User, status_code=status.HTTP_201_CREATED, tags=["Users"])
async def create_user(user_in: UserCreate, db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_active_admin)):
    user = crud_user.get_by_email(db, email=user_in.email)
    if user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already exists")
    return crud_user.create(db, obj_in=user_in)

@router.get("/", response_model=List[User], tags=["Users"])
async def read_users(db: Session = Depends(get_db), skip: int = 0, limit: int = 100, current_user: DBUser = Depends(get_current_active_admin)):
    return crud_user.get_multi(db, skip=skip, limit=limit)

@router.get("/me/activities", tags=["Users"])
async def read_my_activities(db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_active_user)) -> List[dict[str, Any]]:
    activities = crud_activity.get_by_user(db, user_id=current_user.id, skip=0, limit=20)
    return [
        {
            "id": item.id,
            "type": item.activity_type,
            "description": item.description,
            "timestamp": item.timestamp,
        }
        for item in activities
    ]

@router.get("/me/activity-calendar", tags=["Users"])
async def read_my_activity_calendar(
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_active_user),
) -> list:
    return crud_activity.get_activity_calendar(db, user_id=current_user.id)

@router.get("/{user_id}", response_model=User, tags=["Users"])
async def read_user_by_id(user_id: int, db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_active_user)):
    user = crud_user.get(db, user_id=user_id)
    if user == current_user or current_user.is_admin:
        return user
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")