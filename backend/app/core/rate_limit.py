from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings

# NOTE: behind a reverse proxy run uvicorn with `--proxy-headers --forwarded-allow-ips=<proxy ip>`
# so that the client address (not the proxy's) is used as the rate-limit key.
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[settings.RATE_LIMIT_DEFAULT],
    storage_uri=settings.RATE_LIMIT_STORAGE_URI,
    enabled=settings.RATE_LIMIT_ENABLED,
    headers_enabled=False,
)
