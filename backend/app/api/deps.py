from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.context import user_id_ctx
from app.core.exceptions import AuthenticationError
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models import User
from app.repositories.user import UserRepository

bearer_scheme = HTTPBearer(auto_error=False, description="JWT access token from /auth/login")

DbSession = Annotated[Session, Depends(get_db)]


async def get_token_user_id(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> int:
    """Decode the bearer token. Declared ``async`` so the user id context var is set in the
    request's own context (sync dependencies run in a worker thread with a copied context)."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise AuthenticationError("Not authenticated")
    user_id = decode_access_token(credentials.credentials)
    user_id_ctx.set(user_id)
    return user_id


def get_current_user(db: DbSession, user_id: Annotated[int, Depends(get_token_user_id)]) -> User:
    user = UserRepository(db).get(user_id)
    if user is None or not user.is_active:
        raise AuthenticationError("Account not found or disabled", code="invalid_token")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
