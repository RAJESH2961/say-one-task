from sqlalchemy import func, select
from sqlalchemy.orm import column_property

from app.models.category import Category
from app.models.distraction import Distraction
from app.models.enums import SessionStatus, SessionType
from app.models.focus_session import FocusSession
from app.models.settings import UserSettings
from app.models.task import Task
from app.models.user import User

# Task progress is *derived* from recorded sessions rather than stored counters,
# so it can never drift from the session history.
Task.completed_pomodoros = column_property(
    select(func.count(FocusSession.id))
    .where(
        FocusSession.task_id == Task.id,
        FocusSession.session_type == SessionType.FOCUS,
        FocusSession.status == SessionStatus.COMPLETED,
    )
    .correlate_except(FocusSession)
    .scalar_subquery()
)
Task.focus_seconds = column_property(
    select(func.coalesce(func.sum(FocusSession.actual_duration_seconds), 0))
    .where(
        FocusSession.task_id == Task.id,
        FocusSession.session_type == SessionType.FOCUS,
        FocusSession.status.in_((SessionStatus.COMPLETED, SessionStatus.INTERRUPTED)),
    )
    .correlate_except(FocusSession)
    .scalar_subquery()
)

__all__ = ["Category", "Distraction", "FocusSession", "Task", "User", "UserSettings"]
