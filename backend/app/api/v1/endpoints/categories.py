from fastapi import APIRouter, Response, status

from app.api.deps import CurrentUser, DbSession
from app.models.enums import CategoryKind
from app.schemas.category import CategoryCreate, CategoryOut
from app.schemas.common import ERROR_RESPONSES
from app.services.category import CategoryService

router = APIRouter(prefix="/categories", tags=["categories"], responses=ERROR_RESPONSES)


@router.get("", response_model=list[CategoryOut])
def list_categories(user: CurrentUser, db: DbSession, kind: CategoryKind | None = None) -> list[CategoryOut]:
    return [CategoryOut.model_validate(c) for c in CategoryService(db).list(user.id, kind)]


@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(data: CategoryCreate, user: CurrentUser, db: DbSession) -> CategoryOut:
    return CategoryOut.model_validate(CategoryService(db).create(user.id, data))


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_category(category_id: int, user: CurrentUser, db: DbSession) -> Response:
    CategoryService(db).delete(user.id, category_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
