import { http } from "@/lib/api";
import type {
  ActiveSessionResponse,
  AICoachResponse,
  AnalyticsSummary,
  Category,
  CategoryKind,
  Distraction,
  DistractionAnalytics,
  DistractionInput,
  DistractionQuery,
  FocusHoursAnalytics,
  FocusSession,
  Insight,
  MonthlyAnalytics,
  Page,
  SessionFinishResponse,
  SessionQuery,
  SessionReflection,
  SessionType,
  SettingsUpdate,
  Task,
  TaskAnalytics,
  TaskInput,
  TaskQuery,
  TaskStatus,
  TokenResponse,
  User,
  UserSettings,
  WeeklyAnalytics,
} from "@/types/api";

const data = <T,>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export const authApi = {
  login: (email: string, password: string) => data<TokenResponse>(http.post("/auth/login", { email, password })),
  register: (body: { email: string; password: string; full_name: string; timezone?: string }) =>
    data<TokenResponse>(http.post("/auth/register", body)),
  me: () => data<User>(http.get("/auth/me")),
};

export const tasksApi = {
  list: (params: TaskQuery = {}) => data<Page<Task>>(http.get("/tasks", { params })),
  get: (id: number) => data<Task>(http.get(`/tasks/${id}`)),
  create: (body: TaskInput) => data<Task>(http.post("/tasks", body)),
  update: (id: number, body: Partial<TaskInput>) => data<Task>(http.put(`/tasks/${id}`, body)),
  setStatus: (id: number, status: TaskStatus) => data<Task>(http.patch(`/tasks/${id}/status`, { status })),
  remove: (id: number) => http.delete(`/tasks/${id}`).then(() => undefined),
};

export const sessionsApi = {
  active: () => data<ActiveSessionResponse>(http.get("/sessions/active")),
  start: (body: { session_type: SessionType; task_id?: number | null; planned_duration_seconds?: number }) =>
    data<FocusSession>(http.post("/sessions/start", body)),
  pause: (id: number) => data<FocusSession>(http.post(`/sessions/${id}/pause`)),
  resume: (id: number) => data<FocusSession>(http.post(`/sessions/${id}/resume`)),
  complete: (id: number, body?: SessionReflection) =>
    data<SessionFinishResponse>(http.post(`/sessions/${id}/complete`, body ?? null)),
  interrupt: (id: number, body?: SessionReflection) =>
    data<SessionFinishResponse>(http.post(`/sessions/${id}/interrupt`, body ?? null)),
  updateReflection: (id: number, body: SessionReflection) => data<FocusSession>(http.patch(`/sessions/${id}`, body)),
  history: (params: SessionQuery = {}) => data<Page<FocusSession>>(http.get("/sessions/history", { params })),
};

export const distractionsApi = {
  list: (params: DistractionQuery = {}) => data<Page<Distraction>>(http.get("/distractions", { params })),
  create: (body: DistractionInput) => data<Distraction>(http.post("/distractions", body)),
  remove: (id: number) => http.delete(`/distractions/${id}`).then(() => undefined),
};

export const categoriesApi = {
  list: (kind?: CategoryKind) => data<Category[]>(http.get("/categories", { params: kind ? { kind } : {} })),
  create: (body: { kind: CategoryKind; name: string; color?: string }) => data<Category>(http.post("/categories", body)),
  remove: (id: number) => http.delete(`/categories/${id}`).then(() => undefined),
};

export const settingsApi = {
  get: () => data<UserSettings>(http.get("/settings")),
  update: (body: SettingsUpdate) => data<UserSettings>(http.put("/settings", body)),
};

export const analyticsApi = {
  summary: () => data<AnalyticsSummary>(http.get("/analytics/summary")),
  weekly: (days = 7) => data<WeeklyAnalytics>(http.get("/analytics/weekly", { params: { days } })),
  monthly: (months = 6) => data<MonthlyAnalytics>(http.get("/analytics/monthly", { params: { months } })),
  focusHours: (days = 30) => data<FocusHoursAnalytics>(http.get("/analytics/focus-hours", { params: { days } })),
  distractions: (days = 30) => data<DistractionAnalytics>(http.get("/analytics/distractions", { params: { days } })),
  tasks: () => data<TaskAnalytics>(http.get("/analytics/tasks")),
  insights: () => data<{ insights: Insight[] }>(http.get("/analytics/insights")).then((r) => r.insights),
};

export const aiApi = {
  coach: () => data<AICoachResponse>(http.get("/ai/coach")),
};
