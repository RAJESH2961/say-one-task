from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.api.deps import CurrentUser, DbSession
from app.models.enums import TaskPriority, TaskStatus
from app.repositories.task import TaskFilters
from app.schemas.common import ERROR_RESPONSES, Page
from app.schemas.task import SortOrder, TaskCreate, TaskOut, TaskSortField, TaskStatusUpdate, TaskUpdate
from app.services.task import TaskService

router = APIRouter(prefix="/tasks", tags=["tasks"], responses=ERROR_RESPONSES)


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(data: TaskCreate, user: CurrentUser, db: DbSession) -> TaskOut:
    return TaskOut.model_validate(TaskService(db).create(user.id, data))


@router.get("", response_model=Page[TaskOut])
def list_tasks(
    user: CurrentUser,
    db: DbSession,
    search: Annotated[str | None, Query(max_length=100)] = None,
    status_: Annotated[list[TaskStatus] | None, Query(alias="status")] = None,
    priority: Annotated[list[TaskPriority] | None, Query()] = None,
    category_id: Annotated[int | None, Query(gt=0)] = None,
    start_date_from: date | None = None,
    start_date_to: date | None = None,
    sort_by: TaskSortField = TaskSortField.CREATED_AT,
    order: SortOrder = SortOrder.DESC,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Page[TaskOut]:
    filters = TaskFilters(
        search=search or None,
        statuses=status_ or [],
        priorities=priority or [],
        category_id=category_id,
        start_date_from=start_date_from,
        start_date_to=start_date_to,
        sort_by=sort_by,
        order=order,
        limit=limit,
        offset=offset,
    )
    items, total = TaskService(db).list(user.id, filters)
    return Page(items=[TaskOut.model_validate(t) for t in items], total=total, limit=limit, offset=offset)


@router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: int, user: CurrentUser, db: DbSession) -> TaskOut:
    return TaskOut.model_validate(TaskService(db).get(user.id, task_id))


@router.put("/{task_id}", response_model=TaskOut)
def update_task(task_id: int, data: TaskUpdate, user: CurrentUser, db: DbSession) -> TaskOut:
    return TaskOut.model_validate(TaskService(db).update(user.id, task_id, data))


@router.patch("/{task_id}/status", response_model=TaskOut)
def update_task_status(task_id: int, data: TaskStatusUpdate, user: CurrentUser, db: DbSession) -> TaskOut:
    return TaskOut.model_validate(TaskService(db).set_status(user.id, task_id, data.status))


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_task(task_id: int, user: CurrentUser, db: DbSession) -> Response:
    TaskService(db).delete(user.id, task_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
