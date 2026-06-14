import { useState, useEffect, useRef } from 'react';
import { Loader as Loader2, CircleAlert as AlertCircle, Search, List, X, SlidersHorizontal } from 'lucide-react';
import { supabase, type ChabadHouse, type AdminLocation, type Meetup } from '../lib/supabase';
import { FloatingNavBar } from './FloatingNavBar';
import { EventMapBottomSheet } from './EventMapBottomSheet';
import { ChabadHouseBottomSheet } from './ChabadHouseBottomSheet';
import { AdminLocationBottomSheet } from './AdminLocationBottomSheet';
import { MeetupBottomSheet } from './MeetupBottomSheet';
import { MeetupGroupChat } from './MeetupGroupChat';
import { EventCard } from './EventCard';
import { EventDetailsModal } from './EventDetailsModal';
import { MapCreateActionSheet } from './MapCreateActionSheet';
import { MapCreateEventFlow } from './MapCreateEventFlow';
import { CreateMeetupFlow } from './CreateMeetupFlow';
import { createEventPinSVG } from '../utils/createEventPin';
import { createLocationPinSVG } from '../utils/createLocationPin';
import { createChabadPinSVG } from '../utils/createChabadPin';
import { createMeetupPinSVG } from '../utils/createMeetupPin';
import { buildCountryFilterArray } from '../utils/countryFilters';
import { useEvents } from '../hooks/useEvents';
import { getPinScale, type PinType } from '../utils/pinScale';
import type { Event } from '../types/event';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

/* ─────────────────────────────────── types ────────────────────────────────── */
interface MapScreenProps {
  userId: string;
  selectedCountries?: string[];
  onBack?: () => void;
  onNavigateToHome?: () => void;
  onNavigateToMyEvents?: () => void;
  onNavigateToMessages?: () => void;
  onNavigateToUserProfile?: (userId: string) => void;
  onMessageUser?: (userId: string) => void;
  focusLocation?: { latitude: number; longitude: number } | null;
  onFocusHandled?: () => void;
}

interface UserLocation { latitude: number; longitude: number; }

type MapFilter = 'all' | 'events' | 'places' | 'meetups';

const FILTER_TABS: { id: MapFilter; label: string; emoji: string }[] = [
  { id: 'all',     label: 'הכל',    emoji: '🌐' },
  { id: 'events',  label: 'אירועים', emoji: '📅' },
  { id: 'places',  label: 'מקומות',  emoji: '📍' },
  { id: 'meetups', label: 'ישיבות',  emoji: '☕' },
];

/* ──────────────────────────────── component ───────────────────────────────── */
export function MapScreen({
  userId,
  selectedCountries = [],
  onBack,
  onNavigateToHome,
  onNavigateToMyEvents,
  onNavigateToMessages,
  onNavigateToUserProfile,
  onMessageUser,
  focusLocation,
  onFocusHandled,
}: MapScreenProps) {
  /* location & map */
  const [location,      setLocation]      = useState<UserLocation | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [loadingFading, setLoadingFading] = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [mapReady,      setMapReady]      = useState(false);

  /* map filter */
  const [mapFilter,       setMapFilter]       = useState<MapFilter>('all');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  /* search */
  const [searchQuery, setSearchQuery] = useState('');

  /* data */
  const [chabadHouses,    setChabadHouses]    = useState<ChabadHouse[]>([]);
  const [adminLocations,  setAdminLocations]  = useState<AdminLocation[]>([]);
  const [posts,           setPosts]           = useState<any[]>([]);
  const [meetups,         setMeetups]         = useState<Meetup[]>([]);

  /* selected items / sheets */
  const [selectedEvent,         setSelectedEvent]         = useState<Event | null>(null);
  const [detailsEvent,          setDetailsEvent]          = useState<Event | null>(null);
  const [showChabadHouse,       setShowChabadHouse]       = useState(false);
  const [selectedChabadHouse,   setSelectedChabadHouse]   = useState<ChabadHouse | null>(null);
  const [showAdminLocation,     setShowAdminLocation]     = useState(false);
  const [selectedAdminLocation, setSelectedAdminLocation] = useState<AdminLocation | null>(null);
  const [selectedMeetup,        setSelectedMeetup]        = useState<Meetup | null>(null);
  const [showMeetup,            setShowMeetup]            = useState(false);
  const [groupChatMeetup,       setGroupChatMeetup]       = useState<Meetup | null>(null);

  /* create flows */
  const [showCreateActionSheet,  setShowCreateActionSheet]  = useState(false);
  const [showCreateEventFlow,    setShowCreateEventFlow]    = useState(false);
  const [showCreateMeetupFlow,   setShowCreateMeetupFlow]   = useState(false);

  /* events list sidebar */
  const [eventsSheetExpanded, setEventsSheetExpanded] = useState(false);

  /* refs */
  const mapRef                   = useRef<HTMLDivElement>(null);
  const mapInstanceRef           = useRef<mapboxgl.Map | null>(null);
  const markersRef               = useRef<mapboxgl.Marker[]>([]);
  const chabadMarkersRef         = useRef<mapboxgl.Marker[]>([]);
  const adminLocationMarkersRef  = useRef<mapboxgl.Marker[]>([]);
  const postMarkersRef           = useRef<mapboxgl.Marker[]>([]);
  const meetupMarkersRef         = useRef<mapboxgl.Marker[]>([]);
  const eventElsRef              = useRef<HTMLDivElement[]>([]);
  const chabadElsRef             = useRef<HTMLDivElement[]>([]);
  const adminElsRef              = useRef<HTMLDivElement[]>([]);
  const meetupElsRef             = useRef<HTMLDivElement[]>([]);

  const countriesToFilter = buildCountryFilterArray(selectedCountries);

  const { events: nearbyEvents, refreshEvents, updateFilters, addEvent } = useEvents({
    countries: countriesToFilter,
    userLocation: location ? { latitude: location.latitude, longitude: location.longitude } : undefined,
  });

  /* ── data loading ── */
  const loadChabadHouses = async () => {
    const { data } = await supabase.from('chabad_houses').select('*').order('created_at', { ascending: false });
    if (data) setChabadHouses(data);
  };

  const loadAdminLocations = async () => {
    const { data, error: e } = await supabase
      .from('admin_locations')
      .select('*')
      .order('created_at', { ascending: false });
    if (e) { console.error('loadAdminLocations:', e); return; }
    if (data) setAdminLocations(data);
  };

  const loadPosts = async () => {
    const { data, error: e } = await supabase
      .from('posts')
      .select('*')
      .not('latitude', 'is', null)
      .order('created_at', { ascending: false });
    if (e) { console.error('loadPosts:', e); return; }
    if (data) setPosts(data);
  };

  const loadMeetups = async () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const { data, error: e } = await supabase
      .from('meetups')
      .select('*, users(id, display_name, avatar_url)')
      .gte('scheduled_at', threeHoursAgo)
      .order('scheduled_at', { ascending: true });
    if (e) {
      console.error('loadMeetups error:', JSON.stringify(e));
      // Fallback: try without the join in case FK relation isn't set up yet
      const { data: d2, error: e2 } = await supabase
        .from('meetups')
        .select('*')
        .gte('scheduled_at', threeHoursAgo)
        .order('scheduled_at', { ascending: true });
      if (e2) { console.error('loadMeetups fallback error:', JSON.stringify(e2)); return; }
      if (d2) setMeetups(d2 as Meetup[]);
      return;
    }
    if (data) setMeetups(data as Meetup[]);
  };

  /* ── effects ── */
  useEffect(() => {
    if (location) {
      updateFilters({
        countries: countriesToFilter,
        searchQuery: searchQuery || undefined,
        userLocation: { latitude: location.latitude, longitude: location.longitude },
      });
      loadAdminLocations();
      loadPosts();
      loadMeetups();
    }
  }, [location, selectedCountries, searchQuery]);

  /* Realtime: admin locations + recommendations */
  useEffect(() => {
    const ch = supabase
      .channel('admin-locations-sync')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_locations' }, () => loadAdminLocations())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'admin_locations' }, () => loadAdminLocations())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => loadPosts())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  /* Realtime: meetups */
  useEffect(() => {
    const ch = supabase
      .channel('meetups-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meetups' }, () => loadMeetups())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  /* Geolocation */
  useEffect(() => {
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';
    let resolved = false;

    const applyLocation = (lat: number, lng: number) => {
      if (resolved) return;
      resolved = true;
      setLocation({ latitude: lat, longitude: lng });
      loadChabadHouses();
      // Fade out loading screen, then remove it
      setLoadingFading(true);
      setTimeout(() => setLoading(false), 600);
    };

    // Fallback: listen for location injected by React Native WebView
    // (fires when navigator.geolocation prototype override fails on iOS HTTP)
    const onNativeLocation = (e: Event) => {
      const { lat, lng } = (e as CustomEvent).detail;
      applyLocation(lat, lng);
    };
    window.addEventListener('nativeLocation', onNativeLocation);

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => applyLocation(pos.coords.latitude, pos.coords.longitude),
        () => {
          // Don't show error — nativeLocation event will fire when GPS arrives
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
      );
    }

    return () => {
      window.removeEventListener('nativeLocation', onNativeLocation);
      if (mapInstanceRef.current) mapInstanceRef.current.remove();
    };
  }, []);

  /* ── Build map ── */
  useEffect(() => {
    if (!location || !mapRef.current || mapInstanceRef.current) return;

    const map = new mapboxgl.Map({
      container: mapRef.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [location.longitude, location.latitude],
      zoom: 12,
    });

    new mapboxgl.Marker({ color: '#3B82F6' })
      .setLngLat([location.longitude, location.latitude])
      .setPopup(new mapboxgl.Popup().setHTML('<p style="color:black;font-weight:bold;">אתה כאן</p>'))
      .addTo(map);

    mapInstanceRef.current = map;
    setMapReady(true);

    const updatePinScales = () => {
      const zoom = map.getZoom();
      const apply = (els: HTMLDivElement[], type: PinType) =>
        els.forEach(el => { el.style.transform = `scale(${getPinScale(type, zoom)})`; });
      apply(eventElsRef.current,  'event');
      apply(chabadElsRef.current, 'meetup');
      apply(adminElsRef.current,  'admin');
      apply(meetupElsRef.current, 'yeshiva');
    };

    map.on('zoom', updatePinScales);
    return () => { map.off('zoom', updatePinScales); };
  }, [location]);

  /* ── Visibility helpers (filter-based) ── */
  const showEvents  = mapFilter === 'all' || mapFilter === 'events';
  const showPlaces  = mapFilter === 'all' || mapFilter === 'places';
  const showMeetups = mapFilter === 'all' || mapFilter === 'meetups';

  useEffect(() => {
    markersRef.current.forEach(m => {
      const el = (m as any)._element as HTMLElement;
      if (el) el.style.display = showEvents ? '' : 'none';
    });
  }, [mapFilter, markersRef.current.length]);

  useEffect(() => {
    [...chabadMarkersRef.current, ...adminLocationMarkersRef.current, ...postMarkersRef.current].forEach(m => {
      const el = (m as any)._element as HTMLElement;
      if (el) el.style.display = showPlaces ? '' : 'none';
    });
  }, [mapFilter, chabadMarkersRef.current.length, adminLocationMarkersRef.current.length, postMarkersRef.current.length]);

  useEffect(() => {
    meetupMarkersRef.current.forEach(m => {
      const el = (m as any)._element as HTMLElement;
      if (el) el.style.display = showMeetups ? '' : 'none';
    });
  }, [mapFilter, meetupMarkersRef.current.length]);

  /* ── Event pins ── */
  useEffect(() => {
    if (!mapInstanceRef.current || !location) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    eventElsRef.current = [];

    nearbyEvents.forEach(event => {
      if (!event.latitude || !event.longitude) return;
      const svg = createEventPinSVG(event.event_type || 'parties', event.emoji ?? undefined, event.image_url);
      const scaleWrapper = document.createElement('div');
      scaleWrapper.style.cssText = `line-height:0;transform-origin:center bottom;transition:transform 0.15s ease;transform:scale(${getPinScale('event', mapInstanceRef.current!.getZoom())});${showEvents ? '' : 'display:none;'}`;
      scaleWrapper.appendChild(svg);
      const el = document.createElement('div');
      el.style.cssText = 'cursor:pointer;line-height:0;user-select:none;';
      el.appendChild(scaleWrapper);
      eventElsRef.current.push(scaleWrapper);
      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([event.longitude, event.latitude])
        .addTo(mapInstanceRef.current!);
      el.addEventListener('click', () => {
        setSelectedEvent(event);
        setSelectedMeetup(null);
        setShowMeetup(false);
        setShowChabadHouse(false);
        setShowAdminLocation(false);
      });
      markersRef.current.push(marker);
    });
  }, [nearbyEvents, location, mapReady]);

  /* ── Chabad pins ── */
  useEffect(() => {
    if (!mapInstanceRef.current || chabadHouses.length === 0) return;
    chabadMarkersRef.current.forEach(m => m.remove());
    chabadMarkersRef.current = [];
    chabadElsRef.current = [];

    chabadHouses.forEach(house => {
      const svg = createChabadPinSVG();
      const scaleWrapper = document.createElement('div');
      scaleWrapper.style.cssText = `line-height:0;transform-origin:center bottom;transition:transform 0.15s ease;transform:scale(${getPinScale('meetup', mapInstanceRef.current!.getZoom())});${showPlaces ? '' : 'display:none;'}`;
      scaleWrapper.appendChild(svg);
      const el = document.createElement('div');
      el.style.cssText = 'cursor:pointer;line-height:0;user-select:none;';
      el.appendChild(scaleWrapper);
      chabadElsRef.current.push(scaleWrapper);
      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([house.longitude, house.latitude])
        .addTo(mapInstanceRef.current!);
      el.addEventListener('click', () => {
        setShowChabadHouse(true);
        setSelectedChabadHouse(house);
        setSelectedEvent(null);
        setSelectedMeetup(null);
        setShowMeetup(false);
        setShowAdminLocation(false);
      });
      chabadMarkersRef.current.push(marker);
    });
  }, [chabadHouses]);

  /* ── Admin location pins ── */
  useEffect(() => {
    if (!mapInstanceRef.current || adminLocations.length === 0) return;
    adminLocationMarkersRef.current.forEach(m => m.remove());
    adminLocationMarkersRef.current = [];
    adminElsRef.current = [];

    adminLocations.forEach(loc => {
      const imageUrl = loc.image_url || '/cropped-ChabadThaiLogo-3.png';
      const rawColor = loc.pin_color || '#EF4444';
      const pipeIdx  = rawColor.indexOf('|');
      const pinColor = pipeIdx !== -1 ? rawColor.slice(0, pipeIdx) : rawColor;
      const pinEmoji = pipeIdx !== -1 ? rawColor.slice(pipeIdx + 1) : undefined;
      const svg = createLocationPinSVG(imageUrl, pinColor, pinEmoji);

      const scaleWrapper = document.createElement('div');
      scaleWrapper.style.cssText = `line-height:0;transform-origin:center bottom;transition:transform 0.15s ease;transform:scale(${getPinScale('admin', mapInstanceRef.current!.getZoom())});${showPlaces ? '' : 'display:none;'}`;
      scaleWrapper.appendChild(svg);
      const el = document.createElement('div');
      el.style.cssText = 'cursor:pointer;line-height:0;user-select:none;';
      el.appendChild(scaleWrapper);
      adminElsRef.current.push(scaleWrapper);
      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([loc.longitude, loc.latitude])
        .addTo(mapInstanceRef.current!);
      el.addEventListener('click', () => {
        setShowAdminLocation(true);
        setSelectedAdminLocation(loc);
        setSelectedEvent(null);
        setSelectedMeetup(null);
        setShowMeetup(false);
        setShowChabadHouse(false);
      });
      adminLocationMarkersRef.current.push(marker);
    });
  }, [adminLocations]);

  /* ── Recommendation (post) pins ── */
  useEffect(() => {
    if (!mapInstanceRef.current || posts.length === 0) return;
    postMarkersRef.current.forEach(m => m.remove());
    postMarkersRef.current = [];

    const esc = (s: string) => (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c));

    posts.forEach(rec => {
      if (rec.latitude == null || rec.longitude == null) return;
      const svg = createLocationPinSVG(rec.image_url || '', '#F97316', '⭐');
      const scaleWrapper = document.createElement('div');
      scaleWrapper.style.cssText = `line-height:0;transform-origin:center bottom;transition:transform 0.15s ease;transform:scale(${getPinScale('admin', mapInstanceRef.current!.getZoom())});${showPlaces ? '' : 'display:none;'}`;
      scaleWrapper.appendChild(svg);
      const el = document.createElement('div');
      el.style.cssText = 'cursor:pointer;line-height:0;user-select:none;';
      el.appendChild(scaleWrapper);
      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([rec.longitude, rec.latitude])
        .addTo(mapInstanceRef.current!);
      el.addEventListener('click', () => {
        new mapboxgl.Popup({ offset: 34, closeButton: true, maxWidth: '240px' })
          .setLngLat([rec.longitude, rec.latitude])
          .setHTML(`<div dir="rtl" style="font-family:Heebo,sans-serif;text-align:right">
            <div style="font-weight:800;font-size:14px;color:#111827">⭐ ${esc(rec.place_name || 'המלצה')}</div>
            <div style="font-size:12px;color:#6B7280;margin-top:4px;line-height:1.4">${esc(rec.content || '')}</div>
            ${rec.city ? `<div style="font-size:11px;color:#9CA3AF;margin-top:5px">📍 ${esc(rec.city)}</div>` : ''}
          </div>`)
          .addTo(mapInstanceRef.current!);
      });
      postMarkersRef.current.push(marker);
    });
  }, [posts, mapReady]);

  /* ── Fly to a focused location (e.g. "open in map" from a recommendation) ── */
  useEffect(() => {
    if (!focusLocation || !mapInstanceRef.current) return;
    setMapFilter(f => (f === 'all' || f === 'places') ? f : 'all');
    mapInstanceRef.current.flyTo({ center: [focusLocation.longitude, focusLocation.latitude], zoom: 15, essential: true });
    onFocusHandled?.();
  }, [focusLocation, mapReady]);

  /* ── Meetup pins ── */
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    meetupMarkersRef.current.forEach(m => m.remove());
    meetupMarkersRef.current = [];
    meetupElsRef.current = [];

    meetups.forEach(meetup => {
      const pin = createMeetupPinSVG(meetup.emoji, meetup.users?.avatar_url);
      const scaleWrapper = document.createElement('div');
      scaleWrapper.style.cssText = `line-height:0;transform-origin:center bottom;transition:transform 0.15s ease;transform:scale(${getPinScale('yeshiva', mapInstanceRef.current!.getZoom())});${showMeetups ? '' : 'display:none;'}`;
      scaleWrapper.appendChild(pin);
      const el = document.createElement('div');
      el.style.cssText = 'cursor:pointer;line-height:0;user-select:none;';
      el.appendChild(scaleWrapper);
      meetupElsRef.current.push(scaleWrapper);
      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([meetup.longitude, meetup.latitude])
        .addTo(mapInstanceRef.current!);
      el.addEventListener('click', () => {
        setSelectedMeetup(meetup);
        setShowMeetup(true);
        setSelectedEvent(null);
        setShowChabadHouse(false);
        setShowAdminLocation(false);
      });
      meetupMarkersRef.current.push(marker);
    });
  }, [meetups, mapReady]);

  /* ── Handlers ── */
  const handleJoinClick = async () => {
    if (!selectedEvent) return;
    await refreshEvents();
  };

  const handleCreateSuccess = async (createdItem?: Record<string, any>) => {
    if (!createdItem) return;
    const isEvent = 'event_type' in createdItem || 'event_date' in createdItem;
    if (isEvent) {
      const ev = createdItem as Event;
      addEvent(ev);
      await refreshEvents();
      // make sure the events layer is visible, then fly to the new pin so it's seen
      setMapFilter(f => (f === 'meetups' || f === 'places') ? 'all' : f);
      if (ev.latitude && ev.longitude && mapInstanceRef.current) {
        mapInstanceRef.current.flyTo({ center: [ev.longitude, ev.latitude], zoom: 14, essential: true });
      }
    }
    await loadAdminLocations();
    await loadMeetups();
  };

  const handleMeetupJoined = async (meetupId: string) => {
    await loadMeetups();
    const fresh = meetups.find(m => m.id === meetupId);
    if (fresh) setGroupChatMeetup(fresh);
  };

  const handleOpenChat = (meetupId: string) => {
    const m = meetups.find(x => x.id === meetupId);
    if (m) {
      setShowMeetup(false);
      setGroupChatMeetup(m);
    }
  };

  /* ─────────────────────────── render ────────────────────────────────── */
  return (
    <div className="h-screen w-screen relative overflow-hidden bg-[#1A1F2E]" dir="rtl">

      {/* Loading */}
      {loading && (
        <>
          <style>{`
            @keyframes radar-ping {
              0% { transform: scale(0.4); opacity: 0.9; }
              100% { transform: scale(4.5); opacity: 0; }
            }
            @keyframes pin-float {
              0%, 100% { transform: translateY(0px) rotate(-45deg); filter: drop-shadow(0 0 16px rgba(249,115,22,0.7)); }
              50% { transform: translateY(-8px) rotate(-45deg); filter: drop-shadow(0 0 28px rgba(249,115,22,0.9)); }
            }
            @keyframes dot-flash {
              0%, 80%, 100% { opacity: 0.2; transform: scale(0.7); }
              40% { opacity: 1; transform: scale(1); }
            }
            @keyframes map-loader-fade {
              from { opacity: 1; }
              to { opacity: 0; }
            }
          `}</style>
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            background: 'radial-gradient(ellipse at center, #1E2A3A 0%, #0D1117 100%)',
            backgroundImage: 'radial-gradient(ellipse at center, #1E2A3A 0%, #0D1117 100%), radial-gradient(rgba(249,115,22,0.04) 1px, transparent 1px)',
            backgroundSize: 'cover, 28px 28px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            animation: loadingFading ? 'map-loader-fade 0.6s ease-out forwards' : 'none',
          }}>
            {/* Radar rings + pin */}
            <div style={{ position: 'relative', width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 36 }}>
              {/* Pulsing radar rings */}
              {[0, 0.55, 1.1].map((delay, i) => (
                <div key={i} style={{
                  position: 'absolute',
                  width: 44, height: 44, borderRadius: '50%',
                  border: '2px solid #F97316',
                  opacity: 0,
                  animation: `radar-ping 2.2s ease-out ${delay}s infinite`,
                }} />
              ))}

              {/* Soft glow behind pin */}
              <div style={{
                position: 'absolute',
                width: 90, height: 90, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(249,115,22,0.18) 0%, transparent 70%)',
              }} />

              {/* Map pin shape */}
              <div style={{ position: 'relative', zIndex: 2 }}>
                <div style={{
                  width: 46, height: 46,
                  borderRadius: '50% 50% 50% 0',
                  background: 'linear-gradient(135deg, #FB923C 0%, #DC2626 100%)',
                  animation: 'pin-float 2s ease-in-out infinite',
                  boxShadow: '0 8px 32px rgba(249,115,22,0.4)',
                  position: 'relative',
                }}>
                  <div style={{
                    position: 'absolute', top: 12, left: 12,
                    width: 16, height: 16, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.45)',
                    transform: 'rotate(45deg)',
                  }} />
                </div>
                {/* Pin shadow on ground */}
                <div style={{
                  width: 14, height: 5, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.35)',
                  margin: '4px auto 0',
                  filter: 'blur(2px)',
                }} />
              </div>
            </div>

            {/* Text */}
            <p style={{
              color: '#F1F5F9', fontSize: 19, fontWeight: 700,
              fontFamily: 'Heebo, sans-serif',
              marginBottom: 14, letterSpacing: '0.01em',
            }}>
              מאתר את המיקום שלך
            </p>

            {/* Animated dots */}
            <div style={{ display: 'flex', gap: 7 }}>
              {[0, 0.22, 0.44].map((delay, i) => (
                <div key={i} style={{
                  width: 9, height: 9, borderRadius: '50%',
                  background: '#F97316',
                  animation: `dot-flash 1.3s ease-in-out ${delay}s infinite`,
                }} />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Error */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1A1F2E] p-6 z-10">
          <div className="w-20 h-20 bg-red-900/30 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="w-10 h-10 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">שגיאה באיתור מיקום</h2>
          <p className="text-gray-400 text-center mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-blue-500 text-white rounded-full font-semibold hover:bg-blue-600 transition-colors"
          >
            נסה שוב
          </button>
        </div>
      )}

      {/* Map canvas */}
      <div ref={mapRef} className="absolute inset-0" />

      {/* ── Top UI ── */}
      {location && !loading && !error && (
        <>
          <style>{`
            @keyframes chip-fall {
              0%   { opacity: 0; transform: translateY(-32px) scale(0.85); }
              60%  { transform: translateY(4px) scale(1.03); }
              100% { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes chip-rise {
              0%   { opacity: 1; transform: translateY(0) scale(1); }
              100% { opacity: 0; transform: translateY(-24px) scale(0.88); }
            }
            @keyframes filter-btn-spin {
              0%   { transform: rotate(0deg); }
              100% { transform: rotate(180deg); }
            }
          `}</style>
          <div className="absolute left-4 right-4 z-10" style={{ top: 'max(1rem, env(safe-area-inset-top))' }}>

            {/* Search bar + filter button */}
            <div className="flex items-center gap-2 mb-2">
              {/* Filter button */}
              <button
                onClick={() => setFilterSheetOpen(v => !v)}
                style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: mapFilter !== 'all' ? '#F97316' : '#fff',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
                  border: 'none', cursor: 'pointer', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.25s',
                }}
              >
                <SlidersHorizontal
                  size={19}
                  color={mapFilter !== 'all' ? '#fff' : '#374151'}
                  strokeWidth={2.2}
                  style={{
                    transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)',
                    transform: filterSheetOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                  }}
                />
              </button>
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="חיפוש אירועים ומקומות..."
                  className="w-full bg-white text-gray-900 rounded-full h-11 pr-11 pl-4 text-sm placeholder:text-gray-400 shadow-lg focus:ring-2 focus:ring-orange-400 focus:outline-none"
                />
              </div>
            </div>

            {/* Filter chips — fall in below search bar */}
            {filterSheetOpen && (
              <div style={{ display: 'flex', gap: 8, paddingRight: 2 }}>
                {FILTER_TABS.map((tab, i) => {
                  const active = mapFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setMapFilter(tab.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '7px 13px',
                        borderRadius: 50,
                        border: active ? '2px solid #F97316' : '2px solid transparent',
                        background: active ? '#F97316' : 'rgba(255,255,255,0.95)',
                        boxShadow: '0 2px 10px rgba(0,0,0,0.14)',
                        cursor: 'pointer',
                        animation: `chip-fall 0.38s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.07}s both`,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span style={{ fontSize: 15 }}>{tab.emoji}</span>
                      <span style={{
                        fontSize: 13, fontWeight: 700,
                        color: active ? '#fff' : '#1F2937',
                        fontFamily: 'Heebo, sans-serif',
                      }}>
                        {tab.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Events sidebar toggle */}
          {(mapFilter === 'all' || mapFilter === 'events') && (
            <button
              onClick={() => setEventsSheetExpanded(!eventsSheetExpanded)}
              className={`absolute top-1/2 -translate-y-1/2 z-20 bg-[#1A1F2E] shadow-xl transition-all duration-300 ${
                eventsSheetExpanded ? 'right-80' : 'right-0'
              } rounded-l-xl py-4 px-2 flex flex-col items-center gap-1`}
            >
              <List className="w-5 h-5 text-white" />
              <span className="text-white text-xs font-bold">{nearbyEvents.length}</span>
            </button>
          )}

          {/* Events sidebar panel */}
          <div
            className={`absolute top-0 bottom-0 right-0 w-80 bg-[#1A1F2E] shadow-2xl transition-all duration-300 ease-out z-20 ${
              eventsSheetExpanded ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            <div className="p-4 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white">
                  <List className="w-5 h-5" />
                  <span className="font-semibold">אירועים קרובים ({nearbyEvents.length})</span>
                </div>
                <button onClick={() => setEventsSheetExpanded(false)} className="p-1.5 hover:bg-gray-700 rounded-full transition-colors">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <span className="text-xs text-gray-400">ברדיוס 20 ק״מ</span>
            </div>
            <div className="px-4 py-3 overflow-y-auto h-[calc(100%-80px)]">
              {nearbyEvents.length === 0 ? (
                <div className="text-center py-12 bg-[#252B3D] rounded-2xl">
                  <p className="text-gray-400">לא נמצאו אירועים קרובים</p>
                </div>
              ) : (
                <div className="space-y-4 pb-24">
                  {nearbyEvents.map(event => (
                    <div
                      key={event.id}
                      onClick={() => setDetailsEvent(event)}
                      className={`cursor-pointer ${selectedEvent?.id === event.id ? 'ring-2 ring-blue-500 rounded-[20px]' : ''}`}
                    >
                      <EventCard
                        event={event}
                        currentUserId={userId}
                        onAttendClick={() => {}}
                        onUserClick={onNavigateToUserProfile}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Floating nav bar ── */}
      <FloatingNavBar
        activeTab="map"
        currentUserId={userId}
        onHomeClick={onNavigateToHome || onBack}
        onMapClick={() => {}}
        onCreateClick={() => setShowCreateActionSheet(true)}
        onChatClick={onNavigateToMessages}
        onMyEventsClick={onNavigateToMyEvents}
      />

      {/* ── Bottom sheets & modals ── */}
      <EventMapBottomSheet
        event={selectedEvent}
        userId={userId}
        onClose={() => setSelectedEvent(null)}
        onJoinClick={handleJoinClick}
        onNavigateToUserProfile={onNavigateToUserProfile}
      />

      <ChabadHouseBottomSheet
        isOpen={showChabadHouse}
        onClose={() => { setShowChabadHouse(false); setSelectedChabadHouse(null); }}
        chabadHouse={selectedChabadHouse}
      />

      <AdminLocationBottomSheet
        isOpen={showAdminLocation}
        onClose={() => { setShowAdminLocation(false); setSelectedAdminLocation(null); }}
        location={selectedAdminLocation}
        currentUserId={userId}
      />

      <MeetupBottomSheet
        meetup={selectedMeetup}
        isOpen={showMeetup}
        currentUserId={userId}
        onClose={() => { setShowMeetup(false); setSelectedMeetup(null); }}
        onJoined={handleMeetupJoined}
        onOpenChat={handleOpenChat}
        onRefresh={loadMeetups}
      />

      {detailsEvent && (
        <EventDetailsModal
          event={detailsEvent}
          onClose={() => setDetailsEvent(null)}
          currentUserId={userId}
          onNavigateToUserProfile={onNavigateToUserProfile}
          onMessageUser={onMessageUser}
          onOpenMapAt={(lat, lng) => { mapInstanceRef.current?.flyTo({ center: [lng, lat], zoom: 15, essential: true }); }}
        />
      )}

      {/* Create action sheet */}
      <MapCreateActionSheet
        isOpen={showCreateActionSheet}
        onClose={() => setShowCreateActionSheet(false)}
        onSelectEvent={() => { setShowCreateActionSheet(false); setShowCreateEventFlow(true); }}
        onSelectMeetup={() => { setShowCreateActionSheet(false); setShowCreateMeetupFlow(true); }}
      />

      <MapCreateEventFlow
        isOpen={showCreateEventFlow}
        onClose={() => setShowCreateEventFlow(false)}
        onSuccess={handleCreateSuccess}
        userId={userId}
        initialLocation={location || undefined}
      />

      <CreateMeetupFlow
        isOpen={showCreateMeetupFlow}
        onClose={() => setShowCreateMeetupFlow(false)}
        onSuccess={() => { loadMeetups(); setMapFilter('meetups'); }}
        userId={userId}
        initialLocation={location || undefined}
      />

      {/* Group chat overlay */}
      {groupChatMeetup && (
        <MeetupGroupChat
          meetup={groupChatMeetup}
          currentUserId={userId}
          onClose={() => setGroupChatMeetup(null)}
        />
      )}

    </div>
  );
}
