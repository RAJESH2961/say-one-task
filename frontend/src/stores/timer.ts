import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toast } from "sonner";
import { ApiError, toApiError } from "@/lib/api";
import { playChime, showDesktopNotification } from "@/lib/sound";
import { computeClockOffset, isActive, remainingSeconds } from "@/lib/timer";
import { SESSION_TYPE_LABEL } from "@/lib/format";
import { sessionsApi } from "@/services";
import { useSettingsStore } from "@/stores/settings";
import type { FocusSession, SessionFinishResponse, SessionReflection, SessionType, TimerCycle } from "@/types/api";

/**
 * Client-side view of the server-owned timer.
 *
 * - The active session (timestamps) always comes from the backend; the countdown is derived
 *   from those timestamps + a server clock offset, so refreshes and sleeping tabs never drift.
 * - Tabs coordinate via BroadcastChannel (state changes) and the Web Locks API (only one tab
 *   submits the completion). The backend still rejects duplicates with 409 as the final guard.
 */

const CHANNEL_NAME = "focusflow-timer";
type ChannelMessage = { type: "changed"; origin: string };
const TAB_ID = Math.random().toString(36).slice(2);
let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  channel ??= new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

export function broadcastChange() {
  getChannel()?.postMessage({ type: "changed", origin: TAB_ID } satisfies ChannelMessage);
}

export function subscribeToTimerChanges(cb: () => void): () => void {
  const ch = getChannel();
  if (!ch) return () => undefined;
  const handler = (e: MessageEvent<ChannelMessage>) => {
    if (e.data?.type === "changed" && e.data.origin !== TAB_ID) cb();
  };
  ch.addEventListener("message", handler);
  return () => ch.removeEventListener("message", handler);
}

async function withCompletionLock(sessionId: number, fn: () => Promise<void>): Promise<boolean> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks?.request) {
    await fn();
    return true;
  }
  return locks.request(`focusflow-complete-${sessionId}`, { ifAvailable: true }, async (lock) => {
    if (!lock) return false; // another tab is completing this session
    await fn();
    return true;
  });
}

interface TimerState {
  session: FocusSession | null;
  cycle: TimerCycle | null;
  offsetMs: number;
  initialized: boolean;
  busy: boolean;
  error: string | null;
  selectedType: SessionType;
  selectedTypeTouched: boolean;
  selectedTaskId: number | null;
  completion: SessionFinishResponse | null;
  completingId: number | null;
  retryAt: number;

  sync: () => Promise<void>;
  start: (type?: SessionType, taskId?: number | null) => Promise<boolean>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  interrupt: (reflection?: SessionReflection) => Promise<SessionFinishResponse | null>;
  completeIfDue: () => Promise<void>;
  setSelectedType: (type: SessionType) => void;
  setSelectedTask: (taskId: number | null) => void;
  dismissCompletion: () => void;
  reset: () => void;
}

function applySession(session: FocusSession | null, serverTime?: string) {
  const patch: Partial<TimerState> = { session };
  if (serverTime) patch.offsetMs = computeClockOffset(serverTime);
  return patch;
}

function notifyError(err: ApiError) {
  toast.error(err.message, { description: err.requestId ? `Request ID: ${err.requestId}` : undefined });
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      session: null,
      cycle: null,
      offsetMs: 0,
      initialized: false,
      busy: false,
      error: null,
      selectedType: "focus",
      selectedTypeTouched: false,
      selectedTaskId: null,
      completion: null,
      completingId: null,
      retryAt: 0,

      sync: async () => {
        try {
          const res = await sessionsApi.active();
          const touched = get().selectedTypeTouched;
          set({
            ...applySession(res.session, res.server_time),
            cycle: res.cycle,
            initialized: true,
            error: null,
            ...(touched || res.session ? {} : { selectedType: res.cycle.next_session_type }),
            ...(res.session ? { selectedType: res.session.session_type } : {}),
          });
        } catch (err) {
          const apiErr = toApiError(err);
          set({ initialized: true, error: apiErr.message });
        }
      },

      start: async (type, taskId) => {
        const sessionType = type ?? get().selectedType;
        const task = sessionType === "focus" ? (taskId !== undefined ? taskId : get().selectedTaskId) : null;
        set({ busy: true });
        try {
          const session = await sessionsApi.start({ session_type: sessionType, task_id: task ?? undefined });
          set({ ...applySession(session, session.server_time), selectedType: sessionType, selectedTypeTouched: false });
          broadcastChange();
          return true;
        } catch (err) {
          const apiErr = toApiError(err);
          if (apiErr.code === "active_session_exists") {
            toast.info("A session is already running (perhaps in another tab). Synced.");
            await get().sync();
          } else {
            notifyError(apiErr);
          }
          return false;
        } finally {
          set({ busy: false });
        }
      },

      pause: async () => {
        const s = get().session;
        if (!s) return;
        set({ busy: true });
        try {
          const session = await sessionsApi.pause(s.id);
          set(applySession(session, session.server_time));
          broadcastChange();
        } catch (err) {
          const apiErr = toApiError(err);
          if (apiErr.code === "session_elapsed") await get().completeIfDue();
          else {
            notifyError(apiErr);
            await get().sync();
          }
        } finally {
          set({ busy: false });
        }
      },

      resume: async () => {
        const s = get().session;
        if (!s) return;
        set({ busy: true });
        try {
          const session = await sessionsApi.resume(s.id);
          set(applySession(session, session.server_time));
          broadcastChange();
        } catch (err) {
          notifyError(toApiError(err));
          await get().sync();
        } finally {
          set({ busy: false });
        }
      },

      interrupt: async (reflection) => {
        const s = get().session;
        if (!s) return null;
        set({ busy: true });
        try {
          const res = await sessionsApi.interrupt(s.id, reflection);
          set({ session: null, cycle: res.cycle, selectedType: s.session_type, selectedTypeTouched: true });
          broadcastChange();
          return res;
        } catch (err) {
          notifyError(toApiError(err));
          await get().sync();
          return null;
        } finally {
          set({ busy: false });
        }
      },

      completeIfDue: async () => {
        const { session, offsetMs, completingId, retryAt } = get();
        if (!session || session.status !== "running" || completingId === session.id || Date.now() < retryAt) return;
        if (remainingSeconds(session, offsetMs) > 0) return;

        set({ completingId: session.id });
        try {
          const handled = await withCompletionLock(session.id, async () => {
            const res = await sessionsApi.complete(session.id);
            set({ session: null, cycle: res.cycle, completion: res, selectedType: res.cycle.next_session_type, selectedTypeTouched: false });
            broadcastChange();
            onCompleted(res);
          });
          if (!handled) setTimeout(() => void get().sync(), 1500);
        } catch (err) {
          const apiErr = toApiError(err);
          if (apiErr.status === 409 || apiErr.status === 404) {
            // Completed/changed elsewhere (another tab or device) - just resync.
            await get().sync();
          } else {
            set({ retryAt: Date.now() + 5000 });
            if (apiErr.status === 0) toast.error("Offline: will record the session when the connection returns.");
            else notifyError(apiErr);
          }
        } finally {
          set({ completingId: null });
        }
      },

      setSelectedType: (type) => set({ selectedType: type, selectedTypeTouched: true }),
      setSelectedTask: (taskId) => set({ selectedTaskId: taskId }),
      dismissCompletion: () => set({ completion: null }),
      reset: () =>
        set({ session: null, cycle: null, initialized: false, completion: null, selectedTaskId: null, error: null }),
    }),
    // Only a UI preference is cached locally; the timer itself lives on the server.
    { name: "focusflow-timer-ui", partialize: (s) => ({ selectedTaskId: s.selectedTaskId }) },
  ),
);

function onCompleted(res: SessionFinishResponse) {
  const settings = useSettingsStore.getState().settings;
  const wasFocus = res.session.session_type === "focus";
  if (settings?.sound_enabled ?? true) playChime(wasFocus ? "focus_end" : "break_end", settings?.sound_volume ?? 70);
  const next = SESSION_TYPE_LABEL[res.cycle.next_session_type];
  showDesktopNotification(
    wasFocus ? "Focus session complete" : "Break is over",
    wasFocus ? `Nice work! Time for a ${next.toLowerCase()}.` : "Ready to focus again?",
  );

  const nextIsBreak = res.cycle.next_session_type !== "focus";
  if (settings && ((nextIsBreak && settings.auto_start_breaks) || (!nextIsBreak && settings.auto_start_focus))) {
    void useTimerStore.getState().start(res.cycle.next_session_type);
  }
}

export const selectIsActive = (s: TimerState) => isActive(s.session);
