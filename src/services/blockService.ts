import { supabase } from '../lib/supabase';
import { loadValue, saveValue } from '../utils/warmCache';

/* ============================================================================
   FOMO — block + report service (private chats)

   Blocking is one-directional (I block them). We keep a persisted, per-viewer set of the ids I've
   blocked so the messages list can filter instantly on open, then refresh from the DB in the
   background. Reporting a user files a row in message_reports (admins review it).
   ============================================================================ */

const cacheName = (userId: string) => `blockedIds:${userId}`;

/** Ids the current user has blocked — read instantly from cache, refreshed from the DB. */
export function getBlockedIdsCached(userId: string): Set<string> {
  return new Set(loadValue<string[]>(cacheName(userId), []));
}

/** Pull the fresh blocked-id list from the DB and persist it. Returns the set. */
export async function refreshBlockedIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('blocked_users').select('blocked_id').eq('blocker_id', userId);
  if (error) { console.error('[block] refresh failed:', error); return getBlockedIdsCached(userId); }
  const ids = (data || []).map((r) => r.blocked_id as string);
  saveValue(cacheName(userId), ids);
  return new Set(ids);
}

/** Block a user. Optimistically updates the cache so the list hides them immediately. */
export async function blockUser(userId: string, blockedId: string): Promise<boolean> {
  const next = getBlockedIdsCached(userId);
  next.add(blockedId);
  saveValue(cacheName(userId), [...next]);
  const { error } = await supabase.from('blocked_users').insert({ blocker_id: userId, blocked_id: blockedId });
  if (error && error.code !== '23505') { // 23505 = already blocked (fine)
    console.error('[block] blockUser failed:', error);
    return false;
  }
  return true;
}

/** Unblock a user. */
export async function unblockUser(userId: string, blockedId: string): Promise<boolean> {
  const next = getBlockedIdsCached(userId);
  next.delete(blockedId);
  saveValue(cacheName(userId), [...next]);
  const { error } = await supabase.from('blocked_users')
    .delete().eq('blocker_id', userId).eq('blocked_id', blockedId);
  if (error) { console.error('[block] unblockUser failed:', error); return false; }
  return true;
}

/** File a report against a user (from a private chat). Visible to admins only. */
export async function reportUser(reporterId: string, reportedUserId: string, reason?: string): Promise<boolean> {
  const { error } = await supabase.from('message_reports').insert({
    reporter_id: reporterId,
    reported_user_id: reportedUserId,
    reason: reason || 'דיווח על משתמש (צ׳אט פרטי)',
    status: 'open',
  });
  if (error) { console.error('[block] reportUser failed:', error); return false; }
  return true;
}
