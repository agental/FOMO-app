import { useState, useEffect, useRef, useMemo } from 'react';
import { X, ChevronRight, Lock, Users, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getMeetupPinColor } from '../utils/meetupPinColor';
import { createMeetupPinSVG } from '../utils/createMeetupPin';
import { EmojiPickerSheet } from './EmojiPickerSheet';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface CreateMeetupFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  initialLocation?: { latitude: number; longitude: number };
}

/* 3 steps: 0 = emoji+text, 1 = location, 2 = date+privacy */
const STEP_LABELS = ['אמוג׳י וטקסט', 'מיקום', 'תאריך ופרטיות'];

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i < step ? 'bg-orange-500 w-6' : i === step ? 'bg-orange-400 w-8' : 'bg-gray-200 w-4'
          }`}
        />
      ))}
    </div>
  );
}

/* build a local date string "YYYY-MM-DD" without UTC shift */
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/* end of selected day in local time → ISO */
function endOfDayISO(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59).toISOString();
}

/* Hebrew short day names */
const HE_DAYS_SHORT = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export function CreateMeetupFlow({
  isOpen,
  onClose,
  onSuccess,
  userId,
  initialLocation,
}: CreateMeetupFlowProps) {
  const [step, setStep] = useState(0);

  /* Step 0 */
  const [selectedEmoji,  setSelectedEmoji]  = useState('☕');
  const [emojiSheetOpen, setEmojiSheetOpen] = useState(false);
  const [text,           setText]           = useState('');

  /* Step 1 */
  const [latitude,  setLatitude]  = useState<number | null>(initialLocation?.latitude  ?? null);
  const [longitude, setLongitude] = useState<number | null>(initialLocation?.longitude ?? null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<mapboxgl.Map | null>(null);
  const markerRef       = useRef<mapboxgl.Marker | null>(null);

  /* Step 2 — date only (today default), privacy */
  const todayStr = localDateStr(new Date());
  const [date,    setDate]    = useState(todayStr);
  const [privacy, setPrivacy] = useState<'open' | 'approval'>('open');

  /* UI state */
  const [submitting,  setSubmitting]  = useState(false);
  const [toast,       setToast]       = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [confetti,    setConfetti]    = useState<{
    id: number; x: number; color: string; size: number;
    delay: number; duration: number; shape: 'rect' | 'circle';
  }[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const pinPreviewRef = useRef<HTMLDivElement>(null);

  /* 8 selectable days: today + 7 ahead */
  const selectableDays = useMemo(() => (
    Array.from({ length: 8 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return d;
    })
  ), []);

  /* fetch avatar once */
  useEffect(() => {
    supabase.from('users').select('avatar_url').eq('id', userId).single()
      .then(({ data }) => { if (data?.avatar_url) setAvatarUrl(data.avatar_url); });
  }, [userId]);

  /* render pin preview on emoji/avatar change */
  useEffect(() => {
    if (!pinPreviewRef.current) return;
    pinPreviewRef.current.innerHTML = '';
    const pin = createMeetupPinSVG(selectedEmoji, avatarUrl);
    pin.style.animation = 'pinBounce 0.55s cubic-bezier(0.36,0.07,0.19,0.97) both';
    pin.style.transformOrigin = 'bottom center';
    pinPreviewRef.current.appendChild(pin);
  }, [selectedEmoji, avatarUrl, isOpen]);

  /* reset on open */
  useEffect(() => {
    if (isOpen) {
      setStep(0);
      setSelectedEmoji('☕');
      setEmojiSheetOpen(false);
      setText('');
      setLatitude(initialLocation?.latitude ?? null);
      setLongitude(initialLocation?.longitude ?? null);
      setDate(localDateStr(new Date()));
      setPrivacy('open');
    }
  }, [isOpen]);

  /* mount mini-map on step 1 */
  useEffect(() => {
    if (step !== 1 || !mapContainerRef.current || mapRef.current) return;
    const center: [number, number] = longitude && latitude
      ? [longitude, latitude]
      : [34.78, 32.08];
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center,
      zoom: 14,
    });
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    const startLat = latitude ?? center[1];
    const startLng = longitude ?? center[0];
    setLatitude(startLat);
    setLongitude(startLng);
    const marker = new mapboxgl.Marker({ color: '#FF9F43', draggable: true })
      .setLngLat([startLng, startLat])
      .addTo(map);
    marker.on('dragend', () => {
      const ll = marker.getLngLat();
      setLatitude(ll.lat);
      setLongitude(ll.lng);
    });
    map.on('click', (e) => {
      setLatitude(e.lngLat.lat);
      setLongitude(e.lngLat.lng);
      marker.setLngLat([e.lngLat.lng, e.lngLat.lat]);
    });
    mapRef.current   = map;
    markerRef.current = marker;
    return () => {
      map.remove();
      mapRef.current   = null;
      markerRef.current = null;
    };
  }, [step]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const triggerSuccess = () => {
    const COLORS = ['#FF6B6B','#FFD93D','#6BCB77','#4D96FF','#FF6FC8','#FF9F43','#A29BFE','#FD79A8'];
    const pieces = Array.from({ length: 70 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: COLORS[i % COLORS.length],
      size: 7 + Math.random() * 8,
      delay: Math.random() * 0.6,
      duration: 2.2 + Math.random() * 1.4,
      shape: (Math.random() > 0.5 ? 'rect' : 'circle') as 'rect' | 'circle',
    }));
    setConfetti(pieces);
    setShowSuccess(true);
    setTimeout(() => { setShowSuccess(false); setConfetti([]); }, 3800);
  };

  const handleSubmit = async () => {
    if (!latitude || !longitude || !text.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('meetups').insert({
        user_id:          userId,
        emoji:            selectedEmoji,
        text:             text.trim(),
        latitude,
        longitude,
        scheduled_at:     endOfDayISO(date),
        privacy,
        attendees:        [userId],
        pending_requests: [],
      });
      if (error) {
        showToast('שגיאה ביצירת הישיבה: ' + ((error as any)?.message ?? JSON.stringify(error)));
        return;
      }
      triggerSuccess();
      setTimeout(() => { onSuccess(); onClose(); }, 2200);
    } catch (err) {
      showToast('שגיאה ביצירת הישיבה: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const canNext =
    step === 0 ? text.trim().length > 0 :
    step === 1 ? !!latitude && !!longitude :
    true;

  const pinColor = getMeetupPinColor(selectedEmoji);

  return (
    <>
      {/* ── Confetti ── */}
      {confetti.map(p => (
        <div key={p.id} style={{
          position: 'fixed', top: -16, left: `${p.x}vw`,
          width:  p.shape === 'circle' ? p.size : p.size * 0.6,
          height: p.shape === 'circle' ? p.size : p.size * 1.4,
          borderRadius: p.shape === 'circle' ? '50%' : 3,
          background: p.color, zIndex: 300, pointerEvents: 'none',
          animation: `confettiFall ${p.duration}s ${p.delay}s cubic-bezier(0.25,0.46,0.45,0.94) forwards`,
        }} />
      ))}

      {/* ── Keyframes ── */}
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(0)   rotate(0deg)   scaleX(1);   opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg) scaleX(0.6); opacity: 0; }
        }
        @keyframes pinBounce {
          0%   { transform: scale(1)    translateY(0); }
          30%  { transform: scale(1.18) translateY(-14px); }
          55%  { transform: scale(0.94) translateY(5px); }
          75%  { transform: scale(1.06) translateY(-4px); }
          100% { transform: scale(1)    translateY(0); }
        }
      `}</style>

      {/* ── Success toast ── */}
      <div style={{
        position: 'fixed', top: 20, left: 0, right: 0, zIndex: 250,
        display: 'flex', justifyContent: 'center', padding: '0 20px',
        pointerEvents: showSuccess ? 'auto' : 'none',
        transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s',
        transform: showSuccess ? 'translateY(0)' : 'translateY(-140%)',
        opacity: showSuccess ? 1 : 0,
      }}>
        <div style={{
          background: '#fff', borderRadius: 14,
          boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
          display: 'flex', alignItems: 'center',
          maxWidth: 380, minWidth: 280, direction: 'rtl',
          width: '100%', overflow: 'hidden',
        }}>
          <div style={{ width: 5, alignSelf: 'stretch', background: '#22C55E', flexShrink: 0 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 14px 14px 12px', flex: 1 }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 700, margin: 0, color: '#1E293B' }}>הישיבה נוצרה בהצלחה!</p>
              <p style={{ fontSize: 12, margin: '2px 0 0', color: '#64748B' }}>הישיבה שלך נוספה למפה 🎉</p>
            </div>
            <button onClick={() => setShowSuccess(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 18, padding: 4 }}>×</button>
          </div>
        </div>
      </div>

      {/* ── Error toast ── */}
      <div style={{
        position: 'fixed', top: 20, left: 0, right: 0, zIndex: 200,
        display: 'flex', justifyContent: 'center', padding: '0 20px',
        pointerEvents: toast ? 'auto' : 'none',
        transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s',
        transform: toast ? 'translateY(0)' : 'translateY(-140%)',
        opacity: toast ? 1 : 0,
      }}>
        <div style={{
          background: '#fff', borderRadius: 14,
          boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
          display: 'flex', alignItems: 'center',
          maxWidth: 380, minWidth: 280, direction: 'rtl',
          width: '100%', overflow: 'hidden',
        }}>
          <div style={{ width: 5, alignSelf: 'stretch', background: '#EF4444', flexShrink: 0 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 14px 14px 12px', flex: 1 }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 700, margin: 0, color: '#1E293B' }}>שגיאה ביצירת הישיבה</p>
              <p style={{ fontSize: 12, margin: '2px 0 0', color: '#64748B' }}>{toast}</p>
            </div>
            <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 18, padding: 4 }}>×</button>
          </div>
        </div>
      </div>

      {/* ── Backdrop ── */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]" onClick={onClose} />

      {/* ── Main sheet ── */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-[60] flex flex-col"
        style={{ maxHeight: '92dvh' }}
        dir="rtl"
      >
        {/* Handle */}
        <div className="w-full pt-3 pb-1 flex justify-center flex-shrink-0">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 pb-3 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">ישיבה חדשה ☕</h2>
            <p className="text-xs text-gray-500 mt-0.5">{STEP_LABELS[step]}</p>
          </div>
          <div className="flex items-center gap-3">
            <StepIndicator step={step} total={3} />
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 pb-4">

          {/* ── STEP 0: Emoji + Description ── */}
          {step === 0 && (
            <div className="flex flex-col items-center gap-6 py-2">
              <button
                onClick={() => setEmojiSheetOpen(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                aria-label="בחר אמוג׳י"
              >
                <div style={{ width: 49 * 2.6, height: 54 * 2.6, position: 'relative', overflow: 'visible' }}>
                  <div ref={pinPreviewRef} style={{ transform: 'scale(2.6)', transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }} />
                </div>
                <div style={{ width: 60, height: 10, borderRadius: '50%', background: pinColor, opacity: 0.18, marginTop: -10 }} />
                <p style={{ fontSize: 13, color: '#9CA3AF', marginTop: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 15 }}>👆</span> לחץ לבחירת אמוג׳י
                </p>
              </button>

              <div className="w-full">
                <label className="block text-sm font-semibold text-gray-700 mb-2">תיאור קצר</label>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value.slice(0, 80))}
                  placeholder='למשל: "ישיבה ספונטנית בקפה, כולם מוזמנים"'
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 rounded-2xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50"
                />
                <p className="text-xs text-gray-400 text-left mt-1">{text.length}/80</p>
              </div>
            </div>
          )}

          {/* ── STEP 1: Location ── */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">לחץ על המפה או גרור את הסמן כדי לקבוע מיקום</p>
              <div ref={mapContainerRef} className="w-full rounded-2xl overflow-hidden border border-gray-200" style={{ height: 340 }} />
              {latitude && longitude && (
                <div className="flex gap-2 text-xs text-gray-500">
                  <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2">
                    <span className="font-semibold">קו רוחב: </span>{latitude.toFixed(5)}
                  </div>
                  <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2">
                    <span className="font-semibold">קו אורך: </span>{longitude.toFixed(5)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: Date + Privacy ── */}
          {step === 2 && (
            <div className="space-y-7 py-1">

              {/* ── Day picker ── */}
              <div>
                <p className="text-base font-bold text-gray-900 mb-4">מתי להיפגש?</p>

                {/* horizontal scroll — negative margin breaks out of px-5 padding */}
                <div
                  className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none"
                  style={{ marginLeft: -20, marginRight: -20, paddingLeft: 20, paddingRight: 20 }}
                >
                  {selectableDays.map((d, i) => {
                    const ds       = localDateStr(d);
                    const isToday  = i === 0;
                    const selected = date === ds;
                    const dayName  = isToday ? 'היום' : HE_DAYS_SHORT[d.getDay()];
                    const dayNum   = d.getDate();

                    return (
                      <button
                        key={ds}
                        onClick={() => setDate(ds)}
                        className="flex flex-col items-center justify-center flex-shrink-0 transition-all duration-200 active:scale-95"
                        style={{
                          width: 62,
                          height: 80,
                          borderRadius: 18,
                          background: selected ? '#F97316' : '#F3F4F6',
                          boxShadow: selected ? '0 6px 20px rgba(249,115,22,0.38)' : 'none',
                          border: 'none',
                          cursor: 'pointer',
                          gap: 4,
                        }}
                      >
                        <span style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: selected ? 'rgba(255,255,255,0.85)' : '#9CA3AF',
                          lineHeight: 1,
                        }}>
                          {dayName}
                        </span>
                        <span style={{
                          fontSize: 26,
                          fontWeight: 800,
                          color: selected ? '#fff' : '#111827',
                          lineHeight: 1,
                        }}>
                          {dayNum}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* selected date readable label */}
                <p className="text-xs text-gray-400 mt-3 text-center">
                  הישיבה מתוכננת ל{' '}
                  <span className="font-semibold text-orange-500">
                    {new Date(date + 'T12:00:00').toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </span>
                </p>
              </div>

              {/* ── Privacy ── */}
              <div>
                <p className="text-base font-bold text-gray-900 mb-4">מי יכול להצטרף?</p>

                <div className="grid grid-cols-2 gap-3">
                  {/* Open */}
                  <button
                    onClick={() => setPrivacy('open')}
                    className="relative flex flex-col items-center gap-3 p-5 rounded-3xl border-2 transition-all duration-200 active:scale-[0.97]"
                    style={{
                      borderColor: privacy === 'open' ? '#F97316' : '#E5E7EB',
                      background:  privacy === 'open' ? '#FFF7ED' : '#fff',
                      boxShadow:   privacy === 'open' ? '0 4px 20px rgba(249,115,22,0.20)' : '0 1px 4px rgba(0,0,0,0.05)',
                    }}
                  >
                    {privacy === 'open' && (
                      <div className="absolute top-3 left-3 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center"
                      style={{ background: privacy === 'open' ? '#F97316' : '#F3F4F6' }}
                    >
                      <Users className="w-7 h-7" style={{ color: privacy === 'open' ? '#fff' : '#9CA3AF' }} />
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-sm" style={{ color: privacy === 'open' ? '#EA580C' : '#111827' }}>
                        פתוח
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 leading-snug">כל אחד יכול להצטרף</p>
                    </div>
                  </button>

                  {/* Approval */}
                  <button
                    onClick={() => setPrivacy('approval')}
                    className="relative flex flex-col items-center gap-3 p-5 rounded-3xl border-2 transition-all duration-200 active:scale-[0.97]"
                    style={{
                      borderColor: privacy === 'approval' ? '#F97316' : '#E5E7EB',
                      background:  privacy === 'approval' ? '#FFF7ED' : '#fff',
                      boxShadow:   privacy === 'approval' ? '0 4px 20px rgba(249,115,22,0.20)' : '0 1px 4px rgba(0,0,0,0.05)',
                    }}
                  >
                    {privacy === 'approval' && (
                      <div className="absolute top-3 left-3 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center"
                      style={{ background: privacy === 'approval' ? '#F97316' : '#F3F4F6' }}
                    >
                      <Lock className="w-7 h-7" style={{ color: privacy === 'approval' ? '#fff' : '#9CA3AF' }} />
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-sm" style={{ color: privacy === 'approval' ? '#EA580C' : '#111827' }}>
                        פרטי
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 leading-snug">אישור נדרש להצטרפות</p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-5 pt-3 flex gap-3 flex-shrink-0 border-t border-gray-100"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
        >
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="px-5 py-4 bg-gray-100 text-gray-700 rounded-2xl font-semibold hover:bg-gray-200 transition-colors flex items-center gap-2"
            >
              <ChevronRight className="w-4 h-4" />
              חזור
            </button>
          )}

          {step < 2 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext}
              className="flex-1 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl font-bold hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-orange-200"
            >
              {step === 0 ? 'בחר מיקום ←' : 'קבע פרטים ←'}
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl font-bold hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-50 shadow-md shadow-orange-200"
            >
              {submitting ? 'יוצר ישיבה...' : '🗺️ הוסף למפה'}
            </button>
          )}
        </div>
      </div>

      <EmojiPickerSheet
        isOpen={emojiSheetOpen}
        onClose={() => setEmojiSheetOpen(false)}
        selectedEmoji={selectedEmoji}
        onSelect={setSelectedEmoji}
      />
    </>
  );
}
