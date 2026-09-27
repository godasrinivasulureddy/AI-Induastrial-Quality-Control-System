from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.models.system_log import SystemLog
from app.models.uploaded_file import UploadedFile
from app.models.user_setting import UserSetting
from app.schemas.notification import NotificationCreate
from app.schemas.settings import UserSettingUpdate
from app.schemas.system import SystemLogCreate


class PlatformCRUD:
    def get_or_create_settings(self, db: Session, user_id: int) -> UserSetting:
        settings = db.query(UserSetting).filter(UserSetting.user_id == user_id).first()
        if settings:
            return settings
        settings = UserSetting(user_id=user_id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
        return settings

    def update_settings(self, db: Session, settings: UserSetting, obj_in: UserSettingUpdate) -> UserSetting:
        data = obj_in.model_dump(exclude_unset=True)
        for field, value in data.items():
            setattr(settings, field, value)
        db.add(settings)
        db.commit()
        db.refresh(settings)
        return settings

    def create_notification(self, db: Session, user_id: int, obj_in: NotificationCreate) -> Notification:
        obj = Notification(user_id=user_id, **obj_in.model_dump())
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj

    def list_notifications(self, db: Session, user_id: int, limit: int = 50) -> List[Notification]:
        return (
            db.query(Notification)
            .filter(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
            .limit(limit)
            .all()
        )

    def delete_all_notifications(self, db: Session, user_id: int) -> None:
        db.query(Notification).filter(Notification.user_id == user_id).delete(synchronize_session=False)
        db.commit()

    def mark_notification_read(self, db: Session, notification_id: int, user_id: int) -> Optional[Notification]:
        obj = db.query(Notification).filter(Notification.id == notification_id, Notification.user_id == user_id).first()
        if not obj:
            return None
        obj.is_read = True
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj

    def create_uploaded_file(
        self,
        db: Session,
        user_id: int,
        file_path: str,
        file_name: str,
        file_type: str,
        file_size: int,
    ) -> UploadedFile:
        obj = UploadedFile(
            user_id=user_id,
            file_path=file_path,
            file_name=file_name,
            file_type=file_type,
            file_size=file_size,
        )
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj

    def create_log(self, db: Session, obj_in: SystemLogCreate) -> SystemLog:
        obj = SystemLog(**obj_in.model_dump())
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj


platform = PlatformCRUD()
