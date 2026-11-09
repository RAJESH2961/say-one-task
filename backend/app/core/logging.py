"""Centralized, structured (JSON) logging configuration.

Three rotating log files are produced inside ``settings.LOG_DIR``:

* ``app.log``    - application/business events (all levels >= LOG_LEVEL, excluding access logs)
* ``error.log``  - ERROR and CRITICAL records with full stack traces
* ``access.log`` - one record per HTTP request (written only by the ``focusflow.access`` logger)

Files are rotated by ``ConcurrentRotatingFileHandler`` (safe across multiple worker
processes) at ``LOG_MAX_BYTES`` keeping ``LOG_BACKUP_COUNT`` backups. A console handler is
added for container / hosting-platform log collection.

``setup_logging`` is idempotent: calling it repeatedly never duplicates handlers.
"""

from __future__ import annotations

import json
import logging
import re
import sys
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from concurrent_log_handler import ConcurrentRotatingFileHandler

from app.core.config import Settings, settings
from app.core.context import request_id_ctx, user_id_ctx

ACCESS_LOGGER_NAME = "focusflow.access"
APP_LOGGER_NAME = "focusflow"
_HANDLER_MARKER = "_focusflow_handler"
_configured = False

_STANDARD_ATTRS = frozenset(
    vars(logging.LogRecord("", 0, "", 0, "", (), None)).keys()
    | {"message", "asctime", "request_id", "user_id", "taskName"}
)

_SENSITIVE_KEY_RE = re.compile(
    r"(pass(word|wd)?|secret|token|authorization|auth|cookie|api[_-]?key|credential|session[_-]?key|email|phone)",
    re.IGNORECASE,
)
_REDACTION_PATTERNS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"(?i)bearer\s+[A-Za-z0-9\-._~+/]+=*"), "Bearer [REDACTED]"),
    (re.compile(r"eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}"), "[REDACTED_JWT]"),
    (
        re.compile(
            r"(?i)\b(password|passwd|secret|token|api[_-]?key|authorization)\b(\s*[=:]\s*)"
            r"(?!\[REDACTED|Bearer \[REDACTED)(\"[^\"]*\"|'[^']*'|[^\s,;&]+)"
        ),
        r"\1\2[REDACTED]",
    ),
    (re.compile(r"(?i)(postgres(?:ql)?(?:\+\w+)?://[^:/\s]+:)([^@\s]+)(@)"), r"\1[REDACTED]\3"),
    (re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"), "[REDACTED_EMAIL]"),
)
REDACTED = "[REDACTED]"


def redact_text(value: str) -> str:
    for pattern, repl in _REDACTION_PATTERNS:
        value = pattern.sub(repl, value)
    return value


def redact_value(key: str | None, value: Any) -> Any:
    if key is not None and _SENSITIVE_KEY_RE.search(key):
        return REDACTED
    if isinstance(value, str):
        return redact_text(value)
    if isinstance(value, dict):
        return {k: redact_value(str(k), v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [redact_value(None, v) for v in value]
    return value


class RequestContextFilter(logging.Filter):
    """Injects the current request id and user id (from context vars) into every record."""

    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "request_id"):
            record.request_id = request_id_ctx.get()
        if not hasattr(record, "user_id"):
            record.user_id = user_id_ctx.get()
        return True


class SensitiveDataFilter(logging.Filter):
    """Redacts secrets / personal data from messages, args and structured extras."""

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            if record.args:
                record.msg = record.getMessage()
                record.args = None
            if isinstance(record.msg, str):
                record.msg = redact_text(record.msg)
            for key in list(vars(record)):
                if key not in _STANDARD_ATTRS:
                    setattr(record, key, redact_value(key, getattr(record, key)))
        except Exception:  # pragma: no cover - never let redaction break logging
            record.msg = "[log message redaction failed]"
            record.args = None
        return True


class AccessOnlyFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        return record.name == ACCESS_LOGGER_NAME


class ExcludeAccessFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        return record.name != ACCESS_LOGGER_NAME


class JsonFormatter(logging.Formatter):
    def __init__(self, service: str, environment: str) -> None:
        super().__init__()
        self.service = service
        self.environment = environment

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", None),
            "user_id": getattr(record, "user_id", None),
            "service": self.service,
            "environment": self.environment,
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
            "process": record.process,
        }
        extras = {k: v for k, v in vars(record).items() if k not in _STANDARD_ATTRS}
        if extras:
            payload["extra"] = extras
        if record.exc_info and record.exc_info[0] is not None:
            exc_type, exc_value, exc_tb = record.exc_info
            payload["exception"] = {
                "type": exc_type.__name__,
                "message": redact_text(str(exc_value)),
                "stacktrace": redact_text("".join(traceback.format_exception(exc_type, exc_value, exc_tb))),
            }
        elif record.stack_info:
            payload["stack_info"] = redact_text(record.stack_info)
        return json.dumps(payload, default=str, ensure_ascii=False)


class ConsoleFormatter(logging.Formatter):
    def __init__(self) -> None:
        super().__init__("%(asctime)s %(levelname)-8s [%(request_id)s] %(name)s: %(message)s")


class SafeConcurrentRotatingFileHandler(ConcurrentRotatingFileHandler):
    """Process-safe rotating file handler that never propagates write failures to callers."""

    def emit(self, record: logging.LogRecord) -> None:
        try:
            super().emit(record)
        except Exception:
            self.handleError(record)


def _mark(handler: logging.Handler) -> logging.Handler:
    setattr(handler, _HANDLER_MARKER, True)
    handler.addFilter(RequestContextFilter())
    handler.addFilter(SensitiveDataFilter())
    return handler


def _file_handler(path: Path, cfg: Settings, level: int, formatter: logging.Formatter) -> logging.Handler:
    handler = SafeConcurrentRotatingFileHandler(
        str(path), mode="a", maxBytes=cfg.LOG_MAX_BYTES, backupCount=cfg.LOG_BACKUP_COUNT, encoding="utf-8"
    )
    handler.setLevel(level)
    handler.setFormatter(formatter)
    return _mark(handler)


def _remove_our_handlers(logger: logging.Logger) -> None:
    for handler in list(logger.handlers):
        if getattr(handler, _HANDLER_MARKER, False):
            logger.removeHandler(handler)
            try:
                handler.close()
            except Exception:  # pragma: no cover
                pass


def setup_logging(cfg: Settings = settings, force: bool = False) -> None:
    """Configure application logging. Safe to call multiple times."""
    global _configured
    if _configured and not force:
        return

    # A failing handler must never crash request handling.
    logging.raiseExceptions = False

    level = logging.getLevelName(cfg.LOG_LEVEL or "INFO")
    root = logging.getLogger()
    access_logger = logging.getLogger(ACCESS_LOGGER_NAME)
    _remove_our_handlers(root)
    _remove_our_handlers(access_logger)

    root.setLevel(level)
    access_logger.setLevel(logging.INFO)
    access_logger.propagate = False

    json_formatter = JsonFormatter(cfg.APP_NAME, cfg.ENVIRONMENT)
    file_errors: list[str] = []
    try:
        cfg.LOG_DIR.mkdir(parents=True, exist_ok=True)
        for name in ("app.log", "error.log", "access.log"):  # handlers open lazily; create files up-front
            (cfg.LOG_DIR / name).touch(exist_ok=True)
        app_handler = _file_handler(cfg.LOG_DIR / "app.log", cfg, level, json_formatter)
        app_handler.addFilter(ExcludeAccessFilter())
        root.addHandler(app_handler)
        root.addHandler(_file_handler(cfg.LOG_DIR / "error.log", cfg, logging.ERROR, json_formatter))
        access_handler = _file_handler(cfg.LOG_DIR / "access.log", cfg, logging.INFO, json_formatter)
        access_handler.addFilter(AccessOnlyFilter())
        access_logger.addHandler(access_handler)
    except OSError as exc:  # unwritable volume etc. - fall back to console-only logging
        file_errors.append(f"{type(exc).__name__}: {exc}")

    if cfg.LOG_TO_CONSOLE:
        console = logging.StreamHandler(sys.stdout)
        console.setLevel(level)
        console.setFormatter(json_formatter if cfg.LOG_JSON_CONSOLE else ConsoleFormatter())
        _mark(console)
        root.addHandler(console)
        access_logger.addHandler(console)

    # Route third-party loggers through our handlers; silence uvicorn's own access log.
    for name in ("uvicorn", "uvicorn.error", "fastapi"):
        lg = logging.getLogger(name)
        lg.handlers.clear()
        lg.propagate = True
    uvicorn_access = logging.getLogger("uvicorn.access")
    uvicorn_access.handlers.clear()
    uvicorn_access.propagate = False
    uvicorn_access.disabled = True
    logging.getLogger("sqlalchemy.engine").setLevel(logging.INFO if cfg.DB_ECHO else logging.WARNING)
    logging.getLogger("watchfiles").setLevel(logging.WARNING)

    _configured = True
    if file_errors:
        logging.getLogger(APP_LOGGER_NAME).error(
            "File logging unavailable, using console only", extra={"errors": file_errors}
        )


def get_logger(name: str) -> logging.Logger:
    """Return a namespaced application logger (``focusflow.<name>``)."""
    return logging.getLogger(f"{APP_LOGGER_NAME}.{name}" if not name.startswith(APP_LOGGER_NAME) else name)
