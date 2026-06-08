import { useState, useEffect, useRef } from 'react';
import { Calendar, MapPin, Users } from 'lucide-react';
import { supabase, type Event } from '../lib/supabase';
import { flagEmoji } from '../utils/flags';
import { UserAvatar } from './UserAvatar';
import { getCategoryEmoji } from '../utils/eventCategories';

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
};

const CATEGORY_CONFIG: Record<string, { gradient: string; accent: string; light: string; image: string; label: string }> = {
  parties:   { gradient: 'from-purple-500 via-pink-500 to-rose-400',    accent: '#a855f7', light: '#faf5ff', image: 'https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg?auto=compress&cs=tinysrgb&w=800', label: 'מסיבה 🎉' },
  treks:     { gradient: 'from-green-400 via-emerald-500 to-teal-600',  accent: '#10b981', light: '#f0fdf4', image: 'https://images.pexels.com/photos/2662116/pexels-photo-2662116.jpeg?auto=compress&cs=tinysrgb&w=800', label: 'טרק 🏕️' },
  food:      { gradient: 'from-orange-400 via-amber-400 to-yellow-400', accent: '#f97316', light: '#fff7ed', image: 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=800', label: 'אוכל 🍔' },
  sports:    { gradient: 'from-blue-500 via-cyan-400 to-sky-400',       accent: '#3b82f6', light: '#eff6ff', image: 'https://images.pexels.com/photos/390051/surfer-wave-sunset-the-indian-ocean-390051.jpeg?auto=compress&cs=tinysrgb&w=800', label: 'ספורט 🏄' },
  workshops: { gradient: 'from-yellow-400 via-amber-400 to-orange-400', accent: '#f59e0b', light: '#fffbeb', image: 'https://images.pexels.com/photos/3822622/pexels-photo-3822622.jpeg?auto=compress&cs=tinysrgb&w=800', label: 'סדנה 🧘' },
  yeshivot:  { gradient: 'from-indigo-500 via-violet-500 to-purple-600',accent: '#6366f1', light: '#eef2ff', image: 'https://images.pexels.com/photos/256541/pexels-photo-256541.jpeg?auto=compress&cs=tinysrgb&w=800', label: 'ישיבה 📖' },
};
const DEFAULT_CONFIG = { gradient: 'from-slate-500 via-gray-500 to-zinc-600', accent: '#F97316', light: '#fff7ed', image: '', label: 'אירוע 📅' };

export function EventDetailsModal({ event, onClose, currentUserId: propUserId, onNavigateToUserProfile }: EventDetailsModalProps) {
  const [attendees, setAttendees]     = useState<Attendee[]>([]);
  const [isJoined, setIsJoined]       = useState(false);
  const [requestStatus, setRequestStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');
  const [joining, setJoining]         = useState(false);
  const [saved, setSaved]             = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentUserId = propUserId || '00000000-0000-0000-0000-000000000001';
  const isOwner  = event.user_id === currentUserId;
  const cat      = event.event_type ? (CATEGORY_CONFIG[event.event_type] ?? DEFAULT_CONFIG) : DEFAULT_CONFIG;
  const heroImg  = event.image_url || cat.image;
  const emoji    = (event as any).emoji || '';
  const price    = (event as any).price as number | null | undefined;
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

  const handleJoin = async () => {
    if (joining) return;
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
    if (price) {
      if ('vibrate' in navigator) navigator.vibrate(10);
      setShowPayment(true);
      return;
    }
    if (requestStatus === 'pending')  { alert('הבקשה שלך ממתינה לאישור'); return; }
    if (requestStatus === 'rejected') { alert('הבקשה נדחתה'); return; }
    setJoining(true);
    if ('vibrate' in navigator) navigator.vibrate(10);
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

  const joinLabel = isJoined ? 'ביטול השתתפות'
    : isFull ? 'האירוע מלא'
    : price ? 'קנה כרטיס'
    : requestStatus === 'pending'  ? '⏳ ממתין לאישור'
    : requestStatus === 'rejected' ? '❌ הבקשה נדחתה'
    : 'הצטרף לאירוע';
  const joinDisabled = (isFull && !isJoined) || joining ||
    (!price && (requestStatus === 'pending' || requestStatus === 'rejected'));

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
        style={{
          paddingTop: 'max(14px, env(safe-area-inset-top))',
          paddingBottom: 12,
          borderBottom: 'none',
        }}
      >
        {/* right: close */}
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full active:bg-gray-100 transition-colors"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2.2" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        {/* center: title */}
        <span className="text-[16px] font-black text-gray-900" style={{ fontFamily: 'Heebo, sans-serif' }}>
          פרטי האירוע
        </span>

        {/* left: share + bookmark */}
        <div className="flex items-center gap-1">
          <button className="w-9 h-9 flex items-center justify-center rounded-full active:bg-gray-100 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
          <button
            onClick={() => setSaved(s => !s)}
            className="w-9 h-9 flex items-center justify-center rounded-full active:bg-gray-100 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill={saved ? cat.accent : 'none'} stroke={saved ? cat.accent : '#6B7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

          {/* Location */}
          <div
            className="flex items-center gap-2 py-3.5"
            style={{  }}
          >
            <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: cat.accent }} />
            <span className="text-[13px] font-semibold" style={{ color: cat.accent }}>
              {flagEmoji(event.country ?? '')} {event.city}
            </span>
          </div>

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
              {!isOwner && (
                <button
                  className="px-5 py-2 rounded-full text-white text-[13px] font-bold active:scale-95 transition-transform"
                  style={{ background: '#111827', fontFamily: 'Heebo, sans-serif' }}
                >
                  הודעה
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
              <p className="text-[26px] font-black leading-none" style={{ color: cat.accent }}>
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
                      background: isFull ? '#ef4444' : spotsLeft <= 3 ? '#f97316' : cat.accent,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Map */}
          {event.latitude && event.longitude && (
            <div className="pt-4 pb-2">
              <p className="text-[11px] text-gray-400 font-semibold mb-2 tracking-wide uppercase">מפה</p>
              <div className="rounded-[16px] overflow-hidden relative" style={{ height: 180 }}>
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
                        fill={cat.accent}
                      />
                      <path d="M17.25 39C17.25 38.1716 16.5784 37.5 15.75 37.5C14.9216 37.5 14.25 38.1716 14.25 39C14.25 39.8284 14.9216 40.5 15.75 40.5C16.5784 40.5 17.25 39.8284 17.25 39Z" fill={cat.accent} />
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
                          <path d="M31.5 23.25C31.5 19.9363 28.8137 17.25 25.5 17.25C22.1863 17.25 19.5 19.9363 19.5 23.25C19.5 26.5637 22.1863 29.25 25.5 29.25V30C21.7721 30 18.75 26.9779 18.75 23.25C18.75 19.5221 21.7721 16.5 25.5 16.5C29.2279 16.5 32.25 19.5221 32.25 23.25C32.25 26.9779 29.2279 30 25.5 30V29.25C28.8137 29.25 31.5 26.5637 31.5 23.25Z" fill={cat.accent} />
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
              : `linear-gradient(135deg, ${cat.accent}, ${cat.accent}bb)`,
            boxShadow: joinDisabled || isJoined ? 'none' : `0 8px 24px ${cat.accent}55`,
          }}
        >
          {joining ? '...' : joinLabel}
        </button>
      </div>

      {/* ── Payment sheet ── */}
      {showPayment && (
        <>
          <div
            className="fixed inset-0 z-30"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }}
            onClick={() => setShowPayment(false)}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-40 bg-white"
            style={{
              borderRadius: '24px 24px 0 0',
              animation: 'payment-up 0.32s cubic-bezier(0.16,1,0.3,1)',
              paddingBottom: 'max(28px, env(safe-area-inset-bottom))',
            }}
          >
            <style>{`@keyframes payment-up { from { transform: translateY(100%) } to { transform: translateY(0) } }`}</style>

            {/* drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            {/* header */}
            <div className="px-5 pt-3 pb-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
              <p className="text-[18px] font-black text-gray-900 text-center" style={{ fontFamily: 'Heebo, sans-serif' }}>
                בחר אמצעי תשלום
              </p>
              <p className="text-[13px] text-gray-400 text-center mt-1">
                {event.title} · ₪{price}
              </p>
            </div>

            {/* options */}
            <div className="px-5 pt-4 flex flex-col gap-3">

              {/* Credit card */}
              <button
                className="w-full flex items-center gap-4 active:scale-[0.98] transition-transform"
                style={{ background: '#F9FAFB', border: '1.5px solid #E5E7EB', borderRadius: 16, padding: '14px 16px' }}
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-[10px] flex items-center justify-center" style={{ background: cat.light }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={cat.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                  </svg>
                </div>
                <span className="text-[15px] font-bold text-gray-900 flex-1 text-right" style={{ fontFamily: 'Heebo, sans-serif' }}>כרטיס אשראי</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M9 18l-6-6 6-6"/>
                </svg>
              </button>

              {/* Apple Pay */}
              <button
                className="w-full flex items-center gap-4 active:scale-[0.98] transition-transform"
                style={{ background: '#F9FAFB', border: '1.5px solid #E5E7EB', borderRadius: 16, padding: '14px 16px' }}
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-[10px] bg-black flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                </div>
                <span className="text-[15px] font-bold text-gray-900 flex-1 text-right" style={{ fontFamily: 'Heebo, sans-serif' }}>Apple Pay</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M9 18l-6-6 6-6"/>
                </svg>
              </button>

              {/* PayPal */}
              <button
                className="w-full flex items-center gap-4 active:scale-[0.98] transition-transform"
                style={{ background: '#F9FAFB', border: '1.5px solid #E5E7EB', borderRadius: 16, padding: '14px 16px' }}
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-[10px] flex items-center justify-center" style={{ background: '#003087' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                    <path d="M7.144 19.532l1.049-5.751c.11-.605.686-1.075 1.31-1.075h5.358c3.746 0 6.03-2.088 6.55-5.66.026-.169.039-.333.039-.494C21.45 4.22 19.454 3 16.544 3H8.502c-.63 0-1.205.434-1.32 1.044L4.527 18.532c-.117.61.352 1.19.98 1.19h1.295a.76.76 0 00.342-.19z"/>
                    <path opacity=".5" d="M19.447 8.125c-.527 3.467-2.756 5.432-6.354 5.432H11.3c-.624 0-1.185.454-1.299 1.055l-1.14 6.234a.754.754 0 00.742.891h2.48c.525 0 1.004-.363 1.1-.88l.461-2.53a1.11 1.11 0 011.1-.88h.698c3.163 0 5.289-1.742 5.73-4.834.198-1.354.01-2.461-.725-3.488z"/>
                  </svg>
                </div>
                <span className="text-[15px] font-bold text-gray-900 flex-1 text-right" style={{ fontFamily: 'Heebo, sans-serif' }}>PayPal</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M9 18l-6-6 6-6"/>
                </svg>
              </button>

              {/* Google Pay */}
              <button
                className="w-full flex items-center gap-4 active:scale-[0.98] transition-transform"
                style={{ background: '#F9FAFB', border: '1.5px solid #E5E7EB', borderRadius: 16, padding: '14px 16px' }}
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-[10px] flex items-center justify-center bg-white" style={{ border: '1.5px solid #E5E7EB' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                </div>
                <span className="text-[15px] font-bold text-gray-900 flex-1 text-right" style={{ fontFamily: 'Heebo, sans-serif' }}>Google Pay</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M9 18l-6-6 6-6"/>
                </svg>
              </button>

            </div>

            {/* cancel */}
            <div className="px-5 mt-3">
              <button
                onClick={() => setShowPayment(false)}
                className="w-full text-center text-[15px] font-semibold text-gray-400 py-3"
                style={{ fontFamily: 'Heebo, sans-serif' }}
              >
                ביטול
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
