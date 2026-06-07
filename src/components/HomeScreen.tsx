import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Plus, MapPin, Shield, Bell, Calendar, Users, SlidersHorizontal, Clock, Star } from 'lucide-react';
import { FilterSheet } from './FilterSheet';
import { HeaderProfileAvatar } from './HeaderProfileAvatar';
import { supabase } from '../lib/supabase';
import { SkeletonCard } from './SkeletonCard';
import { eventCategories } from '../utils/eventCategories';
import { CreateModal } from './CreateModal';
import { MapCreateEventFlow } from './MapCreateEventFlow';
import { CreateLocationForm } from './CreateLocationForm';
import { EventDetailsModal } from './EventDetailsModal';
import { FloatingNavBar } from './FloatingNavBar';
import { COUNTRIES } from '../utils/countries';
import { useEvents } from '../hooks/useEvents';
import type { Event } from '../types/event';
import type { AdminLocation } from '../lib/supabase';

type FeedMode = 'events' | 'locations';

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
  onNavigateToMyEvents?: () => void;
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
  onNavigateToMyEvents,
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
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [userName, setUserName] = useState('');
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [feedMode, setFeedMode] = useState<FeedMode>('events');
  const [adminLocations, setAdminLocations] = useState<AdminLocation[]>([]);
  const [locationsLoaded, setLocationsLoaded] = useState(false);
  const [pullY, setPullY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const PULL_THRESHOLD = 80;

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

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY > 0) return;
    touchStartY.current = e.touches[0].clientY;
    isPulling.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling.current || isRefreshing) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) {
      setPullY(Math.min(delta * 0.45, PULL_THRESHOLD * 1.1));
    } else {
      isPulling.current = false;
      setPullY(0);
    }
  };

  const handleTouchEnd = async () => {
    if (!isPulling.current) return;
    isPulling.current = false;
    if (pullY >= PULL_THRESHOLD) {
      setIsRefreshing(true);
      setPullY(0);
      await refreshEvents();
      setIsRefreshing(false);
    } else {
      setPullY(0);
    }
  };

  const loadAdminLocations = async () => {
    try {
      const { data } = await supabase
        .from('admin_locations')
        .select('*')
        .order('created_at', { ascending: false });
      setAdminLocations(data || []);
      setLocationsLoaded(true);
    } catch (err) {
      console.error('Error loading locations:', err);
      setLocationsLoaded(true);
    }
  };

  useEffect(() => {
    if (feedMode === 'locations' && !locationsLoaded) {
      loadAdminLocations();
    }
  }, [feedMode]);

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




  const activeFilterCount = (selectedInterest ? 1 : 0) + (selectedDateFilter ? 1 : 0);

  const handleApplyFilters = (category: string | null, date: string | null) => {
    setSelectedInterest(category);
    setSelectedDateFilter(date);
  };

  const activeCountryData = activeCountry ? COUNTRIES[activeCountry] : null;

  // Apply date filter to events pool
  const dateFilteredEvents = useMemo(() => {
    if (!selectedDateFilter) return events;
    const now = new Date();
    const todayStr = now.toDateString();
    const tom = new Date(now); tom.setDate(now.getDate() + 1);
    const tomorrowStr = tom.toDateString();
    const weekEnd = new Date(now); weekEnd.setDate(now.getDate() + 7);
    return events.filter(e => {
      const d = new Date(e.event_date);
      if (selectedDateFilter === 'today')    return d.toDateString() === todayStr;
      if (selectedDateFilter === 'tomorrow') return d.toDateString() === tomorrowStr;
      if (selectedDateFilter === 'week')     return d >= now && d <= weekEnd;
      return true;
    });
  }, [events, selectedDateFilter]);

  // Top 8 hottest upcoming events: weighted by attendees, proximity in time, and recency
  const featuredEvents = useMemo(() => {
    const now = new Date();
    const h72 = new Date(now.getTime() + 72 * 3600000);
    return dateFilteredEvents
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
  }, [dateFilteredEvents]);

  // Upcoming events grouped by actual calendar day
  const dayGroups = useMemo(() => {
    const now = new Date();
    const todayStr = now.toDateString();
    const tom = new Date(now); tom.setDate(now.getDate() + 1);
    const tomorrowStr = tom.toDateString();
    const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

    const upcoming = dateFilteredEvents
      .filter(e => new Date(e.event_date) >= now)
      .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());

    const byDay = new Map<string, typeof upcoming>();
    for (const e of upcoming) {
      const key = new Date(e.event_date).toDateString();
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(e);
    }

    return Array.from(byDay.entries()).map(([key, items]) => {
      const d = new Date(key);
      let label: string;
      if (key === todayStr)    label = 'היום';
      else if (key === tomorrowStr) label = 'מחר';
      else label = `יום ${DAY_NAMES[d.getDay()]}`;
      const dateShort = d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
      return { dateKey: key, label, dateShort, items };
    });
  }, [dateFilteredEvents]);

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
              size={36}
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
              <span dir="ltr">FOMO<span style={{ color: '#F97316' }}>.</span></span>
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
                <span
                  className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full border-2 border-white animate-pulse"
                  style={{ background: '#F97316', boxShadow: '0 0 6px rgba(249,115,22,0.7)' }}
                />
              )}
            </button>
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors active:scale-95"
            >
              <Search className="w-5 h-5 text-gray-700" strokeWidth={1.5} />
            </button>
            <button
              onClick={() => setShowFilterSheet(true)}
              className="relative w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors active:scale-95"
            >
              <SlidersHorizontal className="w-5 h-5 text-gray-700" strokeWidth={1.5} />
              {activeFilterCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-orange-500 rounded-full border-2 border-white" />
              )}
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

      {/* ─── Pull-to-refresh indicator ─── */}
      {(pullY > 0 || isRefreshing) && (() => {
        const progress = isRefreshing ? 1 : Math.min(pullY / PULL_THRESHOLD, 1);
        const r = 14;
        const cx = 22, cy = 22;
        const circumference = 2 * Math.PI * r;

        // Plane position: starts at top (12 o'clock), moves clockwise
        const angleRad = -Math.PI / 2 + progress * 2 * Math.PI;
        const px = cx + r * Math.cos(angleRad);
        const py = cy + r * Math.sin(angleRad);
        // Tangent direction for clockwise motion (plane nose points in direction of travel)
        const rotDeg = progress * 360;

        return (
          <div style={{
            position: 'fixed',
            top: 'calc(4rem + env(safe-area-inset-top) + 12px)',
            left: '50%',
            transform: `translateX(-50%) translateY(${isRefreshing ? 0 : Math.min(pullY * 0.35, 24)}px)`,
            transition: pullY === 0 ? 'transform 0.3s ease' : 'none',
            zIndex: 100,
            width: 44, height: 44,
            borderRadius: '50%',
            background: 'white',
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: isRefreshing ? 1 : Math.min(progress * 1.5, 1),
          }}>
            <svg width="44" height="44" viewBox="0 0 44 44">
              <style>{`@keyframes orbitPlane { to { transform: rotate(360deg); } }`}</style>

              <g style={isRefreshing ? { animation: 'orbitPlane 1s linear infinite', transformOrigin: '22px 22px' } : {}}>
                {/* Dashed track */}
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E5E7EB" strokeWidth="1.5" strokeDasharray="2 3" />

                {/* Orange arc that fills as you pull */}
                <circle
                  cx={cx} cy={cy} r={r}
                  fill="none" stroke="#F97316" strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={`${progress * circumference} ${circumference}`}
                  transform={`rotate(-90 ${cx} ${cy})`}
                />

                {/* Airplane — nose points right at rotation=0, which is the clockwise tangent at 12 o'clock */}
                <g transform={`translate(${px} ${py}) rotate(${rotDeg})`}>
                  {/* Fuselage */}
                  <path d="M3.5,0 L-1.5,-1 L-1,0 L-1.5,1 Z" fill="#1F2937" />
                  {/* Wings */}
                  <path d="M0.5,-0.5 L0,-3 L-1.2,-3 L-1.2,-0.5 Z" fill="#1F2937" />
                  <path d="M0.5,0.5 L0,3 L-1.2,3 L-1.2,0.5 Z" fill="#1F2937" />
                  {/* Tail fins */}
                  <path d="M-1.2,-0.4 L-2.2,-1.4 L-2.6,-1.2 L-1.5,0 Z" fill="#1F2937" />
                  <path d="M-1.2,0.4 L-2.2,1.4 L-2.6,1.2 L-1.5,0 Z" fill="#1F2937" />
                </g>
              </g>
            </svg>
          </div>
        );
      })()}

      {/* ─── Scroll body ─────────────────────────────── */}
      <div
        ref={scrollBodyRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          paddingTop: 'calc(4rem + env(safe-area-inset-top))',
        }}
      >

        {/* Greeting + Feed Toggle */}
        <div className="px-4 pt-7 pb-5 animate-fade-in flex items-center justify-between" style={{ animationDuration: '0.8s' }}>
          <div>
            <h2
              className="text-2xl font-black text-gray-900 leading-snug"
              style={{ fontFamily: 'Heebo, sans-serif' }}
            >
              שלום{userName ? `, ${userName}` : ''} 👋
            </h2>
            <p className="text-gray-400 text-sm mt-1 tracking-wide" style={{ fontFamily: 'Rubik, sans-serif' }}>
              {feedMode === 'events' ? 'מה קורה בעולם שלך?' : 'מקומות מומלצים'}
            </p>
          </div>

          {/* ── Feed mode toggle pill ── */}
          <div style={{
            direction: 'ltr',
            position: 'relative',
            display: 'flex',
            background: '#F1F1F3',
            borderRadius: 16,
            padding: 4,
            gap: 0,
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.08)',
          }}>
            {/* Sliding indicator */}
            <div style={{
              position: 'absolute',
              top: 4, left: 4,
              width: 44, height: 36,
              borderRadius: 12,
              background: '#FFFFFF',
              boxShadow: '0 2px 10px rgba(0,0,0,0.13), 0 1px 3px rgba(0,0,0,0.08)',
              transform: feedMode === 'locations' ? 'translateX(48px)' : 'translateX(0)',
              transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
              pointerEvents: 'none',
            }} />

            {/* Events button */}
            <button
              onClick={() => setFeedMode('events')}
              style={{
                width: 44, height: 36,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 12, border: 'none', background: 'transparent',
                cursor: 'pointer', position: 'relative', zIndex: 1,
                transition: 'transform 0.15s',
              }}
              title="אירועים"
            >
              <Calendar
                size={18}
                strokeWidth={2}
                color={feedMode === 'events' ? '#F97316' : '#9CA3AF'}
                style={{ transition: 'color 0.2s' }}
              />
            </button>

            {/* Locations button */}
            <button
              onClick={() => setFeedMode('locations')}
              style={{
                width: 44, height: 36,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 12, border: 'none', background: 'transparent',
                cursor: 'pointer', position: 'relative', zIndex: 1,
                transition: 'transform 0.15s',
              }}
              title="מקומות"
            >
              <MapPin
                size={18}
                strokeWidth={2}
                color={feedMode === 'locations' ? '#F97316' : '#9CA3AF'}
                style={{ transition: 'color 0.2s' }}
              />
            </button>
          </div>
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

        {/* ─── Main content ─── */}
        <div className="pb-28 animate-fade-in" key={feedMode} style={{ animationDuration: '0.22s' }}>

        {/* ════════════════ LOCATIONS FEED ════════════════ */}
        {feedMode === 'locations' ? (
          !locationsLoaded ? (
            <div className="px-4 space-y-4 pt-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse">
                  <div style={{ height: 80, background: '#F3F4F6', borderRadius: 20 }} />
                </div>
              ))}
            </div>
          ) : adminLocations.length === 0 ? (
            <div className="flex flex-col items-center px-6 pt-20 pb-12 text-center animate-fade-in">
              <div className="text-6xl mb-5">📍</div>
              <h3 className="text-xl font-black text-gray-900 mb-2" style={{ fontFamily: 'Heebo, sans-serif' }}>
                אין מקומות עדיין
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed max-w-xs" style={{ fontFamily: 'Rubik, sans-serif' }}>
                המנהל טרם הוסיף מקומות מומלצים
              </p>
            </div>
          ) : (
            <div style={{ margin: '4px 16px 0', background: '#FFFFFF', borderRadius: 20, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
              {adminLocations.map((loc, idx) => {
                const img = loc.place_photo_url || loc.image_url;
                const rating = loc.place_rating;
                const isOpen = loc.place_open_now;
                return (
                  <div key={loc.id}>
                    {idx > 0 && <div style={{ height: 1, background: '#F5F5F7', margin: '0 14px' }} />}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 14px', cursor: 'pointer' }}>

                      {/* Thumbnail */}
                      <div style={{ width: 80, height: 80, borderRadius: 16, flexShrink: 0, overflow: 'hidden', background: '#F3F4F6', position: 'relative' }}>
                        {img ? (
                          <img src={img} alt={loc.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
                            {loc.emoji || '📍'}
                          </div>
                        )}
                        {/* open/closed badge */}
                        {isOpen !== undefined && isOpen !== null && (
                          <div style={{
                            position: 'absolute', bottom: 5, right: 5,
                            background: isOpen ? '#22C55E' : '#EF4444',
                            borderRadius: 6, padding: '2px 5px',
                            fontSize: 9, fontWeight: 700, color: '#fff',
                            border: '1.5px solid white',
                          }}>
                            {isOpen ? 'פתוח' : 'סגור'}
                          </div>
                        )}
                      </div>

                      {/* Text */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 15, fontWeight: 800, color: '#111827', fontFamily: "'Heebo', sans-serif", margin: '0 0 5px', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {loc.name}
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {(loc.city || loc.address) && (
                            <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, fontFamily: "'Heebo', sans-serif" }}>
                              <MapPin size={11} strokeWidth={2} />
                              {loc.city || loc.address}
                            </span>
                          )}
                          {rating && (
                            <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, fontFamily: "'Heebo', sans-serif" }}>
                              <Star size={11} strokeWidth={2} color="#FACC15" fill="#FACC15" />
                              {rating.toFixed(1)}
                              {loc.place_review_count ? ` (${loc.place_review_count})` : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: pin color dot */}
                      <div style={{ flexShrink: 0, width: 10, height: 10, borderRadius: '50%', background: loc.pin_color || '#F97316', boxShadow: `0 0 6px ${loc.pin_color || '#F97316'}88` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )

        /* ════════════════ EVENTS FEED ════════════════ */
        ) : (

          /* Loading skeletons */
          loading ? (
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
                      return (
                        <div
                          key={event.id}
                          className="flex-none snap-center cursor-pointer active:scale-[0.97] transition-transform duration-200"
                          style={{ width: '295px' }}
                          onClick={() => setSelectedEvent(event)}
                        >
                          <div
                            className="relative h-[200px] rounded-2xl overflow-hidden"
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
                                <span>{event.attendees.length}</span>
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

              {/* ══ EVENTS BY DAY groups ══ */}
              {dayGroups.map(group => (
                <div key={group.dateKey} style={{ marginBottom: 28 }}>

                  {/* Day header */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0 16px 10px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                        background: group.label === 'היום' ? '#F97316' : '#CBD5E1',
                        boxShadow: group.label === 'היום' ? '0 0 6px rgba(249,115,22,0.5)' : 'none',
                      }} />
                      <span style={{
                        fontSize: 17, fontWeight: 800, color: '#111827',
                        fontFamily: "'Heebo', sans-serif",
                      }}>
                        {group.label}
                      </span>
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: '#9CA3AF',
                        background: '#F3F4F6', borderRadius: 20, padding: '2px 8px',
                      }}>
                        {group.items.length}
                      </span>
                    </div>
                    <span style={{
                      fontSize: 13, fontWeight: 600, color: '#9CA3AF',
                      fontFamily: "'Heebo', sans-serif",
                    }}>
                      {group.dateShort}
                    </span>
                  </div>

                  {/* White day container */}
                  <div style={{
                    margin: '0 16px',
                    background: '#FFFFFF',
                    borderRadius: 20,
                    overflow: 'hidden',
                    boxShadow: '0 2px 16px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
                  }}>
                    {group.items.map((event, idx) => {
                      const bg = event.image_url || (event.event_type ? CATEGORY_IMAGES[event.event_type] : null);
                      const cat = eventCategories[event.event_type || ''];
                      const time = new Date(event.event_date).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

                      return (
                        <div key={event.id}>
                          {idx > 0 && (
                            <div style={{ height: 1, background: '#F5F5F7', margin: '0 14px' }} />
                          )}
                          <div
                            onClick={() => setSelectedEvent(event)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 14,
                              padding: '16px 14px', cursor: 'pointer',
                            }}
                          >
                            {/* Thumbnail */}
                            <div style={{ width: 80, height: 80, flexShrink: 0, position: 'relative' }}>
                              {/* Image */}
                              <div style={{
                                width: '100%', height: '100%', borderRadius: 16,
                                overflow: 'hidden',
                                background: cat ? `${cat.color}20` : '#F3F4F6',
                              }}>
                                {bg ? (
                                  <img src={bg} alt={event.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  <div style={{
                                    width: '100%', height: '100%',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 34,
                                  }}>
                                    {event.emoji || cat?.emoji || '📍'}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Text */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{
                                fontSize: 15, fontWeight: 800, color: '#111827',
                                fontFamily: "'Heebo', sans-serif",
                                margin: '0 0 6px', lineHeight: 1.3,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                {event.title}
                              </p>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <span style={{
                                  fontSize: 13, color: '#9CA3AF', fontWeight: 500,
                                  display: 'flex', alignItems: 'center', gap: 4,
                                  fontFamily: "'Heebo', sans-serif",
                                }}>
                                  <MapPin size={12} strokeWidth={2} />
                                  {event.city}
                                </span>
                                <span style={{
                                  fontSize: 13, color: '#9CA3AF', fontWeight: 500,
                                  display: 'flex', alignItems: 'center', gap: 4,
                                  fontFamily: "'Heebo', sans-serif",
                                }}>
                                  <Clock size={12} strokeWidth={2} />
                                  {time}
                                </span>
                              </div>
                            </div>

                            {/* Attendees badge */}
                            <div style={{
                              display: 'flex', flexDirection: 'column',
                              alignItems: 'center', gap: 3, flexShrink: 0,
                            }}>
                              <div style={{
                                display: 'flex', alignItems: 'center', gap: 3,
                                background: '#FFF7ED', borderRadius: 20, padding: '5px 9px',
                              }}>
                                <Users size={11} color="#F97316" strokeWidth={2} />
                                <span style={{
                                  fontSize: 12, fontWeight: 700, color: '#F97316',
                                  fontFamily: "'Heebo', sans-serif",
                                }}>
                                  {event.attendees.length}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

            </>
          )
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
        onMyEventsClick={onNavigateToMyEvents}
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

      <FilterSheet
        visible={showFilterSheet}
        initialCategory={selectedInterest}
        initialDate={selectedDateFilter}
        onApply={handleApplyFilters}
        onClose={() => setShowFilterSheet(false)}
      />
    </div>
  );
}
