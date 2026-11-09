"""Create the database schema and seed built-in categories.

Usage (from backend/):
    python -m scripts.init_db

Idempotent: existing tables are kept and system categories are only inserted when
missing, so it is safe to run on every deploy or container start.
"""

from sqlalchemy import func, select

from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models import Category
from app.models.enums import CategoryKind

# (kind, name, color) — shared by all users (user_id IS NULL)
SYSTEM_CATEGORIES = [
    (CategoryKind.TASK, "Work", "#2563eb"),
    (CategoryKind.TASK, "Study", "#7c3aed"),
    (CategoryKind.TASK, "Personal", "#0d9488"),
    (CategoryKind.DISTRACTION, "Social Media", "#db2777"),
    (CategoryKind.DISTRACTION, "Phone / Messages", "#7c3aed"),
    (CategoryKind.DISTRACTION, "Email", "#2563eb"),
    (CategoryKind.DISTRACTION, "Colleagues / People", "#0891b2"),
    (CategoryKind.DISTRACTION, "Noise / Environment", "#64748b"),
    (CategoryKind.DISTRACTION, "Internal Thoughts", "#4f46e5"),
    (CategoryKind.DISTRACTION, "Hunger / Fatigue", "#ca8a04"),
    (CategoryKind.DISTRACTION, "Other", "#94a3b8"),
]


def main() -> None:
    Base.metadata.create_all(engine)
    print("Schema is up to date.")

    db = SessionLocal()
    try:
        inserted = 0
        for kind, name, color in SYSTEM_CATEGORIES:
            exists = db.scalar(
                select(Category.id).where(
                    Category.user_id.is_(None),
                    Category.kind == kind,
                    func.lower(Category.name) == name.lower(),
                )
            )
            if not exists:
                db.add(Category(user_id=None, kind=kind, name=name, color=color))
                inserted += 1
        db.commit()
        print(f"System categories: {inserted} inserted, {len(SYSTEM_CATEGORIES) - inserted} already present.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
