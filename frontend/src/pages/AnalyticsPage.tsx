import { useState } from "react";
import { BarChart3, CheckCircle2, Clock, FileDown, Sparkles, Sun, Timer, TrendingDown, TrendingUp, Zap } from "lucide-react";
import { toast } from "sonner";
import { DailyFocusChart, DonutChart, HourlyChart, SimpleBarChart } from "@/components/charts/Charts";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/States";
import { StatCard } from "@/components/common/StatCard";
import { AICoachCard } from "@/components/insights/AICoachCard";
import { InsightList } from "@/components/insights/InsightList";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAsync } from "@/hooks/useAsync";
import { formatDuration, formatHour, PRIORITY_LABEL } from "@/lib/format";
import { generateAnalyticsReport } from "@/lib/report";
import { cn } from "@/lib/utils";
import { analyticsApi } from "@/services";
import type { TaskPriority } from "@/types/api";

const PERIODS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

function ChartCard({ title, description, children, className }: { title: string; description?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const summary = useAsync(() => analyticsApi.summary(), []);
  const daily = useAsync(() => analyticsApi.weekly(days), [days]);
  const weekly = useAsync(() => analyticsApi.weekly(7), []);
  const monthly = useAsync(() => analyticsApi.monthly(6), []);
  const hours = useAsync(() => analyticsApi.focusHours(days), [days]);
  const distractions = useAsync(() => analyticsApi.distractions(days), [days]);
  const tasks = useAsync(() => analyticsApi.tasks(), []);
  const insights = useAsync(() => analyticsApi.insights(), []);

  const s = summary.data;
  const d = daily.data;
  const change = d?.change_percent;

  const reportReady = s && d && weekly.data && monthly.data && hours.data && distractions.data && tasks.data && insights.data;
  const exportPdf = async () => {
    if (!reportReady) return;
    try {
      await generateAnalyticsReport(
        { summary: s, daily: d, weekly: weekly.data!, monthly: monthly.data!, hours: hours.data!, distractions: distractions.data!, tasks: tasks.data!, insights: insights.data! },
        days,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate the PDF report");
    }
  };

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Calculated from your recorded focus sessions, tasks and distractions."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportPdf} disabled={!reportReady}>
              <FileDown className="size-4" /> Export PDF
            </Button>
            <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v))}>
              <TabsList>
                {PERIODS.map((p) => (
                  <TabsTrigger key={p.days} value={String(p.days)}>{p.label}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        }
      />

      {summary.error && <ErrorState error={summary.error} onRetry={summary.reload} className="mb-6" />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Completed Pomodoros" icon={Timer} loading={!s} value={s?.total_pomodoros ?? 0} hint={s && `${s.week_pomodoros} this week · ${s.interrupted_sessions} interrupted overall`} />
        <StatCard label="Total focus time" icon={Clock} accent="violet" loading={!s} value={formatDuration(s?.total_focus_seconds ?? 0)} hint={d && `${formatDuration(d.total_focus_seconds)} in the last ${days} days`} />
        <StatCard label="Average session" icon={BarChart3} accent="cyan" loading={!s} value={formatDuration(s?.average_session_seconds ?? 0)} hint={s?.average_productivity_rating ? `Avg rating ${s.average_productivity_rating.toFixed(1)}/5` : "Rate sessions to track quality"} />
        <StatCard label="Task completion rate" icon={CheckCircle2} accent="green" loading={!s} value={`${s?.task_completion_rate ?? 0}%`} hint={s && `${s.completed_tasks} of ${s.total_tasks} tasks`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3 [&>*]:min-w-0">
        <ChartCard
          className="lg:col-span-2"
          title="Daily focus time"
          description={
            d && (
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>Avg {formatDuration(d.average_daily_focus_seconds)}/day</span>
                {d.best_day && <span>Best: {new Date(`${d.best_day}T00:00`).toLocaleDateString([], { month: "short", day: "numeric" })}</span>}
                {change !== null && change !== undefined && (
                  <span className={cn("flex items-center gap-1 font-medium", change >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                    {change >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                    {Math.abs(change)}% vs previous {days} days
                  </span>
                )}
              </span>
            )
          }
        >
          {daily.error ? <ErrorState error={daily.error} onRetry={daily.reload} /> : d ? <DailyFocusChart data={d.series} variant={days > 14 ? "area" : "bar"} height={280} /> : <LoadingState />}
        </ChartCard>

        <div className="flex flex-col gap-6">
          <ChartCard title="Productivity insights" description="Rule-based observations from your data">
            {insights.error ? <ErrorState error={insights.error} onRetry={insights.reload} /> : insights.data ? <InsightList insights={insights.data} /> : <LoadingState />}
          </ChartCard>
          <AICoachCard />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <ChartCard title="Weekly productivity" description={weekly.data && `${weekly.data.total_pomodoros} Pomodoros · ${formatDuration(weekly.data.total_focus_seconds)} this week`}>
          {weekly.error ? (
            <ErrorState error={weekly.error} onRetry={weekly.reload} />
          ) : weekly.data ? (
            <SimpleBarChart
              data={weekly.data.series.map((p) => ({ label: new Date(`${p.date}T00:00`).toLocaleDateString([], { weekday: "short" }), value: p.pomodoros }))}
              formatter={(v) => `${v} Pomodoro${v === 1 ? "" : "s"}`}
            />
          ) : (
            <LoadingState />
          )}
        </ChartCard>
        <ChartCard title="Monthly productivity" description="Focus hours per month (last 6 months)">
          {monthly.error ? (
            <ErrorState error={monthly.error} onRetry={monthly.reload} />
          ) : monthly.data ? (
            <SimpleBarChart
              color="var(--chart-4)"
              unit="h"
              data={monthly.data.series.map((m) => ({
                label: new Date(`${m.month}-01T00:00`).toLocaleDateString([], { month: "short" }),
                value: Math.round((m.focus_seconds / 3600) * 10) / 10,
              }))}
              formatter={(v) => `${v} hours focused`}
            />
          ) : (
            <LoadingState />
          )}
        </ChartCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3 [&>*]:min-w-0">
        <ChartCard
          className="lg:col-span-2"
          title="Best focus hours"
          description={hours.data?.best_hour !== null && hours.data?.best_hour !== undefined ? (
            <span className="flex items-center gap-1.5"><Sun className="size-3.5" /> Your most productive hour is {formatHour(hours.data.best_hour)}</span>
          ) : "Focus minutes by hour of day"}
        >
          {hours.error ? <ErrorState error={hours.error} onRetry={hours.reload} /> : hours.data ? <HourlyChart data={hours.data.series} best={hours.data.best_hour} /> : <LoadingState />}
        </ChartCard>

        <ChartCard title="Task completion" description={tasks.data && `${tasks.data.completed_last_7_days} completed in the last 7 days`}>
          {tasks.error ? (
            <ErrorState error={tasks.error} onRetry={tasks.reload} />
          ) : tasks.data ? (
            <div className="space-y-4">
              <div className="flex items-end justify-between">
                <span className="tabular text-3xl font-semibold">{tasks.data.completion_rate}%</span>
                <span className="text-xs text-muted-foreground">{tasks.data.todo} todo · {tasks.data.in_progress} in progress</span>
              </div>
              <Progress value={tasks.data.completion_rate} className="h-2" />
              <div className="space-y-2.5 pt-2">
                {tasks.data.by_priority.map((b) => (
                  <div key={b.key} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">{PRIORITY_LABEL[b.key as TaskPriority] ?? b.key} priority</span>
                      <span className="tabular text-muted-foreground">{b.completed}/{b.total}</span>
                    </div>
                    <Progress value={b.total ? (b.completed / b.total) * 100 : 0} className="h-1.5" />
                  </div>
                ))}
              </div>
              {tasks.data.estimate_accuracy !== null && (
                <p className="rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground">
                  Completed tasks used <span className="font-medium text-foreground">{tasks.data.actual_pomodoros_completed_tasks}</span> of{" "}
                  {tasks.data.estimated_pomodoros_completed_tasks} estimated Pomodoros ({tasks.data.estimate_accuracy}%).
                </p>
              )}
            </div>
          ) : (
            <LoadingState />
          )}
        </ChartCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3 [&>*]:min-w-0">
        <ChartCard title="Distraction frequency" description={distractions.data && `${distractions.data.total} logged in ${days} days${distractions.data.per_focus_hour !== null ? ` · ${distractions.data.per_focus_hour} per focus hour` : ""}`}>
          {distractions.error ? (
            <ErrorState error={distractions.error} onRetry={distractions.reload} />
          ) : !distractions.data ? (
            <LoadingState />
          ) : distractions.data.by_category.length ? (
            <>
              <DonutChart data={distractions.data.by_category.map((c) => ({ name: c.name, value: c.count, color: c.color }))} />
              <ul className="mt-3 space-y-1.5">
                {distractions.data.by_category.slice(0, 5).map((c) => (
                  <li key={c.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ backgroundColor: c.color }} />{c.name}</span>
                    <span className="tabular text-muted-foreground">{c.count}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <EmptyState icon={Zap} title="No distractions logged" description="Log distractions during focus to see patterns here." className="py-6" />
          )}
        </ChartCard>

        <ChartCard className="lg:col-span-2" title="Productivity trends" description="Distractions logged per day (last 14 days of the period)">
          {distractions.data ? (
            <SimpleBarChart
              color="var(--chart-4)"
              data={distractions.data.by_day.slice(-14).map((p) => ({
                label: new Date(`${p.date}T00:00`).toLocaleDateString([], { month: "short", day: "numeric" }),
                value: p.distractions,
              }))}
              formatter={(v) => `${v} distraction${v === 1 ? "" : "s"}`}
            />
          ) : (
            <LoadingState />
          )}
          {distractions.data && (
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="tabular text-lg font-semibold">{distractions.data.by_day.reduce((a, p) => a + p.pomodoros, 0)}</p>
                <p className="text-xs text-muted-foreground">Pomodoros</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="tabular text-lg font-semibold">{distractions.data.total}</p>
                <p className="text-xs text-muted-foreground">Distractions</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="tabular text-lg font-semibold">{distractions.data.sessions_with_distractions}</p>
                <p className="text-xs text-muted-foreground">Sessions affected</p>
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      {s && s.total_sessions === 0 && (
        <p className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="size-4" /> Complete a few focus sessions to unlock richer analytics.
        </p>
      )}
    </>
  );
}
