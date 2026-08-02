import { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { Send, ChevronDown, MoreVertical, User as UserIcon, Flag, Ban } from 'lucide-react';
import { supabase, type Event } from '../lib/supabase';
import { UserAvatar } from './UserAvatar';
import { BackButton } from './BackButton';
import { EventChatCard } from './EventChatCard';
import { PlaceChatCard } from './PlaceChatCard';
import { EventDetailsModal } from './EventDetailsModal';
import { MessageBubble } from './MessageBubble';
import { parseEvent } from '../utils/eventMessage';
import { parsePlace, type PlacePayload } from '../utils/placeMessage';
import { setActiveChat } from '../utils/activeChat';
import { createPersistedRecord } from '../utils/warmCache';
import { blockUser, unblockUser, reportUser, getBlockedIdsCached, refreshBlockedIds } from '../services/blockService';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { useKeyboardViewport } from '../hooks/useKeyboardViewport';
import { CHAT_BG } from '../utils/chatBg';
import { showToast } from '../utils/toast';

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
  pending?: boolean; // optimistic bubble, insert not yet confirmed
  failed?: boolean;  // insert failed — show a retry-hint mark
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
  onOpenMapAt?: (lat: number, lng: number, placeId?: string, place?: PlacePayload) => void;
  onNavigateToUserProfile?: (userId: string) => void;
};

/* ── module-level caches (survive navigation AND cold start via localStorage) ── */
const _chatMsgCache = createPersistedRecord<Message[]>('chatMsgs', { entryCap: 30 });
const _chatUserCache = createPersistedRecord<OtherUser>('chatUsers');

/** Append an incoming direct message to the persisted cache from OUTSIDE the chat (the global
 *  realtime listener calls this even when the chat is closed), so opening the chat later shows the
 *  new messages INSTANTLY from cache instead of only after the network fetch. */
/** Cache keys are scoped PER VIEWER (`<viewerId>:<conversationId>`) so a different account signing
 *  in on the same device can never read the previous user's cached messages. */
export const dmCacheKey = (viewerId: string, id: string | null | undefined) => (id ? `${viewerId}:${id}` : '');

export function cacheIncomingDirectMessage(row: {
  id: string; conversation_id: string; sender_id: string; content: string; created_at: string; is_read: boolean;
}, viewerId: string): void {
  if (!row || !row.conversation_id || !row.id || !viewerId) return;
  const k = dmCacheKey(viewerId, row.conversation_id);
  const existing = _chatMsgCache[k] || [];
  if (existing.some(m => m.id === row.id)) return;
  _chatMsgCache[k] = [...existing, row];
}

export function ChatScreen({ conversationId, currentUserId, otherUserId, onBack, onOpenMapAt, onNavigateToUserProfile }: ChatScreenProps) {
  const ck = (id: string | null | undefined) => dmCacheKey(currentUserId, id);
  const swipeRef = useSwipeBack<HTMLDivElement>(onBack); // swipe from an edge to slide the chat back
  const [messages, setMessages] = useState<Message[]>(_chatMsgCache[ck(conversationId)] ?? []);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(_chatUserCache[otherUserId] ?? null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(!_chatMsgCache[ck(conversationId)]?.length);
  const [sending, setSending] = useState(false);
  const [openEvent, setOpenEvent] = useState<Event | null>(null);
  const [otherTyping, setOtherTyping] = useState(false); // is the other person typing right now
  const [showScroll, setShowScroll] = useState(false); // show the "jump to bottom" button when scrolled up
  const [unreadNew, setUnreadNew] = useState(0); // count of messages arrived while scrolled up
  const [showMenu, setShowMenu] = useState(false);       // header 3-dots menu
  const [confirmBlock, setConfirmBlock] = useState(false); // inline "are you sure?" for block
  const [reportMode, setReportMode] = useState(false);     // inline "write the reason" for report
  const [reportReason, setReportReason] = useState('');
  const [isBlocked, setIsBlocked] = useState(() => getBlockedIdsCached(currentUserId).has(otherUserId)); // did I block this user?

  // Confirm the block state against the DB (cache is instant but may be stale).
  useEffect(() => {
    refreshBlockedIds(currentUserId).then(ids => setIsBlocked(ids.has(otherUserId)));
  }, [currentUserId, otherUserId]);
  const [reconnectTick, setReconnectTick] = useState(0); // bump to force the realtime channels to rebuild
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set()); // only NEW messages get the pop-in
  const seenInitRef = useRef(false);
  const typingChanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingHbRef = useRef<ReturnType<typeof setInterval> | null>(null);   // MY heartbeat while typing
  const typingStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);  // MY stop-after-inactivity timer
  const otherTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // clear the OTHER's dot if heartbeats stop
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
  // Keyboard: GPU-transform the messages + input bar up in sync with the keyboard (header stays fixed).
  useKeyboardViewport(swipeRef, scrollContainerRef, inputBarRef);

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

  // Re-pin to bottom ONLY when the user is already at the bottom (e.g. first open). Guarded by
  // atBottomRef so a header/input height change (like the input bar shrinking when the keyboard opens
  // and the home-indicator inset disappears) does NOT yank a user who's reading history to the bottom.
  useLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [headerH, inputH]);

  // Mark this DM as the active chat so global notifications don't buzz for it.
  useEffect(() => { setActiveChat(conversationId); return () => setActiveChat(null); }, [conversationId]);

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
            if (prev.some(msg => msg.id === newMsg.id)) return prev;
            // If this is the confirmed insert of one of my optimistic bubbles, swap it in place.
            const base = newMsg.sender_id === currentUserId
              ? prev.filter(m => !(m.pending && m.content === newMsg.content))
              : prev;
            const updated = [...base, newMsg];
            _chatMsgCache[ck(conversationId)] = updated;
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

    // Typing + message relay — ephemeral broadcast topic. Broadcast is ~100ms (vs presence ~900ms),
    // so it feels instant. The typer sends a "typing" heartbeat every 1.2s while typing, so a listener
    // who opens mid-typing catches it within ~1s (and the dot auto-clears 4s after the last heartbeat).
    const typingChannel = supabase
      .channel(`dm-typing-${conversationId}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if ((payload as { userId?: string })?.userId === currentUserId) return;
        setOtherTyping(true);
        if (otherTypingTimerRef.current) clearTimeout(otherTypingTimerRef.current);
        otherTypingTimerRef.current = setTimeout(() => setOtherTyping(false), 4000);
      })
      .on('broadcast', { event: 'stop' }, ({ payload }) => {
        if ((payload as { userId?: string })?.userId === currentUserId) return;
        if (otherTypingTimerRef.current) { clearTimeout(otherTypingTimerRef.current); otherTypingTimerRef.current = null; }
        setOtherTyping(false);
      })
      .on('broadcast', { event: 'msg' }, ({ payload }) => {
        const newMsg = payload as Message;
        if (!newMsg?.id || newMsg.sender_id === currentUserId) return;
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          const updated = [...prev, newMsg];
          _chatMsgCache[ck(conversationId)] = updated;
          return updated;
        });
        markMessagesAsRead();
        setOtherTyping(false);
      })
      .subscribe();
    typingChanRef.current = typingChannel;

    return () => {
      if (typingHbRef.current) { clearInterval(typingHbRef.current); typingHbRef.current = null; }
      if (typingStopRef.current) { clearTimeout(typingStopRef.current); typingStopRef.current = null; }
      if (otherTypingTimerRef.current) { clearTimeout(otherTypingTimerRef.current); otherTypingTimerRef.current = null; }
      if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
      typingChanRef.current = null;
      supabase.removeChannel(channel);
      supabase.removeChannel(typingChannel);
    };
  }, [conversationId, currentUserId, reconnectTick]);

  // Broadcast a "typing" heartbeat while the user types; stop (and tell the other side) on pause/send.
  const emitTyping = () => {
    const ch = typingChanRef.current;
    if (!ch) return;
    if (!typingHbRef.current) {
      ch.send({ type: 'broadcast', event: 'typing', payload: { userId: currentUserId } });
      typingHbRef.current = setInterval(() => ch.send({ type: 'broadcast', event: 'typing', payload: { userId: currentUserId } }), 1200);
    }
    if (typingStopRef.current) clearTimeout(typingStopRef.current);
    typingStopRef.current = setTimeout(stopTyping, 3000);
  };
  const stopTyping = () => {
    if (typingStopRef.current) { clearTimeout(typingStopRef.current); typingStopRef.current = null; }
    if (typingHbRef.current) {
      clearInterval(typingHbRef.current); typingHbRef.current = null;
      typingChanRef.current?.send({ type: 'broadcast', event: 'stop', payload: { userId: currentUserId } });
    }
  };

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

  // When the "typing…" indicator appears/disappears it adds a row at the bottom — scroll so it's
  // fully visible above the input bar (otherwise it sits half-hidden behind it), matching city chats.
  useEffect(() => {
    if (otherTyping && atBottomRef.current) scrollToBottom(true);
  }, [otherTyping]);

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
    // The cached value already rendered instantly (useState init). Still REVALIDATE every open so a
    // changed avatar / display name updates — otherwise the persisted cache would pin a stale picture
    // forever (that was the "different photo in the chat vs. the list" bug).
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
      // Only the latest 50 — a chat with thousands of messages must still open instantly.
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      const msgs = (data || []).reverse(); // back to chronological order
      // Keep any still-pending optimistic bubbles the network fetch doesn't know about yet.
      setMessages(prev => {
        const pending = prev.filter(m => m.pending || m.failed);
        const fetchedIds = new Set(msgs.map(m => m.id));
        const merged = [...msgs, ...pending.filter(p => !fetchedIds.has(p.id))];
        _chatMsgCache[ck(conversationId)] = merged;
        return merged;
      });
      msgs.forEach(m => seenIdsRef.current.add(m.id)); // fetched batch, not "new" → no pop-in on first open
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
    try {
      const { data } = await supabase.from('events').select('*').eq('id', id).maybeSingle();
      if (data) setOpenEvent(data as Event);
    } catch (e) {
      console.error('[ChatScreen] openEventById failed:', e);
    }
  };

  const openPlaceById = async (id: string) => {
    try {
      const { data } = await supabase.from('admin_locations').select('*').eq('id', id).maybeSingle();
      if (data) setOpenPlace(data as AdminLocation);
    } catch (e) {
      console.error('[ChatScreen] openPlaceById failed:', e);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMessage.trim() || sending) return;

    const messageContent = newMessage.trim();
    setNewMessage('');
    setSending(true);
    stopTyping();

    // Optimistic bubble — appears instantly (WhatsApp-style), replaced by the server row on success.
    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: currentUserId,
      content: messageContent,
      created_at: new Date().toISOString(),
      is_read: false,
      pending: true,
    };
    seenIdsRef.current.add(tempId); // no pop-in animation for my own bubble
    setMessages(prev => {
      const updated = [...prev, optimistic];
      _chatMsgCache[ck(conversationId)] = updated;
      return updated;
    });
    inputRef.current?.focus();

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
        // Swap the temp bubble for the real row (and drop any duplicate the realtime echo already added).
        seenIdsRef.current.add(data.id);
        setMessages(prev => {
          const withoutTemp = prev.filter(m => m.id !== tempId);
          const updated = withoutTemp.some(m => m.id === data.id) ? withoutTemp : [...withoutTemp, data];
          _chatMsgCache[ck(conversationId)] = updated;
          return updated;
        });
        // Relay to the other participant for instant delivery (independent of DB replication)
        typingChanRef.current?.send({ type: 'broadcast', event: 'msg', payload: data });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Mark the optimistic bubble as failed so the user sees it didn't send.
      setMessages(prev => {
        const updated = prev.map(m => m.id === tempId ? { ...m, pending: false, failed: true } : m);
        _chatMsgCache[ck(conversationId)] = updated;
        return updated;
      });
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
            <div style={popStyle}><PlaceChatCard data={plc} onClick={() => onOpenMapAt?.(plc.lat, plc.lng, plc.id, plc)} /></div>
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
            <span style={{ fontSize: 10, color: message.failed ? '#DC2626' : '#9AA0A6', marginTop: 3, paddingInline: 2, fontVariantNumeric: 'tabular-nums' }}>
              {message.failed ? 'לא נשלח ⚠️' : message.pending ? 'שולח… 🕓' : formatTime(message.created_at)}
            </span>
          )}
        </div>
      </div>
    );
  };

  // Memoize the message list so it re-renders ONLY when messages change — not on the frequent
  // "typing…", scroll-to-bottom button, or 3-dots menu state changes (those reuse the identical row
  // elements, so React skips re-rendering/re-measuring every bubble → WhatsApp-smooth scrolling).
  // eslint-disable-next-line react-hooks/exhaustive-deps -- callbacks inside are functional/stable.
  const messageRows = useMemo(() => messages.map((m, i) => renderMsg(m, i)), [messages]);

  if (loading || !otherUser) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F3EFE9' }}>
        <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  const submitReport = async () => {
    if (!otherUser) return;
    const ok = await reportUser(currentUserId, otherUser.id, reportReason.trim() || undefined);
    setShowMenu(false); setReportMode(false); setReportReason('');
    showToast(ok
      ? { title: 'הדיווח התקבל', text: 'תודה — נבדוק את הפנייה בהקדם.', emoji: '🚩', background: 'linear-gradient(135deg,#F59E0B,#EA580C)' }
      : { title: 'שגיאה', text: 'הדיווח לא נשלח, נסה/י שוב.', emoji: '⚠️', background: 'linear-gradient(135deg,#EF4444,#DC2626)' });
  };

  const handleBlock = async () => {
    if (!otherUser) return;
    const ok = await blockUser(currentUserId, otherUser.id);
    setShowMenu(false); setConfirmBlock(false);
    if (ok) { setIsBlocked(true); showToast({ title: `${otherUser.display_name} נחסם/ה`, text: 'ההודעות הפרטיות מושהות. אפשר לבטל בכל רגע.', emoji: '🚫', background: 'linear-gradient(135deg,#EF4444,#DC2626)' }); } // keep the chat open (WhatsApp-style)
    else showToast({ title: 'שגיאה', text: 'החסימה נכשלה, נסה/י שוב.', emoji: '⚠️', background: 'linear-gradient(135deg,#EF4444,#DC2626)' });
  };

  const handleUnblock = async () => {
    if (!otherUser) return;
    const ok = await unblockUser(currentUserId, otherUser.id);
    setShowMenu(false);
    if (ok) { setIsBlocked(false); showToast({ title: 'החסימה בוטלה', text: `אפשר לשלוח הודעות ל${otherUser.display_name} שוב.`, emoji: '✅', background: 'linear-gradient(135deg,#22c55e,#16a34a)' }); }
    else showToast({ title: 'שגיאה', text: 'ביטול החסימה נכשל, נסה/י שוב.', emoji: '⚠️', background: 'linear-gradient(135deg,#EF4444,#DC2626)' });
  };

  return (
    <div ref={swipeRef} style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '100dvh', zIndex: 120, fontFamily: "'Rubik','Heebo',sans-serif", animation: 'gchat-slide 0.28s cubic-bezier(0.25,1,0.5,1)' }}>
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
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#F3EFE9', backgroundImage: `url(${CHAT_BG})`, backgroundSize: '50%', backgroundRepeat: 'repeat' }}>
        <div ref={scrollContainerRef}
          className="scrollbar-hide"
          onScroll={e => { const el = e.currentTarget; const dist = el.scrollHeight - el.scrollTop - el.clientHeight; atBottomRef.current = dist < 80; setShowScroll(dist > 100); if (dist < 80) setUnreadNew(0); }}
          style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingTop: headerH + 10, paddingBottom: `calc(${inputH + 8}px + var(--kb-pad, 0px))` }}>
          {messageRows}

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

      {/* Glass header — lighter tint + the blur/tint FADE OUT gradually at the bottom (mask), so there's
          no hard edge: the header melts into the chat and you see the messages through it more clearly. */}
      <div ref={headerRef} style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        background: 'linear-gradient(to bottom, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.12) 58%, rgba(255,255,255,0) 100%)',
        backdropFilter: 'blur(14px) saturate(160%)', WebkitBackdropFilter: 'blur(14px) saturate(160%)',
        paddingTop: 'env(safe-area-inset-top)', paddingBottom: 20,
        WebkitMaskImage: 'linear-gradient(to bottom, #000 72%, transparent 100%)',
        maskImage: 'linear-gradient(to bottom, #000 72%, transparent 100%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px 2px' }}>
          <BackButton onClick={onBack} />
          <button
            onClick={() => onNavigateToUserProfile?.(otherUser.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: onNavigateToUserProfile ? 'pointer' : 'default' }}
          >
            <UserAvatar userId={otherUser.id} displayName={otherUser.display_name} avatarUrl={otherUser.avatar_url} size="small" />
            <h1 style={{ flex: 1, fontSize: 16, fontWeight: 700, color: '#1a1a1a', margin: 0, lineHeight: 1.2, textAlign: 'right' }} dir="rtl">{otherUser.display_name}</h1>
          </button>
          <button onClick={() => { setConfirmBlock(false); setShowMenu(v => !v); }} aria-label="עוד" style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: showMenu ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <MoreVertical size={19} style={{ color: '#333' }} />
          </button>
        </div>
      </div>

      {/* 3-dots menu — rendered OUTSIDE the glass header (as a SIBLING). The header now has a mask-image
          that fades to transparent at its bottom; a dropdown nested inside gets masked out along with it —
          which is why the menu stopped opening after the glass change. Unmasked here, it shows normally. */}
      {showMenu && (
        <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} onClick={() => { setShowMenu(false); setConfirmBlock(false); setReportMode(false); }} />
            <div style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top) + 52px)', left: 8, zIndex: 201, background: '#fff', borderRadius: 14, boxShadow: '0 4px 24px rgba(0,0,0,0.18)', border: '1px solid rgba(0,0,0,0.07)', minWidth: 210, width: reportMode ? 260 : undefined, overflow: 'hidden' }}>
              {reportMode ? (
                <div style={{ padding: '14px 16px', direction: 'rtl' }}>
                  <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#111' }}>דיווח על {otherUser.display_name}</p>
                  <textarea
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    placeholder="סיבת הדיווח (לא חובה)…"
                    dir="rtl"
                    rows={3}
                    style={{ width: '100%', boxSizing: 'border-box', resize: 'none', border: '1px solid #E5E7EB', borderRadius: 10, padding: '8px 10px', fontSize: 13.5, color: '#111', fontFamily: 'inherit', outline: 'none' }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button onClick={submitReport} style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', background: '#F59E0B', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>שלח דיווח</button>
                    <button onClick={() => { setReportMode(false); setReportReason(''); }} style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: '1px solid #E5E7EB', background: '#fff', color: '#555', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>ביטול</button>
                  </div>
                </div>
              ) : confirmBlock ? (
                <div style={{ padding: '14px 16px', direction: 'rtl' }}>
                  <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: '#111' }}>לחסום את {otherUser.display_name}? לא תוכל/י לשלוח או לקבל הודעות פרטיות. הצ׳אט יישאר וניתן לבטל בכל רגע.</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={handleBlock} style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', background: '#E53935', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>חסום</button>
                    <button onClick={() => setConfirmBlock(false)} style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: '1px solid #E5E7EB', background: '#fff', color: '#555', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>ביטול</button>
                  </div>
                </div>
              ) : (
                [
                  ...(onNavigateToUserProfile ? [{ key: 'profile', label: 'צפה בפרופיל', icon: <UserIcon size={17} />, color: '#3B82F6', tint: false, onClick: () => { setShowMenu(false); onNavigateToUserProfile(otherUser.id); } }] : []),
                  { key: 'report', label: 'דווח', icon: <Flag size={17} />, color: '#F59E0B', tint: false, onClick: () => setReportMode(true) },
                  isBlocked
                    ? { key: 'block', label: 'בטל חסימה', icon: <Ban size={17} />, color: '#16A34A', tint: true, onClick: handleUnblock }
                    : { key: 'block', label: 'חסום משתמש', icon: <Ban size={17} />, color: '#E53935', tint: true, onClick: () => setConfirmBlock(true) },
                ].map(({ key, label, icon, color, tint, onClick }) => (
                  <button key={key} onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', direction: 'rtl', fontFamily: 'inherit' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color }}>{icon}</div>
                    <span style={{ fontSize: 14, fontWeight: 500, color: tint ? color : '#111' }}>{label}</span>
                  </button>
                ))
              )}
            </div>
          </>
        )}

      {/* Glass input bar — matches the header: lighter tint + the blur/tint FADE OUT gradually at the TOP
          (mask, pixel-precise so it lives in the empty top band and never clips the row), no hard edge.
          Slightly narrower (inset) and shorter than before. */}
      <div ref={inputBarRef} style={{
        position: 'absolute', bottom: 0, left: 10, right: 10, zIndex: 10,
        background: 'linear-gradient(to top, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.12) 55%, rgba(255,255,255,0) 100%)',
        backdropFilter: 'blur(14px) saturate(160%)', WebkitBackdropFilter: 'blur(14px) saturate(160%)',
        padding: '0 6px 4px', paddingTop: 16, paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
        WebkitMaskImage: 'linear-gradient(to top, #000 calc(100% - 16px), transparent)',
        maskImage: 'linear-gradient(to top, #000 calc(100% - 16px), transparent)',
      }}>
        {isBlocked ? (
          <button onClick={handleUnblock} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 38, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            <Ban size={17} style={{ color: '#E53935' }} />
            <span dir="rtl" style={{ fontSize: 14, fontWeight: 600, color: '#6B7280' }}>
              חסמת משתמש זה. <span style={{ color: '#16A34A', fontWeight: 700 }}>הקש לביטול החסימה</span>
            </span>
          </button>
        ) : (
        <form onSubmit={handleSendMessage} style={{ display: 'flex', alignItems: 'flex-end', gap: 7 }}>
          <div style={{ flex: 1, background: '#fff', borderRadius: 21, minHeight: 38, display: 'flex', alignItems: 'center', padding: '0 13px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => {
                const v = e.target.value;
                setNewMessage(v);
                if (!v) stopTyping(); else emitTyping();
              }}
              placeholder="הודעה..."
              dir="rtl"
              disabled={sending}
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 15, color: '#111', padding: '9px 0', fontFamily: 'inherit' }}
            />
          </div>
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #F97316, #EA580C)', boxShadow: '0 2px 8px rgba(234,88,12,0.35)', opacity: (!newMessage.trim() || sending) ? 0.5 : 1 }}
          >
            {sending
              ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <Send className="w-[18px] h-[18px] text-white" style={{ transform: 'scaleX(-1)' }} />}
          </button>
        </form>
        )}
      </div>

      {openEvent && (
        <EventDetailsModal
          event={openEvent}
          currentUserId={currentUserId}
          onClose={() => setOpenEvent(null)}
          onNavigateToUserProfile={onNavigateToUserProfile}
        />
      )}

    </div>
  );
}
