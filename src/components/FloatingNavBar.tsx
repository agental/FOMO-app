import { useState, useEffect } from 'react';
import { Home, Map, Plus, MessageCircle, CalendarCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

type NavBarProps = {
  activeTab?: 'home' | 'map' | 'chat' | 'myEvents' | 'settings';
  currentUserId?: string | null;
  onHomeClick?: () => void;
  onMapClick?: () => void;
  onCreateClick?: () => void;
  onChatClick?: () => void;
  onMyEventsClick?: () => void;
  /** @deprecated Settings moved to the profile page; kept so existing callers don't break. */
  onSettingsClick?: () => void;
};

export function FloatingNavBar({
  activeTab = 'home',
  currentUserId,
  onHomeClick,
  onMapClick,
  onCreateClick,
  onChatClick,
  onMyEventsClick,
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
    <div className="fixed bottom-0 left-0 right-0 z-20 pointer-events-none" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex justify-center pb-2 px-6">
        <div
          className="rounded-full pointer-events-auto border border-white/40"
          style={{
            background: 'rgba(255, 255, 255, 0.55)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.12), 0 4px 15px rgba(0, 0, 0, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.6)',
          }}
        >
          <div className="flex items-center justify-center gap-3 px-7 py-2 relative">
            <button
              onClick={onHomeClick}
              className="p-1.5 transition-all active:scale-95 flex flex-col items-center gap-0.5"
              aria-label="בית"
            >
              <div className={`w-9 h-9 flex items-center justify-center rounded-full transition-all duration-300 ${
                activeTab === 'home' ? 'scale-110' : 'hover:bg-gray-50'
              }`}>
                <Home className="w-5 h-5" strokeWidth={2.5} style={{ color: activeTab === 'home' ? '#F97316' : '#9ca3af' }} />
              </div>
              <div className="w-1 h-1 rounded-full transition-all duration-300" style={{ background: activeTab === 'home' ? '#F97316' : 'transparent' }} />
            </button>

            <button
              onClick={onMapClick}
              className="p-1.5 transition-all active:scale-95 flex flex-col items-center gap-0.5"
              aria-label="מפה"
            >
              <div className={`w-9 h-9 flex items-center justify-center rounded-full transition-all duration-300 ${
                activeTab === 'map' ? 'scale-110' : 'hover:bg-gray-50'
              }`}>
                <Map className="w-4.5 h-4.5" strokeWidth={2} style={{ color: activeTab === 'map' ? '#F97316' : '#9ca3af' }} />
              </div>
              <div className="w-1 h-1 rounded-full transition-all duration-300" style={{ background: activeTab === 'map' ? '#F97316' : 'transparent' }} />
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
              className="p-1.5 transition-all active:scale-95 relative flex flex-col items-center gap-0.5"
              aria-label="צ'אט"
            >
              <div className={`w-9 h-9 flex items-center justify-center rounded-full transition-all duration-300 ${
                activeTab === 'chat' ? 'scale-110' : 'hover:bg-gray-50'
              }`}>
                <MessageCircle className="w-4.5 h-4.5" strokeWidth={2} style={{ color: activeTab === 'chat' ? '#F97316' : '#9ca3af' }} />
              </div>
              {unreadCount > 0 && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full flex items-center justify-center border-2 border-white shadow-lg animate-pulse">
                  <span className="text-[10px] font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                </div>
              )}
              <div className="w-1 h-1 rounded-full transition-all duration-300" style={{ background: activeTab === 'chat' ? '#F97316' : 'transparent' }} />
            </button>

            <button
              onClick={onMyEventsClick}
              className="p-1.5 transition-all active:scale-95 flex flex-col items-center gap-0.5"
              aria-label="האירועים שלי"
            >
              <div className={`w-9 h-9 flex items-center justify-center rounded-full transition-all duration-300 ${
                activeTab === 'myEvents'
                  ? 'scale-110'
                  : 'hover:bg-gray-50'
              }`}>
                <CalendarCheck className="w-4.5 h-4.5" strokeWidth={2} style={{ color: activeTab === 'myEvents' ? '#F97316' : '#9ca3af' }} />
              </div>
              <div className="w-1 h-1 rounded-full transition-all duration-300" style={{ background: activeTab === 'myEvents' ? '#F97316' : 'transparent' }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
