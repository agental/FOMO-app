import { useState } from 'react';
import { Clock, Tag, MoveVertical as MoreVertical } from 'lucide-react';
import type { Event } from '../lib/supabase';
import { UserAvatar } from './UserAvatar';
import { getCategoryColor, getCategoryEmoji } from '../utils/eventCategories';

type EventCardProps = {
  event: Event;
  currentUserId?: string | null;
  onAttendClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onUserClick?: (userId: string) => void;
  isAdmin?: boolean;
};

const CATEGORY_IMAGES: Record<string, string> = {
  parties:   'https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg?auto=compress&cs=tinysrgb&w=400',
  treks:     'https://images.pexels.com/photos/2662116/pexels-photo-2662116.jpeg?auto=compress&cs=tinysrgb&w=400',
  food:      'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
  sports:    'https://images.pexels.com/photos/390051/surfer-wave-sunset-the-indian-ocean-390051.jpeg?auto=compress&cs=tinysrgb&w=400',
  workshops: 'https://images.pexels.com/photos/3822622/pexels-photo-3822622.jpeg?auto=compress&cs=tinysrgb&w=400',
};

export function EventCard({
  event, currentUserId, onAttendClick, onEdit, onDelete, onUserClick, isAdmin = false,
}: EventCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  const isOwner     = currentUserId === event.user_id;
  const canManage   = isOwner || isAdmin;
  const isAttending = currentUserId ? event.attendees.includes(currentUserId) : false;
  const isUnlimited = event.max_attendees >= 9999;

  const accentColor  = getCategoryColor(event.event_type || '');
  const emoji        = event.emoji || getCategoryEmoji(event.event_type || '');
  const price        = (event as any).price;
  const displayImage = event.image_url || (event.event_type ? CATEGORY_IMAGES[event.event_type] : null);

  const eventDateStr = event.event_date || (event as any).date || '';
  const eventDate    = new Date(eventDateStr);
  const timeStr      = eventDateStr
    ? eventDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
    : '';
  const dateStr = eventDateStr
    ? eventDate.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })
    : '';

  return (
    <div
      className="bg-white rounded-[20px] overflow-hidden active:scale-[0.98] transition-transform relative"
      style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
    >
      {/* manage menu */}
      {canManage && (
        <div className="absolute top-3 left-3 z-10">
          <button
            onClick={e => { e.stopPropagation(); setShowMenu(m => !m); }}
            className="w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center"
          >
            <MoreVertical className="w-4 h-4 text-white" />
          </button>
          {showMenu && (
            <div className="absolute top-9 left-0 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden min-w-[110px] z-20">
              {onEdit && (
                <button
                  onClick={e => { e.stopPropagation(); setShowMenu(false); onEdit(); }}
                  className="w-full px-4 py-2.5 text-right text-sm font-medium text-gray-700 hover:bg-gray-50"
                  style={{ fontFamily: 'Heebo, sans-serif' }}
                >ערוך</button>
              )}
              {onDelete && (
                <button
                  onClick={e => { e.stopPropagation(); setShowMenu(false); onDelete(); }}
                  className="w-full px-4 py-2.5 text-right text-sm font-medium text-red-600 hover:bg-red-50"
                  style={{ fontFamily: 'Heebo, sans-serif' }}
                >מחק</button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-4 p-4" dir="rtl">
        {/* Thumbnail */}
        <div className="relative flex-shrink-0 w-[88px] h-[88px] rounded-[16px] overflow-hidden">
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${accentColor}cc, ${accentColor})` }} />
          {displayImage && (
            <img
              src={displayImage} alt={event.title}
              className="absolute inset-0 w-full h-full object-cover"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          {/* emoji badge */}
          <div className="absolute -bottom-1 -left-1 text-[22px] leading-none drop-shadow-md">
            {emoji}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
          <div>
            <h3
              className="text-[16px] font-black text-gray-900 leading-tight mb-1.5 truncate"
              style={{ fontFamily: 'Heebo, sans-serif' }}
            >
              {event.title}
            </h3>
            <div className="flex items-center gap-2.5 text-[12px] text-gray-400 flex-wrap">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {dateStr} · {timeStr}
              </span>
              {price ? (
                <span className="flex items-center gap-1 font-bold" style={{ color: accentColor }}>
                  <Tag className="w-3 h-3" />₪{price}
                </span>
              ) : (
                <span className="font-medium text-gray-400">חינם</span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mt-2">
            <span className="text-[11px] text-gray-400">
              {isUnlimited
                ? `${event.attendees.length} משתתפים`
                : `${event.attendees.length}/${event.max_attendees}`}
            </span>
            <button
              onClick={e => { e.stopPropagation(); onAttendClick(); }}
              className="px-4 py-1.5 rounded-[12px] text-[13px] font-bold text-white active:scale-95 transition-transform"
              style={{
                background: isAttending
                  ? 'linear-gradient(135deg,#ef4444,#dc2626)'
                  : `linear-gradient(135deg, ${accentColor}, ${accentColor}bb)`,
                boxShadow: `0 3px 10px ${accentColor}40`,
                fontFamily: 'Heebo, sans-serif',
              }}
            >
              {isAttending ? 'ביטול' : 'הצטרף!'}
            </button>
          </div>
        </div>

        {/* Creator avatar */}
        {event.users && (
          <div
            className="flex-shrink-0 self-center cursor-pointer"
            onClick={e => { e.stopPropagation(); onUserClick?.(event.user_id); }}
          >
            <UserAvatar avatarUrl={event.users.avatar_url} displayName={event.users.display_name} size="small" />
          </div>
        )}
      </div>
    </div>
  );
}
