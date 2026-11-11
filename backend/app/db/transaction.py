from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.logging import get_logger

logger = get_logger("db")


@contextmanager
def transaction(db: Session, operation: str) -> Iterator[Session]:
    """Commit on success; roll back (and log database failures) on any error."""
    try:
        yield db
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        logger.error("Database operation failed: %s", operation, exc_info=True, extra={"operation": operation})
        raise
    except Exception:
        db.rollback()
        raise
