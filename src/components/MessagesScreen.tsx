import { useState, useEffect, useRef } from 'react';
import { Search, MessageCircle, Plus, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserAvatar } from './UserAvatar';
import { COUNTRIES } from '../utils/countries';
import { FloatingNavBar } from './FloatingNavBar';

type Conversation = {
  id: string;
  participant_1_id: string;
  participant_2_id: string;
  last_message_at: string;
  other_user: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  };
  last_message: {
    content: string;
    sender_id: string;
  } | null;
  unread_count: number;
};

type MessagesScreenProps = {
  currentUserId: string;
  onBack: () => void;
  onConversationClick: (conversationId: string, otherUserId: string) => void;
  onHomeClick?: () => void;
  onMapClick?: () => void;
  onCreateClick?: () => void;
  onSettingsClick?: () => void;
};

const DEMO_COUNTRIES = ['TH', 'JP', 'IT', 'FR', 'US', 'GR'];

export function MessagesScreen({ currentUserId, onBack, onConversationClick, onHomeClick, onMapClick, onCreateClick, onSettingsClick }: MessagesScreenProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const [userCountries, setUserCountries] = useState<string[]>(DEMO_COUNTRIES);
  const touchStartX = useRef<number>(0);

  useEffect(() => {
    loadConversations();
    loadUserCountries();

    const messagesChannel = supabase
      .channel('messages-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        loadConversations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
    };
  }, [currentUserId]);

  const loadUserCountries = async () => {
    try {
      const { data } = await supabase
        .from('users')
        .select('selected_countries')
        .eq('id', currentUserId)
        .maybeSingle();
      if (data?.selected_countries && data.selected_countries.length > 0) {
        setUserCountries(data.selected_countries.slice(0, 8));
      }
    } catch {}
  };

  const loadConversations = async () => {
    try {
      const { data: convos, error } = await supabase
        .from('conversations')
        .select('*')
        .or(`participant_1_id.eq.${currentUserId},participant_2_id.eq.${currentUserId}`)
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      if (!convos || convos.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const conversationsWithDetails = await Promise.all(
        convos.map(async (convo) => {
          const otherUserId = convo.participant_1_id === currentUserId
            ? convo.participant_2_id
            : convo.participant_1_id;

          const [userResult, lastMessageResult, unreadResult] = await Promise.all([
            supabase.from('users').select('id, display_name, avatar_url').eq('id', otherUserId).maybeSingle(),
            supabase.from('messages').select('content, sender_id').eq('conversation_id', convo.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
            supabase.from('messages').select('id', { count: 'exact', head: true }).eq('conversation_id', convo.id).eq('is_read', false).neq('sender_id', currentUserId)
          ]);

          return {
            id: convo.id,
            participant_1_id: convo.participant_1_id,
            participant_2_id: convo.participant_2_id,
            last_message_at: convo.last_message_at,
            other_user: userResult.data || { id: otherUserId, display_name: 'משתמש', avatar_url: null },
            last_message: lastMessageResult.data,
            unread_count: unreadResult.count || 0
          };
        })
      );

      setConversations(conversationsWithDetails);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleTouchStart = (e: React.TouchEvent, _id: string) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent, id: string) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 60) {
      setSwipedId(id);
    } else if (diff < -20) {
      setSwipedId(null);
    }
  };

  const filteredConversations = conversations.filter(convo =>
    convo.other_user.display_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'עכשיו';
    if (diffMins < 60) return `${diffMins}ד`;
    if (diffHours < 24) return `${diffHours}ש`;
    if (diffDays < 7) return `${diffDays}י`;
    return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex flex-col" style={{ fontFamily: 'Rubik, sans-serif' }} dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-100/80 px-4 pt-4 pb-3">
        <h1 className="text-[22px] font-bold text-[#111] mb-4" style={{ fontFamily: 'Heebo, sans-serif' }}>
          הודעות
        </h1>

        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="חפש שיחה..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-10 pl-4 py-2.5 bg-gray-100 rounded-full border-none focus:outline-none focus:ring-2 focus:ring-brand-300/60 focus:bg-white transition-all text-[14px] text-gray-800 placeholder-gray-400"
            style={{ fontFamily: 'Rubik, sans-serif' }}
          />
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto pb-28">
        {/* Groups / Countries Section */}
        <div className="pt-4 pb-2">
          <p className="text-[13px] font-bold text-gray-400 px-4 mb-3 tracking-wide">קבוצות</p>
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex gap-3 px-4 pb-1" style={{ width: 'max-content' }}>
              {/* Add button */}
              <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300">
                  <Plus className="w-5 h-5 text-gray-400" strokeWidth={2.5} />
                </div>
                <span className="text-[11px] text-gray-400 font-medium">הוסף</span>
              </div>

              {userCountries.map((code, idx) => {
                const country = COUNTRIES[code];
                if (!country) return null;
                const isActive = idx < 3;
                return (
                  <div key={code} className="flex flex-col items-center gap-1.5 flex-shrink-0">
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center p-[2.5px]"
                      style={isActive ? {
                        background: 'linear-gradient(135deg, #14B8A6, #0D9488)'
                      } : {
                        background: '#e5e7eb'
                      }}
                    >
                      <div className="w-full h-full bg-white rounded-full flex items-center justify-center text-2xl">
                        {country.flag}
                      </div>
                    </div>
                    <span className="text-[11px] text-gray-500 font-medium max-w-[56px] text-center truncate">
                      {country.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gray-100 mx-4 my-2" />

        {/* Chat List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-3 border-gray-200 border-t-brand-500 rounded-full animate-spin" style={{ borderWidth: '3px' }}></div>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <MessageCircle className="w-9 h-9 text-gray-300" strokeWidth={1.5} />
            </div>
            <h2 className="text-base font-bold text-gray-700 mb-1" style={{ fontFamily: 'Heebo, sans-serif' }}>
              אין שיחות
            </h2>
            <p className="text-[13px] text-gray-400 text-center">
              {searchQuery ? 'לא נמצאו שיחות' : 'התחל שיחה עם משתמש מהפרופיל שלו'}
            </p>
          </div>
        ) : (
          <div className="px-0 pt-1">
            {filteredConversations.map((conversation) => {
              const isUnread = conversation.unread_count > 0;
              const isSwiped = swipedId === conversation.id;

              return (
                <div
                  key={conversation.id}
                  className="relative overflow-hidden"
                  onTouchStart={(e) => handleTouchStart(e, conversation.id)}
                  onTouchEnd={(e) => handleTouchEnd(e, conversation.id)}
                >
                  {/* Swipe actions (behind the row) */}
                  <div className="absolute inset-y-0 left-0 flex items-center">
                    <button
                      className="h-full px-5 bg-rose-500 text-white text-xs font-bold flex items-center gap-1"
                      onClick={() => setSwipedId(null)}
                    >
                      <X className="w-4 h-4" />
                      מחק
                    </button>
                  </div>

                  {/* Row */}
                  <button
                    onClick={() => {
                      if (isSwiped) {
                        setSwipedId(null);
                      } else {
                        onConversationClick(conversation.id, conversation.other_user.id);
                      }
                    }}
                    className="w-full flex items-center gap-3 px-4 bg-[#F8F9FB] active:scale-[0.98] transition-all duration-150"
                    style={{
                      height: '72px',
                      transform: isSwiped ? 'translateX(-80px)' : 'translateX(0)',
                      transition: 'transform 0.25s ease',
                      paddingTop: '6px',
                      paddingBottom: '6px'
                    }}
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      {isUnread ? (
                        <div
                          className="w-[52px] h-[52px] rounded-full p-[2px] flex items-center justify-center"
                          style={{ background: 'linear-gradient(135deg, #14B8A6, #0D9488)' }}
                        >
                          <div className="w-full h-full bg-white rounded-full overflow-hidden flex items-center justify-center">
                            <UserAvatar
                              userId={conversation.other_user.id}
                              displayName={conversation.other_user.display_name}
                              avatarUrl={conversation.other_user.avatar_url}
                              size="medium"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="w-[52px] h-[52px] rounded-full overflow-hidden flex items-center justify-center ring-2 ring-gray-100">
                          <UserAvatar
                            userId={conversation.other_user.id}
                            displayName={conversation.other_user.display_name}
                            avatarUrl={conversation.other_user.avatar_url}
                            size="medium"
                          />
                        </div>
                      )}
                      {isUnread && (
                        <div
                          className="absolute -bottom-0.5 -left-0.5 min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center border-2 border-[#F8F9FB]"
                          style={{ background: 'linear-gradient(135deg, #14B8A6, #0D9488)' }}
                        >
                          <span className="text-[10px] font-bold text-white leading-none">
                            {conversation.unread_count > 9 ? '9+' : conversation.unread_count}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 text-right">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[12px] text-gray-400 font-normal flex-shrink-0 ml-2">
                          {formatTime(conversation.last_message_at)}
                        </span>
                        <h3
                          className={`text-[15px] truncate ${isUnread ? 'font-bold text-[#111]' : 'font-semibold text-[#333]'}`}
                          style={{ fontFamily: 'Heebo, sans-serif' }}
                        >
                          {conversation.other_user.display_name}
                        </h3>
                      </div>
                      {conversation.last_message && (
                        <p
                          className={`text-[13px] truncate ${isUnread ? 'text-[#444] font-medium' : 'text-gray-400 font-normal'}`}
                          dir="rtl"
                        >
                          {conversation.last_message.sender_id === currentUserId && (
                            <span className="text-gray-300">אתה: </span>
                          )}
                          {conversation.last_message.content}
                        </p>
                      )}
                    </div>
                  </button>

                  {/* Subtle separator */}
                  <div className="h-px bg-gray-100 mx-4" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Navigation Bar */}
      <FloatingNavBar
        activeTab="chat"
        currentUserId={currentUserId}
        onHomeClick={onHomeClick}
        onMapClick={onMapClick}
        onCreateClick={onCreateClick}
        onChatClick={onBack}
        onSettingsClick={onSettingsClick}
      />
    </div>
  );
}
