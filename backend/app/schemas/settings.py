from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class UserSettingBase(BaseModel):
    theme: str = "dark"
    accent_color: str = "cyan"
    notifications_enabled: bool = True
    voice_notifications: bool = False
    confidence_threshold: float = 0.55
    detection_sensitivity: float = 0.65
    camera_device: Optional[str] = None
    language: str = "en"
    dashboard_density: str = "comfortable"
    auto_save_detections: bool = True


class UserSettingUpdate(BaseModel):
    theme: Optional[str] = None
    accent_color: Optional[str] = None
    notifications_enabled: Optional[bool] = None
    voice_notifications: Optional[bool] = None
    confidence_threshold: Optional[float] = None
    detection_sensitivity: Optional[float] = None
    camera_device: Optional[str] = None
    language: Optional[str] = None
    dashboard_density: Optional[str] = None
    auto_save_detections: Optional[bool] = None


class UserSetting(UserSettingBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
