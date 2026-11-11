import { Link } from "react-router-dom";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/useNow";
import { formatClock, SESSION_TYPE_LABEL } from "@/lib/format";
import { progressFraction, remainingSeconds } from "@/lib/timer";
import { cn } from "@/lib/utils";
import { useTimerStore } from "@/stores/timer";

/** Compact live view of the active session, shown in the sidebar and header on every page. */
export function MiniTimer({ variant }: { variant: "sidebar" | "header" }) {
  const session = useTimerStore((s) => s.session);
  const offsetMs = useTimerStore((s) => s.offsetMs);
  const busy = useTimerStore((s) => s.busy);
  const pause = useTimerStore((s) => s.pause);
  const resume = useTimerStore((s) => s.resume);
  const now = useNow(500, !!session);

  if (!session) return null;
  const remaining = remainingSeconds(session, offsetMs, now);
  const paused = session.status === "paused";
  const toggle = paused ? resume : pause;

  if (variant === "header") {
    return (
      <Link
        to="/timer"
        className="mr-1 flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-sm shadow-xs transition-colors hover:bg-accent lg:hidden"
      >
        <span className={cn("size-2 rounded-full", paused ? "bg-muted-foreground" : "animate-pulse bg-primary")} />
        <span className="tabular font-semibold">{formatClock(remaining)}</span>
      </Link>
    );
  }

  return (
    <div className="mt-4 rounded-xl border bg-card p-3 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <Link to="/timer" className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">
            {SESSION_TYPE_LABEL[session.session_type]} {paused && "· Paused"}
          </p>
          <p className="tabular text-xl font-semibold">{formatClock(remaining)}</p>
          {session.task && <p className="truncate text-xs text-muted-foreground">{session.task.title}</p>}
        </Link>
        <Button size="icon" variant="secondary" disabled={busy} onClick={() => void toggle()} aria-label={paused ? "Resume" : "Pause"}>
          {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
        </Button>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500 ease-linear"
          style={{ width: `${progressFraction(session, offsetMs, now) * 100}%` }}
        />
      </div>
    </div>
  );
}
