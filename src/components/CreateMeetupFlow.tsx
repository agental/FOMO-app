import { useState, useEffect, useRef } from 'react';
import { X, ChevronRight, MapPin, Calendar, Lock, Users, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface CreateMeetupFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  initialLocation?: { latitude: number; longitude: number };
}

const EMOJI_GROUPS = [
  { label: 'פגישות', emojis: ['☕', '🍺', '🥂', '🍕', '🍔', '🌮', '🍜', '🥗', '🎂', '🧁'] },
  { label: 'פעילות', emojis: ['🏋️', '🏊', '⚽', '🏀', '🎾', '🚴', '🧘', '🏄', '🎯', '♟️'] },
  { label: 'טבע',   emojis: ['🏖️', '🏔️', '🌴', '🏕️', '🌊', '🌅', '🌿', '🦋', '🌺', '🌍'] },
  { label: 'תרבות', emojis: ['🎵', '🎬', '🎨', '🎭', '📖', '🕌', '⛪', '🕍', '🙏', '✡️'] },
  { label: 'שונות', emojis: ['🎉', '🔥', '💡', '🎮', '🛍️', '💬', '🤝', '❤️', '⭐', '🎁'] },
];

const STEP_LABELS = ['אמוג׳י וטקסט', 'מיקום', 'תאריך ושעה', 'פרטיות'];

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

export function CreateMeetupFlow({
  isOpen,
  onClose,
  onSuccess,
  userId,
  initialLocation,
}: CreateMeetupFlowProps) {
  const [step, setStep] = useState(0);

  /* Step 1 */
  const [selectedEmoji, setSelectedEmoji] = useState('☕');
  const [emojiGroup,    setEmojiGroup]    = useState(0);
  const [text,          setText]          = useState('');

  /* Step 2 */
  const [latitude,  setLatitude]  = useState<number | null>(initialLocation?.latitude  ?? null);
  const [longitude, setLongitude] = useState<number | null>(initialLocation?.longitude ?? null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<mapboxgl.Map | null>(null);
  const markerRef       = useRef<mapboxgl.Marker | null>(null);

  /* Step 3 */
  const todayStr = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(todayStr);
  const [time, setTime] = useState('20:00');

  /* Step 4 */
  const [privacy, setPrivacy] = useState<'open' | 'approval'>('open');

  const [submitting, setSubmitting] = useState(false);

  /* Reset when re-opened */
  useEffect(() => {
    if (isOpen) {
      setStep(0);
      setSelectedEmoji('☕');
      setEmojiGroup(0);
      setText('');
      setLatitude(initialLocation?.latitude ?? null);
      setLongitude(initialLocation?.longitude ?? null);
      setDate(todayStr);
      setTime('20:00');
      setPrivacy('open');
    }
  }, [isOpen]);

  /* Mount mini map on step 2 */
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

  const handleSubmit = async () => {
    if (!latitude || !longitude || !text.trim()) return;
    setSubmitting(true);
    try {
      const scheduledAt = new Date(`${date}T${time}:00`).toISOString();
      const { error } = await supabase.from('meetups').insert({
        user_id:      userId,
        emoji:        selectedEmoji,
        text:         text.trim(),
        latitude,
        longitude,
        scheduled_at: scheduledAt,
        privacy,
        attendees:        [userId],
        pending_requests: [],
      });
      if (error) {
        const msg = (error as any)?.message || JSON.stringify(error);
        alert('שגיאה ביצירת הישיבה: ' + msg);
        return;
      }
      onSuccess();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : (err as any)?.message || JSON.stringify(err);
      alert('שגיאה ביצירת הישיבה: ' + msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const canNext =
    step === 0 ? text.trim().length > 0 :
    step === 1 ? !!latitude && !!longitude :
    step === 2 ? !!date && !!time :
    true;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
        onClick={onClose}
      />
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
            <StepIndicator step={step} total={4} />
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

          {/* ── STEP 0: Emoji + Text ── */}
          {step === 0 && (
            <div className="space-y-5">
              {/* Emoji preview */}
              <div className="flex justify-center">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-200 flex items-center justify-center text-5xl shadow-inner">
                  {selectedEmoji}
                </div>
              </div>

              {/* Category tabs */}
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {EMOJI_GROUPS.map((g, i) => (
                  <button
                    key={i}
                    onClick={() => setEmojiGroup(i)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium flex-shrink-0 transition-all ${
                      emojiGroup === i
                        ? 'bg-orange-500 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>

              {/* Emoji grid */}
              <div className="grid grid-cols-5 gap-2">
                {EMOJI_GROUPS[emojiGroup].emojis.map(e => (
                  <button
                    key={e}
                    onClick={() => setSelectedEmoji(e)}
                    className={`h-14 text-3xl flex items-center justify-center rounded-2xl transition-all active:scale-90 ${
                      selectedEmoji === e
                        ? 'bg-orange-100 ring-2 ring-orange-400 scale-110'
                        : 'bg-gray-100 hover:bg-gray-200 hover:scale-105'
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>

              {/* Text input */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  תיאור קצר
                </label>
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
              <div
                ref={mapContainerRef}
                className="w-full rounded-2xl overflow-hidden border border-gray-200"
                style={{ height: 340 }}
              />
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

          {/* ── STEP 2: Date & Time ── */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="bg-orange-50 rounded-2xl p-5 flex items-center gap-4">
                <div className="text-5xl">{selectedEmoji}</div>
                <div>
                  <p className="font-semibold text-gray-800">{text}</p>
                  <p className="text-xs text-gray-500 mt-0.5">מתי נפגשים?</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-orange-500" /> תאריך
                </label>
                <input
                  type="date"
                  value={date}
                  min={todayStr}
                  onChange={e => setDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  🕐 שעה
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50"
                  dir="ltr"
                />
              </div>
            </div>
          )}

          {/* ── STEP 3: Privacy ── */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-orange-50 rounded-2xl p-4 flex items-center gap-3">
                <span className="text-3xl">{selectedEmoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{text}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(`${date}T${time}`).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}
                    {' · '}{time}
                  </p>
                </div>
              </div>

              <p className="text-sm font-semibold text-gray-700">מי יכול להצטרף?</p>

              {/* Open */}
              <button
                onClick={() => setPrivacy('open')}
                className={`w-full p-5 rounded-2xl border-2 transition-all text-right flex items-start gap-4 ${
                  privacy === 'open'
                    ? 'border-orange-400 bg-orange-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  privacy === 'open' ? 'bg-orange-500' : 'bg-gray-100'
                }`}>
                  <Users className={`w-5 h-5 ${privacy === 'open' ? 'text-white' : 'text-gray-500'}`} />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900">הצטרפות חופשית</p>
                  <p className="text-sm text-gray-500 mt-0.5">כל אחד יכול להצטרף מיד ולהיכנס לצ׳אט הקבוצתי</p>
                </div>
                {privacy === 'open' && (
                  <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
              </button>

              {/* Approval */}
              <button
                onClick={() => setPrivacy('approval')}
                className={`w-full p-5 rounded-2xl border-2 transition-all text-right flex items-start gap-4 ${
                  privacy === 'approval'
                    ? 'border-orange-400 bg-orange-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  privacy === 'approval' ? 'bg-orange-500' : 'bg-gray-100'
                }`}>
                  <Lock className={`w-5 h-5 ${privacy === 'approval' ? 'text-white' : 'text-gray-500'}`} />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900">אישור נדרש</p>
                  <p className="text-sm text-gray-500 mt-0.5">בקשות ממתינות לאישורך לפני כניסה לצ׳אט</p>
                </div>
                {privacy === 'approval' && (
                  <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-6 pt-3 flex gap-3 flex-shrink-0 border-t border-gray-100">
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="px-5 py-4 bg-gray-100 text-gray-700 rounded-2xl font-semibold hover:bg-gray-200 transition-colors flex items-center gap-2"
            >
              <ChevronRight className="w-4 h-4" />
              חזור
            </button>
          )}

          {step < 3 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext}
              className="flex-1 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl font-bold hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-orange-200"
            >
              {step === 0 ? 'בחר מיקום ←' : step === 1 ? 'קבע תאריך ←' : 'בחר פרטיות ←'}
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl font-bold hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-50 shadow-md shadow-orange-200"
            >
              {submitting ? 'יוצר ישיבה...' : '✨ צור ישיבה'}
            </button>
          )}
        </div>
      </div>
    </>
  );
}