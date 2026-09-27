import secrets
from sqlalchemy.orm import Session
from app.models.password_reset_token import PasswordResetToken
from datetime import datetime, timedelta

class CRUDPasswordResetToken:
    def create(self, db: Session, email: str, expires_in_minutes: int = 15) -> PasswordResetToken:
        token_str = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(minutes=expires_in_minutes)
        token_obj = PasswordResetToken(email=email, token=token_str, expires_at=expires_at)
        db.add(token_obj)
        db.commit()
        db.refresh(token_obj)
        return token_obj

    def get_valid(self, db: Session, email: str, token: str) -> PasswordResetToken | None:
        token_obj = (
            db.query(PasswordResetToken)
            .filter(PasswordResetToken.email == email, PasswordResetToken.token == token)
            .first()
        )
        if token_obj and token_obj.is_valid():
            return token_obj
        return None

    def delete(self, db: Session, token_obj: PasswordResetToken) -> None:
        db.delete(token_obj)
        db.commit()

password_reset_token = CRUDPasswordResetToken()
