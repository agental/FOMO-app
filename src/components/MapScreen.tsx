import { useState, useEffect, useRef, useMemo, type CSSProperties } from 'react';
import { Loader as Loader2, CircleAlert as AlertCircle, Search, List, X, Users } from 'lucide-react';
import { getCategoryColor, getCategoryEmoji } from '../utils/eventCategories';
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
import { createCirclePin } from '../utils/createCirclePin';
import { createChabadPinSVG } from '../utils/createChabadPin';
import { createPlacePinSVG } from '../utils/createLocationPin';
import { postPinStyle } from '../utils/postCategory';
import { createRecommendationBubble } from '../utils/createRecommendationBubble';
import { RecommendationModal } from './RecommendationModal';
import { getMeetupPinColor } from '../utils/meetupPinColor';
import { buildAreasFC, polygonCentroid, type AreaShape } from '../utils/areaHighlights';
import { loadMapAreas, insertMapArea, deleteMapArea, type MapArea } from '../services/mapAreaService';
import { buildCountryFilterArray } from '../utils/countryFilters';
import { useEvents } from '../hooks/useEvents';
import { getPinScale, labelVisibleAtZoom } from '../utils/pinScale';
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

/* ── unified point model for the pin manager (clustering removed — every pin shows on its own) ── */
type LeafType = 'event' | 'chabad' | 'admin' | 'post' | 'meetup';
interface MapPoint { id: string; type: LeafType; lng: number; lat: number; title: string; data: any; }
interface MarkerEntry { marker: mapboxgl.Marker; el: HTMLElement; kind: 'leaf' | 'cluster'; }

const FILTER_TABS: { id: MapFilter; label: string; emoji: string }[] = [
  { id: 'all',     label: 'הכל',    emoji: '🌐' },
  { id: 'events',  label: 'אירועים', emoji: '📅' },
  { id: 'places',  label: 'מקומות',  emoji: '📍' },
  { id: 'meetups', label: 'ישיבות',  emoji: '☕' },
];

/* palette an admin can pick from when marking an area (first = default) */
const AREA_COLORS = ['#F97316', '#EF4444', '#EC4899', '#8B5CF6', '#2563EB', '#06B6D4', '#16A34A', '#F59E0B'];

/* below this zoom an isolated leaf pin collapses to a small colour dot; above it the full pin
   shows and grows toward zoom-in (Apple-style). */
const PIN_DOT_ZOOM = 12;
const PIN_DOT_D = 13; // dot diameter in px

// A recommendation bubble carries text, so it would swamp the map at normal zooms. It stays folded
// into the author's avatar until you're really close in.
// A recommendation looks exactly like a place (dot → teardrop) and only differs when you're really
// close in, where it unfolds into the author's chat bubble.
const POST_BUBBLE_ZOOM = 15.6;
const CHABAD_PURPLE = '#972689'; // matches the Chabad pin's outer frame
// place teardrop is 36×41; scale it up to the Chabad pin's height (54) so they match in size
const PLACE_PIN_SCALE = 54 / 41;

/* ── module-level cache (survives navigation) ── */
let _mapChabadHouses:   ChabadHouse[]   | null = null;
let _mapAdminLocations: AdminLocation[] | null = null;
let _mapPosts:          any[]           | null = null;
let _mapMeetups:        Meetup[]        | null = null;
let _mapLocation:       { latitude: number; longitude: number } | null = null;

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
  const [location,      setLocation]      = useState<UserLocation | null>(_mapLocation);
  const [loading,       setLoading]       = useState(!_mapLocation);
  const [loadingFading, setLoadingFading] = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [mapReady,      setMapReady]      = useState(false);

  /* map filter */
  const [mapFilter, setMapFilter] = useState<MapFilter>('all');

  /* admin-drawn central areas (polygons in `map_areas`, shown to everyone, updated live) */
  const [isAdmin, setIsAdmin] = useState(false);
  const [mapAreas, setMapAreas] = useState<MapArea[]>([]);
  const areaLabelsRef = useRef<mapboxgl.Marker[]>([]);
  const updateAreaLabelsRef = useRef<() => void>(() => {});
  const isAdminRef = useRef(false);
  useEffect(() => { isAdminRef.current = isAdmin; }, [isAdmin]);

  /* admin draw-area tool state */
  const [drawing, setDrawing]         = useState(false); // actively tapping polygon vertices
  const [draftPoints, setDraftPoints] = useState<[number, number][]>([]);
  const [naming, setNaming]           = useState(false); // shape done → typing the name
  const [areaName, setAreaName]       = useState('');
  const [areaColor, setAreaColor]     = useState(AREA_COLORS[0]); // admin-picked colour for the area
  const [savingArea, setSavingArea]   = useState(false);
  const [pendingDeleteArea, setPendingDeleteArea] = useState<{ id: string; name: string } | null>(null);
  const drawingRef   = useRef(false);
  const addVertexRef = useRef<(lngLat: mapboxgl.LngLat) => void>(() => {});
  useEffect(() => { drawingRef.current = drawing; }, [drawing]);

  /* search */
  const [searchQuery, setSearchQuery] = useState('');

  /* data */
  const [chabadHouses,    setChabadHouses]    = useState<ChabadHouse[]>(_mapChabadHouses ?? []);
  const [adminLocations,  setAdminLocations]  = useState<AdminLocation[]>(_mapAdminLocations ?? []);
  const [posts,           setPosts]           = useState<any[]>(_mapPosts ?? []);
  const [meetups,         setMeetups]         = useState<Meetup[]>(_mapMeetups ?? []);

  /* preview card (mini card above pin) */
  const [previewEvent, setPreviewEvent] = useState<Event | null>(null);
  const [previewPos,   setPreviewPos]   = useState<{ x: number; y: number } | null>(null);
  const previewEventRef = useRef<Event | null>(null);
  useEffect(() => { previewEventRef.current = previewEvent; }, [previewEvent]);

  /* selected items / sheets */
  const [selectedEvent,         setSelectedEvent]         = useState<Event | null>(null);
  const [detailsEvent,          setDetailsEvent]          = useState<Event | null>(null);
  const [sheetEvent,            setSheetEvent]            = useState<Event | null>(null); // event pin → Chabad-style half-sheet
  const [showChabadHouse,       setShowChabadHouse]       = useState(false);
  const [selectedChabadHouse,   setSelectedChabadHouse]   = useState<ChabadHouse | null>(null);
  const [showAdminLocation,     setShowAdminLocation]     = useState(false);
  const [selectedAdminLocation, setSelectedAdminLocation] = useState<AdminLocation | null>(null);
  const [selectedRec,           setSelectedRec]           = useState<any | null>(null); // recommendation bubble → modal
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
  const mapRef         = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);

  /* pin manager (no clustering — each point renders as its own marker) */
  const pointByIdRef    = useRef<Map<string, MapPoint>>(new Map());
  const markerMapRef    = useRef<Map<string, MarkerEntry>>(new Map());
  const selectedIdRef   = useRef<string | null>(null);
  const orbitingRef     = useRef(false);
  const focusingRef     = useRef(false);               // camera is flying to a tapped pin
  const orbitGenRef     = useRef(0);                   // bumped on every stop — stale loops see it and die
  const renderRef       = useRef<() => void>(() => {});
  const zoomRef         = useRef<() => void>(() => {});
  const clearRef        = useRef<() => void>(() => {});

  const countriesToFilter = buildCountryFilterArray(selectedCountries);

  const { events: nearbyEvents, refreshEvents, updateFilters, addEvent } = useEvents({
    countries: countriesToFilter,
    userLocation: location ? { latitude: location.latitude, longitude: location.longitude } : undefined,
  });

  /* ── data loading ── */
  const loadChabadHouses = async () => {
    const { data } = await supabase.from('chabad_houses').select('*').order('created_at', { ascending: false });
    if (data) { _mapChabadHouses = data; setChabadHouses(data); }
  };

  const loadAdminLocations = async () => {
    const { data, error: e } = await supabase
      .from('admin_locations')
      .select('*')
      .order('created_at', { ascending: false });
    if (e) { console.error('loadAdminLocations:', e); return; }
    if (data) { _mapAdminLocations = data; setAdminLocations(data); }
  };

  const loadPosts = async () => {
    const { data, error: e } = await supabase
      .from('posts')
      .select('*, users(display_name, avatar_url)') // the author powers the map bubble's photo
      .not('latitude', 'is', null)
      .order('created_at', { ascending: false });
    if (e) { console.error('loadPosts:', e); return; }
    if (data) { _mapPosts = data; setPosts(data); }
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
      if (d2) { _mapMeetups = d2 as Meetup[]; setMeetups(d2 as Meetup[]); }
      return;
    }
    if (data) { _mapMeetups = data as Meetup[]; setMeetups(data as Meetup[]); }
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

  /* Am I an admin? (gates the draw-area tool + delete) */
  useEffect(() => {
    let alive = true;
    supabase.from('users').select('role').eq('id', userId).single()
      .then(({ data }) => { if (alive) setIsAdmin(data?.role === 'admin'); });
    return () => { alive = false; };
  }, [userId]);

  /* Admin-drawn areas: initial load + realtime so everyone sees changes live */
  const refreshAreas = async () => { setMapAreas(await loadMapAreas()); };
  useEffect(() => {
    refreshAreas();
    const ch = supabase
      .channel('map-areas-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'map_areas' }, () => refreshAreas())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  /* Geolocation */
  useEffect(() => {
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';
    // If we already have a cached location, skip geolocation entirely
    if (_mapLocation) return;
    let resolved = false;

    const applyLocation = (lat: number, lng: number) => {
      if (resolved) return;
      resolved = true;
      const wasAlreadyCached = !!_mapLocation;
      const loc = { latitude: lat, longitude: lng };
      _mapLocation = loc;
      setLocation(loc);
      loadChabadHouses();
      if (wasAlreadyCached) {
        // Had cached location — no loading screen, hide instantly
        setLoading(false);
      } else {
        // First visit — fade out loading screen
        setLoadingFading(true);
        setTimeout(() => setLoading(false), 600);
      }
    };

    // If location was already injected by React Native (e.g. user navigated back),
    // use the cached value immediately instead of waiting for the event again.
    const cached = (window as any)._nativeLocation;
    if (cached?.lat != null && !isNaN(cached.lat)) {
      applyLocation(cached.lat, cached.lng);
      return;
    }

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

    // Fallback: if no location after 8 s, open map centred on Israel
    const fallbackTimer = setTimeout(() => applyLocation(31.5, 34.75), 8000);

    return () => {
      window.removeEventListener('nativeLocation', onNativeLocation);
      clearTimeout(fallbackTimer);
    };
  }, []);

  /* ── Build map ── */
  useEffect(() => {
    if (!location || !mapRef.current || mapInstanceRef.current) return;

    const supported = mapboxgl.supported();
    if (!supported) {
      console.error('MAPBOX_UNSUPPORTED: WebGL not available in this browser/WebView');
      return;
    }

    let map: mapboxgl.Map;
    try {
      map = new mapboxgl.Map({
        container: mapRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [location.longitude, location.latitude],
        zoom: 12,
        failIfMajorPerformanceCaveat: false,
      });
    } catch (err: any) {
      console.error('MAPBOX_INIT_ERROR: ' + (err?.message || String(err)));
      return;
    }

    map.on('error', (e: any) => {
      const msg = e?.error?.message || e?.message || JSON.stringify(e);
      console.error('MAPBOX_TILE_ERROR: ' + msg);
    });

    new mapboxgl.Marker({ color: '#3B82F6' })
      .setLngLat([location.longitude, location.latitude])
      .setPopup(new mapboxgl.Popup().setHTML('<p style="color:black;font-weight:bold;">אתה כאן</p>'))
      .addTo(map);

    mapInstanceRef.current = map;
    setMapReady(true);

    /* update preview card position when map moves/zooms */
    const updatePreviewPos = () => {
      const ev = previewEventRef.current;
      if (!ev?.latitude || !ev?.longitude || !mapRef.current) return;
      const rect = mapRef.current.getBoundingClientRect();
      const pt   = map.project([ev.longitude, ev.latitude]);
      setPreviewPos({ x: rect.left + pt.x, y: rect.top + pt.y });
    };
    map.on('move', updatePreviewPos);

    return () => {
      map.off('move', updatePreviewPos);
      markerMapRef.current.forEach(e => e.marker.remove());
      markerMapRef.current.clear();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [location]);

  /* ── Visibility helpers (filter-based) ── */
  const showEvents  = mapFilter === 'all' || mapFilter === 'events';
  const showPlaces  = mapFilter === 'all' || mapFilter === 'places';
  const showMeetups = mapFilter === 'all' || mapFilter === 'meetups';

  /* ── Unified point set (respects the active filter) ── */
  const mapPoints = useMemo<MapPoint[]>(() => {
    const pts: MapPoint[] = [];
    if (showEvents) {
      nearbyEvents.forEach(e => {
        if (e.latitude == null || e.longitude == null) return;
        pts.push({ id: `event:${e.id}`, type: 'event', lng: e.longitude, lat: e.latitude, title: e.title || 'אירוע', data: e });
      });
    }
    if (showPlaces) {
      chabadHouses.forEach(h => {
        if (h.latitude == null || h.longitude == null) return;
        pts.push({ id: `chabad:${h.id}`, type: 'chabad', lng: h.longitude, lat: h.latitude, title: h.name || 'בית חב״ד', data: h });
      });
      adminLocations.forEach(l => {
        if (l.latitude == null || l.longitude == null) return;
        pts.push({ id: `admin:${l.id}`, type: 'admin', lng: l.longitude, lat: l.latitude, title: l.name || 'מקום', data: l });
      });
      posts.forEach(r => {
        if (r.latitude == null || r.longitude == null) return;
        pts.push({ id: `post:${r.id}`, type: 'post', lng: r.longitude, lat: r.latitude, title: r.place_name || 'המלצה', data: r });
      });
    }
    if (showMeetups) {
      meetups.forEach(m => {
        if (m.latitude == null || m.longitude == null) return;
        pts.push({ id: `meetup:${m.id}`, type: 'meetup', lng: m.longitude, lat: m.latitude, title: m.text || 'מפגש', data: m });
      });
    }
    return pts;
  }, [nearbyEvents, chabadHouses, adminLocations, posts, meetups, showEvents, showPlaces, showMeetups]);

  /* ── Pin builders / interaction (used by the cluster manager) ── */
  const isTodayDate = (dateStr?: string | null) => {
    if (!dateStr) return false;
    const d = new Date(dateStr), n = new Date();
    return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  };

  /* Append a colour dot to a pin root — shown (instead of the pin) when zoomed out. `atBottom`
     places it on the anchor point for bottom-anchored pins (Chabad); others anchor 'center'. */
  function appendPinDot(root: HTMLElement, color: string, atBottom: boolean) {
    const dot = document.createElement('div');
    dot.className = 'fomo-pin-dot';
    dot.style.cssText = [
      'position:absolute', 'left:50%', atBottom ? 'top:100%' : 'top:50%',
      'transform:translate(-50%,-50%)', 'transform-origin:center',
      `width:${PIN_DOT_D}px`, `height:${PIN_DOT_D}px`, 'border-radius:50%',
      `background:${color}`, 'box-shadow:0 0 0 2px #fff, 0 1px 4px rgba(0,0,0,0.4)',
      'display:none', 'pointer-events:none', 'transition:width 0.12s linear,height 0.12s linear',
    ].join(';');
    root.appendChild(dot);
  }

  /* Wrap a teardrop SVG pin (Chabad / place) in the manager's .fomo-pin > .fomo-pin-scale so it
     zoom-scales, gets the colour dot, and anchors its tip on the coordinate ('bottom'). */
  function wrapTeardrop(inner: HTMLElement | SVGElement): HTMLElement {
    const root = document.createElement('div');
    root.className = 'fomo-pin';
    root.style.cssText = 'position:absolute;cursor:pointer;user-select:none;line-height:0;';
    const scaleEl = document.createElement('div');
    scaleEl.className = 'fomo-pin-scale';
    scaleEl.style.cssText = 'transform-origin:center bottom;line-height:0;';
    // Its own layer for the tap swing, so rotating the pin never fights the zoom scale that the
    // parent owns. Origin at the tip — the pin swings from where it's stuck in the map.
    const swingEl = document.createElement('div');
    swingEl.className = 'fomo-pin-swing';
    swingEl.style.cssText = 'transform-origin:center bottom;line-height:0;';
    swingEl.appendChild(inner);
    scaleEl.appendChild(swingEl);
    root.appendChild(scaleEl);
    return root;
  }

  /* Swap between the full pin and its colour dot based on the current zoom (a selected pin
     always shows the full pin so its morph + sheet work). */
  function setLeafDotMode(el: HTMLElement, selected: boolean) {
    const z = mapInstanceRef.current?.getZoom() ?? 20;
    // each pin can demand its own zoom before it expands — recommendation bubbles carry text,
    // so they only unfold when you're really close (see POST_BUBBLE_ZOOM).
    const threshold = Number(el.dataset.dotZoom) || PIN_DOT_ZOOM;
    const asDot = z < threshold && !selected;
    const scaleEl = el.querySelector('.fomo-pin-scale') as HTMLElement | null;
    const dotEl   = el.querySelector('.fomo-pin-dot') as HTMLElement | null;
    if (scaleEl) scaleEl.style.display = asDot ? 'none' : '';

    // Recommendations carry a second threshold: below it they wear the same teardrop as the
    // places; at/above it the pin unfolds into the chat bubble.
    const bubbleZoom = Number(el.dataset.bubbleZoom);
    if (bubbleZoom) {
      const bubble = el.querySelector('.fomo-rec-bubble') as HTMLElement | null;
      const pin    = el.querySelector('.fomo-rec-pin') as HTMLElement | null;
      const unfold = z >= bubbleZoom;
      if (bubble) bubble.style.display = unfold ? 'flex' : 'none';
      if (pin)    pin.style.display    = unfold ? 'none' : 'block';
    }

    if (dotEl) dotEl.style.display = asDot ? 'block' : 'none';
  }

  function buildLeafPin(pt: MapPoint): HTMLElement {
    let el: HTMLElement;
    let dotColor = '#F97316';
    let dotAtBottom = false;

    if (pt.type === 'event') {
      const e = pt.data as Event;
      el = createEventPinSVG(e.event_type || 'parties', e.emoji ?? undefined, e.image_url, isTodayDate(e.event_date), e.title || 'אירוע');
      dotColor = getCategoryColor(e.event_type || '');
    } else if (pt.type === 'chabad') {
      // The original Chabad pin (teardrop + menorah SVG). It was hand-wrapping .fomo-pin /
      // .fomo-pin-scale itself, which meant it missed the swing layer — wrapTeardrop is the one
      // place that builds a teardrop, so it gets the tap swing like every other one.
      el = wrapTeardrop(createChabadPinSVG());
      dotColor = CHABAD_PURPLE;
      dotAtBottom = true;
    } else if (pt.type === 'admin') {
      // restored previous place pin — the Figma teardrop marker (photo + colour badge)
      const l = pt.data as AdminLocation;
      const raw = l.pin_color || '#EF4444';
      const pipe = raw.indexOf('|');
      const pinColor = pipe !== -1 ? raw.slice(0, pipe) : raw;
      const pinEmoji = (pipe !== -1 ? raw.slice(pipe + 1) : (l.emoji || undefined)) || '📍';
      const adminPin = createPlacePinSVG(pinEmoji, pinColor);
      adminPin.style.transformOrigin = 'bottom center';
      adminPin.style.transform = `scale(${PLACE_PIN_SCALE})`;
      el = wrapTeardrop(adminPin);
      dotColor = pinColor;
      dotAtBottom = true;
    } else if (pt.type === 'post') {
      /* A recommendation reads exactly like a place until you're right on top of it:
           far      → the same colour dot the places use
           mid      → the same teardrop pin, wearing its category emoji
           close in → unfolds into the chat bubble: the author's photo and what they said   */
      const r = pt.data as any;
      const { emoji: recEmoji, color: recColor } = postPinStyle(r); // author's choice, else category

      const teardrop = createPlacePinSVG(recEmoji, recColor);
      teardrop.classList.add('fomo-rec-pin');
      teardrop.style.transformOrigin = 'bottom center';
      teardrop.style.transform = `scale(${PLACE_PIN_SCALE})`;

      const bubble = createRecommendationBubble({
        author:    r.users?.display_name || 'מטייל',
        avatarUrl: r.users?.avatar_url,
        placeName: r.place_name || 'המלצה',
        content:   r.content,
        emoji:     recEmoji,
        color:     recColor,
      });
      bubble.classList.add('fomo-rec-bubble');
      bubble.style.display = 'none'; // the teardrop leads; setLeafDotMode swaps them by zoom

      const stack = document.createElement('div');
      stack.style.cssText = 'display:flex;flex-direction:column;align-items:center;line-height:0;';
      stack.appendChild(bubble);
      stack.appendChild(teardrop);

      el = wrapTeardrop(stack);
      el.dataset.bubbleZoom = String(POST_BUBBLE_ZOOM); // only unfold the text this close in
      dotColor = recColor; // same dot as the places — recommendations read identically when far
      dotAtBottom = true;
    } else {
      /* meetup */
      const m = pt.data as Meetup;
      dotColor = getMeetupPinColor(m.emoji);
      el = createCirclePin({ size: 42, color: dotColor, label: m.text || 'מפגש', variant: 'color', emoji: m.emoji });
    }

    appendPinDot(el, dotColor, dotAtBottom);
    return el;
  }

  /* Drive the circle→pin morph directly in JS (inline transforms) so it never depends on
     CSS custom properties / calc() / the <style> block — which some WebViews mis-handle. */
  // Apple-style single continuous morph: the balloon (persistent) grows ~8% + lifts while the
  // exact tail + dot stretch out to the coordinate; a one-shot ~4° wobble plays via CSS.
  // GROW = subtle overshoot spring (select); SHRINK = smooth decel, no overshoot (deselect →
  // the collapsing tail never flips to a negative scale).
  const GROW_EASE    = 'cubic-bezier(0.34, 1.42, 0.5, 1)';
  const SHRINK_EASE  = 'cubic-bezier(0.4, 0, 0.2, 1)';
  const SELECT_SCALE = 1.08; // the "slight grow" (5–10%)
  function setPinSelected(el: HTMLElement, selected: boolean) {
    const body = el.querySelector('.fomo-pin-body') as HTMLElement | null;
    const tail = el.querySelector('.fomo-pin-tail') as HTMLElement | null;
    const ddy  = Number(el.dataset.ddy) || 40;
    if (selected) {
      el.classList.add('selected', 'show-label');
      el.style.zIndex = '6';
      // if we were showing the dot (zoomed out), reveal the full pin so the morph is visible
      const scaleEl = el.querySelector('.fomo-pin-scale') as HTMLElement | null;
      const dotEl   = el.querySelector('.fomo-pin-dot') as HTMLElement | null;
      if (scaleEl) scaleEl.style.display = '';
      if (dotEl)   dotEl.style.display = 'none';

      // Knock the pin: it rocks on its tip and settles. Re-armed on every tap — a CSS class alone
      // wouldn't replay the animation when you tap the same pin twice.
      const swing = el.querySelector('.fomo-pin-swing') as HTMLElement | null;
      if (swing) {
        swing.style.animation = 'none';
        void swing.offsetHeight; // reflow, so the browser sees the animation as brand new
        swing.style.animation = 'fomo-pin-swing 0.78s cubic-bezier(0.28,0.9,0.4,1)';
      }
      const lift = ddy * SELECT_SCALE; // keeps the dot exactly on the coordinate after growing
      if (body) { body.style.transitionTimingFunction = GROW_EASE; body.style.transform = `translateY(-${lift}px) scale(${SELECT_SCALE})`; }
      if (tail) { tail.style.transitionTimingFunction = GROW_EASE; tail.style.opacity = '1'; tail.style.transform = 'translateX(-50%) scaleY(1)'; }
    } else {
      el.classList.remove('selected');
      el.style.zIndex = '';
      if (body) { body.style.transitionTimingFunction = SHRINK_EASE; body.style.transform = 'scale(1)'; }
      if (tail) { tail.style.transitionTimingFunction = SHRINK_EASE; tail.style.opacity = '0'; tail.style.transform = 'translateX(-50%) scaleY(0)'; }
      setLeafDotMode(el, false); // restore pin/dot for the current zoom
    }
  }

  function applyLeafScale(el: HTMLElement, scale: number, showLabels: boolean, selected: boolean) {
    const scaleEl = el.querySelector('.fomo-pin-scale') as HTMLElement | null;
    if (scaleEl) scaleEl.style.transform = `scale(${scale})`;
    el.classList.toggle('show-label', showLabels || selected);
    setPinSelected(el, selected);
  }

  function selectLeaf(id: string, el: HTMLElement) {
    const prevId = selectedIdRef.current;
    if (prevId && prevId !== id) {
      const prev = markerMapRef.current.get(prevId);
      if (prev) {
        setPinSelected(prev.el, false);
        if (!labelVisibleAtZoom(mapInstanceRef.current?.getZoom() ?? 0)) prev.el.classList.remove('show-label');
      }
    }
    selectedIdRef.current = id;
    setPinSelected(el, true);
  }

  /* ── Focus a tapped pin ──────────────────────────────────────────────────────────────────
     Lift it into the strip of map still visible ABOVE the sheet (Mapbox `padding` shifts the
     optical centre, so the pin lands mid-screen rather than behind the sheet), tilt the camera,
     then let the world drift slowly around it. */
  const ORBIT_DEG_PER_SEC = 3.2;
  const MAP_TOP_CHROME = 172; // search bar + filter chips, in CSS px

  // Mapbox clamps a single easeTo to the short way round, so a turn has to be walked in steps.
  const ORBIT_STEP_DEG = 150;

  function stopOrbit() {
    orbitGenRef.current++; // invalidates any in-flight step AND any pending `once('moveend')`
    const wasOrbiting = orbitingRef.current;
    orbitingRef.current = false;
    focusingRef.current = false;
    if (wasOrbiting) mapInstanceRef.current?.stop(); // halt the easeTo that's driving the turn
  }

  /* Rotate with ONE long, linear easeTo per step — never `setBearing` in a rAF loop.
     setBearing is jumpTo under the hood: it fires movestart/move/moveend on every call, so a
     per-frame loop fires 60 moveends a second and, worse, drives the camera OUTSIDE Mapbox's own
     render loop. DOM markers live in a different compositor layer from the canvas, and on the iOS
     WebView they end up a frame out of step with it — which is the pin visibly shaking. Desktop
     compositing kept up and hid it. Handing the camera back to Mapbox keeps them locked together. */
  function orbitStep(gen: number) {
    const m = mapInstanceRef.current;
    if (!m || orbitGenRef.current !== gen) return;
    m.easeTo({
      bearing: m.getBearing() + ORBIT_STEP_DEG,
      duration: (ORBIT_STEP_DEG / ORBIT_DEG_PER_SEC) * 1000,
      easing: (t) => t, // linear, so the steps join into one constant drift
      essential: true,
    });
    m.once('moveend', () => {
      if (orbitGenRef.current === gen && orbitingRef.current) orbitStep(gen);
    });
  }

  function focusPin(lng: number, lat: number) {
    const map = mapInstanceRef.current;
    if (!map) return;

    stopOrbit();
    const gen = orbitGenRef.current; // tap another pin and this generation goes stale, killing this loop

    // Centre the pin in what's actually LEFT of the map: the sheet eats the bottom, and the search
    // bar + filter chips eat the top. Padding both sides is what puts the pin in the clear.
    const sheetPx = Math.round(window.innerHeight * 0.55); // the half-open sheet
    focusingRef.current = true; // hold the marker set still until we land
    map.easeTo({
      center: [lng, lat],
      zoom: Math.max(map.getZoom(), 16.2),
      pitch: 50,
      padding: { top: MAP_TOP_CHROME, bottom: sheetPx, left: 0, right: 0 },
      duration: 900,
      essential: true,
    });

    map.once('moveend', () => {
      if (orbitGenRef.current !== gen) return; // superseded by another tap / a user gesture
      focusingRef.current = false;
      const m = mapInstanceRef.current;
      if (!m || selectedIdRef.current == null) return; // deselected mid-flight
      renderRef.current(); // one clean pass now that we've landed

      orbitingRef.current = true;
      orbitStep(gen);
    });
  }

  /** Back to a plain, north-up, flat map. */
  function resetView() {
    stopOrbit();
    const map = mapInstanceRef.current;
    if (!map) return;
    map.easeTo({
      pitch: 0, bearing: 0,
      padding: { top: 0, bottom: 0, left: 0, right: 0 },
      duration: 600, essential: true,
    });
  }

  function clearSelection() {
    const id = selectedIdRef.current;
    if (id) {
      const entry = markerMapRef.current.get(id);
      if (entry) {
        setPinSelected(entry.el, false);
        if (!labelVisibleAtZoom(mapInstanceRef.current?.getZoom() ?? 0)) entry.el.classList.remove('show-label');
      }
    }
    const had = selectedIdRef.current != null;
    selectedIdRef.current = null;
    setPreviewEvent(null);
    setPreviewPos(null);
    if (had) resetView();
  }

  function handleLeafClick(pt: MapPoint, el: HTMLElement) {
    if (drawingRef.current) return; // ignore pin taps while drawing an area
    selectLeaf(pt.id, el);
    focusPin(pt.lng, pt.lat); // centre it above the sheet, then orbit slowly
    if (pt.type === 'event') {
      // Open the events-tab event design directly in a Chabad-style half-sheet (opens half,
      // drag up to full). No mini preview card anymore — the pin morph + sheet, like place pins.
      setSheetEvent(pt.data as Event);
      setPreviewEvent(null); setPreviewPos(null);
      setSelectedMeetup(null); setShowMeetup(false); setShowChabadHouse(false); setShowAdminLocation(false);
    } else if (pt.type === 'chabad') {
      setShowChabadHouse(true); setSelectedChabadHouse(pt.data as ChabadHouse);
      setSelectedEvent(null); setPreviewEvent(null); setPreviewPos(null);
      setSelectedMeetup(null); setShowMeetup(false); setShowAdminLocation(false);
    } else if (pt.type === 'admin') {
      setShowAdminLocation(true); setSelectedAdminLocation(pt.data as AdminLocation);
      setSelectedEvent(null); setPreviewEvent(null); setPreviewPos(null);
      setSelectedMeetup(null); setShowMeetup(false); setShowChabadHouse(false);
    } else if (pt.type === 'meetup') {
      setSelectedMeetup(pt.data as Meetup); setShowMeetup(true);
      setSelectedEvent(null); setPreviewEvent(null); setPreviewPos(null);
      setShowChabadHouse(false); setShowAdminLocation(false);
    } else {
      // tapping the bubble opens the full recommendation (same sheet as the home feed)
      setSelectedRec(pt.data);
      setSelectedEvent(null); setPreviewEvent(null); setPreviewPos(null);
      setSelectedMeetup(null); setShowMeetup(false); setShowChabadHouse(false); setShowAdminLocation(false);
    }
  }

  // No clustering: render every in-view point as its own pin (which itself collapses to a colour
  // dot when zoomed out). Culled to the current viewport for performance.
  function renderClusters() {
    const map = mapInstanceRef.current;
    if (!map) return;
    const b = map.getBounds();
    if (!b) return;
    // Cull to a PADDED viewport so pins are created a bit before they scroll into view — no
    // pop-in during a pan, and they're already present as you drag toward them.
    const w = b.getWest(), s = b.getSouth(), e = b.getEast(), n = b.getNorth();
    const padX = (e - w) * 0.4, padY = (n - s) * 0.4;
    const inView = (lng: number, lat: number) => lng >= w - padX && lng <= e + padX && lat >= s - padY && lat <= n + padY;
    const z = map.getZoom();
    const scale = getPinScale('event', z);
    const showLabels = labelVisibleAtZoom(z);
    const next = new Set<string>();

    pointByIdRef.current.forEach((pt, key) => {
      if (!inView(pt.lng, pt.lat)) return; // padded viewport culling
      next.add(key);
      if (!markerMapRef.current.has(key)) {
        const el = buildLeafPin(pt);
        applyLeafScale(el, scale, showLabels, key === selectedIdRef.current);
        el.addEventListener('click', (ev) => { ev.stopPropagation(); handleLeafClick(pt, el); });
        // Teardrop pins (Chabad + places) anchor at their tip ('bottom'); circle pins (events,
        // meetups) at 'center'.
        const anchor = (pt.type === 'chabad' || pt.type === 'admin' || pt.type === 'post') ? 'bottom' : 'center';
        const marker = new mapboxgl.Marker({ element: el, anchor }).setLngLat([pt.lng, pt.lat]).addTo(map);
        markerMapRef.current.set(key, { marker, el, kind: 'leaf' });
      }
    });

    markerMapRef.current.forEach((entry, key) => {
      // Never cull the pin whose sheet is open. While the camera flies to it (pitched + padded)
      // the viewport bounds swing around, and dropping + recreating its marker made it visibly
      // jump. The sheet owns the selection's lifecycle — culling has no business ending it.
      if (key === selectedIdRef.current) return;
      if (!next.has(key)) { entry.marker.remove(); markerMapRef.current.delete(key); }
    });
  }

  function updateScalesAndLabels() {
    const map = mapInstanceRef.current;
    if (!map) return;
    const scale = getPinScale('event', map.getZoom());
    const showLabels = labelVisibleAtZoom(map.getZoom());
    markerMapRef.current.forEach((entry, key) => {
      if (entry.kind !== 'leaf') return;
      const scaleEl = entry.el.querySelector('.fomo-pin-scale') as HTMLElement | null;
      if (scaleEl) scaleEl.style.transform = `scale(${scale})`;
      entry.el.classList.toggle('show-label', showLabels || key === selectedIdRef.current);
      setLeafDotMode(entry.el, key === selectedIdRef.current); // pin ↔ colour dot by zoom
    });
  }

  /* Area name labels react to zoom: full name → shrinks → collapses to a coloured dot → hidden. */
  function updateAreaLabels() {
    const map = mapInstanceRef.current;
    if (!map) return;
    const z = map.getZoom();
    areaLabelsRef.current.forEach(mk => {
      const el  = mk.getElement();
      const txt = el.querySelector('.fomo-area-name') as HTMLElement | null;
      const dot = el.querySelector('.fomo-area-dot') as HTMLElement | null;
      if (!txt || !dot) return;
      if (z >= 11.5) {
        // full name (+ area marking), shrinking as we near the collapse point (z 11.5 → 12.5)
        const scale = Math.max(0.7, Math.min(1, 0.7 + (z - 11.5) * 0.3));
        txt.style.display = '';
        txt.style.transform = `scale(${scale})`;
        dot.style.display = 'none';
      } else if (z >= 9.5) {
        // name + area marking gone — only the coloured dot, shrinking as we zoom out (z 11.5 → 9.5)
        const d = Math.max(5, Math.min(11, 5 + (z - 9.5) * 3));
        txt.style.display = 'none';
        dot.style.display = 'block';
        dot.style.width  = `${d}px`;
        dot.style.height = `${d}px`;
      } else {
        // zoomed further out — nothing on the map
        txt.style.display = 'none';
        dot.style.display = 'none';
      }
    });
  }

  /* keep the event-handler closures fresh without re-subscribing map listeners */
  renderRef.current = renderClusters;
  zoomRef.current   = updateScalesAndLabels;
  clearRef.current  = clearSelection;
  addVertexRef.current = (lngLat) => setDraftPoints(pts => [...pts, [lngLat.lng, lngLat.lat]]);
  updateAreaLabelsRef.current = updateAreaLabels;

  /* (re)build the point lookup whenever the point set changes, then re-render markers */
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    const byId = new Map<string, MapPoint>();
    mapPoints.forEach(p => byId.set(p.id, p));
    pointByIdRef.current = byId;
    renderRef.current();
  }, [mapPoints, mapReady]);

  /* map listeners: re-cluster on move end, scale on zoom, clear on background tap */
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;
    // `setBearing` is a jumpTo under the hood: it fires movestart/move/MOVEEND synchronously on
    // every single call. So during the orbit this ran renderClusters 60x/sec — and because the
    // pitched, rotating viewport makes getBounds() swing, pins kept falling out of the cull and
    // getting destroyed and rebuilt each frame. That was the fast up/down flicker.
    const onMoveEnd = () => { if (orbitingRef.current || focusingRef.current) return; renderRef.current(); };
    // Render markers DURING the pan too (throttled to one pass per frame) so pins appear as you
    // drag toward them, instead of only popping in when the gesture ends.
    let movePending = false;
    const onMove = () => {
      // Hold still while the camera flies to a tapped pin and while it orbits: re-rendering
      // mid-flight recreated markers under a swinging, pitched viewport and made them jump.
      // `moveend` renders once we've landed.
      if (orbitingRef.current || focusingRef.current) return;
      if (movePending) return;
      movePending = true;
      requestAnimationFrame(() => { movePending = false; renderRef.current(); });
    };
    const onZoom    = () => { zoomRef.current(); updateAreaLabelsRef.current(); };
    // the moment the user grabs the map, the orbit yields to them
    const onUserGrab = () => stopOrbit();
    const onClick   = (e: mapboxgl.MapMouseEvent) => {
      if (drawingRef.current) { addVertexRef.current(e.lngLat); return; } // add a polygon vertex
      clearRef.current();
    };
    // Admin: tap an existing area to delete it (confirmed). Registered by layer id — fires only
    // when the fill is clicked, and works even though the layer is added later, after areas load.
    const onAreaClick = (e: mapboxgl.MapLayerMouseEvent) => {
      if (!isAdminRef.current || drawingRef.current) return;
      const f = e.features?.[0];
      if (!f) return;
      setPendingDeleteArea({ id: String(f.properties?.id), name: String(f.properties?.name ?? 'אזור') });
    };
    map.on('moveend', onMoveEnd);
    map.on('move', onMove);
    map.on('zoom', onZoom);
    map.on('click', onClick);
    map.on('click', 'fomo-areas-fill', onAreaClick);
    // touchstart/mousedown, not dragstart: Mapbox's own handlers call map.stop() the moment you
    // touch down, which fires a moveend — and that moveend would queue the NEXT orbit step. We
    // have to cancel the orbit before that happens, so we listen to the touch itself.
    map.on('touchstart', onUserGrab);
    map.on('mousedown', onUserGrab);
    map.on('wheel', onUserGrab);
    return () => {
      map.off('moveend', onMoveEnd); map.off('move', onMove); map.off('zoom', onZoom); map.off('click', onClick);
      map.off('click', 'fomo-areas-fill', onAreaClick);
      map.off('touchstart', onUserGrab); map.off('mousedown', onUserGrab); map.off('wheel', onUserGrab);
      stopOrbit();
    };
  }, [mapReady]);

  /* ── Fly to a focused location (e.g. "open in map" from a recommendation) ── */
  useEffect(() => {
    if (!focusLocation || !mapInstanceRef.current) return;
    setMapFilter(f => (f === 'all' || f === 'places') ? f : 'all');
    mapInstanceRef.current.flyTo({ center: [focusLocation.longitude, focusLocation.latitude], zoom: 15, essential: true });
    onFocusHandled?.();
  }, [focusLocation, mapReady]);

  /* ── Render admin-drawn central areas (polygons from the DB, shown to everyone) ── */
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    const shapes: AreaShape[] = mapAreas.map(a => ({ id: a.id, name: a.name, polygon: a.polygon, color: a.color }));
    const fc = buildAreasFC(shapes);

    const removeLabels = () => { areaLabelsRef.current.forEach(m => m.remove()); areaLabelsRef.current = []; };

    const paint = () => {
      const existing = map.getSource('fomo-areas') as mapboxgl.GeoJSONSource | undefined;
      if (existing) {
        existing.setData(fc);
      } else {
        map.addSource('fomo-areas', { type: 'geojson', data: fc });
        // Add ON TOP of all base layers (no beforeId) so the fill actually covers the roads
        // underneath — inserting below the road layers is why the road stayed visible before.
        map.addLayer({ id: 'fomo-areas-fill', type: 'fill', source: 'fomo-areas',
          paint: {
            'fill-color': ['get', 'color'],
            // visible only in the working range; fades to 0 as the area collapses to just the dot
            // (zoomed out) and again at very close (border only)
            'fill-opacity': ['interpolate', ['linear'], ['zoom'], 11.1, 0, 11.5, 0.28, 15, 0.15, 17, 0],
          } });
        map.addLayer({ id: 'fomo-areas-line', type: 'line', source: 'fomo-areas',
          layout: { 'line-join': 'round' },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 2.5,
            // border fades out with the fill so that when zoomed out only the dot remains
            'line-opacity': ['interpolate', ['linear'], ['zoom'], 11.1, 0, 11.5, 1],
          } });
      }
      // Keep the layers on top + carrying the latest paint even if they already existed (HMR /
      // re-render) — moveLayer with no beforeId re-raises them above the base map's roads.
      if (map.getLayer('fomo-areas-fill')) { map.moveLayer('fomo-areas-fill'); map.setPaintProperty('fomo-areas-fill', 'fill-opacity', ['interpolate', ['linear'], ['zoom'], 11.1, 0, 11.5, 0.28, 15, 0.15, 17, 0]); }
      if (map.getLayer('fomo-areas-line')) { map.moveLayer('fomo-areas-line'); map.setPaintProperty('fomo-areas-line', 'line-opacity', ['interpolate', ['linear'], ['zoom'], 11.1, 0, 11.5, 1]); }
      // name labels at each polygon's centroid (DOM markers → Hebrew RTL renders correctly).
      // Each holds a text node + a coloured dot; updateAreaLabels swaps between them by zoom.
      removeLabels();
      areaLabelsRef.current = shapes
        .filter(s => Array.isArray(s.polygon) && s.polygon.length >= 3)
        .map(s => {
          const color = s.color || '#F97316';
          const wrap = document.createElement('div');
          wrap.style.cssText = 'display:flex;align-items:center;justify-content:center;pointer-events:none;';
          const txt = document.createElement('div');
          txt.className = 'fomo-area-name';
          txt.style.cssText = [
            'font-family:Heebo,system-ui,sans-serif', 'font-size:12.5px', 'font-weight:800',
            'color:#B45309', 'white-space:nowrap', 'letter-spacing:0.01em',
            'transform-origin:center', 'transition:transform 0.12s linear',
            'text-shadow:0 1px 2px #fff,0 -1px 2px #fff,1px 0 2px #fff,-1px 0 2px #fff,0 0 4px #fff',
          ].join(';');
          txt.textContent = s.name;
          const dot = document.createElement('div');
          dot.className = 'fomo-area-dot';
          dot.style.cssText = `border-radius:50%;background:${color};box-shadow:0 0 0 2px #fff,0 1px 3px rgba(0,0,0,0.35);transition:width 0.12s linear,height 0.12s linear;`;
          wrap.appendChild(txt);
          wrap.appendChild(dot);
          return new mapboxgl.Marker({ element: wrap, anchor: 'center' }).setLngLat(polygonCentroid(s.polygon)).addTo(map);
        });
      updateAreaLabels(); // set the correct text/dot state for the current zoom
    };

    if (map.isStyleLoaded()) paint(); else map.once('idle', paint);
    return removeLabels; // GL layers are torn down with map.remove(); labels are DOM, remove them
  }, [mapAreas, mapReady]);

  /* ── Live preview of the polygon the admin is currently drawing ── */
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    const feats: GeoJSON.Feature[] = draftPoints.map((p, i) => ({
      type: 'Feature', properties: { idx: i }, geometry: { type: 'Point', coordinates: p },
    }));
    if (draftPoints.length >= 3) {
      feats.push({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...draftPoints, draftPoints[0]]] } });
    } else if (draftPoints.length === 2) {
      feats.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: draftPoints } });
    }
    const draftFC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: feats };

    const addDraft = () => {
      const existing = map.getSource('fomo-draft') as mapboxgl.GeoJSONSource | undefined;
      if (existing) {
        existing.setData(draftFC);
      } else {
        map.addSource('fomo-draft', { type: 'geojson', data: draftFC });
        map.addLayer({ id: 'fomo-draft-fill', type: 'fill', source: 'fomo-draft',
          filter: ['==', ['geometry-type'], 'Polygon'],
          // matches the saved area: visible in the working range, gone when collapsed to a dot / very close
          paint: { 'fill-color': areaColor, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 11.1, 0, 11.5, 0.28, 15, 0.15, 17, 0] } });
        map.addLayer({ id: 'fomo-draft-line', type: 'line', source: 'fomo-draft',
          filter: ['!=', ['geometry-type'], 'Point'],
          layout: { 'line-join': 'round' },
          paint: { 'line-color': areaColor, 'line-width': 2.5, 'line-dasharray': [2, 1] } });
        map.addLayer({ id: 'fomo-draft-pts', type: 'circle', source: 'fomo-draft',
          filter: ['==', ['geometry-type'], 'Point'],
          paint: { 'circle-radius': 5, 'circle-color': '#fff', 'circle-stroke-color': areaColor, 'circle-stroke-width': 2.5 } });
      }
      // keep the preview colour in sync with the admin's pick
      if (map.getLayer('fomo-draft-fill')) map.setPaintProperty('fomo-draft-fill', 'fill-color', areaColor);
      if (map.getLayer('fomo-draft-line')) map.setPaintProperty('fomo-draft-line', 'line-color', areaColor);
      if (map.getLayer('fomo-draft-pts')) map.setPaintProperty('fomo-draft-pts', 'circle-stroke-color', areaColor);
    };

    const removeDraft = () => {
      ['fomo-draft-pts', 'fomo-draft-line', 'fomo-draft-fill'].forEach(id => { if (map.getLayer(id)) map.removeLayer(id); });
      if (map.getSource('fomo-draft')) map.removeSource('fomo-draft');
    };

    map.getCanvas().style.cursor = drawing ? 'crosshair' : '';
    if (drawing || draftPoints.length) {
      if (map.isStyleLoaded()) addDraft(); else map.once('idle', addDraft);
    } else {
      removeDraft();
    }
  }, [drawing, draftPoints, areaColor, mapReady]);

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

  /* ── Admin: draw a central area (polygon) ── */
  const startDrawing = () => {
    clearRef.current();
    setShowCreateActionSheet(false);
    setNaming(false); setAreaName(''); setAreaColor(AREA_COLORS[0]); setDraftPoints([]); setSavingArea(false);
    setDrawing(true);
  };
  const undoVertex   = () => setDraftPoints(pts => pts.slice(0, -1));
  const finishDrawing = () => { if (draftPoints.length >= 3) { setDrawing(false); setNaming(true); } };
  const cancelDrawing = () => { setDrawing(false); setNaming(false); setDraftPoints([]); setAreaName(''); setSavingArea(false); };
  const saveArea = async () => {
    const name = areaName.trim();
    if (!name || draftPoints.length < 3) return;
    setSavingArea(true);
    const { error } = await insertMapArea({ name, polygon: draftPoints, color: areaColor, created_by: userId });
    setSavingArea(false);
    if (error) { console.error('insertMapArea:', error.message); alert('לא ניתן לשמור את האזור: ' + error.message); return; }
    cancelDrawing();
    refreshAreas();
  };
  const confirmDeleteArea = async () => {
    if (!pendingDeleteArea) return;
    const { error } = await deleteMapArea(pendingDeleteArea.id);
    setPendingDeleteArea(null);
    if (error) { console.error('deleteMapArea:', error.message); alert('לא ניתן למחוק את האזור: ' + error.message); return; }
    refreshAreas();
  };

  /* ─────────────────────────── render ────────────────────────────────── */
  return (
    <div className="h-screen w-screen relative overflow-hidden bg-[#1A1F2E]" dir="rtl">

      {/* TEMPP tiny version marker — confirms fresh code loaded; remove once confirmed */}
      <div style={{ position: 'fixed', top: 2, left: 2, zIndex: 99999, background: 'rgba(220,38,38,0.85)', color: '#fff', font: '10px monospace', padding: '1px 5px', borderRadius: 4, pointerEvents: 'none' }}>
        area-1
      </div>

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

      {/* Pin visuals. The select morph (body lift + tail grow) is driven inline in JS
          (setPinSelected) with spring easing — see createCirclePin. This block only styles
          the always-on bits (label / ping / pulse / cluster). */}
      <style>{`
        /* Keep DOM markers on their own persistent GPU layer so the WebView keeps painting them
           DURING a touch-pan. Without this, WKWebView/Android WebView drop the DOM overlay above
           the WebGL canvas mid-gesture and only repaint on release → pins vanish while dragging. */
        .mapboxgl-marker { will-change: transform; -webkit-backface-visibility: hidden; backface-visibility: hidden; }
        .fomo-pin-label { opacity: 0; transition: opacity 0.18s ease; }
        .fomo-pin.show-label .fomo-pin-label { opacity: 1; }
        .fomo-pin.selected .fomo-pin-label { opacity: 0; }
        .fomo-pin-ping { opacity: 0; }
        .fomo-pin.selected .fomo-pin-ping { animation: fomo-tap-ping 0.55s ease-out; }
        .fomo-pin-pulse { opacity: 0.35; animation: fomo-today-pulse 2s ease-in-out infinite; }
        @keyframes fomo-today-pulse { 0%,100% { transform: scale(1); opacity: 0.35; } 50% { transform: scale(1.35); opacity: 0; } }
        @keyframes fomo-tap-ping { 0% { transform: scale(1); opacity: 0.7; } 100% { transform: scale(1.9); opacity: 0; } }
        /* one-shot ~4° left-right wobble that plays as the pin morphs into the selected state */
        .fomo-pin.selected .fomo-pin-wobble { animation: fomo-wobble 1s ease-out; }

        /* Tap a teardrop and it rocks on its tip, each swing smaller than the last, like it was
           knocked. The tip never leaves the coordinate. */
        @keyframes fomo-pin-swing {
          0%   { transform: rotate(0deg); }
          14%  { transform: rotate(-14deg); }
          32%  { transform: rotate(10deg); }
          50%  { transform: rotate(-6deg); }
          66%  { transform: rotate(3.4deg); }
          80%  { transform: rotate(-1.8deg); }
          92%  { transform: rotate(0.8deg); }
          100% { transform: rotate(0deg); }
        }
        @media (prefers-reduced-motion: reduce) { .fomo-pin-swing { animation: none !important; } }
        @keyframes fomo-wobble {
          0% { transform: rotate(0deg); }
          28% { transform: rotate(-4deg); }
          55% { transform: rotate(2.4deg); }
          78% { transform: rotate(-1.1deg); }
          100% { transform: rotate(0deg); }
        }
        .fomo-cluster-inner { transition: transform 0.15s ease; }
        .fomo-cluster:active .fomo-cluster-inner { transform: scale(0.9); }
      `}</style>

      {/* Map canvas */}
      <div ref={mapRef} className="absolute inset-0" />

      {/* ── Event Preview Card ── */}
      {previewEvent && previewPos && (
        <>
          <style>{`
            @keyframes preview-pop {
              0%   { opacity: 0; transform: scale(0.75) translateY(8px); }
              70%  { transform: scale(1.04) translateY(-2px); }
              100% { opacity: 1; transform: scale(1) translateY(0); }
            }
          `}</style>
          {/* backdrop — click-outside to dismiss */}
          <div
            className="fixed inset-0"
            style={{ zIndex: 44 }}
            onClick={() => clearSelection()}
          />
          <div
            className="fixed pointer-events-none"
            style={{
              left: previewPos.x,
              top:  previewPos.y,
              transform: 'translate(-50%, calc(-100% - 70px))',
              zIndex: 45,
            }}
          >
            <div
              className="pointer-events-auto"
              style={{ animation: 'preview-pop 0.25s cubic-bezier(0.34,1.56,0.64,1) both' }}
            >
              {/* Card */}
              <div
                style={{
                  background: 'white',
                  borderRadius: 18,
                  width: 220,
                  overflow: 'hidden',
                  boxShadow: '0 12px 48px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.12)',
                }}
              >
                {/* Image / emoji hero */}
                <div style={{ height: 96, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
                  {previewEvent.image_url ? (
                    <img
                      src={previewEvent.image_url}
                      alt={previewEvent.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <div style={{
                      width: '100%', height: '100%',
                      background: `linear-gradient(135deg, ${getCategoryColor(previewEvent.event_type || '')}22, ${getCategoryColor(previewEvent.event_type || '')}55)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 38,
                    }}>
                      {getCategoryEmoji(previewEvent.event_type || '')}
                    </div>
                  )}
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 55%)' }} />
                  {/* Attendees count overlay */}
                  {previewEvent.attendees.length > 0 && (
                    <div style={{
                      position: 'absolute', bottom: 7, right: 8,
                      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
                      borderRadius: 20, padding: '3px 8px',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <Users size={11} color="white" strokeWidth={2.5} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'white', fontFamily: 'Heebo, sans-serif' }}>
                        {previewEvent.attendees.length} הולכים
                      </span>
                    </div>
                  )}
                </div>

                {/* Text content */}
                <div style={{ padding: '10px 12px 12px', direction: 'rtl' }}>
                  <p style={{
                    fontWeight: 800, fontSize: 14, color: '#111827',
                    fontFamily: 'Heebo, sans-serif', marginBottom: 3,
                    lineHeight: 1.3,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {previewEvent.title}
                  </p>
                  <p style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'Heebo, sans-serif', marginBottom: 10 }}>
                    {previewEvent.event_date
                      ? new Date(previewEvent.event_date).toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })
                      : ''}
                    {(previewEvent as any).time ? ` • ${(previewEvent as any).time}` : ''}
                  </p>
                  <button
                    onClick={() => {
                      setSelectedEvent(previewEvent);
                      setPreviewEvent(null);
                      setPreviewPos(null);
                    }}
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg,#F97316,#EA580C)',
                      color: 'white', border: 'none',
                      borderRadius: 11, padding: '8px 0',
                      fontSize: 13, fontWeight: 800,
                      cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
                      boxShadow: '0 4px 14px rgba(249,115,22,0.35)',
                      transition: 'transform 0.15s',
                    }}
                    onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.96)')}
                    onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                  >
                    פרטים על האירוע →
                  </button>
                </div>
              </div>

              {/* Arrow pointing down to pin */}
              <div style={{
                width: 0, height: 0,
                borderLeft: '9px solid transparent',
                borderRight: '9px solid transparent',
                borderTop: '9px solid white',
                margin: '0 auto',
                filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.15))',
              }} />
            </div>
          </div>
        </>
      )}

      {/* ── Top UI ── */}
      {location && !loading && !error && (
        <>
          <div className="absolute left-4 right-4 z-10" style={{ top: 'max(1rem, env(safe-area-inset-top))' }}>

            {/* Search bar */}
            <div className="relative mb-2.5">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="חיפוש אירועים ומקומות..."
                className="w-full bg-white text-gray-900 rounded-full h-11 pr-11 pl-4 text-sm placeholder:text-gray-400 focus:ring-2 focus:ring-orange-400 focus:outline-none"
                style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.18)' }}
              />
            </div>

            {/* Filter pills — always visible */}
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
              {FILTER_TABS.map(tab => {
                const active = mapFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setMapFilter(tab.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '7px 14px',
                      borderRadius: 50,
                      border: 'none',
                      background: active ? 'linear-gradient(135deg,#F97316,#EA580C)' : 'rgba(255,255,255,0.95)',
                      boxShadow: active ? '0 4px 14px rgba(249,115,22,0.4)' : '0 2px 10px rgba(0,0,0,0.14)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{tab.emoji}</span>
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

            {/* Admin only — draw a central area on the map (polygon) that everyone will see */}
            {isAdmin && !drawing && !naming && (
              <div style={{ display: 'flex', marginTop: 8 }}>
                <button
                  onClick={startDrawing}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: 50, border: 'none',
                    background: 'linear-gradient(135deg,#2563EB,#1D4ED8)',
                    boxShadow: '0 4px 14px rgba(37,99,235,0.4)',
                    cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.2s ease',
                  }}
                >
                  <span style={{ fontSize: 14 }}>✏️</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: 'Heebo, sans-serif' }}>
                    סמן אזור מרכזי
                  </span>
                </button>
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
                        onAttendClick={() => setDetailsEvent(event)}
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

      {selectedRec && (
        <RecommendationModal
          rec={selectedRec}
          currentUserId={userId}
          onClose={() => { setSelectedRec(null); clearRef.current(); }}
        />
      )}

      <AdminLocationBottomSheet
        isOpen={showAdminLocation}
        onClose={() => { setShowAdminLocation(false); setSelectedAdminLocation(null); clearRef.current(); }}
        location={selectedAdminLocation}
        currentUserId={userId}
        userLocation={location}
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

      {/* Event pin → events-tab design in a Chabad-style half-sheet (opens half, drag up to full) */}
      {sheetEvent && (
        <EventDetailsModal
          event={sheetEvent}
          variant="sheet"
          onClose={() => { setSheetEvent(null); clearRef.current(); }}
          currentUserId={userId}
          onNavigateToUserProfile={onNavigateToUserProfile}
          onMessageUser={onMessageUser}
          onOpenMapAt={(lat, lng) => { setSheetEvent(null); clearRef.current(); mapInstanceRef.current?.flyTo({ center: [lng, lat], zoom: 15, essential: true }); }}
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

      {/* ── Admin: draw-area panel (tapping vertices) ── */}
      {drawing && (
        <div style={{
          position: 'fixed', left: 12, right: 12, zIndex: 40,
          bottom: 'calc(96px + env(safe-area-inset-bottom))',
          background: 'rgba(255,255,255,0.98)', borderRadius: 18, padding: '14px 16px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.28)', fontFamily: 'Heebo, sans-serif', direction: 'rtl',
        }}>
          <p style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginBottom: 3 }}>
            ✏️ הקש על המפה כדי לסמן את פינות האזור
          </p>
          <p style={{ fontSize: 12, color: draftPoints.length < 3 ? '#DC2626' : '#059669', marginBottom: 12 }}>
            {draftPoints.length} נקודות{draftPoints.length < 3 ? ' · צריך לפחות 3' : ' · אפשר לסיים'}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={cancelDrawing} style={btnGhost}>ביטול</button>
            <button onClick={undoVertex} disabled={!draftPoints.length} style={draftPoints.length ? btnGhost : btnDisabled}>בטל נקודה</button>
            <button onClick={finishDrawing} disabled={draftPoints.length < 3} style={draftPoints.length >= 3 ? btnPrimary : btnDisabled}>סיום ←</button>
          </div>
        </div>
      )}

      {/* ── Admin: name-the-area panel ── */}
      {naming && (
        <div style={{
          position: 'fixed', left: 12, right: 12, zIndex: 40,
          bottom: 'calc(96px + env(safe-area-inset-bottom))',
          background: 'rgba(255,255,255,0.98)', borderRadius: 18, padding: '14px 16px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.28)', fontFamily: 'Heebo, sans-serif', direction: 'rtl',
        }}>
          <p style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginBottom: 10 }}>שם האזור</p>
          <input
            autoFocus
            value={areaName}
            onChange={e => setAreaName(e.target.value)}
            placeholder="למשל: סרי טאנו"
            style={{
              width: '100%', boxSizing: 'border-box', height: 44, borderRadius: 12,
              border: '1.5px solid #E5E7EB', padding: '0 14px', fontSize: 15,
              fontFamily: 'Heebo, sans-serif', color: '#111827', outline: 'none', marginBottom: 12,
            }}
          />
          {/* colour picker */}
          <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 }}>צבע האזור</p>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            {AREA_COLORS.map(c => {
              const active = areaColor === c;
              return (
                <button
                  key={c}
                  onClick={() => setAreaColor(c)}
                  aria-label={c}
                  style={{
                    width: 30, height: 30, borderRadius: '50%', background: c, cursor: 'pointer', padding: 0,
                    border: active ? '3px solid #111827' : '2px solid #fff',
                    boxShadow: active ? '0 0 0 2px #fff, 0 2px 6px rgba(0,0,0,0.25)' : '0 1px 4px rgba(0,0,0,0.2)',
                    transform: active ? 'scale(1.12)' : 'scale(1)', transition: 'transform 0.12s ease',
                  }}
                />
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={cancelDrawing} style={btnGhost}>ביטול</button>
            <button onClick={() => { setNaming(false); setDrawing(true); }} style={btnGhost}>← חזרה לציור</button>
            <button onClick={saveArea} disabled={!areaName.trim() || savingArea} style={areaName.trim() && !savingArea ? btnPrimary : btnDisabled}>
              {savingArea ? 'שומר…' : 'שמור'}
            </button>
          </div>
        </div>
      )}

      {/* ── Admin: delete-area confirm ── */}
      {pendingDeleteArea && (
        <div
          onClick={() => setPendingDeleteArea(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 18, padding: '20px 20px 16px', maxWidth: 320, width: '100%', fontFamily: 'Heebo, sans-serif', direction: 'rtl', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}
          >
            <p style={{ fontSize: 16, fontWeight: 800, color: '#111827', marginBottom: 6 }}>מחיקת אזור</p>
            <p style={{ fontSize: 13.5, color: '#6B7280', marginBottom: 16, lineHeight: 1.5 }}>
              למחוק את האזור «{pendingDeleteArea.name}»? הפעולה תוסר אצל כל המשתמשים.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setPendingDeleteArea(null)} style={btnGhost}>ביטול</button>
              <button onClick={confirmDeleteArea} style={{ ...btnPrimary, background: 'linear-gradient(135deg,#EF4444,#DC2626)', boxShadow: '0 4px 14px rgba(239,68,68,0.4)' }}>מחק</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/* shared button styles for the admin draw-area panels */
const btnBase: CSSProperties = {
  flex: 1, height: 42, borderRadius: 12, border: 'none', cursor: 'pointer',
  fontSize: 14, fontWeight: 800, fontFamily: 'Heebo, sans-serif',
};
const btnPrimary: CSSProperties = { ...btnBase, background: 'linear-gradient(135deg,#2563EB,#1D4ED8)', color: '#fff', boxShadow: '0 4px 14px rgba(37,99,235,0.4)' };
const btnGhost:   CSSProperties = { ...btnBase, background: '#F3F4F6', color: '#374151' };
const btnDisabled: CSSProperties = { ...btnBase, background: '#E5E7EB', color: '#9CA3AF', cursor: 'not-allowed' };
