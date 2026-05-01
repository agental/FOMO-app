import { useState, useEffect, useRef } from 'react';
import { X, Send, ArrowRight } from 'lucide-react';
import { supabase, type Meetup } from '../lib/supabase';

interface Message {
  id: string;
  meetup_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  users?: { display_name: string; avatar_url?: string | null };
}

interface MeetupGroupChatProps {
  meetup: Meetup;
  currentUserId: string;
  onClose: () => void;
}

export function MeetupGroupChat({ meetup, currentUserId, onClose }: MeetupGroupChatProps) {
  const [messages,   setMessages]   = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending,    setSending]    = useState(false);
  const [loading,    setLoading]    = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadMessages = async () => {
    const { data, error: e } = await supabase
      .from('meetup_messages')
      .select('*, users(display_name, avatar_url)')
      .eq('meetup_id', meetup.id)
      .order('created_at', { ascending: true });
    if (e) {
      console.error('loadMessages error:', JSON.stringify(e));
      // Fallback: without join
      const { data: d2 } = await supabase
        .from('meetup_messages')
        .select('*')
        .eq('meetup_id', meetup.id)
        .order('created_at', { ascending: true });
      if (d2) setMessages(d2 as Message[]);
    } else if (data) {
      setMessages(data as Message[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadMessages();

    const channel = supabase
      .channel(`meetup-chat-${meetup.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'meetup_messages', filter: `meetup_id=eq.${meetup.id}` },
        () => loadMessages(),
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [meetup.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const content = newMessage.trim();
    if (!content || sending) return;
    setSending(true);
    setNewMessage('');
    try {
      const { error } = await supabase.from('meetup_messages').insert({
        meetup_id: meetup.id,
        sender_id: currentUserId,
        content,
      });
      if (error) throw error;
    } catch (err) {
      alert('שגיאה בשליחה');
      setNewMessage(content);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      className="fixed inset-0 bg-white z-[70] flex flex-col"
      dir="rtl"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white flex-shrink-0">
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
        >
          <ArrowRight className="w-5 h-5 text-gray-600" />
        </button>
        <div className="w-10 h-10 rounded-2xl bg-orange-100 border border-orange-200 flex items-center justify-center text-2xl flex-shrink-0">
          {meetup.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 truncate">{meetup.text}</p>
          <p className="text-xs text-gray-500">{meetup.attendees.length} משתתפים</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
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
                  <span className="text-[10px] text-gray-400 mt-1 px-1">{formatTime(msg.created_at)}</span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-gray-100 bg-white flex items-end gap-3">
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
