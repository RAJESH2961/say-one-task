from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.middleware import SlowAPIASGIMiddleware

from app.api.health import router as health_router
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.error_handlers import register_exception_handlers
from app.core.logging import get_logger, setup_logging
from app.core.rate_limit import limiter
from app.db.session import engine
from app.middleware.request_context import REQUEST_ID_HEADER, RequestContextMiddleware

setup_logging()
logger = get_logger("main")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    logger.info(
        "Application startup",
        extra={
            "event": "app.startup",
            "version": settings.APP_VERSION,
            "environment": settings.ENVIRONMENT,
            "log_level": settings.LOG_LEVEL,
            "rate_limiting": settings.RATE_LIMIT_ENABLED,
        },
    )
    try:
        yield
    finally:
        engine.dispose()
        logger.info("Application shutdown", extra={"event": "app.shutdown"})


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="FocusFlow - Pomodoro timer, task management and productivity analytics API.",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )
    app.state.limiter = limiter
    register_exception_handlers(app)

    # Middleware: the last one added is the outermost. RequestContextMiddleware wraps everything
    # so every response (incl. CORS preflight, 429s and 500s) carries an X-Request-ID.
    app.add_middleware(SlowAPIASGIMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", REQUEST_ID_HEADER],
        expose_headers=[REQUEST_ID_HEADER],
        max_age=600,
    )
    app.add_middleware(RequestContextMiddleware)

    app.include_router(health_router)
    app.include_router(api_router, prefix=settings.API_V1_PREFIX)
    return app


app = create_app()
