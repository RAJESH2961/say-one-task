import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toApiError } from "@/lib/api";
import { PRIORITY_LABEL, TASK_STATUS_LABEL } from "@/lib/format";
import { tasksApi } from "@/services";
import { useCategoriesStore } from "@/stores/categories";
import type { Task, TaskInput, TaskPriority, TaskStatus } from "@/types/api";

const NONE = "none";

interface FormState {
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  estimated_pomodoros: string;
  category_id: string;
  start_date: string;
}

function initialState(task?: Task | null, defaults?: Partial<TaskInput>): FormState {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    priority: task?.priority ?? defaults?.priority ?? "medium",
    status: task?.status ?? defaults?.status ?? "todo",
    estimated_pomodoros: String(task?.estimated_pomodoros ?? 1),
    category_id: task?.category_id ? String(task.category_id) : NONE,
    start_date: task?.start_date ?? "",
  };
}

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  defaults,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  defaults?: Partial<TaskInput>;
  onSaved: (task: Task) => void;
}) {
  const allCategories = useCategoriesStore((s) => s.categories);
  const categories = useMemo(() => allCategories.filter((c) => c.kind === "task"), [allCategories]);
  const [form, setForm] = useState<FormState>(() => initialState(task, defaults));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const editing = !!task;

  useEffect(() => {
    if (open) {
      setForm(initialState(task, defaults));
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const est = Number(form.estimated_pomodoros);
    const clientErrors: Record<string, string> = {};
    if (!form.title.trim()) clientErrors.title = "Title is required";
    if (!Number.isInteger(est) || est < 1 || est > 100) clientErrors.estimated_pomodoros = "Enter a whole number between 1 and 100";
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors);
      return;
    }
    const body: TaskInput = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      priority: form.priority,
      status: form.status,
      estimated_pomodoros: est,
      category_id: form.category_id === NONE ? null : Number(form.category_id),
      start_date: form.start_date || null,
    };
    setSubmitting(true);
    try {
      const saved = editing ? await tasksApi.update(task!.id, body) : await tasksApi.create(body);
      toast.success(editing ? "Task updated" : "Task created");
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      const apiErr = toApiError(err);
      setErrors(apiErr.fieldErrors);
      if (!Object.keys(apiErr.fieldErrors).length) toast.error(apiErr.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit task" : "New task"}</DialogTitle>
          <DialogDescription>{editing ? "Update the task details." : "Plan the work and estimate the Pomodoros it needs."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input id="task-title" autoFocus maxLength={200} value={form.title} onChange={(e) => set("title", e.target.value)} aria-invalid={!!errors.title} placeholder="e.g. Draft project proposal" />
            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-desc">Description</Label>
            <Textarea id="task-desc" rows={3} maxLength={5000} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Optional details, acceptance criteria, links…" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => set("priority", v as TaskPriority)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRIORITY_LABEL) as TaskPriority[]).map((p) => (
                    <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v as TaskStatus)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TASK_STATUS_LABEL) as TaskStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{TASK_STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category_id} onValueChange={(v) => set("category_id", v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      <span className="size-2 rounded-full" style={{ backgroundColor: c.color }} />
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category_id && <p className="text-xs text-destructive">{errors.category_id}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-est">Estimated Pomodoros</Label>
              <Input id="task-est" type="number" min={1} max={100} value={form.estimated_pomodoros} onChange={(e) => set("estimated_pomodoros", e.target.value)} aria-invalid={!!errors.estimated_pomodoros} />
              {errors.estimated_pomodoros && <p className="text-xs text-destructive">{errors.estimated_pomodoros}</p>}
            </div>
            <div className="col-span-2 space-y-1.5 sm:col-span-1">
              <Label htmlFor="task-start">Start date</Label>
              <Input id="task-start" type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
            </div>
            {editing && (
              <div className="col-span-2 space-y-1.5 sm:col-span-1">
                <Label>Completed Pomodoros</Label>
                <p className="tabular flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground" title="Derived from your recorded focus sessions">
                  {task!.completed_pomodoros} recorded
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Save changes" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
