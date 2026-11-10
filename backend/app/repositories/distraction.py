from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import func, select

from app.models import Distraction
from app.repositories.base import BaseRepository
from app.repositories.task import _escape_like


@dataclass
class DistractionFilters:
    category_id: int | None = None
    session_id: int | None = None
    search: str | None = None
    occurred_from: datetime | None = None
    occurred_to: datetime | None = None
    limit: int = 50
    offset: int = 0


class DistractionRepository(BaseRepository[Distraction]):
    model = Distraction

    def get_for_user(self, user_id: int, distraction_id: int) -> Distraction | None:
        return self.db.scalar(
            select(Distraction).where(Distraction.id == distraction_id, Distraction.user_id == user_id)
        )

    def list(self, user_id: int, f: DistractionFilters) -> tuple[list[Distraction], int]:
        stmt = select(Distraction).where(Distraction.user_id == user_id)
        if f.category_id:
            stmt = stmt.where(Distraction.category_id == f.category_id)
        if f.session_id:
            stmt = stmt.where(Distraction.session_id == f.session_id)
        if f.search:
            stmt = stmt.where(Distraction.description.ilike(f"%{_escape_like(f.search.strip())}%", escape="\\"))
        if f.occurred_from:
            stmt = stmt.where(Distraction.occurred_at >= f.occurred_from)
        if f.occurred_to:
            stmt = stmt.where(Distraction.occurred_at < f.occurred_to)
        total = self.db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
        items = self.db.scalars(
            stmt.order_by(Distraction.occurred_at.desc(), Distraction.id.desc()).limit(f.limit).offset(f.offset)
        ).unique()
        return list(items), total
