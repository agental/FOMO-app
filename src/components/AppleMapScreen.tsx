import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Search, List, X, Users, MapPin, Clock, LocateFixed, Shapes, Undo2, Check } from 'lucide-react';
import { FloatingNavBar } from './FloatingNavBar';
import { AdminLocationBottomSheet } from './AdminLocationBottomSheet';
import { MeetupBottomSheet } from './MeetupBottomSheet';
import { CityGroupChat } from './CityGroupChat';
import { EventDetailsModal } from './EventDetailsModal';
import { MapCreateActionSheet } from './MapCreateActionSheet';
import { MapCreateEventFlow } from './MapCreateEventFlow';
import { CreateMeetupFlow } from './CreateMeetupFlow';
import { loadMapKit } from '../utils/mapkit';
import '../utils/nativeGeolocation';
import { calculateDistance } from '../utils/distance';
import { placePinColor } from '../utils/placePinColor';
import { getPinScale, labelVisibleAtZoom } from '../utils/pinScale';
import {
  buildLeafPin, setPinSelected, setLeafDotMode, PIN_CSS, CHABAD_PURPLE,
  type MapPoint,
} from '../utils/mapPinDom';
import { useEvents } from '../hooks/useEvents';
import { COUNTRIES } from '../utils/countries';

// Rough bounding box of Israel — used to detect a pre-trip user (at home) vs one already abroad.
const isInIsrael = (lat: number, lng: number) => lat >= 29.4 && lat <= 33.4 && lng >= 34.2 && lng <= 35.95;
import { loadMapAreas, insertMapArea, deleteMapArea, type MapArea } from '../services/mapAreaService';
import { supabase, type ChabadHouse, type AdminLocation, type Meetup } from '../lib/supabase';
import { loadValue, saveValue } from '../utils/warmCache';
import type { PlacePayload } from '../utils/placeMessage';
import type { Event } from '../types/event';

/* Apple Maps (MapKit JS) — feature-parity port of the Mapbox MapScreen: base map + live location,
   the SAME event/place/chabad/meetup pins (via shared mapPinDom), the SAME select morph (swing + grow),
   pin lifted above the sheet, cinematic orbit, tap→detail sheets, filter tabs, geo search, nearby radius. */

type MapFilter = 'all' | 'events' | 'places' | 'meetups';
const FILTER_TABS: { id: MapFilter; label: string; emoji: string }[] = [
  { id: 'all', label: 'הכל', emoji: '🌐' },
  { id: 'events', label: 'אירועים', emoji: '📅' },
  { id: 'places', label: 'מקומות', emoji: '📍' },
  { id: 'meetups', label: 'ציוצים', emoji: '☕' },
];
const NEARBY_RADIUS_KM = 20;
const PIN_SCREEN_Y_FRAC = 0.3;    // where the focused pin sits vertically (fraction from top) — above the sheet
const ORBIT_DEG_PER_FRAME = 0.06; // ~3.6°/s at 60fps — the old Mapbox cinematic orbit speed
const AREA_COLORS = ['#F97316', '#EF4444', '#EC4899', '#8B5CF6', '#2563EB', '#06B6D4', '#16A34A', '#F59E0B'];

// The .fomo-pin element inside a MapKit annotation's wrapper (selection classes/queries target it).
const pinOf = (annEl?: HTMLElement | null): HTMLElement | null =>
  (annEl?.querySelector('.fomo-pin') as HTMLElement | null) ?? annEl ?? null;

// Fixed-size wrapper per pin type. MapKit anchors a custom annotation by its element's BOTTOM-CENTRE (Apple's
// documented default: anchorOffset is "the offset of the element from the bottom centre"). So teardrops sit at
// bottom:0 → their TIP becomes the wrapper's bottom-centre → anchorOffset (0,0) drops the tip on the coordinate;
// event circles are centred → anchorOffset (0, +h/2) shifts their centre down onto the coordinate. Fixed size +
// this anchor = the pin never drifts, at any zoom (zoom only scales the inner .fomo-pin-scale about that anchor).
const PIN_BOX: Record<string, { w: number; h: number; bottom: boolean }> = {
  event:  { w: 44, h: 44, bottom: false },
  admin:  { w: 48, h: 84, bottom: true },
  chabad: { w: 48, h: 84, bottom: true },
  meetup: { w: 68, h: 108, bottom: true },
};

// Recommended places: cache the matched Apple Place per place id at MODULE level, so re-entering the map
// (component remount) doesn't re-search or re-flash — the native pin shows immediately after the first match.
const placeMatchCache = new Map<string, any>();  // id → Place | null (null = searched, no Apple match)
const placeSearchingIds = new Set<string>();      // ids with a search in flight

const chabadToPlace = (ch: ChabadHouse): AdminLocation => {
  const now = new Date().toISOString();
  return {
    id: `chabad:${ch.id}`, name: ch.name, description: ch.description, address: ch.address, city: ch.city,
    country: ch.country, latitude: ch.latitude, longitude: ch.longitude, phone: ch.phone, email: ch.email,
    website: ch.website, image_url: ch.image_url, emoji: '🕎', pin_color: `${CHABAD_PURPLE}|🕎`,
    place_name: ch.name, place_address: ch.address, place_phone: ch.phone, place_website: ch.website,
    place_photos: ch.image_url ? [ch.image_url] : [], created_at: ch.created_at || now, updated_at: ch.updated_at || now,
  } as AdminLocation;
};

const zoomFromRegion = (region: any): number => {
  try { return Math.log2(360 / region.span.longitudeDelta); } catch { return 14; }
};

// Area fill opacity vs zoom — same ramp as the old Mapbox map (AREA_FILL_OPACITY): strong when zoomed out
// (~z11.5), fades to 0 by z14 as you zoom in, so the tint never muddies the detailed close-up view.
const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t));
const areaFillOpacity = (z: number): number => {
  if (z <= 11.1) return 0;
  if (z < 11.5) return lerp(0, 0.28, (z - 11.1) / (11.5 - 11.1));
  if (z < 12.8) return lerp(0.28, 0.12, (z - 11.5) / (12.8 - 11.5));
  if (z < 14) return lerp(0.12, 0, (z - 12.8) / (14 - 12.8));
  return 0;
};
// Border opacity — same as the old map's line-opacity: fades in 11.1→11.5, then STAYS 1 (so the coloured
// outline is still visible when zoomed in, even after the fill has faded away). This is the orange frame.
const areaLineOpacity = (z: number): number => (z <= 11.1 ? 0 : z >= 11.5 ? 1 : lerp(0, 1, (z - 11.1) / (11.5 - 11.1)));

interface AppleMapScreenProps {
  userId: string;
  selectedCountries?: string[];
  onBack?: () => void;
  onNavigateToHome?: () => void;
  onNavigateToMyEvents?: () => void;
  onNavigateToMessages?: () => void;
  onNavigateToUserProfile?: (userId: string) => void;
  onMessageUser?: (userId: string) => void;
  focusLocation?: { latitude: number; longitude: number; placeId?: string; place?: PlacePayload } | null;
  onFocusHandled?: () => void;
}

export function AppleMapScreen({
  userId, selectedCountries, onNavigateToHome, onNavigateToMyEvents, onNavigateToMessages,
  onNavigateToUserProfile, onMessageUser, focusLocation, onFocusHandled,
}: AppleMapScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const mapkitRef = useRef<any>(null);
  const annotationsRef = useRef<any[]>([]);
  const selectRef = useRef<(ann: any) => void>(() => {});
  const selectedElRef = useRef<HTMLElement | null>(null);
  const zoomRef = useRef<number>(14);
  const orbitRafRef = useRef<number | null>(null);
  // Recommended places → Apple's NATIVE POI marker (PlaceAnnotation, category colour+glyph from Apple). We
  // search Apple for the matching Place by name near its coord, cache it (id → Place | null), and swap the
  // gold-star fallback for a PlaceAnnotation. `placeTick` re-runs the annotation build when a search resolves.
  const placeSearchRef = useRef<any>(null);
  const [placeTick, setPlaceTick] = useState(0);

  const [mapReady, setMapReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(
    loadValue<{ latitude: number; longitude: number } | null>('mapLocation', null),
  );
  const [mapFilter, setMapFilter] = useState<MapFilter>('all');

  // ── admin areas (polygons) ──
  const [isAdmin, setIsAdmin] = useState(false);
  const [mapAreas, setMapAreas] = useState<MapArea[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [draftPoints, setDraftPoints] = useState<[number, number][]>([]); // [lng,lat]
  const [naming, setNaming] = useState(false);
  const [areaName, setAreaName] = useState('');
  const [areaColor, setAreaColor] = useState(AREA_COLORS[0]);
  const [savingArea, setSavingArea] = useState(false);
  const drawingRef = useRef(false);
  useEffect(() => { drawingRef.current = drawing; }, [drawing]);
  // While drawing an area, make every pin + base-map POI non-interactive so each tap reliably drops a
  // vertex instead of being "swallowed" by a pin underneath (which used to open a place card). Restored
  // the moment drawing ends.
  useEffect(() => {
    const map = mapRef.current, mapkit = mapkitRef.current;
    if (!map || !mapkit) return;
    for (const ann of annotationsRef.current) { try { ann.enabled = !drawing; } catch { /* ignore */ } }
    try { map.selectableMapFeatures = drawing ? [] : [mapkit.MapFeatureType.PointOfInterest]; } catch { /* ignore */ }
  }, [drawing]);
  const areaOverlaysRef = useRef<any[]>([]);
  const areaLabelsRef = useRef<any[]>([]);
  const draftOverlaysRef = useRef<any[]>([]);

  // ── data ──
  // Only the user's chosen countries → far less data to fetch/render (faster first paint) and each user
  // sees only the pins for the countries they picked. Empty selection falls back to everything.
  const countryKey = useMemo(() => (selectedCountries ?? []).slice().sort().join(','), [selectedCountries]);
  const { events: nearbyEvents, refreshEvents } = useEvents({
    countries: selectedCountries ?? [],
    userLocation: location ? { latitude: location.latitude, longitude: location.longitude } : undefined,
  });
  const [chabadHouses, setChabadHouses] = useState<ChabadHouse[]>(() => loadValue<ChabadHouse[]>('mapChabad', []));
  const [adminLocations, setAdminLocations] = useState<AdminLocation[]>(() => loadValue<AdminLocation[]>('mapAdmin', []));
  const [meetups, setMeetups] = useState<Meetup[]>([]);
  const [destOpen, setDestOpen] = useState(false); // destinations list UNDER the map search — auto-opens when in Israel
  const [searchCountry, setSearchCountry] = useState<string | null>(null); // a country tapped in search → show its cities inline
  const plannerShownRef = useRef(false); // auto-open the destinations only once (don't re-open after dismiss)
  const [cityEmojis, setCityEmojis] = useState<Record<string, string>>({}); // "COUNTRY|city" → emoji, from group_channels

  const loadChabad = useCallback(async () => {
    const countries = countryKey ? countryKey.split(',') : null;
    let q = supabase.from('chabad_houses').select('*');
    if (countries) q = q.in('country', countries);
    const { data } = await q.order('created_at', { ascending: false });
    if (data) { setChabadHouses(data as ChabadHouse[]); saveValue('mapChabad', data); }
  }, [countryKey]);
  const loadAdmin = useCallback(async () => {
    const countries = countryKey ? countryKey.split(',') : null;
    let q = supabase.from('admin_locations').select('*');
    if (countries) q = q.in('country', countries);
    const { data } = await q.order('created_at', { ascending: false });
    if (data) { setAdminLocations(data as AdminLocation[]); saveValue('mapAdmin', data); }
  }, [countryKey]);
  const loadMeetups = useCallback(async () => {
    const countries = countryKey ? countryKey.split(',') : null;
    const threeHoursAgo = new Date(Date.now() - 3 * 3600000).toISOString();
    let base = supabase.from('meetups').select('*, users(id, display_name, avatar_url)').gte('scheduled_at', threeHoursAgo);
    if (countries) base = base.in('country', countries);
    let { data, error: e } = await base.order('scheduled_at', { ascending: true });
    if (e) {
      let fb = supabase.from('meetups').select('*').gte('scheduled_at', threeHoursAgo);
      if (countries) fb = fb.in('country', countries);
      const r = await fb.order('scheduled_at', { ascending: true }); data = r.data;
    }
    if (data) setMeetups(data as Meetup[]);
  }, [countryKey]);
  // City emoji per (country, city) — reuses each city group's own emoji (group_channels.city_emoji) so the
  // trip planner shows e.g. 🏝️ / 🏙️ instead of a generic pin.
  const loadCityEmojis = useCallback(async () => {
    const countries = countryKey ? countryKey.split(',') : null;
    let q = supabase.from('group_channels').select('city_name, city_emoji, country_code');
    if (countries) q = q.in('country_code', countries);
    const { data } = await q;
    if (!data) return;
    const map: Record<string, string> = {};
    for (const g of data as { city_name: string | null; city_emoji: string | null; country_code: string | null }[]) {
      const cc = (g.country_code || '').trim().toUpperCase();
      const city = (g.city_name || '').trim().toLowerCase();
      const emoji = (g.city_emoji || '').trim();
      if (cc && city && emoji) map[`${cc}|${city}`] = emoji;
    }
    setCityEmojis(map);
  }, [countryKey]);

  useEffect(() => {
    loadChabad(); loadAdmin(); loadMeetups(); loadCityEmojis();
    const adminCh = supabase.channel('apple-admin-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_locations' }, () => loadAdmin()).subscribe();
    const meetupCh = supabase.channel('apple-meetups-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meetups' }, () => loadMeetups()).subscribe();
    return () => { supabase.removeChannel(adminCh); supabase.removeChannel(meetupCh); };
  }, [loadChabad, loadAdmin, loadMeetups, loadCityEmojis]);

  // ── admin check + areas (load + realtime) ──
  const refreshAreas = useCallback(async () => { setMapAreas(await loadMapAreas()); }, []);
  useEffect(() => {
    let alive = true;
    supabase.from('users').select('role').eq('id', userId).single()
      .then(({ data }) => { if (alive) setIsAdmin((data as any)?.role === 'admin'); }, () => {});
    refreshAreas();
    const ch = supabase.channel('apple-map-areas-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'map_areas' }, () => refreshAreas()).subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [userId, refreshAreas]);

  const startDrawing = () => { setNaming(false); setAreaName(''); setAreaColor(AREA_COLORS[0]); setDraftPoints([]); setSavingArea(false); setDrawing(true); };
  const undoVertex = () => setDraftPoints(pts => pts.slice(0, -1));
  const finishDrawing = () => { if (draftPoints.length >= 3) { setDrawing(false); setNaming(true); } };
  const cancelDrawing = () => { setDrawing(false); setNaming(false); setDraftPoints([]); setAreaName(''); setSavingArea(false); };
  const saveArea = async () => {
    const name = areaName.trim();
    if (!name || draftPoints.length < 3) return;
    setSavingArea(true);
    const { error } = await insertMapArea({ name, polygon: draftPoints, color: areaColor, created_by: userId });
    setSavingArea(false);
    if (error) { alert('לא ניתן לשמור את האזור: ' + error.message); return; }
    cancelDrawing(); refreshAreas();
  };
  const deleteArea = async (id: string) => {
    const { error } = await deleteMapArea(id);
    if (error) { alert('לא ניתן למחוק את האזור'); return; }
    refreshAreas();
  };

  // Fade the area name+arrow out when its area gets tiny on screen (zoomed far out), back in when zoomed in —
  // the way real map labels behave. Reads refs only → stable, no stale closure.
  const syncAreaLabels = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    let latDelta = 0; try { latDelta = map.region.span.latitudeDelta; } catch { /* ignore */ }
    const vh = containerRef.current?.clientHeight || window.innerHeight || 800;
    for (const lbl of areaLabelsRef.current) {
      const latSpan = lbl?.data?.latSpan || 0;
      const areaPx = latDelta > 0 ? (latSpan / latDelta) * vh : 9999;
      const show = areaPx >= vh * 0.16;
      try {
        const el = lbl.element as HTMLElement | undefined;
        if (el) { el.style.transition = 'opacity 0.18s ease'; el.style.opacity = show ? '1' : '0'; el.style.pointerEvents = show ? '' : 'none'; }
      } catch { /* ignore */ }
    }
  }, []);

  // ── render saved area polygons + name labels (map-anchored annotations) ──
  useEffect(() => {
    const map = mapRef.current, mapkit = mapkitRef.current;
    if (!map || !mapkit || !mapReady) return;
    if (areaOverlaysRef.current.length) { try { map.removeOverlays(areaOverlaysRef.current.map((x: any) => x.ov)); } catch { /* ignore */ } }
    if (areaLabelsRef.current.length) { try { map.removeAnnotations(areaLabelsRef.current); } catch { /* ignore */ } }
    const overlays: any[] = []; const labels: any[] = [];
    const fo0 = areaFillOpacity(zoomRef.current), lo0 = areaLineOpacity(zoomRef.current);
    for (const a of mapAreas) {
      const color = a.color || '#F97316';
      const pts = a.polygon.map(([lng, lat]) => new mapkit.Coordinate(lat, lng));
      const ov = new mapkit.PolygonOverlay(pts, { style: new mapkit.Style({ strokeColor: color, strokeOpacity: lo0, lineWidth: 1.5, lineDash: [6, 4], fillColor: color, fillOpacity: fo0 }) });
      // Non-interactive: the area is purely visual, so it never swallows a tap — tapping the area opens
      // nothing, AND base-map POIs / pins INSIDE the area stay tappable (the overlay no longer intercepts).
      try { ov.enabled = false; } catch { /* ignore */ }
      overlays.push({ ov, color });
      // The name pill sits map-anchored just OUTSIDE the area (north of its top edge) and stays upright. The
      // curly arrow shares the pill's centre as its pivot and is ROTATED every frame (see the rAF effect
      // below) so its tip always points at the area's CENTRE — through pan, zoom AND rotation. clat/clng =
      // area-weighted (shoelace) centroid (stable regardless of point count/density).
      let minLng = Infinity, maxLng = -Infinity, topLat = -90, botLat = 90, A = 0, cxSum = 0, cySum = 0;
      const ring = a.polygon, rn = ring.length;
      for (let i = 0; i < rn; i++) {
        const [x0, y0] = ring[i], [x1, y1] = ring[(i + 1) % rn];
        if (x0 < minLng) minLng = x0; if (x0 > maxLng) maxLng = x0;
        if (y0 > topLat) topLat = y0; if (y0 < botLat) botLat = y0;
        const cross = x0 * y1 - x1 * y0; A += cross; cxSum += (x0 + x1) * cross; cySum += (y0 + y1) * cross;
      }
      A *= 0.5;
      const clng = Math.abs(A) > 1e-12 ? cxSum / (6 * A) : (minLng + maxLng) / 2;
      const clat = Math.abs(A) > 1e-12 ? cySum / (6 * A) : (topLat + botLat) / 2;
      const latSpan = topLat - botLat;
      const anchorLat = topLat + 0.10 * latSpan; // pill sits just north of the area's top edge (outside)
      const lbl = new mapkit.Annotation(new mapkit.Coordinate(anchorLat, clng), () => {
        const NS = 'http://www.w3.org/2000/svg';
        // Fixed box; the pill AND the arrow's rotation pivot are both at its centre (= the anchor coord). The
        // arrow is appended first so the (opaque) pill covers its tail — the arrow always emerges from the pill
        // edge toward the area, at whatever angle the per-frame rAF sets.
        const wrap = document.createElement('div');
        wrap.style.cssText = 'position:relative;width:112px;height:112px;overflow:visible;pointer-events:none;';
        const arrow = document.createElementNS(NS, 'svg');
        arrow.setAttribute('class', 'area-arrow'); arrow.setAttribute('width', '44'); arrow.setAttribute('height', '56'); arrow.setAttribute('viewBox', '0 0 44 56'); arrow.setAttribute('fill', 'none');
        arrow.style.cssText = 'position:absolute;left:56px;top:56px;transform-origin:top center;transform:translateX(-50%) rotate(0deg);filter:drop-shadow(0 1px 1.5px rgba(0,0,0,0.28));pointer-events:none;';
        const mkPath = (d: string) => { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('stroke', color); p.setAttribute('stroke-width', '3.2'); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round'); p.setAttribute('fill', 'none'); return p; };
        // Hand-drawn curly Bézier; default points straight DOWN (its tip at the bottom), the rAF rotates it.
        arrow.appendChild(mkPath('M22 5 C 7 15, 37 24, 22 33 C 11 40, 31 47, 22 55'));
        arrow.appendChild(mkPath('M22 55 L 14.5 48'));  // small clean arrowhead
        arrow.appendChild(mkPath('M22 55 L 29.5 48'));
        const pill = document.createElement('div');
        pill.textContent = a.name;
        pill.style.cssText = `position:absolute;left:56px;top:56px;transform:translate(-50%,-50%);font-family:Heebo,sans-serif;font-size:13px;font-weight:800;color:#fff;background:${color};padding:5px 13px;border-radius:999px;white-space:nowrap;box-shadow:0 2px 9px rgba(0,0,0,0.30);pointer-events:${isAdmin ? 'auto' : 'none'};cursor:${isAdmin ? 'pointer' : 'default'};`;
        if (isAdmin) pill.onclick = () => { if (confirm(`למחוק את האזור "${a.name}"?`)) deleteArea(a.id); };
        wrap.appendChild(arrow); wrap.appendChild(pill);
        return wrap;
      }, { anchorOffset: new DOMPoint(0, 56), calloutEnabled: false });
      lbl.data = { areaLabel: true, latSpan, anchorLat, anchorLng: clng, centerLat: clat, centerLng: clng };
      labels.push(lbl);
    }
    areaOverlaysRef.current = overlays; areaLabelsRef.current = labels;
    if (overlays.length) map.addOverlays(overlays.map((x: any) => x.ov));
    if (labels.length) map.addAnnotations(labels);
    requestAnimationFrame(syncAreaLabels);
  }, [mapAreas, mapReady, isAdmin]);

  // Rotate every area's arrow so its tip ALWAYS points at the area centre — through pan, zoom and
  // (continuously) rotation. Only the arrow spins; the text pill stays upright. Each frame projects the pill
  // anchor + the area centre to screen points and rotates the arrow by their atan2 angle. Runs per-frame but
  // touches the DOM only when the camera actually moved (cheap when idle).
  useEffect(() => {
    if (!mapReady) return;
    let raf = 0; let lastKey = '';
    const tick = () => {
      const map = mapRef.current, mapkit = mapkitRef.current;
      if (map && mapkit && areaLabelsRef.current.length) {
        let key = '';
        try {
          const r = map.region;
          key = `${map.rotation}|${r.center.latitude.toFixed(6)}|${r.center.longitude.toFixed(6)}|${r.span.latitudeDelta.toFixed(6)}`;
        } catch { /* ignore */ }
        if (key && key !== lastKey) {
          lastKey = key;
          for (const lbl of areaLabelsRef.current) {
            const d = (lbl as any)?.data;
            if (!d?.areaLabel) continue;
            try {
              const el = (lbl as any).element as HTMLElement | undefined;
              const arrow = el?.querySelector('.area-arrow') as HTMLElement | null;
              if (!arrow) continue;
              const Ls = map.convertCoordinateToPointOnPage(new mapkit.Coordinate(d.anchorLat, d.anchorLng)); // pill
              const Cs = map.convertCoordinateToPointOnPage(new mapkit.Coordinate(d.centerLat, d.centerLng));  // area centre
              if (!Ls || !Cs) continue;
              const deg = Math.atan2(Cs.y - Ls.y, Cs.x - Ls.x) * 180 / Math.PI; // screen direction pill → centre
              arrow.style.transform = `translateX(-50%) rotate(${(deg - 90).toFixed(1)}deg)`; // arrow's default aim = straight down (90°)
            } catch { /* ignore */ }
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mapReady]);

  // ── live preview of the polygon being drawn ──
  useEffect(() => {
    const map = mapRef.current, mapkit = mapkitRef.current;
    if (!map || !mapkit || !mapReady) return;
    if (draftOverlaysRef.current.length) { try { map.removeOverlays(draftOverlaysRef.current); } catch { /* ignore */ } }
    const ovs: any[] = [];
    if (draftPoints.length >= 2) {
      const pts = draftPoints.map(([lng, lat]) => new mapkit.Coordinate(lat, lng));
      const style = new mapkit.Style({ strokeColor: areaColor, lineWidth: 2.5, lineDash: [6, 3], fillColor: areaColor, fillOpacity: 0.16 });
      ovs.push(draftPoints.length >= 3 ? new mapkit.PolygonOverlay(pts, { style }) : new mapkit.PolylineOverlay(pts, { style }));
    }
    draftOverlaysRef.current = ovs;
    if (ovs.length) map.addOverlays(ovs);
  }, [draftPoints, areaColor, mapReady]);

  // ── sheets ──
  const [sheetEvent, setSheetEvent] = useState<Event | null>(null);
  const [detailsEvent, setDetailsEvent] = useState<Event | null>(null);
  const [selectedAdminLocation, setSelectedAdminLocation] = useState<AdminLocation | null>(null);
  const [showAdminLocation, setShowAdminLocation] = useState(false);
  const [selectedMeetup, setSelectedMeetup] = useState<Meetup | null>(null);
  const [showMeetup, setShowMeetup] = useState(false);
  const [groupChatMeetup, setGroupChatMeetup] = useState<Meetup | null>(null);
  // Current user's name+avatar for the group chat (meetup chat reuses CityGroupChat, like event chats).
  const [me, setMe] = useState<{ name: string; avatar: string | null }>({ name: 'אני', avatar: null });
  useEffect(() => {
    if (!userId) return;
    supabase.from('users').select('display_name, avatar_url').eq('id', userId).maybeSingle()
      .then(({ data }) => { if (data) setMe({ name: data.display_name || 'אני', avatar: data.avatar_url ?? null }); });
  }, [userId]);

  // ── create flow (the "+" button) ──
  const [showCreateActionSheet, setShowCreateActionSheet] = useState(false);
  const [showCreateEventFlow, setShowCreateEventFlow] = useState(false);
  const [showCreateMeetupFlow, setShowCreateMeetupFlow] = useState(false);
  const flyToLatLng = useCallback((lat: number, lng: number, span = 0.01) => {
    const map = mapRef.current, mapkit = mapkitRef.current;
    if (map && mapkit && lat != null && lng != null) {
      try { map.setRegionAnimated(new mapkit.CoordinateRegion(new mapkit.Coordinate(lat, lng), new mapkit.CoordinateSpan(span, span)), true); } catch { /* ignore */ }
    }
  }, []);

  // ── search + radius UI ──
  const [searchQuery, setSearchQuery] = useState('');
  const [geoResults, setGeoResults] = useState<any[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchSvcRef = useRef<any>(null);
  const [radiusOpen, setRadiusOpen] = useState(false);

  const showEvents = mapFilter === 'all' || mapFilter === 'events';
  const showPlaces = mapFilter === 'all' || mapFilter === 'places';
  const showMeetups = mapFilter === 'all' || mapFilter === 'meetups';

  const mapPoints = useMemo<MapPoint[]>(() => {
    const pts: MapPoint[] = [];
    if (showEvents) for (const e of nearbyEvents) {
      if (e.latitude == null || e.longitude == null || (e as any).is_external) continue;
      pts.push({ id: `event:${e.id}`, type: 'event', lat: e.latitude, lng: e.longitude, title: e.title || 'אירוע', data: e });
    }
    if (showPlaces) {
      for (const h of chabadHouses) { if (h.latitude != null && h.longitude != null) pts.push({ id: `chabad:${h.id}`, type: 'chabad', lat: h.latitude, lng: h.longitude, title: h.name, data: h }); }
      for (const l of adminLocations) { if (l.latitude != null && l.longitude != null) pts.push({ id: `admin:${l.id}`, type: 'admin', lat: l.latitude, lng: l.longitude, title: l.name, data: l }); }
    }
    if (showMeetups) for (const m of meetups) { if (m.latitude != null && m.longitude != null) pts.push({ id: `meetup:${m.id}`, type: 'meetup', lat: m.latitude, lng: m.longitude, title: m.text || 'מפגש', data: m }); }
    return pts;
  }, [nearbyEvents, chabadHouses, adminLocations, meetups, showEvents, showPlaces, showMeetups]);

  // Cities to preview per country, derived from real content (places + events) so the trip planner only
  // offers cities that actually have something to see. City coordinate = average of that city's pins.
  const citiesByCountry = useMemo(() => {
    const acc: Record<string, Record<string, { lat: number; lng: number; n: number; featured: number }>> = {};
    const add = (country?: string | null, city?: string | null, lat?: number | null, lng?: number | null, isFeatured = false) => {
      if (!country || !city || lat == null || lng == null) return;
      if (!acc[country]) acc[country] = {};
      if (!acc[country][city]) acc[country][city] = { lat: 0, lng: 0, n: 0, featured: 0 };
      const e = acc[country][city];
      e.lat += lat; e.lng += lng; e.n += 1;
      if (isFeatured) e.featured += 1;
    };
    // "מקומות מומלצים" = FEATURED admin places only (is_featured: passed the 50-likes bar, distinct pin).
    for (const a of adminLocations) add((a as any).country, (a as any).city, (a as any).latitude, (a as any).longitude, !!(a as any).is_featured);
    for (const e of nearbyEvents)   add((e as any).country, (e as any).city, (e as any).latitude, (e as any).longitude);
    const out: Record<string, { city: string; lat: number; lng: number; count: number; featured: number }[]> = {};
    for (const [country, cities] of Object.entries(acc)) {
      out[country] = Object.entries(cities)
        .map(([city, v]) => ({ city, lat: v.lat / v.n, lng: v.lng / v.n, count: v.n, featured: v.featured }))
        .sort((a, b) => (b.featured - a.featured) || (b.count - a.count));
    }
    return out;
  }, [adminLocations, nearbyEvents]);

  // The coordinate of the currently-focused pin — the orbit spins the world AROUND this point.
  const focusCoordRef = useRef<{ lat: number; lng: number } | null>(null);
  const orbitDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── open the right detail sheet + lift the pin into the strip above the sheet (like focusPin) ──
  const liftTo = useCallback((lat: number, lng: number) => {
    const map = mapRef.current, mapkit = mapkitRef.current;
    if (!map || !mapkit) return;
    focusCoordRef.current = { lat, lng };
    const latDelta = 0.006, lngDelta = 0.006;
    // Reset any leftover rotation from a previous orbit as part of flying to the new pin (north-up). This is
    // where rotation is normalised — NOT on close — so closing never shifts the map.
    try { map.setRotationAnimated(0, true); } catch { /* ignore */ }
    // Centre so the pin lands at PIN_SCREEN_Y_FRAC from the top — clear of the bottom sheet. (Same target
    // the orbit then holds, so there's no jump when the orbit takes over.)
    const centerLat = lat - (0.5 - PIN_SCREEN_Y_FRAC) * latDelta;
    map.setRegionAnimated(new mapkit.CoordinateRegion(new mapkit.Coordinate(centerLat, lng), new mapkit.CoordinateSpan(latDelta, lngDelta)), true);
  }, []);

  const openPin = useCallback((pt: MapPoint) => {
    setSheetEvent(null); setShowAdminLocation(false); setSelectedAdminLocation(null); setShowMeetup(false); setSelectedMeetup(null);
    if (pt.type === 'event') setSheetEvent(pt.data as Event);
    else if (pt.type === 'chabad') { setSelectedAdminLocation(chabadToPlace(pt.data as ChabadHouse)); setShowAdminLocation(true); }
    else if (pt.type === 'admin') { setSelectedAdminLocation(pt.data as AdminLocation); setShowAdminLocation(true); }
    else { setSelectedMeetup(pt.data as Meetup); setShowMeetup(true); }
    // Meetup (ציוץ) cards open over a STILL map — no lift/tilt. Every other pin still gets the focus move.
    if (pt.type !== 'meetup') liftTo(pt.lat, pt.lng);
  }, [liftTo]);

  const openPoiAsPlace = useCallback((name: string, lat: number, lng: number) => {
    setSheetEvent(null); setShowMeetup(false); setSelectedMeetup(null);
    const now = new Date().toISOString();
    const place = {
      id: `poi:${lat.toFixed(5)},${lng.toFixed(5)}`, name, latitude: lat, longitude: lng, country: '',
      pin_color: placePinColor('📍'), emoji: '📍', place_name: name, created_at: now, updated_at: now,
    } as AdminLocation;
    setSelectedAdminLocation(place); setShowAdminLocation(true);
    liftTo(lat, lng);
    const mapkit = mapkitRef.current;
    try {
      const geocoder = new mapkit.Geocoder({ language: 'he' });
      geocoder.reverseLookup(new mapkit.Coordinate(lat, lng), (_e: any, data: any) => {
        const addr = data?.results?.[0]?.formattedAddress;
        if (addr) setSelectedAdminLocation(prev => (prev && prev.id === place.id ? { ...prev, address: addr, place_address: addr } as AdminLocation : prev));
      });
    } catch { /* geocoder optional */ }
  }, [liftTo]);

  // ── orbit: spin the world AROUND the focused pin, keeping the pin fixed on screen (symmetric) ──
  const stopOrbit = () => {
    if (orbitDelayRef.current != null) { clearTimeout(orbitDelayRef.current); orbitDelayRef.current = null; }
    if (orbitRafRef.current != null) { cancelAnimationFrame(orbitRafRef.current); orbitRafRef.current = null; }
  };
  const startOrbit = () => {
    stopOrbit();
    // Wait for liftTo's region animation to settle, then start spinning.
    orbitDelayRef.current = setTimeout(() => {
      orbitDelayRef.current = null;
      const step = () => {
        const m = mapRef.current, mapkit = mapkitRef.current, el = containerRef.current, fc = focusCoordRef.current;
        if (!m || !mapkit || !el || !fc) { orbitRafRef.current = null; return; }
        try {
          m.rotation = (m.rotation + ORBIT_DEG_PER_FRAME) % 360;
          // Rotation is about the map centre, so setting rotation alone makes the (off-centre) pin swing away.
          // Fix: after each rotation step, nudge the centre so the pin stays glued to its screen spot →
          // the world orbits AROUND the pin. Derivation: newCentre = pointToCoord(C − (S − cur)).
          const rect = el.getBoundingClientRect();
          const sx = window.scrollX || 0, sy = window.scrollY || 0;
          const Cx = rect.left + rect.width / 2 + sx, Cy = rect.top + rect.height / 2 + sy;   // screen centre (= map.center)
          const Sx = Cx, Sy = rect.top + rect.height * PIN_SCREEN_Y_FRAC + sy;                 // where the pin should stay
          const cur = m.convertCoordinateToPointOnPage(new mapkit.Coordinate(fc.lat, fc.lng)); // where the pin is now
          if (cur) {
            const nc = m.convertPointOnPageToCoordinate(new DOMPoint(Cx - (Sx - cur.x), Cy - (Sy - cur.y)));
            if (nc) m.center = nc;
          }
        } catch { /* ignore */ }
        orbitRafRef.current = requestAnimationFrame(step);
      };
      orbitRafRef.current = requestAnimationFrame(step);
    }, 480);
  };
  const endFocus = () => {
    stopOrbit();
    const map = mapRef.current;
    try { if (map) map.selectedAnnotation = null; } catch { /* ignore */ }
    // Deliberately DON'T reset rotation here: un-rotating about the orbit's off-pin centre made every pin +
    // the admin area appear to shift on close. Rotation is reset when the next pin opens (see liftTo).
  };

  // ── selection router (our pins + Apple POIs) ──
  selectRef.current = (ann: any) => {
    if (!ann || drawingRef.current) return; // ignore pin/POI taps while drawing an area
    if (ann.data?.areaLabel) return;        // tapping an admin area opens nothing (admin delete is on the label's own click)
    const pt = ann.data as MapPoint | undefined;
    const z = zoomRef.current;
    if (pt && pt.type) {
      openPin(pt);
      const el = pinOf(ann.element as HTMLElement | undefined);
      if (el) { setPinSelected(el, true, z); selectedElRef.current = el; }
      // Meetup card stays over a still map — no orbit; just cancel any orbit still running from a prior pin.
      if (pt.type === 'meetup') stopOrbit();
      else startOrbit();
      return;
    }
    const c = ann.coordinate;
    if (c) { openPoiAsPlace(ann.title || ann.place?.name || ann.subtitle || 'מקום', c.latitude, c.longitude); startOrbit(); }
  };

  // ── init MapKit ──
  useEffect(() => {
    let cancelled = false; let watchId: number | null = null;
    (async () => {
      try {
        const mapkit = await loadMapKit();
        if (cancelled || !containerRef.current) return;
        mapkitRef.current = mapkit;
        const nl = (window as any)._nativeLocation;
        const lat = nl?.lat != null ? nl.lat : (location?.latitude ?? 31.5);
        const lng = nl?.lng != null ? nl.lng : (location?.longitude ?? 34.75);
        const map = new mapkit.Map(containerRef.current, {
          showsUserLocation: true, tracksUserLocation: false,
          showsCompass: mapkit.FeatureVisibility.Adaptive, showsScale: mapkit.FeatureVisibility.Hidden,
          isRotationEnabled: true,
        });
        map.region = new mapkit.CoordinateRegion(new mapkit.Coordinate(lat, lng), new mapkit.CoordinateSpan(0.06, 0.06));
        mapRef.current = map;
        zoomRef.current = zoomFromRegion(map.region);
        // Pre-trip: a user whose cached native location is in Israel gets the destinations list opened under the search.
        if (nl?.lat != null && isInIsrael(nl.lat, nl.lng)) { plannerShownRef.current = true; setDestOpen(true); }

        try { map.selectableMapFeatures = [mapkit.MapFeatureType.PointOfInterest]; } catch { /* older MapKit */ }
        map.addEventListener('select', (ev: any) => selectRef.current(ev?.annotation));
        map.addEventListener('deselect', (ev: any) => {
          const el = pinOf(ev?.annotation?.element as HTMLElement | undefined);
          if (el) setPinSelected(el, false, zoomRef.current); // collapse the morph AND restore dot/pin for the zoom
          if (selectedElRef.current === el) selectedElRef.current = null;
        });
        map.addEventListener('scroll-start', stopOrbit);
        map.addEventListener('zoom-start', stopOrbit);
        // While the admin is drawing an area, each tap adds a polygon vertex.
        map.addEventListener('single-tap', (ev: any) => {
          if (!drawingRef.current) return;
          try {
            const p = ev?.pointOnPage;
            if (!p) return;
            const c = mapRef.current.convertPointOnPageToCoordinate(p);
            setDraftPoints(pts => [...pts, [c.longitude, c.latitude]]);
          } catch { /* ignore */ }
        });
        // Zoom-driven pin scale + dot↔pin, exactly like the old map's updateScalesAndLabels.
        map.addEventListener('region-change-end', () => {
          const z = zoomFromRegion(mapRef.current.region); zoomRef.current = z;
          // Area fill fades with zoom (strong far, gone by z14); the coloured border stays once zoomed in —
          // exactly the old map's ramps.
          const fo = areaFillOpacity(z), lo = areaLineOpacity(z);
          for (const { ov, color } of areaOverlaysRef.current) {
            try { ov.style = new mapkit.Style({ strokeColor: color, strokeOpacity: lo, lineWidth: 1.5, lineDash: [6, 4], fillColor: color, fillOpacity: fo }); } catch { /* ignore */ }
          }
          syncAreaLabels(); // fade the area name+arrow out when its area gets tiny (zoomed out), back in when large
          // Pins: zoom-scale + name label + dot↔pin — a direct port of the old map's updateScalesAndLabels.
          const scale = getPinScale('event', z), showLabels = labelVisibleAtZoom(z);
          for (const ann of annotationsRef.current) {
            const el = pinOf(ann.element as HTMLElement | undefined);
            if (!el) continue;
            const selected = el === selectedElRef.current;
            const scaleEl = el.querySelector('.fomo-pin-scale') as HTMLElement | null;
            if (scaleEl && !selected) scaleEl.style.transform = `scale(${scale})`;
            el.classList.toggle('show-label', showLabels || selected);
            setLeafDotMode(el, selected, z); // full pin ↔ colour dot, exactly like zooming the old map
          }
        });

        setLoading(false); setMapReady(true);

        if ('geolocation' in navigator) {
          let centered = !!nl;
          watchId = navigator.geolocation.watchPosition(
            (pos) => {
              if (cancelled) return;
              const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
              setLocation(loc); saveValue('mapLocation', loc);
              if (isInIsrael(loc.latitude, loc.longitude)) {
                // Pre-trip at home → auto-open the destinations list under the search (once).
                if (!plannerShownRef.current) { plannerShownRef.current = true; setDestOpen(true); }
              } else {
                setDestOpen(false);
                if (!centered && mapRef.current) { centered = true; mapRef.current.setCenterAnimated(new mapkit.Coordinate(loc.latitude, loc.longitude), true); }
              }
            },
            () => {}, { enableHighAccuracy: true, maximumAge: 0 },
          );
        }
      } catch (e) {
        if (!cancelled) { setError(String((e as Error)?.message || e)); setLoading(false); }
      }
    })();
    return () => {
      cancelled = true;
      if (watchId != null && 'geolocation' in navigator) navigator.geolocation.clearWatch(watchId);
      stopOrbit();
      try { mapRef.current?.destroy?.(); } catch { /* ignore */ }
      mapRef.current = null;
    };
  }, []);

  // ── sync annotations on data/filter change ──
  useEffect(() => {
    const map = mapRef.current, mapkit = mapkitRef.current;
    if (!map || !mapkit || !mapReady) return;
    if (annotationsRef.current.length) { try { map.removeAnnotations(annotationsRef.current); } catch { /* ignore */ } }
    selectedElRef.current = null;
    const anns = mapPoints.map((pt) => {
      const featuredAdmin = pt.type === 'admin' && !!(pt.data as any).is_featured;
      // Featured (recommended) place = a STATUS, not a category. When Apple knows this spot as a POI we show its
      // NATIVE Apple marker (Apple's own category colour + glyph — hotel=purple bed, school=Apple school glyph…).
      if (featuredAdmin) {
        const cached = placeMatchCache.get(pt.id);
        if (cached) {
          const pann = new mapkit.PlaceAnnotation(cached, { calloutEnabled: false }); // no colour/glyph → Apple's own
          pann.data = pt;
          try { pann.addEventListener('select', () => selectRef.current(pann)); } catch { /* ignore */ }
          return pann;
        }
        // Not matched yet → HIDE this pin and kick ONE search; it pops in as the correct pin once resolved
        // (no wrong-pin flash on first open). If Apple has no POI here (cached === null) we fall through below.
        if (!placeMatchCache.has(pt.id)) {
          if (!placeSearchingIds.has(pt.id)) {
          placeSearchingIds.add(pt.id);
          const coord = new mapkit.Coordinate(pt.lat, pt.lng);
          let settled = false;
          const settle = (place: any) => {
            if (settled) return; settled = true;
            placeMatchCache.set(pt.id, place || null);
            placeSearchingIds.delete(pt.id);
            setPlaceTick(t => t + 1);
          };
          // Choose the Apple Place at this spot: a name match within 300m, else the nearest POI within 120m.
          const pickBest = (data: any) => {
            const title = String(pt.title || '').trim().toLowerCase();
            let near: any = null, nearKm = Infinity, named: any = null, namedKm = Infinity;
            for (const pl of (data?.places || [])) {
              const c = pl.coordinate; if (!c) continue;
              const km = calculateDistance(pt.lat, pt.lng, c.latitude, c.longitude);
              if (km < nearKm) { nearKm = km; near = pl; }
              const nm = String(pl.name || pl.title || '').trim().toLowerCase();
              if (title && nm && (nm.includes(title) || title.includes(nm)) && km < namedKm) { namedKm = km; named = pl; }
            }
            if (named && namedKm <= 0.3) return named;
            if (near && nearKm <= 0.12) return near;
            return null;
          };
          // Text search (works via callback OR promise) as a fallback matcher.
          const textSearch = () => {
            try {
              if (!placeSearchRef.current) placeSearchRef.current = new mapkit.Search();
              const r = placeSearchRef.current.search(pt.title, (_e: any, d: any) => settle(pickBest(d)), { coordinate: coord });
              if (r && typeof r.then === 'function') r.then((d: any) => settle(pickBest(d))).catch(() => settle(null));
            } catch { settle(null); }
          };
          // Proximity POI search FIRST — finds whatever Apple POI sits here (school, etc.) even if the name
          // doesn't match. Handle BOTH the promise and the (deprecated) callback form; if no POI match, fall
          // back to the text search before giving up.
          let poiHandled = false;
          const onPoi = (data: any) => { if (poiHandled) return; poiHandled = true; const m = pickBest(data); if (m) settle(m); else textSearch(); };
          try {
            const poi = new mapkit.PointsOfInterestSearch({ center: coord, radius: 300 });
            const ret = poi.search((_e: any, d: any) => onPoi(d));
            if (ret && typeof ret.then === 'function') ret.then(onPoi).catch(() => { if (!poiHandled) { poiHandled = true; textSearch(); } });
          } catch { textSearch(); }
          }
          return null; // hide until the search resolves → the correct pin pops in, no wrong-pin flash
        }
        // cached === null → Apple has no POI here → fall through to the place's normal teardrop
      }
      const box = PIN_BOX[pt.type] || PIN_BOX.event;
      const ann = new mapkit.Annotation(
        new mapkit.Coordinate(pt.lat, pt.lng),
        () => {
          const pin = buildLeafPin(pt);
          // Match the current zoom on creation: scale + label + dot↔pin, exactly like the old map. Zoom only
          // touches the inner .fomo-pin-scale (transform-origin = the anchor point) so the anchor never moves.
          const z = zoomRef.current;
          const scaleEl = pin.querySelector('.fomo-pin-scale') as HTMLElement | null;
          if (scaleEl) scaleEl.style.transform = `scale(${getPinScale('event', z)})`;
          pin.classList.toggle('show-label', labelVisibleAtZoom(z));
          setLeafDotMode(pin, false, z); // starts as a colour dot when zoomed out, like the old Mapbox map
          // Fixed-size wrapper = a real, zoom-stable tap target whose BOTTOM-CENTRE MapKit glues to the coord.
          // Teardrops: tip at bottom:0 → tip = bottom-centre. Events: centred → centre is h/2 above bottom-centre.
          const wrap = document.createElement('div');
          wrap.style.cssText = `position:relative;width:${box.w}px;height:${box.h}px;overflow:visible;`;
          pin.style.position = 'absolute';
          pin.style.left = '50%';
          if (box.bottom) { pin.style.bottom = '0'; pin.style.top = 'auto'; pin.style.transform = 'translateX(-50%)'; }
          else { pin.style.top = '50%'; pin.style.bottom = 'auto'; pin.style.transform = 'translate(-50%,-50%)'; }
          wrap.appendChild(pin);
          return wrap;
        },
        // (0,0): teardrop tip lands on the coordinate. (0,+h/2): shift the centred event circle down onto it.
        { anchorOffset: new DOMPoint(0, box.bottom ? 0 : box.h / 2), calloutEnabled: false },
      );
      ann.data = pt;
      return ann;
    }).filter(Boolean); // drop featured pins hidden until their Apple-place search resolves
    annotationsRef.current = anns;
    if (drawingRef.current) { for (const a of anns) { try { a.enabled = false; } catch { /* ignore */ } } } // keep taps dropping vertices during a draw
    if (anns.length) map.addAnnotations(anns);
  }, [mapPoints, mapReady, placeTick]);

  // ── fly to a handed-in location ──
  // GATED on mapReady: when the focus comes from another screen (e.g. tapping the mini-map inside an event
  // card), the map mounts FRESH with focusLocation already set but MapKit not yet initialised. Without the
  // gate the effect ran once, bailed (map null), and never re-ran — so the map opened on the default region
  // instead of the event. mapReady in the deps makes it re-fire the moment the map is live.
  useEffect(() => {
    const map = mapRef.current, mapkit = mapkitRef.current;
    if (!focusLocation || !map || !mapkit || !mapReady) return;
    // Zoom IN (same framing as tapping a pin) rather than only recentre, so we land on the location's
    // full-size, category-coloured pin — not a far-out colour dot below the pin-zoom threshold.
    liftTo(focusLocation.latitude, focusLocation.longitude);
    onFocusHandled?.();
  }, [focusLocation, mapReady, liftTo]);

  // ── search (Apple geocoder autocomplete) ──
  useEffect(() => {
    const mapkit = mapkitRef.current;
    if (!mapkit || !mapReady) return;
    const q = searchQuery.trim();
    if (q.length < 2) { setGeoResults([]); return; }
    if (!searchSvcRef.current) searchSvcRef.current = new mapkit.Search({ getsUserLocation: true });
    const t = setTimeout(() => {
      searchSvcRef.current.autocomplete(q, (err: any, data: any) => {
        if (err || !data?.results) { setGeoResults([]); return; }
        setGeoResults(data.results.slice(0, 6));
      });
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, mapReady]);

  const goToResult = (r: any) => {
    const mapkit = mapkitRef.current, map = mapRef.current;
    setGeoResults([]); setSearchQuery('');
    if (r.coordinate && map) { map.setRegionAnimated(new mapkit.CoordinateRegion(r.coordinate, new mapkit.CoordinateSpan(0.02, 0.02)), true); return; }
    searchSvcRef.current?.search(r, (_err: any, data: any) => {
      const place = data?.places?.[0];
      if (place?.coordinate && map) map.setRegionAnimated(new mapkit.CoordinateRegion(place.coordinate, new mapkit.CoordinateSpan(0.02, 0.02)), true);
    });
  };

  const recenter = () => {
    const map = mapRef.current, mapkit = mapkitRef.current;
    if (!map || !mapkit || !location) return;
    map.setRegionAnimated(new mapkit.CoordinateRegion(new mapkit.Coordinate(location.latitude, location.longitude), new mapkit.CoordinateSpan(0.04, 0.04)), true);
  };

  const radiusEvents = useMemo(() => {
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
    const weekEnd = new Date(startToday.getTime() + 7 * 86400000);
    const inWeek = (e: Event) => { const d = new Date(e.event_date || (e as any).date || 0); return d >= startToday && d <= weekEnd; };
    const pool = nearbyEvents.filter(e => inWeek(e) && !(e as any).is_external);
    if (!location) return [];
    return pool
      .map(e => ({ e, d: (e.latitude != null && e.longitude != null) ? calculateDistance(location.latitude, location.longitude, e.latitude, e.longitude) : Infinity }))
      .filter(x => x.d <= NEARBY_RADIUS_KM).sort((a, b) => a.d - b.d).map(x => x.e);
  }, [nearbyEvents, location]);

  const fmtTime = (d?: string) => d ? new Date(d).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#eef0f2', fontFamily: 'Heebo, sans-serif' }} dir="rtl">
      <style>{PIN_CSS}</style>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      {loading && !error && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F3EFE9', zIndex: 5 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', border: '3px solid #E5E7EB', borderTopColor: '#F97316', animation: 'aspin 0.8s linear infinite' }} />
          <style>{`@keyframes aspin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}
      {error && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: '#F3EFE9', zIndex: 5, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 40 }}>🗺️</div>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#1C1917' }}>לא הצלחנו לטעון את מפת אפל</p>
          <p style={{ fontSize: 12.5, color: '#78716C', maxWidth: 280, direction: 'ltr' }}>{error}</p>
          <button onClick={onNavigateToHome} style={{ marginTop: 8, background: 'linear-gradient(135deg,#F97316,#EA580C)', color: '#fff', fontWeight: 800, fontSize: 14, padding: '10px 20px', borderRadius: 12, border: 'none' }}>חזרה לבית</button>
        </div>
      )}

      {!loading && !error && (
        <div style={{ position: 'absolute', top: 'max(12px, env(safe-area-inset-top))', left: 12, right: 12, zIndex: 6 }}>
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: '#9ca3af', pointerEvents: 'none' }} />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="חיפוש מקום או כתובת…"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
              style={{ width: '100%', height: 44, borderRadius: 999, border: 'none', background: 'rgba(255,255,255,0.96)', boxShadow: '0 2px 12px rgba(0,0,0,0.14)', padding: '0 42px 0 18px', fontSize: 14, color: '#1C1917', outline: 'none' }} />
            {geoResults.length > 0 && (
              <div style={{ position: 'absolute', top: 50, left: 0, right: 0, background: '#fff', borderRadius: 14, boxShadow: '0 8px 28px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
                {geoResults.map((r, i) => (
                  <button key={i} onClick={() => goToResult(r)} style={{ display: 'block', width: '100%', textAlign: 'right', padding: '11px 14px', border: 'none', borderTop: i ? '1px solid #F3F4F6' : 'none', background: '#fff', fontSize: 13.5, color: '#1C1917', cursor: 'pointer' }}>
                    {(r.displayLines && r.displayLines.join(' · ')) || r.title || r.name}
                  </button>
                ))}
              </div>
            )}
            {/* Destinations, UNDER the search: countries → (tap) → that country's cities, all INLINE (never a
                bottom sheet, so it never hides behind the keyboard). Auto-opens when the user is in Israel. */}
            {(searchFocused || destOpen) && !searchQuery.trim() && geoResults.length === 0 && (selectedCountries ?? []).length > 0 && (
              <div style={{ position: 'absolute', top: 50, left: 0, right: 0, background: '#fff', borderRadius: 16, boxShadow: '0 8px 28px rgba(0,0,0,0.18)', padding: '12px 12px 14px', maxHeight: '58vh', overflowY: 'auto' }} dir="rtl">
                {!searchCountry ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <p style={{ margin: 0, fontSize: 12.5, fontWeight: 800, color: '#94A3B8', fontFamily: "'Heebo', sans-serif" }}>היעדים שלך ✈️</p>
                      <button onMouseDown={e => e.preventDefault()} onClick={() => { setDestOpen(false); setSearchFocused(false); }} aria-label="סגור"
                        style={{ border: 'none', background: '#F1F5F9', borderRadius: 999, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#94A3B8', fontSize: 13 }}>✕</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                      {(selectedCountries ?? []).map(cc => {
                        const c = COUNTRIES[cc];
                        return (
                          <button key={cc} onMouseDown={e => e.preventDefault()} onClick={() => setSearchCountry(cc)}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                            <div style={{ width: 58, height: 58, borderRadius: '50%', background: '#fff', border: '1.5px solid #EFEBE6', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>
                              <span>{c?.flag || '🌍'}</span>
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#78716C', fontFamily: "'Heebo', sans-serif", textAlign: 'center', lineHeight: 1.15, maxWidth: 66, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {c?.name || cc}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    <button onMouseDown={e => e.preventDefault()} onClick={() => setSearchCountry(null)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#F1F5F9', border: 'none', color: '#475569', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', padding: '7px 12px', borderRadius: 999, marginBottom: 12, fontFamily: "'Heebo', sans-serif" }}>
                      <span style={{ fontSize: 15, lineHeight: 1 }}>›</span> {COUNTRIES[searchCountry]?.flag} {COUNTRIES[searchCountry]?.name || searchCountry}
                    </button>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {(citiesByCountry[searchCountry] ?? []).length === 0 ? (
                        <p style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: '14px 0', fontFamily: "'Heebo', sans-serif" }}>אין עדיין מקומות במדינה הזו.</p>
                      ) : (citiesByCountry[searchCountry] ?? []).map(c => {
                        const em = cityEmojis[`${searchCountry.toUpperCase()}|${c.city.trim().toLowerCase()}`] || '📍';
                        return (
                          <button key={c.city} onMouseDown={e => e.preventDefault()}
                            onClick={() => { flyToLatLng(c.lat, c.lng, 0.08); setSearchCountry(null); setDestOpen(false); setSearchFocused(false); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 6px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'right' }}>
                            <div style={{ flexShrink: 0, width: 50, height: 50, borderRadius: '50%', background: '#fff', border: '1.5px solid #EFEBE6', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                              <span>{em}</span>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', fontFamily: "'Heebo', sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.city}</div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', fontFamily: "'Heebo', sans-serif" }}>{c.featured > 0 ? `${c.featured} מקומות מומלצים` : `${c.count} מקומות`}</div>
                            </div>
                            <span style={{ flexShrink: 0, color: '#F97316', fontSize: 20, fontWeight: 700 }}>‹</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, overflowX: 'auto' }} className="scrollbar-hide">
            {FILTER_TABS.map(tab => {
              const on = mapFilter === tab.id;
              return (
                <button key={tab.id} onClick={() => setMapFilter(tab.id)}
                  style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 13px', borderRadius: 999, fontSize: 13, fontWeight: on ? 800 : 600, border: on ? '1px solid transparent' : '1px solid #E5E7EB', background: on ? '#FFEBDD' : 'rgba(255,255,255,0.96)', color: on ? '#EA580C' : '#6B7280', boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}>
                  <span>{tab.emoji}</span><span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!loading && !error && (
        <div style={{ position: 'absolute', left: 12, bottom: 'calc(96px + env(safe-area-inset-bottom))', zIndex: 6, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {isAdmin && !drawing && !naming && (
            <button onClick={startDrawing} aria-label="צור אזור"
              style={{ width: 46, height: 46, borderRadius: 14, background: '#fff', color: '#8B5CF6', border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shapes size={22} />
            </button>
          )}
          <button onClick={recenter} aria-label="המיקום שלי"
            style={{ width: 46, height: 46, borderRadius: 14, background: '#fff', color: '#1C1917', border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LocateFixed size={22} style={{ color: '#F97316' }} />
          </button>
        </div>
      )}

      {/* Nearby events — a side tab on the map edge that opens the full list (classic map behaviour). */}
      {!loading && !error && (mapFilter === 'all' || mapFilter === 'events') && (
        <>
          <button onClick={() => setRadiusOpen(v => !v)} aria-label="אירועים קרובים"
            style={{ position: 'absolute', top: '50%', right: radiusOpen ? 'min(320px, 82vw)' : 0, transform: 'translateY(-50%)', transition: 'right 0.3s ease', zIndex: 8,
              background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
              borderTopLeftRadius: 16, borderBottomLeftRadius: 16, padding: '14px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              border: 'none', boxShadow: '-4px 0 18px rgba(0,0,0,0.14)' }}>
            <List size={20} style={{ color: '#F97316' }} />
            <span style={{ fontSize: 12, fontWeight: 900, color: '#111827', fontFamily: "'Heebo', sans-serif" }}>{radiusEvents.length}</span>
          </button>

          <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 'min(320px, 82vw)',
            transform: radiusOpen ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.3s ease', zIndex: 7,
            background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(22px) saturate(140%)', WebkitBackdropFilter: 'blur(22px) saturate(140%)',
            borderLeft: '1px solid rgba(255,255,255,0.6)', boxShadow: '-10px 0 34px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: 16, paddingTop: 'max(16px, env(safe-area-inset-top))', borderBottom: '1px solid rgba(17,24,39,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#111827' }}>
                  <List size={20} style={{ color: '#F97316' }} />
                  <span style={{ fontWeight: 900, fontFamily: "'Heebo', sans-serif" }}>אירועים קרובים ({radiusEvents.length})</span>
                </div>
                <button onClick={() => setRadiusOpen(false)} style={{ border: 'none', background: 'rgba(17,24,39,0.06)', borderRadius: 999, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={18} style={{ color: '#6B7280' }} />
                </button>
              </div>
              <span style={{ fontSize: 12, color: '#8B90A0', fontFamily: "'Heebo', sans-serif" }}>ברדיוס 20 ק״מ</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 100px' }}>
              {radiusEvents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 16px', background: 'rgba(255,255,255,0.6)', borderRadius: 18 }}>
                  <p style={{ color: '#8B90A0', fontFamily: "'Heebo', sans-serif", margin: 0 }}>לא נמצאו אירועים קרובים</p>
                </div>
              ) : radiusEvents.map(ev => (
                <button key={ev.id} onClick={() => setDetailsEvent(ev)} style={{ display: 'flex', gap: 12, width: '100%', textAlign: 'right', padding: '12px 8px', border: 'none', borderBottom: '1px solid #F3F4F6', background: 'transparent', cursor: 'pointer' }}>
                  <div style={{ width: 64, height: 64, borderRadius: 14, flexShrink: 0, background: '#F3EFE9', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>
                    {ev.image_url ? <img src={ev.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (ev.emoji || '🎟️')}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14.5, fontWeight: 800, color: '#111827', fontFamily: "'Heebo', sans-serif", margin: '0 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, fontFamily: "'Heebo', sans-serif" }}><MapPin size={12} />{ev.city}</span>
                      <span style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, fontFamily: "'Heebo', sans-serif" }}><Clock size={12} />{fmtTime(ev.event_date)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: '#FFF7ED', borderRadius: 20, padding: '5px 9px', flexShrink: 0, alignSelf: 'center' }}>
                    <Users size={11} color="#F97316" />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#F97316', fontFamily: "'Heebo', sans-serif" }}>{ev.attendees?.length ?? 0}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Detail sheets (reused as-is) */}
      {sheetEvent && (
        <EventDetailsModal
          event={sheetEvent as any} variant="sheet" currentUserId={userId}
          onClose={() => { setSheetEvent(null); endFocus(); }}
          onNavigateToUserProfile={onNavigateToUserProfile} onMessageUser={onMessageUser}
          onOpenMapAt={(lat: number, lng: number) => { setSheetEvent(null); const mk = mapkitRef.current; mapRef.current?.setCenterAnimated(new mk.Coordinate(lat, lng), true); }}
          onDeleted={refreshEvents}
        />
      )}
      {detailsEvent && (
        <EventDetailsModal
          event={detailsEvent as any} currentUserId={userId}
          onClose={() => setDetailsEvent(null)}
          onNavigateToUserProfile={onNavigateToUserProfile} onMessageUser={onMessageUser}
          onOpenMapAt={(lat: number, lng: number) => { setDetailsEvent(null); const mk = mapkitRef.current; mapRef.current?.setCenterAnimated(new mk.Coordinate(lat, lng), true); }}
          onDeleted={refreshEvents}
        />
      )}
      <AdminLocationBottomSheet
        isOpen={showAdminLocation}
        onClose={() => { setShowAdminLocation(false); setSelectedAdminLocation(null); endFocus(); }}
        location={selectedAdminLocation} currentUserId={userId} userLocation={location}
      />
      {/* The old "Plan your trip" pop-up card was removed — destinations now live inline under the map search. */}

      <MeetupBottomSheet
        meetup={selectedMeetup} isOpen={showMeetup} currentUserId={userId}
        onClose={() => { setShowMeetup(false); setSelectedMeetup(null); endFocus(); }}
        onJoined={() => { loadMeetups(); }}
        onOpenChat={(meetupId: string) => {
          setShowMeetup(false);
          const m = meetups.find(x => x.id === meetupId) || selectedMeetup;
          if (m) { try { supabase.rpc('join_meetup_group', { p_meetup_id: m.id }); } catch { /* ignore */ } setGroupChatMeetup(m); }
        }}
        onRefresh={loadMeetups}
      />
      {groupChatMeetup && (
        <CityGroupChat
          countryCode={`meetup:${groupChatMeetup.id}`}
          countryFlag={groupChatMeetup.emoji || '☕'}
          cityName={groupChatMeetup.text || 'ציוץ'}
          cityEmoji={groupChatMeetup.emoji || '☕'}
          ownerId={groupChatMeetup.user_id}
          currentUserId={userId}
          currentUserName={me.name}
          currentUserAvatar={me.avatar}
          onClose={() => setGroupChatMeetup(null)}
          onNavigateToUserProfile={onNavigateToUserProfile}
        />
      )}

      {/* Admin: drawing toolbar */}
      {drawing && (
        <div style={{ position: 'absolute', top: 'max(12px, env(safe-area-inset-top))', left: 12, right: 12, zIndex: 8, background: '#fff', borderRadius: 16, boxShadow: '0 6px 24px rgba(0,0,0,0.2)', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }} dir="rtl">
          <p style={{ fontSize: 13.5, fontWeight: 700, color: '#1C1917', textAlign: 'center' }}>
            {draftPoints.length < 3 ? `הקש על המפה לסימון האזור (${draftPoints.length}/3 לפחות)` : `${draftPoints.length} נקודות — אפשר לסיים`}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={cancelDrawing} style={{ flex: 1, padding: 9, borderRadius: 11, border: '1px solid #E5E7EB', background: '#fff', color: '#6B7280', fontWeight: 700, fontSize: 13 }}>ביטול</button>
            <button onClick={undoVertex} disabled={!draftPoints.length} style={{ flex: 1, padding: 9, borderRadius: 11, border: '1px solid #E5E7EB', background: '#fff', color: '#6B7280', fontWeight: 700, fontSize: 13, opacity: draftPoints.length ? 1 : 0.4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><Undo2 size={15} />בטל נקודה</button>
            <button onClick={finishDrawing} disabled={draftPoints.length < 3} style={{ flex: 1, padding: 9, borderRadius: 11, border: 'none', background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)', color: '#fff', fontWeight: 800, fontSize: 13, opacity: draftPoints.length >= 3 ? 1 : 0.4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><Check size={15} />סיום</button>
          </div>
        </div>
      )}

      {/* Admin: name + colour the drawn area */}
      {naming && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 9, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'flex-end' }} onClick={cancelDrawing}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: '#fff', borderRadius: '22px 22px 0 0', padding: '18px 16px calc(20px + env(safe-area-inset-bottom))', boxShadow: '0 -8px 30px rgba(0,0,0,0.2)' }} dir="rtl">
            <h3 style={{ fontSize: 17, fontWeight: 800, color: '#1C1917', marginBottom: 12 }}>שם האזור</h3>
            <input value={areaName} onChange={e => setAreaName(e.target.value)} placeholder="למשל: מרכז העיר" autoFocus
              style={{ width: '100%', height: 46, borderRadius: 12, border: '1px solid #E5E7EB', background: '#F9FAFB', padding: '0 14px', fontSize: 15, color: '#1C1917', outline: 'none', marginBottom: 14 }} />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
              {AREA_COLORS.map(c => (
                <button key={c} onClick={() => setAreaColor(c)} aria-label={c}
                  style={{ width: 32, height: 32, borderRadius: '50%', background: c, border: areaColor === c ? '3px solid #111827' : '3px solid transparent', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={cancelDrawing} style={{ flex: 1, padding: 12, borderRadius: 13, border: '1px solid #E5E7EB', background: '#fff', color: '#6B7280', fontWeight: 700, fontSize: 14 }}>ביטול</button>
              <button onClick={saveArea} disabled={!areaName.trim() || savingArea} style={{ flex: 2, padding: 12, borderRadius: 13, border: 'none', background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)', color: '#fff', fontWeight: 800, fontSize: 14, opacity: (!areaName.trim() || savingArea) ? 0.5 : 1 }}>{savingArea ? 'שומר…' : 'שמור אזור'}</button>
            </div>
          </div>
        </div>
      )}

      <FloatingNavBar
        activeTab="map" currentUserId={userId}
        onHomeClick={onNavigateToHome} onMapClick={() => {}} onCreateClick={() => setShowCreateActionSheet(true)}
        onChatClick={onNavigateToMessages} onMyEventsClick={onNavigateToMyEvents}
      />

      {/* Create flow (the "+" button): choose event or meetup, then the matching flow. */}
      <MapCreateActionSheet
        isOpen={showCreateActionSheet}
        onClose={() => setShowCreateActionSheet(false)}
        onSelectEvent={() => { setShowCreateActionSheet(false); setShowCreateEventFlow(true); }}
        onSelectMeetup={() => { setShowCreateActionSheet(false); setShowCreateMeetupFlow(true); }}
      />
      <MapCreateEventFlow
        isOpen={showCreateEventFlow}
        onClose={() => setShowCreateEventFlow(false)}
        onSuccess={(createdEvent?: Record<string, any>) => {
          setShowCreateEventFlow(false);
          refreshEvents();
          setMapFilter('events');
          if (createdEvent && createdEvent.latitude != null && createdEvent.longitude != null) {
            flyToLatLng(Number(createdEvent.latitude), Number(createdEvent.longitude));
          }
        }}
        userId={userId}
        initialLocation={location || undefined}
      />
      <CreateMeetupFlow
        isOpen={showCreateMeetupFlow}
        onClose={() => setShowCreateMeetupFlow(false)}
        onSuccess={(loc?: { latitude: number; longitude: number }) => {
          setShowCreateMeetupFlow(false);
          loadMeetups();
          setMapFilter('meetups');
          if (loc) flyToLatLng(loc.latitude, loc.longitude, 0.006);
        }}
        userId={userId}
        initialLocation={location || undefined}
      />
    </div>
  );
}
