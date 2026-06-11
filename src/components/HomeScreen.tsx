import { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, MapPin, Shield, Bell, Calendar, Users, Clock, Star, ChevronDown, Check, X, Search } from 'lucide-react';
import { FilterSheet } from './FilterSheet';
import { HeaderProfileAvatar } from './HeaderProfileAvatar';
import { supabase } from '../lib/supabase';
import { SkeletonCard } from './SkeletonCard';
import { eventCategories } from '../utils/eventCategories';
import { CreateModal } from './CreateModal';
import { MapCreateEventFlow } from './MapCreateEventFlow';
import { CreateLocationForm } from './CreateLocationForm';
import { CreatePostForm } from './CreatePostForm';
import { EventDetailsModal } from './EventDetailsModal';
import { FloatingNavBar } from './FloatingNavBar';
import { COUNTRIES } from '../utils/countries';
import { useEvents } from '../hooks/useEvents';
import type { Event } from '../types/event';
import type { AdminLocation } from '../lib/supabase';

type FeedMode = 'events' | 'locations';

type CreateMode = 'none' | 'select' | 'event' | 'location' | 'post';

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
  onOpenMapAt?: (lat: number, lng: number) => void;
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
  onOpenMapAt,
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
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [userName, setUserName] = useState('');
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [feedMode, setFeedMode] = useState<FeedMode>('events');
  const [adminLocations, setAdminLocations] = useState<AdminLocation[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [selectedRec, setSelectedRec] = useState<any | null>(null);
  const [recRating, setRecRating] = useState<{ avg: number | null; count: number; mine: number }>({ avg: null, count: 0, mine: 0 });
  const [ratingBump, setRatingBump] = useState(0);
  const [locationsLoaded, setLocationsLoaded] = useState(false);
  const [pullY, setPullY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const PULL_THRESHOLD = 80;

  const { events, refreshEvents, updateFilters } = useEvents({
    countries: activeCountry ? [activeCountry] : selectedCountries,
    eventType: selectedInterest || undefined,
  });

  // Re-fetch events whenever the country scope or filters change.
  // activeCountry === null → show events from ALL of the user's travel countries.
  useEffect(() => {
    updateFilters({
      countries: activeCountry ? [activeCountry] : selectedCountries,
      eventType: selectedInterest || undefined,
      searchQuery: searchQuery || undefined,
    });
  }, [activeCountry, selectedInterest, searchQuery, selectedCountries]);

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

  const loadRecRatings = async (postId: string) => {
    setRecRating({ avg: null, count: 0, mine: 0 });
    try {
      const { data, error } = await supabase.from('post_ratings').select('rating, user_id').eq('post_id', postId);
      if (error || !data) return;
      const count = data.length;
      const avg = count ? data.reduce((s, r) => s + (r.rating || 0), 0) / count : null;
      const mine = (currentUserId && data.find(r => r.user_id === currentUserId)?.rating) || 0;
      setRecRating({ avg, count, mine });
    } catch { /* post_ratings table may not exist yet */ }
  };

  const rateRec = async (rating: number) => {
    if (!currentUserId || !selectedRec) return;
    setRecRating(prev => ({ ...prev, mine: rating }));
    setRatingBump(b => b + 1);
    try {
      const { error } = await supabase.from('post_ratings').upsert(
        { post_id: selectedRec.id, user_id: currentUserId, rating },
        { onConflict: 'post_id,user_id' },
      );
      if (error) { console.error('rate error:', error.message); return; }
      loadRecRatings(selectedRec.id);
    } catch (err) { console.error('rate error:', err); }
  };

  useEffect(() => {
    if (selectedRec?.id) loadRecRatings(selectedRec.id);
  }, [selectedRec?.id]);

  const loadRecommendations = async () => {
    try {
      const { data } = await supabase
        .from('posts')
        .select('*, users(display_name, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(50);
      setRecommendations(data || []);
    } catch (err) {
      console.error('Error loading recommendations:', err);
    }
  };

  useEffect(() => {
    if (feedMode === 'locations' && !locationsLoaded) {
      loadAdminLocations();
      loadRecommendations();
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





  const handleApplyFilters = (category: string | null, date: string | null, search: string) => {
    setSelectedInterest(category);
    setSelectedDateFilter(date);
    setSearchQuery(search);
  };

  const activeCountryData = activeCountry ? COUNTRIES[activeCountry] : null;

  // Apply date filter to events pool
  const dateFilteredEvents = useMemo(() => {
    if (!selectedDateFilter || selectedDateFilter === 'all') return events;
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
      if (selectedDateFilter === 'weekend') {
        const day = d.getDay(); // 5 = Fri, 6 = Sat (Israeli weekend)
        return d >= now && d <= weekEnd && (day === 5 || day === 6);
      }
      if (selectedDateFilter === 'month')
        return d >= now && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
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
              onClick={() => setShowSearch(s => !s)}
              aria-label="חיפוש"
              aria-pressed={showSearch}
              className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors active:scale-95"
            >
              <Search className="w-5 h-5 text-gray-700" strokeWidth={1.8} />
            </button>
          </div>
        </div>
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

        {/* ─── Search (toggled from header) ─────────────── */}
        {showSearch && (
          <div className="px-4 pb-3 animate-slide-down">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="חיפוש אירועים, מקומות..."
                aria-label="חיפוש"
                className="w-full h-11 pr-10 pl-10 text-sm rounded-2xl outline-none bg-gray-100 focus:bg-white focus:ring-2 focus:ring-orange-200 transition"
                style={{ fontFamily: 'Heebo, sans-serif' }}
              />
              <button
                onClick={() => { setSearchQuery(''); setShowSearch(false); }}
                aria-label="סגור חיפוש"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-200 active:scale-90 transition"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>
        )}

        {/* ─── Countries row (circles) ──────────────────── */}
        <div
          className="flex gap-4 overflow-x-auto scrollbar-hide px-4 pb-3"
          style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        >
          {selectedCountries.map((code) => {
            const c = COUNTRIES[code];
            if (!c) return null;
            const active = activeCountry === code;
            return (
              <button
                key={code}
                onClick={() => setActiveCountry(active ? null : code)}
                aria-pressed={active}
                className="flex-shrink-0 flex flex-col items-center gap-1.5 active:scale-90 transition-transform"
              >
                <div
                  className="rounded-full p-[2.5px] transition-all duration-200"
                  style={active
                    ? { background: 'linear-gradient(135deg, #FF9F43, #FF7E1D)', boxShadow: '0 0 0 1px rgba(255,126,29,0.25)' }
                    : { background: 'transparent', boxShadow: 'inset 0 0 0 2px #e5e7eb' }}
                >
                  <div className="w-[60px] h-[60px] rounded-full bg-white flex items-center justify-center overflow-hidden">
                    <span className="text-[30px] leading-none select-none">{c.flag}</span>
                  </div>
                </div>
                <span
                  className={`text-[11px] font-bold max-w-[68px] truncate text-center leading-tight transition-colors ${active ? 'text-orange-500' : 'text-gray-600'}`}
                  style={{ fontFamily: 'Heebo, sans-serif' }}
                >
                  {c.name}
                </span>
              </button>
            );
          })}

          {/* Add / edit countries — sits at the left end of the row */}
          <button
            onClick={() => { if (onNavigateToCountrySelection) onNavigateToCountrySelection(); else setShowCountryPicker(true); }}
            aria-label="הוסף או ערוך מדינות"
            className="flex-shrink-0 flex flex-col items-center gap-1.5 active:scale-90 transition-transform"
          >
            <div
              className="w-[60px] h-[60px] rounded-full flex items-center justify-center"
              style={{ border: '2px dashed #D1D5DB', background: '#FAFAFA' }}
            >
              <Plus className="w-6 h-6 text-gray-400" strokeWidth={2.2} />
            </div>
            <span className="text-[11px] font-bold text-gray-500" style={{ fontFamily: 'Heebo, sans-serif' }}>הוסף</span>
          </button>
        </div>

        {/* ─── Category filter (pills) ──────────────────── */}
        <div
          className="flex gap-2.5 overflow-x-auto scrollbar-hide px-4 pb-2 mb-1"
          style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        >
          {Object.entries(eventCategories).map(([key, c]) => {
            const isActive = selectedInterest === key;
            return (
              <button
                key={key}
                onClick={() => {
                  setSelectedInterest(prev => (prev === key ? null : key));
                  setSelectedDateFilter(null);
                }}
                aria-pressed={isActive}
                className="flex-shrink-0 flex items-center gap-1.5 px-3.5 h-10 rounded-full transition-all active:scale-95"
                style={isActive
                  ? { background: 'linear-gradient(135deg, #F97316, #EA580C)', color: '#fff', boxShadow: '0 6px 16px rgba(249,115,22,0.30)' }
                  : { background: '#fff', color: '#4B5563', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
              >
                <span className="text-[16px] leading-none select-none">{c.emoji}</span>
                <span className="text-[13px] font-bold whitespace-nowrap" style={{ fontFamily: 'Heebo, sans-serif' }}>{c.label}</span>
              </button>
            );
          })}
        </div>

        {/* ─── Date quick-chips (slide in once a category is picked) ── */}
        {selectedInterest && (
          <div
            key={selectedInterest}
            className="flex gap-2 overflow-x-auto scrollbar-hide px-4 pb-3 mb-1 animate-slide-down"
            style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
          >
            {[
              { v: 'all',     label: 'הכל' },
              { v: 'today',   label: 'היום' },
              { v: 'weekend', label: 'סוף השבוע' },
              { v: 'week',    label: 'השבוע' },
              { v: 'month',   label: 'החודש' },
            ].map(chip => {
              const active = (selectedDateFilter || 'all') === chip.v;
              return (
                <button
                  key={chip.v}
                  onClick={() => setSelectedDateFilter(chip.v === 'all' ? null : chip.v)}
                  aria-pressed={active}
                  className="flex-shrink-0 px-4 py-2 rounded-full text-[13px] font-bold transition-all active:scale-95"
                  style={{
                    fontFamily: 'Heebo, sans-serif',
                    background: active ? 'linear-gradient(135deg, #F97316, #EA580C)' : '#F3F4F6',
                    color: active ? '#fff' : '#6B7280',
                    boxShadow: active ? '0 4px 14px rgba(249,115,22,0.3)' : 'none',
                  }}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        )}

        {/* ─── Main content ─── */}
        <div className="pb-28 animate-fade-in" key={feedMode} style={{ animationDuration: '0.22s' }}>

        {/* ════════════════ LOCATIONS FEED ════════════════ */}
        {feedMode === 'locations' ? (
          <>
          {recommendations.length > 0 && (
            <div style={{ margin: '4px 16px 12px' }}>
              <p className="px-1 mb-2" style={{ fontSize: 13, fontWeight: 900, color: '#374151', fontFamily: 'Heebo, sans-serif' }}>המלצות מהקהילה</p>
              <div style={{ display: 'grid', gap: 10 }}>
                {recommendations.map(rec => {
                  const tag = rec.tags?.[0];
                  const place = [rec.city, rec.country ? COUNTRIES[rec.country]?.name : null].filter(Boolean).join(', ');
                  return (
                    <div key={rec.id} onClick={() => setSelectedRec(rec)} className="active:scale-[0.99] transition-transform" style={{ display: 'flex', gap: 12, padding: 12, background: '#fff', borderRadius: 18, boxShadow: 'var(--shadow-card)', cursor: 'pointer' }}>
                      <div style={{ width: 72, height: 72, borderRadius: 14, flexShrink: 0, overflow: 'hidden', background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {rec.image_url
                          ? <img src={rec.image_url} alt={rec.place_name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <Star className="w-7 h-7" style={{ color: '#F97316' }} strokeWidth={2} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                          <p style={{ fontSize: 15, fontWeight: 800, color: '#111827', fontFamily: "'Heebo', sans-serif", margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rec.place_name || 'המלצה'}</p>
                          {tag && <span style={{ fontSize: 10, fontWeight: 700, color: '#EA580C', background: '#FFF7ED', borderRadius: 20, padding: '2px 7px', flexShrink: 0, fontFamily: "'Heebo', sans-serif" }}>{tag}</span>}
                        </div>
                        <p style={{ fontSize: 12.5, color: '#6B7280', fontFamily: "'Rubik', sans-serif", margin: '0 0 4px', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{rec.content}</p>
                        {place && (
                          <span style={{ fontSize: 11.5, color: '#9CA3AF', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, fontFamily: "'Heebo', sans-serif" }}>
                            <MapPin size={11} strokeWidth={2} /> {place}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {!locationsLoaded ? (
            <div className="px-4 space-y-4 pt-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse">
                  <div style={{ height: 80, background: '#F3F4F6', borderRadius: 20 }} />
                </div>
              ))}
            </div>
          ) : (adminLocations.length === 0 && recommendations.length === 0) ? (
            <div className="flex flex-col items-center px-6 pt-20 pb-12 text-center animate-fade-in">
              <div className="text-6xl mb-5">📍</div>
              <h3 className="text-xl font-black text-gray-900 mb-2" style={{ fontFamily: 'Heebo, sans-serif' }}>
                אין מקומות עדיין
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed max-w-xs" style={{ fontFamily: 'Rubik, sans-serif' }}>
                המנהל טרם הוסיף מקומות מומלצים
              </p>
            </div>
          ) : adminLocations.length > 0 ? (
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
          ) : null}
          </>

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
                            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 14px', cursor: 'pointer' }}
                          >
                            {/* Thumbnail */}
                            <div style={{ width: 80, height: 80, flexShrink: 0, borderRadius: 16, overflow: 'hidden', background: cat ? `${cat.color}20` : '#F3F4F6' }}>
                              {bg ? (
                                <img src={bg} alt={event.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34 }}>
                                  {event.emoji || cat?.emoji || '📍'}
                                </div>
                              )}
                            </div>

                            {/* Text */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 15, fontWeight: 800, color: '#111827', fontFamily: "'Heebo', sans-serif", margin: '0 0 6px', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {event.title}
                              </p>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <span style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, fontFamily: "'Heebo', sans-serif" }}>
                                  <MapPin size={12} strokeWidth={2} />{event.city}
                                </span>
                                <span style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, fontFamily: "'Heebo', sans-serif" }}>
                                  <Clock size={12} strokeWidth={2} />{time}
                                </span>
                              </div>
                            </div>

                            {/* Attendees badge */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: '#FFF7ED', borderRadius: 20, padding: '5px 9px' }}>
                                <Users size={11} color="#F97316" strokeWidth={2} />
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#F97316', fontFamily: "'Heebo', sans-serif" }}>
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
          onSelectPost={() => setCreateMode('post')}
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

      {createMode === 'post' && currentUserId && (
        <CreatePostForm
          onSuccess={() => { setCreateMode('none'); setFeedMode('locations'); loadRecommendations(); }}
          onCancel={() => setCreateMode('none')}
          currentUserId={currentUserId}
          defaultCountry={activeCountry || selectedCountries[0] || undefined}
        />
      )}

      {/* Recommendation details */}
      {selectedRec && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center animate-fade-in" dir="rtl" onClick={() => setSelectedRec(null)}>
          <div className="bg-white w-full max-w-md rounded-t-[28px] animate-slide-up overflow-hidden" onClick={(e) => e.stopPropagation()} style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
            {selectedRec.image_url ? (
              <div style={{ position: 'relative', height: 200 }}>
                <img src={selectedRec.image_url} alt={selectedRec.place_name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button onClick={() => setSelectedRec(null)} aria-label="סגור" style={{ position: 'absolute', top: 14, left: 14, width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            ) : (
              <div className="relative pt-3">
                <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto" />
                <button onClick={() => setSelectedRec(null)} aria-label="סגור" className="absolute top-2 left-4 w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            )}

            <div className="px-6 pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-5 h-5 flex-shrink-0" style={{ color: '#F97316' }} fill="#F97316" />
                <h2 className="text-2xl font-black text-gray-900" style={{ fontFamily: 'Heebo, sans-serif' }}>{selectedRec.place_name || 'המלצה'}</h2>
              </div>
              {selectedRec.tags?.[0] && (
                <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 700, color: '#EA580C', background: '#FFF7ED', borderRadius: 20, padding: '3px 12px', fontFamily: 'Heebo, sans-serif' }}>{selectedRec.tags[0]}</span>
              )}
              <p className="text-[15px] text-gray-600 leading-relaxed mt-3" style={{ fontFamily: 'Rubik, sans-serif' }}>{selectedRec.content}</p>
              {(selectedRec.city || selectedRec.country) && (
                <div className="flex items-center gap-2 mt-4 text-[14px] font-semibold" style={{ color: '#6B7280', fontFamily: 'Rubik, sans-serif' }}>
                  <MapPin className="w-4 h-4" style={{ color: '#F97316' }} />
                  {[selectedRec.city, selectedRec.country ? COUNTRIES[selectedRec.country]?.name : null].filter(Boolean).join(', ')}
                </div>
              )}
              {selectedRec.users?.display_name && (
                <p className="text-[13px] text-gray-400 mt-2" style={{ fontFamily: 'Rubik, sans-serif' }}>הומלץ על ידי {selectedRec.users.display_name}</p>
              )}
            </div>

            {/* דירוג אופציונלי עם אנימציה */}
            <div className="px-6 pt-5">
              <style>{`
                @keyframes recStarPop { 0% { transform: scale(0.5); } 55% { transform: scale(1.28); } 100% { transform: scale(1); } }
                @media (prefers-reduced-motion: reduce) { .rec-star { animation: none !important; } }
              `}</style>
              <div className="rounded-2xl border border-gray-100 px-4 py-3.5" style={{ background: '#FAFAFA' }}>
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-black text-gray-700" style={{ fontFamily: 'Heebo, sans-serif' }}>
                    {recRating.mine > 0 ? 'הדירוג שלך' : 'דרגו את המקום'}
                  </span>
                  {recRating.avg != null && recRating.count > 0 && (
                    <span className="flex items-center gap-1 text-[13px] font-bold text-gray-400" style={{ fontFamily: 'Rubik, sans-serif' }}>
                      <Star className="w-3.5 h-3.5" style={{ color: '#F97316' }} fill="#F97316" />
                      {recRating.avg.toFixed(1)} · {recRating.count}
                    </span>
                  )}
                </div>
                <div key={ratingBump} className="flex gap-2 mt-2.5" style={{ direction: 'ltr', justifyContent: 'flex-end' }}>
                  {[1, 2, 3, 4, 5].map((n) => {
                    const filled = n <= recRating.mine;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => rateRec(n)}
                        aria-label={`דרג ${n} מתוך 5`}
                        className="rec-star"
                        style={{ background: 'none', border: 'none', padding: 2, cursor: currentUserId ? 'pointer' : 'default', lineHeight: 0, animation: filled ? `recStarPop 0.42s cubic-bezier(0.34,1.56,0.64,1) ${(n - 1) * 70}ms both` : 'none' }}
                      >
                        <Star className="w-9 h-9" strokeWidth={2} style={{ color: filled ? '#F97316' : '#D1D5DB', fill: filled ? '#F97316' : 'none', transition: 'color 0.18s, fill 0.18s' }} />
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11.5px] mt-2" style={{ color: recRating.mine > 0 ? '#16A34A' : '#9CA3AF', fontFamily: 'Rubik, sans-serif', transition: 'color 0.2s' }}>
                  {!currentUserId ? 'התחברו כדי לדרג' : recRating.mine > 0 ? 'תודה על הדירוג! 🎉' : 'אופציונלי — לא חובה לדרג'}
                </p>
              </div>
            </div>

            <div className="px-5 pt-5">
              {selectedRec.latitude != null && selectedRec.longitude != null && onOpenMapAt ? (
                <button
                  onClick={() => { const r = selectedRec; setSelectedRec(null); onOpenMapAt(r.latitude, r.longitude); }}
                  className="w-full h-14 rounded-2xl font-black text-white active:scale-[0.98] transition flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', boxShadow: '0 8px 24px rgba(249,115,22,0.35)', fontFamily: 'Heebo, sans-serif' }}
                >
                  <MapPin className="w-5 h-5" /> פתח במפה
                </button>
              ) : (
                <div className="text-center text-[13px] text-gray-400 py-2" style={{ fontFamily: 'Rubik, sans-serif' }}>
                  למקום זה לא צורף מיקום מדויק
                </div>
              )}
            </div>
          </div>
        </div>
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
        initialSearch={searchQuery}
        onApply={handleApplyFilters}
        onClose={() => setShowFilterSheet(false)}
      />

      {/* ── Country picker ── */}
      {showCountryPicker && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
          onClick={() => setShowCountryPicker(false)}
          dir="rtl"
        >
          <div
            className="w-full bg-white"
            style={{ borderRadius: '24px 24px 0 0', maxHeight: '80dvh', boxShadow: '0 -16px 50px rgba(0,0,0,0.25)', animation: 'slide-up 0.3s ease-out' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="relative px-5 pt-3 pb-3" style={{ borderBottom: '1px solid #F3F4F6' }}>
              <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-4" />
              <h3 className="text-[18px] font-black text-gray-900 text-center" style={{ fontFamily: 'Heebo, sans-serif' }}>בחר מדינה</h3>
              <button onClick={() => setShowCountryPicker(false)} aria-label="סגור" className="absolute left-4 top-3 w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center active:scale-95">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="overflow-y-auto px-4 py-3" style={{ maxHeight: 'calc(80dvh - 130px)' }}>
              <button
                onClick={() => { setActiveCountry(null); setShowCountryPicker(false); }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl active:scale-[0.98] transition-all mb-1"
                style={{ background: !activeCountry ? '#FFF7ED' : 'transparent', border: !activeCountry ? '1.5px solid #FDBA74' : '1.5px solid transparent' }}
              >
                <span className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-[18px]">🌍</span>
                <span className="flex-1 text-right text-[15px] font-bold text-gray-900" style={{ fontFamily: 'Heebo, sans-serif' }}>כל המדינות שלי</span>
                {!activeCountry && <Check className="w-5 h-5 text-orange-500" strokeWidth={2.5} />}
              </button>

              {selectedCountries.map(code => {
                const c = COUNTRIES[code]; if (!c) return null;
                const sel = activeCountry === code;
                return (
                  <button
                    key={code}
                    onClick={() => { setActiveCountry(code); setShowCountryPicker(false); }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl active:scale-[0.98] transition-all mb-1"
                    style={{ background: sel ? '#FFF7ED' : 'transparent', border: sel ? '1.5px solid #FDBA74' : '1.5px solid transparent' }}
                  >
                    <span className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-[18px]">{c.flag}</span>
                    <span className="flex-1 text-right text-[15px] font-bold text-gray-900" style={{ fontFamily: 'Heebo, sans-serif' }}>{c.name}</span>
                    {sel && <Check className="w-5 h-5 text-orange-500" strokeWidth={2.5} />}
                  </button>
                );
              })}
            </div>

            <div className="px-4 pt-2" style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
              <button
                onClick={() => { setShowCountryPicker(false); (onNavigateToCountrySelection ?? onNavigateToProfile)?.(); }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl active:scale-95 transition-all"
                style={{ background: '#F3F4F6', color: '#6B7280', fontSize: 14, fontWeight: 700, fontFamily: 'Heebo, sans-serif' }}
              >
                <Plus className="w-4 h-4" strokeWidth={2.5} /> ערוך מדינות
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
