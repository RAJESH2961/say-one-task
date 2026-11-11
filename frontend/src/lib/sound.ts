/**
 * Notification sounds synthesised with the Web Audio API (no audio assets required).
 */
let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  return ctx;
}

/** Call from a user gesture (e.g. clicking Start) so browsers allow later playback. */
export function unlockAudio(): void {
  const ac = audioContext();
  if (ac && ac.state === "suspended") void ac.resume().catch(() => undefined);
}

function tone(ac: AudioContext, freq: number, start: number, duration: number, volume: number) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

export type ChimeKind = "focus_end" | "break_end" | "test";

export function playChime(kind: ChimeKind, volumePercent = 70): void {
  const ac = audioContext();
  if (!ac) return;
  try {
    if (ac.state === "suspended") void ac.resume();
    const v = Math.min(1, Math.max(0, volumePercent / 100)) * 0.35;
    const t = ac.currentTime + 0.01;
    const notes = kind === "break_end" ? [523.25, 659.25, 783.99, 1046.5] : [783.99, 659.25, 523.25];
    notes.forEach((f, i) => tone(ac, f, t + i * 0.18, 0.5, v));
  } catch {
    // Audio is best-effort; never break the timer because of it.
  }
}

export async function requestNotificationPermission(): Promise<void> {
  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch {
      /* ignored: unsupported */
    }
  }
}

export function showDesktopNotification(title: string, body: string): void {
  if (typeof Notification === "undefined" || Notification.permission !== "granted" || !document.hidden) return;
  try {
    new Notification(title, { body, icon: "/favicon.svg", tag: "focusflow-timer" });
  } catch {
    /* ignored */
  }
}
