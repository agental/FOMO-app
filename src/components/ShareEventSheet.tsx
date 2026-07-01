import { useEffect, useState } from 'react';
import { Search, Check, Send, Share2 } from 'lucide-react';
import { supabase, type Event } from '../lib/supabase';
import { UserAvatar } from './UserAvatar';
import { COUNTRIES } from '../utils/countries';
import { encodeEvent } from '../utils/eventMessage';

type Target =
  | { kind: 'dm'; id: string; convoId: string; name: string; avatar: string | null }
  | { kind: 'group'; id: string; channelId: string; name: string; emoji: string };

type Props = {
  event: Event;
  currentUserId: string;
  onClose: () => void;
};

/** Formats the event into a shareable chat message. */
function eventText(event: Event): string {
  const place = [event.city, event.country ? COUNTRIES[event.country]?.name : null].filter(Boolean).join(', ');
  const when = event.event_date
    ? new Date(event.event_date).toLocaleString('he-IL', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    : '';
  return [
    `${event.emoji || '📅'} ${event.title}`,
    place ? `📍 ${place}` : '',
    when ? `🗓️ ${when}` : '',
  ].filter(Boolean).join('\n');
}

export function ShareEventSheet({ event, currentUserId, onClose }: Props) {
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [me, setMe] = useState<{ display_name: string; avatar_url: string | null } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const meRes = supabase.from('users').select('display_name, avatar_url').eq('id', currentUserId).maybeSingle();

        // DM conversations
        const convosRes = supabase
          .from('conversations')
          .select('*')
          .or(`participant_1_id.eq.${currentUserId},participant_2_id.eq.${currentUserId}`)
          .order('last_message_at', { ascending: false });

        // Group channels the user belongs to
        const memRes = supabase.from('group_members').select('channel_id').eq('user_id', currentUserId);

        const [{ data: meData }, { data: convos }, { data: members }] = await Promise.all([meRes, convosRes, memRes]);
        setMe(meData ?? null);

        const dmTargets: Target[] = await Promise.all((convos ?? []).map(async (c) => {
          const otherId = c.participant_1_id === currentUserId ? c.participant_2_id : c.participant_1_id;
          const { data: u } = await supabase.from('users').select('id, display_name, avatar_url').eq('id', otherId).maybeSingle();
          return { kind: 'dm', id: `dm-${c.id}`, convoId: c.id, name: u?.display_name || 'משתמש', avatar: u?.avatar_url ?? null };
        }));

        let groupTargets: Target[] = [];
        const channelIds = (members ?? []).map(m => m.channel_id);
        if (channelIds.length) {
          const { data: channels } = await supabase.from('group_channels').select('id, country_code, city_name, city_emoji').in('id', channelIds);
          const seen = new Set<string>();
          groupTargets = (channels ?? []).flatMap((ch) => {
            const key = `${ch.country_code}:${ch.city_emoji}`;
            if (seen.has(key)) return [];
            seen.add(key);
            const flag = COUNTRIES[ch.country_code as string]?.flag ?? '🌍';
            return [{ kind: 'group', id: `g-${ch.id}`, channelId: ch.id as string, name: `${flag} ${ch.city_name}`, emoji: ch.city_emoji as string }];
          });
        }

        setTargets([...dmTargets, ...groupTargets]);
      } catch (e) {
        console.error('share load error', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [currentUserId]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const send = async () => {
    if (selected.size === 0 || sending) return;
    setSending(true);
    // Encode the event so chats render it as a clickable card; plain text is the fallback.
    const content = encodeEvent(
      {
        id: event.id, title: event.title, city: event.city, country: event.country,
        date: event.event_date, emoji: event.emoji, image: event.image_url,
      },
      eventText(event),
    );
    const chosen = targets.filter(t => selected.has(t.id));
    try {
      await Promise.all(chosen.map(async (t) => {
        if (t.kind === 'dm') {
          await supabase.from('messages').insert({ conversation_id: t.convoId, sender_id: currentUserId, content, is_read: false });
          await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', t.convoId);
        } else {
          await supabase.from('group_messages').insert({
            channel_id: t.channelId, user_id: currentUserId,
            display_name: me?.display_name || 'אנונימי', avatar_url: me?.avatar_url ?? null,
            content, type: 'text',
          });
        }
      }));
    } catch (e) {
      console.error('share send error', e);
    } finally {
      setSending(false);
      onClose();
    }
  };

  const nativeShare = async () => {
    const text = eventText(event);
    try {
      if (navigator.share) await navigator.share({ title: event.title, text });
      else if (navigator.clipboard) { await navigator.clipboard.writeText(text); }
    } catch { /* dismissed */ }
    onClose();
  };

  const q = query.trim().toLowerCase();
  const filtered = q ? targets.filter(t => t.name.toLowerCase().includes(q)) : targets;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)', animation: 'fade-in 0.18s ease' }}
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="w-full max-w-md bg-white flex flex-col"
        style={{ borderRadius: '24px 24px 0 0', maxHeight: '78dvh', paddingBottom: 'max(12px, env(safe-area-inset-bottom))', animation: 'slide-up 0.28s cubic-bezier(0.25,1,0.5,1)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-3 pb-2 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-3" />
          <p className="text-center text-[15px] font-black text-gray-900" style={{ fontFamily: 'Heebo, sans-serif' }}>שלח אירוע</p>
          <div className="relative mt-3">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש צ'אט או קבוצה..."
              className="w-full h-11 pr-10 pl-4 text-sm rounded-2xl outline-none bg-gray-100 focus:bg-white focus:ring-2 focus:ring-orange-200 transition"
              style={{ fontFamily: 'Heebo, sans-serif' }}
            />
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto px-3 flex-1" style={{ minHeight: 120 }}>
          {loading ? (
            <div className="py-12 text-center"><div className="inline-block w-9 h-9 border-[3px] border-orange-300 border-t-transparent rounded-full animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400" style={{ fontFamily: 'Rubik, sans-serif' }}>אין צ'אטים זמינים</p>
          ) : (
            filtered.map((t) => {
              const isSel = selected.has(t.id);
              return (
                <button key={t.id} onClick={() => toggle(t.id)} className="w-full flex items-center gap-3 px-2 py-2.5 rounded-2xl active:bg-gray-100 transition-colors">
                  {t.kind === 'dm'
                    ? <UserAvatar userId={t.id} displayName={t.name} avatarUrl={t.avatar} size="medium" />
                    : <span className="w-11 h-11 rounded-full bg-orange-50 flex items-center justify-center text-[22px] flex-shrink-0">{t.emoji}</span>}
                  <span className="flex-1 text-right text-[15px] font-bold text-gray-900 truncate" style={{ fontFamily: 'Heebo, sans-serif' }}>{t.name}</span>
                  <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ border: isSel ? 'none' : '2px solid #D1D5DB', background: isSel ? '#F97316' : 'transparent' }}>
                    {isSel && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 pt-2 flex-shrink-0 flex items-center gap-2">
          <button
            onClick={nativeShare}
            className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gray-100 active:scale-95 transition flex-shrink-0"
            title="שיתוף חיצוני"
          >
            <Share2 className="w-5 h-5 text-gray-600" />
          </button>
          <button
            onClick={send}
            disabled={selected.size === 0 || sending}
            className="flex-1 h-12 rounded-2xl flex items-center justify-center gap-2 text-white font-black active:scale-[0.99] transition disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', fontFamily: 'Heebo, sans-serif' }}
          >
            {sending
              ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <><Send className="w-[18px] h-[18px]" style={{ transform: 'scaleX(-1)' }} /> שלח{selected.size > 0 ? ` (${selected.size})` : ''}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
