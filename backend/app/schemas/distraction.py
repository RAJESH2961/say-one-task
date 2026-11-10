from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.schemas.category import CategoryOut
from app.schemas.common import ORMModel


class DistractionCreate(BaseModel):
    description: str = Field(min_length=1, max_length=500)
    category_id: int | None = Field(default=None, gt=0)
    session_id: int | None = Field(default=None, gt=0)
    occurred_at: datetime | None = Field(default=None, description="Defaults to now (UTC)")

    @field_validator("description")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Description must not be blank")
        return v


class DistractionSessionBrief(ORMModel):
    id: int
    session_type: str
    task_id: int | None
    started_at: datetime


class DistractionOut(ORMModel):
    id: int
    description: str
    category_id: int | None
    category: CategoryOut | None
    session_id: int | None
    session: DistractionSessionBrief | None
    occurred_at: datetime
    created_at: datetime
