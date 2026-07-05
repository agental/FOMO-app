import { useEffect, useRef, useState } from 'react';
import { MapPin, Calendar, Users, Sparkles, X } from 'lucide-react';
import { supabase, type Event } from '../lib/supabase';
import { getCountryName } from '../utils/countries';
import { UserAvatar } from './UserAvatar';
import { getCategoryColor, getCategoryEmoji, getCategoryLabel } from '../utils/eventCategories';

interface EventMapBottomSheetProps {
  event: Event | null;
  userId: string;
  onClose: () => void;
  onJoinClick: () => void;
  onNavigateToUserProfile?: (userId: string) => void;
}

export type Attendee = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  instagram?: string;
  bio?: string;
  age?: number;
  languages?: string[];
  interests?: string[];
  visited_countries?: string[];
  home_base?: string;
};

function generateColorFromId(id: string, index: number): string {
  const colors = [
    'bg-gradient-to-br from-blue-400 to-blue-600',
    'bg-gradient-to-br from-orange-400 to-orange-600',
    'bg-gradient-to-br from-amber-400 to-amber-600',
    'bg-gradient-to-br from-green-400 to-green-600',
    'bg-gradient-to-br from-yellow-400 to-yellow-600',
    'bg-gradient-to-br from-red-400 to-red-600',
    'bg-gradient-to-br from-sky-400 to-sky-600',
    'bg-gradient-to-br from-cyan-400 to-cyan-600',
  ];
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), index);
  return colors[hash % colors.length];
}

export function EventMapBottomSheet({ event, userId, onClose, onJoinClick, onNavigateToUserProfile }: EventMapBottomSheetProps) {
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const [showAttendeesList, setShowAttendeesList] = useState(false);
  const [requestStatus, setRequestStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');
  const sheetRef = useRef<HTMLDivElement>(null);

  const isOpen = !!event;

  const handleClose = () => {
    setTimeout(() => { onClose(); }, 300);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartY(e.touches[0].clientY);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const deltaY = e.touches[0].clientY - startY;
    if (deltaY > 0) setCurrentY(deltaY);
  };

  const handleTouchEnd = () => {
    if (currentY > 120) handleClose();
    setCurrentY(0);
    setIsDragging(false);
    setStartY(0);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setStartY(e.clientY);
    setIsDragging(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    const deltaY = e.clientY - startY;
    if (deltaY > 0) setCurrentY(deltaY);
  };

  const handleMouseUp = () => {
    if (currentY > 120) handleClose();
    setCurrentY(0);
    setIsDragging(false);
    setStartY(0);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, currentY, startY]);

  useEffect(() => {
    if (event) {
      loadAttendees();
      checkRequestStatus();
    }
  }, [event]);

  const checkRequestStatus = async () => {
    if (!event || !userId) return;
    if (event.user_id === userId) return;
    try {
      const { data } = await supabase
        .from('event_join_requests')
        .select('status')
        .eq('event_id', event.id)
        .eq('user_id', userId)
        .maybeSingle();
      setRequestStatus(data ? (data.status as 'pending' | 'approved' | 'rejected') : 'none');
    } catch {
      setRequestStatus('none');
    }
  };

  const loadAttendees = async () => {
    if (!event || !event.attendees || event.attendees.length === 0) {
      setAttendees([]);
      return;
    }
    setLoadingAttendees(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, display_name, avatar_url, instagram, bio, age, languages, interests, visited_countries, current_country')
        .in('id', event.attendees);
      if (error) throw error;
      setAttendees(data?.map(u => ({ ...u, home_base: u.current_country })) || []);
    } catch {
      // silent
    } finally {
      setLoadingAttendees(false);
    }
  };

  if (!event) return null;

  const isAttending = userId ? event.attendees.includes(userId) : false;
  const attendeeCount = event.attendees.length;
  const spotsLeft = event.max_attendees - attendeeCount;
  const isAlmostFull = spotsLeft > 0 && spotsLeft <= 5;
  const isFull = spotsLeft <= 0;

  const eventDate = event.date ? new Date(event.date) : null;
  const dayNumber = eventDate ? eventDate.getDate() : '?';
  const monthName = eventDate
    ? eventDate.toLocaleDateString('he-IL', { month: 'short' }).toUpperCase()
    : '';
  const dateTimeStr = eventDate
    ? `${eventDate.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${event.time ? ` • ${event.time}` : ''}`
    : 'לא צוין';

  const visibleAvatars = Math.min(attendeeCount, 4);
  const catColor = getCategoryColor(event.event_type || '');
  const catEmoji = getCategoryEmoji(event.event_type || '');
  const catLabel = getCategoryLabel(event.event_type || '');

  const ctaStyle = isAttending
    ? { background: '#10B981' }
    : requestStatus === 'pending'
    ? { background: '#F59E0B' }
    : requestStatus === 'rejected'
    ? { background: '#EF4444' }
    : isFull
    ? { background: '#D1D5DB' }
    : isAlmostFull
    ? { background: 'linear-gradient(135deg,#EF4444,#DC2626)' }
    : { background: 'linear-gradient(135deg,#F97316,#EA580C)' };

  const ctaText = isAttending
    ? '✓ משתתף/ת באירוע'
    : requestStatus === 'pending'
    ? 'ממתין לאישור...'
    : requestStatus === 'rejected'
    ? 'בקשה נדחתה'
    : isFull
    ? 'אין מקומות פנויים'
    : isAlmostFull
    ? '⚡ הצטרף עכשיו!'
    : '🎉 אני בא/ה!';

  const AvatarStack = ({ avatarList }: { avatarList: Attendee[] }) => (
    <div className="flex -space-x-3">
      {avatarList.length > 0
        ? avatarList.slice(0, visibleAvatars).map((a, i) => (
          <div key={a.id} className="w-9 h-9 rounded-full border-2 border-white shadow overflow-hidden" style={{ zIndex: visibleAvatars - i }}>
            {a.avatar_url
              ? <img src={a.avatar_url} alt={a.display_name} className="w-full h-full object-cover" />
              : <div className={`w-full h-full flex items-center justify-center text-white text-sm font-bold ${generateColorFromId(a.id, i)}`}>{a.display_name?.charAt(0)?.toUpperCase() || '?'}</div>
            }
          </div>
        ))
        : Array.from({ length: visibleAvatars }).map((_, i) => (
          <div key={i} className={`w-9 h-9 rounded-full border-2 border-white shadow flex items-center justify-center text-white text-sm font-bold ${generateColorFromId(event.id, i)}`} style={{ zIndex: visibleAvatars - i }}>?</div>
        ))
      }
    </div>
  );

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 transition-opacity duration-300" onClick={handleClose} />
      )}

      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[28px] shadow-2xl z-50 transition-transform duration-300 ease-out"
        style={{ transform: isOpen ? `translateY(${currentY}px)` : 'translateY(100%)', maxHeight: '88vh' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div className="w-full py-3 flex justify-center cursor-grab active:cursor-grabbing" onMouseDown={handleMouseDown}>
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-3 left-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center z-10"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>

        <div className="overflow-y-auto" style={{ maxHeight: 'calc(88vh - 44px)' }}>
          {/* Hero image */}
          <div className="relative w-full h-52 overflow-hidden">
            {event.image_url ? (
              <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-6xl" style={{ background: `linear-gradient(135deg,${catColor}22,${catColor}44)` }}>
                {catEmoji}
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

            {/* Date badge */}
            <div className="absolute top-3 right-3 bg-white rounded-xl shadow-lg overflow-hidden" style={{ width: 56 }}>
              <div className="px-2 py-1.5 text-center">
                <div className="text-xl font-black text-gray-900 leading-none" style={{ fontFamily: 'Heebo, sans-serif' }}>{dayNumber}</div>
                <div className="text-[10px] font-bold text-red-500 leading-none mt-0.5">{monthName}</div>
              </div>
            </div>

            {/* Attendee avatars on image */}
            {attendeeCount > 0 && (
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                <AvatarStack avatarList={attendees} />
                {attendeeCount > visibleAvatars && (
                  <div className="bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full shadow">
                    <span className="text-xs font-bold text-gray-900" style={{ fontFamily: 'Heebo, sans-serif' }}>+{attendeeCount - visibleAvatars} הולכים</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="px-5 pt-4 pb-6" dir="rtl">

            {/* Category chip */}
            {event.event_type && (
              <div className="mb-3">
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                  style={{ background: `${catColor}18`, color: catColor, fontFamily: 'Heebo, sans-serif' }}
                >
                  <span>{catEmoji}</span>
                  <span>{catLabel}</span>
                </span>
              </div>
            )}

            {/* Title */}
            <h2 className="text-2xl font-black text-gray-900 mb-4 leading-tight" style={{ fontFamily: 'Heebo, sans-serif' }}>
              {event.title}
            </h2>

            {/* Scarcity bar */}
            {isAlmostFull && (
              <div className="mb-4 bg-red-50 border border-red-100 rounded-xl px-3 py-2 flex items-center gap-2">
                <span className="text-sm">🔥</span>
                <span className="text-sm font-bold text-red-600" style={{ fontFamily: 'Heebo, sans-serif' }}>רק {spotsLeft} מקומות נשארו!</span>
              </div>
            )}

            {/* Info rows */}
            <div className="space-y-2.5 mb-4">
              <div className="flex items-center gap-3">
                <MapPin className="w-4.5 h-4.5 flex-shrink-0" style={{ color: '#F97316' }} />
                <p className="text-sm text-gray-700 font-medium" style={{ fontFamily: 'Heebo, sans-serif' }}>
                  {event.address || event.city}, {getCountryName(event.country ?? '')}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="w-4.5 h-4.5 flex-shrink-0" style={{ color: '#F97316' }} />
                <p className="text-sm text-gray-700 font-medium" style={{ fontFamily: 'Heebo, sans-serif' }}>{dateTimeStr}</p>
              </div>

              <div className="flex items-center gap-3">
                <Sparkles className="w-4.5 h-4.5 flex-shrink-0" style={{ color: '#F97316' }} />
                <p className="text-sm text-gray-700 font-medium" style={{ fontFamily: 'Heebo, sans-serif' }}>מארגן: {event.users?.display_name || 'מארגן'}</p>
              </div>

              <button
                onClick={() => setShowAttendeesList(!showAttendeesList)}
                className="flex items-center gap-3 w-full text-right hover:bg-gray-50 rounded-xl px-1 py-1.5 transition-colors"
              >
                <Users className="w-4.5 h-4.5 flex-shrink-0" style={{ color: '#F97316' }} />
                <div>
                  <p className="text-sm text-gray-700 font-medium" style={{ fontFamily: 'Heebo, sans-serif' }}>
                    {attendeeCount} משתתפים {isFull ? '• מלא' : `• ${spotsLeft} מקומות פנויים`}
                  </p>
                  {attendeeCount > 0 && (
                    <p className="text-xs font-semibold" style={{ color: '#F97316' }}>לחץ לצפייה במשתתפים</p>
                  )}
                </div>
              </button>
            </div>

            {/* Description */}
            {event.description && (
              <div className="mb-4 bg-gray-50 rounded-xl p-3">
                <p className="text-sm text-gray-600 leading-relaxed" style={{ fontFamily: 'Heebo, sans-serif' }}>{event.description}</p>
              </div>
            )}

            {/* Attendees list */}
            {showAttendeesList && attendeeCount > 0 && (
              <div className="mb-4 bg-gray-50 rounded-2xl p-4">
                <h3 className="text-base font-bold text-gray-900 mb-3" style={{ fontFamily: 'Heebo, sans-serif' }}>משתתפים באירוע</h3>
                {loadingAttendees ? (
                  <div className="text-center py-4 text-gray-500 text-sm">טוען...</div>
                ) : (
                  <div className="space-y-2">
                    {attendees.map(a => (
                      <button
                        key={a.id}
                        onClick={() => { if (a.id !== userId && onNavigateToUserProfile) onNavigateToUserProfile(a.id); }}
                        className="flex items-center gap-3 p-2.5 bg-white rounded-xl hover:bg-gray-100 transition-colors w-full"
                      >
                        <UserAvatar userId={a.id} avatarUrl={a.avatar_url} displayName={a.display_name} size="medium" />
                        <div className="flex-1 text-right">
                          <div className="font-semibold text-sm text-gray-900">{a.display_name}</div>
                          {a.age && <div className="text-xs text-gray-500">גיל {a.age}</div>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* CTA */}
            <button
              onClick={onJoinClick}
              disabled={(isFull && !isAttending && requestStatus !== 'pending' && requestStatus !== 'approved') || requestStatus === 'pending'}
              className="w-full rounded-2xl py-4 font-bold text-lg text-white shadow-lg transition-all active:scale-95"
              style={{ ...ctaStyle, fontFamily: 'Heebo, sans-serif', opacity: (isFull && !isAttending) ? 0.5 : 1 }}
            >
              {ctaText}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
