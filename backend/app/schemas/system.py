from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class SystemLogCreate(BaseModel):
    event_type: str
    message: str
    level: str = "info"
    user_id: Optional[int] = None


class SystemLog(SystemLogCreate):
    id: int
    timestamp: datetime

    class Config:
        from_attributes = True


class UploadedFile(BaseModel):
    id: int
    user_id: int
    file_path: str
    file_name: str
    file_type: str
    file_size: int
    created_at: datetime

    class Config:
        from_attributes = True
