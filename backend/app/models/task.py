from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import TaskPriority, TaskStatus
from app.models.types import str_enum

if TYPE_CHECKING:
    from app.models.category import Category


class Task(TimestampMixin, Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[TaskPriority] = mapped_column(
        str_enum(TaskPriority, "task_priority"),
        nullable=False,
        default=TaskPriority.MEDIUM,
        server_default=TaskPriority.MEDIUM.value,
    )
    status: Mapped[TaskStatus] = mapped_column(
        str_enum(TaskStatus, "task_status"),
        nullable=False,
        default=TaskStatus.TODO,
        server_default=TaskStatus.TODO.value,
    )
    estimated_pomodoros: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    category: Mapped["Category | None"] = relationship(lazy="joined")

    # `completed_pomodoros` and `focus_seconds` are derived from recorded focus sessions
    # (column properties attached in app/models/__init__.py).

    __table_args__ = (
        CheckConstraint("estimated_pomodoros BETWEEN 1 AND 100", name="estimated_pomodoros_range"),
        CheckConstraint("char_length(title) > 0", name="title_not_empty"),
        CheckConstraint(
            "(status = 'completed') = (completed_at IS NOT NULL)", name="completed_at_matches_status"
        ),
        Index("ix_tasks_user_status", "user_id", "status"),
        Index("ix_tasks_user_start_date", "user_id", "start_date"),
        Index("ix_tasks_category_id", "category_id"),
    )
