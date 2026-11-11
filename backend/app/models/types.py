from enum import Enum

from sqlalchemy import Enum as SAEnum


def str_enum(enum_cls: type[Enum], name: str) -> SAEnum:
    """VARCHAR column + CHECK constraint storing the enum *values* (portable, migration friendly)."""
    return SAEnum(
        enum_cls,
        name=name,
        native_enum=False,
        create_constraint=True,
        length=20,
        values_callable=lambda e: [m.value for m in e],
        validate_strings=True,
    )
