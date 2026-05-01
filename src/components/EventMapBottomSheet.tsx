import { useEffect, useRef, useState } from 'react';
import { MapPin, Calendar, Users, Sparkles } from 'lucide-react';
import { supabase, type Event } from '../lib/supabase';
import { getCountryName } from '../utils/countries';
import { UserAvatar } from './UserAvatar';

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

const eventTypeEmojis: Record<string, string> = {
  parties: '🎉',
  treks: '🏕️',
  food: '🍔',
  sports: '🏄',
  workshops: '🧘',
};

const eventTypeLabels: Record<string, string> = {
  parties: 'מסיבות וחיי לילה',
  treks: 'טרקים והרפתקאות',
  food: 'אוכל וקולינריה',
  sports: 'ספורט ופעילות',
  workshops: 'סדנאות ולמידה',
};

function generateColorFromId(id: string, index: number): string {
  const colors = [
    'bg-gradient-to-br from-blue-400 to-blue-600',
    'bg-gradient-to-br from-teal-400 to-teal-600',
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
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartY(e.touches[0].clientY);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const deltaY = e.touches[0].clientY - startY;
    if (deltaY > 0) {
      setCurrentY(deltaY);
    }
  };

  const handleTouchEnd = () => {
    if (currentY > 120) {
      handleClose();
    }
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
    if (deltaY > 0) {
      setCurrentY(deltaY);
    }
  };

  const handleMouseUp = () => {
    if (currentY > 120) {
      handleClose();
    }
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
    const isOwner = event.user_id === userId;
    if (isOwner) return;

    try {
      const { data } = await supabase
        .from('event_join_requests')
        .select('status')
        .eq('event_id', event.id)
        .eq('user_id', userId)
        .maybeSingle();

      if (data) {
        setRequestStatus(data.status as 'pending' | 'approved' | 'rejected');
      } else {
        setRequestStatus('none');
      }
    } catch (error) {
      console.error('Error checking request status:', error);
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

      setAttendees(data?.map(user => ({
        ...user,
        home_base: user.current_country
      })) || []);
    } catch (error) {
      console.error('Error loading attendees:', error);
    } finally {
      setLoadingAttendees(false);
    }
  };

  if (!event) return null;

  const isAttending = userId ? event.attendees.includes(userId) : false;
  const attendeeCount = event.attendees.length;
  const spotsLeft = event.max_attendees - attendeeCount;

  const eventDate = event.date ? new Date(event.date) : null;
  const dayNumber = eventDate ? eventDate.getDate() : '?';
  const monthName = eventDate
    ? eventDate.toLocaleDateString('he-IL', { month: 'short' }).toUpperCase()
    : '';

  const dateTimeStr = eventDate
    ? `${eventDate.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${event.time ? ` • ${event.time}` : ''}`
    : 'לא צוין';

  const visibleAvatars = Math.min(attendeeCount, 4);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 transition-opacity duration-300"
          style={{ opacity: isOpen ? 1 : 0 }}
        />
      )}

      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[32px] shadow-2xl z-50 transition-transform duration-300 ease-out"
        style={{
          transform: isOpen
            ? `translateY(${currentY}px)`
            : 'translateY(100%)',
          maxHeight: '85vh',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="w-full py-4 flex justify-center cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
        >
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: 'calc(85vh - 48px)' }}>
          <div className="relative">
            {event.image_url ? (
              <div className="relative w-full h-64 overflow-hidden">
                <img
                  src={event.image_url}
                  alt={event.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

                <div className="absolute top-4 right-4 bg-white rounded-2xl shadow-lg overflow-hidden" style={{ width: '68px' }}>
                  <div className="bg-white px-3 py-2 text-center">
                    <div className="text-2xl font-black text-gray-900 leading-none" style={{ fontFamily: 'Heebo, sans-serif' }}>
                      {dayNumber}
                    </div>
                    <div className="text-xs font-bold text-red-500 leading-none mt-0.5" style={{ fontFamily: 'Heebo, sans-serif' }}>
                      {monthName}
                    </div>
                  </div>
                </div>

                {attendeeCount > 0 && (
                  <div className="absolute bottom-4 right-4 flex items-center">
                    <div className="flex -space-x-3">
                      {attendees.length > 0 ? (
                        attendees.slice(0, visibleAvatars).map((attendee, i) => (
                          <div
                            key={attendee.id}
                            className="w-10 h-10 rounded-full border-3 border-white shadow-lg overflow-hidden"
                            style={{ zIndex: visibleAvatars - i }}
                          >
                            {attendee.avatar_url ? (
                              <img
                                src={attendee.avatar_url}
                                alt={attendee.display_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className={`w-full h-full flex items-center justify-center text-white text-sm font-bold ${generateColorFromId(attendee.id, i)}`}>
                                {attendee.display_name?.charAt(0)?.toUpperCase() || '?'}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        Array.from({ length: visibleAvatars }).map((_, i) => (
                          <div
                            key={i}
                            className={`w-10 h-10 rounded-full border-3 border-white shadow-lg flex items-center justify-center text-white text-sm font-bold ${generateColorFromId(event.id, i)}`}
                            style={{ zIndex: visibleAvatars - i }}
                          >
                            ?
                          </div>
                        ))
                      )}
                    </div>
                    {attendeeCount > visibleAvatars && (
                      <div className="mr-2 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg">
                        <span className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Heebo, sans-serif' }}>
                          +{attendeeCount - visibleAvatars} Going
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="relative w-full h-64 bg-gradient-to-br from-brand-400 via-brand-500 to-brand-600 flex items-center justify-center">
                <div className="text-7xl">{eventTypeEmojis[event.event_type || 'parties'] || '🎉'}</div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

                <div className="absolute top-4 right-4 bg-white rounded-2xl shadow-lg overflow-hidden" style={{ width: '68px' }}>
                  <div className="bg-white px-3 py-2 text-center">
                    <div className="text-2xl font-black text-gray-900 leading-none" style={{ fontFamily: 'Heebo, sans-serif' }}>
                      {dayNumber}
                    </div>
                    <div className="text-xs font-bold text-red-500 leading-none mt-0.5" style={{ fontFamily: 'Heebo, sans-serif' }}>
                      {monthName}
                    </div>
                  </div>
                </div>

                {attendeeCount > 0 && (
                  <div className="absolute bottom-4 right-4 flex items-center">
                    <div className="flex -space-x-3">
                      {attendees.length > 0 ? (
                        attendees.slice(0, visibleAvatars).map((attendee, i) => (
                          <div
                            key={attendee.id}
                            className="w-10 h-10 rounded-full border-3 border-white shadow-lg overflow-hidden"
                            style={{ zIndex: visibleAvatars - i }}
                          >
                            {attendee.avatar_url ? (
                              <img
                                src={attendee.avatar_url}
                                alt={attendee.display_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className={`w-full h-full flex items-center justify-center text-white text-sm font-bold ${generateColorFromId(attendee.id, i)}`}>
                                {attendee.display_name?.charAt(0)?.toUpperCase() || '?'}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        Array.from({ length: visibleAvatars }).map((_, i) => (
                          <div
                            key={i}
                            className={`w-10 h-10 rounded-full border-3 border-white shadow-lg flex items-center justify-center text-white text-sm font-bold ${generateColorFromId(event.id, i)}`}
                            style={{ zIndex: visibleAvatars - i }}
                          >
                            ?
                          </div>
                        ))
                      )}
                    </div>
                    {attendeeCount > visibleAvatars && (
                      <div className="mr-2 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg">
                        <span className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Heebo, sans-serif' }}>
                          +{attendeeCount - visibleAvatars} Going
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="px-6 pt-5 pb-6" dir="rtl">
            {event.event_type && (
              <div className="mb-3">
                <span
                  className="inline-block px-4 py-1.5 bg-cyan-50 text-cyan-600 rounded-full text-sm font-semibold"
                  style={{ fontFamily: 'Rubik, sans-serif' }}
                >
                  {eventTypeLabels[event.event_type] || event.event_type}
                </span>
              </div>
            )}

            <h2 className="text-3xl font-black text-gray-900 mb-4 leading-tight" style={{ fontFamily: 'Heebo, sans-serif' }}>
              {event.title}
            </h2>

            <div className="space-y-3 mb-6">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 flex items-center justify-center mt-0.5">
                  <MapPin className="w-5 h-5 text-gray-700" />
                </div>
                <div className="flex-1">
                  <p className="text-base text-gray-900 font-medium" style={{ fontFamily: 'Rubik, sans-serif' }}>
                    {event.address || event.city}, {getCountryName(event.country ?? '')}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-5 h-5 flex items-center justify-center mt-0.5">
                  <Calendar className="w-5 h-5 text-gray-700" />
                </div>
                <div className="flex-1">
                  <p className="text-base text-gray-900 font-medium" style={{ fontFamily: 'Rubik, sans-serif' }}>
                    {dateTimeStr}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-5 h-5 flex items-center justify-center mt-0.5">
                  <Sparkles className="w-5 h-5 text-gray-700" />
                </div>
                <div className="flex-1">
                  <p className="text-base text-gray-900 font-medium" style={{ fontFamily: 'Rubik, sans-serif' }}>
                    על ידי {event.users?.display_name || 'מארגן'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowAttendeesList(!showAttendeesList)}
                className="flex items-start gap-3 w-full hover:bg-gray-50 rounded-xl p-3 transition-colors"
              >
                <div className="w-5 h-5 flex items-center justify-center mt-0.5">
                  <Users className="w-5 h-5 text-gray-700" />
                </div>
                <div className="flex-1 text-right">
                  <p className="text-base text-gray-900 font-medium" style={{ fontFamily: 'Rubik, sans-serif' }}>
                    {attendeeCount} משתתפים • {spotsLeft > 0 ? `${spotsLeft} מקומות פנויים` : 'מלא'}
                  </p>
                  {attendeeCount > 0 && (
                    <p className="text-sm text-blue-600 font-semibold mt-1">לחץ לצפייה במשתתפים</p>
                  )}
                </div>
              </button>
            </div>

            {showAttendeesList && attendeeCount > 0 && (
              <div className="mb-6 bg-gray-50 rounded-2xl p-4">
                <h3 className="text-lg font-bold text-gray-900 mb-3" style={{ fontFamily: 'Heebo, sans-serif' }}>
                  משתתפים באירוע
                </h3>
                {loadingAttendees ? (
                  <div className="text-center py-4 text-gray-500">טוען...</div>
                ) : (
                  <div className="space-y-2">
                    {attendees.map((attendee) => (
                      <button
                        key={attendee.id}
                        onClick={() => {
                          if (attendee.id !== userId && onNavigateToUserProfile) {
                            onNavigateToUserProfile(attendee.id);
                          }
                        }}
                        className="flex items-center gap-3 p-3 bg-white rounded-xl hover:bg-gray-100 transition-colors w-full"
                      >
                        <UserAvatar
                          userId={attendee.id}
                          avatarUrl={attendee.avatar_url}
                          displayName={attendee.display_name}
                          size="medium"
                        />
                        <div className="flex-1 text-right">
                          <div className="font-semibold text-gray-900">{attendee.display_name}</div>
                          {attendee.age && (
                            <div className="text-sm text-gray-600">גיל {attendee.age}</div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={onJoinClick}
                disabled={spotsLeft === 0 && !isAttending && requestStatus !== 'pending' && requestStatus !== 'approved'}
                className={`col-span-2 rounded-2xl py-4 px-6 font-bold transition-all text-lg shadow-lg ${
                  isAttending
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : requestStatus === 'pending'
                    ? 'bg-yellow-500 text-white cursor-not-allowed'
                    : requestStatus === 'rejected'
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : spotsLeft === 0
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                    : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-xl'
                }`}
                style={{ fontFamily: 'Heebo, sans-serif' }}
              >
                {isAttending
                  ? '✓ משתתף/ת באירוע'
                  : requestStatus === 'pending'
                  ? 'ממתין לאישור...'
                  : requestStatus === 'rejected'
                  ? 'בקשה נדחתה'
                  : spotsLeft === 0
                  ? 'אין מקומות פנויים'
                  : 'אני בא/ה!'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
