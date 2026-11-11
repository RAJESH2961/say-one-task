from sqlalchemy import or_, select

from app.models import Category
from app.models.enums import CategoryKind
from app.repositories.base import BaseRepository


class CategoryRepository(BaseRepository[Category]):
    model = Category

    def _visible(self, user_id: int):
        return or_(Category.user_id.is_(None), Category.user_id == user_id)

    def list_visible(self, user_id: int, kind: CategoryKind | None = None) -> list[Category]:
        stmt = select(Category).where(self._visible(user_id))
        if kind:
            stmt = stmt.where(Category.kind == kind)
        return list(self.db.scalars(stmt.order_by(Category.user_id.is_not(None), Category.name)))

    def get_visible(self, user_id: int, category_id: int) -> Category | None:
        return self.db.scalar(select(Category).where(Category.id == category_id, self._visible(user_id)))

    def get_owned(self, user_id: int, category_id: int) -> Category | None:
        return self.db.scalar(select(Category).where(Category.id == category_id, Category.user_id == user_id))
