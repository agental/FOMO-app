import { useState, useEffect, useRef } from 'react';
import { Star, MapPin, Image as ImageIcon, X, Loader2, Check, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { COUNTRIES } from '../utils/countries';
import { reverseGeocode } from '../utils/geocoding';
import { POST_CATEGORIES, categoryFromPoi, postCategoryEmoji } from '../utils/postCategory';
import { placePinColor, PLACE_COLORS } from '../utils/placePinColor';
import { createPlacePinSVG } from '../utils/createLocationPin';
import { EmojiPickerSheet } from './EmojiPickerSheet';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

type CreatePostFormProps = {
  onSuccess: () => void;
  onCancel: () => void;
  currentUserId: string;
  defaultCountry?: string;
};

/** The POI the user tapped on the map. */
interface PickedPoi { name: string; category?: string }

export function CreatePostForm({ onSuccess, onCancel, currentUserId, defaultCountry }: CreatePostFormProps) {
  const [placeName, setPlaceName] = useState('');
  const [content, setContent]     = useState('');
  const [category, setCategory]   = useState('');
  // how the pin will look on the map — seeded from the category, then fully editable
  const [pinEmoji, setPinEmoji]   = useState('📍');
  const [pinColor, setPinColor]   = useState(() => placePinColor('📍'));
  const [pinTouched, setPinTouched] = useState(false); // stop re-seeding once they've styled it
  const [emojiSheetOpen, setEmojiSheetOpen] = useState(false);
  const [country, setCountry]     = useState(defaultCountry || 'IL');
  const [city, setCity]           = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [rating, setRating]       = useState(0);
  const [latitude, setLatitude]   = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [picked, setPicked]       = useState<PickedPoi | null>(null);
  const [showMap, setShowMap]     = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [locError, setLocError]   = useState('');
  const [submitting, setSubmitting] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef  = useRef<mapboxgl.Map | null>(null);
  const markerRef       = useRef<mapboxgl.Marker | null>(null);
  const pulseRef        = useRef<number | null>(null); // the snap-target halo's breathing timer
  const glideRef        = useRef<number | null>(null); // rAF that glides the pin onto a POI

  useEffect(() => {
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';
    return () => {
      if (pulseRef.current != null) clearInterval(pulseRef.current);
      if (glideRef.current != null) cancelAnimationFrame(glideRef.current);
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  /**
   * Open the map on the user's REAL position. `navigator.geolocation` doesn't work in the iOS
   * WebView — the position comes from the wrapper's native bridge (`window._nativeLocation`).
   * (This is why it used to always fall back to Tel Aviv.)
   */
  const openMapHere = () => {
    setMapLoading(true);
    setLocError('');
    let done = false;

    const open = (lat: number, lng: number) => {
      if (done) return;
      done = true;
      window.removeEventListener('nativeLocation', onNative as EventListener);
      setLatitude(lat); setLongitude(lng); setShowMap(true); setMapLoading(false);
    };
    const onNative = (e: any) => {
      const { lat, lng } = e?.detail || {};
      if (lat != null && !isNaN(lat)) open(lat, lng);
    };

    const cached = (window as any)._nativeLocation;
    if (cached?.lat != null && !isNaN(cached.lat)) { open(cached.lat, cached.lng); return; }

    window.addEventListener('nativeLocation', onNative as EventListener);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        p => open(p.coords.latitude, p.coords.longitude),
        () => { /* wait for the native event */ },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    }
    setTimeout(() => {
      if (done) return;
      done = true;
      window.removeEventListener('nativeLocation', onNative as EventListener);
      setMapLoading(false);
      setLocError('לא הצלחנו לאתר אותך. אשר הרשאת מיקום ונסה שוב.');
    }, 12000);
  };

  /* if the bridge already gave us a position, go straight to the map — no extra tap */
  useEffect(() => {
    const cached = (window as any)._nativeLocation;
    if (cached?.lat != null && !isNaN(cached.lat)) {
      setLatitude(cached.lat); setLongitude(cached.lng); setShowMap(true);
    }
  }, []);

  /* the category (picked, or auto-detected from the tapped POI) seeds the pin's look — until the
     author styles it themselves, after which we leave their choice alone */
  useEffect(() => {
    if (pinTouched || !category) return;
    const e = postCategoryEmoji(category);
    setPinEmoji(e);
    setPinColor(placePinColor(e));
  }, [category, pinTouched]);

  const fillArea = async (lat: number, lng: number) => {
    try {
      const geo = await reverseGeocode(lat, lng);
      if (geo.city) setCity(geo.city);
      if (geo.countryCode) setCountry(geo.countryCode);
    } catch { /* not critical */ }
  };

  /* ── the map: tap any Mapbox POI to pick it ── */
  useEffect(() => {
    if (!showMap || !mapContainerRef.current || latitude == null || longitude == null || mapInstanceRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12', // v12 carries the rich POI label layer
      center: [longitude, latitude],
      zoom: 15.5, // close enough that Mapbox actually renders its POIs
    });
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    const marker = new mapboxgl.Marker({ color: '#F97316', draggable: true }).setLngLat([longitude, latitude]).addTo(map);

    const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
    const SNAP_PX     = 30; // dragging the pin: how close before a POI lights up
    const PAN_SNAP_PX = 46; // panning the map: how close to the centre a POI must be to grab the pin

    /* A halo that grows under the POI you're about to snap to, and breathes while it's the target.
       It sits BELOW `poi-label`, so Mapbox's own icon + name stay readable on top of it. */
    const addHalo = () => {
      if (map.getSource('poi-hit')) return;
      map.addSource('poi-hit', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'poi-hit-halo',
        type: 'circle',
        source: 'poi-hit',
        paint: {
          'circle-radius': 0,                       // grows in when a POI becomes the target
          'circle-radius-transition': { duration: 260, delay: 0 },
          'circle-color': '#F97316',
          'circle-opacity': 0.2,
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#F97316',
          'circle-stroke-opacity': 0.95,
        },
      }, map.getLayer('poi-label') ? 'poi-label' : undefined);
    };
    map.on('load', addHalo);

    /* breathe: 19 ⇄ 24px, riding the 260ms paint transition so it eases on its own */
    const startPulse = () => {
      if (pulseRef.current != null) return;
      let big = true;
      pulseRef.current = window.setInterval(() => {
        if (!map.getLayer('poi-hit-halo')) return;
        map.setPaintProperty('poi-hit-halo', 'circle-radius', big ? 24 : 19);
        big = !big;
      }, 480);
    };
    const stopPulse = () => {
      if (pulseRef.current != null) { clearInterval(pulseRef.current); pulseRef.current = null; }
    };

    const highlight = (feat: mapboxgl.MapboxGeoJSONFeature | null) => {
      const src = map.getSource('poi-hit') as mapboxgl.GeoJSONSource | undefined;
      if (!src) return;
      if (!feat) {
        stopPulse();
        if (map.getLayer('poi-hit-halo')) map.setPaintProperty('poi-hit-halo', 'circle-radius', 0);
        src.setData(EMPTY);
        return;
      }
      src.setData({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: {}, geometry: feat.geometry as any }],
      });
      if (map.getLayer('poi-hit-halo')) map.setPaintProperty('poi-hit-halo', 'circle-radius', 22);
      startPulse();
    };

    /** The Mapbox POI closest to a point on screen, if it's within `radius` px. */
    const poiNear = (lngLat: mapboxgl.LngLat, radius = SNAP_PX): mapboxgl.MapboxGeoJSONFeature | null => {
      const p = map.project(lngLat);
      let feats: mapboxgl.MapboxGeoJSONFeature[] = [];
      try {
        feats = map.queryRenderedFeatures(
          [[p.x - radius, p.y - radius], [p.x + radius, p.y + radius]],
          { layers: ['poi-label'] },
        );
      } catch { return null; } // layer not in this style
      let best: mapboxgl.MapboxGeoJSONFeature | null = null;
      let bestD = Infinity;
      for (const f of feats) {
        const c = (f.geometry as any)?.coordinates;
        if (!c) continue;
        const fp = map.project(c as [number, number]);
        const d = Math.hypot(fp.x - p.x, fp.y - p.y);
        if (d < bestD) { bestD = d; best = f; }
      }
      return bestD <= radius ? best : null;
    };

    /** Glide the pin to a coordinate (easeOutCubic) instead of teleporting it. */
    const glideTo = (to: [number, number], after?: () => void) => {
      if (glideRef.current != null) cancelAnimationFrame(glideRef.current);
      const from = marker.getLngLat();
      const t0 = performance.now();
      const DUR = 460;
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / DUR);
        const e = 1 - Math.pow(1 - k, 3); // easeOutCubic
        marker.setLngLat([from.lng + (to[0] - from.lng) * e, from.lat + (to[1] - from.lat) * e]);
        if (k < 1) { glideRef.current = requestAnimationFrame(step); }
        else { glideRef.current = null; after?.(); }
      };
      glideRef.current = requestAnimationFrame(step);
    };

    /** Lock onto a POI and fill everything in. Doesn't move the map (no feedback loops). */
    const selectPoi = (feat: mapboxgl.MapboxGeoJSONFeature) => {
      const props: any = feat.properties || {};
      const name = props.name_he || props.name || props.name_en || '';
      const [lng, lat] = (feat.geometry as any).coordinates as [number, number];

      setPlaceName(name);
      setPicked({ name, category: props.class || props.maki });
      setLatitude(lat); setLongitude(lng);

      const guess = categoryFromPoi(props);  // e.g. a Mapbox `lodging` POI → מלון 🏨
      if (guess) setCategory(guess);

      fillArea(lat, lng);
      highlight(null);
    };

    const dropFreePin = (lngLat: mapboxgl.LngLat) => {
      setPicked(null);
      setLatitude(lngLat.lat); setLongitude(lngLat.lng);
      fillArea(lngLat.lat, lngLat.lng);
      highlight(null);
    };

    /* ── Pan the map to aim ──────────────────────────────────────────────────────────────
       While the map moves, the pin rides the centre like a crosshair and the nearest POI
       lights up. When you let go, the pin GLIDES onto that POI and picks it. */
    map.on('move', () => {
      if (glideRef.current != null) { cancelAnimationFrame(glideRef.current); glideRef.current = null; }
      const c = map.getCenter();
      marker.setLngLat(c);
      highlight(poiNear(c, PAN_SNAP_PX));
    });

    map.on('moveend', () => {
      const c = map.getCenter();
      const hit = poiNear(c, PAN_SNAP_PX);
      if (hit) {
        const [lng, lat] = (hit.geometry as any).coordinates as [number, number];
        glideTo([lng, lat], () => selectPoi(hit));   // the pin flies onto the POI
      } else {
        marker.setLngLat(c);
        dropFreePin(c);
      }
    });

    /* ── Or drag the pin itself ── */
    marker.on('drag', () => highlight(poiNear(marker.getLngLat())));
    marker.on('dragend', () => {
      const ll = marker.getLngLat();
      const hit = poiNear(ll);
      if (hit) {
        const [lng, lat] = (hit.geometry as any).coordinates as [number, number];
        glideTo([lng, lat], () => selectPoi(hit));
      } else {
        dropFreePin(ll);
      }
    });

    /* ── Or just tap a POI ── */
    map.on('click', e => {
      const hit = poiNear(e.lngLat);
      if (hit) {
        const [lng, lat] = (hit.geometry as any).coordinates as [number, number];
        glideTo([lng, lat], () => selectPoi(hit));
      } else {
        marker.setLngLat(e.lngLat);
        dropFreePin(e.lngLat);
      }
    });

    map.on('mouseenter', 'poi-label', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'poi-label', () => { map.getCanvas().style.cursor = ''; });

    mapInstanceRef.current = map;
    markerRef.current = marker;

    return () => { stopPulse(); };
  }, [showMap, latitude, longitude]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('נא להעלות קובץ תמונה בלבד'); return; }
    if (file.size > 5 * 1024 * 1024) { alert('התמונה גדולה מדי (מקסימום 5MB)'); return; }
    setImageFile(file);
    const r = new FileReader(); r.onloadend = () => setImagePreview(r.result as string); r.readAsDataURL(file);
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const ext = file.name.split('.').pop();
    const path = `posts/${currentUserId}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('images').upload(path, file);
    if (error) { console.error('post image upload:', error); return null; }
    return supabase.storage.from('images').getPublicUrl(path).data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (latitude == null || longitude == null) { alert('בחר את המקום על המפה'); return; }
    if (!placeName.trim() || !content.trim()) { alert('אנא מלאו שם מקום ותיאור ההמלצה'); return; }

    setSubmitting(true);
    try {
      let imageUrl: string | null = null;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
        if (!imageUrl) { alert('שגיאה בהעלאת התמונה. נסו שוב או בלי תמונה.'); setSubmitting(false); return; }
      }
      const { data: newPost, error } = await supabase.from('posts').insert({
        user_id: currentUserId,
        content: content.trim(),
        place_name: placeName.trim(),
        image_url: imageUrl,
        country,
        city: city.trim() || null,
        latitude, longitude,
        tags: category ? [category] : [],
        pin_emoji: pinEmoji,
        pin_color: pinColor,
      }).select('id').single();
      if (error) throw error;

      if (newPost?.id && rating > 0) {
        const { error: rErr } = await supabase.from('post_ratings').insert({ post_id: newPost.id, user_id: currentUserId, rating });
        if (rErr) console.error('post rating insert:', rErr.message);
      }
      onSuccess();
    } catch (err: any) {
      console.error('Create post error:', err);
      alert(`שגיאה בשמירת ההמלצה${err?.message ? ': ' + err.message : ''}`);
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = 'w-full px-4 py-3 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] transition bg-gray-50 focus:bg-white';
  const HEEBO = 'Heebo, sans-serif';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end justify-center z-50" dir="rtl" onClick={onCancel}>
      <div className="bg-white w-full max-w-2xl rounded-t-3xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#FFF7ED' }}>
              <Star className="w-4 h-4" style={{ color: '#F97316' }} strokeWidth={2.4} />
            </div>
            <h2 className="text-xl font-black text-gray-900" style={{ fontFamily: HEEBO }}>המלצה חדשה</h2>
          </div>
          <button onClick={onCancel} aria-label="סגור" className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 active:scale-95 transition">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">

          {/* ── 1. Pick the place off the map ── */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2" style={{ fontFamily: HEEBO }}>
              <MapPin className="inline w-4 h-4 ml-1" style={{ color: '#F97316' }} />
              איזה מקום אתה ממליץ? *
            </label>

            {!showMap ? (
              <>
                <button
                  type="button"
                  onClick={openMapHere}
                  disabled={mapLoading}
                  className="w-full px-4 py-3.5 rounded-2xl font-bold text-white transition active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', fontFamily: HEEBO }}
                >
                  <Search className="w-5 h-5" />
                  {mapLoading ? 'מאתר אותך...' : 'בחר מקום מהמפה'}
                </button>
                {locError && <p className="text-xs text-red-500 mt-1.5">{locError}</p>}
              </>
            ) : (
              <div className="space-y-2">
                {/* selected place */}
                {picked ? (
                  <div className="flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5" style={{ background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
                    <span className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#16A34A' }}>
                      <Check className="w-4 h-4 text-white" strokeWidth={3} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-gray-900 truncate" style={{ fontFamily: HEEBO }}>{picked.name}</p>
                      <p className="text-[11.5px] font-semibold" style={{ color: '#16A34A', fontFamily: HEEBO }}>נבחר מהמפה</p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl px-3.5 py-2.5 text-center" style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
                    <p className="text-[12.5px] font-bold" style={{ color: '#C2410C', fontFamily: HEEBO }}>
                      הקש על מקום במפה כדי לבחור אותו
                    </p>
                  </div>
                )}

                <div ref={mapContainerRef} className="relative h-64 rounded-2xl overflow-hidden border-2" style={{ borderColor: '#FDBA74' }} />

                <p className="text-xs text-gray-400 text-center" style={{ fontFamily: 'Rubik, sans-serif' }}>
                  הקש על מסעדה, בר או כל מקום שמופיע במפה · או גרור את הסמן למקום מדויק
                </p>
              </div>
            )}
          </div>

          {/* Place name — auto-filled from the map, still editable */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2" style={{ fontFamily: HEEBO }}>
              שם המקום *
              {picked && <span className="font-normal text-gray-400"> (נבחר מהמפה — אפשר לערוך)</span>}
            </label>
            <input
              type="text" value={placeName} onChange={e => setPlaceName(e.target.value)} required
              placeholder="בחר מהמפה, או כתוב שם"
              className={inputCls} style={{ fontFamily: 'Rubik, sans-serif' }}
            />
          </div>

          {/* Recommendation text */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2" style={{ fontFamily: HEEBO }}>מה אהבת שם? *</label>
            <textarea
              value={content} onChange={e => setContent(e.target.value)} required rows={3}
              placeholder="ספרו בקצרה למה כדאי לבקר — אווירה, אוכל, נוף..."
              className={`${inputCls} resize-none`} style={{ fontFamily: 'Rubik, sans-serif' }}
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2" style={{ fontFamily: HEEBO }}>קטגוריה</label>
            <div className="flex flex-wrap gap-2">
              {POST_CATEGORIES.map(c => {
                const sel = category === c.id;
                return (
                  <button
                    key={c.id} type="button" onClick={() => setCategory(sel ? '' : c.id)} aria-pressed={sel}
                    className="px-3.5 py-2 rounded-full text-sm font-bold transition active:scale-95"
                    style={{
                      fontFamily: HEEBO,
                      background: sel ? 'linear-gradient(135deg, #F97316, #EA580C)' : '#F3F4F6',
                      color: sel ? '#fff' : '#6B7280',
                    }}
                  >
                    {c.emoji} {c.id}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── How the pin will look on the map ── */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2" style={{ fontFamily: HEEBO }}>
              <MapPin className="inline w-4 h-4 ml-1" style={{ color: '#F97316' }} />
              איך הפין ייראה במפה
            </label>

            <div
              className="rounded-2xl p-4 border border-gray-200"
              style={{ background: `linear-gradient(135deg, ${pinColor}18, ${pinColor}06)` }}
            >
              <div className="flex items-center gap-4">
                {/* live preview — exactly the pin that lands on the map */}
                <div className="flex items-center justify-center flex-shrink-0" style={{ width: 66, height: 80 }}>
                  <div
                    style={{ transform: 'scale(1.7)', transformOrigin: 'center bottom' }}
                    dangerouslySetInnerHTML={{ __html: createPlacePinSVG(pinEmoji, pinColor).outerHTML }}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setEmojiSheetOpen(true)}
                  className="flex-1 py-3 rounded-xl font-bold text-white transition active:scale-[0.98] flex items-center justify-center gap-2"
                  style={{ background: pinColor, boxShadow: `0 6px 18px ${pinColor}55`, fontFamily: HEEBO }}
                >
                  <span className="text-lg leading-none">{pinEmoji}</span>
                  בחר אימוג׳י
                </button>
              </div>

              {/* colour palette */}
              <p className="text-xs font-bold text-gray-600 mt-4 mb-2" style={{ fontFamily: HEEBO }}>צבע הפין</p>
              <div className="flex flex-wrap gap-2.5">
                {PLACE_COLORS.map(c => {
                  const active = pinColor.toLowerCase() === c.toLowerCase();
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => { setPinColor(c); setPinTouched(true); }}
                      aria-label={c}
                      className="rounded-full transition-transform"
                      style={{
                        width: 30, height: 30, background: c, padding: 0, cursor: 'pointer',
                        border: active ? '3px solid #111827' : '2px solid #ffffff',
                        boxShadow: active ? '0 0 0 2px #ffffff, 0 2px 6px rgba(0,0,0,0.25)' : '0 1px 4px rgba(0,0,0,0.2)',
                        transform: active ? 'scale(1.12)' : 'scale(1)',
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Optional rating */}
          <div>
            <style>{`
              @keyframes recStarPop { 0% { transform: scale(0.5); } 55% { transform: scale(1.28); } 100% { transform: scale(1); } }
              @media (prefers-reduced-motion: reduce) { .rec-star { animation: none !important; } }
            `}</style>
            <label className="block text-sm font-bold text-gray-700 mb-2" style={{ fontFamily: HEEBO }}>
              הדירוג שלך <span className="font-normal text-gray-400">(אופציונלי)</span>
            </label>
            <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
              <div key={rating} className="flex gap-2" style={{ direction: 'ltr' }}>
                {[1, 2, 3, 4, 5].map(n => {
                  const filled = n <= rating;
                  return (
                    <button
                      key={n} type="button" onClick={() => setRating(rating === n ? 0 : n)} aria-label={`דרג ${n} מתוך 5`}
                      className="rec-star"
                      style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', lineHeight: 0, animation: filled ? `recStarPop 0.42s cubic-bezier(0.34,1.56,0.64,1) ${(n - 1) * 70}ms both` : 'none' }}
                    >
                      <Star className="w-8 h-8" strokeWidth={2} style={{ color: filled ? '#F97316' : '#D1D5DB', fill: filled ? '#F97316' : 'none', transition: 'color 0.18s, fill 0.18s' }} />
                    </button>
                  );
                })}
              </div>
              {rating > 0 && <span className="text-sm font-bold" style={{ color: '#16A34A', fontFamily: 'Rubik, sans-serif' }}>{rating}/5</span>}
            </div>
          </div>

          {/* Country + city — auto-filled from the pick */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2" style={{ fontFamily: HEEBO }}>מדינה *</label>
              <select value={country} onChange={e => setCountry(e.target.value)} required className={inputCls} style={{ fontFamily: 'Rubik, sans-serif' }}>
                {Object.entries(COUNTRIES).map(([code, { name, flag }]) => (
                  <option key={code} value={code}>{flag} {name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2" style={{ fontFamily: HEEBO }}>עיר</label>
              <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="מתמלא אוטומטית" className={inputCls} style={{ fontFamily: 'Rubik, sans-serif' }} />
            </div>
          </div>

          {/* Photo */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2" style={{ fontFamily: HEEBO }}>
              <ImageIcon className="inline w-4 h-4 ml-1" style={{ color: '#F97316' }} /> תמונה
            </label>
            <input
              type="file" accept="image/*" onChange={handleImageChange}
              className="w-full text-sm file:ml-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-[#FFF7ED] file:text-[#EA580C]"
            />
            {imagePreview && <img src={imagePreview} alt="תצוגה מקדימה" className="mt-3 w-full h-44 object-cover rounded-2xl" />}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="submit" disabled={submitting}
              className="flex-1 h-14 rounded-2xl font-black text-white transition active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', boxShadow: '0 8px 24px rgba(249,115,22,0.35)', fontFamily: HEEBO }}
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {submitting ? 'מפרסם...' : 'פרסם המלצה'}
            </button>
            <button type="button" onClick={onCancel} className="px-6 h-14 rounded-2xl font-bold bg-gray-100 text-gray-600 active:scale-95 transition" style={{ fontFamily: HEEBO }}>
              ביטול
            </button>
          </div>
        </form>
      </div>

      <EmojiPickerSheet
        isOpen={emojiSheetOpen}
        onClose={() => setEmojiSheetOpen(false)}
        selectedEmoji={pinEmoji}
        onSelect={e => { setPinEmoji(e); setPinColor(placePinColor(e)); setPinTouched(true); }}
      />
    </div>
  );
}
