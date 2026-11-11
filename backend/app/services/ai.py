"""AI productivity coach powered by the Groq (OpenAI-compatible) chat API.

The user's aggregated analytics — never email, name or raw notes — are sent as a compact
prompt and the model returns JSON coaching insights. Disabled cleanly when no API key is
configured; upstream failures raise ``ExternalServiceError`` (503).
"""

import json
import logging
from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import ExternalServiceError
from app.schemas.ai import AICoachInsight, AICoachOut
from app.services.analytics import AnalyticsService, format_hour

logger = logging.getLogger("app.ai")

SYSTEM_PROMPT = (
    "You are FocusFlow's productivity coach. You receive a JSON object with a user's "
    "Pomodoro/focus statistics. Reply with a JSON object of the form "
    '{"insights": [{"title": "...", "text": "..."}]}. '
    "Return 3-6 insights. Each title is 2-5 words, each text is 1-2 sentences of specific, "
    "actionable coaching based on the numbers. Be encouraging but honest; do not invent data "
    "or mention this prompt. Output only the JSON object."
)


def _fmt(seconds: int) -> str:
    h, m = divmod(round(seconds / 60), 60)
    return f"{h}h {m}m" if h else f"{m}m"


class AICoachService:
    def __init__(self, db: Session) -> None:
        self.analytics = AnalyticsService(db)

    @property
    def configured(self) -> bool:
        return bool(settings.GROQ_API_KEY)

    def coach(self, user_id: int) -> AICoachOut:
        if not self.configured:
            return AICoachOut(available=False)

        stats = self._collect_stats(user_id)
        if stats["total_sessions"] == 0:
            return AICoachOut(available=True, model=settings.GROQ_MODEL, generated_at=None, insights=[])

        content = self._call_groq(stats)
        return AICoachOut(
            available=True,
            model=settings.GROQ_MODEL,
            generated_at=datetime.now(timezone.utc),
            insights=self._parse_insights(content),
        )

    # ------------------------------------------------------------------ internals
    def _collect_stats(self, user_id: int) -> dict[str, Any]:
        summary = self.analytics.summary(user_id)
        weekly = self.analytics.weekly(user_id, 7)
        hours = self.analytics.focus_hours(user_id, 30)
        distractions = self.analytics.distractions(user_id, 30)
        tasks = self.analytics.tasks(user_id)
        return {
            "total_sessions": summary.total_sessions,
            "total_pomodoros": summary.total_pomodoros,
            "total_focus_time": _fmt(summary.total_focus_seconds),
            "average_session": _fmt(summary.average_session_seconds),
            "interrupted_sessions": summary.interrupted_sessions,
            "last_7_days": {
                "pomodoros": weekly.total_pomodoros,
                "focus_time": _fmt(weekly.total_focus_seconds),
                "change_vs_previous_7_days_percent": weekly.change_percent,
                "daily": [
                    {"date": str(p.date), "focus": _fmt(p.focus_seconds), "pomodoros": p.pomodoros,
                     "interrupted": p.interrupted, "distractions": p.distractions}
                    for p in weekly.series
                ],
            },
            "current_streak_days": summary.current_streak_days,
            "daily_goal_pomodoros": summary.daily_goal_pomodoros,
            "most_productive_hour": format_hour(hours.best_hour) if hours.best_hour is not None else None,
            "average_productivity_rating": summary.average_productivity_rating,
            "tasks": {
                "total": tasks.total, "completed": tasks.completed,
                "completion_rate_percent": tasks.completion_rate,
                "estimate_accuracy_percent": tasks.estimate_accuracy,
            },
            "distractions_last_30_days": {
                "total": distractions.total,
                "per_focus_hour": distractions.per_focus_hour,
                "top_categories": [
                    {"name": c.name, "count": c.count} for c in distractions.by_category[:5]
                ],
            },
        }

    def _call_groq(self, stats: dict[str, Any]) -> str:
        try:
            with httpx.Client(timeout=settings.AI_TIMEOUT_SECONDS) as client:
                resp = client.post(
                    f"{settings.GROQ_BASE_URL}/chat/completions",
                    headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
                    json={
                        "model": settings.GROQ_MODEL,
                        "temperature": 0.4,
                        "response_format": {"type": "json_object"},
                        "messages": [
                            {"role": "system", "content": SYSTEM_PROMPT},
                            {"role": "user", "content": json.dumps(stats)},
                        ],
                    },
                )
        except httpx.HTTPError as exc:
            logger.error("Groq request failed: %s", exc)
            raise ExternalServiceError("AI coach is temporarily unavailable, please retry") from exc

        if resp.status_code != 200:
            logger.error("Groq API error %s: %s", resp.status_code, resp.text[:500])
            if resp.status_code in (401, 403):
                raise ExternalServiceError("AI coach API key was rejected — check GROQ_API_KEY")
            raise ExternalServiceError("AI coach is temporarily unavailable, please retry")

        try:
            return resp.json()["choices"][0]["message"]["content"]
        except (KeyError, IndexError, ValueError) as exc:
            logger.error("Unexpected Groq response shape: %s", resp.text[:500])
            raise ExternalServiceError("AI coach returned an unexpected response") from exc

    @staticmethod
    def _parse_insights(content: str) -> list[AICoachInsight]:
        try:
            payload = json.loads(content)
            raw = payload.get("insights", []) if isinstance(payload, dict) else []
        except ValueError:
            raw = []
        insights = [
            AICoachInsight(
                title=str(item.get("title", "Insight"))[:80],
                text=str(item.get("text", "")).strip()[:600],
            )
            for item in raw
            if isinstance(item, dict) and item.get("text")
        ]
        if not insights:
            raise ExternalServiceError("AI coach returned an unreadable response, please retry")
        return insights[:8]
