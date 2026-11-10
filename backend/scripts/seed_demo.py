"""Seed a demo account with realistic history (tasks, focus sessions, distractions).

Usage (from backend/):
    python -m scripts.seed_demo                     # creates demo@focusflow.dev / Demo1234!
    python -m scripts.seed_demo --email you@x.dev --password 'Secret123' --days 45

All analytics shown in the UI are then computed from these recorded rows, exactly as they would be
for organically recorded sessions. The script refuses to run in production and only adds data for
the given account; if that account already has tasks it does nothing (no data is deleted).
"""

import argparse
import random
import sys
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import func, select

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import Category, Distraction, FocusSession, Task, User, UserSettings
from app.models.enums import CategoryKind, SessionStatus, SessionType, TaskPriority, TaskStatus

# (title, category, priority, estimated pomodoros, target state)
TASKS = [
    ("Write quarterly product report", "Work", TaskPriority.HIGH, 6, "done"),
    ("Refactor authentication module", "Work", TaskPriority.HIGH, 12, "open"),
    ("Prepare sprint planning deck", "Work", TaskPriority.MEDIUM, 3, "done"),
    ("Review pull requests", "Work", TaskPriority.MEDIUM, 4, "done"),
    ("Migrate CI pipeline to GitHub Actions", "Work", TaskPriority.HIGH, 5, "todo"),
    ("Study system design: caching", "Study", TaskPriority.MEDIUM, 10, "open"),
    ("Finish TypeScript generics course", "Study", TaskPriority.LOW, 6, "done"),
    ("Read 'Deep Work' chapter 3", "Study", TaskPriority.LOW, 2, "done"),
    ("Plan weekly meals", "Personal", TaskPriority.LOW, 1, "todo"),
    ("Update personal budget spreadsheet", "Personal", TaskPriority.MEDIUM, 2, "done"),
    ("Write blog post on focus habits", "Personal", TaskPriority.MEDIUM, 8, "open"),
]
DISTRACTIONS = {
    "Social Media": ["Scrolled Instagram", "Checked Twitter notifications", "Watched a YouTube short"],
    "Phone / Messages": ["WhatsApp group chat", "Phone call from a friend", "Slack DM"],
    "Email": ["Checked inbox", "Replied to a non-urgent email"],
    "Colleagues / People": ["Colleague asked a quick question", "Impromptu meeting"],
    "Noise / Environment": ["Construction noise outside", "Loud music nearby"],
    "Internal Thoughts": ["Started planning the weekend", "Remembered an unrelated bug"],
    "Hunger / Fatigue": ["Snack break", "Felt sleepy after lunch"],
}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--email", default="demo@focusflow.dev")
    parser.add_argument("--password", default="Demo1234!")
    parser.add_argument("--name", default="Demo User")
    parser.add_argument("--timezone", default="Asia/Kolkata")
    parser.add_argument("--days", type=int, default=35)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--reset", action="store_true", help="Delete this demo account (and only it) first")
    args = parser.parse_args()

    if settings.is_production:
        print("Refusing to seed demo data in production.", file=sys.stderr)
        return 1

    rng = random.Random(args.seed)
    tz = ZoneInfo(args.timezone)
    now = datetime.now(timezone.utc)

    with SessionLocal() as db:
        user = db.scalar(select(User).where(func.lower(User.email) == args.email.lower()))
        if user is not None and args.reset:
            db.delete(user)  # ON DELETE CASCADE removes the account's tasks/sessions/distractions
            db.flush()
            user = None
        if user is None:
            user = User(email=args.email.lower(), full_name=args.name, password_hash=hash_password(args.password))
            db.add(user)
            db.flush()
            db.add(UserSettings(user_id=user.id, timezone=args.timezone))
            db.flush()
        if db.scalar(select(func.count(Task.id)).where(Task.user_id == user.id)):
            print(f"{args.email} already has tasks - nothing to do.")
            return 0
        db.execute(
            FocusSession.__table__.update()
            .where(FocusSession.user_id == user.id, FocusSession.status.in_(["running", "paused"]))
            .values(status="interrupted", paused_at=None, ended_at=func.greatest(FocusSession.started_at, func.now()), actual_duration_seconds=0)
        )

        cats = {c.name: c for c in db.scalars(select(Category).where(Category.user_id.is_(None)))}
        today_local = now.astimezone(tz).date()
        tasks: list[Task] = []
        target: dict[int, str] = {}
        for i, (title, cat, prio, est, _state) in enumerate(TASKS):
            tasks.append(Task(
                user_id=user.id, title=title, category_id=cats[cat].id, priority=prio, estimated_pomodoros=est,
                start_date=today_local - timedelta(days=rng.randint(0, args.days // 2)) if i % 3 else today_local,
                description=None,
            ))
        db.add_all(tasks)
        db.flush()
        for t, spec in zip(tasks, TASKS):
            target[t.id] = spec[4]

        done_count = {t.id: 0 for t in tasks}
        sessions = distractions = 0
        for day_offset in range(args.days, -1, -1):
            day = today_local - timedelta(days=day_offset)
            if day_offset and rng.random() < 0.18:  # some rest days
                continue
            n = rng.randint(2, 7) if day_offset else 2
            hour = rng.choice([8, 9, 9, 10, 10, 11, 14, 15])
            cursor = datetime(day.year, day.month, day.day, hour, rng.randint(0, 40), tzinfo=tz).astimezone(timezone.utc)
            for k in range(n):
                if cursor + timedelta(minutes=25) > now:
                    break
                open_tasks = [
                    t for t in tasks
                    if target[t.id] == "done" and done_count[t.id] < t.estimated_pomodoros
                    or target[t.id] == "open" and done_count[t.id] < t.estimated_pomodoros - 2
                ]
                task = rng.choice(open_tasks) if open_tasks and rng.random() < 0.85 else None
                interrupted = rng.random() < 0.12
                actual = rng.randint(300, 1300) if interrupted else 1500
                paused = rng.choice([0, 0, 0, 45, 120])
                fs = FocusSession(
                    user_id=user.id, task_id=task.id if task else None, session_type=SessionType.FOCUS,
                    status=SessionStatus.INTERRUPTED if interrupted else SessionStatus.COMPLETED,
                    planned_duration_seconds=1500, started_at=cursor, total_paused_seconds=paused,
                    pause_count=1 if paused else 0,
                    ended_at=cursor + timedelta(seconds=actual + paused), actual_duration_seconds=actual,
                    productivity_rating=rng.choice([None, 3, 4, 4, 5, 5]) if not interrupted else rng.choice([None, 2, 3]),
                )
                db.add(fs)
                db.flush()
                sessions += 1
                if task and not interrupted:
                    done_count[task.id] += 1
                if rng.random() < 0.35:
                    cat = rng.choices(list(DISTRACTIONS), weights=[5, 4, 3, 2, 1, 2, 1])[0]
                    db.add(Distraction(
                        user_id=user.id, session_id=fs.id, category_id=cats[cat].id,
                        description=rng.choice(DISTRACTIONS[cat]),
                        occurred_at=cursor + timedelta(seconds=rng.randint(60, max(61, actual - 60))),
                    ))
                    distractions += 1
                brk = SessionType.LONG_BREAK if (k + 1) % 4 == 0 else SessionType.SHORT_BREAK
                brk_len = 900 if brk == SessionType.LONG_BREAK else 300
                bstart = fs.ended_at
                if bstart + timedelta(seconds=brk_len) < now:
                    db.add(FocusSession(
                        user_id=user.id, session_type=brk, status=SessionStatus.COMPLETED,
                        planned_duration_seconds=brk_len, started_at=bstart,
                        ended_at=bstart + timedelta(seconds=brk_len), actual_duration_seconds=brk_len,
                    ))
                cursor = bstart + timedelta(seconds=brk_len + rng.randint(0, 600))

        for t in tasks:
            if target[t.id] == "done" and done_count[t.id] >= t.estimated_pomodoros:
                t.status, t.completed_at = TaskStatus.COMPLETED, now - timedelta(days=rng.randint(0, 6), hours=rng.randint(0, 8))
            elif done_count[t.id] > 0:
                t.status = TaskStatus.IN_PROGRESS
        db.commit()
        print(f"Seeded {args.email}: {len(tasks)} tasks, {sessions} focus sessions, {distractions} distractions.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
