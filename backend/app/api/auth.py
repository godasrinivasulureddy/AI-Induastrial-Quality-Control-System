
from datetime import timedelta
from typing import Any
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.crud.user import user as crud_user
from app.crud.activity import activity as crud_activity
from app.schemas.activity import ActivityCreate
from app.schemas.auth import ForgotPasswordRequest, ForgotPasswordResponse, ResetPasswordRequest, ResetPasswordResponse
from app.schemas.token import Token
from app.schemas.user import UserCreate, User
from app.core.security import verify_password, create_access_token
from app.core.config import settings
from app.crud.password_reset_token import password_reset_token
from app.api.dependencies import get_db, get_current_active_user

router = APIRouter()


@router.post("/login", response_model=Token, tags=["Authentication"])
async def login_access_token(db: Session = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()) -> Any:
    user = crud_user.get_by_email(db, email=form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Incorrect email or password")
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    crud_activity.log(db, user.id, "login", "User logged in")
    return {"access_token": create_access_token(user.id, expires_delta=access_token_expires), "token_type": "bearer"}


@router.post("/signup", response_model=User, status_code=status.HTTP_201_CREATED, tags=["Authentication"])
async def signup(user_in: UserCreate, db: Session = Depends(get_db)) -> Any:
    email = user_in.email.lower()
    existing_user = crud_user.get_by_email(db, email=email)
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already exists")

    # Build sanitized payload
    safe_data = user_in.model_dump()
    safe_data["email"] = email
    safe_data["is_admin"] = False
    if safe_data.get("role") not in {"student", "faculty", "engineer"}:
        safe_data["role"] = "student"

    sanitized_user_in = UserCreate(**safe_data)
    return crud_user.create(db, obj_in=sanitized_user_in)


@router.post("/forgot-password", response_model=ForgotPasswordResponse, tags=["Authentication"])
async def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)) -> Any:
    user = crud_user.get_by_email(db, email=request.email)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email not found")

    # Create a persistent reset token with 15 min expiry
    token_obj = password_reset_token.create(db, email=request.email.lower())
    return ForgotPasswordResponse(
        message="If an account exists for this email, a reset token has been generated.",
    )


@router.post("/reset-password", response_model=ResetPasswordResponse, tags=["Authentication"])
async def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)) -> Any:
    email = request.email.lower()
    # Verify token using CRUD and ensure it's still valid
    token_obj = password_reset_token.get_valid(db, email=email, token=request.token)
    if not token_obj:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")
    # Retrieve user and ensure they exist before attempting update
    user = crud_user.get_by_email(db, email=email)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    # Update password securely
    crud_user.update(db, user, {"password": request.password})
    # Delete used token
    password_reset_token.delete(db, token_obj)
    return ResetPasswordResponse(message="Password has been updated successfully.")


@router.get("/me", response_model=User, tags=["Authentication"])
async def read_users_me(current_user: User = Depends(get_current_active_user)) -> Any:
    return current_user
