import { Checkbox } from "@/components/tasks/Checkbox";
import { CategoryBadge, PriorityBadge, TaskStatusBadge } from "@/components/common/Badges";
import { TaskActions, type TaskHandlers } from "@/components/tasks/TaskActions";
import { TaskProgress } from "@/components/tasks/TaskProgress";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/api";

export function TaskList({ tasks, handlers }: { tasks: Task[]; handlers: TaskHandlers }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="hidden grid-cols-[auto_1fr_110px_120px_110px_150px_40px] items-center gap-4 border-b bg-muted/40 px-4 py-2.5 text-xs font-medium text-muted-foreground lg:grid">
        <span className="w-5" />
        <span>Task</span>
        <span>Priority</span>
        <span>Category</span>
        <span>Status</span>
        <span>Pomodoros</span>
        <span />
      </div>
      <ul className="divide-y">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-muted/40 lg:grid-cols-[auto_1fr_110px_120px_110px_150px_40px]"
            onClick={() => handlers.onEdit(task)}
          >
            <Checkbox
              checked={task.status === "completed"}
              label={task.status === "completed" ? "Reopen task" : "Complete task"}
              onChange={(checked) => handlers.onStatus(task, checked ? "completed" : "todo")}
            />
            <div className="min-w-0">
              <p className={cn("truncate text-sm font-medium", task.status === "completed" && "text-muted-foreground line-through")}>
                {task.title}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {task.start_date ? `Starts ${new Date(`${task.start_date}T00:00`).toLocaleDateString()}` : task.description || "\u00a0"}
              </p>
            </div>
            <div className="lg:hidden">
              <TaskActions task={task} handlers={handlers} />
            </div>
            <div className="col-span-3 flex flex-wrap items-center gap-2 pl-9 lg:contents">
              <div><PriorityBadge priority={task.priority} /></div>
              <div className="min-w-0">{task.category ? <CategoryBadge category={task.category} /> : <span className="hidden text-xs text-muted-foreground lg:inline">—</span>}</div>
              <div><TaskStatusBadge status={task.status} /></div>
              <TaskProgress task={task} className="w-36 lg:w-auto" />
            </div>
            <div className="hidden lg:block">
              <TaskActions task={task} handlers={handlers} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
