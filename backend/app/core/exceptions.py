from typing import Any


class AppException(Exception):
    """Base class for expected, client-facing application errors."""

    status_code: int = 400
    code: str = "bad_request"

    def __init__(self, message: str, *, code: str | None = None, details: Any = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details
        if code:
            self.code = code


class NotFoundError(AppException):
    status_code = 404
    code = "not_found"


class ConflictError(AppException):
    status_code = 409
    code = "conflict"


class InvalidStateError(AppException):
    """Raised when a requested state transition is not allowed (e.g. completing a paused session)."""

    status_code = 409
    code = "invalid_state_transition"


class BusinessValidationError(AppException):
    status_code = 422
    code = "validation_error"


class AuthenticationError(AppException):
    status_code = 401
    code = "not_authenticated"


class PermissionDeniedError(AppException):
    status_code = 403
    code = "permission_denied"


class ExternalServiceError(AppException):
    """A third-party service (e.g. the Groq AI API) failed or is not configured."""

    status_code = 503
    code = "external_service_error"
