import { useState, useEffect, useRef, useCallback } from 'react';
import { X, MapPin, Lock, Users, Upload, ChevronLeft, Check, Tag, Plus, Trash2, Landmark } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import mapboxgl from 'mapbox-gl';
import confetti from 'canvas-confetti';
import { EventService } from '../services/eventService';
import { reverseGeocode } from '../utils/geocoding';
import { joinEventGroup } from '../utils/eventGroup';
import type { TicketType } from '../types/event';
import { SellerOnboardingSheet } from './SellerOnboardingSheet';
import { getMySellerAccount, isSellerReady, type SellerAccount } from '../services/paymentService';

interface MapCreateEventFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (createdEvent?: Record<string, any>) => void;
  userId: string;
  initialLocation?: { latitude: number; longitude: number };
  defaultCountry?: string;
  existingEvent?: Record<string, any>; // edit mode — pre-fills all fields
}

type FlowStep = 1 | 2 | 3 | 4;

/** Editable ticket row (price kept as a string while typing). */
type TicketDraft = { id: string; name: string; price: string };
const newTicketId = () => Math.random().toString(36).slice(2, 9);
const freshTicket = (name = ''): TicketDraft => ({ id: newTicketId(), name, price: '' });

const EVENT_TYPES = [
  { id: 'parties',   label: 'מסיבות',   emoji: '🎉', color: '#7C3AED' },
  { id: 'sports',    label: 'אטרקציות', emoji: '🎡', color: '#0EA5E9' },
  { id: 'treks',     label: 'טיולים',   emoji: '🏕️', color: '#22C55E' },
  { id: 'workshops', label: 'סדנאות',   emoji: '🧘', color: '#FACC15' },
];

const SUGGESTED_IMAGES: Record<string, string[]> = {
  parties: [
    'https://images.pexels.com/photos/1190298/pexels-photo-1190298.jpeg?auto=compress&cs=tinysrgb&w=400',
    'https://images.pexels.com/photos/787961/pexels-photo-787961.jpeg?auto=compress&cs=tinysrgb&w=400',
    'https://images.pexels.com/photos/1540406/pexels-photo-1540406.jpeg?auto=compress&cs=tinysrgb&w=400',
  ],
  sports: [
    'https://images.pexels.com/photos/2884867/pexels-photo-2884867.jpeg?auto=compress&cs=tinysrgb&w=400',
    'https://images.pexels.com/photos/784916/pexels-photo-784916.jpeg?auto=compress&cs=tinysrgb&w=400',
    'https://images.pexels.com/photos/331990/pexels-photo-331990.jpeg?auto=compress&cs=tinysrgb&w=400',
  ],
  treks: [
    'https://images.pexels.com/photos/1365425/pexels-photo-1365425.jpeg?auto=compress&cs=tinysrgb&w=400',
    'https://images.pexels.com/photos/417173/pexels-photo-417173.jpeg?auto=compress&cs=tinysrgb&w=400',
    'https://images.pexels.com/photos/1526000/pexels-photo-1526000.jpeg?auto=compress&cs=tinysrgb&w=400',
  ],
  workshops: [
    'https://images.pexels.com/photos/1181406/pexels-photo-1181406.jpeg?auto=compress&cs=tinysrgb&w=400',
    'https://images.pexels.com/photos/3184418/pexels-photo-3184418.jpeg?auto=compress&cs=tinysrgb&w=400',
    'https://images.pexels.com/photos/373545/pexels-photo-373545.jpeg?auto=compress&cs=tinysrgb&w=400',
  ],
};

const DAYS_HE = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2,'0')}:00`);

function getNextDays(count: number) {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now); d.setDate(now.getDate() + i);
    return {
      value: d.toISOString().split('T')[0],
      dayLabel: i === 0 ? 'היום' : i === 1 ? 'מחר' : DAYS_HE[d.getDay()],
      num: d.getDate(),
      month: d.getMonth() + 1,
    };
  });
}

export function MapCreateEventFlow({ isOpen, onClose, onSuccess, userId, initialLocation, defaultCountry, existingEvent }: MapCreateEventFlowProps) {
  const isEditMode = !!existingEvent;
  const [step, setStep] = useState<FlowStep>(1);
  const [dir, setDir]   = useState(1);

  /* step 1 */
  const [eventType,     setEventType]     = useState('parties');
  const [selectedEmoji, setSelectedEmoji] = useState('🎉');
  const [description,   setDescription]   = useState('');
  const [title,         setTitle]         = useState('');

  /* step 2 */
  const [latitude,       setLatitude]       = useState<number|null>(initialLocation?.latitude||null);
  const [longitude,      setLongitude]      = useState<number|null>(initialLocation?.longitude||null);
  const [locationName,   setLocationName]   = useState('');
  const [detectedCity,   setDetectedCity]   = useState<string|null>(null);
  const [detectedCountry,setDetectedCountry]= useState<string|null>(null);

  /* step 3 */
  const [selectedDay,  setSelectedDay]  = useState('');
  const [selectedTime, setSelectedTime] = useState('20:00');

  /* step 4 */
  const [maxAttendees,  setMaxAttendees]  = useState(20);
  const [noLimit,       setNoLimit]       = useState(false);
  const [isPaid,        setIsPaid]        = useState(false);
  const [ticketTypes,   setTicketTypes]   = useState<TicketDraft[]>([freshTicket('כרטיס רגיל')]);
  const [sellerAccount, setSellerAccount] = useState<SellerAccount | null>(null);
  const [showSellerSheet, setShowSellerSheet] = useState(false);
  const [createGroup,   setCreateGroup]   = useState(false);
  const [imageUrl,      setImageUrl]      = useState('');
  const [imageFile,     setImageFile]     = useState<File|null>(null);
  const [imagePreview,  setImagePreview]  = useState('');
  const [uploadingImage,  setUploadingImage]   = useState(false);
  const [moderatingImage, setModeratingImage]  = useState(false);
  const [imageError,      setImageError]       = useState('');
  const [submitting,      setSubmitting]       = useState(false);
  const [showSuccess,     setShowSuccess]      = useState(false);
  const [createdEvent,    setCreatedEvent]     = useState<Record<string, any> | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<mapboxgl.Map|null>(null);
  const markerRef       = useRef<mapboxgl.Marker|null>(null);
  const fileInputRef    = useRef<HTMLInputElement>(null);

  const days        = getNextDays(10);
  const currentType = EVENT_TYPES.find(t => t.id === eventType) || EVENT_TYPES[0];
  const accent      = currentType.color;

  useEffect(() => {
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';
    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  // Load the organizer's payout account the first time they enable paid tickets, so the status
  // card + the publish gate know whether they can already receive money.
  useEffect(() => {
    if (!isPaid || !userId || sellerAccount) return;
    getMySellerAccount(userId).then(setSellerAccount);
  }, [isPaid, userId, sellerAccount]);

  const sellerReady = isSellerReady(sellerAccount);

  // Pre-fill fields when opening in edit mode
  useEffect(() => {
    if (!isOpen || !existingEvent) return;
    setTitle(existingEvent.title || '');
    setDescription(existingEvent.description || '');
    setSelectedEmoji(existingEvent.emoji || '🎉');
    setEventType(existingEvent.event_type || 'parties');
    setLatitude(existingEvent.latitude ?? null);
    setLongitude(existingEvent.longitude ?? null);
    setLocationName(existingEvent.address || existingEvent.city || '');
    setDetectedCity(existingEvent.city || null);
    setDetectedCountry(existingEvent.country || null);
    setMaxAttendees(existingEvent.max_attendees >= 9999 ? 9999 : (existingEvent.max_attendees || 20));
    setNoLimit(existingEvent.max_attendees >= 9999);
    const existingTickets = (existingEvent.ticket_types as TicketType[] | undefined) || [];
    if (existingTickets.length > 0) {
      setIsPaid(true);
      setTicketTypes(existingTickets.map(t => ({ id: t.id || newTicketId(), name: t.name, price: String(t.price) })));
    } else if (existingEvent.price > 0) {
      setIsPaid(true);
      setTicketTypes([{ id: newTicketId(), name: 'כרטיס רגיל', price: String(existingEvent.price) }]);
    } else {
      setIsPaid(false);
      setTicketTypes([freshTicket('כרטיס רגיל')]);
    }
    setCreateGroup(!!existingEvent.has_group);
    setImageUrl(existingEvent.image_url || '');
    setImagePreview(existingEvent.image_url || '');
    // Parse event_date to day + time
    if (existingEvent.event_date) {
      const d = new Date(existingEvent.event_date);
      setSelectedDay(d.toISOString().split('T')[0]);
      setSelectedTime(`${String(d.getHours()).padStart(2,'0')}:00`);
    }
  }, [isOpen, existingEvent]);

  // init map once when component opens — map container is always in DOM
  useEffect(() => {
    if (!isOpen) return;
    if (mapRef.current) return;
    if (!mapContainerRef.current) return;

    const fallbackLat = initialLocation?.latitude || 32.0853;
    const fallbackLng = initialLocation?.longitude || 34.7818;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [fallbackLng, fallbackLat],
      zoom: 14,
    });
    map.addControl(new mapboxgl.NavigationControl(), 'top-left');
    const marker = new mapboxgl.Marker({ color: accent, draggable: true })
      .setLngLat([fallbackLng, fallbackLat]).addTo(map);

    setLatitude(fallbackLat); setLongitude(fallbackLng);

    const update = async (la: number, lo: number) => {
      setLatitude(la); setLongitude(lo);
      const r = await reverseGeocode(la, lo);
      setLocationName(r.address || `${la.toFixed(4)}, ${lo.toFixed(4)}`);
      setDetectedCity(r.city); setDetectedCountry(r.countryCode);
    };

    const safeUpdate = (la: number, lo: number) => update(la, lo).catch(e => console.error('[MapCreateEventFlow] reverseGeocode failed:', e));
    marker.on('dragend', () => { const l = marker.getLngLat(); safeUpdate(l.lat, l.lng); });
    map.on('click', e => { marker.setLngLat([e.lngLat.lng, e.lngLat.lat]); safeUpdate(e.lngLat.lat, e.lngLat.lng); });
    map.once('load', () => {
      map.resize();
      // fly to user location after map loads
      navigator.geolocation?.getCurrentPosition(
        pos => {
          const la = pos.coords.latitude, lo = pos.coords.longitude;
          map.flyTo({ center: [lo, la], zoom: 15, duration: 1200 });
          marker.setLngLat([lo, la]);
          safeUpdate(la, lo);
        },
        () => safeUpdate(fallbackLat, fallbackLng),
        { timeout: 8000, maximumAge: 60000 }
      );
    });

    mapRef.current = map; markerRef.current = marker;
  }, [isOpen]);

  const go = useCallback((next: FlowStep, d = 1) => { setDir(d); setStep(next); }, []);

  const handleNext = () => {
    if (step === 1 && title.trim()) go(2);
    else if (step === 2 && latitude && longitude) go(3);
    else if (step === 3 && selectedDay && selectedTime) go(4);
  };
  const handleBack = () => {
    if (step === 2) go(1, -1);
    else if (step === 3) go(2, -1);
    else if (step === 4) go(3, -1);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';

    setImageError('');
    setImageFile(null);
    setImagePreview('');

    // Show a quick preview from the raw file first
    const rawUrl = URL.createObjectURL(file);
    setImagePreview(rawUrl);

    // Compress + moderate before accepting
    setModeratingImage(true);
    try {
      // We import these indirectly through EventService — trigger compression check
      // by calling the same canvas path. For now validate client-side min-dimension:
      const img = new Image();
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error('לא ניתן לקרוא את התמונה'));
        img.src = rawUrl;
      });
      if (img.naturalWidth < 400 || img.naturalHeight < 400) {
        throw new Error(`התמונה קטנה מדי (${img.naturalWidth}×${img.naturalHeight}px). בחר תמונה באיכות גבוהה יותר.`);
      }
      setImageFile(file);
      setImageUrl('');
    } catch (err: any) {
      setImagePreview('');
      setImageFile(null);
      setImageError(err?.message || 'התמונה אינה מתאימה, בחר אחרת.');
    } finally {
      URL.revokeObjectURL(rawUrl);
      setModeratingImage(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedDay || !selectedTime || !latitude || !longitude) {
      alert('חסרים פרטים — ודא שבחרת מיקום, תאריך ושעה.');
      return;
    }
    // The map only shows future events, so block past dates with a clear message
    // instead of "creating" an event that silently never appears.
    if (new Date(`${selectedDay}T${selectedTime}`).getTime() < Date.now()) {
      alert('מועד האירוע כבר עבר — בחר תאריך ושעה עתידיים.');
      return;
    }
    // Paid event → the organizer must have a connected payout account before publishing,
    // otherwise the ticket money would have nowhere to land. Open the connect sheet instead.
    const hasPaidTickets = isPaid && ticketTypes.some(t => Number(t.price) > 0);
    if (hasPaidTickets && !sellerReady) {
      setShowSellerSheet(true);
      return;
    }
    setSubmitting(true);
    try {
      let finalImage: string | null = null;
      if (imageFile) {
        setUploadingImage(true);
        try {
          finalImage = await EventService.uploadEventImage(userId, imageFile);
        } catch (imgErr: any) {
          setUploadingImage(false);
          setSubmitting(false);
          alert(imgErr?.message || 'שגיאה בהעלאת התמונה. נסה שוב או בחר תמונה אחרת.');
          return;
        }
        setUploadingImage(false);
      } else if (imageUrl) {
        finalImage = imageUrl;
      }
      // Build the ticket types from the editor rows (only rows with a real price count).
      const validTickets: TicketType[] = isPaid
        ? ticketTypes
            .map(t => ({ id: t.id, name: t.name.trim() || 'כרטיס', price: Number(t.price) }))
            .filter(t => Number.isFinite(t.price) && t.price > 0)
        : [];
      // `price` stays the entry (lowest) price so event cards keep showing a value.
      const entryPrice = validTickets.length ? Math.min(...validTickets.map(t => t.price)) : null;

      const payload = {
        title, description: description || title,
        emoji: selectedEmoji, event_type: eventType,
        latitude, longitude,
        city: detectedCity || locationName || 'Unknown',
        address: locationName || undefined,
        country: detectedCountry || defaultCountry || undefined,
        event_date: new Date(`${selectedDay}T${selectedTime}`).toISOString(),
        is_private: true, max_attendees: noLimit ? 9999 : maxAttendees,
        image_url: finalImage || imageUrl || existingEvent?.image_url || undefined,
        price: entryPrice,
        ticket_types: validTickets,
        has_group: createGroup,
      };

      let result: Record<string, any>;
      if (isEditMode && existingEvent?.id) {
        result = await EventService.updateEvent(existingEvent.id, payload);
      } else {
        const created = await EventService.createEvent({ user_id: userId, ...payload });
        if (!created) throw new Error('שגיאה בשמירת האירוע בשרת');
        result = created;
      }
      // If the organizer turned on a group, create its channel + add themselves as a member.
      if (createGroup && result?.id) {
        try { await joinEventGroup(result as { id: string }); }
        catch (e) { console.error('[MapCreateEventFlow] create event group failed:', e); }
      }
      setCreatedEvent(result);
      setShowSuccess(true);
      if (!isEditMode) launchConfetti();
    } catch (err: any) { alert(err?.message || (isEditMode ? 'שגיאה בעדכון האירוע' : 'שגיאה ביצירת האירוע')); }
    finally { setSubmitting(false); }
  };

  const launchConfetti = () => {
    const colors = ['#F97316', '#FB923C', '#FCD34D', '#34D399', '#60A5FA', '#F472B6', '#A78BFA'];
    // burst from center
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.55 }, colors, startVelocity: 45, gravity: 0.9, scalar: 1.1 });
    // side cannons
    setTimeout(() => confetti({ particleCount: 60, angle: 60,  spread: 55, origin: { x: 0, y: 0.6 }, colors }), 200);
    setTimeout(() => confetti({ particleCount: 60, angle: 120, spread: 55, origin: { x: 1, y: 0.6 }, colors }), 200);
    setTimeout(() => confetti({ particleCount: 40, spread: 100, origin: { y: 0.3 }, colors, startVelocity: 20 }), 500);
  };

  const handleSuccessDone = () => {
    if (createdEvent) onSuccess(createdEvent);
    setShowSuccess(false);
    setCreatedEvent(null);
    handleClose();
  };

  const handleClose = () => {
    mapRef.current?.remove(); mapRef.current = null;
    setStep(1); setTitle(''); setDescription(''); setSelectedEmoji('🎉'); setEventType('parties');
    setSelectedDay(''); setSelectedTime('20:00'); setMaxAttendees(20);
    setIsPaid(false); setTicketTypes([freshTicket('כרטיס רגיל')]); setCreateGroup(false);
    setImageUrl(''); setImageFile(null); setImagePreview(''); setLocationName('');
    setDetectedCountry(null); setLatitude(initialLocation?.latitude||null); setLongitude(initialLocation?.longitude||null);
    onClose();
  };

  const activeImageUrl = imagePreview || imageUrl || SUGGESTED_IMAGES[eventType]?.[0] || '';
  const STEP_TITLES: Record<number, string> = { 1: 'איזה אירוע?', 2: 'איפה?', 3: 'מתי?', 4: 'פרטים אחרונים' };

  if (!isOpen) return null;

  const canContinue =
    (step === 1 && title.trim().length > 0) ||
    (step === 2 && !!latitude && !!longitude) ||
    (step === 3 && !!selectedDay && !!selectedTime) ||
    step === 4;

  return (
    <>
      {/* ── Success overlay ── */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            dir="rtl"
          >
            <motion.div
              className="flex flex-col items-center gap-5 px-8 text-center"
              initial={{ scale: 0.7, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 22, delay: 0.05 }}
            >
              {/* big emoji + pulse ring */}
              <div className="relative">
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{ background: 'radial-gradient(circle, #F9731660, transparent 70%)' }}
                  animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <motion.div
                  className="w-28 h-28 rounded-full flex items-center justify-center text-6xl shadow-2xl"
                  style={{ background: 'linear-gradient(135deg,#F97316,#EA580C)', boxShadow: '0 0 60px #F9731699' }}
                  animate={{ rotate: [0, -8, 8, -4, 4, 0] }}
                  transition={{ delay: 0.3, duration: 0.6 }}
                >
                  {selectedEmoji}
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <p className="text-white text-[28px] font-black leading-tight" style={{ fontFamily: 'Heebo, sans-serif' }}>
                  {isEditMode ? 'האירוע עודכן בהצלחה!' : 'האירוע נוצר בהצלחה!'}
                </p>
                <p className="text-white/70 text-[16px] mt-2 font-medium">
                  {title}
                </p>
                <p className="text-white/50 text-[13px] mt-1">
                  {isEditMode ? 'השינויים נשמרו ויופיעו מיד' : 'עכשיו יופיע על המפה לכולם לראות'}
                </p>
              </motion.div>

              <motion.button
                onClick={handleSuccessDone}
                className="mt-2 px-10 py-4 rounded-full text-white text-[17px] font-black active:scale-[0.97] transition-transform"
                style={{ fontFamily: 'Heebo, sans-serif', background: 'linear-gradient(135deg,#F97316,#EA580C)', boxShadow: '0 8px 32px #F9731666' }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                whileTap={{ scale: 0.96 }}
              >
                {isEditMode ? 'מצוין! ✅' : 'מעולה! 🎉'}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* backdrop */}
      <motion.div className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={handleClose} />

      {/* sheet */}
      <motion.div
        className="fixed bottom-0 left-0 right-0 z-50 flex flex-col bg-[#F2F2F7]"
        style={{ maxHeight: step === 2 ? '94vh' : '90vh', borderRadius: '28px 28px 0 0' }}
        initial={{ y: '100%' }} animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 280 }}
        onClick={e => e.stopPropagation()}
        dir="rtl"
      >
        {/* drag handle */}
        <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
          <div className="w-9 h-[4px] rounded-full bg-[#C7C7CC]" />
        </div>

        {/* header */}
        <div className="flex items-center justify-between px-5 pb-3 flex-shrink-0">
          {/* back / close */}
          <motion.button
            onClick={step === 1 ? handleClose : handleBack}
            whileTap={{ scale: 0.88 }}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: `${accent}18` }}
          >
            {step === 1
              ? <X className="w-4 h-4" style={{ color: accent }} />
              : <ChevronLeft className="w-4 h-4" style={{ color: accent }} />
            }
          </motion.button>

          {/* step dots */}
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[11px] font-semibold text-[#8E8E93]">שלב {step} מתוך 4</span>
            <div className="flex gap-1.5">
              {[1,2,3,4].map(s => (
                <motion.div key={s}
                  animate={{ width: s === step ? 22 : 6, background: s <= step ? accent : '#D1D1D6' }}
                  transition={{ type: 'spring', damping: 18 }}
                  className="h-1.5 rounded-full"
                />
              ))}
            </div>
          </div>

          <div className="w-9" />
        </div>

        {/* step title */}
        <AnimatePresence mode="wait">
          <motion.h2 key={step}
            className="text-center text-[22px] font-bold text-[#1C1C1E] px-5 mb-4 flex-shrink-0"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {STEP_TITLES[step]}
          </motion.h2>
        </AnimatePresence>

        {/* ═══ MAP — always in DOM, shown only on step 2 ═══ */}
        <div style={{ display: step === 2 ? 'block' : 'none' }} className="flex-1 px-4 pb-4 overflow-hidden">
          <div className="rounded-[12px] mb-3 px-4 py-2.5 flex items-center gap-2"
            style={{ background: `${accent}15`, border: `1px solid ${accent}30` }}>
            <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: accent }} />
            <p className="text-[13px] font-medium" style={{ color: accent }}>לחץ על המפה או גרור את הסמן</p>
          </div>
          <div className="rounded-[20px] overflow-hidden shadow-md border-2 mb-3"
            style={{ height: 320, borderColor: `${accent}50` }}>
            <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
          </div>
          {locationName && (
            <div className="bg-white rounded-[14px] px-4 py-3 flex items-center gap-2 shadow-sm border border-black/[0.06]">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: accent }} />
              <p className="text-[14px] text-[#1C1C1E] font-medium truncate flex-1">{locationName}</p>
              {detectedCountry && (
                <span className="text-[11px] font-bold text-[#8E8E93] bg-[#F2F2F7] px-2 py-0.5 rounded-lg flex-shrink-0">{detectedCountry}</span>
              )}
            </div>
          )}
        </div>

        {/* scrollable content — steps 1, 3, 4 */}
        <div className="flex-1 overflow-y-auto overscroll-contain" style={{ display: step === 2 ? 'none' : 'block' }}>
          <AnimatePresence mode="wait" initial={false}>

            {/* ═══ STEP 1 ═══ */}
            {step === 1 && (
              <motion.div key="s1" className="px-4 pb-6 space-y-4"
                initial={{ x: dir * 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: dir * -50, opacity: 0 }}
                transition={{ type: 'spring', damping: 26, stiffness: 260 }}
              >
                {/* big emoji pin (driven by the selected category) */}
                <div className="flex flex-col items-center py-4">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full blur-2xl opacity-30" style={{ background: accent, transform: 'scale(1.6)' }} />
                    <div className="relative w-28 h-28 rounded-full flex items-center justify-center shadow-xl"
                      style={{ background: `linear-gradient(145deg, ${accent}dd, ${accent})` }}>
                      <span className="text-6xl">{selectedEmoji}</span>
                    </div>
                  </div>
                </div>

                {/* category grid */}
                <div className="bg-white rounded-[20px] p-4 shadow-sm border border-black/[0.05]">
                  <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-3">קטגוריה</p>
                  <div className="grid grid-cols-5 gap-2">
                    {EVENT_TYPES.map(t => {
                      const active = eventType === t.id;
                      return (
                        <motion.button key={t.id} type="button" whileTap={{ scale: 0.88 }}
                          onClick={() => { setEventType(t.id); setSelectedEmoji(t.emoji); }}
                          className="flex flex-col items-center gap-1 py-3 rounded-[14px] transition-all relative overflow-hidden"
                          style={active
                            ? { background: t.color, boxShadow: `0 4px 16px ${t.color}55` }
                            : { background: '#F2F2F7' }}>
                          {active && <Check className="absolute top-1 right-1 w-3 h-3 text-white" strokeWidth={3} />}
                          <span className="text-[24px]">{t.emoji}</span>
                          <span className="text-[11px] font-semibold" style={{ color: active ? 'white' : '#6B7280' }}>{t.label}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* title input */}
                <div className="bg-white rounded-[20px] shadow-sm border border-black/[0.05] overflow-hidden">
                  <div className="px-4 py-4">
                    <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-2">שם האירוע *</p>
                    <input
                      type="text" value={title} onChange={e => setTitle(e.target.value)} maxLength={60}
                      placeholder={
                        eventType === 'parties' ? 'מסיבה בחוף הים' :
                        eventType === 'sports'  ? 'ביקור בפארק שעשועים' :
                        eventType === 'treks'   ? 'טיול להר' : 'סדנת יצירה'
                      }
                      className="w-full text-[18px] font-semibold text-[#1C1C1E] placeholder-[#D1D1D6] bg-transparent outline-none"
                      autoFocus
                    />
                    {title && <p className="text-[11px] text-[#C7C7CC] mt-1 text-left">{title.length}/60</p>}
                  </div>
                </div>

                {/* description input */}
                <div className="bg-white rounded-[20px] shadow-sm border border-black/[0.05] overflow-hidden">
                  <div className="px-4 py-4">
                    <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-2">תיאור האירוע</p>
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      maxLength={300}
                      rows={3}
                      placeholder="ספר על האירוע — מה יהיה, למי מתאים, מה להביא..."
                      className="w-full text-[15px] text-[#1C1C1E] placeholder-[#D1D1D6] bg-transparent outline-none resize-none leading-relaxed"
                      style={{ fontFamily: 'Heebo, sans-serif' }}
                    />
                    {description && <p className="text-[11px] text-[#C7C7CC] mt-1 text-left">{description.length}/300</p>}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ═══ STEP 3 — מתי ═══ */}
            {step === 3 && (
              <motion.div key="s3" className="px-4 pb-6 space-y-4"
                initial={{ x: dir * 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: dir * -50, opacity: 0 }}
                transition={{ type: 'spring', damping: 26, stiffness: 260 }}
              >
                {/* date chips */}
                <div className="bg-white rounded-[20px] p-4 shadow-sm border border-black/[0.05]">
                  <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-3">תאריך</p>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
                    {days.map(d => {
                      const active = selectedDay === d.value;
                      return (
                        <motion.button key={d.value} type="button" whileTap={{ scale: 0.9 }}
                          onClick={() => setSelectedDay(d.value)}
                          className="flex-shrink-0 flex flex-col items-center justify-center rounded-[16px] px-4 py-3 min-w-[60px]"
                          style={active
                            ? { background: accent, boxShadow: `0 4px 14px ${accent}44` }
                            : { background: '#F2F2F7' }}>
                          <span className="text-[10px] font-semibold mb-0.5" style={{ color: active ? 'rgba(255,255,255,0.8)' : '#9CA3AF' }}>{d.dayLabel}</span>
                          <span className="text-[22px] font-bold leading-none" style={{ color: active ? 'white' : '#1C1C1E' }}>{d.num}</span>
                          <span className="text-[10px] mt-0.5" style={{ color: active ? 'rgba(255,255,255,0.7)' : '#9CA3AF' }}>{d.month}/{new Date().getFullYear().toString().slice(-2)}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* time chips */}
                <div className="bg-white rounded-[20px] p-4 shadow-sm border border-black/[0.05]">
                  <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-3">שעה</p>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
                    {HOURS.map(h => {
                      const active = selectedTime === h;
                      return (
                        <motion.button key={h} type="button" whileTap={{ scale: 0.9 }}
                          onClick={() => setSelectedTime(h)}
                          className="flex-shrink-0 rounded-[12px] px-4 py-2.5 font-semibold text-[14px]"
                          style={active
                            ? { background: accent, color: 'white', boxShadow: `0 4px 12px ${accent}44` }
                            : { background: '#F2F2F7', color: '#3C3C43' }}>
                          {h}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* approval — every event requires the organizer's approval */}
                <div className="bg-white rounded-[20px] p-4 shadow-sm border border-black/[0.05]">
                  <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-3">הצטרפות לאירוע</p>
                  <div className="flex items-center gap-3 rounded-[16px] p-3.5" style={{ background: '#8B5CF612' }}>
                    <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#8B5CF6' }}>
                      <Lock className="w-5 h-5 text-white" strokeWidth={2.2} />
                    </div>
                    <div>
                      <p className="text-[15px] font-bold text-[#1C1C1E]">כל מצטרף דורש את אישורך</p>
                      <p className="text-[12px] text-[#8E8E93] leading-snug mt-0.5">קונה כרטיס ממתין לאישורך; דחייה מחזירה לו את התשלום אוטומטית.</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ═══ STEP 4 — פרטים ═══ */}
            {step === 4 && (
              <motion.div key="s4" className="px-4 pb-6 space-y-4"
                initial={{ x: dir * 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: dir * -50, opacity: 0 }}
                transition={{ type: 'spring', damping: 26, stiffness: 260 }}
              >
                {/* participants */}
                <div className="bg-white rounded-[20px] p-4 shadow-sm border border-black/[0.05]">
                  {/* header row */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: `${accent}18` }}>
                        <Users className="w-4 h-4" style={{ color: accent }} />
                      </div>
                      <div>
                        <p className="text-[15px] font-semibold text-[#1C1C1E]">מספר משתתפים</p>
                        <p className="text-[11px] text-[#8E8E93]">מקסימום לאירוע</p>
                      </div>
                    </div>
                    <motion.span key={noLimit ? 'unlimited' : maxAttendees} initial={{ scale: 1.3 }} animate={{ scale: 1 }}
                      className="text-[26px] font-black" style={{ color: accent }}>
                      {noLimit ? '∞' : maxAttendees === 200 ? '200+' : maxAttendees}
                    </motion.span>
                  </div>

                  {/* no-limit toggle */}
                  <div
                    onClick={() => setNoLimit(v => !v)}
                    className="flex items-center justify-between py-3 mb-4 cursor-pointer"
                  >
                    <span className="text-[14px] font-medium text-[#1C1C1E]">ללא הגבלת משתתפים</span>
                    <div dir="ltr" className="relative w-[50px] h-[30px] rounded-full flex-shrink-0 overflow-hidden transition-colors duration-200"
                      style={{ background: noLimit ? accent : '#D1D1D6' }}>
                      <motion.div
                        animate={{ x: noLimit ? 22 : 2 }}
                        transition={{ type: 'spring', damping: 22, stiffness: 320 }}
                        className="absolute top-[3px] left-0 w-[24px] h-[24px] bg-white rounded-full"
                        style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}
                      />
                    </div>
                  </div>

                  {/* slider + presets (hidden when no limit) */}
                  <AnimatePresence>
                    {!noLimit && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div dir="ltr" className="relative h-8 flex items-center mb-3">
                          <div className="absolute left-0 right-0 h-2 bg-[#E5E5EA] rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${((maxAttendees - 5)/(200-5))*100}%`, background: accent }} />
                          </div>
                          <input type="range" min={5} max={200} step={5} value={maxAttendees}
                            onChange={e => setMaxAttendees(Number(e.target.value))}
                            className="absolute left-0 right-0 w-full opacity-0 h-8 cursor-pointer" />
                          <div className="absolute w-7 h-7 rounded-full bg-white shadow-lg border-[2.5px] flex items-center justify-center pointer-events-none"
                            style={{ left: `calc(${((maxAttendees-5)/(200-5))*100}% - 14px)`, borderColor: accent }}>
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: accent }} />
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {[10,20,30,50,100,200].map(n => (
                            <motion.button key={n} type="button" whileTap={{ scale: 0.88 }}
                              onClick={() => setMaxAttendees(n)}
                              className="px-3 py-1.5 rounded-[10px] text-[13px] font-semibold"
                              style={maxAttendees === n
                                ? { background: accent, color: 'white', boxShadow: `0 2px 8px ${accent}40` }
                                : { background: '#F2F2F7', color: '#6B7280' }}>
                              {n === 200 ? '200+' : n}
                            </motion.button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* tickets — one or more paid ticket types (e.g. רגיל / VIP) */}
                <div className="bg-white rounded-[20px] p-4 shadow-sm border border-black/[0.05]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${accent}18` }}>
                        <Tag className="w-4 h-4" style={{ color: accent }} />
                      </div>
                      <div>
                        <p className="text-[15px] font-semibold text-[#1C1C1E]">כרטיסים בתשלום</p>
                        <p className="text-[11px] text-[#8E8E93]">
                          {isPaid ? `${ticketTypes.length} ${ticketTypes.length === 1 ? 'סוג כרטיס' : 'סוגי כרטיסים'}` : 'האירוע חינמי'}
                        </p>
                      </div>
                    </div>
                    <div dir="ltr" className="relative w-[50px] h-[30px] rounded-full flex-shrink-0 overflow-hidden transition-colors duration-200 cursor-pointer"
                      style={{ background: isPaid ? accent : '#D1D1D6' }}
                      onClick={() => setIsPaid(v => !v)}>
                      <motion.div
                        animate={{ x: isPaid ? 22 : 2 }}
                        transition={{ type: 'spring', damping: 22, stiffness: 320 }}
                        className="absolute top-[3px] left-0 w-[24px] h-[24px] bg-white rounded-full"
                        style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}
                      />
                    </div>
                  </div>

                  <AnimatePresence>
                    {isPaid && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, marginTop: 0 }}
                        animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-2.5">
                          {ticketTypes.map(t => (
                            <div key={t.id} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={t.name}
                                onChange={e => setTicketTypes(list => list.map(x => x.id === t.id ? { ...x, name: e.target.value } : x))}
                                placeholder="שם הכרטיס (למשל VIP)"
                                className="flex-1 min-w-0 text-[14px] font-semibold text-[#1C1C1E] placeholder-[#C7C7CC] bg-[#F2F2F7] rounded-[12px] px-3 py-2.5 outline-none"
                              />
                              <div className="flex items-center gap-1 bg-[#F2F2F7] rounded-[12px] px-3 py-2.5 w-[92px] flex-shrink-0">
                                <span className="text-[16px] font-bold text-[#1C1C1E]">₪</span>
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  min="0"
                                  value={t.price}
                                  onChange={e => setTicketTypes(list => list.map(x => x.id === t.id ? { ...x, price: e.target.value } : x))}
                                  placeholder="0"
                                  className="w-full text-[16px] font-bold text-[#1C1C1E] placeholder-[#C7C7CC] bg-transparent outline-none"
                                />
                              </div>
                              {ticketTypes.length > 1 && (
                                <button type="button"
                                  onClick={() => setTicketTypes(list => list.filter(x => x.id !== t.id))}
                                  className="w-9 h-9 rounded-[12px] flex items-center justify-center flex-shrink-0 bg-[#FEF2F2] active:scale-90 transition-transform">
                                  <Trash2 className="w-4 h-4 text-[#EF4444]" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>

                        <button type="button"
                          onClick={() => setTicketTypes(list => [...list, freshTicket('')])}
                          className="mt-3 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-[12px] border-2 border-dashed active:scale-[0.98] transition-transform"
                          style={{ borderColor: `${accent}55`, color: accent }}>
                          <Plus className="w-4 h-4" strokeWidth={2.5} />
                          <span className="text-[13px] font-bold">הוסף סוג כרטיס</span>
                        </button>

                        <p className="text-[11px] text-[#8E8E93] mt-2 text-center">הקונה יבחר איזה כרטיס לקנות בדף האירוע</p>

                        {/* payout account — where the ticket money lands after the event */}
                        <button type="button" onClick={() => setShowSellerSheet(true)}
                          className="mt-3 w-full flex items-center gap-2.5 rounded-[14px] px-3 py-2.5 active:scale-[0.98] transition-transform"
                          style={{ background: sellerReady ? '#F0FDF4' : '#FFF7ED', border: `1px solid ${sellerReady ? '#BBF7D0' : `${accent}44`}` }}>
                          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: sellerReady ? '#DCFCE7' : `${accent}18` }}>
                            {sellerReady
                              ? <Check className="w-4 h-4" style={{ color: '#16A34A' }} strokeWidth={3} />
                              : <Landmark className="w-4 h-4" style={{ color: accent }} />}
                          </div>
                          <div className="flex-1 min-w-0 text-right">
                            <p className="text-[13px] font-bold" style={{ color: sellerReady ? '#166534' : '#1C1C1E' }}>
                              {sellerReady ? 'חשבון התשלומים מחובר' : 'חבר חשבון לקבלת התשלום'}
                            </p>
                            <p className="text-[11px]" style={{ color: sellerReady ? '#22C55E' : '#8E8E93' }}>
                              {sellerReady ? 'הכסף יגיע אליך אחרי האירוע' : 'חובה לפני פרסום אירוע בתשלום'}
                            </p>
                          </div>
                          {!sellerReady && <ChevronLeft className="w-4 h-4 -scale-x-100 flex-shrink-0" style={{ color: '#C7C7CC' }} />}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* event group chat */}
                <div className="bg-white rounded-[20px] p-4 shadow-sm border border-black/[0.05]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${accent}18` }}>
                        <Users className="w-4 h-4" style={{ color: accent }} />
                      </div>
                      <div>
                        <p className="text-[15px] font-semibold text-[#1C1C1E]">קבוצת צ׳אט לאירוע</p>
                        <p className="text-[11px] text-[#8E8E93]">{createGroup ? 'כל מי שאושר יצורף אוטומטית לקבוצה' : 'ללא קבוצת צ׳אט'}</p>
                      </div>
                    </div>
                    <div dir="ltr" className="relative w-[50px] h-[30px] rounded-full flex-shrink-0 overflow-hidden transition-colors duration-200 cursor-pointer"
                      style={{ background: createGroup ? accent : '#D1D1D6' }}
                      onClick={() => setCreateGroup(v => !v)}>
                      <motion.div
                        animate={{ x: createGroup ? 22 : 2 }}
                        transition={{ type: 'spring', damping: 22, stiffness: 320 }}
                        className="absolute top-[3px] left-0 w-[24px] h-[24px] bg-white rounded-full"
                        style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}
                      />
                    </div>
                  </div>
                </div>

                {/* image */}
                <div className="bg-white rounded-[20px] shadow-sm border border-black/[0.05] overflow-hidden">
                  <div className="px-4 pt-4 pb-2">
                    <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-3">תמונה</p>
                  </div>
                  {activeImageUrl && (
                    <div className="relative h-36 mx-4 rounded-[14px] overflow-hidden mb-3">
                      <img src={activeImageUrl} alt="event" className="w-full h-full object-cover" />
                      {(imagePreview || imageUrl) && (
                        <button onClick={() => { setImageFile(null); setImagePreview(''); setImageUrl(''); setImageError(''); }}
                          className="absolute top-2 right-2 w-8 h-8 bg-black/55 rounded-full flex items-center justify-center backdrop-blur-sm">
                          <X className="w-4 h-4 text-white" />
                        </button>
                      )}
                      {!imagePreview && !imageUrl && (
                        <div className="absolute bottom-2 left-2 bg-black/50 text-white text-[11px] px-2 py-1 rounded-full backdrop-blur-sm">הצעה אוטומטית</div>
                      )}
                    </div>
                  )}
                  <div className="px-4 pb-4 space-y-3">
                    <motion.button type="button" onClick={() => fileInputRef.current?.click()} whileTap={{ scale: 0.97 }}
                      disabled={moderatingImage}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-[14px] border-2 border-dashed disabled:opacity-60"
                      style={{ borderColor: accent, background: `${accent}0A` }}>
                      {moderatingImage ? (
                        <>
                          <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" style={{ color: accent }} />
                          <span className="text-[14px] font-semibold" style={{ color: accent }}>בודק תמונה...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" style={{ color: accent }} />
                          <span className="text-[14px] font-semibold" style={{ color: accent }}>
                            {imagePreview ? 'החלף תמונה' : 'העלה תמונה'}
                          </span>
                        </>
                      )}
                    </motion.button>
                    {imageError && (
                      <div className="flex items-start gap-2 px-3 py-2.5 rounded-[12px] bg-red-50 border border-red-100">
                        <span className="text-red-500 text-[13px] font-medium leading-snug">{imageError}</span>
                      </div>
                    )}
                    {!imagePreview && !imageUrl && (
                      <div>
                        <p className="text-[11px] text-[#8E8E93] mb-2">או בחר תמונה מוצעת</p>
                        <div className="flex gap-2">
                          {SUGGESTED_IMAGES[eventType]?.map((url, i) => (
                            <button key={i} onClick={() => setImageUrl(url)}
                              className="flex-1 h-20 rounded-[12px] overflow-hidden border-[2.5px] transition-all"
                              style={{ borderColor: imageUrl === url ? accent : 'transparent' }}>
                              <img src={url} alt="" className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </div>

                {/* summary */}
                <div className="bg-white rounded-[20px] px-4 py-3 shadow-sm border border-black/[0.05] flex items-center gap-3">
                  <div className="w-12 h-12 rounded-[14px] flex items-center justify-center flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${accent}cc, ${accent})` }}>
                    <span className="text-2xl">{selectedEmoji}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[16px] font-bold text-[#1C1C1E] truncate">{title}</p>
                    <p className="text-[12px] text-[#8E8E93] truncate">
                      {locationName ? `📍 ${locationName.split(',')[0]}` : ''}
                      {selectedDay ? ` · 📅 ${new Date(selectedDay).toLocaleDateString('he-IL')}` : ''}
                      {selectedTime ? ` ${selectedTime}` : ''}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* bottom CTA */}
        <div className="flex-shrink-0 px-4 pt-3 pb-8 border-t border-black/[0.06] bg-[#F2F2F7]">
          <motion.button
            type="button"
            onClick={step === 4 ? handleSubmit : handleNext}
            disabled={!canContinue || submitting || uploadingImage || moderatingImage}
            whileTap={{ scale: 0.97 }}
            className="w-full py-4 rounded-[20px] text-white text-[17px] font-bold flex items-center justify-center gap-2 disabled:opacity-40"
            style={{
              background: canContinue ? `linear-gradient(135deg, ${accent}, ${accent}bb)` : '#C7C7CC',
              boxShadow: canContinue ? `0 8px 24px ${accent}40` : 'none',
            }}
          >
            {submitting || uploadingImage ? (
              <span>{uploadingImage ? 'מעלה תמונה...' : 'יוצר אירוע...'}</span>
            ) : step === 4 ? (
              <span>{selectedEmoji} הוסף למפה</span>
            ) : (
              <>
                <span>המשך</span>
                <ChevronLeft className="w-5 h-5" />
              </>
            )}
          </motion.button>
        </div>
      </motion.div>

      {/* Bank-connect sheet — opened from the payout card or when publishing a paid event
          without a connected account. On success the status card + publish gate unlock. */}
      {showSellerSheet && (
        <SellerOnboardingSheet
          userId={userId}
          onClose={() => setShowSellerSheet(false)}
          onReady={(acc) => setSellerAccount(acc)}
        />
      )}
    </>
  );
}
