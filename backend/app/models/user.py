
from sqlalchemy import Boolean, Column, Integer, String
from sqlalchemy.orm import relationship

from app.database.base import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=True)
    role = Column(String, default="student", nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)

    predictions = relationship("Prediction", back_populates="owner")
    activities = relationship("Activity", back_populates="user")
    camera_sessions = relationship("CameraSession", back_populates="user")
    notifications = relationship("Notification", back_populates="user")
    settings = relationship("UserSetting", back_populates="user", uselist=False)
    uploaded_files = relationship("UploadedFile", back_populates="user", cascade="all, delete-orphan")

