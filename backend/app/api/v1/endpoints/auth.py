from fastapi import APIRouter, Request, status

from app.api.deps import CurrentUser, DbSession
from app.core.config import settings
from app.core.rate_limit import limiter
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserOut
from app.schemas.common import ERROR_RESPONSES
from app.services.auth import AuthService

router = APIRouter(prefix="/auth", tags=["auth"], responses=ERROR_RESPONSES)


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.RATE_LIMIT_AUTH)
def register(request: Request, data: RegisterRequest, db: DbSession) -> TokenResponse:
    return AuthService(db).register(data)


@router.post("/login", response_model=TokenResponse)
@limiter.limit(settings.RATE_LIMIT_AUTH)
def login(request: Request, data: LoginRequest, db: DbSession) -> TokenResponse:
    return AuthService(db).login(data)


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)
