from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database.base import Base


class UserSetting(Base):
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, index=True)
    theme = Column(String, default="dark")
    accent_color = Column(String, default="cyan")
    notifications_enabled = Column(Boolean, default=True)
    voice_notifications = Column(Boolean, default=False)
    confidence_threshold = Column(Float, default=0.55)
    detection_sensitivity = Column(Float, default=0.65)
    camera_device = Column(String, nullable=True)
    language = Column(String, default="en")
    dashboard_density = Column(String, default="comfortable")
    auto_save_detections = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="settings")
