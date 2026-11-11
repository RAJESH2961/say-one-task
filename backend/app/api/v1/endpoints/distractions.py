from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.api.deps import CurrentUser, DbSession
from app.repositories.distraction import DistractionFilters
from app.schemas.common import ERROR_RESPONSES, Page
from app.schemas.distraction import DistractionCreate, DistractionOut
from app.services.distraction import DistractionService
from app.utils.time import ensure_utc

router = APIRouter(prefix="/distractions", tags=["distractions"], responses=ERROR_RESPONSES)


@router.post("", response_model=DistractionOut, status_code=status.HTTP_201_CREATED)
def create_distraction(data: DistractionCreate, user: CurrentUser, db: DbSession) -> DistractionOut:
    return DistractionOut.model_validate(DistractionService(db).create(user.id, data))


@router.get("", response_model=Page[DistractionOut])
def list_distractions(
    user: CurrentUser,
    db: DbSession,
    category_id: Annotated[int | None, Query(gt=0)] = None,
    session_id: Annotated[int | None, Query(gt=0)] = None,
    search: Annotated[str | None, Query(max_length=100)] = None,
    occurred_from: datetime | None = None,
    occurred_to: datetime | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Page[DistractionOut]:
    filters = DistractionFilters(
        category_id=category_id,
        session_id=session_id,
        search=search or None,
        occurred_from=ensure_utc(occurred_from) if occurred_from else None,
        occurred_to=ensure_utc(occurred_to) if occurred_to else None,
        limit=limit,
        offset=offset,
    )
    items, total = DistractionService(db).list(user.id, filters)
    return Page(items=[DistractionOut.model_validate(d) for d in items], total=total, limit=limit, offset=offset)


@router.delete("/{distraction_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_distraction(distraction_id: int, user: CurrentUser, db: DbSession) -> Response:
    DistractionService(db).delete(user.id, distraction_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
