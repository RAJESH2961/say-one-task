from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import BusinessValidationError, ConflictError, NotFoundError
from app.core.logging import get_logger
from app.db.transaction import transaction
from app.models import Category
from app.models.enums import CategoryKind
from app.repositories.category import CategoryRepository
from app.schemas.category import CategoryCreate

logger = get_logger("services.category")


class CategoryService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = CategoryRepository(db)

    def list(self, user_id: int, kind: CategoryKind | None = None) -> list[Category]:
        return self.repo.list_visible(user_id, kind)

    def resolve(self, user_id: int, category_id: int | None, kind: CategoryKind) -> Category | None:
        """Validate that a referenced category exists, is visible to the user and has the right kind."""
        if category_id is None:
            return None
        category = self.repo.get_visible(user_id, category_id)
        if category is None:
            raise BusinessValidationError("Category not found", code="invalid_category")
        if category.kind != kind:
            raise BusinessValidationError(f"Category must be a {kind.value} category", code="invalid_category")
        return category

    def create(self, user_id: int, data: CategoryCreate) -> Category:
        try:
            with transaction(self.db, "category.create"):
                category = self.repo.add(Category(user_id=user_id, kind=data.kind, name=data.name, color=data.color))
        except IntegrityError as exc:
            raise ConflictError("A category with this name already exists", code="category_exists") from exc
        logger.info("Category created", extra={"event": "category.created", "category_id": category.id})
        return category

    def delete(self, user_id: int, category_id: int) -> None:
        category = self.repo.get_owned(user_id, category_id)
        if category is None:
            raise NotFoundError("Category not found (built-in categories cannot be deleted)")
        with transaction(self.db, "category.delete"):
            self.repo.delete(category)
        logger.info("Category deleted", extra={"event": "category.deleted", "category_id": category_id})
