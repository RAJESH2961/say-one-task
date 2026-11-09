from contextvars import ContextVar

request_id_ctx: ContextVar[str | None] = ContextVar("request_id", default=None)
user_id_ctx: ContextVar[int | None] = ContextVar("user_id", default=None)


def get_request_id() -> str | None:
    return request_id_ctx.get()
