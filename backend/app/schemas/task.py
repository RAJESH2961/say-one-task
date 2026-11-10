from datetime import date, datetime
from enum import StrEnum

from pydantic import BaseModel, Field, computed_field, field_validator

from app.models.enums import TaskPriority, TaskStatus
from app.schemas.category import CategoryOut
from app.schemas.common import ORMModel


def _clean_title(v: str) -> str:
    v = v.strip()
    if not v:
        raise ValueError("Title must not be blank")
    return v


def _clean_description(v: str | None) -> str | None:
    if v is None:
        return None
    v = v.strip()
    return v or None


class TaskBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    priority: TaskPriority = TaskPriority.MEDIUM
    estimated_pomodoros: int = Field(default=1, ge=1, le=100)
    category_id: int | None = Field(default=None, gt=0)
    start_date: date | None = None

    _title = field_validator("title")(_clean_title)
    _description = field_validator("description")(_clean_description)


class TaskCreate(TaskBase):
    status: TaskStatus = TaskStatus.TODO


class TaskUpdate(BaseModel):
    """Partial update - only supplied fields are changed."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    priority: TaskPriority | None = None
    status: TaskStatus | None = None
    estimated_pomodoros: int | None = Field(default=None, ge=1, le=100)
    category_id: int | None = Field(default=None, gt=0)
    start_date: date | None = None

    @field_validator("title")
    @classmethod
    def _title(cls, v: str | None) -> str | None:
        return None if v is None else _clean_title(v)

    _description = field_validator("description")(_clean_description)

    @field_validator("title", "priority", "status", "estimated_pomodoros")
    @classmethod
    def _not_null(cls, v: object) -> object:
        if v is None:
            raise ValueError("Field cannot be null")
        return v


class TaskStatusUpdate(BaseModel):
    status: TaskStatus


class TaskOut(ORMModel):
    id: int
    title: str
    description: str | None
    priority: TaskPriority
    status: TaskStatus
    estimated_pomodoros: int
    completed_pomodoros: int
    focus_seconds: int
    category_id: int | None
    category: CategoryOut | None
    start_date: date | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def progress_percent(self) -> int:
        return min(100, round(self.completed_pomodoros * 100 / self.estimated_pomodoros)) if self.estimated_pomodoros else 0


class TaskBrief(ORMModel):
    id: int
    title: str
    status: TaskStatus
    priority: TaskPriority


class TaskSortField(StrEnum):
    CREATED_AT = "created_at"
    UPDATED_AT = "updated_at"
    PRIORITY = "priority"
    START_DATE = "start_date"
    TITLE = "title"
    STATUS = "status"
    ESTIMATED_POMODOROS = "estimated_pomodoros"


class SortOrder(StrEnum):
    ASC = "asc"
    DESC = "desc"
