from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Integer, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import ThemePreference
from app.models.types import str_enum

if TYPE_CHECKING:
    from app.models.user import User


class UserSettings(TimestampMixin, Base):
    __tablename__ = "user_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    focus_duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=25, server_default="25")
    short_break_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=5, server_default="5")
    long_break_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=15, server_default="15")
    long_break_interval: Mapped[int] = mapped_column(Integer, nullable=False, default=4, server_default="4")
    auto_start_breaks: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    auto_start_focus: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    sound_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    sound_volume: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=70, server_default="70")
    daily_goal_pomodoros: Mapped[int] = mapped_column(Integer, nullable=False, default=8, server_default="8")
    theme: Mapped[ThemePreference] = mapped_column(
        str_enum(ThemePreference, "theme_preference"),
        nullable=False,
        default=ThemePreference.SYSTEM,
        server_default=ThemePreference.SYSTEM.value,
    )
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="UTC", server_default="UTC")

    user: Mapped["User"] = relationship(back_populates="settings")

    __table_args__ = (
        CheckConstraint("focus_duration_minutes BETWEEN 1 AND 180", name="focus_duration_range"),
        CheckConstraint("short_break_minutes BETWEEN 1 AND 60", name="short_break_range"),
        CheckConstraint("long_break_minutes BETWEEN 1 AND 120", name="long_break_range"),
        CheckConstraint("long_break_interval BETWEEN 1 AND 12", name="long_break_interval_range"),
        CheckConstraint("sound_volume BETWEEN 0 AND 100", name="sound_volume_range"),
        CheckConstraint("daily_goal_pomodoros BETWEEN 1 AND 48", name="daily_goal_range"),
    )
