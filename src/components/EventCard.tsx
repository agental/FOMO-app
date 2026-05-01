import { useState } from 'react';
import { MapPin, Clock, MoveVertical as MoreVertical, Users } from 'lucide-react';
import type { Event } from '../lib/supabase';
import { COUNTRIES } from '../utils/countries';
import { UserAvatar } from './UserAvatar';
import { getCategoryEmoji } from '../utils/eventCategories';

type EventCardProps = {
  event: Event;
  currentUserId?: string | null;
  onAttendClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onUserClick?: (userId: string) => void;
  isAdmin?: boolean;
};

export function EventCard({ event, currentUserId, onAttendClick, onEdit, onDelete, onUserClick, isAdmin = false }: EventCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const isAttending = currentUserId ? event.attendees.includes(currentUserId) : false;
  const attendeeCount = event.attendees.length;
  const spotsLeft = event.max_attendees - attendeeCount;
  const isOwner = currentUserId === event.user_id;
  const canManage = isOwner || isAdmin;

  const handleUserClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (event.user_id !== currentUserId && onUserClick) {
      onUserClick(event.user_id);
    }
  };

  const eventDateStr = event.event_date || event.date || '';
  const eventDate = new Date(eventDateStr);
  const day = eventDate.getDate();
  const month = eventDate.getMonth() + 1;

  const timeStr = event.time || (eventDateStr ? new Date(eventDateStr).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '');

  const getCategoryImage = (eventType: string | null) => {
    const images: Record<string, string> = {
      parties: 'https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg?auto=compress&cs=tinysrgb&w=400',
      treks: 'https://images.pexels.com/photos/2662116/pexels-photo-2662116.jpeg?auto=compress&cs=tinysrgb&w=400',
      food: 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
      sports: 'https://images.pexels.com/photos/390051/surfer-wave-sunset-the-indian-ocean-390051.jpeg?auto=compress&cs=tinysrgb&w=400',
      workshops: 'https://images.pexels.com/photos/3822622/pexels-photo-3822622.jpeg?auto=compress&cs=tinysrgb&w=400',
      yeshivot: 'https://images.pexels.com/photos/256541/pexels-photo-256541.jpeg?auto=compress&cs=tinysrgb&w=400',
    };
    return eventType ? images[eventType] : null;
  };

  const getCategoryIcon = (eventType: string | null, customEmoji?: string) => {
    const colorMap: Record<string, { color: string; shadowColor: string }> = {
      parties: { color: 'from-teal-400 to-teal-600', shadowColor: 'rgba(20, 184, 166, 0.7)' },
      food: { color: 'from-orange-400 to-orange-600', shadowColor: 'rgba(249, 115, 22, 0.7)' },
      sports: { color: 'from-blue-400 to-blue-600', shadowColor: 'rgba(59, 130, 246, 0.7)' },
      treks: { color: 'from-green-400 to-green-600', shadowColor: 'rgba(34, 197, 94, 0.7)' },
      workshops: { color: 'from-yellow-400 to-yellow-600', shadowColor: 'rgba(234, 179, 8, 0.7)' },
      yeshivot: { color: 'from-cyan-400 to-cyan-600', shadowColor: 'rgba(6, 182, 212, 0.7)' },
    };

    const defaultIcon = customEmoji || (eventType ? getCategoryEmoji(eventType) : '📅');
    const colors = eventType && colorMap[eventType]
      ? colorMap[eventType]
      : { color: 'from-gray-400 to-gray-600', shadowColor: 'rgba(107, 114, 128, 0.7)' };

    return { icon: defaultIcon, ...colors };
  };

  const displayImage = event.image_url || getCategoryImage(event.event_type ?? null);
  const categoryIcon = getCategoryIcon(event.event_type ?? null, event.emoji ?? undefined);

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div
      className="bg-white rounded-[20px] p-4 transition-all duration-300 active:scale-[0.98] hover:shadow-xl relative"
      style={{
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)'
      }}
    >
      {canManage && (
        <div className="absolute top-3 left-3 z-10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="bg-white/90 backdrop-blur-sm p-1.5 rounded-full shadow-md hover:bg-white transition-all active:scale-95"
          >
            <MoreVertical className="w-4 h-4 text-gray-500" />
          </button>
          {showMenu && (
            <div className="absolute top-9 left-0 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden min-w-[120px] z-20">
              {onEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onEdit();
                  }}
                  className="w-full px-4 py-2.5 text-right text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  style={{ fontFamily: 'Heebo, sans-serif' }}
                >
                  ערוך
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onDelete();
                  }}
                  className="w-full px-4 py-2.5 text-right text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                  style={{ fontFamily: 'Heebo, sans-serif' }}
                >
                  מחק
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-4">
        <div className="relative flex-shrink-0">
          <div className="w-[100px] h-[100px] rounded-[16px] overflow-hidden">
            {displayImage ? (
              <img
                src={displayImage}
                alt={event.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className={`w-full h-full bg-gradient-to-br ${categoryIcon.color}`} />
            )}
          </div>
          <div className="absolute -bottom-1 -right-1">
            <span
              className="text-2xl drop-shadow-lg"
              style={{
                filter: `drop-shadow(0 0 6px ${categoryIcon.shadowColor}) drop-shadow(0 0 12px ${categoryIcon.shadowColor})`,
              }}
            >
              {categoryIcon.icon}
            </span>
          </div>
        </div>

        <div className="flex-1 min-w-0 py-1">
          <h3
            className="text-[17px] font-bold text-gray-900 mb-2 leading-tight"
            style={{ fontFamily: 'Heebo, sans-serif', fontWeight: 700 }}
          >
            {truncateText(event.title, 28)}
          </h3>

          <div className="flex items-center gap-1.5 text-[13px] text-gray-500 mb-1.5">
            <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-3 h-3 text-gray-400" />
            </div>
            <span style={{ fontFamily: 'Rubik, sans-serif' }} className="truncate">
              {(() => {
                const c = event.country ? COUNTRIES[event.country] : null;
                const flag = c?.flag ?? '';
                return truncateText(`${flag} ${event.city}`.trim(), 26);
              })()}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[13px] text-gray-500">
            <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
              <Clock className="w-3 h-3 text-gray-400" />
            </div>
            <span style={{ fontFamily: 'Rubik, sans-serif' }}>
              {timeStr || '---'}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center gap-2">
          <div
            className="cursor-pointer"
            onClick={handleUserClick}
          >
            <UserAvatar
              avatarUrl={event.users?.avatar_url}
              displayName={event.users?.display_name || 'M'}
              size="small"
            />
          </div>
          <div
            className={`px-2 py-1.5 rounded-xl cursor-pointer transition-all hover:scale-105 active:scale-95 ${
              spotsLeft === 0
                ? 'bg-red-50 border border-red-200'
                : spotsLeft <= 3
                ? 'bg-orange-50 border border-orange-200'
                : isAttending
                ? 'bg-green-50 border border-green-200'
                : 'bg-blue-50 border border-blue-200'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onAttendClick();
            }}
          >
            <div className="flex items-center gap-1.5">
              <Users className={`w-3.5 h-3.5 ${
                spotsLeft === 0
                  ? 'text-red-500'
                  : spotsLeft <= 3
                  ? 'text-orange-500'
                  : isAttending
                  ? 'text-green-500'
                  : 'text-blue-500'
              }`} />
              <span
                className={`text-xs font-bold ${
                  spotsLeft === 0
                    ? 'text-red-600'
                    : spotsLeft <= 3
                    ? 'text-orange-600'
                    : isAttending
                    ? 'text-green-600'
                    : 'text-blue-600'
                }`}
                style={{ fontFamily: 'Rubik, sans-serif' }}
              >
                {attendeeCount}/{event.max_attendees}
              </span>
            </div>
            <div className="w-full h-1 bg-gray-200 rounded-full mt-1 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  spotsLeft === 0
                    ? 'bg-red-500'
                    : spotsLeft <= 3
                    ? 'bg-orange-500'
                    : isAttending
                    ? 'bg-green-500'
                    : 'bg-blue-500'
                }`}
                style={{ width: `${(attendeeCount / event.max_attendees) * 100}%` }}
              />
            </div>
          </div>
          <span className="text-[11px] text-gray-400 font-medium" style={{ fontFamily: 'Rubik, sans-serif' }}>
            {day}/{month}
          </span>
        </div>
      </div>
    </div>
  );
}
