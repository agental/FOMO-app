import { useState, useEffect, useRef } from 'react';
import { Star, MapPin, Image as ImageIcon, X, Navigation, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { COUNTRIES } from '../utils/countries';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

type CreatePostFormProps = {
  onSuccess: () => void;
  onCancel: () => void;
  currentUserId: string;
  defaultCountry?: string;
};

const CATEGORIES = [
  { id: 'מסעדה',  emoji: '🍽️' },
  { id: 'בר',     emoji: '🍸' },
  { id: 'קפה',    emoji: '☕' },
  { id: 'אטרקציה', emoji: '🎡' },
  { id: 'חנות',   emoji: '🛍️' },
  { id: 'טבע',    emoji: '🌿' },
  { id: 'אחר',    emoji: '📍' },
];

export function CreatePostForm({ onSuccess, onCancel, currentUserId, defaultCountry }: CreatePostFormProps) {
  const [placeName, setPlaceName] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [country, setCountry] = useState(defaultCountry || 'IL');
  const [city, setCity] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';
    return () => { mapInstanceRef.current?.remove(); mapInstanceRef.current = null; };
  }, []);

  useEffect(() => {
    if (!showMap || !mapContainerRef.current || latitude == null || longitude == null || mapInstanceRef.current) return;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [longitude, latitude], zoom: 13,
    });
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    const marker = new mapboxgl.Marker({ color: '#F97316', draggable: true }).setLngLat([longitude, latitude]).addTo(map);
    marker.on('dragend', () => { const ll = marker.getLngLat(); setLatitude(ll.lat); setLongitude(ll.lng); });
    map.on('click', (e) => { setLatitude(e.lngLat.lat); setLongitude(e.lngLat.lng); marker.setLngLat(e.lngLat); });
    mapInstanceRef.current = map; markerRef.current = marker;
  }, [showMap, latitude, longitude]);

  const pickLocation = () => {
    setMapLoading(true);
    const open = (lat: number, lng: number) => { setLatitude(lat); setLongitude(lng); setShowMap(true); setMapLoading(false); };
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (p) => open(p.coords.latitude, p.coords.longitude),
        () => open(32.0853, 34.7818),
      );
    } else open(32.0853, 34.7818);
  };

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
    if (!placeName.trim() || !content.trim()) { alert('אנא מלאו שם מקום ותיאור ההמלצה'); return; }
    setSubmitting(true);
    try {
      let imageUrl: string | null = null;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
        if (!imageUrl) { alert('שגיאה בהעלאת התמונה. נסו שוב או בלי תמונה.'); setSubmitting(false); return; }
      }
      const { error } = await supabase.from('posts').insert({
        user_id: currentUserId,
        content: content.trim(),
        place_name: placeName.trim(),
        image_url: imageUrl,
        country,
        city: city.trim() || null,
        latitude, longitude,
        tags: category ? [category] : [],
      });
      if (error) throw error;
      onSuccess();
    } catch (err: any) {
      console.error('Create post error:', err);
      alert(`שגיאה בשמירת ההמלצה${err?.message ? ': ' + err.message : ''}`);
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = 'w-full px-4 py-3 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] transition bg-gray-50 focus:bg-white';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end justify-center z-50" dir="rtl" onClick={onCancel}>
      <div className="bg-white w-full max-w-2xl rounded-t-3xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#FFF7ED' }}>
              <Star className="w-4 h-4" style={{ color: '#F97316' }} strokeWidth={2.4} />
            </div>
            <h2 className="text-xl font-black text-gray-900" style={{ fontFamily: 'Heebo, sans-serif' }}>המלצה חדשה</h2>
          </div>
          <button onClick={onCancel} aria-label="סגור" className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 active:scale-95 transition">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Place name */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2" style={{ fontFamily: 'Heebo, sans-serif' }}>שם המקום *</label>
            <input type="text" value={placeName} onChange={(e) => setPlaceName(e.target.value)} required
              placeholder="למשל: מסעדת הדייגים" className={inputCls} style={{ fontFamily: 'Rubik, sans-serif' }} />
          </div>

          {/* Recommendation text */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2" style={{ fontFamily: 'Heebo, sans-serif' }}>מה אהבת שם? *</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} required rows={3}
              placeholder="ספרו בקצרה למה כדאי לבקר — אווירה, אוכל, נוף..." className={`${inputCls} resize-none`} style={{ fontFamily: 'Rubik, sans-serif' }} />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2" style={{ fontFamily: 'Heebo, sans-serif' }}>קטגוריה</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(c => {
                const sel = category === c.id;
                return (
                  <button key={c.id} type="button" onClick={() => setCategory(sel ? '' : c.id)} aria-pressed={sel}
                    className="px-3.5 py-2 rounded-full text-sm font-bold transition active:scale-95"
                    style={{
                      fontFamily: 'Heebo, sans-serif',
                      background: sel ? 'linear-gradient(135deg, #F97316, #EA580C)' : '#F3F4F6',
                      color: sel ? '#fff' : '#6B7280',
                    }}>
                    {c.emoji} {c.id}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Country + city */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2" style={{ fontFamily: 'Heebo, sans-serif' }}>מדינה *</label>
              <select value={country} onChange={(e) => setCountry(e.target.value)} required className={inputCls} style={{ fontFamily: 'Rubik, sans-serif' }}>
                {Object.entries(COUNTRIES).map(([code, { name, flag }]) => (
                  <option key={code} value={code}>{flag} {name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2" style={{ fontFamily: 'Heebo, sans-serif' }}>עיר</label>
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="תל אביב" className={inputCls} style={{ fontFamily: 'Rubik, sans-serif' }} />
            </div>
          </div>

          {/* Location on map */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2" style={{ fontFamily: 'Heebo, sans-serif' }}>
              <MapPin className="inline w-4 h-4 ml-1" style={{ color: '#F97316' }} /> מיקום על המפה
            </label>
            {!showMap ? (
              <button type="button" onClick={pickLocation} disabled={mapLoading}
                className="w-full px-4 py-3 rounded-2xl font-bold text-white transition active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', fontFamily: 'Heebo, sans-serif' }}>
                <Navigation className="w-5 h-5" /> {mapLoading ? 'מאתר מיקום...' : 'בחר מיקום על המפה'}
              </button>
            ) : (
              <div className="space-y-2">
                <div ref={mapContainerRef} className="relative h-56 rounded-2xl overflow-hidden border-2" style={{ borderColor: '#FDBA74' }} />
                <p className="text-xs text-gray-500 text-center" style={{ fontFamily: 'Rubik, sans-serif' }}>לחצו על המפה או גררו את הסמן</p>
              </div>
            )}
          </div>

          {/* Photo */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2" style={{ fontFamily: 'Heebo, sans-serif' }}>
              <ImageIcon className="inline w-4 h-4 ml-1" style={{ color: '#F97316' }} /> תמונה
            </label>
            <input type="file" accept="image/*" onChange={handleImageChange}
              className="w-full text-sm file:ml-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-[#FFF7ED] file:text-[#EA580C]" />
            {imagePreview && <img src={imagePreview} alt="תצוגה מקדימה" className="mt-3 w-full h-44 object-cover rounded-2xl" />}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={submitting}
              className="flex-1 h-14 rounded-2xl font-black text-white transition active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', boxShadow: '0 8px 24px rgba(249,115,22,0.35)', fontFamily: 'Heebo, sans-serif' }}>
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {submitting ? 'מפרסם...' : 'פרסם המלצה'}
            </button>
            <button type="button" onClick={onCancel} className="px-6 h-14 rounded-2xl font-bold bg-gray-100 text-gray-600 active:scale-95 transition" style={{ fontFamily: 'Heebo, sans-serif' }}>
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
