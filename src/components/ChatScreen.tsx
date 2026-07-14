import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Send, ChevronDown } from 'lucide-react';
import { supabase, type Event } from '../lib/supabase';
import { UserAvatar } from './UserAvatar';
import { BackButton } from './BackButton';
import { EventChatCard } from './EventChatCard';
import { PlaceChatCard } from './PlaceChatCard';
import { EventDetailsModal } from './EventDetailsModal';
import { MessageBubble } from './MessageBubble';
import { parseEvent } from '../utils/eventMessage';
import { parsePlace } from '../utils/placeMessage';

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
};

type OtherUser = {
  id: string;
  display_name: string;
  avatar_url: string | null;
};

type ChatScreenProps = {
  conversationId: string;
  currentUserId: string;
  otherUserId: string;
  onBack: () => void;
  onOpenMapAt?: (lat: number, lng: number, placeId?: string) => void;
  onNavigateToUserProfile?: (userId: string) => void;
};

/* ── module-level caches (survive navigation) ── */
const _chatMsgCache: Record<string, Message[]> = {};
const _chatUserCache: Record<string, OtherUser> = {};

export function ChatScreen({ conversationId, currentUserId, otherUserId, onBack, onOpenMapAt, onNavigateToUserProfile }: ChatScreenProps) {
  const [messages, setMessages] = useState<Message[]>(_chatMsgCache[conversationId] ?? []);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(_chatUserCache[otherUserId] ?? null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(!_chatMsgCache[conversationId]?.length);
  const [sending, setSending] = useState(false);
  const [openEvent, setOpenEvent] = useState<Event | null>(null);
  const [otherTyping, setOtherTyping] = useState(false); // is the other person typing right now
  const [showScroll, setShowScroll] = useState(false); // show the "jump to bottom" button when scrolled up
  const [unreadNew, setUnreadNew] = useState(0); // count of messages arrived while scrolled up
  const [reconnectTick, setReconnectTick] = useState(0); // bump to force the realtime channels to rebuild
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set()); // only NEW messages get the pop-in
  const seenInitRef = useRef(false);
  const typingChanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSentRef = useRef(0);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true); // is the user near the bottom (so a new message may auto-scroll)
  const lastSeenLastIdRef = useRef<string | null>(null); // last message id already accounted for (avoids double-counting on refetch)
  const inputRef = useRef<HTMLInputElement>(null);
  const initialLoadDone = useRef(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const inputBarRef = useRef<HTMLDivElement>(null);
  const [headerH, setHeaderH] = useState(60);
  const [inputH, setInputH] = useState(64);

  // Measure the floating glass bars so messages scroll behind them (matches group chat).
  useLayoutEffect(() => {
    const measure = () => {
      if (headerRef.current) setHeaderH(headerRef.current.offsetHeight);
      if (inputBarRef.current) setInputH(inputBarRef.current.offsetHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (headerRef.current) ro.observe(headerRef.current);
    if (inputBarRef.current) ro.observe(inputBarRef.current);
    return () => ro.disconnect();
  }, [loading, otherUser]);

  // Scroll to bottom before first paint
  useLayoutEffect(() => {
    if (!loading && !initialLoadDone.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      initialLoadDone.current = true;
    }
  }, [loading]);

  // Re-pin to bottom once the floating glass bars are measured (avoids opening mid-chat).
  useLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [headerH, inputH]);

  useEffect(() => {
    loadOtherUser();
    loadMessages();
    markMessagesAsRead();

    // Messages channel — postgres_changes ONLY (kept on its own topic so nothing else can clobber it)
    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages(prev => {
            const exists = prev.some(msg => msg.id === newMsg.id);
            if (exists) return prev;
            const updated = [...prev, newMsg];
            _chatMsgCache[conversationId] = updated;
            return updated;
          });
          if (newMsg.sender_id !== currentUserId) {
            markMessagesAsRead();
            setOtherTyping(false); // they sent → no longer typing
          }
        }
      )
      .subscribe((status) => {
        // Reliability: if the channel drops, schedule a rebuild (re-runs this effect → reconnect + loadMessages catch-up)
        if (status === 'SUBSCRIBED') {
          if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
        } else if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && !reconnectTimerRef.current) {
          reconnectTimerRef.current = setTimeout(() => { reconnectTimerRef.current = null; setReconnectTick(t => t + 1); }, 2500);
        }
      });

    // Typing + message relay — separate ephemeral topic (mirrors the groups' group-typing-* pattern).
    // The message relay guarantees instant delivery even if DB replication isn't enabled for `messages`.
    const typingChannel = supabase
      .channel(`dm-typing-${conversationId}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if ((payload as { userId?: string })?.userId === currentUserId) return;
        setOtherTyping(true);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => setOtherTyping(false), 15000);
      })
      .on('broadcast', { event: 'stop' }, ({ payload }) => {
        if ((payload as { userId?: string })?.userId === currentUserId) return;
        setOtherTyping(false);
      })
      .on('broadcast', { event: 'msg' }, ({ payload }) => {
        const newMsg = payload as Message;
        if (!newMsg?.id || newMsg.sender_id === currentUserId) return;
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          const updated = [...prev, newMsg];
          _chatMsgCache[conversationId] = updated;
          return updated;
        });
        markMessagesAsRead();
        setOtherTyping(false);
      })
      .subscribe();
    typingChanRef.current = typingChannel;

    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
      typingChanRef.current = null;
      supabase.removeChannel(channel);
      supabase.removeChannel(typingChannel);
    };
  }, [conversationId, currentUserId, reconnectTick]);

  // Messages present at mount must NOT animate — mark them seen before the first render.
  if (!seenInitRef.current) { messages.forEach(m => seenIdsRef.current.add(m.id)); seenInitRef.current = true; }
  useEffect(() => { messages.forEach(m => seenIdsRef.current.add(m.id)); }, [messages]);

  useEffect(() => {
    const last = messages[messages.length - 1];
    const lastChanged = !!last && last.id !== lastSeenLastIdRef.current;
    lastSeenLastIdRef.current = last?.id ?? null;
    if (!initialLoadDone.current) return; // still the initial load — just track, don't scroll/badge
    const mineLast = !!last && last.sender_id === currentUserId;
    // Only auto-scroll if the user is at the bottom, or it's their own message — don't yank away from history
    if (mineLast || atBottomRef.current) scrollToBottom(true);
    else if (lastChanged) setUnreadNew(n => n + 1); // a genuinely new message arrived while reading history
  }, [messages]);

  // Catch up on messages missed while the app was backgrounded (the realtime socket drops on lock/background).
  useEffect(() => {
    const onResume = () => { if (document.visibilityState === 'visible') loadMessages(); };
    document.addEventListener('visibilitychange', onResume);
    window.addEventListener('focus', onResume);
    return () => {
      document.removeEventListener('visibilitychange', onResume);
      window.removeEventListener('focus', onResume);
    };
  }, [conversationId]);

  const loadOtherUser = async () => {
    if (_chatUserCache[otherUserId]) return; // already cached
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, display_name, avatar_url')
        .eq('id', otherUserId)
        .maybeSingle();

      if (error) throw error;
      if (data) { _chatUserCache[otherUserId] = data; setOtherUser(data); }
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      const msgs = data || [];
      _chatMsgCache[conversationId] = msgs;
      msgs.forEach(m => seenIdsRef.current.add(m.id)); // fetched batch, not "new" → no pop-in on first open
      setMessages(msgs);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const markMessagesAsRead = async () => {
    try {
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .eq('is_read', false)
        .neq('sender_id', currentUserId);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const scrollToBottom = (smooth = false) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' });
  };

  const openEventById = async (id: string) => {
    const { data } = await supabase.from('events').select('*').eq('id', id).maybeSingle();
    if (data) setOpenEvent(data as Event);
  };


  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMessage.trim() || sending) return;

    const messageContent = newMessage.trim();
    setNewMessage('');
    setSending(true);
    lastTypingSentRef.current = 0;
    typingChanRef.current?.send({ type: 'broadcast', event: 'stop', payload: { userId: currentUserId } });

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: currentUserId,
          content: messageContent,
          is_read: false
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setMessages(prev => prev.some(m => m.id === data.id) ? prev : [...prev, data]);
        _chatMsgCache[conversationId] = [...(_chatMsgCache[conversationId] ?? []).filter(m => m.id !== data.id), data];
        // Relay to the other participant for instant delivery (independent of DB replication)
        typingChanRef.current?.send({ type: 'broadcast', event: 'msg', payload: data });
      }

      inputRef.current?.focus();
    } catch (error) {
      console.error('Error sending message:', error);
      setNewMessage(messageContent);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateHeader = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'היום';
    if (date.toDateString() === yesterday.toDateString()) return 'אתמול';

    return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });
  };

  const shouldShowDateHeader = (index: number) => {
    if (index === 0) return true;
    const currentDate = new Date(messages[index].created_at).toDateString();
    const previousDate = new Date(messages[index - 1].created_at).toDateString();
    return currentDate !== previousDate;
  };

  if (loading || !otherUser) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F3EFE9' }}>
        <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  const renderMsg = (message: Message, index: number) => {
    const mine = message.sender_id === currentUserId;
    const prev = messages[index - 1];
    const next = messages[index + 1];
    const isLast = !next || next.sender_id !== message.sender_id;
    const evt = parseEvent(message.content).event;
    const plc = parsePlace(message.content).place;
    const isNew = !seenIdsRef.current.has(message.id); // animate only freshly-arrived messages
    const popStyle = isNew ? { animation: 'gchat-pop 360ms cubic-bezier(0.34,1.56,0.64,1) both', transformOrigin: mine ? 'right bottom' : 'left bottom' } as const : undefined;
    return (
      <div key={message.id}>
        {shouldShowDateHeader(index) && (
          <div style={{ display: 'flex', justifyContent: 'center', margin: '14px 0 10px' }}>
            <span style={{ background: 'rgba(60,55,50,0.55)', color: '#fff', fontSize: 12, fontWeight: 600, padding: '5px 14px', borderRadius: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.12)', backdropFilter: 'blur(8px)' }}>
              {formatDateHeader(message.created_at)}
            </span>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start', paddingLeft: 8, paddingRight: 8, marginBottom: isLast ? 6 : 2 }}>
          {evt ? (
            <div style={popStyle}><EventChatCard data={evt} onClick={() => openEventById(evt.id)} /></div>
          ) : plc ? (
            <div style={popStyle}><PlaceChatCard data={plc} onClick={() => onOpenMapAt?.(plc.lat, plc.lng, plc.id)} /></div>
          ) : (
            <div style={{ maxWidth: '78%', ...popStyle }}>
              <MessageBubble mine={!mine} tail={isLast} color={mine ? '#FFD4A8' : '#FFFFFF'} contentStyle={{ padding: '7px 14px' }}>
                <p style={{ fontSize: 14, lineHeight: 1.4, color: mine ? '#7C3400' : '#111111', margin: 0, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }} dir="rtl">
                  {message.content}
                </p>
              </MessageBubble>
            </div>
          )}
          {isLast && (
            <span style={{ fontSize: 10, color: '#9AA0A6', marginTop: 3, paddingInline: 2, fontVariantNumeric: 'tabular-nums' }}>
              {formatTime(message.created_at)}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 120, fontFamily: "'Rubik','Heebo',sans-serif", animation: 'gchat-slide 0.28s cubic-bezier(0.25,1,0.5,1)' }}>
      <style>{`
        @keyframes gchat-slide { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes gchat-pop {
          0%   { transform: scale(0.8);  opacity: 0; }
          60%  { transform: scale(1.04); opacity: 1; }
          100% { transform: scale(1); }
        }
        @keyframes gchat-typing {
          0%, 60%, 100% { transform: translateY(0); }
          30%           { transform: translateY(-4px); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes gchat-pop { from { opacity: 0; } to { opacity: 1; } }
          @keyframes gchat-typing { 0%,100% { transform: none; } }
        }
      `}</style>

      {/* Messages area (WhatsApp bg) — scrolls behind the glass bars */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#F3EFE9', backgroundImage: 'url(/chat-bg.png)', backgroundSize: '50%', backgroundRepeat: 'repeat' }}>
        <div ref={scrollContainerRef}
          onScroll={e => { const el = e.currentTarget; const dist = el.scrollHeight - el.scrollTop - el.clientHeight; atBottomRef.current = dist < 80; setShowScroll(dist > 100); if (dist < 80) setUnreadNew(0); }}
          style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingTop: headerH + 10, paddingBottom: inputH + 8 }}>
          {messages.map((message, index) => renderMsg(message, index))}

          {/* Live typing indicator (ephemeral broadcast) */}
          {otherTyping && otherUser && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 18, paddingRight: 18, marginBottom: 8, animation: 'gchat-pop 260ms ease-out both', transformOrigin: 'left bottom' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                {[4, 5, 6].map((d, i) => (
                  <span key={i} style={{ width: d, height: d, borderRadius: '50%', background: 'rgba(0,0,0,0.3)', display: 'inline-block', animation: `gchat-typing 1.2s ${i * 0.16}s infinite ease-in-out` }} />
                ))}
              </div>
              <span dir="rtl" style={{ fontSize: 12.5, fontWeight: 500, color: 'rgba(0,0,0,0.6)' }}>{otherUser.display_name} מקליד/ה</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Scroll to bottom — floats above the glass input bar */}
        {showScroll && (
          <button onClick={() => { setUnreadNew(0); atBottomRef.current = true; scrollToBottom(true); }} style={{
            position: 'absolute', bottom: inputH + 12, right: 12, zIndex: 11,
            width: 38, height: 38, borderRadius: '50%',
            background: '#fff', border: '1px solid rgba(0,0,0,0.1)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>
            <ChevronDown size={18} style={{ color: '#555' }} />
            {unreadNew > 0 && (
              <span style={{
                position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)',
                minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9,
                background: 'linear-gradient(135deg, #F97316, #EA580C)', boxShadow: '0 2px 8px rgba(234,88,12,0.35)',
                color: '#fff', fontSize: 11, fontWeight: 700, lineHeight: '18px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {unreadNew > 99 ? '99+' : unreadNew}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Glass header */}
      <div ref={headerRef} style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: '1px solid rgba(255,255,255,0.4)', paddingTop: 'env(safe-area-inset-top)', boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px 10px' }}>
          <BackButton onClick={onBack} />
          <button
            onClick={() => onNavigateToUserProfile?.(otherUser.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: onNavigateToUserProfile ? 'pointer' : 'default' }}
          >
            <UserAvatar userId={otherUser.id} displayName={otherUser.display_name} avatarUrl={otherUser.avatar_url} size="small" />
            <h1 style={{ flex: 1, fontSize: 16, fontWeight: 700, color: '#1a1a1a', margin: 0, lineHeight: 1.2, textAlign: 'right' }} dir="rtl">{otherUser.display_name}</h1>
          </button>
        </div>
      </div>

      {/* Glass input bar */}
      <div ref={inputBarRef} style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
        background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderTop: '1px solid rgba(255,255,255,0.4)', padding: '6px 8px', paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
      }}>
        <form onSubmit={handleSendMessage} style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <div style={{ flex: 1, background: '#fff', borderRadius: 24, minHeight: 44, display: 'flex', alignItems: 'center', padding: '0 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => {
                const v = e.target.value;
                setNewMessage(v);
                const now = Date.now();
                if (!v) {
                  lastTypingSentRef.current = 0;
                  typingChanRef.current?.send({ type: 'broadcast', event: 'stop', payload: { userId: currentUserId } });
                } else if (now - lastTypingSentRef.current > 1500) {
                  lastTypingSentRef.current = now;
                  typingChanRef.current?.send({ type: 'broadcast', event: 'typing', payload: { userId: currentUserId } });
                }
              }}
              placeholder="הודעה..."
              dir="rtl"
              disabled={sending}
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 15.5, color: '#111', padding: '11px 0', fontFamily: 'inherit' }}
            />
          </div>
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #F97316, #EA580C)', boxShadow: '0 2px 8px rgba(234,88,12,0.35)', opacity: (!newMessage.trim() || sending) ? 0.5 : 1 }}
          >
            {sending
              ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <Send className="w-[18px] h-[18px] text-white" style={{ transform: 'scaleX(-1)' }} />}
          </button>
        </form>
      </div>

      {openEvent && (
        <EventDetailsModal
          event={openEvent}
          currentUserId={currentUserId}
          onClose={() => setOpenEvent(null)}
        />
      )}

    </div>
  );
}
