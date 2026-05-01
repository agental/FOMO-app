import { useState, useEffect, useRef } from 'react';
import { ArrowRight, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserAvatar } from './UserAvatar';

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
};

export function ChatScreen({ conversationId, currentUserId, otherUserId, onBack }: ChatScreenProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadOtherUser();
    loadMessages();
    markMessagesAsRead();

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
            return [...prev, newMsg];
          });
          if (newMsg.sender_id !== currentUserId) {
            markMessagesAsRead();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadOtherUser = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, display_name, avatar_url')
        .eq('id', otherUserId)
        .maybeSingle();

      if (error) throw error;
      if (data) setOtherUser(data);
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
      setMessages(data || []);
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMessage.trim() || sending) return;

    const messageContent = newMessage.trim();
    setNewMessage('');
    setSending(true);

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
        setMessages(prev => [...prev, data]);
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
      <div className="min-h-screen bg-gradient-to-br from-brand-50/30 via-white to-brand-50/30 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50/30 via-white to-brand-50/30 flex flex-col" style={{ fontFamily: 'Rubik, sans-serif' }}>
      <div className="sticky top-0 z-10 bg-gradient-to-r from-brand-500 to-brand-600 px-6 py-4 shadow-lg">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-white/20 rounded-full transition-colors active:scale-95"
          >
            <ArrowRight className="w-6 h-6 text-white" />
          </button>
          <UserAvatar
            userId={otherUser.id}
            displayName={otherUser.display_name}
            avatarUrl={otherUser.avatar_url}
            size="medium"
          />
          <h1 className="text-xl font-bold text-white">{otherUser.display_name}</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((message, index) => (
          <div key={message.id}>
            {shouldShowDateHeader(index) && (
              <div className="flex justify-center my-4">
                <div className="px-4 py-1 bg-white/70 rounded-full shadow-sm">
                  <span className="text-xs font-medium text-gray-600">
                    {formatDateHeader(message.created_at)}
                  </span>
                </div>
              </div>
            )}

            <div className={`flex ${message.sender_id === currentUserId ? 'justify-start' : 'justify-end'}`}>
              <div
                className={`max-w-[75%] px-4 py-2 rounded-2xl shadow-sm ${
                  message.sender_id === currentUserId
                    ? 'bg-gradient-to-br from-brand-500 to-brand-600 text-white rounded-br-md'
                    : 'bg-white text-gray-800 rounded-bl-md'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                <span
                  className={`text-xs mt-1 block ${
                    message.sender_id === currentUserId ? 'text-brand-100' : 'text-gray-400'
                  }`}
                >
                  {formatTime(message.created_at)}
                </span>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="sticky bottom-0 bg-white px-4 py-4 shadow-lg border-t border-gray-100">
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="כתוב הודעה..."
            className="flex-1 px-4 py-3 bg-gray-100 rounded-full border-none focus:outline-none focus:ring-2 focus:ring-brand-300"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="w-12 h-12 bg-gradient-to-br from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 disabled:from-gray-300 disabled:to-gray-400 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 disabled:cursor-not-allowed"
          >
            {sending ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Send className="w-5 h-5 text-white" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
