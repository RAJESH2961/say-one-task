from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.schemas.common import ERROR_RESPONSES
from app.schemas.settings import SettingsOut, SettingsUpdate
from app.services.settings import SettingsService

router = APIRouter(prefix="/settings", tags=["settings"], responses=ERROR_RESPONSES)


@router.get("", response_model=SettingsOut)
def get_settings(user: CurrentUser, db: DbSession) -> SettingsOut:
    return SettingsOut.model_validate(SettingsService(db).get(user.id))


@router.put("", response_model=SettingsOut)
def update_settings(data: SettingsUpdate, user: CurrentUser, db: DbSession) -> SettingsOut:
    """Partial update: only fields present in the body are changed."""
    return SettingsOut.model_validate(SettingsService(db).update(user.id, data))
