import type { SessionStatus, SessionType, TaskPriority, TaskStatus } from "@/types/api";

/** 1500 -> "25:00", 3725 -> "1:02:05" */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** 5400 -> "1h 30m", 300 -> "5m", 0 -> "0m" */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  if (m) return `${m}m`;
  return s > 0 ? `${s}s` : "0m";
}

export function formatHour(hour: number | null | undefined): string {
  if (hour === null || hour === undefined) return "—";
  const suffix = hour < 12 ? "AM" : "PM";
  return `${hour % 12 || 12} ${suffix}`;
}

export const SESSION_TYPE_LABEL: Record<SessionType, string> = {
  focus: "Focus",
  short_break: "Short Break",
  long_break: "Long Break",
};

export const SESSION_STATUS_LABEL: Record<SessionStatus, string> = {
  running: "Running",
  paused: "Paused",
  completed: "Completed",
  interrupted: "Interrupted",
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "Todo",
  in_progress: "In Progress",
  completed: "Completed",
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/** Local calendar date as YYYY-MM-DD. */
export function toISODate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
