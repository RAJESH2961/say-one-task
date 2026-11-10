from dataclasses import dataclass, field
from datetime import date

from sqlalchemy import case, func, or_, select

from app.models import Task
from app.models.enums import TaskPriority, TaskStatus
from app.repositories.base import BaseRepository
from app.schemas.task import SortOrder, TaskSortField


@dataclass
class TaskFilters:
    search: str | None = None
    statuses: list[TaskStatus] = field(default_factory=list)
    priorities: list[TaskPriority] = field(default_factory=list)
    category_id: int | None = None
    start_date_from: date | None = None
    start_date_to: date | None = None
    sort_by: TaskSortField = TaskSortField.CREATED_AT
    order: SortOrder = SortOrder.DESC
    limit: int = 100
    offset: int = 0


_PRIORITY_RANK = case(
    (Task.priority == TaskPriority.HIGH, 3), (Task.priority == TaskPriority.MEDIUM, 2), else_=1
)
_STATUS_RANK = case(
    (Task.status == TaskStatus.TODO, 1), (Task.status == TaskStatus.IN_PROGRESS, 2), else_=3
)
_SORT_COLUMNS = {
    TaskSortField.CREATED_AT: Task.created_at,
    TaskSortField.UPDATED_AT: Task.updated_at,
    TaskSortField.PRIORITY: _PRIORITY_RANK,
    TaskSortField.START_DATE: Task.start_date,
    TaskSortField.TITLE: func.lower(Task.title),
    TaskSortField.STATUS: _STATUS_RANK,
    TaskSortField.ESTIMATED_POMODOROS: Task.estimated_pomodoros,
}


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class TaskRepository(BaseRepository[Task]):
    model = Task

    def get_for_user(self, user_id: int, task_id: int, *, for_update: bool = False) -> Task | None:
        stmt = select(Task).where(Task.id == task_id, Task.user_id == user_id)
        if for_update:
            stmt = stmt.with_for_update(of=Task)
        return self.db.scalar(stmt)

    def list(self, user_id: int, f: TaskFilters) -> tuple[list[Task], int]:
        stmt = select(Task).where(Task.user_id == user_id)
        if f.search:
            term = f"%{_escape_like(f.search.strip())}%"
            stmt = stmt.where(or_(Task.title.ilike(term, escape="\\"), Task.description.ilike(term, escape="\\")))
        if f.statuses:
            stmt = stmt.where(Task.status.in_(f.statuses))
        if f.priorities:
            stmt = stmt.where(Task.priority.in_(f.priorities))
        if f.category_id:
            stmt = stmt.where(Task.category_id == f.category_id)
        if f.start_date_from:
            stmt = stmt.where(Task.start_date >= f.start_date_from)
        if f.start_date_to:
            stmt = stmt.where(Task.start_date <= f.start_date_to)

        total = self.db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
        col = _SORT_COLUMNS[f.sort_by]
        ordering = col.asc().nulls_last() if f.order == SortOrder.ASC else col.desc().nulls_last()
        items = self.db.scalars(stmt.order_by(ordering, Task.id.desc()).limit(f.limit).offset(f.offset)).unique()
        return list(items), total
