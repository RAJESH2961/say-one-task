from sqlalchemy import ForeignKey, Index, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin
from app.models.enums import CategoryKind
from app.models.types import str_enum


class Category(TimestampMixin, Base):
    """Task or distraction category.

    ``user_id IS NULL`` marks a built-in (system) category shared by all users;
    otherwise the category is private to its owner.
    """

    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    kind: Mapped[CategoryKind] = mapped_column(str_enum(CategoryKind, "category_kind"), nullable=False)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    color: Mapped[str] = mapped_column(String(7), nullable=False, default="#2563eb", server_default="#2563eb")

    __table_args__ = (
        Index(
            "uq_categories_system_kind_name",
            "kind",
            func.lower(name),
            unique=True,
            postgresql_where=text("user_id IS NULL"),
        ),
        Index(
            "uq_categories_user_kind_name",
            "user_id",
            "kind",
            func.lower(name),
            unique=True,
            postgresql_where=text("user_id IS NOT NULL"),
        ),
    )

    @property
    def is_system(self) -> bool:
        return self.user_id is None
