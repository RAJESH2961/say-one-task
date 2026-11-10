import { useMemo, useState } from "react";
import { History, MessageSquareText, PauseCircle, Pencil, Zap } from "lucide-react";
import { SessionStatusBadge, SessionTypeBadge } from "@/components/common/Badges";
import { PageHeader } from "@/components/common/PageHeader";
import { Pagination } from "@/components/common/Pagination";
import { RatingInput } from "@/components/common/RatingInput";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/States";
import { ReflectionDialog } from "@/components/sessions/ReflectionDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAsync } from "@/hooks/useAsync";
import { formatDuration, SESSION_STATUS_LABEL, SESSION_TYPE_LABEL } from "@/lib/format";
import { sessionsApi } from "@/services";
import { useTimerStore } from "@/stores/timer";
import type { FocusSession, SessionStatus, SessionType } from "@/types/api";

const ALL = "all";
const LIMIT = 20;

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined });
}

export function HistoryPage() {
  const [type, setType] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<FocusSession | null>(null);
  const refresh = useTimerStore((s) => `${s.cycle?.completed_focus_today}-${s.session?.id}`);

  const { data, error, loading, reload, setData } = useAsync(
    () =>
      sessionsApi.history({
        session_type: type !== ALL ? [type as SessionType] : undefined,
        status: status !== ALL ? [status as SessionStatus] : undefined,
        limit: LIMIT,
        offset,
      }),
    [type, status, offset, refresh],
  );

  const groups = useMemo(() => {
    const map = new Map<string, FocusSession[]>();
    for (const s of data?.items ?? []) {
      const key = dayLabel(s.started_at);
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return [...map.entries()];
  }, [data]);

  const resetPage = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setOffset(0);
  };

  return (
    <>
      <PageHeader
        title="Focus History"
        description={data ? `${data.total} session${data.total === 1 ? "" : "s"} recorded` : "Every focus session and break you've recorded."}
        actions={
          <>
            <Select value={type} onValueChange={resetPage(setType)}>
              <SelectTrigger className="w-40" aria-label="Filter by type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All types</SelectItem>
                {(Object.keys(SESSION_TYPE_LABEL) as SessionType[]).map((t) => <SelectItem key={t} value={t}>{SESSION_TYPE_LABEL[t]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={resetPage(setStatus)}>
              <SelectTrigger className="w-40" aria-label="Filter by status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {(Object.keys(SESSION_STATUS_LABEL) as SessionStatus[]).map((s) => <SelectItem key={s} value={s}>{SESSION_STATUS_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        }
      />

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <LoadingState label="Loading history…" />
      ) : !data?.items.length ? (
        <EmptyState icon={History} title="No sessions found" description="Completed and interrupted sessions will appear here." className="rounded-xl border border-dashed py-16" />
      ) : (
        <div className="space-y-6">
          {groups.map(([label, sessions]) => (
            <section key={label}>
              <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{label}</h2>
              <Card className="gap-0 divide-y py-0">
                {sessions.map((s) => {
                  const finished = s.status === "completed" || s.status === "interrupted";
                  return (
                    <div key={s.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center">
                      <div className="flex w-28 shrink-0 flex-col">
                        <span className="tabular text-sm font-medium">
                          {new Date(s.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          {s.ended_at && ` – ${new Date(s.ended_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                        </span>
                        <span className="tabular text-xs text-muted-foreground">
                          {formatDuration(s.actual_duration_seconds ?? s.elapsed_seconds)} of {formatDuration(s.planned_duration_seconds)}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <SessionTypeBadge type={s.session_type} />
                          <SessionStatusBadge status={s.status} />
                          {s.task && <span className="truncate text-sm font-medium">{s.task.title}</span>}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {s.pause_count > 0 && <span className="flex items-center gap-1"><PauseCircle className="size-3.5" />{s.pause_count} pause{s.pause_count > 1 ? "s" : ""} ({formatDuration(s.total_paused_seconds)})</span>}
                          {s.distraction_count > 0 && <span className="flex items-center gap-1"><Zap className="size-3.5" />{s.distraction_count} distraction{s.distraction_count > 1 ? "s" : ""}</span>}
                          {s.productivity_rating && <RatingInput value={s.productivity_rating} readOnly size="sm" />}
                        </div>
                        {s.notes && (
                          <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                            <MessageSquareText className="mt-0.5 size-3.5 shrink-0" />
                            <span className="line-clamp-2">{s.notes}</span>
                          </p>
                        )}
                      </div>
                      {finished && (
                        <Button variant="ghost" size="sm" onClick={() => setEditing(s)} className="self-start sm:self-center">
                          <Pencil className="size-3.5" /> {s.notes || s.productivity_rating ? "Edit" : "Add notes"}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </Card>
            </section>
          ))}
          <Pagination total={data.total} limit={LIMIT} offset={offset} onChange={setOffset} />
        </div>
      )}

      <ReflectionDialog
        session={editing}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={(updated) => setData((prev) => ({ ...prev!, items: prev!.items.map((i) => (i.id === updated.id ? updated : i)) }))}
      />
    </>
  );
}
