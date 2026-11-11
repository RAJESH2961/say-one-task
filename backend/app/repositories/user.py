from sqlalchemy import func, select

from app.models import User, UserSettings
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    model = User

    def get(self, user_id: int) -> User | None:
        return self.db.get(User, user_id)

    def get_by_email(self, email: str) -> User | None:
        return self.db.scalar(select(User).where(func.lower(User.email) == email.lower()))


class SettingsRepository(BaseRepository[UserSettings]):
    model = UserSettings

    def get_for_user(self, user_id: int) -> UserSettings | None:
        return self.db.scalar(select(UserSettings).where(UserSettings.user_id == user_id))
