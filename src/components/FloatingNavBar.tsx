import { useState, useEffect } from 'react';
import { Home, Map, Plus, MessageCircle, Settings } from 'lucide-react';
import { supabase } from '../lib/supabase';

type NavBarProps = {
  activeTab?: 'home' | 'map' | 'chat' | 'settings';
  currentUserId?: string | null;
  onHomeClick?: () => void;
  onMapClick?: () => void;
  onCreateClick?: () => void;
  onChatClick?: () => void;
  onSettingsClick?: () => void;
};

export function FloatingNavBar({
  activeTab = 'home',
  currentUserId,
  onHomeClick,
  onMapClick,
  onCreateClick,
  onChatClick,
  onSettingsClick,
}: NavBarProps) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!currentUserId) return;

    loadUnreadCount();

    const channel = supabase
      .channel('navbar-messages-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        () => {
          loadUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const loadUnreadCount = async () => {
    if (!currentUserId) return;

    try {
      const { data: convos } = await supabase
        .from('conversations')
        .select('id')
        .or(`participant_1_id.eq.${currentUserId},participant_2_id.eq.${currentUserId}`);

      if (!convos || convos.length === 0) {
        setUnreadCount(0);
        return;
      }

      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .in('conversation_id', convos.map(c => c.id))
        .eq('is_read', false)
        .neq('sender_id', currentUserId);

      setUnreadCount(count || 0);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };
  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 pointer-events-none">
      <div className="flex justify-center pb-5 px-6">
        <div className="bg-white rounded-full pointer-events-auto border border-gray-200/80" style={{ boxShadow: '0 12px 40px rgba(0, 0, 0, 0.1), 0 4px 15px rgba(0, 0, 0, 0.08)' }}>
          <div className="flex items-center justify-center gap-1 px-4 py-2 relative">
            <button
              onClick={onHomeClick}
              className="p-1.5 transition-all active:scale-95"
              aria-label="בית"
            >
              <div className={`w-9 h-9 flex items-center justify-center rounded-full transition-all duration-300 ${
                activeTab === 'home'
                  ? 'scale-110'
                  : 'hover:bg-gray-50'
              }`}>
                <Home className="w-5 h-5" strokeWidth={2.5} style={{ color: activeTab === 'home' ? '#FF9F43' : '#9ca3af' }} />
              </div>
            </button>

            <button
              onClick={onMapClick}
              className="p-1.5 transition-all active:scale-95"
              aria-label="מפה"
            >
              <div className={`w-9 h-9 flex items-center justify-center rounded-full transition-all duration-300 ${
                activeTab === 'map'
                  ? 'scale-110'
                  : 'hover:bg-gray-50'
              }`}>
                <Map className="w-4.5 h-4.5" strokeWidth={2} style={{ color: activeTab === 'map' ? '#FF9F43' : '#9ca3af' }} />
              </div>
            </button>

            <button
              onClick={onCreateClick}
              className="absolute left-1/2 -translate-x-1/2 -top-6 transition-all active:scale-95 hover:scale-110 duration-300 group"
              aria-label="צור חדש"
            >
              <div className="w-12 h-12 bg-gray-900 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all" style={{ boxShadow: '0 8px 30px rgba(0, 0, 0, 0.3), 0 0 20px rgba(0, 0, 0, 0.2)' }}>
                <Plus className="w-6 h-6 text-white group-hover:rotate-90 transition-transform duration-300 font-bold" strokeWidth={3} />
              </div>
            </button>

            <button
              onClick={onChatClick}
              className="p-1.5 transition-all active:scale-95 relative"
              aria-label="צ'אט"
            >
              <div className={`w-9 h-9 flex items-center justify-center rounded-full transition-all duration-300 ${
                activeTab === 'chat'
                  ? 'scale-110'
                  : 'hover:bg-gray-50'
              }`}>
                <MessageCircle className="w-4.5 h-4.5" strokeWidth={2} style={{ color: activeTab === 'chat' ? '#FF9F43' : '#9ca3af' }} />
              </div>
              {unreadCount > 0 && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full flex items-center justify-center border-2 border-white shadow-lg animate-pulse">
                  <span className="text-[10px] font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                </div>
              )}
            </button>

            <button
              onClick={onSettingsClick}
              className="p-1.5 transition-all active:scale-95"
              aria-label="הגדרות"
            >
              <div className={`w-9 h-9 flex items-center justify-center rounded-full transition-all duration-300 ${
                activeTab === 'settings'
                  ? 'scale-110'
                  : 'hover:bg-gray-50'
              }`}>
                <Settings className="w-4.5 h-4.5" strokeWidth={2} style={{ color: activeTab === 'settings' ? '#FF9F43' : '#9ca3af' }} />
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
