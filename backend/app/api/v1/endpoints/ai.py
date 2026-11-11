from fastapi import APIRouter, Request

from app.api.deps import CurrentUser, DbSession
from app.core.config import settings
from app.core.rate_limit import limiter
from app.schemas.ai import AICoachOut
from app.schemas.common import ERROR_RESPONSES
from app.services.ai import AICoachService

router = APIRouter(prefix="/ai", tags=["ai"], responses=ERROR_RESPONSES)


@router.get("/coach", response_model=AICoachOut)
@limiter.limit(settings.RATE_LIMIT_AI)
def coach(request: Request, user: CurrentUser, db: DbSession) -> AICoachOut:
    """LLM-generated coaching insights from the user's analytics (Groq).

    Returns ``available: false`` when ``GROQ_API_KEY`` is not configured.
    """
    return AICoachService(db).coach(user.id)
