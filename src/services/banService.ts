import { supabase } from '../lib/supabase';

/* ============================================================================
   FOMO — user bans (admin blocks a user from entering the app)

   `banned_until` on users drives it: null = fine, a future time = banned until then, a far-future
   sentinel = permanent. Admins set it from the dashboard; the app checks its own on login.
   ============================================================================ */

/** Sentinel far-future date used for a permanent ban. */
export const PERMANENT_BAN = '2999-12-31T00:00:00Z';

export type BanInfo = { until: string | null; reason: string | null };

/** Is this ban currently active? */
export function isBanned(info: BanInfo | null | undefined): boolean {
  if (!info?.until) return false;
  return new Date(info.until).getTime() > Date.now();
}

export function isPermanent(until: string | null | undefined): boolean {
  return !!until && new Date(until).getTime() > new Date('2900-01-01').getTime();
}

/** Admin: ban a user for `days` (or permanently when days is null). Logs to admin_actions. */
export async function banUser(adminId: string, targetId: string, days: number | null, reason: string): Promise<boolean> {
  const until = days == null ? PERMANENT_BAN : new Date(Date.now() + days * 864e5).toISOString();
  const { error } = await supabase.from('users')
    .update({ banned_until: until, banned_reason: reason || null }).eq('id', targetId);
  if (error) { console.error('[ban] banUser failed:', error); return false; }
  try {
    await supabase.rpc('log_admin_action', {
      p_action_type: 'ban_user', p_target_type: 'user', p_target_id: targetId,
      p_target_user_id: targetId, p_details: { until, reason },
    });
  } catch { /* audit log is best-effort */ }
  return true;
}

/** Admin: lift a ban. */
export async function unbanUser(adminId: string, targetId: string): Promise<boolean> {
  const { error } = await supabase.from('users')
    .update({ banned_until: null, banned_reason: null }).eq('id', targetId);
  if (error) { console.error('[ban] unbanUser failed:', error); return false; }
  try {
    await supabase.rpc('log_admin_action', {
      p_action_type: 'unban_user', p_target_type: 'user', p_target_id: targetId, p_target_user_id: targetId, p_details: {},
    });
  } catch { /* best-effort */ }
  return true;
}
