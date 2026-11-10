from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    limit: int
    offset: int


class MessageResponse(BaseModel):
    message: str


class ErrorBody(BaseModel):
    code: str
    message: str
    request_id: str | None = None
    details: object | None = None


class ErrorResponse(BaseModel):
    error: ErrorBody


ERROR_RESPONSES: dict[int | str, dict] = {
    401: {"model": ErrorResponse, "description": "Not authenticated"},
    404: {"model": ErrorResponse, "description": "Resource not found"},
    409: {"model": ErrorResponse, "description": "Conflict / invalid state transition"},
    422: {"model": ErrorResponse, "description": "Validation error"},
}
