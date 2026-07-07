import { useState, useEffect, useRef } from 'react';
import { Calendar, MapPin, MessageCircle, Navigation } from 'lucide-react';
import { supabase, type Event } from '../lib/supabase';
import { flagEmoji } from '../utils/flags';
import { UserAvatar } from './UserAvatar';
import { getCategoryEmoji } from '../utils/eventCategories';
import { BookingFlow } from './BookingFlow';
import { ShareEventSheet } from './ShareEventSheet';
import { OpenLocationSheet } from './OpenLocationSheet';

export type Attendee = {
  id: string;
  display_name: string;
  country: string;
  city: string | null;
  avatar_url: string | null;
  instagram?: string;
};

type EventDetailsModalProps = {
  event: Event;
  onClose: () => void;
  currentUserId?: string | null;
  onNavigateToUserProfile?: (userId: string) => void;
  onOpenMapAt?: (lat: number, lng: number) => void;
  onMessageUser?: (userId: string) => void;
  /** 'modal' (default) = full-screen; 'sheet' = Chabad-style bottom sheet (opens half, drag up to full). */
  variant?: 'modal' | 'sheet';
};

const CATEGORY_CONFIG: Record<string, { gradient: string; accent: string; light: string; image: string; label: string }> = {
  parties:   { gradient: 'from-purple-500 via-pink-500 to-rose-400',    accent: '#a855f7', light: '#faf5ff', image: 'https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg?auto=compress&cs=tinysrgb&w=800', label: 'מסיבה 🎉' },
  treks:     { gradient: 'from-green-400 via-emerald-500 to-teal-600',  accent: '#10b981', light: '#f0fdf4', image: 'https://images.pexels.com/photos/2662116/pexels-photo-2662116.jpeg?auto=compress&cs=tinysrgb&w=800', label: 'טרק 🏕️' },
  food:      { gradient: 'from-orange-400 via-amber-400 to-yellow-400', accent: '#f97316', light: '#fff7ed', image: 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=800', label: 'אוכל 🍔' },
  sports:    { gradient: 'from-blue-500 via-cyan-400 to-sky-400',       accent: '#3b82f6', light: '#eff6ff', image: 'https://images.pexels.com/photos/2884867/pexels-photo-2884867.jpeg?auto=compress&cs=tinysrgb&w=800', label: 'אטרקציות 🎡' },
  workshops: { gradient: 'from-yellow-400 via-amber-400 to-orange-400', accent: '#f59e0b', light: '#fffbeb', image: 'https://images.pexels.com/photos/3822622/pexels-photo-3822622.jpeg?auto=compress&cs=tinysrgb&w=800', label: 'סדנה 🧘' },
  yeshivot:  { gradient: 'from-indigo-500 via-violet-500 to-purple-600',accent: '#6366f1', light: '#eef2ff', image: 'https://images.pexels.com/photos/256541/pexels-photo-256541.jpeg?auto=compress&cs=tinysrgb&w=800', label: 'ישיבה 📖' },
};
const DEFAULT_CONFIG = { gradient: 'from-slate-500 via-gray-500 to-zinc-600', accent: '#F97316', light: '#fff7ed', image: '', label: 'אירוע 📅' };

export function EventDetailsModal({ event, onClose, currentUserId: propUserId, onNavigateToUserProfile, onOpenMapAt, onMessageUser, variant = 'modal' }: EventDetailsModalProps) {
  const [attendees, setAttendees]     = useState<Attendee[]>([]);
  const [isJoined, setIsJoined]       = useState(false);
  const [requestStatus, setRequestStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');
  const [joining, setJoining]         = useState(false);
  const [saved, setSaved]             = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  /* ── bottom-sheet mode (variant='sheet'): opens to half, drag up to full, drag down to close ── */
  const winH = typeof window !== 'undefined' ? window.innerHeight : 800;
  const SHEET_FULL = Math.round(winH * 0.92);
  const SHEET_HALF = Math.round(winH * 0.55);
  const COLLAPSED  = SHEET_FULL - SHEET_HALF; // translateY offset that leaves the half visible
  const [snap, setSnap]       = useState<'half' | 'full'>('half');
  const [dragDy, setDragDy]   = useState(0);
  const [dragging, setDragging] = useState(false);
  const [entered, setEntered] = useState(false);
  const dragStartY = useRef(0);

  useEffect(() => {
    if (variant !== 'sheet') return;
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [variant]);

  const closeSheet = () => { setEntered(false); setTimeout(onClose, 320); };

  const basePx = snap === 'full' ? 0 : COLLAPSED;
  const sheetTranslate = !entered ? SHEET_FULL : Math.min(SHEET_FULL, Math.max(0, basePx + dragDy));

  const onDragStart = (y: number) => { dragStartY.current = y; setDragging(true); };
  const onDragMove  = (y: number) => { if (dragging) setDragDy(y - dragStartY.current); };
  const onDragEnd   = () => {
    const d = dragDy;
    setDragging(false);
    setDragDy(0);
    if (snap === 'half') {
      if (d <= -55) setSnap('full');
      else if (d >= 90) closeSheet();
    } else {
      if (d >= 120) setSnap('half');
    }
  };

  useEffect(() => {
    if (!dragging) return;
    const mm = (e: MouseEvent) => onDragMove(e.clientY);
    const mu = () => onDragEnd();
    document.addEventListener('mousemove', mm);
    document.addEventListener('mouseup', mu);
    return () => { document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); };
  }, [dragging, dragDy, snap]);

  const currentUserId = propUserId || '00000000-0000-0000-0000-000000000001';
  const isOwner  = event.user_id === currentUserId;
  const cat      = event.event_type ? (CATEGORY_CONFIG[event.event_type] ?? DEFAULT_CONFIG) : DEFAULT_CONFIG;
  const heroImg  = event.image_url || cat.image;
  const emoji    = (event as any).emoji || '';
  const price    = (event as any).price as number | null | undefined;
  const priced   = !!(price && price > 0);
  const isPrivate = !!(event as any).is_private;
  const isUnlimited = event.max_attendees >= 9999;
  const spotsLeft   = isUnlimited ? Infinity : event.max_attendees - event.attendees.length;
  const isFull      = !isUnlimited && spotsLeft === 0;
  const creator     = (event as any).users as { display_name: string; avatar_url: string | null } | null;

  useEffect(() => {
    fetchAttendees();
    setIsJoined(event.attendees.includes(currentUserId));
    checkRequest();
  }, [event.id]);

  const checkRequest = async () => {
    if (!currentUserId || isOwner) return;
    const { data } = await supabase
      .from('event_join_requests').select('status')
      .eq('event_id', event.id).eq('user_id', currentUserId).maybeSingle();
    if (data) setRequestStatus(data.status as any);
  };

  const fetchAttendees = async () => {
    if (!event.attendees?.length) return;
    const { data } = await supabase
      .from('users').select('id, display_name, current_country, avatar_url')
      .in('id', event.attendees);
    setAttendees((data || []).map(u => ({
      id: u.id, display_name: u.display_name, country: u.current_country || 'IL',
      city: null, avatar_url: u.avatar_url,
    })));
  };

  // add the current user to the event's attendee list (= fully joined)
  const addSelfToAttendees = async () => {
    const updated = [...event.attendees, currentUserId];
    await supabase.from('events').update({ attendees: updated }).eq('id', event.id);
    event.attendees = updated;
    setIsJoined(true);
    fetchAttendees();
  };

  // called when the payment sheet's method is chosen (mock — see note to user)
  const completePayment = async () => {
    if (joining) return;
    setJoining(true);
    if ('vibrate' in navigator) navigator.vibrate(15);
    try {
      await addSelfToAttendees();
      setShowPayment(false);
    } finally { setJoining(false); }
  };

  const handleJoin = async () => {
    if (joining) return;

    // Leave / cancel
    if (isJoined) {
      setJoining(true);
      if ('vibrate' in navigator) navigator.vibrate(10);
      try {
        const updated = event.attendees.filter(id => id !== currentUserId);
        await supabase.from('events').update({ attendees: updated }).eq('id', event.id);
        await supabase.from('event_join_requests').delete().eq('event_id', event.id).eq('user_id', currentUserId);
        setIsJoined(false); setRequestStatus('none');
        event.attendees = updated; fetchAttendees();
      } finally { setJoining(false); }
      return;
    }

    if (isFull) return;
    if ('vibrate' in navigator) navigator.vibrate(10);

    // ── PUBLIC event — no approval needed ──
    if (!isPrivate) {
      if (priced) { setShowPayment(true); return; }   // pay → join
      setJoining(true);
      try { await addSelfToAttendees(); } finally { setJoining(false); }
      return;
    }

    // ── PRIVATE event — manager approval required first ──
    if (requestStatus === 'approved') {
      // approved by the manager → now pay (if priced), otherwise join
      if (priced) { setShowPayment(true); return; }
      setJoining(true);
      try { await addSelfToAttendees(); } finally { setJoining(false); }
      return;
    }
    if (requestStatus === 'pending')  { alert('הבקשה שלך ממתינה לאישור המארגן'); return; }
    if (requestStatus === 'rejected') { alert('הבקשה נדחתה על ידי המארגן'); return; }

    // none → send a join request
    setJoining(true);
    try {
      const { error } = await supabase.from('event_join_requests').upsert(
        { event_id: event.id, user_id: currentUserId, status: 'pending' },
        { onConflict: 'event_id,user_id' }
      );
      if (!error) setRequestStatus('pending');
    } finally { setJoining(false); }
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

  const handleShare = () => {
    // Open the in-app share sheet (send the event to chats / groups).
    setShowShare(true);
  };

  // Tapping the map → open the exact location inside the app's map.
  // If no in-app handler is available, fall back to the external navigation picker.
  const handleMapClick = () => {
    if (event.latitude == null || event.longitude == null) return;
    if (onOpenMapAt) { onOpenMapAt(event.latitude, event.longitude); onClose(); }
    else setShowNav(true);
  };

  const joinLabel = isJoined ? 'ביטול השתתפות'
    : isFull ? 'האירוע מלא'
    : isPrivate
      ? (requestStatus === 'pending'  ? '⏳ ממתין לאישור המארגן'
         : requestStatus === 'rejected' ? '❌ הבקשה נדחתה'
         : requestStatus === 'approved' ? (priced ? `שלם · ₪${price}` : 'אושרת — הצטרף')
         : 'בקש להצטרף')
      : (priced ? `קנה כרטיס · ₪${price}` : 'הצטרף לאירוע');
  const joinDisabled = (isFull && !isJoined) || joining ||
    (isPrivate && (requestStatus === 'pending' || requestStatus === 'rejected'));

  /* ── shared detail body (identical in modal + sheet so the design is 1:1) ── */
  const detailBody = (
    <>
      {/* Hero image with padding */}
        <div className="px-4 pt-4 pb-5">
          <div
            className="relative rounded-[20px] overflow-hidden"
            style={{ aspectRatio: '1 / 1', width: '100%' }}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${cat.gradient}`} />
            {heroImg && (
              <img
                src={heroImg} alt={event.title}
                className="absolute inset-0 w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
          </div>
        </div>

        <div className="px-4">

          {/* Title */}
          <h1
            className="text-[22px] font-black text-gray-900 leading-snug mb-3"
            style={{ fontFamily: 'Heebo, sans-serif' }}
          >
            {event.title}
          </h1>

          {/* Description */}
          {event.description && (
            <p className="text-[13px] text-gray-500 leading-relaxed mb-4">
              {event.description}
            </p>
          )}

          {/* Date / time + Going */}
          <div
            className="flex items-center justify-between py-3.5"
            style={{  }}
          >
            <div className="flex items-center gap-2 text-[13px] text-gray-600 font-medium">
              <Calendar className="w-4 h-4 flex-shrink-0 text-gray-400" />
              <span>{fmtDate(event.event_date ?? '')} · {fmtTime(event.event_date ?? '')}</span>
            </div>
            {/* mini avatars + count */}
            {attendees.length > 0 && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className="flex">
                  {attendees.slice(0, 3).map((a, i) => (
                    <div
                      key={a.id}
                      className="rounded-full overflow-hidden border-2 border-white"
                      style={{ width: 24, height: 24, marginLeft: i === 0 ? 0 : -8, position: 'relative', zIndex: 3 - i }}
                    >
                      <UserAvatar avatarUrl={a.avatar_url} displayName={a.display_name} size="small" />
                    </div>
                  ))}
                </div>
                <span className="text-[12px] font-bold text-gray-700">
                  {event.attendees.length} הולכים
                </span>
              </div>
            )}
          </div>

          {/* Location → external navigation picker (Google / Apple / Waze) */}
          {event.latitude != null && event.longitude != null ? (
            <button
              onClick={() => setShowNav(true)}
              className="w-full flex items-center justify-between py-3.5 active:opacity-70 transition-opacity"
            >
              <span className="flex items-center gap-2">
                <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: '#F97316' }} />
                <span className="text-[13px] font-semibold" style={{ color: '#F97316' }}>
                  {flagEmoji(event.country ?? '')} {event.city}
                </span>
              </span>
              <span className="flex items-center gap-1 text-[12px] font-bold" style={{ color: '#9CA3AF', fontFamily: 'Heebo, sans-serif' }}>
                <Navigation className="w-3.5 h-3.5" /> נווט
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-2 py-3.5">
              <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: '#F97316' }} />
              <span className="text-[13px] font-semibold" style={{ color: '#F97316' }}>
                {flagEmoji(event.country ?? '')} {event.city}
              </span>
            </div>
          )}

          {/* Host row */}
          {creator && (
            <div
              className="flex items-center justify-between py-3.5"
              style={{  }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="rounded-full overflow-hidden flex-shrink-0"
                  style={{ width: 42, height: 42 }}
                  onClick={() => onNavigateToUserProfile?.(event.user_id)}
                >
                  <UserAvatar avatarUrl={creator.avatar_url} displayName={creator.display_name} size="medium" />
                </div>
                <div>
                  <p className="text-[14px] font-bold text-gray-900" style={{ fontFamily: 'Heebo, sans-serif' }}>
                    {creator.display_name}
                  </p>
                  <p className="text-[12px] text-gray-400">מארגן</p>
                </div>
              </div>
              {!isOwner && onMessageUser && (
                <button
                  onClick={() => onMessageUser(event.user_id)}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-full text-white text-[13px] font-bold active:scale-95 transition-transform"
                  style={{ background: '#111827', fontFamily: 'Heebo, sans-serif' }}
                >
                  <MessageCircle className="w-4 h-4" /> הודעה
                </button>
              )}
            </div>
          )}

          {/* Price / spots */}
          <div
            className="flex items-center justify-between py-3.5"
            style={{  }}
          >
            <div>
              <p className="text-[11px] text-gray-400 font-medium mb-0.5">כרטיס</p>
              <p className="text-[26px] font-black leading-none" style={{ color: '#F97316' }}>
                {price ? `₪${price}` : 'חינם'}
              </p>
            </div>

            {!isUnlimited && (
              <div className="text-left">
                <p className="text-[12px] text-gray-400 mb-1">
                  {isFull ? 'האירוע מלא' : `${spotsLeft} מקומות נשארו`}
                </p>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ width: 80, background: '#F3F4F6' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min((event.attendees.length / event.max_attendees) * 100, 100)}%`,
                      background: isFull ? '#ef4444' : spotsLeft <= 3 ? '#f97316' : '#F97316',
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Map → opens the exact location inside the app */}
          {event.latitude && event.longitude && (
            <div className="pt-4 pb-2">
              <p className="text-[11px] text-gray-400 font-semibold mb-2 tracking-wide uppercase">מפה</p>
              <div
                onClick={handleMapClick}
                className="rounded-[16px] overflow-hidden relative cursor-pointer active:opacity-95"
                style={{ height: 180 }}
              >
                <div
                  className="absolute top-2 right-2 z-30 bg-white/95 backdrop-blur-sm text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm"
                  style={{ color: '#F97316', fontFamily: 'Heebo, sans-serif' }}
                >
                  <MapPin className="w-3 h-3" /> פתח במפה
                </div>
                <img
                  src={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${event.longitude},${event.latitude},14,0/600x420@2x?access_token=${import.meta.env.VITE_MAPBOX_TOKEN}`}
                  alt="map"
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />

                {/* pin */}
                <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 20 }}>
                  <div className="relative flex-shrink-0" style={{ marginTop: -37 }}>
                    <svg
                      width="65" height="74" viewBox="0 0 36 41" fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      style={{ overflow: 'visible', display: 'block', filter: 'drop-shadow(0 1px 5px rgba(0,0,0,0.15))' }}
                    >
                      <defs>
                        <clipPath id="edm-clip">
                          <circle cx="15.75" cy="15.75" r="12.75" />
                        </clipPath>
                      </defs>
                      <path fillRule="evenodd" clipRule="evenodd"
                        d="M15.75 0C24.4485 0 31.5 7.05152 31.5 15.75C31.5 23.3702 26.0883 29.7265 18.8985 31.1852L16.2393 34.9931C16.1841 35.0725 16.1109 35.1372 16.0257 35.182C15.9405 35.2267 15.846 35.25 15.75 35.25C15.654 35.25 15.5595 35.2267 15.4743 35.182C15.3891 35.1372 15.3159 35.0725 15.2607 34.9931L12.6015 31.1852C5.41168 29.7265 0 23.3702 0 15.75C0 7.05152 7.05152 0 15.75 0Z"
                        fill={'#F97316'}
                      />
                      <path d="M17.25 39C17.25 38.1716 16.5784 37.5 15.75 37.5C14.9216 37.5 14.25 38.1716 14.25 39C14.25 39.8284 14.9216 40.5 15.75 40.5C16.5784 40.5 17.25 39.8284 17.25 39Z" fill={'#F97316'} />
                      <circle cx="15.75" cy="15.75" r="12.75" fill="white" />
                      {event.image_url ? (
                        <image href={event.image_url} x="3" y="3" width="25.5" height="25.5" clipPath="url(#edm-clip)" preserveAspectRatio="xMidYMid slice" />
                      ) : (
                        <foreignObject x="3" y="3" width="25.5" height="25.5">
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, lineHeight: 1 }}>
                            {getCategoryEmoji(event.event_type || '')}
                          </div>
                        </foreignObject>
                      )}
                      {emoji && (
                        <>
                          <path d="M25.5 30C29.2279 30 32.25 26.9779 32.25 23.25C32.25 19.5221 29.2279 16.5 25.5 16.5C21.7721 16.5 18.75 19.5221 18.75 23.25C18.75 26.9779 21.7721 30 25.5 30Z" fill="white" />
                          <path d="M31.5 23.25C31.5 19.9363 28.8137 17.25 25.5 17.25C22.1863 17.25 19.5 19.9363 19.5 23.25C19.5 26.5637 22.1863 29.25 25.5 29.25V30C21.7721 30 18.75 26.9779 18.75 23.25C18.75 19.5221 21.7721 16.5 25.5 16.5C29.2279 16.5 32.25 19.5221 32.25 23.25C32.25 26.9779 29.2279 30 25.5 30V29.25C28.8137 29.25 31.5 26.5637 31.5 23.25Z" fill={'#F97316'} />
                          <foreignObject x="19.5" y="17.25" width="12" height="12">
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, lineHeight: 1 }}>
                              {emoji}
                            </div>
                          </foreignObject>
                        </>
                      )}
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
    </>
  );

  const joinButton = (
    <button
      onClick={handleJoin}
      disabled={joinDisabled}
      className="w-full font-black text-[17px] text-white active:scale-[0.97] transition-transform disabled:opacity-60"
      style={{
        fontFamily: 'Heebo, sans-serif',
        height: 56,
        borderRadius: 28,
        background: isJoined
          ? 'linear-gradient(135deg,#ef4444,#dc2626)'
          : joinDisabled ? '#D1D5DB'
          : `linear-gradient(135deg, ${'#F97316'}, ${'#F97316'}bb)`,
        boxShadow: joinDisabled || isJoined ? 'none' : `0 8px 24px ${'#F97316'}55`,
      }}
    >
      {joining ? '...' : joinLabel}
    </button>
  );

  const extras = (
    <>
      {showPayment && (
        <BookingFlow
          event={event}
          price={price || 0}
          currentUserId={currentUserId}
          onClose={() => setShowPayment(false)}
          onComplete={completePayment}
        />
      )}
      {showShare && (
        <ShareEventSheet event={event} currentUserId={currentUserId} onClose={() => setShowShare(false)} />
      )}
      {showNav && event.latitude != null && event.longitude != null && (
        <OpenLocationSheet
          lat={event.latitude}
          lng={event.longitude}
          name={event.title || event.city || 'מיקום האירוע'}
          onClose={() => setShowNav(false)}
        />
      )}
    </>
  );

  /* ── Bottom-sheet variant (Chabad-style frame; opens to half, drag up to full) ── */
  if (variant === 'sheet') {
    return (
      <>
        <div
          className="fixed inset-0 bg-black/40 z-50"
          style={{ opacity: entered ? 1 : 0, transition: 'opacity 0.3s ease' }}
          onClick={closeSheet}
        />
        <div
          dir="rtl"
          className="fixed left-0 right-0 bottom-0 bg-white rounded-t-3xl shadow-2xl z-50 overflow-hidden"
          style={{
            height: SHEET_FULL,
            transform: `translateY(${sheetTranslate}px)`,
            transition: dragging ? 'none' : 'transform 0.34s cubic-bezier(0.22,1,0.3,1)',
          }}
        >
          {/* drag handle (drag up to expand, down to close) */}
          <div
            className="w-full pt-3 pb-2 flex justify-center cursor-grab active:cursor-grabbing"
            style={{ touchAction: 'none' }}
            onMouseDown={(e) => onDragStart(e.clientY)}
            onTouchStart={(e) => onDragStart(e.touches[0].clientY)}
            onTouchMove={(e) => onDragMove(e.touches[0].clientY)}
            onTouchEnd={onDragEnd}
          >
            <div className="w-11 h-1.5 bg-gray-300 rounded-full" />
          </div>

          <button
            onClick={closeSheet}
            aria-label="סגור"
            className="absolute top-3 left-4 w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center z-10"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>

          <div
            ref={scrollRef}
            className="overflow-y-auto overscroll-contain"
            style={{ height: 'calc(100% - 34px)', paddingBottom: isOwner ? 24 : 104 }}
          >
            {detailBody}
          </div>
        </div>

        {/* CTA pinned to the viewport (sibling of the sheet, so it stays visible even at half —
            a position:fixed child of the translated sheet would anchor to the sheet, not the screen) */}
        <div
          className="fixed bottom-0 left-0 right-0 z-[60] bg-white px-5"
          style={{
            paddingTop: 14,
            paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
            boxShadow: '0 -2px 16px rgba(0,0,0,0.08)',
            transform: entered ? 'translateY(0)' : 'translateY(100%)',
            transition: 'transform 0.34s cubic-bezier(0.22,1,0.3,1)',
          }}
        >
          {joinButton}
        </div>
        {extras}
      </>
    );
  }

  /* ── Full-screen modal variant (default; Events tab, Home, Chat, …) ── */
  return (
    <div
      className="fixed inset-0 z-50 bg-white"
      dir="rtl"
      style={{ animation: 'edm-up 0.38s cubic-bezier(0.16,1,0.3,1)' }}
    >
      <style>{`
        @keyframes edm-up { from { transform: translateY(100%) } to { transform: translateY(0) } }
      `}</style>

      {/* ── Nav bar ── */}
      <div
        className="flex items-center justify-between px-4 bg-white"
        style={{ paddingTop: 'max(14px, env(safe-area-inset-top))', paddingBottom: 12 }}
      >
        <button
          onClick={onClose}
          aria-label="סגור"
          className="w-10 h-10 flex items-center justify-center rounded-full active:bg-gray-100 transition-colors"
          style={{ touchAction: 'manipulation' }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2.2" strokeLinecap="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
        <span className="text-[16px] font-black text-gray-900" style={{ fontFamily: 'Heebo, sans-serif' }}>
          פרטי האירוע
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleShare}
            aria-label="שתף אירוע"
            className="w-10 h-10 flex items-center justify-center rounded-full active:bg-gray-100 transition-colors"
            style={{ touchAction: 'manipulation' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
          <button
            onClick={() => setSaved(s => !s)}
            aria-label={saved ? 'הסר משמורים' : 'שמור אירוע'}
            aria-pressed={saved}
            className="w-10 h-10 flex items-center justify-center rounded-full active:bg-gray-100 transition-colors"
            style={{ touchAction: 'manipulation' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill={saved ? '#F97316' : 'none'} stroke={saved ? '#F97316' : '#6B7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Scroll body ── */}
      <div
        ref={scrollRef}
        className="overflow-y-auto overscroll-contain"
        style={{ height: 'calc(100% - 57px)', paddingBottom: isOwner ? 24 : 100 }}
      >
        {detailBody}
      </div>

      {/* ── Sticky bottom ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-20 bg-white px-5"
        style={{
          paddingTop: 14,
          paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
          boxShadow: '0 -2px 16px rgba(0,0,0,0.08)',
        }}
      >
        {joinButton}
      </div>

      {extras}
    </div>
  );
}
