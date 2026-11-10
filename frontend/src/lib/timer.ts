import type { FocusSession } from "@/types/api";

/**
 * Timestamp-based countdown math. The server is the source of truth: these helpers only
 * project the server's timestamps onto the client's clock (corrected by `offsetMs`) for display.
 * No counter is ever decremented, so throttled background tabs, sleep or refreshes cannot drift.
 */

/** serverNow - clientNow at the moment a response was received. */
export function computeClockOffset(serverTime: string, receivedAt: number = Date.now()): number {
  return new Date(serverTime).getTime() - receivedAt;
}

export function elapsedSeconds(session: FocusSession, offsetMs: number, now: number = Date.now()): number {
  const started = new Date(session.started_at).getTime();
  const reference = session.ended_at
    ? new Date(session.ended_at).getTime()
    : session.paused_at
      ? new Date(session.paused_at).getTime()
      : now + offsetMs;
  return Math.max(0, (reference - started) / 1000 - session.total_paused_seconds);
}

export function remainingSeconds(session: FocusSession, offsetMs: number, now: number = Date.now()): number {
  return Math.max(0, session.planned_duration_seconds - elapsedSeconds(session, offsetMs, now));
}

export function progressFraction(session: FocusSession, offsetMs: number, now: number = Date.now()): number {
  if (!session.planned_duration_seconds) return 0;
  return Math.min(1, elapsedSeconds(session, offsetMs, now) / session.planned_duration_seconds);
}

export function isActive(session: FocusSession | null | undefined): session is FocusSession {
  return !!session && (session.status === "running" || session.status === "paused");
}
