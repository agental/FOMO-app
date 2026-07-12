import { useState, useEffect, useRef } from 'react';
import { MapPin, X, Navigation, Phone, Globe, Link, Loader, CircleCheck as CheckCircle, CircleAlert as AlertCircle, Upload, Star, Camera, Clock, Smile, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { COUNTRIES } from '../utils/countries';
import { createPlacePinSVG } from '../utils/createLocationPin';
import { placePinColor, PLACE_COLORS } from '../utils/placePinColor';
import { EmojiPickerSheet } from './EmojiPickerSheet';
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

export function CreateLocationForm({ onSuccess, onCancel, currentUserId }: CreateLocationFormProps) {
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>('idle');
  const [fetchError, setFetchError] = useState('');
  const [placeData, setPlaceData] = useState<PlaceData | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [country, setCountry] = useState('TH');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [manualRating, setManualRating] = useState<number>(0);
  const [emoji, setEmoji] = useState('📍');
  const [emojiSheetOpen, setEmojiSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // the pin colour is derived from the chosen emoji (so colour + icon always match)
  // pick a colour from the palette; picking an emoji suggests its colour, which can be overridden
  const [pinColor, setPinColor] = useState<string>(placePinColor('📍'));
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);

  // Opening hours
  const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const defaultHours = () => Object.fromEntries(
    Array.from({ length: 7 }, (_, i) => [i, { open: '09:00', close: '22:00', closed: i === 6 }])
  );
  const [hoursEnabled, setHoursEnabled] = useState(false);
  const [openingHours, setOpeningHours] = useState<Record<string, { open: string; close: string; closed: boolean }>>(defaultHours());

  const toggleDayClosed = (day: number) => {
    setOpeningHours(prev => ({ ...prev, [day]: { ...prev[day], closed: !prev[day].closed } }));
  };
  const updateHours = (day: number, field: 'open' | 'close', value: string) => {
    setOpeningHours(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
  };

  // Image upload
  // The place's photo gallery — seeded from Google, plus anything the admin uploads.
  // photos[0] is the cover (image_url / place_photo_url); the whole array goes to place_photos.
  const [photos, setPhotos] = useState<string[]>([]);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      // seed the gallery with Google's photos (admin can still add / remove / re-cover)
      const googlePhotos = place.photos?.length ? place.photos : (place.photoUrl ? [place.photoUrl] : []);
      if (googlePhotos.length) setPhotos(prev => [...prev, ...googlePhotos.filter(u => !prev.includes(u))]);

      setName(place.placeName || '');
      if (place.city) setCity(place.city);
      if (place.latitude) setLatitude(place.latitude);
      if (place.longitude) setLongitude(place.longitude);
      if (place.latitude && place.longitude) setShowMapPicker(true);
      if (place.phone) setPhone(place.phone);
      if (place.rating) setManualRating(place.rating);

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

  /**
   * Centre the picker on the ADMIN'S ACTUAL LOCATION.
   *
   * `navigator.geolocation` does not work inside the iOS WebView, so it always failed and dropped
   * the pin on the old Bangkok fallback. The real position comes from the wrapper's native bridge
   * (expo-location → `window._nativeLocation` + a `nativeLocation` event), same as MapScreen.
   * There is no hard-coded fallback any more — if we genuinely can't locate, we say so.
   */
  const getCurrentLocation = () => {
    setMapLoading(true);
    let done = false;

    const apply = (lat: number, lng: number) => {
      if (done) return;
      done = true;
      window.removeEventListener('nativeLocation', onNative as EventListener);
      setLatitude(lat);
      setLongitude(lng);
      setShowMapPicker(true);
      setMapLoading(false);
    };

    const onNative = (e: any) => {
      const { lat, lng } = e?.detail || {};
      if (lat != null && !isNaN(lat)) apply(lat, lng);
    };

    // 1) already injected by the native bridge (the usual case in the app)
    const cached = (window as any)._nativeLocation;
    if (cached?.lat != null && !isNaN(cached.lat)) { apply(cached.lat, cached.lng); return; }

    // 2) it may arrive a moment later
    window.addEventListener('nativeLocation', onNative as EventListener);

    // 3) browser geolocation — works on desktop/web, silently fails in the iOS WebView
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => apply(pos.coords.latitude, pos.coords.longitude),
        () => { /* keep waiting for the native event */ },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    }

    // 4) give up honestly instead of pretending the place is in Bangkok
    setTimeout(() => {
      if (done) return;
      done = true;
      window.removeEventListener('nativeLocation', onNative as EventListener);
      setMapLoading(false);
      alert('לא הצלחנו לאתר את המיקום שלך. אשר הרשאת מיקום, או הדבק קישור Google Maps כדי למלא את המיקום אוטומטית.');
    }, 12000);
  };

  /** Upload one or many images and append them to the gallery. */
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    setImageError('');
    setImageUploading(true);
    const uploaded: string[] = [];

    try {
      for (const file of files) {
        if (!file.type.startsWith('image/')) { setImageError('אפשר להעלות קבצי תמונה בלבד'); continue; }
        if (file.size > 5 * 1024 * 1024) { setImageError(`"${file.name}" גדולה מדי (מקסימום 5MB)`); continue; }

        const ext = file.name.split('.').pop();
        const key = `locations/${currentUserId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('images')
          .upload(key, file, { cacheControl: '3600', upsert: false });
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(key);
        uploaded.push(publicUrl);
      }
      if (uploaded.length) setPhotos(prev => [...prev, ...uploaded]);
    } catch (err: any) {
      setImageError(err.message || 'שגיאה בהעלאת התמונה');
    } finally {
      setImageUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = ''; // let the same file be picked again
    }
  };

  const removePhoto = (i: number) => setPhotos(prev => prev.filter((_, idx) => idx !== i));
  /** Promote a photo to the cover (photos[0] is what the map pin / cards / list show). */
  const makeCover = (i: number) => setPhotos(prev => [prev[i], ...prev.filter((_, idx) => idx !== i)]);

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

      const photoUrl = photos[0] ?? null; // the cover
      const emojiValue = emoji.trim() || '📍';
      const finalRating = manualRating > 0 ? manualRating : (placeData?.rating ?? null);

      const corePayload: Record<string, unknown> = {
        name,
        country:    finalCountry,
        latitude:   latitude!,
        longitude:  longitude!,
        pin_color:  `${pinColor}|${emojiValue}`,
        created_by: currentUserId,
        description:    description || null,
        city:           city || placeData?.city || null,
        address:        placeData?.placeAddress || null,
        phone:          phone || placeData?.phone || null,
        email:          null as null,
        website:        placeData?.website || null,
        image_url:      photoUrl,
        google_place_id:    placeData?.placeId || null,
        place_name:         placeData?.placeName || null,
        place_address:      placeData?.placeAddress || null,
        place_rating:       finalRating,
        place_review_count: placeData?.reviewCount ?? null,
        place_photo_url:    photoUrl,
        place_photos:       photos.length ? photos : null,
        place_phone:        phone || placeData?.phone || null,
        place_website:      placeData?.website || null,
        place_types:        placeData?.types || null,
        place_open_now:     placeData?.openNow ?? null,
        google_maps_url:    googleMapsUrl.trim() || null,
        opening_hours:      hoursEnabled ? openingHours : null,
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

  const displayImage = photos[0];

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
                {fetchStatus === 'loading' ? <Loader className="w-4 h-4 animate-spin" /> : 'טען'}
              </button>
            </div>

            {fetchStatus === 'success' && placeData && (
              <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-3">
                {displayImage && (
                  <img src={displayImage} alt={placeData.placeName} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
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

          {/* Photo gallery — multiple images; photos[0] is the cover */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <Camera className="inline w-4 h-4 ml-1" />
              תמונות המקום
              {photos.length > 0 && <span className="text-gray-400 font-normal"> ({photos.length})</span>}
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageSelect}
              className="hidden"
            />

            {photos.length === 0 ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={imageUploading}
                className="w-full h-36 border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-blue-400 hover:bg-blue-50 transition-all disabled:opacity-50"
              >
                {imageUploading ? (
                  <Loader className="w-6 h-6 text-blue-500 animate-spin" />
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-gray-400" />
                    <span className="text-sm text-gray-500 font-medium">לחץ להעלאת תמונות</span>
                    <span className="text-xs text-gray-400">אפשר לבחור כמה בבת אחת · עד 5MB לתמונה</span>
                  </>
                )}
              </button>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((url, i) => (
                  <div key={url} className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-100" style={{ aspectRatio: '1 / 1' }}>
                    <img src={url} alt="" className="w-full h-full object-cover" />

                    {/* remove */}
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      aria-label="הסר תמונה"
                      className="absolute top-1 left-1 w-6 h-6 rounded-full bg-black/55 backdrop-blur flex items-center justify-center active:scale-90 transition-transform"
                    >
                      <X className="w-3.5 h-3.5 text-white" strokeWidth={2.6} />
                    </button>

                    {/* cover badge / make-cover */}
                    {i === 0 ? (
                      <span className="absolute bottom-1 right-1 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow">
                        ראשית
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => makeCover(i)}
                        className="absolute bottom-1 right-1 bg-white/90 backdrop-blur text-gray-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow active:scale-90 transition-transform"
                      >
                        הפוך לראשית
                      </button>
                    )}
                  </div>
                ))}

                {/* add more */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={imageUploading}
                  className="border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-1 hover:border-blue-400 hover:bg-blue-50 transition-all disabled:opacity-50"
                  style={{ aspectRatio: '1 / 1' }}
                >
                  {imageUploading ? (
                    <Loader className="w-5 h-5 text-blue-500 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-6 h-6 text-gray-400" />
                      <span className="text-[11px] text-gray-500 font-medium">הוסף</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {photos.length > 0 && (
              <p className="text-xs text-gray-400 mt-1.5">
                התמונה הראשית מוצגת בפין ובכרטיסים. כל התמונות יופיעו בגלריה של המקום.
              </p>
            )}
            {imageError && <p className="text-red-500 text-xs mt-1">{imageError}</p>}
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

          {/* Phone */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <Phone className="inline w-4 h-4 ml-1" />
              טלפון (אופציונלי)
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+66 2 123 4567"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              dir="ltr"
            />
          </div>

          {/* Rating */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <Star className="inline w-4 h-4 ml-1" />
              דירוג (אופציונלי)
            </label>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setManualRating(manualRating === star ? 0 : star)}
                    className="transition-all hover:scale-110 active:scale-90"
                  >
                    <Star
                      className={`w-8 h-8 ${star <= manualRating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`}
                    />
                  </button>
                ))}
              </div>
              {manualRating > 0 && (
                <span className="text-sm font-bold text-amber-600 mr-1">{manualRating}.0</span>
              )}
              {manualRating > 0 && (
                <button
                  type="button"
                  onClick={() => setManualRating(0)}
                  className="text-xs text-gray-400 hover:text-red-400 transition-colors"
                >
                  נקה
                </button>
              )}
            </div>
          </div>

          {/* Opening hours */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                <Clock className="w-4 h-4" />
                שעות פתיחה
              </label>
              <button
                type="button"
                onClick={() => setHoursEnabled(v => !v)}
                className={`relative w-12 h-6 rounded-full transition-colors ${hoursEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${hoursEnabled ? 'right-1' : 'left-1'}`} />
              </button>
            </div>

            {hoursEnabled && (
              <div className="bg-gray-50 rounded-2xl p-3 space-y-2 border border-gray-200">
                {DAY_NAMES.map((dayName, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-sm text-gray-700 w-14 flex-shrink-0 font-medium">{dayName}</span>
                    <button
                      type="button"
                      onClick={() => toggleDayClosed(i)}
                      className={`text-xs font-bold px-2.5 py-1 rounded-lg flex-shrink-0 transition-colors ${
                        openingHours[i]?.closed
                          ? 'bg-red-100 text-red-600 hover:bg-red-200'
                          : 'bg-green-100 text-green-600 hover:bg-green-200'
                      }`}
                    >
                      {openingHours[i]?.closed ? 'סגור' : 'פתוח'}
                    </button>
                    {!openingHours[i]?.closed && (
                      <>
                        <input
                          type="time"
                          value={openingHours[i]?.open || '09:00'}
                          onChange={(e) => updateHours(i, 'open', e.target.value)}
                          className="flex-1 text-sm border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        <span className="text-gray-400 text-xs">—</span>
                        <input
                          type="time"
                          value={openingHours[i]?.close || '22:00'}
                          onChange={(e) => updateHours(i, 'close', e.target.value)}
                          className="flex-1 text-sm border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
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

          {/* Place icon + colour — pick an emoji, then a colour from the palette */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <Smile className="inline w-4 h-4 ml-1" />
              אייקון וצבע המקום
            </label>
            <div
              className="rounded-2xl p-4 border border-gray-200"
              style={{ background: `linear-gradient(135deg, ${pinColor}18, ${pinColor}06)` }}
            >
              <div className="flex items-center gap-4">
                {/* live pin preview (exactly how it appears on the map) */}
                <div className="flex items-center justify-center flex-shrink-0" style={{ width: 66, height: 80 }}>
                  <div
                    style={{ transform: 'scale(1.7)', transformOrigin: 'center bottom' }}
                    dangerouslySetInnerHTML={{ __html: createPlacePinSVG(emoji || '📍', pinColor).outerHTML }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setEmojiSheetOpen(true)}
                  className="flex-1 py-3 rounded-xl font-bold text-white transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  style={{ background: pinColor, boxShadow: `0 6px 18px ${pinColor}55` }}
                >
                  <span className="text-lg leading-none">{emoji || '📍'}</span>
                  בחר אימוג׳י
                </button>
              </div>

              {/* colour palette — pick any colour (starts on the emoji's suggested colour) */}
              <p className="text-xs font-semibold text-gray-600 mt-4 mb-2">צבע הפין</p>
              <div className="flex flex-wrap gap-2.5">
                {PLACE_COLORS.map((c) => {
                  const active = pinColor.toLowerCase() === c.toLowerCase();
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setPinColor(c)}
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

      <EmojiPickerSheet
        isOpen={emojiSheetOpen}
        onClose={() => setEmojiSheetOpen(false)}
        selectedEmoji={emoji}
        onSelect={(e) => { setEmoji(e); setPinColor(placePinColor(e)); }}
      />
    </div>
  );
}