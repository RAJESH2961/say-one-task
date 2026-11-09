"""Pure-ASGI middleware that assigns a request id and writes one access-log record per request.

* Accepts an incoming ``X-Request-ID`` header only if it is a valid UUID (prevents log injection),
  otherwise generates a fresh UUID4.
* The id is stored in a context variable so every log record emitted while handling the
  request carries it, and it is echoed back in the ``X-Request-ID`` response header.
* Query strings, headers and bodies are intentionally *not* logged (they may contain secrets).
"""

from __future__ import annotations

import logging
import time
import uuid

from starlette.requests import Request
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.config import settings
from app.core.context import request_id_ctx, user_id_ctx
from app.core.error_handlers import unhandled_exception_handler
from app.core.logging import ACCESS_LOGGER_NAME, get_logger

REQUEST_ID_HEADER = "x-request-id"
HEALTH_PATHS = frozenset({"/health", "/ready"})

access_logger = logging.getLogger(ACCESS_LOGGER_NAME)
logger = get_logger("middleware")


def _valid_uuid(value: str) -> bool:
    try:
        uuid.UUID(value)
        return True
    except (ValueError, AttributeError):
        return False


class RequestContextMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        incoming = next(
            (v.decode("latin-1") for k, v in scope.get("headers", []) if k.decode("latin-1").lower() == REQUEST_ID_HEADER),
            None,
        )
        request_id = incoming if incoming and _valid_uuid(incoming) else str(uuid.uuid4())
        scope.setdefault("state", {})["request_id"] = request_id
        rid_token = request_id_ctx.set(request_id)
        uid_token = user_id_ctx.set(None)
        start = time.perf_counter()
        status_code = 500
        response_started = False

        async def send_wrapper(message: Message) -> None:
            nonlocal status_code, response_started
            if message["type"] == "http.response.start":
                response_started = True
                status_code = message["status"]
                headers = list(message.get("headers", []))
                headers.append((b"x-request-id", request_id.encode("latin-1")))
                message["headers"] = headers
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception as exc:
            # Handled here (rather than by Starlette's outermost ServerErrorMiddleware) so the
            # request id is still bound to the log record and returned to the client.
            if response_started:
                logger.critical("Unhandled exception after response started", exc_info=exc)
                raise
            response = await unhandled_exception_handler(Request(scope), exc)
            await response(scope, receive, send_wrapper)
        finally:
            self._log_access(scope, status_code, (time.perf_counter() - start) * 1000, request_id)
            user_id_ctx.reset(uid_token)
            request_id_ctx.reset(rid_token)

    @staticmethod
    def _log_access(scope: Scope, status_code: int, duration_ms: float, request_id: str) -> None:
        path = scope.get("path", "")
        if path in HEALTH_PATHS and not settings.LOG_HEALTH_CHECKS and status_code < 400:
            return
        try:
            route = scope.get("route")
            level = logging.ERROR if status_code >= 500 else logging.WARNING if status_code >= 400 else logging.INFO
            access_logger.log(
                level,
                "%s %s %s %.1fms",
                scope.get("method"),
                path,
                status_code,
                duration_ms,
                extra={
                    "http_method": scope.get("method"),
                    "path": path,
                    "route": getattr(route, "path", None),
                    "status_code": status_code,
                    "duration_ms": round(duration_ms, 2),
                    "request_id": request_id,
                    "user_id": user_id_ctx.get(),
                },
            )
        except Exception:  # pragma: no cover - logging must never break a response
            pass
