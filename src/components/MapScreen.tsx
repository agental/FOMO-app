import { useState, useEffect, useRef } from 'react';
import { Loader as Loader2, CircleAlert as AlertCircle, ArrowRight, Search, List, X } from 'lucide-react';
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
  onNavigateToSettings?: () => void;
  onNavigateToMessages?: () => void;
  onNavigateToUserProfile?: (userId: string) => void;
  onMessageUser?: (userId: string) => void;
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
  onNavigateToSettings,
  onNavigateToMessages,
  onNavigateToUserProfile,
}: MapScreenProps) {
  /* location & map */
  const [location,  setLocation]  = useState<UserLocation | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [mapReady,  setMapReady]  = useState(false);

  /* map filter (segmented control) */
  const [mapFilter, setMapFilter] = useState<MapFilter>('all');

  /* search */
  const [searchQuery, setSearchQuery] = useState('');

  /* data */
  const [chabadHouses,    setChabadHouses]    = useState<ChabadHouse[]>([]);
  const [adminLocations,  setAdminLocations]  = useState<AdminLocation[]>([]);
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
    let q = supabase.from('admin_locations').select('*');
    if (countriesToFilter.length > 0) q = q.in('country', countriesToFilter);
    const { data, error: e } = await q.order('created_at', { ascending: false });
    if (e) { console.error('loadAdminLocations:', e); return; }
    if (data) setAdminLocations(data);
  };

  const loadMeetups = async () => {
    const now = new Date().toISOString();
    const { data, error: e } = await supabase
      .from('meetups')
      .select('*, users(id, display_name, avatar_url)')
      .gte('scheduled_at', now)
      .order('scheduled_at', { ascending: true });
    if (e) {
      console.error('loadMeetups error:', JSON.stringify(e));
      // Fallback: try without the join in case FK relation isn't set up yet
      const { data: d2, error: e2 } = await supabase
        .from('meetups')
        .select('*')
        .gte('scheduled_at', now)
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
      loadMeetups();
    }
  }, [location, selectedCountries, searchQuery]);

  /* Realtime: admin locations */
  useEffect(() => {
    const ch = supabase
      .channel('admin-locations-sync')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_locations' }, () => loadAdminLocations())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'admin_locations' }, () => loadAdminLocations())
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

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
          setLoading(false);
          loadChabadHouses();
        },
        (err) => {
          const msgs: Record<number, string> = {
            1: 'אין הרשאה לגישה למיקום. אנא אפשר גישה במדפדפן',
            2: 'מידע על המיקום אינו זמין',
            3: 'תם הזמן לקבלת המיקום',
          };
          setError(msgs[err.code] || 'לא ניתן להשיג מיקום');
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    } else {
      setError('הדפדפן שלך לא תומך באיתור מיקום');
      setLoading(false);
    }

    return () => { if (mapInstanceRef.current) mapInstanceRef.current.remove(); };
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

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
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
    [...chabadMarkersRef.current, ...adminLocationMarkersRef.current].forEach(m => {
      const el = (m as any)._element as HTMLElement;
      if (el) el.style.display = showPlaces ? '' : 'none';
    });
  }, [mapFilter, chabadMarkersRef.current.length, adminLocationMarkersRef.current.length]);

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
      const svg = createEventPinSVG(event.event_type || 'parties', event.emoji ?? undefined);
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

  /* ── Meetup pins ── */
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    meetupMarkersRef.current.forEach(m => m.remove());
    meetupMarkersRef.current = [];
    meetupElsRef.current = [];

    meetups.forEach(meetup => {
      const pin = createMeetupPinSVG(meetup.emoji, meetup.attendees.length);
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
    if (!createdItem || !location) return;
    const isEvent = 'event_type' in createdItem || 'event_date' in createdItem;
    if (isEvent) {
      addEvent(createdItem as Event);
      await refreshEvents();
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
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1A1F2E] z-10">
          <Loader2 className="w-12 h-12 text-blue-400 animate-spin mb-4" />
          <p className="text-gray-300 font-medium">מאתר את המיקום שלך...</p>
        </div>
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
          <div className="absolute left-4 right-4 z-10" style={{ top: 'max(1rem, env(safe-area-inset-top))' }}>

            {/* Search bar */}
            <div className="flex items-center gap-2 mb-3">
              {onBack && (
                <button
                  onClick={onBack}
                  className="p-2.5 bg-white rounded-full shadow-lg hover:bg-gray-50 transition-colors"
                >
                  <ArrowRight className="w-5 h-5 text-gray-700" />
                </button>
              )}
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="חיפוש אירועים ומקומות..."
                  className="w-full bg-white text-gray-900 rounded-full h-11 pr-11 pl-4 text-sm placeholder:text-gray-400 shadow-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* ── Premium segmented filter ── */}
            <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-lg p-1.5 flex gap-1">
              {FILTER_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setMapFilter(tab.id)}
                  className={`flex-1 flex flex-col items-center py-2 px-1 rounded-xl text-center transition-all duration-200 ${
                    mapFilter === tab.id
                      ? 'bg-white shadow-md'
                      : 'hover:bg-white/60'
                  }`}
                >
                  <span className="text-lg leading-none mb-0.5">{tab.emoji}</span>
                  <span className={`text-[11px] font-semibold leading-none ${
                    mapFilter === tab.id ? 'text-gray-900' : 'text-gray-500'
                  }`}>
                    {tab.label}
                  </span>
                  {mapFilter === tab.id && (
                    <div className="w-4 h-0.5 bg-orange-500 rounded-full mt-1" />
                  )}
                </button>
              ))}
            </div>
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
        onSettingsClick={onNavigateToSettings}
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
