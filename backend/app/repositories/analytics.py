"""Read-only aggregate queries for analytics. All bucketing happens in the user's timezone."""

from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

FOCUS_FINISHED = "session_type = 'focus' AND status IN ('completed', 'interrupted')"


@dataclass
class FocusTotals:
    pomodoros: int
    focus_seconds: int
    sessions: int
    interrupted: int
    average_seconds: int
    average_rating: float | None


class AnalyticsRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def _rows(self, sql: str, **params: Any) -> list[Any]:
        return list(self.db.execute(text(sql), params).all())

    def focus_totals(self, user_id: int, start: datetime | None = None, end: datetime | None = None) -> FocusTotals:
        row = self.db.execute(
            text(
                f"""
                SELECT count(*) FILTER (WHERE status = 'completed')            AS pomodoros,
                       coalesce(sum(actual_duration_seconds), 0)               AS focus_seconds,
                       count(*)                                                AS sessions,
                       count(*) FILTER (WHERE status = 'interrupted')          AS interrupted,
                       coalesce(avg(actual_duration_seconds), 0)               AS average_seconds,
                       avg(productivity_rating)                                AS average_rating
                FROM focus_sessions
                WHERE user_id = :uid AND {FOCUS_FINISHED}
                  AND (CAST(:start AS timestamptz) IS NULL OR started_at >= :start)
                  AND (CAST(:end AS timestamptz) IS NULL OR started_at < :end)
                """
            ),
            {"uid": user_id, "start": start, "end": end},
        ).one()
        return FocusTotals(
            pomodoros=row.pomodoros,
            focus_seconds=int(row.focus_seconds),
            sessions=row.sessions,
            interrupted=row.interrupted,
            average_seconds=int(round(float(row.average_seconds))),
            average_rating=round(float(row.average_rating), 2) if row.average_rating is not None else None,
        )

    def daily_series(self, user_id: int, tz: str, start_day: date, end_day: date, start: datetime, end: datetime) -> list[Any]:
        return self._rows(
            f"""
            WITH days AS (
                SELECT generate_series(CAST(:start_day AS date), CAST(:end_day AS date), interval '1 day')::date AS d
            ),
            focus AS (
                SELECT (started_at AT TIME ZONE :tz)::date AS d,
                       sum(actual_duration_seconds)                   AS focus_seconds,
                       count(*) FILTER (WHERE status = 'completed')   AS pomodoros,
                       count(*) FILTER (WHERE status = 'interrupted') AS interrupted
                FROM focus_sessions
                WHERE user_id = :uid AND {FOCUS_FINISHED} AND started_at >= :start AND started_at < :end
                GROUP BY 1
            ),
            dist AS (
                SELECT (occurred_at AT TIME ZONE :tz)::date AS d, count(*) AS distractions
                FROM distractions
                WHERE user_id = :uid AND occurred_at >= :start AND occurred_at < :end
                GROUP BY 1
            )
            SELECT days.d AS date,
                   coalesce(focus.focus_seconds, 0) AS focus_seconds,
                   coalesce(focus.pomodoros, 0)     AS pomodoros,
                   coalesce(focus.interrupted, 0)   AS interrupted,
                   coalesce(dist.distractions, 0)   AS distractions
            FROM days
            LEFT JOIN focus ON focus.d = days.d
            LEFT JOIN dist ON dist.d = days.d
            ORDER BY days.d
            """,
            uid=user_id, tz=tz, start_day=start_day, end_day=end_day, start=start, end=end,
        )

    def monthly_series(self, user_id: int, tz: str, start: datetime) -> list[Any]:
        return self._rows(
            f"""
            SELECT to_char(started_at AT TIME ZONE :tz, 'YYYY-MM')               AS month,
                   coalesce(sum(actual_duration_seconds), 0)                      AS focus_seconds,
                   count(*) FILTER (WHERE status = 'completed')                   AS pomodoros,
                   count(DISTINCT (started_at AT TIME ZONE :tz)::date)            AS active_days
            FROM focus_sessions
            WHERE user_id = :uid AND {FOCUS_FINISHED} AND started_at >= :start
            GROUP BY 1
            ORDER BY 1
            """,
            uid=user_id, tz=tz, start=start,
        )

    def focus_by_hour(self, user_id: int, tz: str, start: datetime | None) -> list[Any]:
        return self._rows(
            f"""
            SELECT extract(hour FROM started_at AT TIME ZONE :tz)::int AS hour,
                   coalesce(sum(actual_duration_seconds), 0)          AS focus_seconds,
                   count(*) FILTER (WHERE status = 'completed')       AS pomodoros
            FROM focus_sessions
            WHERE user_id = :uid AND {FOCUS_FINISHED}
              AND (CAST(:start AS timestamptz) IS NULL OR started_at >= :start)
            GROUP BY 1
            """,
            uid=user_id, tz=tz, start=start,
        )

    def focus_days(self, user_id: int, tz: str) -> list[date]:
        """Distinct local dates with at least one completed focus session (newest first)."""
        rows = self._rows(
            """
            SELECT DISTINCT (started_at AT TIME ZONE :tz)::date AS d
            FROM focus_sessions
            WHERE user_id = :uid AND session_type = 'focus' AND status = 'completed'
            ORDER BY d DESC
            """,
            uid=user_id, tz=tz,
        )
        return [r.d for r in rows]

    def distraction_total(self, user_id: int, start: datetime | None = None) -> int:
        return self.db.execute(
            text(
                "SELECT count(*) FROM distractions WHERE user_id = :uid "
                "AND (CAST(:start AS timestamptz) IS NULL OR occurred_at >= :start)"
            ),
            {"uid": user_id, "start": start},
        ).scalar_one()

    def distractions_by_category(self, user_id: int, start: datetime | None) -> list[Any]:
        return self._rows(
            """
            SELECT d.category_id, coalesce(c.name, 'Uncategorized') AS name,
                   coalesce(c.color, '#94a3b8') AS color, count(*) AS count
            FROM distractions d
            LEFT JOIN categories c ON c.id = d.category_id
            WHERE d.user_id = :uid AND (CAST(:start AS timestamptz) IS NULL OR d.occurred_at >= :start)
            GROUP BY d.category_id, c.name, c.color
            ORDER BY count DESC, name
            """,
            uid=user_id, start=start,
        )

    def distractions_by_hour(self, user_id: int, tz: str, start: datetime | None) -> list[Any]:
        return self._rows(
            """
            SELECT extract(hour FROM occurred_at AT TIME ZONE :tz)::int AS hour, count(*) AS count
            FROM distractions
            WHERE user_id = :uid AND (CAST(:start AS timestamptz) IS NULL OR occurred_at >= :start)
            GROUP BY 1
            """,
            uid=user_id, tz=tz, start=start,
        )

    def sessions_with_distractions(self, user_id: int, start: datetime | None) -> int:
        return self.db.execute(
            text(
                "SELECT count(DISTINCT session_id) FROM distractions WHERE user_id = :uid AND session_id IS NOT NULL "
                "AND (CAST(:start AS timestamptz) IS NULL OR occurred_at >= :start)"
            ),
            {"uid": user_id, "start": start},
        ).scalar_one()

    def task_counts(self, user_id: int) -> Any:
        return self.db.execute(
            text(
                """
                SELECT count(*)                                           AS total,
                       count(*) FILTER (WHERE status = 'completed')       AS completed,
                       count(*) FILTER (WHERE status = 'in_progress')     AS in_progress,
                       count(*) FILTER (WHERE status = 'todo')            AS todo
                FROM tasks WHERE user_id = :uid
                """
            ),
            {"uid": user_id},
        ).one()

    def tasks_completed_between(self, user_id: int, start: datetime, end: datetime) -> int:
        return self.db.execute(
            text(
                "SELECT count(*) FROM tasks WHERE user_id = :uid AND status = 'completed' "
                "AND completed_at >= :start AND completed_at < :end"
            ),
            {"uid": user_id, "start": start, "end": end},
        ).scalar_one()

    def task_buckets(self, user_id: int, dimension: str) -> list[Any]:
        if dimension == "priority":
            sql = """
                SELECT priority AS key, count(*) AS total, count(*) FILTER (WHERE status = 'completed') AS completed
                FROM tasks WHERE user_id = :uid GROUP BY priority
                ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
            """
        else:
            sql = """
                SELECT coalesce(c.name, 'Uncategorized') AS key, count(*) AS total,
                       count(*) FILTER (WHERE t.status = 'completed') AS completed
                FROM tasks t LEFT JOIN categories c ON c.id = t.category_id
                WHERE t.user_id = :uid GROUP BY 1 ORDER BY total DESC, key
            """
        return self._rows(sql, uid=user_id)

    def estimate_accuracy(self, user_id: int) -> Any:
        return self.db.execute(
            text(
                """
                SELECT coalesce(sum(t.estimated_pomodoros), 0) AS estimated,
                       coalesce(sum(p.done), 0)               AS actual
                FROM tasks t
                LEFT JOIN (
                    SELECT task_id, count(*) AS done FROM focus_sessions
                    WHERE user_id = :uid AND session_type = 'focus' AND status = 'completed' AND task_id IS NOT NULL
                    GROUP BY task_id
                ) p ON p.task_id = t.id
                WHERE t.user_id = :uid AND t.status = 'completed'
                """
            ),
            {"uid": user_id},
        ).one()
