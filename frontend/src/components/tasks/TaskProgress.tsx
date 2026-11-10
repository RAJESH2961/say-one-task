import { Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/api";

/** Pomodoro progress (completed/estimated), derived on the server from recorded focus sessions. */
export function TaskProgress({ task, className }: { task: Task; className?: string }) {
  const over = task.completed_pomodoros > task.estimated_pomodoros;
  return (
    <div className={cn("flex items-center gap-2", className)} title={`${task.completed_pomodoros} of ${task.estimated_pomodoros} Pomodoros`}>
      <Timer className="size-3.5 shrink-0 text-muted-foreground" />
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", task.status === "completed" ? "bg-emerald-500" : "bg-primary")}
          style={{ width: `${task.progress_percent}%` }}
        />
      </div>
      <span className={cn("tabular text-xs", over ? "font-medium text-primary" : "text-muted-foreground")}>
        {task.completed_pomodoros}/{task.estimated_pomodoros}
      </span>
    </div>
  );
}
