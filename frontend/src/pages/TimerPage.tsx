import { Link } from "react-router-dom";
import { History, Lightbulb } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { SessionStatusBadge, SessionTypeBadge } from "@/components/common/Badges";
import { EmptyState } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TimerPanel } from "@/components/timer/TimerPanel";
import { useAsync } from "@/hooks/useAsync";
import { formatDuration } from "@/lib/format";
import { sessionsApi } from "@/services";
import { useTimerStore } from "@/stores/timer";

export function TimerPage() {
  const completedToday = useTimerStore((s) => s.cycle?.completed_focus_today);
  const activeId = useTimerStore((s) => s.session?.id);
  const recent = useAsync(() => sessionsApi.history({ limit: 6 }), [completedToday, activeId]);

  return (
    <>
      <PageHeader title="Focus Timer" description="Work in focused intervals with regular breaks." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px] [&>*]:min-w-0">
        <Card className="py-10">
          <CardContent>
            <TimerPanel />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Recent sessions</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/history">View all</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-1">
              {recent.data?.items.length ? (
                recent.data.items.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted/50">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <SessionTypeBadge type={s.session_type} />
                        <span className="text-xs text-muted-foreground">
                          {new Date(s.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      {s.task && <p className="mt-1 truncate text-xs text-muted-foreground">{s.task.title}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <SessionStatusBadge status={s.status} />
                      <span className="tabular text-xs text-muted-foreground">
                        {formatDuration(s.actual_duration_seconds ?? s.elapsed_seconds)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState icon={History} title="No sessions yet" description="Start your first focus session." className="py-6" />
              )}
            </CardContent>
          </Card>

          <Card className="bg-accent/40">
            <CardContent className="flex gap-3 text-sm">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="space-y-1 text-muted-foreground">
                <p className="font-medium text-foreground">How it works</p>
                <p>Your timer runs on the server: refresh the page, close the tab or open it on another window and it keeps accurate time.</p>
                <p>Press the ⚡ button during focus to log a distraction without stopping.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
