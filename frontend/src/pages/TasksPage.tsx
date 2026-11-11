import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, CheckSquare, Columns3, List, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/States";
import { KanbanBoard } from "@/components/tasks/KanbanBoard";
import type { TaskHandlers } from "@/components/tasks/TaskActions";
import { TaskFormDialog } from "@/components/tasks/TaskFormDialog";
import { TaskList } from "@/components/tasks/TaskList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAsync } from "@/hooks/useAsync";
import { toApiError } from "@/lib/api";
import { PRIORITY_LABEL, TASK_STATUS_LABEL } from "@/lib/format";
import { tasksApi } from "@/services";
import { useCategoriesStore } from "@/stores/categories";
import { useTimerStore } from "@/stores/timer";
import type { Task, TaskInput, TaskPriority, TaskSortField, TaskStatus } from "@/types/api";

const ALL = "all";
const SORTS: { value: TaskSortField; label: string }[] = [
  { value: "created_at", label: "Date created" },
  { value: "updated_at", label: "Last updated" },
  { value: "priority", label: "Priority" },
  { value: "start_date", label: "Start date" },
  { value: "title", label: "Title" },
  { value: "status", label: "Status" },
  { value: "estimated_pomodoros", label: "Estimate" },
];

function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export function TasksPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<"board" | "list">(() => (localStorage.getItem("focusflow-task-view") as "board" | "list") || "board");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>(ALL);
  const [priority, setPriority] = useState<string>(ALL);
  const [categoryId, setCategoryId] = useState<string>(ALL);
  const [sortBy, setSortBy] = useState<TaskSortField>("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [defaults, setDefaults] = useState<Partial<TaskInput>>({});
  const [deleting, setDeleting] = useState<Task | null>(null);
  const debouncedSearch = useDebounced(search);
  const allCategories = useCategoriesStore((s) => s.categories);
  const categories = useMemo(() => allCategories.filter((c) => c.kind === "task"), [allCategories]);
  const timerSession = useTimerStore((s) => s.session);
  const startTimer = useTimerStore((s) => s.start);
  const setSelectedTask = useTimerStore((s) => s.setSelectedTask);
  const completedToday = useTimerStore((s) => s.cycle?.completed_focus_today);

  useEffect(() => localStorage.setItem("focusflow-task-view", view), [view]);

  const query = {
    search: debouncedSearch || undefined,
    status: view === "list" && status !== ALL ? [status as TaskStatus] : undefined,
    priority: priority !== ALL ? [priority as TaskPriority] : undefined,
    category_id: categoryId !== ALL ? Number(categoryId) : undefined,
    sort_by: sortBy,
    order,
    limit: 500,
  };
  const { data, error, loading, reload, setData } = useAsync(
    () => tasksApi.list(query),
    [JSON.stringify(query), completedToday],
  );
  const tasks = data?.items ?? [];
  const hasFilters = !!(search || status !== ALL || priority !== ALL || categoryId !== ALL);

  const upsert = (task: Task) =>
    setData((prev) => {
      const items = prev?.items ?? [];
      const exists = items.some((t) => t.id === task.id);
      return { ...(prev ?? { total: 0, limit: 500, offset: 0 }), items: exists ? items.map((t) => (t.id === task.id ? task : t)) : [task, ...items], total: (prev?.total ?? 0) + (exists ? 0 : 1) };
    });

  const handlers: TaskHandlers = {
    onEdit: (task) => {
      setEditing(task);
      setFormOpen(true);
    },
    onDelete: (task) => setDeleting(task),
    onStatus: async (task, next) => {
      const previous = task;
      upsert({ ...task, status: next }); // optimistic
      try {
        upsert(await tasksApi.setStatus(task.id, next));
        if (next === "completed") toast.success(`"${task.title}" completed`);
      } catch (err) {
        upsert(previous);
        toast.error(toApiError(err).message);
      }
    },
    onFocus: async (task) => {
      setSelectedTask(task.id);
      if (timerSession) {
        toast.info("Finish or reset the current session first. Task selected for the next focus.");
      } else {
        await startTimer("focus", task.id);
      }
      navigate("/timer");
    },
  };

  const openCreate = (status?: TaskStatus) => {
    setEditing(null);
    setDefaults(status ? { status } : {});
    setFormOpen(true);
  };

  const clearFilters = () => {
    setSearch("");
    setStatus(ALL);
    setPriority(ALL);
    setCategoryId(ALL);
  };

  return (
    <>
      <PageHeader
        title="Tasks"
        description={data ? `${data.total} task${data.total === 1 ? "" : "s"}` : "Plan your work and track Pomodoro progress."}
        actions={
          <>
            <Tabs value={view} onValueChange={(v) => setView(v as "board" | "list")}>
              <TabsList>
                <TabsTrigger value="board" aria-label="Kanban board"><Columns3 className="size-4" /> Board</TabsTrigger>
                <TabsTrigger value="list" aria-label="List view"><List className="size-4" /> List</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button onClick={() => openCreate()}>
              <Plus className="size-4" /> New task
            </Button>
          </>
        }
      />

      <div className="mb-5 flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks…" className="pl-9" aria-label="Search tasks" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {view === "list" && (
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-36" aria-label="Filter by status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {(Object.keys(TASK_STATUS_LABEL) as TaskStatus[]).map((s) => <SelectItem key={s} value={s}>{TASK_STATUS_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="w-full sm:w-36" aria-label="Filter by priority"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All priorities</SelectItem>
              {(Object.keys(PRIORITY_LABEL) as TaskPriority[]).map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="w-full sm:w-36" aria-label="Filter by category"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as TaskSortField)}>
            <SelectTrigger className="w-full sm:w-40" aria-label="Sort by"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SORTS.map((s) => <SelectItem key={s.value} value={s.value}>Sort: {s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => setOrder((o) => (o === "asc" ? "desc" : "asc"))} aria-label={`Sort ${order === "asc" ? "descending" : "ascending"}`} title={order === "asc" ? "Ascending" : "Descending"}>
            {order === "asc" ? <ArrowUpNarrowWide className="size-4" /> : <ArrowDownWideNarrow className="size-4" />}
          </Button>
          {hasFilters && (
            <Button variant="ghost" onClick={clearFilters}>
              <X className="size-4" /> Clear
            </Button>
          )}
        </div>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <LoadingState label="Loading tasks…" />
      ) : !tasks.length && !hasFilters ? (
        <EmptyState
          icon={CheckSquare}
          title="No tasks yet"
          description="Create your first task and estimate how many Pomodoros it will take."
          action={<Button onClick={() => openCreate()}><Plus className="size-4" /> New task</Button>}
          className="rounded-xl border border-dashed py-16"
        />
      ) : view === "board" ? (
        <KanbanBoard tasks={tasks} handlers={handlers} onCreate={openCreate} />
      ) : tasks.length ? (
        <TaskList tasks={tasks} handlers={handlers} />
      ) : (
        <EmptyState icon={Search} title="No matching tasks" description="Try a different search or clear the filters." className="rounded-xl border border-dashed" />
      )}

      <TaskFormDialog open={formOpen} onOpenChange={setFormOpen} task={editing} defaults={defaults} onSaved={upsert} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete task?"
        description={deleting ? `"${deleting.title}" will be permanently deleted. Its focus sessions stay in your history.` : undefined}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await tasksApi.remove(deleting.id);
            setData((prev) => ({ ...prev!, items: prev!.items.filter((t) => t.id !== deleting.id), total: prev!.total - 1 }));
            toast.success("Task deleted");
          } catch (err) {
            toast.error(toApiError(err).message);
          }
        }}
      />
    </>
  );
}
