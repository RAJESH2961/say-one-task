import { useState, type DragEvent } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { CategoryBadge, PriorityBadge } from "@/components/common/Badges";
import { Button } from "@/components/ui/button";
import { TaskActions, type TaskHandlers } from "@/components/tasks/TaskActions";
import { TaskProgress } from "@/components/tasks/TaskProgress";
import { TASK_STATUS_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Task, TaskStatus } from "@/types/api";

const COLUMNS: { status: TaskStatus; dot: string }[] = [
  { status: "todo", dot: "bg-slate-400" },
  { status: "in_progress", dot: "bg-primary" },
  { status: "completed", dot: "bg-emerald-500" },
];

function TaskCard({ task, handlers }: { task: Task; handlers: TaskHandlers }) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/task-id", String(task.id));
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => handlers.onEdit(task)}
      className="group cursor-grab rounded-lg border bg-card p-3 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <p className={cn("text-sm leading-snug font-medium", task.status === "completed" && "text-muted-foreground line-through")}>
          {task.title}
        </p>
        <TaskActions task={task} handlers={handlers} />
      </div>
      {task.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{task.description}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <PriorityBadge priority={task.priority} />
        <CategoryBadge category={task.category} />
        {task.start_date && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarDays className="size-3" />
            {new Date(`${task.start_date}T00:00`).toLocaleDateString([], { month: "short", day: "numeric" })}
          </span>
        )}
      </div>
      <TaskProgress task={task} className="mt-3" />
    </div>
  );
}

export function KanbanBoard({
  tasks,
  handlers,
  onCreate,
}: {
  tasks: Task[];
  handlers: TaskHandlers;
  onCreate: (status: TaskStatus) => void;
}) {
  const [over, setOver] = useState<TaskStatus | null>(null);

  const onDrop = (e: DragEvent, status: TaskStatus) => {
    e.preventDefault();
    setOver(null);
    const id = Number(e.dataTransfer.getData("text/task-id"));
    const task = tasks.find((t) => t.id === id);
    if (task && task.status !== status) handlers.onStatus(task, status);
  };

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {COLUMNS.map(({ status, dot }) => {
        const items = tasks.filter((t) => t.status === status);
        return (
          <section
            key={status}
            aria-label={TASK_STATUS_LABEL[status]}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(status);
            }}
            onDragLeave={() => setOver((s) => (s === status ? null : s))}
            onDrop={(e) => onDrop(e, status)}
            className={cn(
              "flex min-h-64 flex-col rounded-xl border bg-muted/40 p-3 transition-colors",
              over === status && "border-primary/50 bg-accent/60",
            )}
          >
            <header className="mb-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full", dot)} />
                <h3 className="text-sm font-semibold">{TASK_STATUS_LABEL[status]}</h3>
                <span className="tabular rounded-full bg-background px-2 text-xs text-muted-foreground">{items.length}</span>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => onCreate(status)} aria-label={`Add task to ${TASK_STATUS_LABEL[status]}`}>
                <Plus className="size-4" />
              </Button>
            </header>
            <div className="flex flex-1 flex-col gap-2">
              {items.map((t) => (
                <TaskCard key={t.id} task={t} handlers={handlers} />
              ))}
              {!items.length && (
                <p className="flex flex-1 items-center justify-center rounded-lg border border-dashed py-8 text-xs text-muted-foreground">
                  Drop tasks here
                </p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
