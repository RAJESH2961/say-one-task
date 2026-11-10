import { CheckCircle2, MoreHorizontal, Pencil, Play, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Task, TaskStatus } from "@/types/api";

export interface TaskHandlers {
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onStatus: (task: Task, status: TaskStatus) => void;
  onFocus: (task: Task) => void;
}

export function TaskActions({ task, handlers }: { task: Task; handlers: TaskHandlers }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${task.title}`} onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {task.status !== "completed" && (
          <DropdownMenuItem onClick={() => handlers.onFocus(task)}>
            <Play className="size-4" /> Focus on this
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => handlers.onEdit(task)}>
          <Pencil className="size-4" /> Edit
        </DropdownMenuItem>
        {task.status !== "completed" ? (
          <DropdownMenuItem onClick={() => handlers.onStatus(task, "completed")}>
            <CheckCircle2 className="size-4" /> Mark complete
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => handlers.onStatus(task, "todo")}>
            <RotateCcw className="size-4" /> Reopen
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => handlers.onDelete(task)}>
          <Trash2 className="size-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
