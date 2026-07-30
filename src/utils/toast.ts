/*
  Tiny global toast bus — decouples "something happened" (anywhere in the app, e.g. a
  realtime notification) from the UI that shows it (<ToastHost/>, mounted once at the root).
  Call showToast(...) from anywhere; ToastHost renders it immediately.
*/

export type ToastItem = {
  id: number;
  text: string;
  /** Bold heading line (defaults to "FOMO"). */
  title?: string;
  emoji?: string;
  /** CSS background (solid or gradient) for the icon tile. */
  background?: string;
  onClick?: () => void;
};

type Listener = (t: ToastItem) => void;
const listeners = new Set<Listener>();

export function showToast(t: Omit<ToastItem, 'id'>) {
  const item: ToastItem = { ...t, id: Date.now() + Math.random() };
  listeners.forEach((l) => l(item));
}

export function subscribeToast(l: Listener) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** A short two-note "ding" via Web Audio (web/PWA only; the native app plays its own sound). */
export function playChime() {
  try {
    const Ctx = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext });
    const AC = Ctx.AudioContext || Ctx.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const now = ctx.currentTime;
    ([[880, 0], [1174.66, 0.11]] as [number, number][]).forEach(([freq, at]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain); gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(0.18, now + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.28);
      osc.start(now + at); osc.stop(now + at + 0.3);
    });
    setTimeout(() => ctx.close().catch(() => {}), 900);
  } catch {
    /* ignore — audio may be blocked until a user gesture */
  }
}
