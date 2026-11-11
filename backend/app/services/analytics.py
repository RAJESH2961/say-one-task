"""Productivity analytics computed from recorded sessions, tasks and distractions."""

from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy.orm import Session

from app.repositories.analytics import AnalyticsRepository
from app.schemas.analytics import (
    DailyPoint,
    DistractionCategoryCount,
    DistractionsAnalyticsOut,
    FocusHoursOut,
    HourPoint,
    InsightOut,
    InsightsOut,
    MonthlyOut,
    MonthlyPoint,
    SummaryOut,
    TaskBucket,
    TasksAnalyticsOut,
    WeeklyOut,
)
from app.services.settings import SettingsService
from app.utils.time import get_zone, local_today


def compute_streaks(focus_days: list[date], today: date) -> tuple[int, int]:
    """Return (current, longest) streak of consecutive days. ``focus_days`` may be in any order.

    The current streak stays alive if the most recent focus day is today *or yesterday*
    (so the streak isn't shown as broken before the user has had a chance to focus today).
    """
    days = sorted(set(focus_days))
    if not days:
        return 0, 0
    longest = run = 1
    for prev, cur in zip(days, days[1:]):
        run = run + 1 if (cur - prev).days == 1 else 1
        longest = max(longest, run)

    current = 0
    if (today - days[-1]).days <= 1:
        current = 1
        for i in range(len(days) - 1, 0, -1):
            if (days[i] - days[i - 1]).days == 1:
                current += 1
            else:
                break
    return current, longest


def format_hour(hour: int) -> str:
    suffix = "AM" if hour < 12 else "PM"
    return f"{hour % 12 or 12} {suffix}"


class AnalyticsService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = AnalyticsRepository(db)
        self.settings = SettingsService(db)

    # ---------------------------------------------------------------- helpers
    def _tz(self, user_id: int) -> tuple[str, object]:
        s = self.settings.get(user_id)
        return s.timezone, get_zone(s.timezone)

    @staticmethod
    def _local_midnight_utc(day: date, zone) -> datetime:
        return datetime.combine(day, time.min, tzinfo=zone).astimezone(timezone.utc)

    @staticmethod
    def _best_hour(rows) -> int | None:
        best = max(rows, key=lambda r: (r.focus_seconds, r.pomodoros), default=None)
        return int(best.hour) if best is not None and best.focus_seconds > 0 else None

    # -------------------------------------------------------------- endpoints
    def summary(self, user_id: int) -> SummaryOut:
        user_settings = self.settings.get(user_id)
        tz_name, zone = user_settings.timezone, get_zone(user_settings.timezone)
        today = local_today(tz_name)
        today_start = self._local_midnight_utc(today, zone)
        tomorrow_start = self._local_midnight_utc(today + timedelta(days=1), zone)
        week_start = self._local_midnight_utc(today - timedelta(days=today.weekday()), zone)

        totals = self.repo.focus_totals(user_id)
        today_totals = self.repo.focus_totals(user_id, today_start, tomorrow_start)
        week_totals = self.repo.focus_totals(user_id, week_start, tomorrow_start)
        current_streak, longest_streak = compute_streaks(self.repo.focus_days(user_id, tz_name), today)
        tasks = self.repo.task_counts(user_id)

        return SummaryOut(
            timezone=tz_name,
            today=today,
            today_focus_seconds=today_totals.focus_seconds,
            today_pomodoros=today_totals.pomodoros,
            today_tasks_completed=self.repo.tasks_completed_between(user_id, today_start, tomorrow_start),
            week_focus_seconds=week_totals.focus_seconds,
            week_pomodoros=week_totals.pomodoros,
            total_pomodoros=totals.pomodoros,
            total_focus_seconds=totals.focus_seconds,
            total_sessions=totals.sessions,
            interrupted_sessions=totals.interrupted,
            average_session_seconds=totals.average_seconds,
            current_streak_days=current_streak,
            longest_streak_days=longest_streak,
            total_tasks=tasks.total,
            completed_tasks=tasks.completed,
            task_completion_rate=round(tasks.completed * 100 / tasks.total, 1) if tasks.total else 0.0,
            average_productivity_rating=totals.average_rating,
            daily_goal_pomodoros=user_settings.daily_goal_pomodoros,
            most_productive_hour=self._best_hour(self.repo.focus_by_hour(user_id, tz_name, None)),
            total_distractions=self.repo.distraction_total(user_id),
        )

    def weekly(self, user_id: int, days: int = 7) -> WeeklyOut:
        tz_name, zone = self._tz(user_id)
        end_day = local_today(tz_name)
        start_day = end_day - timedelta(days=days - 1)
        start = self._local_midnight_utc(start_day, zone)
        end = self._local_midnight_utc(end_day + timedelta(days=1), zone)
        rows = self.repo.daily_series(user_id, tz_name, start_day, end_day, start, end)
        series = [
            DailyPoint(
                date=r.date,
                focus_seconds=int(r.focus_seconds),
                pomodoros=r.pomodoros,
                interrupted=r.interrupted,
                distractions=r.distractions,
            )
            for r in rows
        ]
        total = sum(p.focus_seconds for p in series)
        previous = self.repo.focus_totals(user_id, self._local_midnight_utc(start_day - timedelta(days=days), zone), start)
        best = max(series, key=lambda p: p.focus_seconds, default=None)
        return WeeklyOut(
            days=days,
            start_date=start_day,
            end_date=end_day,
            total_focus_seconds=total,
            total_pomodoros=sum(p.pomodoros for p in series),
            average_daily_focus_seconds=total // days,
            best_day=best.date if best and best.focus_seconds > 0 else None,
            previous_period_focus_seconds=previous.focus_seconds,
            change_percent=round((total - previous.focus_seconds) * 100 / previous.focus_seconds, 1)
            if previous.focus_seconds
            else None,
            series=series,
        )

    def monthly(self, user_id: int, months: int = 6) -> MonthlyOut:
        tz_name, zone = self._tz(user_id)
        today = local_today(tz_name)
        year, month = today.year, today.month
        keys: list[str] = []
        for _ in range(months):
            keys.append(f"{year:04d}-{month:02d}")
            month -= 1
            if month == 0:
                year, month = year - 1, 12
        keys.reverse()
        first_day = date(int(keys[0][:4]), int(keys[0][5:]), 1)
        rows = {r.month: r for r in self.repo.monthly_series(user_id, tz_name, self._local_midnight_utc(first_day, zone))}
        return MonthlyOut(
            months=months,
            series=[
                MonthlyPoint(
                    month=k,
                    focus_seconds=int(rows[k].focus_seconds) if k in rows else 0,
                    pomodoros=rows[k].pomodoros if k in rows else 0,
                    active_days=rows[k].active_days if k in rows else 0,
                )
                for k in keys
            ],
        )

    def focus_hours(self, user_id: int, days: int | None = 30) -> FocusHoursOut:
        tz_name, zone = self._tz(user_id)
        start = (
            self._local_midnight_utc(local_today(tz_name) - timedelta(days=days - 1), zone) if days else None
        )
        rows = self.repo.focus_by_hour(user_id, tz_name, start)
        by_hour = {int(r.hour): r for r in rows}
        return FocusHoursOut(
            days=days or 0,
            best_hour=self._best_hour(rows),
            series=[
                HourPoint(
                    hour=h,
                    focus_seconds=int(by_hour[h].focus_seconds) if h in by_hour else 0,
                    pomodoros=by_hour[h].pomodoros if h in by_hour else 0,
                )
                for h in range(24)
            ],
        )

    def distractions(self, user_id: int, days: int = 30) -> DistractionsAnalyticsOut:
        tz_name, zone = self._tz(user_id)
        end_day = local_today(tz_name)
        start_day = end_day - timedelta(days=days - 1)
        start = self._local_midnight_utc(start_day, zone)
        end = self._local_midnight_utc(end_day + timedelta(days=1), zone)
        total = self.repo.distraction_total(user_id, start)
        focus = self.repo.focus_totals(user_id, start, end)
        by_hour = {int(r.hour): r.count for r in self.repo.distractions_by_hour(user_id, tz_name, start)}
        daily = self.repo.daily_series(user_id, tz_name, start_day, end_day, start, end)
        return DistractionsAnalyticsOut(
            days=days,
            total=total,
            per_focus_hour=round(total / (focus.focus_seconds / 3600), 2) if focus.focus_seconds >= 60 else None,
            sessions_with_distractions=self.repo.sessions_with_distractions(user_id, start),
            by_category=[
                DistractionCategoryCount(category_id=r.category_id, name=r.name, color=r.color, count=r.count)
                for r in self.repo.distractions_by_category(user_id, start)
            ],
            by_day=[
                DailyPoint(
                    date=r.date,
                    focus_seconds=int(r.focus_seconds),
                    pomodoros=r.pomodoros,
                    interrupted=r.interrupted,
                    distractions=r.distractions,
                )
                for r in daily
            ],
            by_hour=[HourPoint(hour=h, focus_seconds=0, pomodoros=by_hour.get(h, 0)) for h in range(24)],
        )

    def tasks(self, user_id: int) -> TasksAnalyticsOut:
        tz_name, zone = self._tz(user_id)
        counts = self.repo.task_counts(user_id)
        accuracy = self.repo.estimate_accuracy(user_id)
        today = local_today(tz_name)
        return TasksAnalyticsOut(
            total=counts.total,
            completed=counts.completed,
            in_progress=counts.in_progress,
            todo=counts.todo,
            completion_rate=round(counts.completed * 100 / counts.total, 1) if counts.total else 0.0,
            estimated_pomodoros_completed_tasks=int(accuracy.estimated),
            actual_pomodoros_completed_tasks=int(accuracy.actual),
            estimate_accuracy=round(int(accuracy.actual) * 100 / int(accuracy.estimated), 1)
            if accuracy.estimated
            else None,
            by_priority=[TaskBucket(key=r.key, total=r.total, completed=r.completed) for r in self.repo.task_buckets(user_id, "priority")],
            by_category=[TaskBucket(key=r.key, total=r.total, completed=r.completed) for r in self.repo.task_buckets(user_id, "category")],
            completed_last_7_days=self.repo.tasks_completed_between(
                user_id,
                self._local_midnight_utc(today - timedelta(days=6), zone),
                self._local_midnight_utc(today + timedelta(days=1), zone),
            ),
        )

    # -------------------------------------------------------------- insights
    def insights(self, user_id: int) -> InsightsOut:
        """Deterministic, rule-based productivity insights (no external AI service)."""
        summary = self.summary(user_id)
        weekly = self.weekly(user_id, 7)
        distractions = self.distractions(user_id, 30)
        hours = self.focus_hours(user_id, 30)
        out: list[InsightOut] = []

        if summary.total_sessions == 0:
            out.append(InsightOut(
                kind="getting_started", tone="suggestion", title="Start your first session",
                message="Complete a focus session to start building your productivity insights.",
            ))
            return InsightsOut(insights=out)

        if hours.best_hour is not None:
            out.append(InsightOut(
                kind="best_hour", tone="positive", title="Peak focus time",
                message=f"Your most productive hour is {format_hour(hours.best_hour)}. "
                        "Schedule demanding work around this time.",
            ))
        out.append(InsightOut(
            kind="weekly_pomodoros", tone="positive" if weekly.total_pomodoros else "neutral",
            title="This week",
            message=f"You completed {weekly.total_pomodoros} Pomodoro{'s' if weekly.total_pomodoros != 1 else ''} "
                    f"in the last 7 days.",
        ))
        if weekly.change_percent is not None:
            direction = "up" if weekly.change_percent >= 0 else "down"
            out.append(InsightOut(
                kind="weekly_trend", tone="positive" if direction == "up" else "suggestion", title="Weekly trend",
                message=f"Your focus time is {direction} {abs(weekly.change_percent):.0f}% compared with the previous 7 days.",
            ))
        if distractions.by_category:
            top = distractions.by_category[0]
            out.append(InsightOut(
                kind="top_distraction", tone="suggestion", title="Most common distraction",
                message=f"Your most frequently recorded distraction is {top.name.lower()} "
                        f"({top.count} time{'s' if top.count != 1 else ''} in the last 30 days).",
            ))
        if summary.average_productivity_rating is not None:
            out.append(InsightOut(
                kind="rating", tone="positive" if summary.average_productivity_rating >= 3.5 else "suggestion",
                title="Session quality",
                message=f"Your average productivity rating is {summary.average_productivity_rating:.1f}/5.",
            ))
        if summary.current_streak_days >= 2:
            out.append(InsightOut(
                kind="streak", tone="positive", title="On a roll",
                message=f"You're on a {summary.current_streak_days}-day focus streak. Keep it going!",
            ))
        if summary.total_sessions >= 5 and summary.interrupted_sessions / summary.total_sessions > 0.3:
            pct = round(summary.interrupted_sessions * 100 / summary.total_sessions)
            out.append(InsightOut(
                kind="interruptions", tone="suggestion", title="Frequent interruptions",
                message=f"{pct}% of your focus sessions were interrupted. Try shorter focus blocks or "
                        "silencing notifications.",
            ))
        if summary.today_pomodoros >= summary.daily_goal_pomodoros:
            out.append(InsightOut(
                kind="goal", tone="positive", title="Daily goal reached",
                message=f"You hit your goal of {summary.daily_goal_pomodoros} Pomodoros today.",
            ))
        return InsightsOut(insights=out)
