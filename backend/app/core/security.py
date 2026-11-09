from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import settings
from app.core.exceptions import AuthenticationError


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(user_id: int, expires_minutes: int | None = None) -> tuple[str, int]:
    expires_in = (expires_minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES) * 60
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user_id), "iat": now, "exp": now + timedelta(seconds=expires_in), "type": "access"}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM), expires_in


def decode_access_token(token: str) -> int:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError as exc:
        raise AuthenticationError("Session expired, please sign in again", code="token_expired") from exc
    except jwt.PyJWTError as exc:
        raise AuthenticationError("Invalid authentication credentials", code="invalid_token") from exc
    if payload.get("type") != "access" or not str(payload.get("sub", "")).isdigit():
        raise AuthenticationError("Invalid authentication credentials", code="invalid_token")
    return int(payload["sub"])
