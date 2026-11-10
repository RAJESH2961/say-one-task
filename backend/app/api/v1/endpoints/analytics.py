from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DbSession
from app.schemas.analytics import (
    DistractionsAnalyticsOut,
    FocusHoursOut,
    InsightsOut,
    MonthlyOut,
    SummaryOut,
    TasksAnalyticsOut,
    WeeklyOut,
)
from app.schemas.common import ERROR_RESPONSES
from app.services.analytics import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["analytics"], responses=ERROR_RESPONSES)


@router.get("/summary", response_model=SummaryOut)
def summary(user: CurrentUser, db: DbSession) -> SummaryOut:
    """Headline metrics: today, this week, all-time totals, streaks and task completion."""
    return AnalyticsService(db).summary(user.id)


@router.get("/weekly", response_model=WeeklyOut)
def weekly(
    user: CurrentUser, db: DbSession, days: Annotated[int, Query(ge=1, le=366)] = 7
) -> WeeklyOut:
    """Per-day focus series for the last ``days`` days (7 = weekly, 30 = monthly view)."""
    return AnalyticsService(db).weekly(user.id, days)


@router.get("/monthly", response_model=MonthlyOut)
def monthly(
    user: CurrentUser, db: DbSession, months: Annotated[int, Query(ge=1, le=24)] = 6
) -> MonthlyOut:
    return AnalyticsService(db).monthly(user.id, months)


@router.get("/focus-hours", response_model=FocusHoursOut)
def focus_hours(
    user: CurrentUser, db: DbSession, days: Annotated[int, Query(ge=1, le=366)] = 30
) -> FocusHoursOut:
    return AnalyticsService(db).focus_hours(user.id, days)


@router.get("/distractions", response_model=DistractionsAnalyticsOut)
def distractions(
    user: CurrentUser, db: DbSession, days: Annotated[int, Query(ge=1, le=366)] = 30
) -> DistractionsAnalyticsOut:
    return AnalyticsService(db).distractions(user.id, days)


@router.get("/tasks", response_model=TasksAnalyticsOut)
def tasks(user: CurrentUser, db: DbSession) -> TasksAnalyticsOut:
    return AnalyticsService(db).tasks(user.id)


@router.get("/insights", response_model=InsightsOut)
def insights(user: CurrentUser, db: DbSession) -> InsightsOut:
    """Deterministic rule-based productivity insights."""
    return AnalyticsService(db).insights(user.id)
