from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.db.transaction import transaction
from app.models import UserSettings
from app.models.enums import SessionType
from app.repositories.user import SettingsRepository
from app.schemas.settings import SettingsUpdate

logger = get_logger("services.settings")


class SettingsService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = SettingsRepository(db)

    def get(self, user_id: int) -> UserSettings:
        settings = self.repo.get_for_user(user_id)
        if settings is None:  # self-heal accounts created without a settings row
            with transaction(self.db, "settings.create_default"):
                settings = self.repo.add(UserSettings(user_id=user_id))
            logger.warning("Created missing settings row", extra={"event": "settings.self_heal"})
        return settings

    def update(self, user_id: int, data: SettingsUpdate) -> UserSettings:
        settings = self.get(user_id)
        changes = data.model_dump(exclude_unset=True, exclude_none=True)
        with transaction(self.db, "settings.update"):
            for key, value in changes.items():
                setattr(settings, key, value)
        self.db.refresh(settings)
        logger.info("Settings updated", extra={"event": "settings.updated", "fields": sorted(changes)})
        return settings

    @staticmethod
    def duration_seconds(settings: UserSettings, session_type: SessionType) -> int:
        minutes = {
            SessionType.FOCUS: settings.focus_duration_minutes,
            SessionType.SHORT_BREAK: settings.short_break_minutes,
            SessionType.LONG_BREAK: settings.long_break_minutes,
        }[session_type]
        return minutes * 60
