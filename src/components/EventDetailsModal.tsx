import { useState, useEffect, useRef } from 'react';
import { ArrowRight, Share2, Bookmark, Calendar, MapPin, Users, Clock } from 'lucide-react';
import { supabase, type Event } from '../lib/supabase';
import { flagEmoji } from '../utils/flags';
import { UserAvatar } from './UserAvatar';

export type Attendee = {
  id: string;
  display_name: string;
  country: string;
  city: string | null;
  avatar_url: string | null;
  instagram?: string;
  bio?: string;
  age?: number;
  languages?: string[];
  interests?: string[];
  visited_countries?: string[];
  home_base?: string;
};

type EventDetailsModalProps = {
  event: Event;
  onClose: () => void;
  currentUserId?: string | null;
  onNavigateToUserProfile?: (userId: string) => void;
};

export function EventDetailsModal({ event, onClose, currentUserId: propUserId, onNavigateToUserProfile }: EventDetailsModalProps) {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isJoined, setIsJoined] = useState(false);
  const [requestStatus, setRequestStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');
  const [scrollY, setScrollY] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const currentUserId = propUserId || '00000000-0000-0000-0000-000000000001';
  const isOwner = event.user_id === currentUserId;

  useEffect(() => {
    fetchAttendees();
    checkIfJoined();
    checkRequestStatus();
  }, [event.id]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollY(container.scrollTop);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const checkIfJoined = () => {
    setIsJoined(event.attendees.includes(currentUserId));
  };

  const checkRequestStatus = async () => {
    if (!currentUserId || isOwner) return;

    const { data } = await supabase
      .from('event_join_requests')
      .select('status')
      .eq('event_id', event.id)
      .eq('user_id', currentUserId)
      .maybeSingle();

    if (data) {
      setRequestStatus(data.status as 'pending' | 'approved' | 'rejected');
    }
  };

  const fetchAttendees = async () => {
    if (!event.attendees || event.attendees.length === 0) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, display_name, current_country, avatar_url, instagram, bio, age, languages, interests, visited_countries, home_base')
        .in('id', event.attendees);

      if (error) {
        console.error('Error fetching attendees:', error);
      } else {
        setAttendees(
          (data || []).map(user => ({
            id: user.id,
            display_name: user.display_name,
            country: user.current_country || 'IL',
            city: null,
            avatar_url: user.avatar_url,
            instagram: user.instagram,
            bio: user.bio,
            age: user.age,
            languages: user.languages,
            interests: user.interests,
            visited_countries: user.visited_countries,
            home_base: user.home_base,
          }))
        );
      }
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinEvent = async () => {
    if (isOwner) return;

    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }

    try {
      if (isJoined) {
        const updatedAttendees = event.attendees.filter(id => id !== currentUserId);
        await supabase
          .from('events')
          .update({ attendees: updatedAttendees })
          .eq('id', event.id);

        await supabase
          .from('event_join_requests')
          .delete()
          .eq('event_id', event.id)
          .eq('user_id', currentUserId);

        setIsJoined(false);
        setRequestStatus('none');
        event.attendees = updatedAttendees;
        fetchAttendees();
        alert('בוטלה ההשתתפות באירוע');
        return;
      }

      if (requestStatus === 'pending') {
        alert('הבקשה שלך ממתינה לאישור מיוצר האירוע');
        return;
      }

      if (requestStatus === 'rejected') {
        await supabase
          .from('event_join_requests')
          .delete()
          .eq('event_id', event.id)
          .eq('user_id', currentUserId);
      }

      const { error } = await supabase
        .from('event_join_requests')
        .upsert({
          event_id: event.id,
          user_id: currentUserId,
          status: 'pending'
        }, {
          onConflict: 'event_id,user_id'
        });

      if (error) {
        console.error('Error creating join request:', error);
        alert('שגיאה בשליחת בקשה');
      } else {
        setRequestStatus('pending');
        alert('בקשתך נשלחה ליוצר האירוע לאישור');
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      alert('שגיאה בעדכון ההשתתפות');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('he-IL', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const parallaxOffset = Math.min(scrollY * 0.5, 100);
  const headerOpacity = Math.max(1 - scrollY / 200, 0);

  return (
    <div
      className="fixed inset-0 bg-white z-50 animate-slideUp"
      dir="rtl"
      style={{
        animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>

      <div
        ref={scrollContainerRef}
        className="h-full overflow-y-auto scroll-smooth"
        style={{ scrollBehavior: 'smooth' }}
      >
        {/* Header Image */}
        <div className="relative h-[40vh] overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: event.image_url
                ? `url(${event.image_url})`
                : 'linear-gradient(135deg, #14B8A6 0%, #0D9488 100%)',
              transform: `translateY(${parallaxOffset}px) scale(${1 + scrollY / 2000})`,
              transition: 'transform 0.1s ease-out',
            }}
          />
          <div
            className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60"
            style={{ opacity: headerOpacity }}
          />

          {/* Top Navigation */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 safe-top">
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg active:scale-95 transition-transform"
              style={{ backdropFilter: 'blur(10px)' }}
            >
              <ArrowRight className="w-5 h-5 text-gray-900" />
            </button>
            <div className="flex gap-2">
              <button
                className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                style={{ backdropFilter: 'blur(10px)' }}
              >
                <Share2 className="w-5 h-5 text-gray-900" />
              </button>
              <button
                className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                style={{ backdropFilter: 'blur(10px)' }}
              >
                <Bookmark className="w-5 h-5 text-gray-900" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-t-[32px] -mt-8 relative z-10">
          <div className="px-6 pt-6 pb-36">
            {/* Title Section */}
            <div className="mb-6 animate-fadeIn" style={{ animationDelay: '0.1s' }}>
              <h1 className="text-3xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'Heebo, sans-serif' }}>
                {event.title}
              </h1>
              {event.event_type && (
                <div className="flex items-center gap-2 mt-3">
                  {(() => {
                    const eventTypeLabels: Record<string, string> = {
                      parties: 'מסיבות 🎉',
                      treks: 'טרקים 🏕️',
                      food: 'אוכל 🍔',
                      sports: 'ספורט 🏄',
                      workshops: 'סדנאות 🧘',
                    };
                    return (
                      <span className="px-3 py-1.5 bg-gradient-to-r from-brand-50 to-brand-100 text-brand-700 text-sm rounded-full font-medium border border-brand-100">
                        {eventTypeLabels[event.event_type] || event.event_type}
                      </span>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Info Card */}
            <div
              className="bg-white rounded-[20px] p-5 mb-6 animate-fadeIn shadow-sm"
              style={{
                animationDelay: '0.2s',
                boxShadow: '0 4px 24px rgba(0,0,0,0.06)'
              }}
            >
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 mb-0.5">תאריך</div>
                    <div className="text-[15px] font-semibold text-gray-900">{formatDate(event.event_date ?? '')}</div>
                  </div>
                </div>

                <div className="h-px bg-gray-100" />

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-50 to-brand-100 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-brand-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 mb-0.5">שעה</div>
                    <div className="text-[15px] font-semibold text-gray-900">{formatTime(event.event_date ?? '')}</div>
                  </div>
                </div>

                <div className="h-px bg-gray-100" />

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-50 to-brand-100 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-brand-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 mb-0.5">מיקום</div>
                    <div className="text-[15px] font-semibold text-gray-900">
                      {flagEmoji(event.country ?? '')} {event.city}
                      {event.address && `, ${event.address}`}
                    </div>
                  </div>
                </div>

                <div className="h-px bg-gray-100" />

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 mb-0.5">משתתפים</div>
                    <div className="text-[15px] font-semibold text-gray-900">
                      {event.attendees.length} {event.attendees.length === 1 ? 'משתתף' : 'משתתפים'}
                      {event.max_attendees && ` מתוך ${event.max_attendees}`}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="mb-6 animate-fadeIn" style={{ animationDelay: '0.3s' }}>
              <h3 className="text-lg font-bold text-gray-900 mb-3">אודות האירוע</h3>
              <p className="text-[15px] text-gray-700 leading-relaxed whitespace-pre-wrap">
                {event.description}
              </p>
            </div>

            {/* Participants Section */}
            {attendees.length > 0 && (
              <div className="mb-6 animate-fadeIn" style={{ animationDelay: '0.4s' }}>
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  משתתפים
                </h3>

                {/* Overlapping Avatars */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex -space-x-3 rtl:space-x-reverse">
                    {attendees.slice(0, 5).map((attendee, idx) => (
                      <div
                        key={attendee.id}
                        className="relative"
                        style={{
                          zIndex: 5 - idx,
                          animation: `fadeIn 0.3s ease-out ${idx * 0.05}s both`
                        }}
                      >
                        <div className="w-10 h-10 rounded-full ring-2 ring-white overflow-hidden">
                          <UserAvatar
                            avatarUrl={attendee.avatar_url}
                            displayName={attendee.display_name}
                            size="small"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  {attendees.length > 5 && (
                    <span className="text-sm font-semibold text-gray-600">
                      +{attendees.length - 5} נוספים
                    </span>
                  )}
                </div>

                {/* Scrollable Participants List */}
                <div className="overflow-x-auto -mx-6 px-6 scrollbar-hide">
                  <div className="flex gap-3 pb-2" style={{ width: 'max-content' }}>
                    {attendees.map((attendee) => (
                      <div
                        key={attendee.id}
                        onClick={() => {
                          if (attendee.id !== currentUserId && onNavigateToUserProfile) {
                            onNavigateToUserProfile(attendee.id);
                          }
                        }}
                        className="flex-shrink-0 w-20 cursor-pointer active:scale-95 transition-transform"
                      >
                        <div className="w-16 h-16 mx-auto mb-2 rounded-full overflow-hidden ring-2 ring-gray-100">
                          <UserAvatar
                            avatarUrl={attendee.avatar_url}
                            displayName={attendee.display_name}
                            size="medium"
                          />
                        </div>
                        <div className="text-xs font-medium text-gray-900 text-center truncate">
                          {attendee.display_name.split(' ')[0]}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Empty Participants State */}
            {!loading && attendees.length === 0 && (
              <div className="mb-6 animate-fadeIn" style={{ animationDelay: '0.4s' }}>
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  משתתפים
                </h3>
                <div className="text-center py-8 bg-gray-50 rounded-2xl">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">עדיין אין משתתפים רשומים</p>
                  <p className="text-gray-400 text-sm mt-1">היה הראשון להירשם!</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      {!isOwner && (
        <div
          className="fixed bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-white via-white to-transparent"
          style={{
            boxShadow: '0 -10px 40px rgba(0,0,0,0.08)',
            paddingTop: '1rem',
            paddingLeft: '1rem',
            paddingRight: '1rem',
            paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
          }}
        >
          <button
            onClick={handleJoinEvent}
            disabled={requestStatus === 'pending' || requestStatus === 'rejected'}
            className={`w-full py-4 rounded-2xl font-bold text-lg transition-all active:scale-[0.98] shadow-lg ${
              isJoined
                ? 'bg-gradient-to-r from-red-500 to-red-600 text-white'
                : requestStatus === 'pending'
                ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white cursor-not-allowed opacity-80'
                : requestStatus === 'rejected'
                ? 'bg-gray-400 text-white cursor-not-allowed opacity-60'
                : 'bg-gradient-to-r from-[#3B9DB2] to-[#2d7a8c] text-white hover:shadow-xl'
            }`}
            style={{
              fontFamily: 'Heebo, sans-serif',
            }}
          >
            {isJoined
              ? 'ביטול השתתפות'
              : requestStatus === 'pending'
              ? 'ממתין לאישור...'
              : requestStatus === 'rejected'
              ? 'הבקשה נדחתה'
              : 'אני בא 🔥'}
          </button>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out both;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .safe-top {
          padding-top: max(1rem, env(safe-area-inset-top));
        }
      `}</style>
    </div>
  );
}
