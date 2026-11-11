"""Centralized exception handlers producing a consistent error envelope::

    {"error": {"code": "...", "message": "...", "details": ..., "request_id": "..."}}
"""

from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from sqlalchemy.exc import IntegrityError, OperationalError, SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.core.context import get_request_id
from app.core.exceptions import AppException
from app.core.logging import get_logger

logger = get_logger("errors")


def error_response(status_code: int, code: str, message: str, details: Any = None) -> JSONResponse:
    body: dict[str, Any] = {"error": {"code": code, "message": message, "request_id": get_request_id()}}
    if details is not None:
        body["error"]["details"] = details
    return JSONResponse(status_code=status_code, content=body)


def _request_meta(request: Request) -> dict[str, Any]:
    return {"http_method": request.method, "path": request.url.path}


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    logger.info(
        "Handled application error: %s", exc.code, extra={**_request_meta(request), "status_code": exc.status_code}
    )
    return error_response(exc.status_code, exc.code, exc.message, exc.details)


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    # Never echo the submitted input back (it could contain passwords).
    details = [
        {"field": ".".join(str(p) for p in err.get("loc", []) if p != "body"), "message": err.get("msg"), "type": err.get("type")}
        for err in exc.errors()
    ]
    logger.warning(
        "Request validation failed",
        extra={**_request_meta(request), "fields": [d["field"] for d in details]},
    )
    return error_response(status.HTTP_422_UNPROCESSABLE_ENTITY, "validation_error", "Request validation failed", details)


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    code = {404: "not_found", 405: "method_not_allowed", 401: "not_authenticated", 403: "permission_denied"}.get(
        exc.status_code, "http_error"
    )
    message = exc.detail if isinstance(exc.detail, str) else "Request failed"
    response = error_response(exc.status_code, code, message)
    if exc.headers:
        response.headers.update(exc.headers)
    return response


async def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    logger.warning("Rate limit exceeded", extra={**_request_meta(request), "limit": str(exc.detail)})
    return error_response(
        status.HTTP_429_TOO_MANY_REQUESTS, "rate_limited", f"Too many requests. Limit: {exc.detail}"
    )


async def integrity_error_handler(request: Request, exc: IntegrityError) -> JSONResponse:
    logger.error("Database integrity error", exc_info=exc, extra=_request_meta(request))
    return error_response(
        status.HTTP_409_CONFLICT, "integrity_error", "The request conflicts with existing data or violates a constraint"
    )


async def sqlalchemy_error_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    logger.error("Database error", exc_info=exc, extra=_request_meta(request))
    if isinstance(exc, OperationalError):
        return error_response(status.HTTP_503_SERVICE_UNAVAILABLE, "database_unavailable", "Database temporarily unavailable")
    return error_response(status.HTTP_500_INTERNAL_SERVER_ERROR, "database_error", "A database error occurred")


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.critical("Unhandled exception", exc_info=exc, extra=_request_meta(request))
    details = None if settings.is_production else {"exception": type(exc).__name__}
    return error_response(status.HTTP_500_INTERNAL_SERVER_ERROR, "internal_error", "An unexpected error occurred", details)


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppException, app_exception_handler)  # type: ignore[arg-type]
    app.add_exception_handler(RequestValidationError, validation_exception_handler)  # type: ignore[arg-type]
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)  # type: ignore[arg-type]
    app.add_exception_handler(RateLimitExceeded, rate_limit_handler)  # type: ignore[arg-type]
    app.add_exception_handler(IntegrityError, integrity_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(SQLAlchemyError, sqlalchemy_error_handler)  # type: ignore[arg-type]
    # Generic `Exception` is handled by RequestContextMiddleware so the request id stays bound.
