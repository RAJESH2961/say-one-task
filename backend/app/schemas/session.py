from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.models.enums import SessionStatus, SessionType
from app.schemas.common import ORMModel
from app.schemas.task import TaskBrief, TaskOut


def _clean_notes(v: str | None) -> str | None:
    if v is None:
        return None
    v = v.strip()
    return v or None


class SessionStart(BaseModel):
    session_type: SessionType = SessionType.FOCUS
    task_id: int | None = Field(default=None, gt=0)
    planned_duration_seconds: int | None = Field(
        default=None, ge=60, le=14400, description="Override; defaults to the user's configured duration"
    )


class SessionFinish(BaseModel):
    notes: str | None = Field(default=None, max_length=2000)
    productivity_rating: int | None = Field(default=None, ge=1, le=5)

    _notes = field_validator("notes")(_clean_notes)


class SessionReflectionUpdate(SessionFinish):
    pass


class SessionOut(ORMModel):
    id: int
    task_id: int | None
    task: TaskBrief | None
    session_type: SessionType
    status: SessionStatus
    planned_duration_seconds: int
    started_at: datetime
    paused_at: datetime | None
    ended_at: datetime | None
    total_paused_seconds: int
    pause_count: int
    actual_duration_seconds: int | None
    notes: str | None
    productivity_rating: int | None
    distraction_count: int = 0
    # Timer state computed by the server at `server_time` (clients derive their countdown from these).
    elapsed_seconds: int
    remaining_seconds: int
    expected_end_at: datetime | None
    server_time: datetime


class TimerCycle(BaseModel):
    next_session_type: SessionType
    completed_focus_in_cycle: int
    long_break_interval: int
    completed_focus_today: int


class ActiveSessionResponse(BaseModel):
    session: SessionOut | None
    cycle: TimerCycle
    server_time: datetime


class SessionFinishResponse(BaseModel):
    session: SessionOut
    task: TaskOut | None
    cycle: TimerCycle
