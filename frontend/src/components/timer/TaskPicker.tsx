import { useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAsync } from "@/hooks/useAsync";
import { tasksApi } from "@/services";
import type { Task } from "@/types/api";

const NONE = "none";

/** Select an open (todo / in progress) task to attach to the next focus session. */
export function TaskPicker({
  value,
  onChange,
  disabled,
  refreshKey,
  className,
}: {
  value: number | null;
  onChange: (taskId: number | null) => void;
  disabled?: boolean;
  refreshKey?: unknown;
  className?: string;
}) {
  const { data } = useAsync(
    () => tasksApi.list({ status: ["todo", "in_progress"], sort_by: "priority", order: "desc", limit: 200 }),
    [refreshKey],
  );

  const tasks: Task[] = data?.items ?? [];
  // Drop a stale selection (task completed or deleted elsewhere).
  useEffect(() => {
    if (data && value !== null && !tasks.some((t) => t.id === value)) onChange(null);
  }, [data, value, tasks, onChange]);

  return (
    <Select
      value={value !== null ? String(value) : NONE}
      onValueChange={(v) => onChange(v === NONE ? null : Number(v))}
      disabled={disabled}
    >
      <SelectTrigger className={className ?? "w-full"} aria-label="Task for this session">
        <SelectValue placeholder="No task selected" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>No specific task</SelectItem>
        {tasks.map((t) => (
          <SelectItem key={t.id} value={String(t.id)}>
            <span className="truncate">{t.title}</span>
            <span className="ml-2 text-xs text-muted-foreground tabular">
              {t.completed_pomodoros}/{t.estimated_pomodoros}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
