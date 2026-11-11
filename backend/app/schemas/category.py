from pydantic import BaseModel, Field, field_validator

from app.models.enums import CategoryKind
from app.schemas.common import ORMModel


class CategoryOut(ORMModel):
    id: int
    kind: CategoryKind
    name: str
    color: str
    is_system: bool


class CategoryCreate(BaseModel):
    kind: CategoryKind
    name: str = Field(min_length=1, max_length=50)
    color: str = Field(default="#2563eb", pattern=r"^#[0-9a-fA-F]{6}$")

    @field_validator("name")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name must not be blank")
        return v
