import { useState, useEffect, useRef } from 'react';
import { Calendar, MapPin, Users, Image as ImageIcon, X, Navigation, Plus, Minus, Clock, ChevronLeft, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { COUNTRIES } from '../utils/countries';
import { EmojiPickerSheet } from './EmojiPickerSheet';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

type CreateEventFormProps = {
  onSuccess: () => void;
  onCancel: () => void;
  currentUserId?: string | null;
  userCountries?: string[];
};

const EVENT_COLORS = [
  { id: 'orange', hex: '#F97316' },
  { id: 'blue',   hex: '#3B82F6' },
  { id: 'green',  hex: '#22C55E' },
  { id: 'purple', hex: '#A855F7' },
  { id: 'pink',   hex: '#EC4899' },
  { id: 'red',    hex: '#EF4444' },
  { id: 'yellow', hex: '#EAB308' },
  { id: 'teal',   hex: '#14B8A6' },
];

const EVENT_TYPES = [
  { id: 'parties',   label: 'מסיבות', emoji: '🎉' },
  { id: 'treks',     label: 'טרקים',  emoji: '🏕️' },
  { id: 'food',      label: 'אוכל',   emoji: '🍔' },
  { id: 'sports',    label: 'ספורט',  emoji: '🏄' },
  { id: 'workshops', label: 'סדנאות', emoji: '🧘' },
];

const EMOJI_OPTIONS: Record<string, string[]> = {
  parties:   ['🎉', '🥳', '🎊', '🪩', '🍾', '🎈', '🎵', '💃'],
  treks:     ['🏕️', '⛺', '🥾', '🏔️', '🌲', '🌄', '🗻', '🧗'],
  food:      ['🍔', '🍕', '🍜', '🍣', '🥗', '🍰', '☕', '🍺'],
  sports:    ['🏄', '⚽', '🏀', '🎾', '🏊', '🚴', '🧘', '💪'],
  workshops: ['🧘', '🎨', '📚', '💡', '🎸', '📷', '✍️', '🧠'],
};

const TOTAL_STEPS = 4;
const STEP_TITLES = ['זהות האירוע', 'כותרת ותיאור', 'מיקום', 'תאריך ופרטים'];

/* slide direction variants */
const slide = (dir: number) => ({
  initial: { x: dir * 60, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit:    { x: dir * -60, opacity: 0 },
});

export function CreateEventForm({ onSuccess, onCancel, currentUserId, userCountries }: CreateEventFormProps) {
  const [step, setStep] = useState(0);
  const [dir,  setDir]  = useState(1); // 1=forward, -1=back

  /* shared state */
  const [selectedEmoji, setSelectedEmoji] = useState('🎉');
  const [selectedColor, setSelectedColor] = useState(EVENT_COLORS[0].hex);
  const [eventType,     setEventType]     = useState('');
  const [emojiSheetOpen, setEmojiSheetOpen] = useState(false);

  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [imageFile,   setImageFile]   = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');

  const [country, setCountry] = useState('');
  const [city,    setCity]    = useState('');
  const [address, setAddress] = useState('');
  const [latitude,  setLatitude]  = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [showMap,   setShowMap]   = useState(false);
  const [mapLoading, setMapLoading] = useState(false);

  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [capacity,  setCapacity]  = useState(20);
  const [submitting, setSubmitting] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef  = useRef<mapboxgl.Map | null>(null);
  const markRef = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    setCountry(userCountries?.[0] ?? 'IL');
  }, [userCountries]);

  useEffect(() => {
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';
    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    if (!showMap || !mapContainerRef.current || !latitude || !longitude || mapRef.current) return;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [longitude, latitude], zoom: 14,
    });
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    const marker = new mapboxgl.Marker({ color: selectedColor, draggable: true })
      .setLngLat([longitude, latitude]).addTo(map);
    marker.on('dragend', () => { const l = marker.getLngLat(); setLatitude(l.lat); setLongitude(l.lng); });
    map.on('click', e => { setLatitude(e.lngLat.lat); setLongitude(e.lngLat.lng); marker.setLngLat([e.lngLat.lng, e.lngLat.lat]); });
    mapRef.current = map; markRef.current = marker;
  }, [showMap, latitude, longitude]);

  const goNext = () => { setDir(1); setStep(s => s + 1); };
  const goBack = () => { setDir(-1); setStep(s => s - 1); };

  const canNext = () => {
    if (step === 0) return true; // emoji/color always ok
    if (step === 1) return title.trim().length > 0 && description.trim().length > 0;
    if (step === 2) return city.trim().length > 0;
    return eventDate !== '' && eventTime !== '';
  };

  const grabLocation = () => {
    setMapLoading(true);
    navigator.geolocation?.getCurrentPosition(
      pos => { setLatitude(pos.coords.latitude); setLongitude(pos.coords.longitude); setShowMap(true); setMapLoading(false); },
      ()  => { setLatitude(32.0853); setLongitude(34.7818); setShowMap(true); setMapLoading(false); }
    ) ?? (() => { setLatitude(32.0853); setLongitude(34.7818); setShowMap(true); setMapLoading(false); })();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImageFile(file);
    const r = new FileReader(); r.onloadend = () => setImagePreview(r.result as string); r.readAsDataURL(file);
  };

  const uploadImage = async (file: File) => {
    const ext = file.name.split('.').pop();
    const name = `${Math.random().toString(36).slice(2)}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('images').upload(name, file);
    if (error) return null;
    return supabase.storage.from('images').getPublicUrl(name).data.publicUrl;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      let imageUrl: string | null = null;
      if (imageFile) { imageUrl = await uploadImage(imageFile); if (!imageUrl) { alert('שגיאה בהעלאת התמונה'); return; } }
      const { error } = await supabase.from('events').insert({
        user_id: currentUserId || '00000000-0000-0000-0000-000000000001',
        title, description, country, city, address: address || null, image_url: imageUrl,
        event_date: new Date(`${eventDate}T${eventTime}`).toISOString(),
        event_type: eventType, emoji: selectedEmoji, color: selectedColor,
        attendees: [], max_attendees: capacity, latitude, longitude,
      });
      if (error) alert(`שגיאה: ${error.message}`);
      else { alert('האירוע נוצר בהצלחה! 🎉'); onSuccess(); }
    } catch { alert('שגיאה ביצירת האירוע.'); }
    finally { setSubmitting(false); }
  };

  const accent = selectedColor;

  /* ── step progress dots ── */
  const StepDots = () => (
    <div className="flex items-center gap-1.5 justify-center">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <motion.div
          key={i}
          animate={{ width: i === step ? 20 : 6, opacity: i <= step ? 1 : 0.3 }}
          transition={{ type: 'spring', damping: 20 }}
          className="h-1.5 rounded-full"
          style={{ background: i <= step ? accent : '#C7C7CC' }}
        />
      ))}
    </div>
  );

  return (
    <>
      {/* backdrop */}
      <motion.div
        className="fixed inset-0 z-50"
        style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onCancel}
      />

      {/* sheet */}
      <motion.div
        className="fixed inset-x-0 bottom-0 z-[51] flex flex-col"
        style={{ maxHeight: '92dvh', borderRadius: '28px 28px 0 0', background: '#F2F2F7' }}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        dir="rtl"
      >
        {/* drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-9 h-[4px] rounded-full bg-[#C7C7CC]" />
        </div>

        {/* header */}
        <div className="flex items-center justify-between px-5 pt-1 pb-3 flex-shrink-0">
          <button
            onClick={step === 0 ? onCancel : goBack}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.07)' }}
          >
            {step === 0
              ? <X className="w-4 h-4 text-[#3C3C43]" />
              : <ChevronLeft className="w-4 h-4 text-[#3C3C43]" />
            }
          </button>

          <div className="flex flex-col items-center gap-1">
            <p className="text-[11px] font-medium text-[#8E8E93]">
              שלב {step + 1} מתוך {TOTAL_STEPS}
            </p>
            <StepDots />
          </div>

          <div className="w-8" />
        </div>

        {/* step title */}
        <AnimatePresence mode="wait">
          <motion.p
            key={step}
            className="text-center text-[20px] font-bold text-[#1C1C1E] mb-4 px-5 flex-shrink-0"
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            {STEP_TITLES[step]}
          </motion.p>
        </AnimatePresence>

        {/* step body */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4">
          <AnimatePresence mode="wait" initial={false}>

            {/* ── STEP 0 — זהות ── */}
            {step === 0 && (
              <motion.div key="s0" {...slide(dir)} transition={{ type: 'spring', damping: 28, stiffness: 280 }}>

                {/* emoji pin */}
                <div className="flex flex-col items-center py-5">
                  <motion.button type="button" onClick={() => setEmojiSheetOpen(true)} whileTap={{ scale: 0.90 }} className="relative">
                    <div className="absolute inset-0 rounded-full blur-2xl opacity-35" style={{ background: accent, transform: 'scale(1.5)' }} />
                    <div className="relative w-28 h-28 rounded-full flex items-center justify-center shadow-xl" style={{ background: `linear-gradient(145deg, ${accent}dd, ${accent})` }}>
                      <span className="text-6xl">{selectedEmoji}</span>
                    </div>
                    <div className="absolute -bottom-1 -left-1 w-9 h-9 rounded-full border-[3px] border-[#F2F2F7] flex items-center justify-center shadow" style={{ background: accent }}>
                      <span className="text-[15px]">✏️</span>
                    </div>
                  </motion.button>
                  <p className="mt-3 text-[13px] text-[#8E8E93]">לחץ לבחירת אימוג׳י</p>
                </div>

                {/* color */}
                <div className="bg-white rounded-[20px] p-4 mb-4 shadow-sm border border-black/[0.05]">
                  <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-3">צבע האירוע</p>
                  <div className="flex justify-between">
                    {EVENT_COLORS.map(c => (
                      <motion.button key={c.id} type="button" whileTap={{ scale: 0.82 }} onClick={() => setSelectedColor(c.hex)}
                        className="relative w-10 h-10 rounded-full shadow-sm flex items-center justify-center"
                        style={{ background: c.hex, boxShadow: selectedColor === c.hex ? `0 0 0 3px white, 0 0 0 5px ${c.hex}` : undefined }}>
                        {selectedColor === c.hex && <Check className="w-5 h-5 text-white" strokeWidth={3} />}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* event type */}
                <div className="bg-white rounded-[20px] p-4 mb-4 shadow-sm border border-black/[0.05]">
                  <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-3">סוג האירוע</p>
                  <div className="grid grid-cols-3 gap-2">
                    {EVENT_TYPES.map(t => (
                      <motion.button key={t.id} type="button" whileTap={{ scale: 0.92 }}
                        onClick={() => { setEventType(t.id); setSelectedEmoji(EMOJI_OPTIONS[t.id][0]); }}
                        className="flex flex-col items-center gap-1 py-3 rounded-[14px] text-[13px] font-medium transition-all"
                        style={eventType === t.id
                          ? { background: accent, color: 'white', boxShadow: `0 4px 14px ${accent}55` }
                          : { background: '#F2F2F7', color: '#3C3C43' }}>
                        <span className="text-[26px]">{t.emoji}</span>
                        <span>{t.label}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* quick emoji suggestions if type chosen */}
                {eventType && (
                  <div className="bg-white rounded-[20px] p-4 mb-4 shadow-sm border border-black/[0.05]">
                    <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-3">אימוג׳י מהיר</p>
                    <div className="flex gap-2 flex-wrap">
                      {EMOJI_OPTIONS[eventType].map(e => (
                        <motion.button key={e} type="button" whileTap={{ scale: 0.85 }}
                          onClick={() => setSelectedEmoji(e)}
                          className="w-12 h-12 text-2xl rounded-[12px] flex items-center justify-center border transition-all"
                          style={selectedEmoji === e
                            ? { background: accent, borderColor: accent, boxShadow: `0 4px 12px ${accent}40` }
                            : { background: '#F2F2F7', borderColor: 'transparent' }}>
                          {e}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

              </motion.div>
            )}

            {/* ── STEP 1 — כותרת ותיאור ── */}
            {step === 1 && (
              <motion.div key="s1" {...slide(dir)} transition={{ type: 'spring', damping: 28, stiffness: 280 }}>

                {/* preview chip */}
                <div className="flex items-center gap-3 bg-white rounded-[16px] px-4 py-3 mb-4 shadow-sm border border-black/[0.05]">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `linear-gradient(135deg, ${accent}cc, ${accent})` }}>
                    <span className="text-xl">{selectedEmoji}</span>
                  </div>
                  <div>
                    <p className="text-[12px] text-[#8E8E93]">תצוגה מקדימה של הסמל</p>
                    <p className="text-[13px] font-semibold text-[#1C1C1E]">{eventType ? EVENT_TYPES.find(t => t.id === eventType)?.label : 'ללא קטגוריה'}</p>
                  </div>
                </div>

                {/* title */}
                <div className="bg-white rounded-[20px] mb-4 shadow-sm border border-black/[0.05] overflow-hidden">
                  <div className="px-4 pt-4 pb-1">
                    <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-2">כותרת האירוע *</p>
                    <input
                      type="text" value={title} onChange={e => setTitle(e.target.value)}
                      placeholder="למשל: טיול לים בתל אביב"
                      className="w-full text-[18px] font-semibold text-[#1C1C1E] placeholder-[#D1D1D6] bg-transparent outline-none pb-3"
                      autoFocus
                    />
                  </div>
                </div>

                {/* description */}
                <div className="bg-white rounded-[20px] mb-4 shadow-sm border border-black/[0.05]">
                  <div className="px-4 pt-4 pb-3">
                    <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-2">תיאור *</p>
                    <textarea
                      value={description} onChange={e => setDescription(e.target.value)}
                      placeholder="פרט על האירוע — מה צפוי, מה להביא, לכולם או לסגורים..."
                      rows={5}
                      className="w-full text-[15px] text-[#1C1C1E] placeholder-[#C7C7CC] bg-transparent outline-none resize-none leading-relaxed"
                    />
                  </div>
                </div>

                {/* image (optional here) */}
                <div className="bg-white rounded-[20px] mb-4 shadow-sm border border-black/[0.05]">
                  <label className="block cursor-pointer">
                    {imagePreview ? (
                      <div className="relative rounded-[20px] overflow-hidden">
                        <img src={imagePreview} alt="Preview" className="w-full h-44 object-cover" />
                        <button type="button" onClick={e => { e.preventDefault(); setImageFile(null); setImagePreview(''); }}
                          className="absolute top-3 right-3 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center backdrop-blur-sm">
                          <X className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-4">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${accent}18` }}>
                          <ImageIcon className="w-5 h-5" style={{ color: accent }} />
                        </div>
                        <div>
                          <p className="text-[15px] font-medium" style={{ color: accent }}>הוסף תמונה לאירוע</p>
                          <p className="text-[12px] text-[#8E8E93]">אופציונלי · JPG, PNG</p>
                        </div>
                      </div>
                    )}
                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  </label>
                </div>

              </motion.div>
            )}

            {/* ── STEP 2 — מיקום ── */}
            {step === 2 && (
              <motion.div key="s2" {...slide(dir)} transition={{ type: 'spring', damping: 28, stiffness: 280 }}>

                {/* country + city */}
                <div className="bg-white rounded-[20px] mb-4 shadow-sm border border-black/[0.05] overflow-hidden">
                  <div className="px-4 py-3 border-b border-black/[0.06]">
                    <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-1.5">מדינה</p>
                    <select value={country} onChange={e => setCountry(e.target.value)}
                      className="w-full text-[16px] text-[#1C1C1E] bg-transparent outline-none">
                      {Object.entries(COUNTRIES).map(([code, { name, flag }]) => (
                        <option key={code} value={code}>{flag} {name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="px-4 py-3 border-b border-black/[0.06]">
                    <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-1.5">עיר *</p>
                    <input type="text" value={city} onChange={e => setCity(e.target.value)}
                      placeholder="תל אביב" autoFocus
                      className="w-full text-[16px] text-[#1C1C1E] placeholder-[#C7C7CC] bg-transparent outline-none" />
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-1.5">כתובת מדויקת</p>
                    <input type="text" value={address} onChange={e => setAddress(e.target.value)}
                      placeholder="רחוב בן יהודה 123 (אופציונלי)"
                      className="w-full text-[16px] text-[#1C1C1E] placeholder-[#C7C7CC] bg-transparent outline-none" />
                  </div>
                </div>

                {/* map picker */}
                <div className="bg-white rounded-[20px] mb-4 shadow-sm border border-black/[0.05] overflow-hidden">
                  {!showMap ? (
                    <motion.button type="button" onClick={grabLocation} disabled={mapLoading}
                      whileTap={{ scale: 0.97 }}
                      className="w-full flex items-center gap-3 px-4 py-4 disabled:opacity-50">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${accent}18` }}>
                        <Navigation className="w-5 h-5" style={{ color: accent }} />
                      </div>
                      <div className="text-right">
                        <p className="text-[15px] font-medium" style={{ color: accent }}>
                          {mapLoading ? 'מאתר מיקום...' : 'סמן על המפה'}
                        </p>
                        <p className="text-[12px] text-[#8E8E93]">אופציונלי · לחץ לבחירת מיקום מדויק</p>
                      </div>
                    </motion.button>
                  ) : (
                    <div>
                      <div ref={mapContainerRef} className="h-52" />
                      <div className="flex items-center justify-between px-4 py-2 border-t border-black/[0.06]">
                        <span className="text-[12px] text-[#8E8E93]">📍 {latitude?.toFixed(4)}, {longitude?.toFixed(4)}</span>
                        <button type="button" onClick={() => { mapRef.current?.remove(); mapRef.current = null; setShowMap(false); setLatitude(null); setLongitude(null); }}
                          className="text-[13px] text-red-500 font-medium">הסר</button>
                      </div>
                    </div>
                  )}
                </div>

              </motion.div>
            )}

            {/* ── STEP 3 — תאריך ופרטים ── */}
            {step === 3 && (
              <motion.div key="s3" {...slide(dir)} transition={{ type: 'spring', damping: 28, stiffness: 280 }}>

                {/* date + time */}
                <div className="bg-white rounded-[20px] mb-4 shadow-sm border border-black/[0.05] overflow-hidden">
                  <div className="px-4 py-3 border-b border-black/[0.06]">
                    <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Calendar size={11} /> תאריך *
                    </p>
                    <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)}
                      className="w-full text-[16px] text-[#1C1C1E] bg-transparent outline-none" required />
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Clock size={11} /> שעה *
                    </p>
                    <input type="time" value={eventTime} onChange={e => setEventTime(e.target.value)}
                      className="w-full text-[16px] text-[#1C1C1E] bg-transparent outline-none" required />
                  </div>
                </div>

                {/* capacity stepper */}
                <div className="bg-white rounded-[20px] mb-4 shadow-sm border border-black/[0.05]">
                  <div className="px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: `${accent}18` }}>
                        <Users className="w-4 h-4" style={{ color: accent }} />
                      </div>
                      <div>
                        <p className="text-[15px] font-medium text-[#1C1C1E]">מספר משתתפים</p>
                        <p className="text-[12px] text-[#8E8E93]">מקסימום לאירוע</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <motion.button type="button" whileTap={{ scale: 0.82 }}
                        onClick={() => setCapacity(c => Math.max(1, c - 1))}
                        className="w-9 h-9 rounded-full flex items-center justify-center shadow-sm border border-black/[0.08]"
                        style={{ background: `${accent}15` }}>
                        <Minus className="w-4 h-4" style={{ color: accent }} />
                      </motion.button>
                      <motion.span
                        key={capacity}
                        initial={{ scale: 1.3 }} animate={{ scale: 1 }}
                        className="text-[20px] font-bold text-[#1C1C1E] w-9 text-center tabular-nums">
                        {capacity}
                      </motion.span>
                      <motion.button type="button" whileTap={{ scale: 0.82 }}
                        onClick={() => setCapacity(c => c + 1)}
                        className="w-9 h-9 rounded-full flex items-center justify-center shadow-sm border border-black/[0.08]"
                        style={{ background: `${accent}15` }}>
                        <Plus className="w-4 h-4" style={{ color: accent }} />
                      </motion.button>
                    </div>
                  </div>
                </div>

                {/* summary card */}
                <div className="bg-white rounded-[20px] mb-6 shadow-sm border border-black/[0.05] overflow-hidden">
                  <div className="px-4 py-3 border-b border-black/[0.06]">
                    <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-2">סיכום</p>
                  </div>
                  <div className="px-4 py-3 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-[14px] flex items-center justify-center flex-shrink-0" style={{ background: `linear-gradient(135deg, ${accent}cc, ${accent})` }}>
                      <span className="text-2xl">{selectedEmoji}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[16px] font-semibold text-[#1C1C1E] truncate">{title || '...'}</p>
                      <p className="text-[13px] text-[#8E8E93] truncate">{city ? `📍 ${city}` : '📍 ...'} {eventDate ? `· 📅 ${new Date(eventDate).toLocaleDateString('he-IL')}` : ''}</p>
                    </div>
                  </div>
                </div>

                {/* submit */}
                <motion.button type="button" onClick={handleSubmit} disabled={!canNext() || submitting}
                  whileTap={{ scale: 0.97 }}
                  className="w-full py-4 rounded-[20px] text-white text-[17px] font-bold mb-3 disabled:opacity-50"
                  style={{ background: `linear-gradient(135deg, ${accent}, ${accent}bb)`, boxShadow: `0 8px 28px ${accent}45` }}>
                  {submitting ? 'יוצר אירוע...' : `${selectedEmoji} צור אירוע`}
                </motion.button>

                <button type="button" onClick={onCancel}
                  className="w-full py-3 rounded-[20px] text-[15px] font-medium text-[#8E8E93] bg-white border border-black/[0.06] mb-8">
                  ביטול
                </button>

              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* bottom next button (steps 0-2) */}
        {step < 3 && (
          <div className="flex-shrink-0 px-4 pb-8 pt-3 border-t border-black/[0.06]" style={{ background: '#F2F2F7' }}>
            <motion.button
              type="button"
              onClick={goNext}
              disabled={!canNext()}
              whileTap={{ scale: 0.97 }}
              className="w-full py-4 rounded-[20px] text-white text-[17px] font-bold disabled:opacity-40"
              style={{ background: canNext() ? `linear-gradient(135deg, ${accent}, ${accent}bb)` : '#C7C7CC', boxShadow: canNext() ? `0 8px 24px ${accent}40` : 'none' }}
            >
              המשך
            </motion.button>
          </div>
        )}
      </motion.div>

      <EmojiPickerSheet
        isOpen={emojiSheetOpen}
        onClose={() => setEmojiSheetOpen(false)}
        selectedEmoji={selectedEmoji}
        onSelect={e => setSelectedEmoji(e)}
      />
    </>
  );
}
