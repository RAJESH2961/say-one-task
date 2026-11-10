from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.core.logging import get_logger
from app.db.transaction import transaction
from app.models import Task
from app.models.enums import CategoryKind, TaskStatus
from app.repositories.task import TaskFilters, TaskRepository
from app.schemas.task import TaskCreate, TaskUpdate
from app.services.category import CategoryService
from app.utils.time import utcnow

logger = get_logger("services.task")


class TaskService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = TaskRepository(db)
        self.categories = CategoryService(db)

    def get(self, user_id: int, task_id: int, *, for_update: bool = False) -> Task:
        task = self.repo.get_for_user(user_id, task_id, for_update=for_update)
        if task is None:
            raise NotFoundError("Task not found", code="task_not_found")
        return task

    def list(self, user_id: int, filters: TaskFilters) -> tuple[list[Task], int]:
        return self.repo.list(user_id, filters)

    @staticmethod
    def _apply_status(task: Task, status: TaskStatus) -> None:
        if task.status == status:
            return
        task.status = status
        task.completed_at = utcnow() if status == TaskStatus.COMPLETED else None

    def create(self, user_id: int, data: TaskCreate) -> Task:
        self.categories.resolve(user_id, data.category_id, CategoryKind.TASK)
        task = Task(user_id=user_id, **data.model_dump(exclude={"status"}))
        self._apply_status(task, data.status)
        with transaction(self.db, "task.create"):
            self.repo.add(task)
        self.db.refresh(task)
        logger.info("Task created", extra={"event": "task.created", "task_id": task.id})
        return task

    def update(self, user_id: int, task_id: int, data: TaskUpdate) -> Task:
        task = self.get(user_id, task_id)
        changes = data.model_dump(exclude_unset=True)
        if "category_id" in changes:
            self.categories.resolve(user_id, changes["category_id"], CategoryKind.TASK)
        status = changes.pop("status", None)
        with transaction(self.db, "task.update"):
            for key, value in changes.items():
                setattr(task, key, value)
            if status is not None:
                self._apply_status(task, status)
        self.db.refresh(task)
        logger.info("Task updated", extra={"event": "task.updated", "task_id": task.id, "fields": sorted(data.model_fields_set)})
        return task

    def set_status(self, user_id: int, task_id: int, status: TaskStatus) -> Task:
        task = self.get(user_id, task_id)
        previous = task.status
        with transaction(self.db, "task.set_status"):
            self._apply_status(task, status)
        self.db.refresh(task)
        logger.info(
            "Task status changed",
            extra={"event": "task.status_changed", "task_id": task.id, "from": previous.value, "to": status.value},
        )
        return task

    def delete(self, user_id: int, task_id: int) -> None:
        task = self.get(user_id, task_id)
        with transaction(self.db, "task.delete"):
            self.repo.delete(task)
        logger.info("Task deleted", extra={"event": "task.deleted", "task_id": task_id})

    def mark_in_progress_if_todo(self, task: Task) -> None:
        """Called inside an open transaction when a focus session starts on a task."""
        if task.status == TaskStatus.TODO:
            self._apply_status(task, TaskStatus.IN_PROGRESS)
