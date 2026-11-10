from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.models.enums import ThemePreference
from app.schemas.common import ORMModel
from app.utils.time import is_valid_timezone


class SettingsOut(ORMModel):
    focus_duration_minutes: int
    short_break_minutes: int
    long_break_minutes: int
    long_break_interval: int
    auto_start_breaks: bool
    auto_start_focus: bool
    sound_enabled: bool
    sound_volume: int
    daily_goal_pomodoros: int
    theme: ThemePreference
    timezone: str
    updated_at: datetime


class SettingsUpdate(BaseModel):
    """Partial update - only supplied fields are changed."""

    focus_duration_minutes: int | None = Field(default=None, ge=1, le=180)
    short_break_minutes: int | None = Field(default=None, ge=1, le=60)
    long_break_minutes: int | None = Field(default=None, ge=1, le=120)
    long_break_interval: int | None = Field(default=None, ge=1, le=12)
    auto_start_breaks: bool | None = None
    auto_start_focus: bool | None = None
    sound_enabled: bool | None = None
    sound_volume: int | None = Field(default=None, ge=0, le=100)
    daily_goal_pomodoros: int | None = Field(default=None, ge=1, le=48)
    theme: ThemePreference | None = None
    timezone: str | None = Field(default=None, max_length=64)

    @field_validator("timezone")
    @classmethod
    def _tz(cls, v: str | None) -> str | None:
        if v is not None and not is_valid_timezone(v):
            raise ValueError("Unknown IANA timezone")
        return v
