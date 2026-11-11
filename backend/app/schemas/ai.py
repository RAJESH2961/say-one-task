from datetime import datetime

from pydantic import BaseModel


class AICoachInsight(BaseModel):
    title: str
    text: str


class AICoachOut(BaseModel):
    available: bool
    model: str | None = None
    generated_at: datetime | None = None
    insights: list[AICoachInsight] = []
