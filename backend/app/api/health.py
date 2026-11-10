from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.core.config import settings
from app.core.logging import get_logger
from app.core.rate_limit import limiter
from app.db.session import engine
from app.utils.time import utcnow

router = APIRouter(tags=["health"])
logger = get_logger("health")


@router.get("/health")
@limiter.exempt
async def health(request: Request) -> dict:
    """Liveness probe - the process is up and serving requests."""
    return {"status": "ok", "service": settings.APP_NAME, "version": settings.APP_VERSION, "time": utcnow().isoformat()}


@router.get("/ready")
@limiter.exempt
def ready(request: Request) -> JSONResponse:
    """Readiness probe - verifies database connectivity."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:
        logger.error("Readiness check failed: database unreachable", exc_info=True)
        return JSONResponse(status_code=503, content={"status": "unavailable", "checks": {"database": "error"}})
    return JSONResponse(status_code=200, content={"status": "ready", "checks": {"database": "ok"}})
