/**
 * Tracks when the user last opened the notifications center, so we can mark
 * decision notifications (approved / rejected on their own join requests) as
 * "new" and drive the bell badge. Stored per-user in localStorage.
 */
const key = (userId?: string | null) => `fomo_notif_seen_${userId || 'anon'}`;

export function getNotifLastSeen(userId?: string | null): number {
  try {
    const v = localStorage.getItem(key(userId));
    return v ? Number(v) : 0;
  } catch {
    return 0;
  }
}

export function setNotifLastSeen(userId?: string | null, ts: number = Date.now()): void {
  try {
    localStorage.setItem(key(userId), String(ts));
  } catch {
    /* localStorage unavailable — badge just won't persist "seen" state */
  }
}
