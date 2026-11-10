import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Clock, Flame, History, ListTodo, Sparkles, Timer } from "lucide-react";
import { DailyFocusChart } from "@/components/charts/Charts";
import { PriorityBadge, SessionStatusBadge, SessionTypeBadge } from "@/components/common/Badges";
import { ErrorState, EmptyState, LoadingState } from "@/components/common/States";
import { StatCard } from "@/components/common/StatCard";
import { InsightList } from "@/components/insights/InsightList";
import { Checkbox } from "@/components/tasks/Checkbox";
import { TaskProgress } from "@/components/tasks/TaskProgress";
import { TimerPanel } from "@/components/timer/TimerPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAsync } from "@/hooks/useAsync";
import { toApiError } from "@/lib/api";
import { formatDuration, greeting, toISODate } from "@/lib/format";
import { analyticsApi, sessionsApi, tasksApi } from "@/services";
import { useAuthStore } from "@/stores/auth";
import { useTimerStore } from "@/stores/timer";
import { toast } from "sonner";

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  // Refresh dashboard data whenever a session finishes (in this or another tab).
  const completedToday = useTimerStore((s) => s.cycle?.completed_focus_today);
  const activeId = useTimerStore((s) => s.session?.id);
  const refreshKey = `${completedToday}-${activeId}`;

  const summary = useAsync(() => analyticsApi.summary(), [refreshKey]);
  const weekly = useAsync(() => analyticsApi.weekly(7), [refreshKey]);
  const insights = useAsync(() => analyticsApi.insights(), [refreshKey]);
  const recent = useAsync(() => sessionsApi.history({ limit: 5 }), [refreshKey]);
  const tasks = useAsync(
    () => tasksApi.list({ status: ["todo", "in_progress"], sort_by: "priority", order: "desc", limit: 100 }),
    [refreshKey],
  );

  const today = toISODate();
  const todaysTasks = useMemo(
    () =>
      (tasks.data?.items ?? [])
        .filter((t) => t.status === "in_progress" || !t.start_date || t.start_date <= today)
        .slice(0, 6),
    [tasks.data, today],
  );

  const s = summary.data;
  const goalPct = s ? Math.min(100, Math.round((s.today_pomodoros / s.daily_goal_pomodoros) * 100)) : 0;

  const complete = async (id: number) => {
    try {
      await tasksApi.setStatus(id, "completed");
      toast.success("Task completed");
      void tasks.reload();
      void summary.reload();
    } catch (err) {
      toast.error(toApiError(err).message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {greeting()}, {user?.full_name.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted-foreground">
          {s && s.today_pomodoros > 0
            ? `You've completed ${s.today_pomodoros} of ${s.daily_goal_pomodoros} Pomodoros today. Keep the momentum going.`
            : "Ready for a productive day? Start a focus session when you are."}
        </p>
      </div>

      {summary.error ? (
        <ErrorState error={summary.error} onRetry={summary.reload} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Today's focus time" icon={Clock} loading={!s} value={formatDuration(s?.today_focus_seconds ?? 0)} hint={s && `${formatDuration(s.week_focus_seconds)} this week`} />
          <StatCard label="Pomodoros today" icon={Timer} accent="violet" loading={!s} value={`${s?.today_pomodoros ?? 0} / ${s?.daily_goal_pomodoros ?? 0}`}>
            {s && <Progress value={goalPct} className="mt-3 h-1.5" aria-label="Daily goal progress" />}
          </StatCard>
          <StatCard label="Tasks completed today" icon={CheckCircle2} accent="green" loading={!s} value={s?.today_tasks_completed ?? 0} hint={s && `${s.task_completion_rate}% overall completion`} />
          <StatCard label="Focus streak" icon={Flame} accent="cyan" loading={!s} value={`${s?.current_streak_days ?? 0} day${s?.current_streak_days === 1 ? "" : "s"}`} hint={s && `Longest: ${s.longest_streak_days} days`} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3 [&>*]:min-w-0">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Weekly focus</CardTitle>
              <CardDescription>
                {weekly.data
                  ? `${formatDuration(weekly.data.total_focus_seconds)} · ${weekly.data.total_pomodoros} Pomodoros in the last 7 days`
                  : "Minutes of focused work per day"}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/analytics">Analytics <ArrowRight className="size-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {weekly.error ? <ErrorState error={weekly.error} onRetry={weekly.reload} /> : weekly.data ? <DailyFocusChart data={weekly.data.series} /> : <LoadingState />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick start</CardTitle>
            <CardDescription>Jump straight into a session.</CardDescription>
          </CardHeader>
          <CardContent>
            <TimerPanel compact />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 [&>*]:min-w-0">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Today's tasks</CardTitle>
            <Button variant="ghost" size="sm" asChild><Link to="/tasks">All tasks</Link></Button>
          </CardHeader>
          <CardContent>
            {tasks.error ? (
              <ErrorState error={tasks.error} onRetry={tasks.reload} />
            ) : !tasks.data ? (
              <LoadingState />
            ) : todaysTasks.length ? (
              <ul className="space-y-3">
                {todaysTasks.map((t) => (
                  <li key={t.id} className="flex items-start gap-3">
                    <Checkbox checked={false} label={`Complete ${t.title}`} onChange={() => void complete(t.id)} />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium">{t.title}</p>
                        <PriorityBadge priority={t.priority} />
                      </div>
                      <TaskProgress task={t} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={ListTodo} title="Nothing planned" description="Add tasks to plan your day." className="py-6" action={<Button size="sm" variant="outline" asChild><Link to="/tasks">Add a task</Link></Button>} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent sessions</CardTitle>
            <Button variant="ghost" size="sm" asChild><Link to="/history">History</Link></Button>
          </CardHeader>
          <CardContent>
            {recent.error ? (
              <ErrorState error={recent.error} onRetry={recent.reload} />
            ) : !recent.data ? (
              <LoadingState />
            ) : recent.data.items.length ? (
              <ul className="space-y-3">
                {recent.data.items.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <SessionTypeBadge type={r.session_type} />
                        <span className="text-xs text-muted-foreground">
                          {new Date(r.started_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{r.task?.title ?? "No task"}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <SessionStatusBadge status={r.status} />
                      <span className="tabular text-xs text-muted-foreground">{formatDuration(r.actual_duration_seconds ?? r.elapsed_seconds)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={History} title="No sessions yet" description="Your completed sessions will appear here." className="py-6" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-primary" /> Focus insights</CardTitle>
          </CardHeader>
          <CardContent>
            {insights.error ? <ErrorState error={insights.error} onRetry={insights.reload} /> : insights.data ? <InsightList insights={insights.data} limit={4} /> : <LoadingState />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
