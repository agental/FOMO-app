import { useState, useEffect, useMemo } from 'react';
import { Search, Plus, MapPin, Shield, Bell, Calendar, Users } from 'lucide-react';
import { HeaderProfileAvatar } from './HeaderProfileAvatar';
import { supabase } from '../lib/supabase';
import { EventCard } from './EventCard';
import { SkeletonCard } from './SkeletonCard';
import { CreateModal } from './CreateModal';
import { MapCreateEventFlow } from './MapCreateEventFlow';
import { CreateLocationForm } from './CreateLocationForm';
import { EventDetailsModal } from './EventDetailsModal';
import { FloatingNavBar } from './FloatingNavBar';
import { COUNTRIES } from '../utils/countries';
import { useEvents } from '../hooks/useEvents';
import type { Event } from '../types/event';

type CreateMode = 'none' | 'select' | 'event' | 'location';

interface HomeScreenProps {
  onNavigateToProfile?: () => void;
  onNavigateToMap?: () => void;
  onNavigateToAdmin?: () => void;
  onNavigateToMessages?: () => void;
  onNavigateToRequests?: () => void;
  onNavigateToUserProfile?: (userId: string) => void;
  onMessageUser?: (userId: string) => void;
  onNavigateToCountrySelection?: () => void;
  onNavigateToSettings?: () => void;
  initialCountries?: string[];
  currentUserId?: string | null;
}

function formatEventDate(dateStr?: string) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });
}

const CATEGORY_IMAGES: Record<string, string> = {
  parties:   'https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg?auto=compress&cs=tinysrgb&w=600',
  treks:     'https://images.pexels.com/photos/2662116/pexels-photo-2662116.jpeg?auto=compress&cs=tinysrgb&w=600',
  food:      'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=600',
  sports:    'https://images.pexels.com/photos/390051/surfer-wave-sunset-the-indian-ocean-390051.jpeg?auto=compress&cs=tinysrgb&w=600',
  workshops: 'https://images.pexels.com/photos/3822622/pexels-photo-3822622.jpeg?auto=compress&cs=tinysrgb&w=600',
  yeshivot:  'https://images.pexels.com/photos/256541/pexels-photo-256541.jpeg?auto=compress&cs=tinysrgb&w=600',
};

export function HomeScreen({
  onNavigateToProfile,
  onNavigateToMap,
  onNavigateToAdmin,
  onNavigateToMessages,
  onNavigateToRequests,
  onNavigateToUserProfile,
  onNavigateToCountrySelection,
  onNavigateToSettings,
  initialCountries,
  currentUserId: propUserId,
}: HomeScreenProps = {}) {
  const [selectedCountries, setSelectedCountries] = useState<string[]>(initialCountries || []);
  const [activeCountry, setActiveCountry] = useState<string | null>(initialCountries?.[0] || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading] = useState(false);
  const [currentUserId] = useState<string | null>(propUserId || null);
  const [createMode, setCreateMode] = useState<CreateMode>('none');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedInterest, setSelectedInterest] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [userName, setUserName] = useState('');
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);

  const { events, refreshEvents, updateFilters } = useEvents({
    countries: activeCountry ? [activeCountry] : [],
    eventType: selectedInterest || undefined,
  });

  // Set default active country once selectedCountries is loaded
  useEffect(() => {
    if (selectedCountries.length > 0 && !activeCountry) {
      setActiveCountry(selectedCountries[0]);
    }
  }, [selectedCountries]);

  // Re-fetch events whenever the active country or interest filter changes
  useEffect(() => {
    if (activeCountry) {
      updateFilters({
        countries: [activeCountry],
        eventType: selectedInterest || undefined,
        searchQuery: searchQuery || undefined,
      });
    }
  }, [activeCountry, selectedInterest, searchQuery]);

  useEffect(() => {
    if (initialCountries && initialCountries.length > 0) {
      setSelectedCountries(initialCountries);
      if (!activeCountry) setActiveCountry(initialCountries[0]);
    }
    loadUserCountries();
    loadPendingRequests();
  }, [initialCountries, currentUserId]);

  useEffect(() => {
    const requestsChannel = supabase
      .channel('home-requests-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_join_requests' }, () => {
        loadPendingRequests();
      })
      .subscribe();

    return () => { supabase.removeChannel(requestsChannel); };
  }, [currentUserId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSearchOpen) setIsSearchOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen]);

  const loadUserCountries = async () => {
    if (!currentUserId) return;
    try {
      const { data, error } = await supabase
        .from('users')
        .select('selected_countries, role, display_name, avatar_url')
        .eq('id', currentUserId)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        if (data.selected_countries) {
          setSelectedCountries(data.selected_countries);
          setActiveCountry(prev => prev || data.selected_countries[0] || null);
        }
        if (data.display_name) setUserName(data.display_name.split(' ')[0]);
        setIsAdmin(data.role === 'admin');
        setUserAvatarUrl(data.avatar_url ?? null);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadPendingRequests = async () => {
    if (!currentUserId) return;
    try {
      const { data: myEvents } = await supabase
        .from('events')
        .select('id')
        .eq('user_id', currentUserId);

      if (!myEvents || myEvents.length === 0) { setPendingRequestsCount(0); return; }

      const { data: requests, error } = await supabase
        .from('event_join_requests')
        .select('id')
        .in('event_id', myEvents.map(e => e.id))
        .eq('status', 'pending');

      if (error) throw error;
      setPendingRequestsCount(requests?.length || 0);
    } catch (error) {
      console.error('Error loading pending requests:', error);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק את האירוע?')) return;
    try {
      const { error } = await supabase.from('events').delete().eq('id', eventId);
      if (error) throw error;
      await refreshEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('אירעה שגיאה במחיקת האירוע');
    }
  };

  const handleEditEvent = (_eventId: string) => { alert('עריכת אירוע בפיתוח...'); };


  const handleAttendEvent = async (eventId: string) => {
    if (!currentUserId) { alert('נא להתחבר כדי להירשם לאירועים'); return; }

    const event = events.find(e => e.id === eventId);
    if (!event || event.user_id === currentUserId) return;

    const isAttending = event.attendees.includes(currentUserId);

    if (event.is_private) {
      const { data: req } = await supabase
        .from('event_join_requests')
        .select('id, status')
        .eq('event_id', eventId)
        .eq('user_id', currentUserId)
        .maybeSingle();

      if (req) {
        if (req.status === 'pending') alert('הבקשה שלך ממתינה לאישור');
        else if (req.status === 'rejected') alert('הבקשה שלך נדחתה');
        else if (req.status === 'approved') await refreshEvents();
        return;
      }

      const { error } = await supabase
        .from('event_join_requests')
        .insert({ event_id: eventId, user_id: currentUserId, status: 'pending' });

      if (error) { console.error(error); alert('שגיאה בשליחת בקשה'); }
      else alert('בקשתך נשלחה ליוצר האירוע לאישור');
      return;
    }

    if (isAttending) {
      await supabase.from('events').update({ attendees: event.attendees.filter(id => id !== currentUserId) }).eq('id', eventId);
      await supabase.from('event_join_requests').delete().eq('event_id', eventId).eq('user_id', currentUserId);
    } else {
      await supabase.from('events').update({ attendees: [...event.attendees, currentUserId] }).eq('id', eventId);
    }
    await refreshEvents();
  };

  const interestFilters = [
    { id: 'parties',   label: 'מסיבות 🎉' },
    { id: 'treks',     label: 'טרקים 🏕️' },
    { id: 'food',      label: 'אוכל 🍔' },
    { id: 'sports',    label: 'ספורט 🏄' },
    { id: 'workshops', label: 'סדנאות 🧘' },
    { id: 'yeshivot',  label: 'ישיבות 📖' },
  ];

  const activeCountryData = activeCountry ? COUNTRIES[activeCountry] : null;

  // Top 8 hottest upcoming events: weighted by attendees, proximity in time, and recency
  const featuredEvents = useMemo(() => {
    const now = new Date();
    const h72 = new Date(now.getTime() + 72 * 3600000);
    return events
      .filter(e => new Date(e.event_date) >= now)
      .map(e => {
        const d = new Date(e.event_date);
        const isSoon = d <= h72;
        const isNew = now.getTime() - new Date(e.created_at).getTime() < 48 * 3600000;
        return { e, score: e.attendees.length * 2 + (isSoon ? 3 : 0) + (isNew ? 1 : 0) };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(x => x.e);
  }, [events]);

  // Upcoming events bucketed by date
  const groupedEvents = useMemo(() => {
    const now = new Date();
    const todayStr = now.toDateString();
    const tom = new Date(now); tom.setDate(now.getDate() + 1);
    const tomorrowStr = tom.toDateString();
    const weekEnd = new Date(now); weekEnd.setDate(now.getDate() + 7);

    const upcoming = events
      .filter(e => new Date(e.event_date) >= now)
      .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());

    return {
      today:    upcoming.filter(e => new Date(e.event_date).toDateString() === todayStr),
      tomorrow: upcoming.filter(e => new Date(e.event_date).toDateString() === tomorrowStr),
      thisWeek: upcoming.filter(e => {
        const d = new Date(e.event_date);
        return d.toDateString() !== todayStr && d.toDateString() !== tomorrowStr && d <= weekEnd;
      }),
      later: upcoming.filter(e => new Date(e.event_date) > weekEnd),
    };
  }, [events]);

  return (
    <div className="min-h-screen overflow-x-hidden max-w-full" style={{ background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)' }} dir="rtl">

      {/* ─── Header ─────────────────────────────────── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-white/95 to-white/80 backdrop-blur-xl border-b border-gray-100"
        style={{ paddingTop: 'env(safe-area-inset-top)', boxShadow: '0 2px 8px rgba(0,0,0,0.06), 0 1px 0 rgba(0,0,0,0.05)' }}
      >
        <div
          className="flex items-center justify-between h-16 px-4"
          style={{
            paddingLeft:  'max(1rem, env(safe-area-inset-left))',
            paddingRight: 'max(1rem, env(safe-area-inset-right))',
          }}
        >
          {/* Left */}
          <div className="flex items-center gap-2">
            <HeaderProfileAvatar
              imageUrl={userAvatarUrl}
              onPress={onNavigateToProfile}
            />
            {isAdmin && (
              <button
                onClick={onNavigateToAdmin}
                className="w-10 h-10 rounded-full bg-amber-50 hover:bg-amber-100 flex items-center justify-center transition-colors active:scale-95"
                title="פאנל ניהול"
              >
                <Shield className="w-5 h-5 text-amber-600" strokeWidth={1.5} />
              </button>
            )}
          </div>

          {/* Logo */}
          <div className="absolute left-1/2 -translate-x-1/2">
            <span
              className="text-[22px] font-black text-gray-900"
              style={{ fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.04em' }}
            >
              FOMO
            </span>
          </div>

          {/* Right */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => onNavigateToRequests?.()}
              className="relative w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors active:scale-95"
            >
              <Bell className="w-5 h-5 text-gray-700" strokeWidth={1.5} />
              {pendingRequestsCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-rose-500 rounded-full text-[10px] text-white flex items-center justify-center font-black border-2 border-white">
                  {pendingRequestsCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors active:scale-95"
            >
              <Search className="w-5 h-5 text-gray-700" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Search bar */}
        {isSearchOpen && (
          <div className="px-4 pb-3 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-3 h-10 px-4 bg-gray-100 rounded-2xl">
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" strokeWidth={1.5} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="חפש אירועים, פוסטים, מקומות..."
                autoFocus
                className="flex-1 bg-transparent text-gray-900 placeholder:text-gray-400 focus:outline-none text-sm"
                style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="w-5 h-5 bg-gray-300 hover:bg-gray-400 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
                >
                  <span className="text-white text-xs font-bold leading-none">×</span>
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ─── Scroll body ─────────────────────────────── */}
      <div style={{ paddingTop: 'calc(4rem + env(safe-area-inset-top))' }}>

        {/* Greeting */}
        <div className="px-4 pt-7 pb-5 animate-fade-in" style={{ animationDuration: '0.8s' }}>
          <h2
            className="text-2xl font-black text-gray-900 leading-snug"
            style={{ fontFamily: 'Heebo, sans-serif' }}
          >
            שלום{userName ? `, ${userName}` : ''} 👋
          </h2>
          <p className="text-gray-400 text-sm mt-1 tracking-wide" style={{ fontFamily: 'Rubik, sans-serif' }}>
            מה קורה בעולם שלך?
          </p>
        </div>

        {/* ─── Country Stories ──────────────────────── */}
        {selectedCountries.length > 0 && (
          <div
            className="flex gap-4 overflow-x-auto scrollbar-hide px-4 pb-3 mb-1"
            style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
          >
            {selectedCountries.map(code => {
              const country = COUNTRIES[code];
              if (!country) return null;
              const isActive = activeCountry === code;
              return (
                <button
                  key={code}
                  onClick={() => setActiveCountry(code)}
                  className="flex-shrink-0 flex flex-col items-center gap-1.5 active:scale-90 transition-transform duration-150"
                >
                  {/* Ring + circle */}
                  <div
                    className="rounded-full p-[2.5px] transition-all duration-200"
                    style={
                      isActive
                        ? { background: 'linear-gradient(135deg, #FF9F43, #FF7E1D)', boxShadow: '0 0 0 1px rgba(255,126,29,0.25)' }
                        : { background: 'transparent', boxShadow: 'inset 0 0 0 2px #e5e7eb' }
                    }
                  >
                    <div className="w-[60px] h-[60px] rounded-full bg-white flex items-center justify-center overflow-hidden">
                      <span className="text-[30px] leading-none select-none">{country.flag}</span>
                    </div>
                  </div>
                  {/* Label */}
                  <span
                    className={`text-[11px] font-bold max-w-[68px] truncate text-center leading-tight transition-colors duration-200 ${
                      isActive ? 'text-orange-500' : 'text-gray-500'
                    }`}
                    style={{ fontFamily: 'Heebo, sans-serif' }}
                  >
                    {country.name}
                  </span>
                </button>
              );
            })}

            {/* Add country shortcut */}
            <button
              onClick={onNavigateToCountrySelection ?? onNavigateToProfile}
              className="flex-shrink-0 flex flex-col items-center gap-1.5 active:scale-90 transition-transform duration-150"
            >
              <div
                className="w-[65px] h-[65px] rounded-full flex items-center justify-center border-2 border-dashed border-gray-300 bg-gray-50 hover:border-gray-400 transition-colors"
              >
                <Plus className="w-5 h-5 text-gray-400" strokeWidth={2.5} />
              </div>
              <span
                className="text-[11px] font-bold text-gray-400 text-center leading-tight"
                style={{ fontFamily: 'Heebo, sans-serif' }}
              >
                הוסף
              </span>
            </button>
          </div>
        )}

        {/* ─── Interest Pills ───────────────────────── */}
        <div
          className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 px-4 mb-5 mt-3"
          style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        >
          {interestFilters.map(interest => (
            <button
              key={interest.id}
              onClick={() => setSelectedInterest(selectedInterest === interest.id ? null : interest.id)}
              className={`flex-shrink-0 px-4 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-250 active:scale-95 ${
                selectedInterest === interest.id
                  ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/40 hover:shadow-brand-500/50'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-brand-300 hover:text-brand-600 shadow-sm hover:shadow-md'
              }`}
            >
              {interest.label}
            </button>
          ))}
        </div>

        {/* ─── Main content ─── */}
        <div className="pb-28">

          {/* Loading skeletons */}
          {loading ? (
            <div className="px-4 space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse opacity-70">
                  <SkeletonCard />
                </div>
              ))}
            </div>

          /* No countries selected yet */
          ) : selectedCountries.length === 0 ? (
            <div className="flex flex-col items-center px-6 pt-20 pb-12 text-center">
              <div
                className="w-24 h-24 mb-6 bg-white rounded-3xl flex items-center justify-center border border-gray-100"
                style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}
              >
                <span className="text-5xl">🌍</span>
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-2" style={{ fontFamily: 'Heebo, sans-serif' }}>
                בחר מדינות תחילה
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-6" style={{ fontFamily: 'Rubik, sans-serif' }}>
                עדכן את הפרופיל שלך ובחר לאיזה מדינות אתה נוסע
              </p>
              <button
                onClick={onNavigateToProfile}
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-gradient-to-r from-brand-600 to-brand-700 text-white text-sm font-black rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200"
                style={{ fontFamily: 'Heebo, sans-serif' }}
              >
                עדכן פרופיל
              </button>
            </div>

          /* Empty state — no events at all for this country */
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center px-6 pt-16 pb-12 text-center animate-fade-in">
              <div className="text-6xl mb-5">{activeCountryData?.flag || '🌍'}</div>
              <h3 className="text-xl font-black text-gray-900 mb-2" style={{ fontFamily: 'Heebo, sans-serif' }}>
                אין אירועים ב{activeCountryData?.name || activeCountry} עדיין
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-6 max-w-xs" style={{ fontFamily: 'Rubik, sans-serif' }}>
                היה הראשון ליצור אירוע כאן ותן לאחרים לדעת מה קורה!
              </p>
              <button
                onClick={() => setCreateMode('event')}
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-gradient-to-r from-brand-600 to-brand-700 text-white text-sm font-black rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200"
                style={{ fontFamily: 'Heebo, sans-serif' }}
              >
                <Plus className="w-4 h-4" />
                צור אירוע
              </button>
            </div>

          ) : (
            <>
              {/* ══ FEATURED / HOT EVENTS carousel ══ */}
              {featuredEvents.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center gap-2.5 px-4 mb-4">
                    <div
                      className="w-1.5 h-6 rounded-full flex-shrink-0"
                      style={{ background: 'linear-gradient(180deg, #FF9F43 0%, #FF4757 100%)', boxShadow: '0 0 10px rgba(255,71,87,0.4)' }}
                    />
                    <h3 className="text-lg font-black text-gray-900 tracking-tight" style={{ fontFamily: 'Heebo, sans-serif' }}>
                      🔥 חם עכשיו
                    </h3>
                  </div>

                  <div
                    className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide px-4"
                    style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
                  >
                    {featuredEvents.map(event => {
                      const bg = event.image_url || (event.event_type ? CATEGORY_IMAGES[event.event_type] : null);
                      const isAttending = event.attendees.includes(currentUserId || '');
                      return (
                        <div
                          key={event.id}
                          className="flex-none snap-center cursor-pointer active:scale-[0.97] transition-transform duration-200"
                          style={{ width: '264px' }}
                          onClick={() => setSelectedEvent(event)}
                        >
                          <div
                            className="relative h-[182px] rounded-2xl overflow-hidden"
                            style={{ boxShadow: '0 16px 48px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.08)' }}
                          >
                            {/* Background */}
                            {bg ? (
                              <img src={bg} alt={event.title} className="absolute inset-0 w-full h-full object-cover" />
                            ) : (
                              <div className="absolute inset-0 bg-gradient-to-br from-brand-500 via-brand-600 to-violet-700" />
                            )}
                            {/* Gradient overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

                            {/* Top row badges */}
                            <div className="absolute top-3 inset-x-3 flex items-center justify-between">
                              <div className="flex items-center gap-1 bg-black/40 backdrop-blur-sm text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
                                <Users className="w-3 h-3" />
                                <span>{event.attendees.length} הולכים</span>
                              </div>
                              <span className="bg-orange-500/90 backdrop-blur-sm text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
                                🔥 חם
                              </span>
                            </div>

                            {/* Bottom content */}
                            <div className="absolute bottom-0 left-0 right-0 p-3.5">
                              <h3
                                className="text-white text-[16px] font-black leading-tight mb-2 line-clamp-2"
                                style={{ fontFamily: 'Heebo, sans-serif', textShadow: '0 1px 8px rgba(0,0,0,0.5)' }}
                              >
                                {event.title}
                              </h3>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <span className="text-white/70 text-[11px] flex items-center gap-1 font-medium">
                                    <Calendar className="w-3 h-3" />
                                    {formatEventDate(event.event_date)}
                                  </span>
                                  <span className="text-white/70 text-[11px] flex items-center gap-1 font-medium">
                                    <MapPin className="w-3 h-3" />
                                    {event.city}
                                  </span>
                                </div>
                                <button
                                  className={`text-[11px] font-black px-3 py-1.5 rounded-full transition-all active:scale-95 ${
                                    isAttending
                                      ? 'bg-green-500 text-white'
                                      : 'bg-white text-gray-900'
                                  }`}
                                  style={{ fontFamily: 'Heebo, sans-serif' }}
                                  onClick={e => { e.stopPropagation(); handleAttendEvent(event.id); }}
                                >
                                  {isAttending ? '✓ הולך' : '+ הצטרף'}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div className="flex-none w-1" />
                  </div>
                </div>
              )}

              {/* ══ EVENTS BY DATE groups ══ */}
              {([
                { key: 'today',    label: 'היום',   emoji: '📍', items: groupedEvents.today },
                { key: 'tomorrow', label: 'מחר',    emoji: '🗓️', items: groupedEvents.tomorrow },
                { key: 'thisWeek', label: 'השבוע',  emoji: '📅', items: groupedEvents.thisWeek },
                { key: 'later',    label: 'בהמשך',  emoji: '🔜', items: groupedEvents.later },
              ] as const).filter(g => g.items.length > 0).map(group => (
                <div key={group.key} className="mb-7">
                  {/* Section header */}
                  <div className="flex items-center gap-2 px-4 mb-3">
                    <span className="text-base leading-none">{group.emoji}</span>
                    <h3
                      className="text-[17px] font-black text-gray-900 tracking-tight"
                      style={{ fontFamily: 'Heebo, sans-serif' }}
                    >
                      {group.label}
                    </h3>
                    <span className="text-[12px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      {group.items.length}
                    </span>
                  </div>

                  {/* Event cards */}
                  <div className="px-4 space-y-4">
                    {group.items.map((event, idx) => (
                      <div
                        key={event.id}
                        className="animate-card-entrance cursor-pointer"
                        style={{ animationDelay: `${idx * 55}ms` }}
                        onClick={() => setSelectedEvent(event)}
                      >
                        <EventCard
                          event={event}
                          currentUserId={currentUserId}
                          isAdmin={isAdmin}
                          onAttendClick={() => handleAttendEvent(event.id)}
                          onEdit={() => handleEditEvent(event.id)}
                          onDelete={() => handleDeleteEvent(event.id)}
                          onUserClick={userId => onNavigateToUserProfile?.(userId)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

            </>
          )}
        </div>
      </div>

      {/* ─── Bottom nav ─────────────────────────────── */}
      <FloatingNavBar
        activeTab="home"
        currentUserId={currentUserId}
        onHomeClick={() => window.scrollTo(0, 0)}
        onMapClick={onNavigateToMap}
        onCreateClick={() => setCreateMode('select')}
        onChatClick={onNavigateToMessages}
        onSettingsClick={onNavigateToSettings}
      />

      {/* ─── Modals ─────────────────────────────────── */}
      {createMode === 'select' && (
        <CreateModal
          onSelectEvent={() => setCreateMode('event')}
          onSelectPost={() => setCreateMode('none')}
          onSelectLocation={() => setCreateMode('location')}
          onClose={() => setCreateMode('none')}
          isAdmin={isAdmin}
        />
      )}

      {createMode === 'event' && currentUserId && (
        <MapCreateEventFlow
          isOpen={true}
          onClose={() => setCreateMode('none')}
          onSuccess={() => { setCreateMode('none'); refreshEvents(); }}
          userId={currentUserId}
          defaultCountry={activeCountry || selectedCountries[0] || undefined}
        />
      )}

      {createMode === 'location' && currentUserId && (
        <CreateLocationForm
          onSuccess={() => setCreateMode('none')}
          onCancel={() => setCreateMode('none')}
          currentUserId={currentUserId}
        />
      )}

      {selectedEvent && (
        <EventDetailsModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          currentUserId={currentUserId}
          onNavigateToUserProfile={onNavigateToUserProfile}
        />
      )}
    </div>
  );
}
