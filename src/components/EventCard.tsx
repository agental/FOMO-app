import { useState } from 'react';
import { Clock, Tag, MoveVertical as MoreVertical, Zap, Calendar, Flame } from 'lucide-react';
import type { Event } from '../lib/supabase';
import { getCategoryColor, getCategoryEmoji } from '../utils/eventCategories';
import { CachedImage } from './CachedImage';

type EventCardProps = {
  event: Event;
  currentUserId?: string | null;
  onAttendClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onUserClick?: (userId: string) => void;
  isAdmin?: boolean;
};

export function EventCard({
  event, currentUserId, onAttendClick, onEdit, onDelete, onUserClick, isAdmin = false,
}: EventCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  const isOwner     = currentUserId === event.user_id;
  const canManage   = isOwner || isAdmin;
  const isAttending = currentUserId ? event.attendees.includes(currentUserId) : false;
  const isUnlimited = event.max_attendees >= 9999;

  const accentColor = getCategoryColor(event.event_type || '');
  const emoji       = event.emoji || getCategoryEmoji(event.event_type || '');
  const price       = (event as any).price;
  const displayImage = event.image_url || null;

  const eventDateStr = event.event_date || (event as any).date || '';
  const eventDate    = new Date(eventDateStr);
  const timeStr      = eventDateStr
    ? eventDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
    : '';
  const dateStr = eventDateStr
    ? eventDate.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })
    : '';

  // ── Marketing psychology signals ──────────────────────────────
  const attendeeCount = event.attendees.length;
  const spotsLeft     = isUnlimited ? Infinity : event.max_attendees - attendeeCount;
  const fillRate      = isUnlimited ? 0 : attendeeCount / event.max_attendees;
  const isFull        = !isUnlimited && spotsLeft <= 0;
  const isAlmostFull  = !isUnlimited && !isFull && fillRate >= 0.7;
  const isVeryScarce  = !isUnlimited && !isFull && spotsLeft <= 5;

  const now      = new Date();
  const todayStr = now.toDateString();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const isToday    = eventDate.toDateString() === todayStr;
  const isTomorrow = eventDate.toDateString() === tomorrow.toDateString();
  const isThisWeek = eventDate > now && eventDate <= new Date(now.getTime() + 7 * 86400000);

  // CTA label — loss aversion when scarce
  const ctaLabel = isAttending
    ? 'ביטול'
    : isFull
      ? 'מלא'
      : isAlmostFull
        ? 'הצטרף עכשיו!'
        : 'הצטרף!';

  const ctaBg = isAttending
    ? 'linear-gradient(135deg,#ef4444,#dc2626)'
    : isFull
      ? '#9ca3af'
      : isAlmostFull
        ? 'linear-gradient(135deg,#ef4444,#F97316)'
        : `linear-gradient(135deg, ${accentColor}, ${accentColor}bb)`;

  // Urgency badge
  const urgencyBadge = isToday
    ? { label: <><Zap size={8} style={{ display: 'inline', verticalAlign: 'middle' }} /> היום!</>, bg: '#F97316' }
    : isTomorrow
      ? { label: <><Calendar size={8} style={{ display: 'inline', verticalAlign: 'middle' }} /> מחר</>, bg: '#8B5CF6' }
      : isThisWeek && isAlmostFull
        ? { label: <><Flame size={8} style={{ display: 'inline', verticalAlign: 'middle' }} /> כמעט מלא</>, bg: '#ef4444' }
        : null;

  return (
    <div
      className="bg-white overflow-hidden active:scale-[0.98] transition-transform relative"
      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.07)', borderRadius: 'var(--radius-lg)' }}
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
          {displayImage ? (
            <>
              <CachedImage
                url={displayImage} alt={event.title}
                className="absolute inset-0 w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${accentColor}33, transparent)` }} />
              <div className="absolute -bottom-1 -left-1 text-[22px] leading-none drop-shadow-md">{emoji}</div>
            </>
          ) : (
            <>
              <div className="absolute inset-0" style={{ background: `linear-gradient(145deg, ${accentColor}22 0%, ${accentColor}44 50%, ${accentColor}88 100%)` }} />
              <div className="absolute inset-0" style={{ backgroundImage: `radial-gradient(circle at 30% 30%, ${accentColor}55 0%, transparent 60%)` }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span style={{ fontSize: '38px', lineHeight: 1, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.15))' }}>{emoji}</span>
              </div>
            </>
          )}

          {/* Urgency badge on thumbnail */}
          {urgencyBadge && (
            <div
              className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md text-white font-black leading-none"
              style={{ fontSize: '9px', background: urgencyBadge.bg, fontFamily: 'Heebo, sans-serif', boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}
            >
              {urgencyBadge.label}
            </div>
          )}

          {/* Creator avatar — bottom-left overlay */}
          {event.users && (
            <div
              className="absolute bottom-1 left-1 cursor-pointer"
              onClick={e => { e.stopPropagation(); onUserClick?.(event.user_id); }}
              style={{
                width: 24, height: 24, borderRadius: '50%',
                border: '1.5px solid rgba(255,255,255,0.9)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                overflow: 'hidden', background: accentColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {event.users.avatar_url ? (
                <CachedImage
                  url={event.users.avatar_url}
                  maxDim={96}
                  alt={event.users.display_name || ''}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span style={{ fontSize: 10, color: 'white', fontWeight: 900, fontFamily: 'Heebo, sans-serif' }}>
                  {event.users.display_name?.[0] || '?'}
                </span>
              )}
            </div>
          )}
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
            <div className="flex items-center gap-2 text-[12px] text-gray-400 flex-wrap">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {dateStr} · {timeStr}
              </span>
              {/* Zero-Price Effect: "חינם" stands out in green */}
              {price ? (
                <span className="flex items-center gap-1 font-bold" style={{ color: accentColor }}>
                  <Tag className="w-3 h-3" />₪{price}
                </span>
              ) : (
                <span
                  className="font-black text-white"
                  style={{
                    fontSize: '12px', padding: '2px 8px',
                    borderRadius: 8,
                    background: 'linear-gradient(135deg,#10b981,#059669)',
                    fontFamily: 'Heebo, sans-serif',
                    boxShadow: '0 2px 6px rgba(16,185,129,0.35)',
                  }}
                >
                  חינם!
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mt-2">
            {/* Social proof / scarcity */}
            {isFull ? (
              <span className="text-[11px] font-bold text-red-500" style={{ fontFamily: 'Heebo, sans-serif' }}>
                🚫 האירוע מלא
              </span>
            ) : isVeryScarce ? (
              <span className="text-[11px] font-black text-red-500 animate-pulse" style={{ fontFamily: 'Heebo, sans-serif' }}>
                🔥 רק {spotsLeft} מקומות!
              </span>
            ) : isAlmostFull ? (
              <span className="text-[11px] font-bold text-orange-500" style={{ fontFamily: 'Heebo, sans-serif' }}>
                ⚡ {spotsLeft} מקומות נותרו
              </span>
            ) : attendeeCount >= 3 ? (
              <span className="text-[11px] text-gray-400">
                🙌 {attendeeCount} הולכים
              </span>
            ) : (
              <span className="text-[11px] text-gray-400">
                {isUnlimited ? `${attendeeCount} משתתפים` : `${attendeeCount}/${event.max_attendees}`}
              </span>
            )}

            <button
              onClick={e => { e.stopPropagation(); if (!isFull || isAttending) onAttendClick(); }}
              disabled={isFull && !isAttending}
              className="px-4 py-1.5 text-[13px] font-bold text-white active:scale-95 transition-all"
              style={{
                borderRadius: 'var(--radius-sm)',
                background: ctaBg,
                boxShadow: isFull ? 'none' : `0 3px 10px ${isAlmostFull ? '#ef444440' : accentColor + '40'}`,
                fontFamily: 'Heebo, sans-serif',
                opacity: isFull && !isAttending ? 0.6 : 1,
              }}
            >
              {ctaLabel}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
