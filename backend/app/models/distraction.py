from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.category import Category
    from app.models.focus_session import FocusSession


class Distraction(TimestampMixin, Base):
    __tablename__ = "distractions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    session_id: Mapped[int | None] = mapped_column(
        ForeignKey("focus_sessions.id", ondelete="SET NULL"), nullable=True
    )
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
    )
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    category: Mapped["Category | None"] = relationship(lazy="joined")
    session: Mapped["FocusSession | None"] = relationship(lazy="joined")

    __table_args__ = (
        CheckConstraint("char_length(description) > 0", name="description_not_empty"),
        Index("ix_distractions_user_occurred_at", "user_id", "occurred_at"),
        Index("ix_distractions_session_id", "session_id"),
        Index("ix_distractions_category_id", "category_id"),
    )
