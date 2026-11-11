from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, SmallInteger, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import SessionStatus, SessionType
from app.models.types import str_enum

if TYPE_CHECKING:
    from app.models.task import Task


class FocusSession(TimestampMixin, Base):
    """A single Pomodoro interval (focus or break).

    Timing is timestamp based: ``elapsed = (ended_at|paused_at|now) - started_at - total_paused_seconds``.
    """

    __tablename__ = "focus_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    task_id: Mapped[int | None] = mapped_column(ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True)
    session_type: Mapped[SessionType] = mapped_column(str_enum(SessionType, "session_type"), nullable=False)
    status: Mapped[SessionStatus] = mapped_column(
        str_enum(SessionStatus, "session_status"),
        nullable=False,
        default=SessionStatus.RUNNING,
        server_default=SessionStatus.RUNNING.value,
    )
    planned_duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    paused_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    total_paused_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    pause_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    productivity_rating: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)

    task: Mapped["Task | None"] = relationship(lazy="joined")

    __table_args__ = (
        CheckConstraint("planned_duration_seconds BETWEEN 60 AND 14400", name="planned_duration_range"),
        CheckConstraint("total_paused_seconds >= 0", name="paused_seconds_positive"),
        CheckConstraint("actual_duration_seconds IS NULL OR actual_duration_seconds >= 0", name="actual_positive"),
        CheckConstraint(
            "productivity_rating IS NULL OR productivity_rating BETWEEN 1 AND 5", name="rating_range"
        ),
        CheckConstraint("(status = 'paused') = (paused_at IS NOT NULL)", name="paused_at_matches_status"),
        CheckConstraint(
            "(status IN ('completed', 'interrupted')) = (ended_at IS NOT NULL)", name="ended_at_matches_status"
        ),
        CheckConstraint("ended_at IS NULL OR ended_at >= started_at", name="ended_after_started"),
        # Database-level guarantee: at most one running/paused session per user
        # (protects against races from multiple browser tabs / devices).
        Index(
            "uq_focus_sessions_one_active_per_user",
            "user_id",
            unique=True,
            postgresql_where=text("status IN ('running', 'paused')"),
        ),
        Index("ix_focus_sessions_user_started_at", "user_id", "started_at"),
        Index("ix_focus_sessions_task_status", "task_id", "status"),
        Index("ix_focus_sessions_user_type_status", "user_id", "session_type", "status"),
    )
