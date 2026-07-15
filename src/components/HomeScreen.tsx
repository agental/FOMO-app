import { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, MapPin, Shield, Bell, Calendar, Users, Clock, ChevronDown, Check, X, Search } from 'lucide-react';
import { FilterSheet } from './FilterSheet';
import { HeaderProfileAvatar } from './HeaderProfileAvatar';
import { supabase } from '../lib/supabase';
import { SkeletonCard } from './SkeletonCard';
import { eventCategories } from '../utils/eventCategories';
import { CreateModal } from './CreateModal';
import { MapCreateEventFlow } from './MapCreateEventFlow';
import { CreateLocationForm } from './CreateLocationForm';
import { EventDetailsModal } from './EventDetailsModal';
import { AdminLocationBottomSheet } from './AdminLocationBottomSheet';
import { CountryGuide } from './CountryGuide';
import { FloatingNavBar } from './FloatingNavBar';
import { COUNTRIES } from '../utils/countries';
import { useEvents } from '../hooks/useEvents';
import { getNotifLastSeen } from '../utils/notificationsSeen';
import type { Event } from '../types/event';
import type { AdminLocation } from '../lib/supabase';

type FeedMode = 'events' | 'locations';

/* ── module-level cache (survives navigation) ── */
type HomeUserCache = { userName: string; userAvatarUrl: string | null; isAdmin: boolean; selectedCountries: string[] };
const _homeUserCache: Record<string, HomeUserCache> = {};
// Tracks whether the one-time "first open" refresh animation has already played.
// Module-level so it survives navigation remounts, but resets on a full page reload.
let _homeDidInitialRefresh = false;

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
  onOpenMapAt?: (lat: number, lng: number) => void;
  initialCountries?: string[];
  currentUserId?: string | null;
  openCreateSignal?: boolean;
  onCreateConsumed?: () => void;
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
  onMessageUser,
  initialCountries,
  currentUserId: propUserId,
  openCreateSignal,
  onCreateConsumed,
}: HomeScreenProps = {}) {
  const _cachedCountries = propUserId ? (_homeUserCache[propUserId]?.selectedCountries ?? initialCountries ?? []) : (initialCountries || []);
  const [selectedCountries, setSelectedCountries] = useState<string[]>(_cachedCountries);
  const [activeCountry, setActiveCountry] = useState<string | null>(_cachedCountries[0] || null);
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
  const _huc = propUserId ? _homeUserCache[propUserId] : undefined;
  const [isAdmin, setIsAdmin] = useState(_huc?.isAdmin ?? false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [userName, setUserName] = useState(_huc?.userName ?? '');
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(_huc?.userAvatarUrl ?? null);
  const [feedMode, setFeedMode] = useState<FeedMode>('events');
  const [adminLocations, setAdminLocations] = useState<AdminLocation[]>([]);
  const [placeSheet, setPlaceSheet] = useState<AdminLocation | null>(null); // Apple-Maps place card
  // GPS cached by the native bridge — powers "distance from you" and the "near you" rail.
  const homeUserLocation = useMemo(() => {
    const nat = (window as any)._nativeLocation;
    return nat?.lat != null ? { latitude: nat.lat as number, longitude: nat.lng as number } : null;
  }, []);
  const [locationsLoaded, setLocationsLoaded] = useState(false);
  const [pullY, setPullY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isReturning, setIsReturning] = useState(false);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const dotOriginY = useRef(32);
  const dotOriginX = useRef(0);
  const PULL_THRESHOLD = 80;
  const ORBIT_R = 28;
  const DOT_SIZE = 9;
  const orbitAngleRef = useRef(0);
  const animDotRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const fLetterRef = useRef<HTMLSpanElement>(null);
  const [logoAnimActive, setLogoAnimActive] = useState(false);
  // True from the very first paint of a fresh app open (when we already know the
  // user's countries), so skeletons show instead of a "no events" flash before
  // the first-open animation takes over on the next frame.
  const [firstOpenLoading, setFirstOpenLoading] = useState(
    () => !_homeDidInitialRefresh && _cachedCountries.length > 0
  );
  const [hotIdx, setHotIdx] = useState(0);
  const hotIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hotTouchXRef = useRef(0);
  const [fomoImpact, setFomoImpact] = useState(0);
  const logoAnimDotRef = useRef<HTMLDivElement>(null);
  const logoAnimRafRef = useRef<number | null>(null);

  const { events, refreshEvents, updateFilters } = useEvents({
    countries: activeCountry ? [activeCountry] : selectedCountries,
    eventType: selectedInterest || undefined,
  });

  // When the "+" button is pressed from another screen, App routes back here
  // and raises this signal so we open the create sheet.
  useEffect(() => {
    if (openCreateSignal) {
      setCreateMode('select');
      onCreateConsumed?.();
    }
  }, [openCreateSignal]);

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

  // ── Orbit RAF: runs while isRefreshing ──────────────────────────────────
  useEffect(() => {
    if (!isRefreshing || !animDotRef.current) return;

    const orbitCenterY = dotOriginY.current + 88;
    const omega = (2 * Math.PI) / 1200; // 1 revolution per 1200 ms

    // Synchronously place dot at 12-o'clock before first frame to avoid flicker
    const initX = window.innerWidth / 2;
    const initY = orbitCenterY - ORBIT_R;
    animDotRef.current.style.transform = `translate(${initX - DOT_SIZE / 2}px, ${initY - DOT_SIZE / 2}px)`;
    animDotRef.current.style.opacity = '1';

    let startTime: number | null = null;
    const tick = (now: number) => {
      if (startTime === null) startTime = now;
      const angle = omega * (now - startTime);
      orbitAngleRef.current = angle;
      const x = window.innerWidth / 2 + Math.sin(angle) * ORBIT_R;
      const y = orbitCenterY - Math.cos(angle) * ORBIT_R;
      if (animDotRef.current) {
        animDotRef.current.style.transform = `translate(${x - DOT_SIZE / 2}px, ${y - DOT_SIZE / 2}px)`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } };
  }, [isRefreshing]);

  // ── Return RAF: smoothly travels back to "." position on completion ─────
  useEffect(() => {
    if (!isReturning || !animDotRef.current) return;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }

    const orbitCenterY = dotOriginY.current + 88;
    const angle = orbitAngleRef.current;
    const startX = window.innerWidth / 2 + Math.sin(angle) * ORBIT_R;
    const startY = orbitCenterY - Math.cos(angle) * ORBIT_R;
    const targetX = window.innerWidth / 2 + dotOriginX.current;
    const targetY = dotOriginY.current;
    const DURATION = 450;
    const startTime = performance.now();

    const tick = (now: number) => {
      const t = Math.min((now - startTime) / DURATION, 1);
      const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const x = startX + (targetX - startX) * ease;
      const y = startY + (targetY - startY) * ease;
      if (animDotRef.current) {
        animDotRef.current.style.transform = `translate(${x - DOT_SIZE / 2}px, ${y - DOT_SIZE / 2}px)`;
        animDotRef.current.style.opacity = String(1 - ease);
      }
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } };
  }, [isReturning]);

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
        const countries = data.selected_countries ?? [];
        const name      = data.display_name ? data.display_name.split(' ')[0] : '';
        const admin     = data.role === 'admin';
        const avatar    = data.avatar_url ?? null;
        if (currentUserId) {
          _homeUserCache[currentUserId] = { userName: name, userAvatarUrl: avatar, isAdmin: admin, selectedCountries: countries };
        }
        if (countries.length) {
          setSelectedCountries(countries);
          setActiveCountry(prev => prev || countries[0] || null);
        }
        if (name) setUserName(name);
        setIsAdmin(admin);
        setUserAvatarUrl(avatar);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  // Core animation: fall (optional) → 4 orbits → slam into F → letters bounce
  const triggerLogoAnimation = (skipFall: boolean) => {
    const dotEl = dotRef.current;
    const fEl   = fLetterRef.current;
    if (!dotEl || !fEl) return;

    const dr = dotEl.getBoundingClientRect();
    const fr = fEl.getBoundingClientRect();
    const startX = dr.left + dr.width / 2;
    const startY = dr.top  + dr.height / 2;
    const oCX    = window.innerWidth / 2;
    const oCY    = startY + 80;
    const oTopY  = oCY - ORBIT_R;
    const fX     = fr.left + fr.width / 2;
    const fY     = fr.top  + fr.height / 2;

    const FALL_DUR   = skipFall ? 0 : 320;
    const ORBIT_DUR  = 680;
    const N_ORBITS   = 4;
    const STRIKE_DUR = 260;

    setLogoAnimActive(true);
    if (logoAnimRafRef.current) cancelAnimationFrame(logoAnimRafRef.current);

    // When skipping fall (pull-to-refresh), position dot at orbit top immediately
    if (skipFall && logoAnimDotRef.current) {
      logoAnimDotRef.current.style.transform = `translate(${oCX - DOT_SIZE / 2}px, ${oTopY - DOT_SIZE / 2}px)`;
      logoAnimDotRef.current.style.opacity = '1';
    }

    const t0 = performance.now();
    const tick = (now: number) => {
      const el = now - t0;
      let x: number, y: number;

      if (el < FALL_DUR) {
        const p = el / FALL_DUR;
        const e = 1 - Math.pow(1 - p, 2);
        x = startX + (oCX - startX) * e;
        y = startY + (oTopY - startY) * e;
      } else if (el < FALL_DUR + N_ORBITS * ORBIT_DUR) {
        const angle = (2 * Math.PI * (el - FALL_DUR)) / ORBIT_DUR;
        x = oCX + Math.sin(angle) * ORBIT_R;
        y = oCY - Math.cos(angle) * ORBIT_R;
      } else if (el < FALL_DUR + N_ORBITS * ORBIT_DUR + STRIKE_DUR) {
        const p = (el - FALL_DUR - N_ORBITS * ORBIT_DUR) / STRIKE_DUR;
        const e = p * p * p;
        x = oCX + (fX - oCX) * e;
        y = oTopY + (fY - oTopY) * e;
      } else {
        if (logoAnimDotRef.current) logoAnimDotRef.current.style.opacity = '0';
        setLogoAnimActive(false);
        setFomoImpact(n => n + 1);
        setTimeout(() => setFomoImpact(0), 900);
        return;
      }

      if (logoAnimDotRef.current) {
        logoAnimDotRef.current.style.transform = `translate(${x - DOT_SIZE / 2}px, ${y - DOT_SIZE / 2}px)`;
        logoAnimDotRef.current.style.opacity = '1';
      }
      logoAnimRafRef.current = requestAnimationFrame(tick);
    };

    logoAnimRafRef.current = requestAnimationFrame(tick);
  };

  const handleLogoTap = () => {
    if (logoAnimActive || fomoImpact > 0 || pullY > 0 || isRefreshing || isReturning) return;
    triggerLogoAnimation(false);
  };

  // ── First open: play the refresh animation once, then remember data ──
  // Replaces the brief "no events" flash with the same FOMO dot + skeleton
  // loading used by pull-to-refresh. Guarded by a module flag so navigating
  // back to Home never re-triggers it.
  useEffect(() => {
    if (_homeDidInitialRefresh) return;
    if (selectedCountries.length === 0) return; // no scope yet — nothing to load
    _homeDidInitialRefresh = true;
    const id = requestAnimationFrame(() => {
      refreshEvents();          // fetch in background while the animation plays
      triggerLogoAnimation(false); // dot falls from the "." → 4 orbits → strike
    });
    return () => cancelAnimationFrame(id);
  }, [selectedCountries.length]);

  // First-open skeleton clears as soon as data is ready (snappy), with a hard
  // safety cap so it can never stick — even if the dot animation failed to start.
  // The FOMO dot keeps flying on top independently via logoAnimActive.
  useEffect(() => {
    if (!firstOpenLoading) return;
    if (events.length > 0) { setFirstOpenLoading(false); return; }
    const t = setTimeout(() => setFirstOpenLoading(false), 3500);
    return () => clearTimeout(t);
  }, [firstOpenLoading, events.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY > 0) return;
    touchStartY.current = e.touches[0].clientY;
    isPulling.current = true;
    if (dotRef.current) {
      const r = dotRef.current.getBoundingClientRect();
      dotOriginY.current = r.top + r.height / 2;
      dotOriginX.current = (r.left + r.width / 2) - window.innerWidth / 2;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling.current || isRefreshing || logoAnimActive) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) {
      setPullY(Math.min(delta * 0.45, PULL_THRESHOLD * 1.1));
    } else {
      isPulling.current = false;
      setPullY(0);
    }
  };

  const handleTouchEnd = () => {
    if (!isPulling.current) return;
    isPulling.current = false;
    if (pullY >= PULL_THRESHOLD) {
      setPullY(0);
      refreshEvents(); // refresh data in background while animation plays
      triggerLogoAnimation(true); // skip fall — dot is already at orbit top from the pull
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
      // (a) Incoming join requests awaiting my approval (events I created)
      const { data: myEvents } = await supabase
        .from('events')
        .select('id')
        .eq('user_id', currentUserId);

      let incoming = 0;
      if (myEvents && myEvents.length > 0) {
        const { data: requests, error } = await supabase
          .from('event_join_requests')
          .select('id')
          .in('event_id', myEvents.map(e => e.id))
          .eq('status', 'pending');
        if (error) throw error;
        incoming = requests?.length || 0;
      }

      // (b) Decisions on MY OWN requests I haven't seen yet (approved / rejected)
      const lastSeen = getNotifLastSeen(currentUserId);
      const { data: myDecisions } = await supabase
        .from('event_join_requests')
        .select('updated_at')
        .eq('user_id', currentUserId)
        .in('status', ['approved', 'rejected'])
        .order('updated_at', { ascending: false })
        .limit(50);
      const unreadDecisions = (myDecisions || []).filter(
        d => new Date(d.updated_at).getTime() > lastSeen
      ).length;

      setPendingRequestsCount(incoming + unreadDecisions);
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

  // ── Hot-carousel auto-advance ─────────────────────────────────────────────
  useEffect(() => {
    if (logoAnimActive || featuredEvents.length <= 1) {
      if (hotIntervalRef.current) clearInterval(hotIntervalRef.current);
      return;
    }
    hotIntervalRef.current = setInterval(() => {
      setHotIdx(i => (i + 1) % featuredEvents.length);
    }, 3500);
    return () => { if (hotIntervalRef.current) clearInterval(hotIntervalRef.current); };
  }, [featuredEvents.length, logoAnimActive]);

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

  // Feed skeleton shows during: (a) first open until data loads, or (b) a
  // pull/tap refresh where we already have data and want skeletons during the spin.
  const showFeedSkeleton = firstOpenLoading || (logoAnimActive && events.length > 0);

  return (
    <div className="min-h-screen overflow-x-hidden max-w-full" style={{ background: '#ffffff' }} dir="rtl">

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
          <div className="absolute left-1/2 -translate-x-1/2" onClick={handleLogoTap} style={{ cursor: 'default', userSelect: 'none' }}>
            <span
              className="text-[22px] font-black text-gray-900"
              style={{ fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.04em' }}
            >
              <span dir="ltr">
                <span ref={fLetterRef} style={{ display: 'inline-block', animation: fomoImpact > 0 ? `_fhF${fomoImpact} 560ms ease-out forwards` : undefined }}>F</span>
                <span style={{ display: 'inline-block', animation: fomoImpact > 0 ? `_fhO${fomoImpact} 500ms ease-out 55ms forwards` : undefined }}>O</span>
                <span style={{ display: 'inline-block', animation: fomoImpact > 0 ? `_fhM${fomoImpact} 440ms ease-out 110ms forwards` : undefined }}>M</span>
                <span style={{ display: 'inline-block', animation: fomoImpact > 0 ? `_fhO${fomoImpact} 380ms ease-out 165ms forwards` : undefined }}>O</span>
                <span ref={dotRef} style={{ color: '#F97316', opacity: (pullY > 0 || isRefreshing || isReturning || logoAnimActive || fomoImpact > 0) ? 0 : 1, transition: 'opacity 0.4s ease' }}>.</span>
              </span>
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

      {/* ─── Pull-to-refresh: FOMO dot animation ─── */}
      {/* Pull phase: React-controlled position, falls diagonally from "." to top of orbit */}
      {pullY > 0 && !isRefreshing && !isReturning && (() => {
        const orbitCenterY = dotOriginY.current + 88;
        const p = Math.min(pullY / PULL_THRESHOLD, 1);
        const screenX = window.innerWidth / 2 + dotOriginX.current * (1 - p);
        const screenY = dotOriginY.current + (orbitCenterY - ORBIT_R - dotOriginY.current) * p;
        return (
          <div style={{
            position: 'fixed',
            left: 0,
            top: 0,
            transform: `translate(${screenX - DOT_SIZE / 2}px, ${screenY - DOT_SIZE / 2}px)`,
            width: DOT_SIZE,
            height: DOT_SIZE,
            borderRadius: '50%',
            background: '#F97316',
            opacity: Math.min(p * 2.5, 1),
            zIndex: 98,
            pointerEvents: 'none',
          }} />
        );
      })()}
      {/* Orbit + return phase: position driven entirely by RAF via animDotRef */}
      {(isRefreshing || isReturning) && (
        <div
          ref={animDotRef}
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            width: DOT_SIZE,
            height: DOT_SIZE,
            borderRadius: '50%',
            background: '#F97316',
            opacity: 0,
            zIndex: 98,
            pointerEvents: 'none',
            willChange: 'transform, opacity',
          }}
        />
      )}

      {/* ─── Logo tap: RAF-driven dot (fall → 4 orbits → slam into F) ─── */}
      {logoAnimActive && (
        <div
          ref={logoAnimDotRef}
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            width: DOT_SIZE,
            height: DOT_SIZE,
            borderRadius: '50%',
            background: '#F97316',
            opacity: 0,
            zIndex: 99,
            pointerEvents: 'none',
            willChange: 'transform, opacity',
          }}
        />
      )}
      {/* Letter-impact keyframes — unique name per hit so CSS restarts them automatically */}
      {fomoImpact > 0 && (
        <style>{`
          @keyframes _fhF${fomoImpact} {
            0%   { transform: none; }
            16%  { transform: translateX(-8px) translateY(-5px) rotate(-9deg) scale(1.3); }
            48%  { transform: translateX(3px) translateY(1px) rotate(3deg) scale(0.93); }
            72%  { transform: translateX(-1.5px) rotate(-1deg); }
            88%  { transform: translateX(0.5px); }
            100% { transform: none; }
          }
          @keyframes _fhO${fomoImpact} {
            0%   { transform: none; }
            20%  { transform: translateX(-5px) translateY(-3px) scale(1.12); }
            55%  { transform: translateX(2px) scale(0.96); }
            80%  { transform: translateX(-0.5px); }
            100% { transform: none; }
          }
          @keyframes _fhM${fomoImpact} {
            0%   { transform: none; }
            26%  { transform: translateX(-3px) translateY(-1.5px) scale(1.07); }
            62%  { transform: translateX(1px); }
            100% { transform: none; }
          }
        `}</style>
      )}


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
              // one button width (44px) — the buttons are adjacent (gap: 0), so 48px overshot
              // by 4px and the indicator poked out past the pill's right edge.
              transform: feedMode === 'locations' ? 'translateX(44px)' : 'translateX(0)',
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

        {/* ─── Main content ─── */}
        <div className="pb-28 animate-fade-in" key={feedMode} style={{ animationDuration: '0.22s' }}>

        {/* ════════════════ LOCATIONS FEED ════════════════ */}
        {feedMode === 'locations' ? (
          <>
          <CountryGuide
            countryCode={activeCountry}
            onSelectCountry={setActiveCountry}
            onOpenMap={onNavigateToMap}
            places={adminLocations}
            onSelectPlace={setPlaceSheet}
          />
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

          /* Empty state — no events at all for this country (suppressed while the first-open animation runs) */
          ) : (events.length === 0 && !logoAnimActive && !firstOpenLoading) ? (
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
              {(showFeedSkeleton || featuredEvents.length > 0) && (
                <div className="mb-8">
                  <div className="flex items-center gap-2.5 px-4 mb-4">
                    <h3 className="text-lg font-black text-gray-900 tracking-tight" style={{ fontFamily: 'Heebo, sans-serif' }}>
                      🔥 חם עכשיו
                    </h3>
                  </div>

                  {showFeedSkeleton ? (
                    /* ── Skeleton: mirrors the real carousel layout ── */
                    <>
                      <div style={{ position: 'relative', height: 214, overflow: 'hidden' }}>
                        {[-2, -1, 0, 1, 2].map(offset => (
                          <div
                            key={offset}
                            className="animate-pulse"
                            style={{
                              position: 'absolute',
                              left: '50%',
                              top: '50%',
                              width: 280,
                              height: 200,
                              transform: `translate(calc(-50% + ${offset * 296}px), -50%) scale(${offset === 0 ? 1 : 0.88})`,
                              opacity: offset === 0 ? 1 : 0.55,
                              borderRadius: 16,
                              overflow: 'hidden',
                              background: 'linear-gradient(135deg,#e5e7eb,#d1d5db)',
                              boxShadow: '0 4px 20px rgba(0,0,0,0.10)',
                            }}
                          >
                            {/* gradient overlay like real card */}
                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.08) 50%, transparent 100%)' }} />
                            {/* top badges */}
                            <div style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ height: 24, width: 44, borderRadius: 20, background: 'rgba(255,255,255,0.25)' }} />
                              <div style={{ height: 24, width: 52, borderRadius: 20, background: 'rgba(249,115,22,0.35)' }} />
                            </div>
                            {/* bottom text lines */}
                            <div style={{ position: 'absolute', bottom: 14, left: 14, right: 14 }}>
                              <div style={{ height: 16, borderRadius: 8, background: 'rgba(255,255,255,0.35)', marginBottom: 8, width: offset === 0 ? '75%' : '60%' }} />
                              <div style={{ height: 11, borderRadius: 6, background: 'rgba(255,255,255,0.22)', width: offset === 0 ? '50%' : '40%' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* dot indicators skeleton */}
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 10 }}>
                        {[0, 1, 2, 3, 4].map(i => (
                          <div key={i} style={{ width: i === 0 ? 18 : 6, height: 6, borderRadius: 3, background: i === 0 ? '#F97316' : '#D1D5DB', opacity: 0.5 }} />
                        ))}
                      </div>
                    </>
                  ) : (
                    /* ── Real: transform-based centered carousel with scale focus ── */
                    <>
                      <div
                        style={{ position: 'relative', height: 214, overflow: 'hidden' }}
                        onTouchStart={e => { hotTouchXRef.current = e.touches[0].clientX; }}
                        onTouchEnd={e => {
                          const dx = hotTouchXRef.current - e.changedTouches[0].clientX;
                          if (Math.abs(dx) < 28) return;
                          const n = featuredEvents.length;
                          const next = dx > 0
                            ? (hotIdx + 1) % n
                            : (hotIdx - 1 + n) % n;
                          setHotIdx(next);
                          if (hotIntervalRef.current) clearInterval(hotIntervalRef.current);
                          hotIntervalRef.current = setInterval(
                            () => setHotIdx(i => (i + 1) % featuredEvents.length), 3500
                          );
                        }}
                      >
                        {featuredEvents.map((event, i) => {
                          const n = featuredEvents.length;
                          let offset = i - hotIdx;
                          if (offset > n / 2) offset -= n;
                          if (offset < -n / 2) offset += n;
                          const bg = event.image_url || null;

                          // Psychology signals for carousel card
                          const evDate = new Date(event.event_date);
                          const nowC   = new Date();
                          const tom2   = new Date(nowC); tom2.setDate(nowC.getDate() + 1);
                          const cIsToday    = evDate.toDateString() === nowC.toDateString();
                          const cIsTomorrow = evDate.toDateString() === tom2.toDateString();
                          const cIsUnlimited = event.max_attendees >= 9999;
                          const cSpotsLeft   = cIsUnlimited ? Infinity : event.max_attendees - event.attendees.length;
                          const cFillRate    = cIsUnlimited ? 0 : event.attendees.length / event.max_attendees;
                          const cIsAlmostFull = !cIsUnlimited && cFillRate >= 0.7;
                          const cIsVeryScarce = !cIsUnlimited && !cIsAlmostFull && cSpotsLeft <= 5;
                          const cIsFree = !(event as any).price;

                          const cUrgencyBadge = cIsToday
                            ? { label: '⚡ היום!', bg: '#F97316' }
                            : cIsTomorrow
                              ? { label: '📅 מחר', bg: '#8B5CF6' }
                              : cIsVeryScarce
                                ? { label: `🔥 רק ${cSpotsLeft}!`, bg: '#ef4444' }
                                : cIsAlmostFull
                                  ? { label: '🔥 כמעט מלא', bg: '#ef4444' }
                                  : null;

                          return (
                            <div
                              key={event.id}
                              style={{
                                position: 'absolute',
                                left: '50%',
                                top: '50%',
                                width: 280,
                                height: 200,
                                transform: `translate(calc(-50% + ${offset * 296}px), -50%) scale(${offset === 0 ? 1 : 0.88})`,
                                transition: 'transform 0.48s cubic-bezier(0.25,0.46,0.45,0.94)',
                                transformOrigin: 'center center',
                                zIndex: offset === 0 ? 2 : 1,
                                opacity: Math.abs(offset) <= 2 ? 1 - Math.abs(offset) * 0.15 : 0,
                                cursor: 'pointer',
                              }}
                              onClick={() => offset === 0 ? setSelectedEvent(event) : setHotIdx(i)}
                            >
                              <div className="relative w-full h-full rounded-2xl overflow-hidden" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.15), 0 2px 6px rgba(0,0,0,0.07)' }}>
                                {bg ? (
                                  <img src={bg} alt={event.title} className="absolute inset-0 w-full h-full object-cover" />
                                ) : (
                                  <div className="absolute inset-0 bg-gradient-to-br from-brand-500 via-brand-600 to-violet-700" />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

                                {/* Top row: social proof (left) + urgency badge (right) */}
                                <div className="absolute top-3 inset-x-3 flex items-center justify-between">
                                  {/* Social proof */}
                                  <div className="flex items-center gap-1 bg-black/40 backdrop-blur-sm text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
                                    <Users className="w-3 h-3" />
                                    <span>{event.attendees.length > 2 ? `${event.attendees.length} הולכים` : event.attendees.length}</span>
                                  </div>
                                  {/* Urgency / free badge */}
                                  <div className="flex items-center gap-1">
                                    {cIsFree && (
                                      <span
                                        className="text-white font-black px-2 py-0.5 rounded-full"
                                        style={{ fontSize: '10px', background: 'linear-gradient(135deg,#10b981,#059669)', fontFamily: 'Heebo, sans-serif' }}
                                      >
                                        חינם!
                                      </span>
                                    )}
                                    {cUrgencyBadge && (
                                      <span
                                        className="text-white font-black px-2 py-0.5 rounded-full"
                                        style={{ fontSize: '10px', background: cUrgencyBadge.bg, fontFamily: 'Heebo, sans-serif' }}
                                      >
                                        {cUrgencyBadge.label}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="absolute bottom-0 left-0 right-0 p-3.5">
                                  <h3
                                    className="text-white text-[16px] font-black leading-tight mb-2 line-clamp-2"
                                    style={{ fontFamily: 'Heebo, sans-serif', textShadow: '0 1px 8px rgba(0,0,0,0.5)' }}
                                  >
                                    {event.title}
                                  </h3>
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
                          );
                        })}
                      </div>

                      {/* Dot indicators */}
                      {featuredEvents.length > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 10 }}>
                          {featuredEvents.map((_, i) => (
                            <div
                              key={i}
                              onClick={() => {
                                setHotIdx(i);
                                if (hotIntervalRef.current) clearInterval(hotIntervalRef.current);
                                hotIntervalRef.current = setInterval(
                                  () => setHotIdx(j => (j + 1) % featuredEvents.length), 3500
                                );
                              }}
                              style={{
                                width: i === hotIdx ? 18 : 6,
                                height: 6,
                                borderRadius: 3,
                                background: i === hotIdx ? '#F97316' : '#D1D5DB',
                                transition: 'width 0.3s cubic-bezier(0.34,1.56,0.64,1), background 0.3s ease',
                                cursor: 'pointer',
                                flexShrink: 0,
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ══ CATEGORY FILTER (after carousel) ══ */}
              {feedMode === 'events' && (
                <div className="pb-2">
                  <div
                    className="flex gap-2.5 overflow-x-auto scrollbar-hide px-4 pb-2"
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

                  {selectedInterest && (
                    <div
                      key={selectedInterest}
                      className="flex gap-2 overflow-x-auto scrollbar-hide px-4 pb-1 animate-slide-down"
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
                </div>
              )}

              {/* ══ First-open / refresh skeleton rows when no events are loaded yet ══ */}
              {showFeedSkeleton && dayGroups.length === 0 && (
                <div style={{ marginBottom: 28 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px 10px' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#E5E7EB' }} />
                    <div style={{ height: 16, width: 70, borderRadius: 8, background: '#F3F4F6' }} className="animate-pulse" />
                  </div>
                  <div style={{ margin: '0 16px', background: '#FFFFFF', borderRadius: 20, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
                    {[0, 1, 2].map((i) => (
                      <div key={i}>
                        {i > 0 && <div style={{ height: 1, background: '#F5F5F7', margin: '0 14px' }} />}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 14px' }} className="animate-pulse">
                          <div style={{ width: 80, height: 80, flexShrink: 0, borderRadius: 16, background: '#F3F4F6' }} />
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ height: 15, borderRadius: 8, background: '#F3F4F6', width: '68%' }} />
                            <div style={{ height: 12, borderRadius: 6, background: '#F3F4F6', width: '42%' }} />
                            <div style={{ height: 12, borderRadius: 6, background: '#F3F4F6', width: '32%' }} />
                          </div>
                          <div style={{ width: 42, height: 28, borderRadius: 20, background: '#FFF7ED', flexShrink: 0 }} />
                        </div>
                      </div>
                    ))}
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
                          {showFeedSkeleton ? (
                            /* ── Skeleton row ── */
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 14px' }} className="animate-pulse">
                              <div style={{ width: 80, height: 80, flexShrink: 0, borderRadius: 16, background: '#F3F4F6' }} />
                              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div style={{ height: 15, borderRadius: 8, background: '#F3F4F6', width: '68%' }} />
                                <div style={{ height: 12, borderRadius: 6, background: '#F3F4F6', width: '42%' }} />
                                <div style={{ height: 12, borderRadius: 6, background: '#F3F4F6', width: '32%' }} />
                              </div>
                              <div style={{ width: 42, height: 28, borderRadius: 20, background: '#FFF7ED', flexShrink: 0 }} />
                            </div>
                          ) : (
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
                          )}
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
          onOpenMapAt={onOpenMapAt}
          onMessageUser={onMessageUser}
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

      {/* Tapping a place in the "מקומות" feed opens the same Apple-Maps card as the map pin.
          Distance uses the GPS the native bridge cached on window (null → the line is skipped). */}
      <AdminLocationBottomSheet
        isOpen={!!placeSheet}
        onClose={() => setPlaceSheet(null)}
        location={placeSheet}
        currentUserId={currentUserId ?? undefined}
        userLocation={homeUserLocation}
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
