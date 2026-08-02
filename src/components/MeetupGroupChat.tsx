import { useState, useEffect, useRef } from 'react';
import { X, Send } from 'lucide-react';
import { BackButton } from './BackButton';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { useKeyboardViewport } from '../hooks/useKeyboardViewport';
import { supabase, type Meetup } from '../lib/supabase';
import { createPersistedRecord } from '../utils/warmCache';

interface Message {
  id: string;
  meetup_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  users?: { display_name: string; avatar_url?: string | null };
  pending?: boolean; // optimistic bubble, insert not yet confirmed
  failed?: boolean;  // insert failed
}

interface MeetupGroupChatProps {
  meetup: Meetup;
  currentUserId: string;
  onClose: () => void;
}

/* ── module-level cache (survives navigation AND cold start via localStorage) ── */
const _meetupMsgCache = createPersistedRecord<Message[]>('meetupMsgs', { entryCap: 30 });
// userId → display name, so an incrementally-added realtime message can show a name without a full reload.
const _meetupNameCache: Record<string, string> = {};

export function MeetupGroupChat({ meetup, currentUserId, onClose }: MeetupGroupChatProps) {
  const swipeRef = useSwipeBack<HTMLDivElement>(onClose); // swipe from an edge to slide the group chat back
  const [messages,   setMessages]   = useState<Message[]>(_meetupMsgCache[meetup.id] ?? []);
  const [newMessage, setNewMessage] = useState('');
  const [sending,    setSending]    = useState(false);
  const [loading,    setLoading]    = useState(!_meetupMsgCache[meetup.id]?.length);
  const bottomRef = useRef<HTMLDivElement>(null);
  const msgScrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  // Keyboard: GPU-transform the messages + input bar up in sync with the keyboard (header stays fixed).
  useKeyboardViewport(swipeRef, msgScrollRef, composerRef);

  const cacheMessages = (msgs: Message[]) => {
    _meetupMsgCache[meetup.id] = msgs;
    msgs.forEach(m => { if (m.users?.display_name) _meetupNameCache[m.sender_id] = m.users.display_name; });
  };

  const loadMessages = async () => {
    // Only the latest 50 — keep opening instant even for a busy meetup chat.
    const { data, error: e } = await supabase
      .from('meetup_messages')
      .select('*, users(display_name, avatar_url)')
      .eq('meetup_id', meetup.id)
      .order('created_at', { ascending: false })
      .limit(50);
    const finish = (rows: Message[]) => {
      setMessages(prev => {
        const pending = prev.filter(m => m.pending || m.failed);
        const ids = new Set(rows.map(m => m.id));
        const merged = [...rows, ...pending.filter(p => !ids.has(p.id))];
        cacheMessages(merged);
        return merged;
      });
    };
    if (e) {
      console.error('loadMessages error:', JSON.stringify(e));
      // Fallback: without join
      const { data: d2 } = await supabase
        .from('meetup_messages')
        .select('*')
        .eq('meetup_id', meetup.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (d2) finish((d2 as Message[]).reverse());
    } else if (data) {
      finish((data as Message[]).reverse());
    }
    setLoading(false);
  };

  useEffect(() => {
    loadMessages();

    const channel = supabase
      .channel(`meetup-chat-${meetup.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'meetup_messages', filter: `meetup_id=eq.${meetup.id}` },
        async (payload) => {
          // Incremental: append the single new row instead of reloading the whole thread.
          const row = payload.new as Message;
          if (row.sender_id !== currentUserId && !_meetupNameCache[row.sender_id]) {
            const { data } = await supabase.from('users').select('display_name').eq('id', row.sender_id).maybeSingle();
            if (data?.display_name) _meetupNameCache[row.sender_id] = data.display_name;
          }
          row.users = { display_name: _meetupNameCache[row.sender_id] || 'משתמש' };
          setMessages(prev => {
            if (prev.some(m => m.id === row.id)) return prev;
            // Reconcile with my own optimistic bubble, if any.
            const base = row.sender_id === currentUserId
              ? prev.filter(m => !(m.pending && m.content === row.content))
              : prev;
            const updated = [...base, row];
            cacheMessages(updated);
            return updated;
          });
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [meetup.id, currentUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const content = newMessage.trim();
    if (!content || sending) return;
    setSending(true);
    setNewMessage('');

    // Optimistic bubble — appears instantly, replaced by the server row on success.
    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId, meetup_id: meetup.id, sender_id: currentUserId,
      content, created_at: new Date().toISOString(), pending: true,
    };
    setMessages(prev => { const u = [...prev, optimistic]; cacheMessages(u); return u; });

    try {
      const { data, error } = await supabase.from('meetup_messages').insert({
        meetup_id: meetup.id,
        sender_id: currentUserId,
        content,
      }).select('*, users(display_name, avatar_url)').single();
      if (error) throw error;
      if (data) {
        setMessages(prev => {
          const withoutTemp = prev.filter(m => m.id !== tempId);
          const updated = withoutTemp.some(m => m.id === (data as Message).id) ? withoutTemp : [...withoutTemp, data as Message];
          cacheMessages(updated);
          return updated;
        });
      }
    } catch (err) {
      setMessages(prev => {
        const u = prev.map(m => m.id === tempId ? { ...m, pending: false, failed: true } : m);
        cacheMessages(u);
        return u;
      });
    } finally {
      setSending(false);
    }
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      ref={swipeRef}
      className="fixed top-0 left-0 right-0 bg-white z-[70] flex flex-col"
      dir="rtl"
      style={{ height: '100dvh', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white flex-shrink-0">
        <BackButton onClick={onClose} />
        <div className="w-10 h-10 rounded-2xl bg-orange-100 border border-orange-200 flex items-center justify-center text-2xl flex-shrink-0">
          {meetup.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 truncate">{meetup.text}</p>
          <p className="text-xs text-gray-500">{meetup.attendees.length} משתתפים</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={msgScrollRef} className="flex-1 overflow-y-auto px-4 pt-4 space-y-3 scrollbar-hide" style={{ paddingBottom: 'calc(1rem + var(--kb-pad, 0px))' }}>
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-2 border-orange-300 border-t-orange-500 rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-5xl mb-4">{meetup.emoji}</div>
            <p className="font-semibold text-gray-700">הצ׳אט פתוח!</p>
            <p className="text-sm text-gray-400 mt-1">היה הראשון לכתוב הודעה</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === currentUserId;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                  {!isMe && (
                    <span className="text-xs text-gray-500 mb-1 px-1">
                      {msg.users?.display_name || 'משתמש'}
                    </span>
                  )}
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      isMe
                        ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-br-md'
                        : 'bg-gray-100 text-gray-900 rounded-bl-md'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <span className={`text-[10px] mt-1 px-1 ${msg.failed ? 'text-red-500' : 'text-gray-400'}`}>
                    {msg.failed ? 'לא נשלח ⚠️' : msg.pending ? 'שולח… 🕓' : formatTime(msg.created_at)}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div ref={composerRef} className="flex-shrink-0 px-4 py-3 border-t border-gray-100 bg-white flex items-end gap-3">
        <textarea
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
          }}
          placeholder="כתוב הודעה..."
          rows={1}
          className="flex-1 px-4 py-3 bg-gray-100 rounded-2xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400 max-h-28"
          style={{ overflowY: newMessage.split('\n').length > 3 ? 'auto' : 'hidden' }}
        />
        <button
          onClick={sendMessage}
          disabled={!newMessage.trim() || sending}
          className="w-11 h-11 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center shadow-md shadow-orange-200 hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-40 flex-shrink-0"
        >
          <Send className="w-5 h-5 text-white" style={{ transform: 'scaleX(-1)' }} />
        </button>
      </div>
    </div>
  );
}
