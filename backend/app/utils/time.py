from datetime import date, datetime, timezone, tzinfo
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError, available_timezones


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def ensure_utc(value: datetime) -> datetime:
    """Treat naive datetimes as UTC and convert aware ones to UTC."""
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def is_valid_timezone(name: str) -> bool:
    if name in ("UTC", "Etc/UTC"):
        return True
    try:
        ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        return False
    return name in available_timezones()


def get_zone(name: str) -> tzinfo:
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        return timezone.utc


def local_today(tz_name: str) -> date:
    return utcnow().astimezone(get_zone(tz_name)).date()
