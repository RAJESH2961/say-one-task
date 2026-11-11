from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import AuthenticationError, ConflictError
from app.core.logging import get_logger
from app.core.security import create_access_token, hash_password, verify_password
from app.db.transaction import transaction
from app.models import User, UserSettings
from app.repositories.user import UserRepository
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserOut
from app.utils.time import is_valid_timezone

logger = get_logger("services.auth")

# Pre-computed hash used to equalise timing when the email does not exist.
_DUMMY_HASH = hash_password("timing-equaliser-password-1")


class AuthService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.users = UserRepository(db)

    def _token_response(self, user: User) -> TokenResponse:
        token, expires_in = create_access_token(user.id)
        return TokenResponse(access_token=token, expires_in=expires_in, user=UserOut.model_validate(user))

    def register(self, data: RegisterRequest) -> TokenResponse:
        if self.users.get_by_email(data.email):
            raise ConflictError("An account with this email already exists", code="email_taken")
        tz = data.timezone if data.timezone and is_valid_timezone(data.timezone) else "UTC"
        try:
            with transaction(self.db, "auth.register"):
                user = self.users.add(
                    User(email=data.email.lower(), full_name=data.full_name, password_hash=hash_password(data.password))
                )
                self.db.add(UserSettings(user_id=user.id, timezone=tz))
        except IntegrityError as exc:  # concurrent registration with the same email
            raise ConflictError("An account with this email already exists", code="email_taken") from exc
        logger.info("User registered", extra={"event": "user.registered", "target_user_id": user.id})
        return self._token_response(user)

    def login(self, data: LoginRequest) -> TokenResponse:
        user = self.users.get_by_email(data.email)
        if user is None:
            verify_password(data.password, _DUMMY_HASH)
            logger.info("Login failed", extra={"event": "auth.login_failed", "reason": "unknown_account"})
            raise AuthenticationError("Incorrect email or password", code="invalid_credentials")
        if not verify_password(data.password, user.password_hash) or not user.is_active:
            logger.info("Login failed", extra={"event": "auth.login_failed", "target_user_id": user.id})
            raise AuthenticationError("Incorrect email or password", code="invalid_credentials")
        logger.info("User logged in", extra={"event": "auth.login", "target_user_id": user.id})
        return self._token_response(user)
