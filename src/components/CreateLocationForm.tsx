import { useState, useEffect, useRef } from 'react';
import { MapPin, X, Navigation, Phone, Globe, Palette, Link, Loader, CircleCheck as CheckCircle, CircleAlert as AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { COUNTRIES } from '../utils/countries';
import { LOCATION_PIN_COLORS, createLocationPinSVG } from '../utils/createLocationPin';
import { reverseGeocode } from '../utils/geocoding';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

type CreateLocationFormProps = {
  onSuccess: () => void;
  onCancel: () => void;
  currentUserId: string;
};

interface PlaceData {
  placeId: string;
  placeName: string;
  placeAddress: string;
  rating?: number | null;
  reviewCount?: number | null;
  photoUrl?: string | null;
  photos?: string[];
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
  website?: string;
  phone?: string;
  types?: string[];
  openNow?: boolean;
}

type FetchStatus = 'idle' | 'loading' | 'success' | 'error';

const EMOJI_CATEGORIES = [
  { id: 'food',     icon: '🍔', label: 'אוכל',    emojis: ['🍕','🍔','🍣','🍜','🍱','🍝','☕','🍺','🍷','🧃','🍰','🧁','🍩','🥐','🥩','🥗','🌮','🍦','🫕','🥑'] },
  { id: 'activity', icon: '⚽', label: 'פעילות',  emojis: ['⚽','🏋️','🏊','🧘','🚴','🎾','🏀','🎯','🥋','⛷️','🏄','🎮','🎵','🎭','🎨','🎪','🎳','🏆','🎬','🎤'] },
  { id: 'travel',   icon: '🏖️', label: 'נסיעות',  emojis: ['🏖️','✈️','🏛️','🗺️','🏔️','🌴','🗼','🏰','🚢','🧳','🌍','⛵','🚗','🌅','🏕️','🌃','🛳️','🌋','🏟️','🗽'] },
  { id: 'shopping', icon: '🛍️', label: 'קניות',   emojis: ['🛍️','💊','✂️','⛽','🅿️','💇','💆','👗','👠','💄','💍','🧴','🛒','💰','🏪','🏬','💳','👜','🎁','🧹'] },
  { id: 'religion', icon: '🕍', label: 'דת',      emojis: ['🕍','⛪','🕌','🌿','📿','✡️','✝️','☪️','🕯️','🙏','📖','⚖️','🔯','☮️','🕎','🛐'] },
  { id: 'misc',     icon: '⭐', label: 'שונות',   emojis: ['⭐','🔥','❤️','💎','🏆','✅','🎉','🎀','🌺','🌈','💡','🔑','🏠','🏥','🏦','🏫','🚨','📍','🔔','💬'] },
] as const;

export function CreateLocationForm({ onSuccess, onCancel, currentUserId }: CreateLocationFormProps) {
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>('idle');
  const [fetchError, setFetchError] = useState('');
  const [placeData, setPlaceData] = useState<PlaceData | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [country, setCountry] = useState('TH');
  const [city, setCity] = useState('');
  const [pinColor, setPinColor] = useState('#EF4444');
  const [emoji, setEmoji] = useState('');
  const [emojiCategory, setEmojiCategory] = useState<string>('food');
  const [submitting, setSubmitting] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!showMapPicker || !mapContainerRef.current || !latitude || !longitude || mapInstanceRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [longitude, latitude],
      zoom: 15,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    const marker = new mapboxgl.Marker({ color: pinColor, draggable: true })
      .setLngLat([longitude, latitude])
      .addTo(map);

    marker.on('dragend', () => {
      const lngLat = marker.getLngLat();
      setLatitude(lngLat.lat);
      setLongitude(lngLat.lng);
    });

    map.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      setLatitude(lat);
      setLongitude(lng);
      marker.setLngLat([lng, lat]);
    });

    mapInstanceRef.current = map;
    markerRef.current = marker;
  }, [showMapPicker, latitude, longitude]);

  const fetchPlaceFromGoogleMaps = async () => {
    if (!googleMapsUrl.trim()) return;
    setFetchStatus('loading');
    setFetchError('');
    setPlaceData(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/google-places`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'Apikey': supabaseKey,
        },
        body: JSON.stringify({ googleMapsUrl: googleMapsUrl.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'שגיאה בטעינת המקום');
      }

      const place = data as PlaceData;
      setPlaceData(place);

      setName(place.placeName || '');
      if (place.city) setCity(place.city);
      if (place.latitude) setLatitude(place.latitude);
      if (place.longitude) setLongitude(place.longitude);
      if (place.latitude && place.longitude) setShowMapPicker(true);

      if (place.country) {
        const countryCode = Object.entries(COUNTRIES).find(
          ([, v]) => v.name.toLowerCase() === place.country!.toLowerCase()
        )?.[0];
        if (countryCode) setCountry(countryCode);
      }

      setFetchStatus('success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'שגיאה לא ידועה';
      setFetchError(msg);
      setFetchStatus('error');
    }
  };

  const getCurrentLocation = () => {
    setMapLoading(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude);
          setLongitude(position.coords.longitude);
          setShowMapPicker(true);
          setMapLoading(false);
        },
        () => {
          setLatitude(13.7563);
          setLongitude(100.5018);
          setShowMapPicker(true);
          setMapLoading(false);
        }
      );
    } else {
      setLatitude(13.7563);
      setLongitude(100.5018);
      setShowMapPicker(true);
      setMapLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !latitude || !longitude) {
      alert('אנא מלא את כל שדות החובה (שם ומיקום)');
      return;
    }

    setSubmitting(true);

    try {
      let finalCountry = country;

      if (!placeData?.country && latitude && longitude) {
        const geoResult = await reverseGeocode(latitude, longitude);
        if (geoResult.countryCode) finalCountry = geoResult.countryCode;
        if (!city && geoResult.city) setCity(geoResult.city);
      }

      const photoUrl = placeData?.photoUrl || placeData?.photos?.[0] || null;
      const emojiValue = emoji.trim() || null;

      const corePayload = {
        name,
        country:    finalCountry,
        latitude:   latitude!,
        longitude:  longitude!,
        // Encode emoji into pin_color as "color|emoji" — avoids schema cache issues with
        // the separately-added emoji column. MapScreen parses this on read.
        pin_color:  emojiValue ? `${pinColor}|${emojiValue}` : pinColor,
        created_by: currentUserId,
        description:    description || null,
        city:           city || placeData?.city || null,
        address:        placeData?.placeAddress || null,
        phone:          placeData?.phone || null,
        email:          null as null,
        website:        placeData?.website || null,
        image_url:      photoUrl,
        google_place_id:    placeData?.placeId || null,
        place_name:         placeData?.placeName || null,
        place_address:      placeData?.placeAddress || null,
        place_rating:       placeData?.rating ?? null,
        place_review_count: placeData?.reviewCount ?? null,
        place_photo_url:    photoUrl,
        place_photos:       placeData?.photos || null,
        place_phone:        placeData?.phone || null,
        place_website:      placeData?.website || null,
        place_types:        placeData?.types || null,
        place_open_now:     placeData?.openNow ?? null,
        google_maps_url:    googleMapsUrl.trim() || null,
      };

      const { error: insertError } = await supabase
        .from('admin_locations')
        .insert(corePayload);

      if (insertError) {
        alert(`שגיאה ביצירת המקום: ${insertError.message} (${insertError.code})`);
        return;
      }

      alert('המקום נוצר בהצלחה!');
      onSuccess();
    } catch (err) {
      console.error('[CreateLocation] ✗ unexpected error:', err);
      alert(`שגיאה ביצירת המקום: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const hasPhoto = placeData?.photoUrl || placeData?.photos?.[0];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" dir="rtl">
      <div className="bg-white w-full max-w-2xl rounded-t-3xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-gray-900">הוספת מקום חדש</h2>
          <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">

          {/* Google Maps URL field */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Link className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-blue-900">קישור Google Maps</p>
                <p className="text-xs text-blue-600">הדבק קישור לעסק והמידע יתמלא אוטומטית</p>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={googleMapsUrl}
                onChange={(e) => {
                  setGoogleMapsUrl(e.target.value);
                  if (fetchStatus !== 'idle') {
                    setFetchStatus('idle');
                    setFetchError('');
                  }
                }}
                placeholder="https://maps.app.goo.gl/..."
                className="flex-1 px-3 py-2.5 border border-blue-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                dir="ltr"
              />
              <button
                type="button"
                onClick={fetchPlaceFromGoogleMaps}
                disabled={fetchStatus === 'loading' || !googleMapsUrl.trim()}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0"
              >
                {fetchStatus === 'loading' ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  'טען'
                )}
              </button>
            </div>

            {fetchStatus === 'success' && placeData && (
              <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-3">
                {hasPhoto && (
                  <img
                    src={hasPhoto}
                    alt={placeData.placeName}
                    className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <p className="text-sm font-bold text-green-800 truncate">{placeData.placeName}</p>
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-2">{placeData.placeAddress}</p>
                  {placeData.rating && (
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xs font-bold text-amber-600">{placeData.rating.toFixed(1)}</span>
                      <span className="text-amber-400 text-xs">★</span>
                      {placeData.reviewCount && (
                        <span className="text-xs text-gray-500">({placeData.reviewCount.toLocaleString()} ביקורות)</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {fetchStatus === 'error' && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <p className="text-xs text-red-700">{fetchError}</p>
              </div>
            )}
          </div>

          {/* Place name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">שם המקום *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="שם המקום"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">הערה / תיאור (אופציונלי)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="הוסף הערה על המקום..."
              rows={2}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Country + City */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">מדינה *</label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                {Object.entries(COUNTRIES).map(([code, { name, flag }]) => (
                  <option key={code} value={code}>{flag} {name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">עיר</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="שם העיר"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Google Places info preview */}
          {placeData && (
            <div className="bg-gray-50 rounded-2xl p-4 space-y-2 border border-gray-200">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">מידע מ-Google Places</p>
              {placeData.placeAddress && (
                <div className="flex items-start gap-2 text-sm text-gray-700">
                  <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  <span>{placeData.placeAddress}</span>
                </div>
              )}
              {placeData.phone && (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span>{placeData.phone}</span>
                </div>
              )}
              {placeData.website && (
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <Globe className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{placeData.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
                </div>
              )}
              {placeData.types && placeData.types.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {placeData.types.slice(0, 4).map(t => (
                    <span key={t} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs capitalize">
                      {t.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Map picker */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <MapPin className="inline w-4 h-4 ml-1" />
              מיקום על המפה *
            </label>
            {!showMapPicker ? (
              <button
                type="button"
                onClick={getCurrentLocation}
                disabled={mapLoading}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Navigation className="w-5 h-5" />
                {mapLoading ? 'מאתר מיקום...' : 'בחר מיקום על המפה'}
              </button>
            ) : (
              <div className="space-y-2">
                <div ref={mapContainerRef} className="relative h-52 rounded-xl overflow-hidden border-2 border-blue-300" />
                <div className="flex gap-2">
                  <div className="flex-1 text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
                    <span className="font-semibold">קו רוחב:</span> {latitude?.toFixed(6)}
                  </div>
                  <div className="flex-1 text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
                    <span className="font-semibold">קו אורך:</span> {longitude?.toFixed(6)}
                  </div>
                </div>
                <p className="text-xs text-gray-400 text-center">לחץ על המפה או גרור את הסמן לדיוק</p>
                <button
                  type="button"
                  onClick={() => {
                    if (mapInstanceRef.current) {
                      mapInstanceRef.current.remove();
                      mapInstanceRef.current = null;
                    }
                    setShowMapPicker(false);
                    if (!placeData) {
                      setLatitude(null);
                      setLongitude(null);
                    }
                  }}
                  className="w-full px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  הסר מיקום
                </button>
              </div>
            )}
          </div>

          {/* Pin color */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              <Palette className="inline w-4 h-4 ml-1" />
              צבע הסמן על המפה
            </label>
            <div className="grid grid-cols-5 gap-3">
              {LOCATION_PIN_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setPinColor(color.value)}
                  className={`relative h-11 rounded-xl transition-all hover:scale-105 active:scale-95 ${
                    pinColor === color.value ? 'ring-4 ring-offset-2' : 'ring-2 ring-gray-200'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                >
                  {pinColor === color.value && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color.value }} />
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Emoji badge — WhatsApp-style picker */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">אימוג'י לסמן (אופציונלי)</label>

            {/* Selected emoji display */}
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 transition-all ${
                emoji ? 'bg-blue-50 ring-2 ring-blue-400' : 'bg-gray-100 border-2 border-dashed border-gray-300'
              }`}>
                {emoji || <span className="text-gray-300 text-base">?</span>}
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-xs text-gray-500">
                  {emoji ? 'אימוג׳י נבחר — יופיע על הסמן במפה' : 'לחץ על אימוג׳י כדי לבחור'}
                </p>
                {emoji && (
                  <button
                    type="button"
                    onClick={() => setEmoji('')}
                    className="text-xs text-red-400 hover:text-red-600 text-right w-fit"
                  >
                    הסר
                  </button>
                )}
              </div>
            </div>

            {/* Category tabs */}
            <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 scrollbar-none">
              {EMOJI_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setEmojiCategory(cat.id)}
                  className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl flex-shrink-0 transition-all ${
                    emojiCategory === cat.id
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <span className="text-lg leading-none">{cat.icon}</span>
                  <span className="text-[10px] font-medium leading-none">{cat.label}</span>
                </button>
              ))}
            </div>

            {/* Emoji grid */}
            <div className="grid grid-cols-7 gap-1.5">
              {EMOJI_CATEGORIES.find(c => c.id === emojiCategory)?.emojis.map(e => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={`h-11 flex items-center justify-center rounded-xl text-2xl transition-all active:scale-90 ${
                    emoji === e
                      ? 'bg-blue-100 ring-2 ring-blue-500 scale-110'
                      : 'bg-gray-100 hover:bg-gray-200 hover:scale-110'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Pin preview */}
          {hasPhoto && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">תצוגה מקדימה של הסמן</label>
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-8 flex items-center justify-center">
                <div dangerouslySetInnerHTML={{ __html: createLocationPinSVG(hasPhoto, pinColor, emoji || undefined).outerHTML }} />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'יוצר מקום...' : 'הוספת מקום'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-4 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
            >
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
