import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, Image, MapPin, Users, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserAvatar } from './UserAvatar';

/* ─────────── types ─────────── */
interface GMessage {
  id: string;
  channel_id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  content: string | null;
  type: 'text' | 'image' | 'location';
  image_url: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_name: string | null;
  created_at: string;
  reactions: GReaction[];
}

interface GReaction {
  emoji: string;
  count: number;
  mine: boolean;
}

interface CityGroupChatProps {
  countryCode: string;
  countryFlag: string;
  cityName: string;
  cityEmoji: string;
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar: string | null;
  onClose: () => void;
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '');
}

function fmtTime(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 60000) return 'עכשיו';
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}ד`;
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
}

/* ════════════════════════════════════════════════════════ */
export function CityGroupChat({
  countryCode, countryFlag, cityName, cityEmoji,
  currentUserId, currentUserName, currentUserAvatar,
  onClose,
}: CityGroupChatProps) {
  const [channelId,    setChannelId]    = useState<string | null>(null);
  const [messages,     setMessages]     = useState<GMessage[]>([]);
  const [memberCount,  setMemberCount]  = useState(0);
  const [text,         setText]         = useState('');
  const [sending,      setSending]      = useState(false);
  const [uploading,    setUploading]    = useState(false);
  const [reactionFor,  setReactionFor]  = useState<string | null>(null); // message id
  const [locLoading,   setLocLoading]   = useState(false);
  const [showScroll,   setShowScroll]   = useState(false);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const listRef     = useRef<HTMLDivElement>(null);
  const fileRef     = useRef<HTMLInputElement>(null);
  const reactionRef = useRef<HTMLDivElement>(null);

  /* ── Get or create channel ── */
  useEffect(() => {
    const citySlug = slugify(cityName);
    (async () => {
      const { data, error } = await supabase
        .from('group_channels')
        .upsert(
          { country_code: countryCode, city_slug: citySlug, city_name: cityName, city_emoji: cityEmoji },
          { onConflict: 'country_code,city_slug', ignoreDuplicates: false }
        )
        .select('id')
        .maybeSingle();

      if (error || !data) {
        // try select if upsert failed
        const { data: sel } = await supabase
          .from('group_channels')
          .select('id')
          .eq('country_code', countryCode)
          .eq('city_slug', citySlug)
          .maybeSingle();
        if (sel) setChannelId(sel.id);
        return;
      }
      setChannelId(data.id);
    })();
  }, [countryCode, cityName, cityEmoji]);

  /* ── Join as member + count ── */
  useEffect(() => {
    if (!channelId) return;

    const markSeen = () =>
      supabase.from('group_members')
        .upsert(
          { channel_id: channelId, user_id: currentUserId, display_name: currentUserName, avatar_url: currentUserAvatar, last_seen_at: new Date().toISOString() },
          { onConflict: 'channel_id,user_id' }
        );

    // Join + mark seen on open
    markSeen().then(() => loadMemberCount());
    loadMessages();

    // Realtime: messages
    const msgSub = supabase
      .channel(`group-msg-${channelId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `channel_id=eq.${channelId}` },
        (payload) => {
          const msg = payload.new as Omit<GMessage, 'reactions'>;
          setMessages(prev => {
            if (prev.find(m => m.id === msg.id)) return prev;
            return [...prev, { ...msg, reactions: [] }];
          });
          scrollToBottom();
          // Mark seen whenever a new message arrives while viewing
          markSeen();
        }
      )
      .subscribe();

    // Realtime: reactions
    const rxSub = supabase
      .channel(`group-rx-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_reactions' },
        () => loadMessages()
      )
      .subscribe();

    // Realtime: members
    const memSub = supabase
      .channel(`group-mem-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members', filter: `channel_id=eq.${channelId}` },
        () => loadMemberCount()
      )
      .subscribe();

    return () => {
      // Mark seen on close so unread count resets
      supabase.from('group_members')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('channel_id', channelId)
        .eq('user_id', currentUserId);
      supabase.removeChannel(msgSub);
      supabase.removeChannel(rxSub);
      supabase.removeChannel(memSub);
    };
  }, [channelId]);

  const loadMemberCount = async () => {
    if (!channelId) return;
    const { count } = await supabase
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('channel_id', channelId);
    setMemberCount(count ?? 0);
  };

  const loadMessages = useCallback(async () => {
    if (!channelId) return;
    const { data: msgs } = await supabase
      .from('group_messages')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
      .limit(80);

    if (!msgs) return;

    // load reactions for all messages
    const ids = msgs.map(m => m.id);
    const { data: rxs } = ids.length
      ? await supabase.from('group_reactions').select('*').in('message_id', ids)
      : { data: [] };

    const rxMap: Record<string, { emoji: string; users: string[] }[]> = {};
    for (const rx of rxs || []) {
      if (!rxMap[rx.message_id]) rxMap[rx.message_id] = [];
      const existing = rxMap[rx.message_id].find(r => r.emoji === rx.emoji);
      if (existing) existing.users.push(rx.user_id);
      else rxMap[rx.message_id].push({ emoji: rx.emoji, users: [rx.user_id] });
    }

    setMessages(msgs.map(m => ({
      ...m,
      reactions: (rxMap[m.id] || []).map(r => ({
        emoji: r.emoji,
        count: r.users.length,
        mine: r.users.includes(currentUserId),
      })),
    })));
    scrollToBottom();
  }, [channelId, currentUserId]);

  const scrollToBottom = () =>
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);

  /* ── List scroll detection ── */
  const handleScroll = () => {
    if (!listRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    setShowScroll(scrollHeight - scrollTop - clientHeight > 120);
  };

  /* ── Send text ── */
  const sendText = async () => {
    if (!text.trim() || !channelId || sending) return;
    setSending(true);
    const msg = text.trim();
    setText('');
    await supabase.from('group_messages').insert({
      channel_id: channelId,
      user_id: currentUserId,
      display_name: currentUserName,
      avatar_url: currentUserAvatar,
      content: msg,
      type: 'text',
    });
    setSending(false);
  };

  /* ── Upload image ── */
  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !channelId) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `group-chat/${channelId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('images').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(path);
      await supabase.from('group_messages').insert({
        channel_id: channelId, user_id: currentUserId,
        display_name: currentUserName, avatar_url: currentUserAvatar,
        type: 'image', image_url: publicUrl,
      });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  /* ── Share location ── */
  const shareLocation = async () => {
    if (!channelId || locLoading) return;
    setLocLoading(true);
    const send = async (lat: number, lng: number) => {
      const name = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      await supabase.from('group_messages').insert({
        channel_id: channelId, user_id: currentUserId,
        display_name: currentUserName, avatar_url: currentUserAvatar,
        type: 'location', location_lat: lat, location_lng: lng, location_name: name,
      });
      setLocLoading(false);
    };
    // use nativeLocation event if available (Expo WebView)
    const onNative = (e: Event) => {
      window.removeEventListener('nativeLocation', onNative);
      const { lat, lng } = (e as CustomEvent).detail;
      send(lat, lng);
    };
    window.addEventListener('nativeLocation', onNative);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { window.removeEventListener('nativeLocation', onNative); send(pos.coords.latitude, pos.coords.longitude); },
        () => { /* wait for native */ },
        { enableHighAccuracy: true, timeout: 8000 },
      );
    }
    setTimeout(() => { window.removeEventListener('nativeLocation', onNative); setLocLoading(false); }, 12000);
  };

  /* ── Toggle reaction ── */
  const toggleReaction = async (messageId: string, emoji: string) => {
    const msg = messages.find(m => m.id === messageId);
    const existing = msg?.reactions.find(r => r.emoji === emoji && r.mine);
    if (existing) {
      await supabase.from('group_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', currentUserId)
        .eq('emoji', emoji);
    } else {
      await supabase.from('group_reactions').insert({ message_id: messageId, user_id: currentUserId, emoji });
    }
    setReactionFor(null);
  };

  /* ── Close reaction picker on outside click ── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (reactionFor && reactionRef.current && !reactionRef.current.contains(e.target as Node))
        setReactionFor(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [reactionFor]);

  /* ══════════════ RENDER ══════════════ */
  return (
    <>
      <style>{`
        @keyframes chat-slide-in {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes rx-picker-in {
          from { transform: scale(0.7) translateY(6px); opacity: 0; }
          to   { transform: scale(1) translateY(0);     opacity: 1; }
        }
        @keyframes msg-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .gchat-msg { animation: msg-in 0.2s ease-out both; }
        .gchat-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 120,
          background: '#F0F2F5',
          display: 'flex', flexDirection: 'column',
          animation: 'chat-slide-in 0.35s cubic-bezier(0.34,1.3,0.64,1)',
          fontFamily: 'Heebo, system-ui, sans-serif',
        }}
        dir="rtl"
      >
        {/* ── Header ── */}
        <div style={{
          background: 'linear-gradient(135deg, #1A1F2E 0%, #252B3D 100%)',
          paddingTop: 'max(14px, env(safe-area-inset-top))',
          paddingBottom: 14, paddingRight: 16, paddingLeft: 16,
          display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
          flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <X size={18} color="#fff" />
          </button>

          {/* Flag + city info */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span style={{ fontSize: 22 }}>{countryFlag}</span>
              <span style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>
                {cityEmoji} {cityName}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ADE80' }} />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
                {memberCount} {memberCount === 1 ? 'חבר' : 'חברים'} בקבוצה
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users size={16} color="rgba(255,255,255,0.5)" />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#F97316' }}>{memberCount}</span>
          </div>
        </div>

        {/* ── Messages list ── */}
        <div
          ref={listRef}
          onScroll={handleScroll}
          className="gchat-scroll"
          style={{ flex: 1, overflowY: 'auto', padding: '12px 10px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          {messages.length === 0 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#9CA3AF', paddingBottom: 40 }}>
              <span style={{ fontSize: 48 }}>{cityEmoji}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#6B7280' }}>ברוכים הבאים לקבוצת {cityName}</span>
              <span style={{ fontSize: 13 }}>היו הראשונים לכתוב!</span>
            </div>
          )}

          {messages.map((msg, idx) => {
            const isMe = msg.user_id === currentUserId;
            const showAvatar = !isMe && (idx === 0 || messages[idx - 1].user_id !== msg.user_id);
            const showName   = !isMe && showAvatar;
            const showTime   = idx === messages.length - 1 || messages[idx + 1].user_id !== msg.user_id;

            return (
              <div key={msg.id} className="gchat-msg" style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', marginBottom: showTime ? 6 : 2 }}>
                {showName && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#F97316', marginRight: 46, marginBottom: 2 }}>
                    {msg.display_name}
                  </span>
                )}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, flexDirection: isMe ? 'row' : 'row-reverse' }}>
                  {/* Avatar placeholder for spacing */}
                  {!isMe && (
                    <div style={{ width: 34, flexShrink: 0 }}>
                      {showAvatar && (
                        <div style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', background: '#E5E7EB' }}>
                          <UserAvatar userId={msg.user_id} displayName={msg.display_name} avatarUrl={msg.avatar_url} size="small" />
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ maxWidth: '72%', position: 'relative' }}>
                    {/* Bubble */}
                    <div
                      onDoubleClick={() => setReactionFor(reactionFor === msg.id ? null : msg.id)}
                      style={{
                        background: isMe ? 'linear-gradient(135deg, #F97316, #EA580C)' : '#fff',
                        color: isMe ? '#fff' : '#111827',
                        borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        padding: msg.type === 'image' ? 4 : '10px 14px',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                        cursor: 'default',
                        position: 'relative',
                        overflow: msg.type === 'image' ? 'hidden' : 'visible',
                      }}
                    >
                      {msg.type === 'text' && (
                        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.content}</p>
                      )}
                      {msg.type === 'image' && msg.image_url && (
                        <img
                          src={msg.image_url}
                          alt=""
                          style={{ maxWidth: 220, maxHeight: 280, borderRadius: 14, display: 'block' }}
                        />
                      )}
                      {msg.type === 'location' && (
                        <a
                          href={`https://maps.google.com/?q=${msg.location_lat},${msg.location_lng}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'inherit' }}
                        >
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: isMe ? 'rgba(255,255,255,0.2)' : '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <MapPin size={18} color={isMe ? '#fff' : '#F97316'} />
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>מיקום שותף</div>
                            <div style={{ fontSize: 11, opacity: 0.75 }}>{msg.location_name}</div>
                          </div>
                        </a>
                      )}
                    </div>

                    {/* Time */}
                    {showTime && (
                      <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 3, textAlign: isMe ? 'left' : 'right', paddingRight: isMe ? 0 : 4, paddingLeft: isMe ? 4 : 0 }}>
                        {fmtTime(msg.created_at)}
                      </div>
                    )}

                    {/* Reaction picker */}
                    {reactionFor === msg.id && (
                      <div
                        ref={reactionRef}
                        style={{
                          position: 'absolute', bottom: '100%', [isMe ? 'left' : 'right']: 0,
                          marginBottom: 6,
                          background: '#fff', borderRadius: 50,
                          boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
                          display: 'flex', gap: 2, padding: '6px 10px',
                          animation: 'rx-picker-in 0.2s cubic-bezier(0.34,1.5,0.64,1)',
                          zIndex: 10,
                        }}
                      >
                        {QUICK_EMOJIS.map(em => (
                          <button
                            key={em}
                            onClick={() => toggleReaction(msg.id, em)}
                            style={{
                              fontSize: 22, background: 'none', border: 'none', cursor: 'pointer',
                              padding: '2px 4px', borderRadius: 8,
                              background: msg.reactions.find(r => r.emoji === em && r.mine) ? '#FFF7ED' : 'transparent',
                            } as React.CSSProperties}
                          >
                            {em}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Reactions row */}
                {msg.reactions.length > 0 && (
                  <div style={{
                    display: 'flex', gap: 4, flexWrap: 'wrap',
                    marginRight: isMe ? 0 : 46, marginLeft: isMe ? 0 : 0,
                    marginTop: 3,
                    justifyContent: isMe ? 'flex-end' : 'flex-start',
                  }}>
                    {msg.reactions.map(rx => (
                      <button
                        key={rx.emoji}
                        onClick={() => toggleReaction(msg.id, rx.emoji)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 3,
                          padding: '2px 8px', borderRadius: 50,
                          background: rx.mine ? '#FFF7ED' : '#fff',
                          border: rx.mine ? '1.5px solid #F97316' : '1.5px solid #E5E7EB',
                          cursor: 'pointer', fontSize: 13,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                        }}
                      >
                        <span>{rx.emoji}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: rx.mine ? '#F97316' : '#6B7280' }}>{rx.count}</span>
                      </button>
                    ))}
                    {/* Add reaction button */}
                    <button
                      onClick={() => setReactionFor(reactionFor === msg.id ? null : msg.id)}
                      style={{ padding: '2px 8px', borderRadius: 50, background: '#fff', border: '1.5px solid #E5E7EB', cursor: 'pointer', fontSize: 13, color: '#9CA3AF' }}
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Scroll-to-bottom FAB */}
        {showScroll && (
          <button
            onClick={scrollToBottom}
            style={{
              position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)',
              background: '#fff', border: 'none', borderRadius: 50, padding: '6px 14px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.15)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6B7280', fontWeight: 700,
            }}
          >
            <ChevronDown size={14} />
            גלול למטה
          </button>
        )}

        {/* ── Input bar ── */}
        <div style={{
          background: '#fff',
          borderTop: '1px solid #F3F4F6',
          padding: '10px 12px',
          paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
          display: 'flex', alignItems: 'flex-end', gap: 8,
          flexShrink: 0,
        }}>
          {/* Image */}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImage} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: uploading ? '#F3F4F6' : '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
          >
            {uploading
              ? <div style={{ width: 18, height: 18, border: '2px solid #F97316', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              : <Image size={18} color="#F97316" />
            }
          </button>

          {/* Location */}
          <button
            onClick={shareLocation}
            disabled={locLoading}
            style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: locLoading ? '#F3F4F6' : '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
          >
            {locLoading
              ? <div style={{ width: 18, height: 18, border: '2px solid #F97316', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              : <MapPin size={18} color="#F97316" />
            }
          </button>

          {/* Text input */}
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(); } }}
            placeholder={`הודעה לקבוצת ${cityName}...`}
            rows={1}
            style={{
              flex: 1, borderRadius: 20, border: '1.5px solid #E5E7EB',
              padding: '10px 14px', fontSize: 15, resize: 'none', outline: 'none',
              fontFamily: 'Heebo, sans-serif', lineHeight: 1.4, maxHeight: 100,
              background: '#F9FAFB', color: '#111827',
              overflowY: 'auto',
            }}
          />

          {/* Send */}
          <button
            onClick={sendText}
            disabled={!text.trim() || sending}
            style={{
              width: 40, height: 40, borderRadius: '50%', border: 'none', flexShrink: 0,
              background: text.trim() ? 'linear-gradient(135deg, #F97316, #EA580C)' : '#E5E7EB',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: text.trim() ? 'pointer' : 'default',
              boxShadow: text.trim() ? '0 4px 14px rgba(249,115,22,0.4)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            <Send size={17} color={text.trim() ? '#fff' : '#9CA3AF'} style={{ transform: 'scaleX(-1)' }} />
          </button>
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </>
  );
}
