import { useState } from "react";
import { Link } from "react-router-dom";
import { Bell, BellOff, Loader2, Pause, Play, RotateCcw, Target, Zap } from "lucide-react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DistractionForm } from "@/components/distractions/DistractionForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskPicker } from "@/components/timer/TaskPicker";
import { TimerRing } from "@/components/timer/TimerRing";
import { useNow } from "@/hooks/useNow";
import { formatClock, SESSION_TYPE_LABEL } from "@/lib/format";
import { requestNotificationPermission, unlockAudio } from "@/lib/sound";
import { progressFraction, remainingSeconds } from "@/lib/timer";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settings";
import { useTimerStore } from "@/stores/timer";
import type { SessionType } from "@/types/api";

const MODES: SessionType[] = ["focus", "short_break", "long_break"];

/** Full timer UI: mode tabs, circular countdown, controls, task selection and session progress. */
export function TimerPanel({ compact = false }: { compact?: boolean }) {
  const s = useTimerStore();
  const settings = useSettingsStore((st) => st.settings);
  const updateSettings = useSettingsStore((st) => st.update);
  const [confirmReset, setConfirmReset] = useState(false);
  const [distractionOpen, setDistractionOpen] = useState(false);
  const now = useNow(250, !!s.session && s.session.status === "running");

  const session = s.session;
  const mode = session?.session_type ?? s.selectedType;
  const plannedFor = (t: SessionType) =>
    (settings
      ? { focus: settings.focus_duration_minutes, short_break: settings.short_break_minutes, long_break: settings.long_break_minutes }[t]
      : { focus: 25, short_break: 5, long_break: 15 }[t]) * 60;

  const remaining = session ? remainingSeconds(session, s.offsetMs, now) : plannedFor(mode);
  const progress = session ? progressFraction(session, s.offsetMs, now) : 0;
  const paused = session?.status === "paused";
  const cycle = s.cycle;
  const interval = cycle?.long_break_interval ?? settings?.long_break_interval ?? 4;
  const inCycle = cycle?.completed_focus_in_cycle ?? 0;

  const handleStart = async () => {
    unlockAudio();
    void requestNotificationPermission();
    await s.start(mode);
  };

  return (
    <div className={cn("flex flex-col items-center", compact ? "gap-4" : "gap-6")}>
      <Tabs value={mode} onValueChange={(v) => !session && s.setSelectedType(v as SessionType)}>
        <TabsList className="h-10">
          {MODES.map((m) => (
            <TabsTrigger key={m} value={m} disabled={!!session && session.session_type !== m} className="px-3 sm:px-4">
              {SESSION_TYPE_LABEL[m]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <TimerRing progress={progress} size={compact ? 240 : 340} stroke={compact ? 10 : 12} tone={mode} paused={paused}>
        <span
          className={cn(
            "tabular font-semibold tracking-tight",
            compact ? "text-5xl" : "text-6xl sm:text-7xl",
            paused && "text-muted-foreground",
          )}
          aria-live="polite"
          aria-label={`${formatClock(remaining)} remaining`}
        >
          {formatClock(remaining)}
        </span>
        <span className="mt-2 text-sm font-medium text-muted-foreground">
          {session ? (paused ? "Paused" : SESSION_TYPE_LABEL[mode]) : "Ready"}
        </span>
        {session?.session_type === "focus" && session.distraction_count > 0 && (
          <Badge variant="secondary" className="mt-2">
            {session.distraction_count} distraction{session.distraction_count > 1 ? "s" : ""}
          </Badge>
        )}
      </TimerRing>

      <div className="flex items-center gap-3">
        {!session ? (
          <Button size="lg" className="h-12 min-w-40 rounded-full text-base shadow-md" onClick={handleStart} disabled={s.busy || !s.initialized}>
            {s.busy ? <Loader2 className="size-5 animate-spin" /> : <Play className="size-5" />}
            Start {mode === "focus" ? "focus" : "break"}
          </Button>
        ) : (
          <>
            <Button
              size="lg"
              variant="outline"
              className="size-12 rounded-full p-0"
              onClick={() => setConfirmReset(true)}
              disabled={s.busy}
              aria-label="Reset session"
              title="Reset (stop this session)"
            >
              <RotateCcw className="size-5" />
            </Button>
            <Button
              size="lg"
              className="h-12 min-w-36 rounded-full text-base shadow-md"
              onClick={() => void (paused ? s.resume() : s.pause())}
              disabled={s.busy || remaining <= 0}
            >
              {s.busy ? <Loader2 className="size-5 animate-spin" /> : paused ? <Play className="size-5" /> : <Pause className="size-5" />}
              {paused ? "Resume" : "Pause"}
            </Button>
            {session.session_type === "focus" && (
              <Button
                size="lg"
                variant="outline"
                className="size-12 rounded-full p-0"
                onClick={() => setDistractionOpen(true)}
                aria-label="Log a distraction"
                title="Log a distraction"
              >
                <Zap className="size-5" />
              </Button>
            )}
          </>
        )}
      </div>

      <div className="w-full max-w-sm space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Session progress</span>
            <span className="tabular">
              {inCycle}/{interval} until long break
            </span>
          </div>
          <div className="flex gap-1.5" aria-label={`${inCycle} of ${interval} focus sessions completed in this cycle`}>
            {Array.from({ length: interval }).map((_, i) => (
              <div key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors", i < inCycle ? "bg-primary" : "bg-muted")} />
            ))}
          </div>
          {cycle && (
            <p className="text-center text-xs text-muted-foreground">
              {cycle.completed_focus_today} Pomodoro{cycle.completed_focus_today === 1 ? "" : "s"} today
              {settings && ` · goal ${settings.daily_goal_pomodoros}`}
            </p>
          )}
        </div>

        {mode === "focus" && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Target className="size-3.5" /> Current task
            </div>
            {session ? (
              session.task ? (
                <Link to="/tasks" className="block truncate rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium hover:bg-muted">
                  {session.task.title}
                </Link>
              ) : (
                <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">No task linked</p>
              )
            ) : (
              <TaskPicker value={s.selectedTaskId} onChange={s.setSelectedTask} refreshKey={s.cycle?.completed_focus_today} />
            )}
          </div>
        )}

        {!compact && settings && (
          <button
            type="button"
            className="mx-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => void updateSettings({ sound_enabled: !settings.sound_enabled })}
          >
            {settings.sound_enabled ? <Bell className="size-3.5" /> : <BellOff className="size-3.5" />}
            Sound notifications {settings.sound_enabled ? "on" : "off"}
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Reset this session?"
        description={
          session?.session_type === "focus"
            ? "The session will be recorded as interrupted. Time already focused still counts toward your analytics, but not as a completed Pomodoro."
            : "The break will end now."
        }
        confirmLabel="Reset session"
        destructive
        onConfirm={() => s.interrupt()}
      />

      <Dialog open={distractionOpen} onOpenChange={setDistractionOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Log a distraction</DialogTitle>
            <DialogDescription>Note it quickly and get back to work. The timer keeps running.</DialogDescription>
          </DialogHeader>
          <DistractionForm
            compact
            autoFocus
            sessionId={session?.id}
            onCreated={() => {
              setDistractionOpen(false);
              void s.sync();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
