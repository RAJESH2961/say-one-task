import { useMemo, useState, type FormEvent } from "react";
import { BookOpen, MessageSquareText, Plus, Search, Tag, Trash2, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { CategoryBadge, SessionTypeBadge } from "@/components/common/Badges";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { PageHeader } from "@/components/common/PageHeader";
import { Pagination } from "@/components/common/Pagination";
import { RatingInput } from "@/components/common/RatingInput";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/States";
import { DistractionForm } from "@/components/distractions/DistractionForm";
import { ReflectionDialog } from "@/components/sessions/ReflectionDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAsync } from "@/hooks/useAsync";
import { toApiError } from "@/lib/api";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { analyticsApi, distractionsApi, sessionsApi } from "@/services";
import { useCategoriesStore } from "@/stores/categories";
import { useTimerStore } from "@/stores/timer";
import type { Distraction, FocusSession } from "@/types/api";

const LIMIT = 20;
const COLORS = ["#2563eb", "#7c3aed", "#db2777", "#0891b2", "#0d9488", "#4f46e5", "#64748b"];

function NewCategoryPopover() {
  const create = useCategoriesStore((s) => s.create);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Name is required");
    try {
      await create("distraction", name.trim(), color);
      toast.success("Category added");
      setName("");
      setError(null);
      setOpen(false);
    } catch (err) {
      setError(toApiError(err).message);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm"><Plus className="size-3.5" /> Category</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <form onSubmit={submit} className="space-y-3">
          <p className="text-sm font-medium">New distraction category</p>
          <Input autoFocus value={name} maxLength={50} onChange={(e) => setName(e.target.value)} placeholder="e.g. News websites" />
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button key={c} type="button" aria-label={`Color ${c}`} onClick={() => setColor(c)} className={cn("size-6 rounded-full ring-offset-2 ring-offset-background transition", color === c && "ring-2 ring-ring")} style={{ backgroundColor: c }} />
            ))}
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" size="sm" className="w-full">Add category</Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function DistractionsTab() {
  const activeSession = useTimerStore((s) => s.session);
  const allCategories = useCategoriesStore((s) => s.categories);
  const removeCategory = useCategoriesStore((s) => s.remove);
  const categories = useMemo(() => allCategories.filter((c) => c.kind === "distraction"), [allCategories]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [deleting, setDeleting] = useState<Distraction | null>(null);
  const [version, setVersion] = useState(0);

  const list = useAsync(
    () => distractionsApi.list({ category_id: categoryId ?? undefined, search: search.trim() || undefined, limit: LIMIT, offset }),
    [categoryId, search, offset, version],
  );
  const stats = useAsync(() => analyticsApi.distractions(30), [version]);
  const counts = new Map(stats.data?.by_category.map((c) => [c.category_id, c.count]) ?? []);
  const linkSession = activeSession?.session_type === "focus" ? activeSession.id : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Record a distraction</CardTitle>
            <CardDescription>
              {linkSession ? "It will be linked to your current focus session." : "Capture what pulled your attention away."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DistractionForm sessionId={linkSession} onCreated={() => { setOffset(0); setVersion((v) => v + 1); }} />
          </CardContent>
        </Card>

        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => { setSearch(e.target.value); setOffset(0); }} placeholder="Search previous distractions…" className="pl-9" aria-label="Search distractions" />
            </div>
            {categoryId !== null && (
              <Button variant="ghost" size="sm" onClick={() => setCategoryId(null)}><X className="size-3.5" /> Clear filter</Button>
            )}
          </div>

          {list.error ? (
            <ErrorState error={list.error} onRetry={list.reload} />
          ) : !list.data ? (
            <LoadingState />
          ) : list.data.items.length ? (
            <Card className="gap-0 divide-y py-0">
              {list.data.items.map((d) => (
                <div key={d.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${d.category?.color ?? "#94a3b8"}1a`, color: d.category?.color ?? "#94a3b8" }}>
                    <Zap className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium break-words">{d.description}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{new Date(d.occurred_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      <CategoryBadge category={d.category} />
                      {d.session && <span>during a {d.session.session_type === "focus" ? "focus session" : "break"}</span>}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon-sm" aria-label="Delete distraction" onClick={() => setDeleting(d)}>
                    <Trash2 className="size-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </Card>
          ) : (
            <EmptyState icon={Zap} title="No distractions found" description="Distractions you log will show up here." className="rounded-xl border border-dashed" />
          )}
          {list.data && <Pagination total={list.data.total} limit={LIMIT} offset={offset} onChange={setOffset} />}
        </div>
      </div>

      <Card className="h-fit">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><Tag className="size-4" /> Categories</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </div>
          <NewCategoryPopover />
        </CardHeader>
        <CardContent className="space-y-1">
          {categories.map((c) => (
            <div key={c.id} className="group flex items-center gap-1">
              <button
                type="button"
                onClick={() => { setCategoryId(categoryId === c.id ? null : c.id); setOffset(0); }}
                className={cn("flex flex-1 items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted", categoryId === c.id && "bg-accent text-accent-foreground")}
              >
                <span className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ backgroundColor: c.color }} />{c.name}</span>
                <span className="tabular text-xs text-muted-foreground">{counts.get(c.id) ?? 0}</span>
              </button>
              {!c.is_system && (
                <Button variant="ghost" size="icon-xs" className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100" aria-label={`Delete ${c.name}`}
                  onClick={async () => {
                    try {
                      await removeCategory(c.id);
                      if (categoryId === c.id) setCategoryId(null);
                      setVersion((v) => v + 1);
                    } catch (err) {
                      toast.error(toApiError(err).message);
                    }
                  }}>
                  <X className="size-3" />
                </Button>
              )}
            </div>
          ))}
          {stats.data && stats.data.by_category[0] && (
            <p className="mt-3 rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground">
              Most frequent: <span className="font-medium text-foreground">{stats.data.by_category[0].name}</span> ({stats.data.by_category[0].count}×)
            </p>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this entry?"
        description="The distraction will be removed from your journal and analytics."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await distractionsApi.remove(deleting.id);
            toast.success("Entry deleted");
            setVersion((v) => v + 1);
          } catch (err) {
            toast.error(toApiError(err).message);
          }
        }}
      />
    </div>
  );
}

function NotesTab() {
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<FocusSession | null>(null);
  const { data, error, reload, setData } = useAsync(
    () => sessionsApi.history({ session_type: ["focus"], status: ["completed", "interrupted"], limit: LIMIT, offset }),
    [offset],
  );
  const rated = (data?.items ?? []).filter((s) => s.productivity_rating);
  const avg = rated.length ? rated.reduce((a, s) => a + (s.productivity_rating ?? 0), 0) / rated.length : null;

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <LoadingState />;
  if (!data.items.length)
    return <EmptyState icon={MessageSquareText} title="No focus sessions yet" description="After each focus session you can add notes and rate your productivity." className="rounded-xl border border-dashed py-16" />;

  return (
    <div className="space-y-3">
      {avg !== null && (
        <p className="text-sm text-muted-foreground">
          Average rating on this page: <span className="font-medium text-foreground">{avg.toFixed(1)}/5</span>
        </p>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {data.items.map((s) => (
          <Card key={s.id} className="gap-3 p-4 transition-shadow hover:shadow-md">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <SessionTypeBadge type={s.session_type} />
                  <span className="text-xs text-muted-foreground">{new Date(s.started_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <p className="mt-1.5 truncate text-sm font-medium">{s.task?.title ?? "No task"}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDuration(s.actual_duration_seconds ?? 0)} · {s.status === "completed" ? "completed" : "interrupted"}
                  {s.distraction_count > 0 && ` · ${s.distraction_count} distraction${s.distraction_count > 1 ? "s" : ""}`}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditing(s)}>{s.notes || s.productivity_rating ? "Edit" : "Reflect"}</Button>
            </div>
            <RatingInput value={s.productivity_rating} readOnly size="sm" />
            {s.notes ? <p className="text-sm whitespace-pre-line text-muted-foreground">{s.notes}</p> : <p className="text-sm text-muted-foreground/60 italic">No notes</p>}
          </Card>
        ))}
      </div>
      <Pagination total={data.total} limit={LIMIT} offset={offset} onChange={setOffset} />
      <ReflectionDialog
        session={editing}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={(u) => setData((prev) => ({ ...prev!, items: prev!.items.map((i) => (i.id === u.id ? u : i)) }))}
      />
    </div>
  );
}

export function JournalPage() {
  return (
    <>
      <PageHeader title="Distraction Journal" description="Record distractions, reflect on sessions and spot recurring patterns." />
      <Tabs defaultValue="distractions" className="gap-6">
        <TabsList>
          <TabsTrigger value="distractions"><Zap className="size-4" /> Distractions</TabsTrigger>
          <TabsTrigger value="notes"><BookOpen className="size-4" /> Session notes</TabsTrigger>
        </TabsList>
        <TabsContent value="distractions"><DistractionsTab /></TabsContent>
        <TabsContent value="notes"><NotesTab /></TabsContent>
      </Tabs>
    </>
  );
}
