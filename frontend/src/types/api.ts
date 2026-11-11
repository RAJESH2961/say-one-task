// Types mirroring the backend Pydantic schemas (backend/app/schemas).

export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "todo" | "in_progress" | "completed";
export type SessionType = "focus" | "short_break" | "long_break";
export type SessionStatus = "running" | "paused" | "completed" | "interrupted";
export type CategoryKind = "task" | "distraction";
export type ThemePreference = "light" | "dark" | "system";

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    request_id?: string | null;
    details?: unknown;
  };
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface Category {
  id: number;
  kind: CategoryKind;
  name: string;
  color: string;
  is_system: boolean;
}

export interface Task {
  id: number;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  estimated_pomodoros: number;
  completed_pomodoros: number;
  focus_seconds: number;
  progress_percent: number;
  category_id: number | null;
  category: Category | null;
  start_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskInput {
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  estimated_pomodoros?: number;
  category_id?: number | null;
  start_date?: string | null;
}

export type TaskSortField =
  | "created_at"
  | "updated_at"
  | "priority"
  | "start_date"
  | "title"
  | "status"
  | "estimated_pomodoros";

export interface TaskQuery {
  search?: string;
  status?: TaskStatus[];
  priority?: TaskPriority[];
  category_id?: number;
  start_date_from?: string;
  start_date_to?: string;
  sort_by?: TaskSortField;
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface TaskBrief {
  id: number;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
}

export interface FocusSession {
  id: number;
  task_id: number | null;
  task: TaskBrief | null;
  session_type: SessionType;
  status: SessionStatus;
  planned_duration_seconds: number;
  started_at: string;
  paused_at: string | null;
  ended_at: string | null;
  total_paused_seconds: number;
  pause_count: number;
  actual_duration_seconds: number | null;
  notes: string | null;
  productivity_rating: number | null;
  distraction_count: number;
  elapsed_seconds: number;
  remaining_seconds: number;
  expected_end_at: string | null;
  server_time: string;
}

export interface TimerCycle {
  next_session_type: SessionType;
  completed_focus_in_cycle: number;
  long_break_interval: number;
  completed_focus_today: number;
}

export interface ActiveSessionResponse {
  session: FocusSession | null;
  cycle: TimerCycle;
  server_time: string;
}

export interface SessionFinishResponse {
  session: FocusSession;
  task: Task | null;
  cycle: TimerCycle;
}

export interface SessionReflection {
  notes?: string | null;
  productivity_rating?: number | null;
}

export interface SessionQuery {
  status?: SessionStatus[];
  session_type?: SessionType[];
  task_id?: number;
  started_from?: string;
  started_to?: string;
  limit?: number;
  offset?: number;
}

export interface Distraction {
  id: number;
  description: string;
  category_id: number | null;
  category: Category | null;
  session_id: number | null;
  session: { id: number; session_type: SessionType; task_id: number | null; started_at: string } | null;
  occurred_at: string;
  created_at: string;
}

export interface DistractionInput {
  description: string;
  category_id?: number | null;
  session_id?: number | null;
  occurred_at?: string | null;
}

export interface DistractionQuery {
  category_id?: number;
  session_id?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface UserSettings {
  focus_duration_minutes: number;
  short_break_minutes: number;
  long_break_minutes: number;
  long_break_interval: number;
  auto_start_breaks: boolean;
  auto_start_focus: boolean;
  sound_enabled: boolean;
  sound_volume: number;
  daily_goal_pomodoros: number;
  theme: ThemePreference;
  timezone: string;
  updated_at: string;
}

export type SettingsUpdate = Partial<Omit<UserSettings, "updated_at">>;

export interface AnalyticsSummary {
  timezone: string;
  today: string;
  today_focus_seconds: number;
  today_pomodoros: number;
  today_tasks_completed: number;
  week_focus_seconds: number;
  week_pomodoros: number;
  total_pomodoros: number;
  total_focus_seconds: number;
  total_sessions: number;
  interrupted_sessions: number;
  average_session_seconds: number;
  current_streak_days: number;
  longest_streak_days: number;
  total_tasks: number;
  completed_tasks: number;
  task_completion_rate: number;
  average_productivity_rating: number | null;
  daily_goal_pomodoros: number;
  most_productive_hour: number | null;
  total_distractions: number;
}

export interface DailyPoint {
  date: string;
  focus_seconds: number;
  pomodoros: number;
  interrupted: number;
  distractions: number;
}

export interface WeeklyAnalytics {
  days: number;
  start_date: string;
  end_date: string;
  total_focus_seconds: number;
  total_pomodoros: number;
  average_daily_focus_seconds: number;
  best_day: string | null;
  previous_period_focus_seconds: number;
  change_percent: number | null;
  series: DailyPoint[];
}

export interface MonthlyAnalytics {
  months: number;
  series: { month: string; focus_seconds: number; pomodoros: number; active_days: number }[];
}

export interface HourPoint {
  hour: number;
  focus_seconds: number;
  pomodoros: number;
}

export interface FocusHoursAnalytics {
  days: number;
  best_hour: number | null;
  series: HourPoint[];
}

export interface DistractionAnalytics {
  days: number;
  total: number;
  per_focus_hour: number | null;
  sessions_with_distractions: number;
  by_category: { category_id: number | null; name: string; color: string; count: number }[];
  by_day: DailyPoint[];
  by_hour: HourPoint[];
}

export interface TaskBucket {
  key: string;
  total: number;
  completed: number;
}

export interface TaskAnalytics {
  total: number;
  completed: number;
  in_progress: number;
  todo: number;
  completion_rate: number;
  estimated_pomodoros_completed_tasks: number;
  actual_pomodoros_completed_tasks: number;
  estimate_accuracy: number | null;
  by_priority: TaskBucket[];
  by_category: TaskBucket[];
  completed_last_7_days: number;
}

export interface Insight {
  kind: string;
  title: string;
  message: string;
  tone: "positive" | "neutral" | "suggestion";
}

export interface AICoachInsight {
  title: string;
  text: string;
}

export interface AICoachResponse {
  available: boolean;
  model: string | null;
  generated_at: string | null;
  insights: AICoachInsight[];
}
