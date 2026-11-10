import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PRIORITY_LABEL, SESSION_STATUS_LABEL, SESSION_TYPE_LABEL, TASK_STATUS_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Category, SessionStatus, SessionType, TaskPriority, TaskStatus } from "@/types/api";

const PRIORITY_STYLE: Record<TaskPriority, string> = {
  high: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  medium: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  low: "border-slate-500/20 bg-slate-500/10 text-slate-600 dark:text-slate-300",
};
const PRIORITY_ICON = { high: ArrowUp, medium: Minus, low: ArrowDown };

export function PriorityBadge({ priority, className }: { priority: TaskPriority; className?: string }) {
  const Icon = PRIORITY_ICON[priority];
  return (
    <Badge variant="outline" className={cn("gap-1 font-medium", PRIORITY_STYLE[priority], className)}>
      <Icon className="size-3" />
      {PRIORITY_LABEL[priority]}
    </Badge>
  );
}

const STATUS_STYLE: Record<TaskStatus, string> = {
  todo: "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  in_progress: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  completed: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <Badge variant="outline" className={STATUS_STYLE[status]}>
      {TASK_STATUS_LABEL[status]}
    </Badge>
  );
}

export function CategoryBadge({ category }: { category: Pick<Category, "name" | "color"> | null }) {
  if (!category) return null;
  return (
    <Badge variant="outline" className="gap-1.5 font-normal">
      <span className="size-2 rounded-full" style={{ backgroundColor: category.color }} />
      {category.name}
    </Badge>
  );
}

const SESSION_STATUS_STYLE: Record<SessionStatus, string> = {
  running: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  paused: "border-indigo-500/20 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  completed: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  interrupted: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

export function SessionStatusBadge({ status }: { status: SessionStatus }) {
  return (
    <Badge variant="outline" className={SESSION_STATUS_STYLE[status]}>
      {SESSION_STATUS_LABEL[status]}
    </Badge>
  );
}

const SESSION_TYPE_STYLE: Record<SessionType, string> = {
  focus: "bg-primary/10 text-primary border-primary/20",
  short_break: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20",
  long_break: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20",
};

export function SessionTypeBadge({ type }: { type: SessionType }) {
  return (
    <Badge variant="outline" className={SESSION_TYPE_STYLE[type]}>
      {SESSION_TYPE_LABEL[type]}
    </Badge>
  );
}
