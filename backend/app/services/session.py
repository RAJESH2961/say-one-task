"""Pomodoro session engine.

State machine (validated server-side)::

    start ──► RUNNING ──pause──► PAUSED
                │  ▲                │
                │  └────resume──────┘
                ├──complete──► COMPLETED        (only when the planned time has elapsed)
                └──interrupt─► INTERRUPTED      (from RUNNING or PAUSED)

Timing is purely timestamp based::

    elapsed = (ended_at | paused_at | now) - started_at - total_paused_seconds

Guarantees:
* At most one RUNNING/PAUSED session per user, enforced by a partial unique index; concurrent
  starts from several tabs therefore fail with 409 instead of creating duplicates.
* Every transition locks the session row (``SELECT ... FOR UPDATE``) so concurrent
  completions are serialised and the second one is rejected (no duplicate completions).
"""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings as app_settings
from app.core.exceptions import BusinessValidationError, ConflictError, InvalidStateError, NotFoundError
from app.core.logging import get_logger
from app.db.transaction import transaction
from app.models import FocusSession, Task
from app.models.enums import SessionStatus, SessionType, TaskStatus
from app.repositories.session import SessionFilters, SessionRepository
from app.schemas.session import SessionFinish, SessionOut, SessionReflectionUpdate, SessionStart, TimerCycle
from app.schemas.task import TaskBrief
from app.services.settings import SettingsService
from app.services.task import TaskService
from app.utils.time import get_zone, utcnow

logger = get_logger("services.session")


def elapsed_seconds(session: FocusSession, now: datetime) -> float:
    reference = session.ended_at or session.paused_at or now
    return max(0.0, (reference - session.started_at).total_seconds() - session.total_paused_seconds)


def to_session_out(session: FocusSession, now: datetime, distraction_count: int = 0) -> SessionOut:
    elapsed = elapsed_seconds(session, now)
    remaining = max(0.0, session.planned_duration_seconds - elapsed)
    expected_end = now + timedelta(seconds=remaining) if session.status == SessionStatus.RUNNING else None
    return SessionOut(
        id=session.id,
        task_id=session.task_id,
        task=TaskBrief.model_validate(session.task) if session.task else None,
        session_type=session.session_type,
        status=session.status,
        planned_duration_seconds=session.planned_duration_seconds,
        started_at=session.started_at,
        paused_at=session.paused_at,
        ended_at=session.ended_at,
        total_paused_seconds=session.total_paused_seconds,
        pause_count=session.pause_count,
        actual_duration_seconds=session.actual_duration_seconds,
        notes=session.notes,
        productivity_rating=session.productivity_rating,
        distraction_count=distraction_count,
        elapsed_seconds=int(elapsed),
        remaining_seconds=int(round(remaining)),
        expected_end_at=expected_end,
        server_time=now,
    )


@dataclass
class FinishResult:
    session: FocusSession
    task: Task | None


class SessionService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = SessionRepository(db)
        self.tasks = TaskService(db)
        self.settings = SettingsService(db)

    # ------------------------------------------------------------------ queries
    def get(self, user_id: int, session_id: int, *, for_update: bool = False) -> FocusSession:
        session = self.repo.get_for_user(user_id, session_id, for_update=for_update)
        if session is None:
            raise NotFoundError("Session not found", code="session_not_found")
        return session

    def get_active(self, user_id: int) -> FocusSession | None:
        return self.repo.get_active(user_id)

    def history(self, user_id: int, filters: SessionFilters) -> tuple[list[FocusSession], int]:
        return self.repo.history(user_id, filters)

    def serialize(self, sessions: list[FocusSession], now: datetime | None = None) -> list[SessionOut]:
        now = now or utcnow()
        counts = self.repo.distraction_counts([s.id for s in sessions])
        return [to_session_out(s, now, counts.get(s.id, 0)) for s in sessions]

    def cycle(self, user_id: int) -> TimerCycle:
        """Determine what the next session should be (focus / short break / long break).

        Counts completed focus sessions since the last completed long break (within the
        user's current local day) and suggests a long break every ``long_break_interval``.
        """
        user_settings = self.settings.get(user_id)
        interval = user_settings.long_break_interval
        tz = get_zone(user_settings.timezone)
        local_midnight = datetime.now(tz).replace(hour=0, minute=0, second=0, microsecond=0)
        today = self.repo.completed_since(user_id, local_midnight.astimezone(timezone.utc))

        focus_today = sum(1 for s in today if s.session_type == SessionType.FOCUS)
        in_cycle = 0
        for s in today:  # newest first
            if s.session_type == SessionType.LONG_BREAK:
                break
            if s.session_type == SessionType.FOCUS:
                in_cycle += 1

        last = today[0] if today else None
        if last is not None and last.session_type == SessionType.FOCUS:
            next_type = SessionType.LONG_BREAK if in_cycle > 0 and in_cycle % interval == 0 else SessionType.SHORT_BREAK
        else:
            next_type = SessionType.FOCUS
        shown = in_cycle % interval if not (next_type == SessionType.LONG_BREAK) else interval
        return TimerCycle(
            next_session_type=next_type,
            completed_focus_in_cycle=shown,
            long_break_interval=interval,
            completed_focus_today=focus_today,
        )

    # -------------------------------------------------------------- transitions
    def start(self, user_id: int, data: SessionStart) -> FocusSession:
        existing = self.repo.get_active(user_id)
        if existing is not None:
            raise ConflictError(
                "Another session is already active",
                code="active_session_exists",
                details={"active_session_id": existing.id},
            )

        task: Task | None = None
        if data.task_id is not None:
            if data.session_type != SessionType.FOCUS:
                raise BusinessValidationError("Only focus sessions can be linked to a task", code="invalid_task_link")
            task = self.tasks.get(user_id, data.task_id, for_update=True)
            if task.status == TaskStatus.COMPLETED:
                raise BusinessValidationError("Cannot focus on a completed task", code="task_completed")

        planned = data.planned_duration_seconds or SettingsService.duration_seconds(
            self.settings.get(user_id), data.session_type
        )
        session = FocusSession(
            user_id=user_id,
            task_id=task.id if task else None,
            session_type=data.session_type,
            status=SessionStatus.RUNNING,
            planned_duration_seconds=planned,
            started_at=utcnow(),
            total_paused_seconds=0,
            pause_count=0,
        )
        try:
            with transaction(self.db, "session.start"):
                self.repo.add(session)
                if task is not None:
                    self.tasks.mark_in_progress_if_todo(task)
        except IntegrityError as exc:
            # Lost a race against another tab/device: the partial unique index rejected a 2nd active session.
            active = self.repo.get_active(user_id)
            logger.warning("Concurrent session start rejected", extra={"event": "session.start_conflict"})
            raise ConflictError(
                "Another session is already active",
                code="active_session_exists",
                details={"active_session_id": active.id if active else None},
            ) from exc

        logger.info(
            "Session started",
            extra={
                "event": "session.started",
                "session_id": session.id,
                "session_type": session.session_type.value,
                "task_id": session.task_id,
                "planned_seconds": planned,
            },
        )
        return session

    def pause(self, user_id: int, session_id: int) -> FocusSession:
        with transaction(self.db, "session.pause"):
            session = self.get(user_id, session_id, for_update=True)
            if session.status != SessionStatus.RUNNING:
                raise InvalidStateError(f"Cannot pause a session that is {session.status.value}")
            now = utcnow()
            if elapsed_seconds(session, now) >= session.planned_duration_seconds:
                raise InvalidStateError("Session time has already elapsed; complete it instead", code="session_elapsed")
            session.status = SessionStatus.PAUSED
            session.paused_at = now
            session.pause_count += 1
        logger.info("Session paused", extra={"event": "session.paused", "session_id": session.id})
        return session

    def resume(self, user_id: int, session_id: int) -> FocusSession:
        with transaction(self.db, "session.resume"):
            session = self.get(user_id, session_id, for_update=True)
            if session.status != SessionStatus.PAUSED or session.paused_at is None:
                raise InvalidStateError(f"Cannot resume a session that is {session.status.value}")
            now = utcnow()
            session.total_paused_seconds += max(0, int(round((now - session.paused_at).total_seconds())))
            session.paused_at = None
            session.status = SessionStatus.RUNNING
        logger.info("Session resumed", extra={"event": "session.resumed", "session_id": session.id})
        return session

    def complete(self, user_id: int, session_id: int, data: SessionFinish) -> FinishResult:
        with transaction(self.db, "session.complete"):
            session = self.get(user_id, session_id, for_update=True)
            if session.status == SessionStatus.COMPLETED:
                raise ConflictError("Session has already been completed", code="session_already_completed")
            if session.status != SessionStatus.RUNNING:
                raise InvalidStateError(f"Cannot complete a session that is {session.status.value}")
            now = utcnow()
            elapsed = elapsed_seconds(session, now)
            if elapsed + app_settings.SESSION_COMPLETION_GRACE_SECONDS < session.planned_duration_seconds:
                raise InvalidStateError(
                    "Session has not finished yet; interrupt it to stop early",
                    code="session_not_finished",
                    details={"remaining_seconds": int(session.planned_duration_seconds - elapsed)},
                )
            # Record the true end of the countdown (the client may report completion late, e.g. after a refresh).
            theoretical_end = session.started_at + timedelta(
                seconds=session.total_paused_seconds + session.planned_duration_seconds
            )
            session.ended_at = min(now, max(theoretical_end, session.started_at))
            session.actual_duration_seconds = session.planned_duration_seconds
            session.status = SessionStatus.COMPLETED
            self._apply_reflection(session, data)
        task = self._refreshed_task(session)
        logger.info(
            "Session completed",
            extra={
                "event": "session.completed",
                "session_id": session.id,
                "session_type": session.session_type.value,
                "task_id": session.task_id,
                "duration_seconds": session.actual_duration_seconds,
                "late_by_seconds": int(max(0.0, elapsed - session.planned_duration_seconds)),
            },
        )
        return FinishResult(session=session, task=task)

    def interrupt(self, user_id: int, session_id: int, data: SessionFinish) -> FinishResult:
        with transaction(self.db, "session.interrupt"):
            session = self.get(user_id, session_id, for_update=True)
            if session.status not in (SessionStatus.RUNNING, SessionStatus.PAUSED):
                raise InvalidStateError(f"Cannot interrupt a session that is {session.status.value}")
            now = utcnow()
            if session.paused_at is not None:
                session.total_paused_seconds += max(0, int(round((now - session.paused_at).total_seconds())))
                session.paused_at = None
            session.ended_at = now
            session.actual_duration_seconds = int(min(elapsed_seconds(session, now), session.planned_duration_seconds))
            session.status = SessionStatus.INTERRUPTED
            self._apply_reflection(session, data)
        task = self._refreshed_task(session)
        logger.info(
            "Session interrupted",
            extra={
                "event": "session.interrupted",
                "session_id": session.id,
                "session_type": session.session_type.value,
                "duration_seconds": session.actual_duration_seconds,
            },
        )
        return FinishResult(session=session, task=task)

    def update_reflection(self, user_id: int, session_id: int, data: SessionReflectionUpdate) -> FocusSession:
        with transaction(self.db, "session.reflection"):
            session = self.get(user_id, session_id, for_update=True)
            if session.status not in (SessionStatus.COMPLETED, SessionStatus.INTERRUPTED):
                raise InvalidStateError("Notes and ratings can only be added to finished sessions")
            self._apply_reflection(session, data, partial=True)
        logger.info("Session reflection updated", extra={"event": "session.reflection", "session_id": session.id})
        return session

    # ----------------------------------------------------------------- helpers
    @staticmethod
    def _apply_reflection(session: FocusSession, data: SessionFinish, partial: bool = False) -> None:
        fields = data.model_dump(exclude_unset=True) if partial else data.model_dump(exclude_none=True)
        for key, value in fields.items():
            setattr(session, key, value)

    def _refreshed_task(self, session: FocusSession) -> Task | None:
        if session.task_id is None:
            return None
        task = self.db.get(Task, session.task_id)
        if task is not None:
            self.db.refresh(task)  # recompute derived completed_pomodoros / focus_seconds
        return task
