// Sharing something (a place, an event) into the app's own chats.
//
// There are two chat systems and they store a message differently:
//   groups — group_channels + group_members + group_messages (denormalised sender name/avatar)
//   DMs    — conversations + messages (sender_id only)
// This module is the one place that knows about both.
import { supabase } from '../lib/supabase';
import { COUNTRIES } from '../utils/countries';

export interface ShareTarget {
  kind: 'group' | 'dm';
  id: string;                 // channel_id for a group, conversation_id for a DM
  name: string;
  sub?: string;               // groups: the country, so two "תל אביב"s are still tellable apart
  avatarUrl?: string | null;  // DMs only
  emoji?: string | null;      // groups only — the city emoji
}

/** Every chat this user can post into: their approved city groups, then their DMs (recent first). */
export async function loadShareTargets(userId: string): Promise<ShareTarget[]> {
  const [groups, dms] = await Promise.all([
    loadGroupTargets(userId),
    loadDmTargets(userId),
  ]);
  return [...groups, ...dms];
}

async function loadGroupTargets(userId: string): Promise<ShareTarget[]> {
  // The readable city lives in `city_name`. (`city_slug` looks like it should hold it, but legacy
  // code writes the EMOJI into it — reading that is what left these rows nameless.)
  // Only approved memberships: a pending or left member can't post, so offering it would just fail.
  const { data, error } = await supabase
    .from('group_members')
    .select('channel_id, group_channels(id, city_name, city_emoji, country_code)')
    .eq('user_id', userId)
    .eq('status', 'approved');

  if (error) { console.error('loadGroupTargets:', error.message); return []; }

  // Groups the user left are only recorded client-side, so honour that list here too.
  let left: Set<string>;
  try { left = new Set(JSON.parse(localStorage.getItem('left_group_channels') || '[]')); } catch { left = new Set(); }

  return (data ?? [])
    .map((r: any) => r.group_channels)
    .filter((c: any) => c && !left.has(c.id))
    .map((c: any) => {
      const country = COUNTRIES[c.country_code as string];
      return {
        kind: 'group' as const,
        id: c.id,
        name: c.city_name || country?.name || 'קבוצה',
        sub: country ? `${country.flag} ${country.name}` : undefined,
        emoji: c.city_emoji ?? null,
      };
    });
}

async function loadDmTargets(userId: string): Promise<ShareTarget[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, participant_1_id, participant_2_id, last_message_at')
    .or(`participant_1_id.eq.${userId},participant_2_id.eq.${userId}`)
    .order('last_message_at', { ascending: false });

  if (error) { console.error('loadDmTargets:', error.message); return []; }
  const convos = data ?? [];
  if (convos.length === 0) return [];

  const otherIds = convos.map(c => (c.participant_1_id === userId ? c.participant_2_id : c.participant_1_id));
  const { data: people } = await supabase
    .from('users')
    .select('id, display_name, avatar_url')
    .in('id', otherIds);

  const byId = new Map((people ?? []).map((u: any) => [u.id, u]));

  return convos.map(c => {
    const otherId = c.participant_1_id === userId ? c.participant_2_id : c.participant_1_id;
    const u = byId.get(otherId);
    return {
      kind: 'dm' as const,
      id: c.id,
      name: u?.display_name || 'מטייל',
      avatarUrl: u?.avatar_url ?? null,
    };
  });
}

/** Post `text` into each chat. Returns how many landed — partial success is still success. */
export async function sendToTargets(
  sender: { id: string; name: string; avatarUrl?: string | null },
  targets: ShareTarget[],
  text: string,
): Promise<{ sent: number; failed: number }> {
  let sent = 0, failed = 0;

  await Promise.all(targets.map(async (t) => {
    if (t.kind === 'group') {
      const { error } = await supabase.from('group_messages').insert({
        channel_id: t.id,
        user_id: sender.id,
        display_name: sender.name,
        avatar_url: sender.avatarUrl ?? null,
        content: text,
        type: 'text',
      });
      if (error) { console.error('share → group:', error.message); failed++; } else { sent++; }
    } else {
      const { error } = await supabase.from('messages').insert({
        conversation_id: t.id,
        sender_id: sender.id,
        content: text,
        is_read: false,
      });
      if (error) { console.error('share → dm:', error.message); failed++; return; }
      sent++;
      // keep the conversation at the top of their inbox
      await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', t.id);
    }
  }));

  return { sent, failed };
}
