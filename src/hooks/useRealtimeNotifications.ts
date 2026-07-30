import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { showToast } from '../utils/toast';
import { nativeNotify } from '../utils/nativeNotify';
import { flagEmoji } from '../utils/flags';
import { getActiveChat } from '../utils/activeChat';
import { cacheIncomingDirectMessage } from '../components/ChatScreen';
import { cacheIncomingGroupMessage } from '../components/CityGroupChat';

/*
  Global realtime notifications — subscribed once (in App) for the logged-in user, so a
  notification reaches the user IMMEDIATELY on any screen:
    - event request approved / rejected, or a new request for an event I organize
    - a new DIRECT message (someone messages me)
    - a new GROUP message (in a group I'm a member of)

  Delivery: on the native app it fires a real system notification (banner + sound +
  vibration) via the wrapper bridge; on plain web it shows the in-app toast. Messages
  in the chat I'm currently viewing are skipped (see utils/activeChat).
*/

const MSG_BG = 'linear-gradient(135deg,#3B82F6,#2563EB)';

/** Chats the user muted from the messages list (swipe → mute). */
function isMuted(storageKey: 'muted_convos' | 'muted_groups', id: string): boolean {
  try { return (JSON.parse(localStorage.getItem(storageKey) || '[]') as string[]).includes(id); }
  catch { return false; }
}

function preview(content: string | null | undefined, type?: string | null): string {
  if (type === 'image') return '📷 תמונה';
  if (type === 'location') return '📍 מיקום';
  const t = (content || '').trim();
  return t.length > 60 ? t.slice(0, 60) + '…' : t || 'הודעה חדשה';
}

export function useRealtimeNotifications(
  currentUserId: string | null,
  onOpenRequests: () => void,
  onOpenMessages: () => void,
) {
  const reqRef = useRef(onOpenRequests);   reqRef.current = onOpenRequests;
  const msgRef = useRef(onOpenMessages);   msgRef.current = onOpenMessages;

  const myEventIds = useRef<Set<string>>(new Set());
  const myConversations = useRef<Set<string>>(new Set());
  const myChannels = useRef<Map<string, string>>(new Map()); // channelId → group title (flag + city emoji + name)
  const senderNames = useRef<Map<string, string>>(new Map()); // userId → display name

  useEffect(() => {
    if (!currentUserId) return;
    let cancelled = false;

    const loadSets = async () => {
      const [events, convos, members] = await Promise.all([
        supabase.from('events').select('id').eq('user_id', currentUserId),
        supabase.from('conversations').select('id').or(`participant_1_id.eq.${currentUserId},participant_2_id.eq.${currentUserId}`),
        supabase.from('group_members').select('channel_id, status').eq('user_id', currentUserId),
      ]);
      if (cancelled) return;
      myEventIds.current = new Set((events.data || []).map((e) => e.id as string));
      myConversations.current = new Set((convos.data || []).map((c) => c.id as string));
      const chIds = (members.data || []).filter((m) => m.status !== 'left').map((m) => m.channel_id as string);
      if (chIds.length) {
        const { data: channels } = await supabase.from('group_channels').select('id, city_name, city_emoji, country_code').in('id', chIds);
        if (!cancelled) myChannels.current = new Map((channels || []).map((c) => {
          // Notification title = country flag + the group's own emoji + city name, e.g. "🇹🇭 🏝️ קו פנגן".
          const title = [flagEmoji((c.country_code as string) || ''), (c.city_emoji as string) || '', (c.city_name as string) || '']
            .map((s) => s.trim()).filter(Boolean).join(' ');
          return [c.id as string, title || 'קבוצה'];
        }));
      } else {
        myChannels.current = new Map();
      }
    };
    loadSets();
    // Pick up new chats/groups when the user returns to the app.
    const onVis = () => { if (document.visibilityState === 'visible') loadSets(); };
    document.addEventListener('visibilitychange', onVis);

    // Native → system banner + sound + vibration; web → in-app toast.
    const deliver = (title: string, body: string, opts: { emoji?: string; background?: string; onClick: () => void }) => {
      if (nativeNotify(title, body)) return;
      showToast({ title, text: body, emoji: opts.emoji, background: opts.background, onClick: opts.onClick });
    };

    const nameFor = async (userId: string): Promise<string> => {
      const cached = senderNames.current.get(userId);
      if (cached) return cached;
      const { data } = await supabase.from('users').select('display_name').eq('id', userId).maybeSingle();
      const name = data?.display_name || 'מישהו';
      senderNames.current.set(userId, name);
      return name;
    };

    const channel = supabase
      .channel(`global-notifs-${currentUserId}`)
      // ── event request approved / rejected (I'm the buyer) ──
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'event_join_requests', filter: `user_id=eq.${currentUserId}` }, (payload) => {
        const row = payload.new as { status?: string; paid_amount?: number | null };
        if (row.status === 'approved') {
          deliver('FOMO', 'הבקשה שלך אושרה! 🎉', { emoji: '✅', background: 'linear-gradient(135deg,#22c55e,#16a34a)', onClick: () => reqRef.current() });
        } else if (row.status === 'rejected') {
          deliver('FOMO', row.paid_amount ? 'הבקשה נדחתה — התשלום הוחזר' : 'הבקשה נדחתה על ידי המארגן', { emoji: '↩️', background: 'linear-gradient(135deg,#ef4444,#dc2626)', onClick: () => reqRef.current() });
        }
      })
      // ── new request for an event I organize ──
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event_join_requests' }, (payload) => {
        const row = payload.new as { user_id?: string; event_id?: string };
        if (!row.event_id || row.user_id === currentUserId) return;
        if (!myEventIds.current.has(row.event_id)) return;
        deliver('FOMO', 'בקשה חדשה להצטרף לאירוע שלך', { emoji: '🎟️', background: 'linear-gradient(135deg,#F97316,#EA580C)', onClick: () => reqRef.current() });
      })
      // ── new direct message ──
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const row = payload.new as { conversation_id?: string; sender_id?: string; content?: string };
        if (!row.conversation_id || row.sender_id === currentUserId) return;
        if (!myConversations.current.has(row.conversation_id)) return;
        // Background-sync into the chat cache so opening the chat later shows it instantly (WhatsApp-style).
        cacheIncomingDirectMessage(payload.new as Parameters<typeof cacheIncomingDirectMessage>[0], currentUserId);
        if (getActiveChat() === row.conversation_id) return; // already viewing this chat
        if (isMuted('muted_convos', row.conversation_id)) return; // muted from the list
        const name = await nameFor(row.sender_id || '');
        deliver(name, preview(row.content), { emoji: '💬', background: MSG_BG, onClick: () => msgRef.current() });
      })
      // ── new group message ──
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages' }, (payload) => {
        const row = payload.new as { channel_id?: string; user_id?: string; display_name?: string; content?: string; type?: string };
        if (!row.channel_id || row.user_id === currentUserId || row.type === 'system') return;
        if (!myChannels.current.has(row.channel_id)) return;
        // Background-sync into the group cache so opening the chat later shows it instantly.
        // Scoped to this viewer so another account on the same device can't read it.
        cacheIncomingGroupMessage(payload.new as Parameters<typeof cacheIncomingGroupMessage>[0], currentUserId);
        if (getActiveChat() === row.channel_id) return;
        if (isMuted('muted_groups', row.channel_id)) return; // muted from the list
        const groupName = myChannels.current.get(row.channel_id) || 'קבוצה';
        deliver(groupName, `${row.display_name || 'מישהו'}: ${preview(row.content, row.type)}`, { emoji: '💬', background: MSG_BG, onClick: () => msgRef.current() });
      })
      .subscribe();

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);
}
