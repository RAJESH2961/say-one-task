from datetime import date

from pydantic import BaseModel


class SummaryOut(BaseModel):
    timezone: str
    today: date
    today_focus_seconds: int
    today_pomodoros: int
    today_tasks_completed: int
    week_focus_seconds: int
    week_pomodoros: int
    total_pomodoros: int
    total_focus_seconds: int
    total_sessions: int
    interrupted_sessions: int
    average_session_seconds: int
    current_streak_days: int
    longest_streak_days: int
    total_tasks: int
    completed_tasks: int
    task_completion_rate: float
    average_productivity_rating: float | None
    daily_goal_pomodoros: int
    most_productive_hour: int | None
    total_distractions: int


class DailyPoint(BaseModel):
    date: date
    focus_seconds: int
    pomodoros: int
    interrupted: int
    distractions: int


class WeeklyOut(BaseModel):
    days: int
    start_date: date
    end_date: date
    total_focus_seconds: int
    total_pomodoros: int
    average_daily_focus_seconds: int
    best_day: date | None
    previous_period_focus_seconds: int
    change_percent: float | None
    series: list[DailyPoint]


class MonthlyPoint(BaseModel):
    month: str  # YYYY-MM
    focus_seconds: int
    pomodoros: int
    active_days: int


class MonthlyOut(BaseModel):
    months: int
    series: list[MonthlyPoint]


class HourPoint(BaseModel):
    hour: int
    focus_seconds: int
    pomodoros: int


class FocusHoursOut(BaseModel):
    days: int
    best_hour: int | None
    series: list[HourPoint]


class DistractionCategoryCount(BaseModel):
    category_id: int | None
    name: str
    color: str
    count: int


class DistractionsAnalyticsOut(BaseModel):
    days: int
    total: int
    per_focus_hour: float | None
    sessions_with_distractions: int
    by_category: list[DistractionCategoryCount]
    by_day: list[DailyPoint]
    by_hour: list[HourPoint]


class TaskBucket(BaseModel):
    key: str
    total: int
    completed: int


class TasksAnalyticsOut(BaseModel):
    total: int
    completed: int
    in_progress: int
    todo: int
    completion_rate: float
    estimated_pomodoros_completed_tasks: int
    actual_pomodoros_completed_tasks: int
    estimate_accuracy: float | None
    by_priority: list[TaskBucket]
    by_category: list[TaskBucket]
    completed_last_7_days: int


class InsightOut(BaseModel):
    kind: str
    title: str
    message: str
    tone: str  # positive | neutral | suggestion


class InsightsOut(BaseModel):
    insights: list[InsightOut]
