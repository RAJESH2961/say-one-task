from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Body, Query, status

from app.api.deps import CurrentUser, DbSession
from app.models.enums import SessionStatus, SessionType
from app.repositories.session import SessionFilters
from app.schemas.common import ERROR_RESPONSES, Page
from app.schemas.session import (
    ActiveSessionResponse,
    SessionFinish,
    SessionFinishResponse,
    SessionOut,
    SessionReflectionUpdate,
    SessionStart,
)
from app.schemas.task import TaskOut
from app.services.session import SessionService
from app.utils.time import ensure_utc, utcnow

router = APIRouter(prefix="/sessions", tags=["sessions"], responses=ERROR_RESPONSES)

OptionalFinish = Annotated[SessionFinish | None, Body()]


def _single(service: SessionService, session) -> SessionOut:
    return service.serialize([session])[0]


def _finish_response(service: SessionService, user_id: int, result) -> SessionFinishResponse:
    return SessionFinishResponse(
        session=_single(service, result.session),
        task=TaskOut.model_validate(result.task) if result.task else None,
        cycle=service.cycle(user_id),
    )


@router.post("/start", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
def start_session(data: SessionStart, user: CurrentUser, db: DbSession) -> SessionOut:
    """Start a focus or break session. Returns 409 if the user already has an active session."""
    service = SessionService(db)
    return _single(service, service.start(user.id, data))


@router.get("/active", response_model=ActiveSessionResponse)
def get_active_session(user: CurrentUser, db: DbSession) -> ActiveSessionResponse:
    """Current running/paused session (if any), server time and the suggested next session type."""
    service = SessionService(db)
    now = utcnow()
    active = service.get_active(user.id)
    return ActiveSessionResponse(
        session=service.serialize([active], now)[0] if active else None,
        cycle=service.cycle(user.id),
        server_time=now,
    )


@router.get("/history", response_model=Page[SessionOut])
def session_history(
    user: CurrentUser,
    db: DbSession,
    status_: Annotated[list[SessionStatus] | None, Query(alias="status")] = None,
    session_type: Annotated[list[SessionType] | None, Query()] = None,
    task_id: Annotated[int | None, Query(gt=0)] = None,
    started_from: datetime | None = None,
    started_to: datetime | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Page[SessionOut]:
    service = SessionService(db)
    filters = SessionFilters(
        statuses=status_,
        session_types=session_type,
        task_id=task_id,
        started_from=ensure_utc(started_from) if started_from else None,
        started_to=ensure_utc(started_to) if started_to else None,
        limit=limit,
        offset=offset,
    )
    items, total = service.history(user.id, filters)
    return Page(items=service.serialize(items), total=total, limit=limit, offset=offset)


@router.get("/{session_id}", response_model=SessionOut)
def get_session(session_id: int, user: CurrentUser, db: DbSession) -> SessionOut:
    service = SessionService(db)
    return _single(service, service.get(user.id, session_id))


@router.post("/{session_id}/pause", response_model=SessionOut)
def pause_session(session_id: int, user: CurrentUser, db: DbSession) -> SessionOut:
    service = SessionService(db)
    return _single(service, service.pause(user.id, session_id))


@router.post("/{session_id}/resume", response_model=SessionOut)
def resume_session(session_id: int, user: CurrentUser, db: DbSession) -> SessionOut:
    service = SessionService(db)
    return _single(service, service.resume(user.id, session_id))


@router.post("/{session_id}/complete", response_model=SessionFinishResponse)
def complete_session(
    session_id: int, user: CurrentUser, db: DbSession, data: OptionalFinish = None
) -> SessionFinishResponse:
    """Complete a running session whose planned time has elapsed. A second call returns 409."""
    service = SessionService(db)
    return _finish_response(service, user.id, service.complete(user.id, session_id, data or SessionFinish()))


@router.post("/{session_id}/interrupt", response_model=SessionFinishResponse)
def interrupt_session(
    session_id: int, user: CurrentUser, db: DbSession, data: OptionalFinish = None
) -> SessionFinishResponse:
    """Stop a running or paused session early. Elapsed focus time is still recorded."""
    service = SessionService(db)
    return _finish_response(service, user.id, service.interrupt(user.id, session_id, data or SessionFinish()))


@router.patch("/{session_id}", response_model=SessionOut)
def update_session_reflection(
    session_id: int, data: SessionReflectionUpdate, user: CurrentUser, db: DbSession
) -> SessionOut:
    """Add/edit notes and productivity rating (1-5) on a finished session."""
    service = SessionService(db)
    return _single(service, service.update_reflection(user.id, session_id, data))
