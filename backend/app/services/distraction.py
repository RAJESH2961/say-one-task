from datetime import timedelta

from sqlalchemy.orm import Session

from app.core.exceptions import BusinessValidationError, NotFoundError
from app.core.logging import get_logger
from app.db.transaction import transaction
from app.models import Distraction
from app.models.enums import CategoryKind
from app.repositories.distraction import DistractionFilters, DistractionRepository
from app.repositories.session import SessionRepository
from app.schemas.distraction import DistractionCreate
from app.services.category import CategoryService
from app.utils.time import ensure_utc, utcnow

logger = get_logger("services.distraction")

# Allow small client clock drift when validating that a distraction is not in the future.
_FUTURE_TOLERANCE = timedelta(minutes=5)


class DistractionService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = DistractionRepository(db)
        self.sessions = SessionRepository(db)
        self.categories = CategoryService(db)

    def create(self, user_id: int, data: DistractionCreate) -> Distraction:
        self.categories.resolve(user_id, data.category_id, CategoryKind.DISTRACTION)
        if data.session_id is not None and self.sessions.get_for_user(user_id, data.session_id) is None:
            raise BusinessValidationError("Session not found", code="invalid_session")
        now = utcnow()
        occurred_at = ensure_utc(data.occurred_at) if data.occurred_at else now
        if occurred_at > now + _FUTURE_TOLERANCE:
            raise BusinessValidationError("occurred_at cannot be in the future", code="invalid_occurred_at")

        distraction = Distraction(
            user_id=user_id,
            description=data.description,
            category_id=data.category_id,
            session_id=data.session_id,
            occurred_at=occurred_at,
        )
        with transaction(self.db, "distraction.create"):
            self.repo.add(distraction)
        self.db.refresh(distraction)
        logger.info(
            "Distraction recorded",
            extra={
                "event": "distraction.recorded",
                "distraction_id": distraction.id,
                "category_id": distraction.category_id,
                "session_id": distraction.session_id,
            },
        )
        return distraction

    def list(self, user_id: int, filters: DistractionFilters) -> tuple[list[Distraction], int]:
        return self.repo.list(user_id, filters)

    def delete(self, user_id: int, distraction_id: int) -> None:
        distraction = self.repo.get_for_user(user_id, distraction_id)
        if distraction is None:
            raise NotFoundError("Distraction not found", code="distraction_not_found")
        with transaction(self.db, "distraction.delete"):
            self.repo.delete(distraction)
        logger.info("Distraction deleted", extra={"event": "distraction.deleted", "distraction_id": distraction_id})
