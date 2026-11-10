from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import func, select

from app.models import Distraction, FocusSession
from app.models.enums import ACTIVE_SESSION_STATUSES, SessionStatus, SessionType
from app.repositories.base import BaseRepository


@dataclass
class SessionFilters:
    statuses: list[SessionStatus] | None = None
    session_types: list[SessionType] | None = None
    task_id: int | None = None
    started_from: datetime | None = None
    started_to: datetime | None = None
    limit: int = 50
    offset: int = 0


class SessionRepository(BaseRepository[FocusSession]):
    model = FocusSession

    def get_for_user(self, user_id: int, session_id: int, *, for_update: bool = False) -> FocusSession | None:
        stmt = select(FocusSession).where(FocusSession.id == session_id, FocusSession.user_id == user_id)
        if for_update:
            # Row lock serialises concurrent transitions (e.g. two tabs completing simultaneously).
            stmt = stmt.with_for_update(of=FocusSession)
        return self.db.scalar(stmt)

    def get_active(self, user_id: int, *, for_update: bool = False) -> FocusSession | None:
        stmt = select(FocusSession).where(
            FocusSession.user_id == user_id, FocusSession.status.in_(ACTIVE_SESSION_STATUSES)
        )
        if for_update:
            stmt = stmt.with_for_update(of=FocusSession)
        return self.db.scalar(stmt)

    def history(self, user_id: int, f: SessionFilters) -> tuple[list[FocusSession], int]:
        stmt = select(FocusSession).where(FocusSession.user_id == user_id)
        if f.statuses:
            stmt = stmt.where(FocusSession.status.in_(f.statuses))
        if f.session_types:
            stmt = stmt.where(FocusSession.session_type.in_(f.session_types))
        if f.task_id:
            stmt = stmt.where(FocusSession.task_id == f.task_id)
        if f.started_from:
            stmt = stmt.where(FocusSession.started_at >= f.started_from)
        if f.started_to:
            stmt = stmt.where(FocusSession.started_at < f.started_to)
        total = self.db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
        items = self.db.scalars(
            stmt.order_by(FocusSession.started_at.desc(), FocusSession.id.desc()).limit(f.limit).offset(f.offset)
        ).unique()
        return list(items), total

    def distraction_counts(self, session_ids: list[int]) -> dict[int, int]:
        if not session_ids:
            return {}
        rows = self.db.execute(
            select(Distraction.session_id, func.count(Distraction.id))
            .where(Distraction.session_id.in_(session_ids))
            .group_by(Distraction.session_id)
        ).all()
        return {sid: count for sid, count in rows}

    def completed_since(self, user_id: int, since: datetime) -> list[FocusSession]:
        """Completed sessions (any type) started at/after ``since``, newest first."""
        return list(
            self.db.scalars(
                select(FocusSession)
                .where(
                    FocusSession.user_id == user_id,
                    FocusSession.status == SessionStatus.COMPLETED,
                    FocusSession.started_at >= since,
                )
                .order_by(FocusSession.started_at.desc())
            ).unique()
        )
