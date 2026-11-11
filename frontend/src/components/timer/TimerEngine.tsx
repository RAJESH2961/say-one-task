import { useEffect } from "react";
import { formatClock, SESSION_TYPE_LABEL } from "@/lib/format";
import { remainingSeconds } from "@/lib/timer";
import { subscribeToTimerChanges, useTimerStore } from "@/stores/timer";

const BASE_TITLE = "FocusFlow";
const POLL_MS = 30_000;

/**
 * Headless component mounted once in the app shell. It keeps the timer synchronised with the
 * server (on load, on tab focus, on cross-tab broadcasts and periodically), auto-completes
 * sessions when their countdown reaches zero and mirrors the countdown in the document title.
 */
export function TimerEngine() {
  const sync = useTimerStore((s) => s.sync);

  useEffect(() => {
    void sync();
    const onVisible = () => {
      if (document.visibilityState === "visible") void sync();
    };
    const onOnline = () => void sync();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    const unsubscribe = subscribeToTimerChanges(() => void sync());
    const poll = window.setInterval(() => void sync(), POLL_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      unsubscribe();
      window.clearInterval(poll);
    };
  }, [sync]);

  useEffect(() => {
    const tick = () => {
      const { session, offsetMs, completeIfDue } = useTimerStore.getState();
      if (!session) {
        document.title = BASE_TITLE;
        return;
      }
      const remaining = remainingSeconds(session, offsetMs);
      const prefix = session.status === "paused" ? "⏸ " : "";
      document.title = `${prefix}${formatClock(remaining)} · ${SESSION_TYPE_LABEL[session.session_type]} — ${BASE_TITLE}`;
      if (session.status === "running" && remaining <= 0) void completeIfDue();
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => {
      window.clearInterval(id);
      document.title = BASE_TITLE;
    };
  }, []);

  return null;
}
