import { supabase } from '../lib/supabase';

/**
 * Settings preferences (notifications / privacy) stored as JSONB on the user
 * row, with a localStorage mirror. Everything degrades gracefully:
 *  - Before the `add_user_preferences` migration is applied, the cloud calls
 *    fail and we transparently fall back to the local cache.
 *  - After it's applied, preferences sync across the user's devices.
 */

export type PrefColumn = 'notification_prefs' | 'privacy_prefs';
export type Prefs = Record<string, boolean>;

const lsKey = (column: PrefColumn, uid?: string | null) => `fomo:${column}:${uid || 'guest'}`;

/** Instant, synchronous read from the local cache (used to seed initial state). */
export function loadLocalPrefs(column: PrefColumn, uid: string | null | undefined, defaults: Prefs): Prefs {
  try {
    const raw = localStorage.getItem(lsKey(column, uid));
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch { /* ignore corrupt storage */ }
  return { ...defaults };
}

/** Fetch from the cloud. Returns null if unavailable (offline / column missing). */
export async function loadCloudPrefs(column: PrefColumn, uid: string | null | undefined, defaults: Prefs): Promise<Prefs | null> {
  if (!uid) return null;
  try {
    const { data, error } = await supabase.from('users').select(column).eq('id', uid).maybeSingle();
    if (error || !data) return null;
    const val = (data as Record<string, unknown>)[column];
    return val && typeof val === 'object' ? { ...defaults, ...(val as Prefs) } : { ...defaults };
  } catch {
    return null;
  }
}

/** Persist to local cache (always) and to the cloud (best-effort). */
export async function savePrefs(column: PrefColumn, uid: string | null | undefined, prefs: Prefs): Promise<void> {
  try { localStorage.setItem(lsKey(column, uid), JSON.stringify(prefs)); } catch { /* ignore */ }
  if (!uid) return;
  try {
    const { error } = await supabase.from('users').update({ [column]: prefs }).eq('id', uid);
    if (error) console.warn(`Cloud save (${column}) failed, kept local only:`, error.message);
  } catch (err) {
    console.warn(`Cloud save (${column}) threw, kept local only:`, err);
  }
}
