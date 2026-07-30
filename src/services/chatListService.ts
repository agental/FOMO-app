/*
  Shared chat-list loader — used by BOTH the Messages screen and the boot preloader, so the list
  can be warmed in the background at launch and painted instantly when the user opens Messages.

  One RPC (get_chat_list) returns conversations + city groups in a single round-trip; if the
  migration hasn't been run the code falls back to the previous per-row queries. Pure data only —
  no React state and no side effects except the optional duplicate-membership cleanup, which the
  caller triggers with the returned `dupChannelIds` (the preloader ignores it; the screen acts on it).
*/

import { supabase } from '../lib/supabase';
import { COUNTRIES } from '../utils/countries';
import { messagePreview } from '../utils/eventMessage';
import { loadValue, saveValue } from '../utils/warmCache';

export type Conversation = {
  id: string;
  participant_1_id: string;
  participant_2_id: string;
  last_message_at: string;
  other_user: { id: string; display_name: string; avatar_url: string | null };
  last_message: { content: string; sender_id: string } | null;
  unread_count: number;
};

export type GroupChat = {
  channelId: string;
  countryCode: string;
  countryFlag: string;
  cityName: string;
  cityEmoji: string;
  memberCount: number;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  memberStatus: 'approved' | 'pending';
};

type RpcGroupRow = {
  channel_id: string;
  country_code: string;
  city_name: string;
  city_emoji: string;
  last_seen_at: string | null;
  status: string | null;
  member_count: number;
  unread_count: number;
  last_message: { content: string; type: string; created_at: string; display_name: string } | null;
};

export type ChatList = { conversations: Conversation[]; groups: GroupChat[]; dupChannelIds: string[] };

// Shared IN-MEMORY cache. This is the key to the phone working: the boot preloader fills it and
// MessagesScreen reads it at mount from the SAME module instance — no localStorage round-trip, which
// is unreliable in the Expo WebView across reloads. It's hydrated from localStorage on first load
// (instant cross-session on the desktop web) and mirrored back on every fetch.
export const chatListCache: { conversations: Conversation[]; groups: GroupChat[] } = {
  conversations: loadValue<Conversation[]>('msgConversations', []),
  groups: loadValue<GroupChat[]>('msgGroups', []),
};

function commit(conversations: Conversation[], groups: GroupChat[], dupChannelIds: string[]): ChatList {
  chatListCache.conversations = conversations;
  chatListCache.groups = groups;
  saveValue('msgConversations', conversations.slice(0, 50));
  saveValue('msgGroups', groups.slice(0, 20));
  return { conversations, groups, dupChannelIds };
}

// Once the RPC is confirmed missing, skip it for the session and use the per-row fallback.
let _rpcOk = true;

function leftGroups(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem('left_group_channels') || '[]')); }
  catch { return new Set(); }
}

// Dedupe same-city channels: keep the busiest, mark the losers for membership cleanup, sort by recency.
function dedupeGroups(results: GroupChat[]): { groups: GroupChat[]; dupChannelIds: string[] } {
  const seen = new Map<string, GroupChat>();
  const dupChannelIds: string[] = [];
  for (const gc of results) {
    const key = `${gc.countryCode}:${gc.cityEmoji}`;
    const existing = seen.get(key);
    if (!existing) { seen.set(key, gc); continue; }
    const keepNew = (gc.unreadCount + (gc.lastMessageAt ? 1 : 0)) >
                    (existing.unreadCount + (existing.lastMessageAt ? 1 : 0));
    if (keepNew) { dupChannelIds.push(existing.channelId); seen.set(key, gc); }
    else { dupChannelIds.push(gc.channelId); }
  }
  const groups = [...seen.values()].sort((a, b) =>
    (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''));
  return { groups, dupChannelIds };
}

async function conversationsFallback(userId: string): Promise<Conversation[]> {
  const { data: convos, error } = await supabase
    .from('conversations')
    .select('*')
    .or(`participant_1_id.eq.${userId},participant_2_id.eq.${userId}`)
    .order('last_message_at', { ascending: false });
  if (error || !convos || convos.length === 0) return [];
  return Promise.all(convos.map(async (convo) => {
    const otherUserId = convo.participant_1_id === userId ? convo.participant_2_id : convo.participant_1_id;
    const [userResult, lastMessageResult, unreadResult] = await Promise.all([
      supabase.from('users').select('id, display_name, avatar_url').eq('id', otherUserId).maybeSingle(),
      supabase.from('messages').select('content, sender_id').eq('conversation_id', convo.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('messages').select('id', { count: 'exact', head: true }).eq('conversation_id', convo.id).eq('is_read', false).neq('sender_id', userId),
    ]);
    return {
      id: convo.id,
      participant_1_id: convo.participant_1_id,
      participant_2_id: convo.participant_2_id,
      last_message_at: convo.last_message_at,
      other_user: userResult.data || { id: otherUserId, display_name: 'משתמש', avatar_url: null },
      last_message: lastMessageResult.data,
      unread_count: unreadResult.count || 0,
    } as Conversation;
  }));
}

async function groupsFallback(userId: string, left: Set<string>): Promise<GroupChat[]> {
  const { data: membershipsRaw } = await supabase
    .from('group_members').select('channel_id, last_seen_at, status').eq('user_id', userId);
  const memberships = (membershipsRaw ?? []).filter(m => m.status !== 'left' && !left.has(m.channel_id));
  if (!memberships.length) return [];
  const channelIds = memberships.map(m => m.channel_id);
  const { data: channels } = await supabase.from('group_channels').select('*').in('id', channelIds);
  if (!channels) return [];
  return Promise.all(channels.map(async (ch: Record<string, unknown>) => {
    const membership = memberships.find(m => m.channel_id === ch.id);
    const lastSeen = membership?.last_seen_at ?? '1970-01-01';
    const mStatus = (membership?.status ?? 'approved') as 'approved' | 'pending';
    const country = COUNTRIES[ch.country_code as string];
    const [lastMsgRes, unreadRes, memCountRes] = await Promise.all([
      supabase.from('group_messages').select('content,type,created_at,display_name').eq('channel_id', ch.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('group_messages').select('id', { count: 'exact', head: true }).eq('channel_id', ch.id as string).neq('user_id', userId).gt('created_at', lastSeen),
      supabase.from('group_members').select('*', { count: 'exact', head: true }).eq('channel_id', ch.id).eq('status', 'approved'),
    ]);
    const lastMsg = lastMsgRes.data;
    return {
      channelId: ch.id as string,
      countryCode: ch.country_code as string,
      countryFlag: country?.flag ?? '🌍',
      cityName: ch.city_name as string,
      cityEmoji: ch.city_emoji as string,
      memberCount: memCountRes.count ?? 0,
      lastMessage: lastMsg ? `${lastMsg.display_name}: ${messagePreview(lastMsg.content, lastMsg.type)}` : null,
      lastMessageAt: lastMsg?.created_at ?? null,
      unreadCount: unreadRes.count ?? 0,
      memberStatus: mStatus,
    } as GroupChat;
  }));
}

/** Load the whole chat list in one call (RPC), falling back to per-row queries if the RPC is absent. */
export async function fetchChatList(userId: string): Promise<ChatList> {
  const left = leftGroups();

  if (_rpcOk) {
    try {
      const { data, error } = await supabase.rpc('get_chat_list', { p_user: userId });
      if (error) throw error;
      const payload = data as { conversations: Conversation[]; groups: RpcGroupRow[] } | null;
      const conversations = payload?.conversations ?? [];
      const mapped: GroupChat[] = (payload?.groups ?? [])
        .filter(g => !left.has(g.channel_id))
        .map(g => {
          const lm = g.last_message;
          return {
            channelId: g.channel_id,
            countryCode: g.country_code,
            countryFlag: COUNTRIES[g.country_code]?.flag ?? '🌍',
            cityName: g.city_name,
            cityEmoji: g.city_emoji,
            memberCount: g.member_count ?? 0,
            lastMessage: lm ? `${lm.display_name}: ${messagePreview(lm.content, lm.type)}` : null,
            lastMessageAt: lm?.created_at ?? null,
            unreadCount: g.unread_count ?? 0,
            memberStatus: (g.status === 'pending' ? 'pending' : 'approved') as 'approved' | 'pending',
          };
        });
      const { groups, dupChannelIds } = dedupeGroups(mapped);
      return commit(conversations, groups, dupChannelIds);
    } catch (e) {
      _rpcOk = false;
      console.warn('[chatListService] get_chat_list RPC unavailable, using fallback:', e);
    }
  }

  const [conversations, groupsRaw] = await Promise.all([
    conversationsFallback(userId),
    groupsFallback(userId, left),
  ]);
  const { groups, dupChannelIds } = dedupeGroups(groupsRaw);
  return commit(conversations, groups, dupChannelIds);
}

/** Fire-and-forget cleanup of duplicate memberships flagged by dedupe. */
export function cleanupDuplicateGroups(userId: string, dupChannelIds: string[]): void {
  dupChannelIds.forEach(id =>
    supabase.from('group_members').delete().eq('channel_id', id).eq('user_id', userId));
}
