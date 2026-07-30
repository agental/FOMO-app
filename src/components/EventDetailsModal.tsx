import { useState, useEffect, useRef } from 'react';
import { Calendar, MapPin, MessageCircle, Navigation, Pencil, Users, Trash2 } from 'lucide-react';
import { MapCreateEventFlow } from './MapCreateEventFlow';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { CityGroupChat } from './CityGroupChat';
import { supabase, type Event } from '../lib/supabase';
import type { TicketType } from '../types/event';
import { joinEventGroup, eventCountryCode, EVENT_GROUP_FALLBACK_EMOJI } from '../utils/eventGroup';
import { flagEmoji } from '../utils/flags';
import { UserAvatar } from './UserAvatar';
import { CachedImage } from './CachedImage';
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
  /** Called after the owner deletes the event (refresh lists); onClose is called as well. */
  onDeleted?: () => void;
  /** 'modal' (default) = full-screen; 'sheet' = Chabad-style bottom sheet (opens half, drag up to full). */
  variant?: 'modal' | 'sheet';
};

const CATEGORY_CONFIG: Record<string, { gradient: string; accent: string; light: string; image: string; label: string }> = {
  parties:   { gradient: 'from-violet-600 via-pink-500 to-rose-400',    accent: '#7C3AED', light: '#f5f3ff', image: 'https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg?auto=compress&cs=tinysrgb&w=800', label: 'מסיבה 🎉' },
  treks:     { gradient: 'from-green-400 via-emerald-500 to-teal-600',  accent: '#10b981', light: '#f0fdf4', image: 'https://images.pexels.com/photos/2662116/pexels-photo-2662116.jpeg?auto=compress&cs=tinysrgb&w=800', label: 'טרק 🏕️' },
  food:      { gradient: 'from-orange-400 via-amber-400 to-yellow-400', accent: '#f97316', light: '#fff7ed', image: 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=800', label: 'אוכל 🍔' },
  sports:    { gradient: 'from-blue-500 via-cyan-400 to-sky-400',       accent: '#3b82f6', light: '#eff6ff', image: 'https://images.pexels.com/photos/2884867/pexels-photo-2884867.jpeg?auto=compress&cs=tinysrgb&w=800', label: 'אטרקציות 🎡' },
  workshops: { gradient: 'from-yellow-400 via-amber-400 to-orange-400', accent: '#f59e0b', light: '#fffbeb', image: 'https://images.pexels.com/photos/3822622/pexels-photo-3822622.jpeg?auto=compress&cs=tinysrgb&w=800', label: 'סדנה 🧘' },
  yeshivot:  { gradient: 'from-indigo-500 via-violet-500 to-purple-600',accent: '#6366f1', light: '#eef2ff', image: 'https://images.pexels.com/photos/256541/pexels-photo-256541.jpeg?auto=compress&cs=tinysrgb&w=800', label: 'ישיבה 📖' },
};
const DEFAULT_CONFIG = { gradient: 'from-slate-500 via-gray-500 to-zinc-600', accent: '#F97316', light: '#fff7ed', image: '', label: 'אירוע 📅' };

export function EventDetailsModal({ event, onClose, currentUserId: propUserId, onNavigateToUserProfile, onOpenMapAt, onMessageUser, onDeleted, variant = 'modal' }: EventDetailsModalProps) {
  const [attendees, setAttendees]     = useState<Attendee[]>([]);
  const [isJoined, setIsJoined]       = useState(false);
  const [requestStatus, setRequestStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');
  const [joining, setJoining]         = useState(false);
  const [approvedToast, setApprovedToast] = useState(false);
  const [pendingToast, setPendingToast]   = useState(false);
  const [rejectedToast, setRejectedToast] = useState(false);
  const [showGroup, setShowGroup]     = useState(false);
  const [me, setMe]                   = useState<{ name: string; avatar: string | null }>({ name: 'אני', avatar: null });
  const [saved, setSaved]             = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  /* ── bottom-sheet mode (variant='sheet'): the SAME snap machine as the place sheet — three detents
     (peek / half / full), scroll-to-expand, and drag-down to close, so an event feels identical. ── */
  const winH = typeof window !== 'undefined' ? window.innerHeight : 800;
  const SHEET_FULL = Math.round(winH * 0.92);
  const SHEET_HALF = Math.round(winH * 0.55);
  const SHEET_PEEK = Math.round(winH * 0.27);
  const OFF_HALF   = SHEET_FULL - SHEET_HALF;
  const OFF_PEEK   = SHEET_FULL - SHEET_PEEK;
  const [snap, setSnap]       = useState<'peek' | 'half' | 'full'>('half');
  const [dragDy, setDragDy]   = useState(0);
  const [dragging, setDragging] = useState(false);
  const [entered, setEntered] = useState(false);
  const dragStartY = useRef(0);
  const cardDrag   = useRef(false);
  const lastY      = useRef(0);

  useEffect(() => {
    if (variant !== 'sheet') return;
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [variant]);

  const closeSheet = () => { setEntered(false); setTimeout(onClose, 320); };

  // Swipe from an edge closes the card — and, being on top of the stack, intercepts the swipe so the
  // screen underneath (e.g. a chat) doesn't navigate back while the card is still open.
  useSwipeBack(() => { if (variant === 'sheet') closeSheet(); else onClose(); });

  const basePx = snap === 'full' ? 0 : snap === 'half' ? OFF_HALF : OFF_PEEK;
  const sheetTranslate = !entered ? SHEET_FULL : Math.min(SHEET_FULL, Math.max(0, basePx + dragDy));

  const UP = -55, DOWN = 90;
  const onDragEnd = () => {
    const d = dragDy;
    setDragging(false); setDragDy(0);
    if (snap === 'full') {
      if (d >= 120) { setSnap('half'); scrollRef.current?.scrollTo({ top: 0 }); }
    } else if (snap === 'half') {
      if (d <= UP) setSnap('full');
      else if (d >= DOWN) setSnap('peek');
    } else { // peek
      if (d <= UP) setSnap('half');
      else if (d >= DOWN) closeSheet();
    }
  };
  const onMouseDown = (e: React.MouseEvent) => { dragStartY.current = e.clientY; setDragging(true); };

  /* One finger, two jobs: scroll the content, or move the whole card. The card takes over the moment
     the content underneath has no scroll left to give — hand-off happens mid-gesture. */
  const onContentTouchStart = (e: React.TouchEvent) => {
    const y = e.touches[0].clientY;
    dragStartY.current = y; lastY.current = y;
    const inScroll = !!scrollRef.current && scrollRef.current.contains(e.target as Node);
    cardDrag.current = !inScroll || snap !== 'full' || (scrollRef.current?.scrollTop ?? 0) <= 0;
  };
  const onContentTouchMove = (e: React.TouchEvent) => {
    const y = e.touches[0].clientY;
    const goingDown = y > lastY.current;
    lastY.current = y;
    if (!cardDrag.current) {
      if (goingDown && (scrollRef.current?.scrollTop ?? 0) <= 0) { cardDrag.current = true; dragStartY.current = y; }
      else return;
    }
    const dy = y - dragStartY.current;
    if (snap === 'full' && dy < 0) { cardDrag.current = false; setDragging(false); setDragDy(0); return; }
    setDragging(true); setDragDy(dy);
  };
  const onContentTouchEnd = () => {
    if (!cardDrag.current) return;
    cardDrag.current = false;
    if (dragging) onDragEnd();
  };
  const onContentWheel = (e: React.WheelEvent) => {
    if (e.deltaY <= 0) return;
    if (snap === 'peek') setSnap('half');
    else if (snap === 'half') setSnap('full');
  };

  useEffect(() => {
    if (!dragging) return;
    const move = (e: MouseEvent) => setDragDy(e.clientY - dragStartY.current);
    const up   = () => onDragEnd();
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    return () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
  }, [dragging, dragDy, snap]);

  const currentUserId = propUserId || null;
  const isOwner  = event.user_id === currentUserId;
  const cat      = event.event_type ? (CATEGORY_CONFIG[event.event_type] ?? DEFAULT_CONFIG) : DEFAULT_CONFIG;
  const heroImg  = event.image_url || cat.image;
  const emoji    = (event as any).emoji || '';
  const price    = (event as any).price as number | null | undefined;
  const ticketTypes = (((event as any).ticket_types as TicketType[] | undefined) || []).filter(t => t && t.price > 0);
  const hasTickets  = ticketTypes.length > 0;
  const multiTicket = ticketTypes.length > 1;
  // Entry (lowest) price — from the ticket types when present, else the legacy single price.
  const entryPrice  = hasTickets ? Math.min(...ticketTypes.map(t => t.price)) : (price || 0);
  const priced      = hasTickets || !!(price && price > 0);
  const hasGroup    = !!(event as any).has_group;
  const isUnlimited = event.max_attendees >= 9999;
  const spotsLeft   = isUnlimited ? Infinity : event.max_attendees - event.attendees.length;
  const isFull      = !isUnlimited && spotsLeft === 0;
  const creator     = (event as any).users as { display_name: string; avatar_url: string | null } | null;

  useEffect(() => {
    fetchAttendees();
    setIsJoined(event.attendees.includes(currentUserId ?? ''));
    checkRequest();

    if (!currentUserId || isOwner) return;

    // Listen for the organizer approving / rejecting this user's join request in real-time
    const channel = supabase
      .channel(`join-request-${event.id}-${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'event_join_requests',
          filter: `event_id=eq.${event.id}`,
        },
        (payload) => {
          const row = payload.new as { user_id: string; status: string };
          if (row.user_id !== currentUserId) return;
          setRequestStatus(row.status as 'none' | 'pending' | 'approved' | 'rejected');
          if (row.status === 'approved') {
            // organizer approved → they added us to attendees → we're in.
            fetchAttendees();
            setIsJoined(true);
            // event has a group → auto-join it (server-side RPC) so it shows in Messages.
            if (hasGroup && currentUserId) joinEventGroup(event).catch(() => {});
            setApprovedToast(true);
            setTimeout(() => setApprovedToast(false), 4500);
            if ('vibrate' in navigator) navigator.vibrate([30, 60, 30]);
          } else if (row.status === 'rejected') {
            // organizer rejected → a paid ticket is refunded (simulated).
            setRejectedToast(true);
            setTimeout(() => setRejectedToast(false), 5000);
            if ('vibrate' in navigator) navigator.vibrate([60, 40, 60]);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [event.id, currentUserId]);

  // Event group: load our profile for the chat, and auto-join once we're a member/owner
  // (covers approvals that happened while this page was closed).
  useEffect(() => {
    if (!currentUserId || !hasGroup) return;
    supabase.from('users').select('display_name, avatar_url').eq('id', currentUserId).maybeSingle()
      .then(({ data }) => { if (data) setMe({ name: data.display_name || 'אני', avatar: data.avatar_url ?? null }); });
    if (isOwner || event.attendees.includes(currentUserId)) {
      joinEventGroup(event).catch(() => {});
    }
  }, [event.id, currentUserId, hasGroup, isJoined]);

  // Ensure membership, then open the event's group chat.
  const openEventGroup = async () => {
    if (!currentUserId) return;
    await joinEventGroup(event);
    setShowGroup(true);
  };

  const checkRequest = async () => {
    if (!currentUserId || isOwner) return;
    try {
      const { data } = await supabase
        .from('event_join_requests').select('status')
        .eq('event_id', event.id).eq('user_id', currentUserId).maybeSingle();
      if (data) setRequestStatus(data.status as any);
    } catch (e) {
      console.error('[EventDetailsModal] checkRequest failed:', e);
    }
  };

  const fetchAttendees = async () => {
    if (!event.attendees?.length) return;
    try {
      const { data } = await supabase
        .from('users').select('id, display_name, current_country, avatar_url')
        .in('id', event.attendees);
      setAttendees((data || []).map(u => ({
        id: u.id, display_name: u.display_name, country: u.current_country || 'IL',
        city: null, avatar_url: u.avatar_url,
      })));
    } catch (e) {
      console.error('[EventDetailsModal] fetchAttendees failed:', e);
    }
  };

  // Create the (pending) join request — AFTER payment for a paid event. The buyer is NOT
  // added to attendees here; the organizer's approval does that (RequestsScreen). This is the
  // "pay first → wait for approval → refund on reject" model, applied to every event.
  const createPendingRequest = async (paymentInfo?: { ticketLabel: string; amount: number }) => {
    if (!currentUserId) return;
    // Re-check live so we never clobber an existing row (approval may have arrived).
    const { data: live } = await supabase
      .from('event_join_requests').select('status')
      .eq('event_id', event.id).eq('user_id', currentUserId).maybeSingle();
    if (live) {
      setRequestStatus(live.status as 'none' | 'pending' | 'approved' | 'rejected');
      if (live.status === 'pending') { setPendingToast(true); setTimeout(() => setPendingToast(false), 4500); }
      return;
    }
    const { error } = await supabase.from('event_join_requests').insert({
      event_id: event.id, user_id: currentUserId, status: 'pending',
      ...(paymentInfo ? { paid_amount: paymentInfo.amount, ticket_label: paymentInfo.ticketLabel } : {}),
    });
    if (!error) {
      setRequestStatus('pending');
      setPendingToast(true);
      if ('vibrate' in navigator) navigator.vibrate([20, 40]);
      setTimeout(() => setPendingToast(false), 4500);
    } else {
      console.error('[EventDetailsModal] create request failed:', error);
      alert('שגיאה בשליחת הבקשה, נסה שוב.');
    }
  };

  // Called after a CONFIRMED payment. The payments-webhook already created the pending,
  // paid join request server-side (that's the source of truth that money actually moved) —
  // so here we only refresh our view of the request and show the pending state, never insert.
  const completePayment = async () => {
    if (joining) return;
    setJoining(true);
    if ('vibrate' in navigator) navigator.vibrate(15);
    try {
      await checkRequest();          // pull the request the webhook just created
      setRequestStatus('pending');
      setShowPayment(false);
      setPendingToast(true);
      setTimeout(() => setPendingToast(false), 4500);
    } finally { setJoining(false); }
  };

  const handleJoin = async () => {
    if (joining) return;
    if (!currentUserId) { alert('יש להתחבר כדי להצטרף לאירוע'); return; }

    // Leave — approved attendee cancels their participation (also drops the request row).
    if (isJoined) {
      setJoining(true);
      if ('vibrate' in navigator) navigator.vibrate(10);
      try {
        const updated = event.attendees.filter(id => id !== currentUserId);
        const { error } = await supabase.from('events').update({ attendees: updated }).eq('id', event.id);
        if (error) throw error;
        const { error: reqErr } = await supabase.from('event_join_requests').delete().eq('event_id', event.id).eq('user_id', currentUserId);
        if (reqErr) console.error('[EventDetailsModal] delete join_request failed:', reqErr);
        setIsJoined(false); setRequestStatus('none');
        fetchAttendees();
      } catch (e) {
        console.error('[EventDetailsModal] leave failed:', e);
        alert('שגיאה, נסה שוב.');
      } finally { setJoining(false); }
      return;
    }

    if (isFull) return;
    // Already in a decided/awaiting state — the button is disabled in these, but guard anyway.
    if (requestStatus === 'pending' || requestStatus === 'rejected' || requestStatus === 'approved') return;

    // status === 'none' → request to join. Paid event pays first; the request is created on success.
    if ('vibrate' in navigator) navigator.vibrate(10);
    if (priced) { setShowPayment(true); return; }
    setJoining(true);
    try { await createPendingRequest(); } finally { setJoining(false); }
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

  // Every event now requires the organizer's approval (pay first → pending → approve/reject).
  const buyLabel = multiTicket ? 'בחר כרטיס' : `קנה כרטיס · ₪${entryPrice}`;
  const joinLabel = isJoined ? 'ביטול השתתפות'
    : isFull ? 'האירוע מלא'
    : requestStatus === 'pending'  ? '⏳ ממתין לאישור המארגן'
    : requestStatus === 'rejected' ? (priced ? '❌ נדחתה — התשלום הוחזר' : '❌ הבקשה נדחתה')
    : requestStatus === 'approved' ? '✓ אושרת'
    : priced ? buyLabel
    : 'בקש להצטרף';
  const joinDisabled = (isFull && !isJoined) || joining ||
    requestStatus === 'pending' || requestStatus === 'rejected';

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
              <CachedImage
                url={heroImg} alt={event.title}
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

          {/* Event group chat — members & owner only */}
          {hasGroup && (isOwner || isJoined) && (
            <button
              onClick={openEventGroup}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-[15px] active:scale-[0.98] transition-transform mt-1"
              style={{ fontFamily: 'Heebo, sans-serif', color: '#F97316', background: '#FFF4E8', border: '1px solid #FFE0C2' }}
            >
              <Users size={18} strokeWidth={2.5} />
              קבוצת הצ׳אט של האירוע
            </button>
          )}

          {/* Price / spots */}
          <div
            className="flex items-center justify-between py-3.5"
            style={{  }}
          >
            <div>
              <p className="text-[11px] text-gray-400 font-medium mb-0.5">{multiTicket ? 'החל מ־' : 'כרטיס'}</p>
              <p className="text-[26px] font-black leading-none" style={{ color: '#F97316' }}>
                {priced ? `₪${entryPrice}` : 'חינם'}
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

          {/* Ticket options — the buyer picks one when tapping "בחר כרטיס" */}
          {multiTicket && (
            <div className="pt-1 pb-2">
              <p className="text-[11px] text-gray-400 font-semibold mb-2 tracking-wide uppercase">סוגי כרטיסים</p>
              <div className="space-y-2">
                {ticketTypes.map(t => (
                  <div key={t.id} className="flex items-center justify-between bg-gray-50 rounded-[14px] px-4 py-3 border border-black/[0.04]">
                    <span className="text-[14px] font-bold text-gray-900" style={{ fontFamily: 'Heebo, sans-serif' }}>{t.name}</span>
                    <span className="text-[15px] font-black" style={{ color: '#F97316' }}>₪{t.price}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

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

  const soldOut = isFull && !isJoined;

  // Owner deletes their own event (RLS allows it). Requests cascade in the DB.
  const handleDeleteEvent = async () => {
    if (deleting) return;
    if (!confirm('למחוק את האירוע? כל המשתתפים והבקשות יוסרו — אי אפשר לבטל.')) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('events').delete().eq('id', event.id);
      if (error) throw error;
      onDeleted?.();
      onClose();
    } catch (e) {
      console.error('[EventDetailsModal] delete failed:', e);
      alert('שגיאה במחיקת האירוע, נסה שוב.');
      setDeleting(false);
    }
  };

  const joinButton = isOwner ? (
    // Owner sees Edit + Delete instead of join
    <div className="w-full flex items-center gap-2.5">
      <button
        onClick={() => setShowEdit(true)}
        className="flex-1 font-black text-[17px] text-white active:scale-[0.97] transition-transform flex items-center justify-center gap-2"
        style={{
          fontFamily: 'Heebo, sans-serif',
          height: 56,
          borderRadius: 28,
          background: 'linear-gradient(135deg,#1f2937,#374151)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
        }}
      >
        <Pencil size={18} strokeWidth={2.5} />
        ערוך אירוע
      </button>
      <button
        onClick={handleDeleteEvent}
        disabled={deleting}
        aria-label="מחק אירוע"
        className="flex-shrink-0 flex items-center justify-center active:scale-[0.95] transition-transform disabled:opacity-50"
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          background: '#FEF2F2',
          border: '1.5px solid #FECACA',
        }}
      >
        {deleting
          ? <span className="text-[12px] font-bold" style={{ color: '#EF4444' }}>...</span>
          : <Trash2 size={20} strokeWidth={2.2} style={{ color: '#EF4444' }} />}
      </button>
    </div>
  ) : (
    <button
      onClick={handleJoin}
      disabled={joinDisabled}
      className="w-full font-black text-[17px] active:scale-[0.97] transition-transform disabled:cursor-not-allowed"
      style={{
        fontFamily: 'Heebo, sans-serif',
        height: 56,
        borderRadius: 28,
        color: soldOut ? '#6B7280' : 'white',
        background: soldOut
          ? '#F3F4F6'
          : isJoined
            ? 'linear-gradient(135deg,#ef4444,#dc2626)'
            : joinDisabled ? '#D1D5DB'
            : `linear-gradient(135deg, ${'#F97316'}, ${'#F97316'}bb)`,
        boxShadow: soldOut || joinDisabled || isJoined ? 'none' : `0 8px 24px ${'#F97316'}55`,
        border: soldOut ? '2px solid #E5E7EB' : 'none',
      }}
    >
      {joining ? '...' : soldOut ? '🔴 Sold Out' : joinLabel}
    </button>
  );

  const extras = (
    <>
      {showGroup && currentUserId && (
        <CityGroupChat
          countryCode={eventCountryCode(event.id)}
          countryFlag={(event as any).emoji || EVENT_GROUP_FALLBACK_EMOJI}
          cityName={event.title || 'אירוע'}
          cityEmoji={(event as any).emoji || EVENT_GROUP_FALLBACK_EMOJI}
          currentUserId={currentUserId}
          currentUserName={me.name}
          currentUserAvatar={me.avatar}
          onClose={() => setShowGroup(false)}
          onNavigateToUserProfile={onNavigateToUserProfile}
        />
      )}
      {showPayment && (
        <BookingFlow
          event={event}
          price={entryPrice}
          ticketTypes={hasTickets ? ticketTypes : undefined}
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
      {showEdit && isOwner && currentUserId && (
        <MapCreateEventFlow
          isOpen={showEdit}
          onClose={() => setShowEdit(false)}
          onSuccess={() => setShowEdit(false)}
          userId={currentUserId}
          existingEvent={event as any}
          initialLocation={event.latitude != null ? { latitude: event.latitude, longitude: event.longitude } : undefined}
        />
      )}
    </>
  );

  /* ── Bottom-sheet variant (Chabad-style frame; opens to half, drag up to full) ── */
  if (variant === 'sheet') {
    return (
      <>
        {/* Transparent backdrop — the map stays fully visible behind the half-sheet (no black tint),
            matching the place/Chabad sheet. Still catches a tap-outside to dismiss. */}
        <div
          className="fixed inset-0 z-50"
          onClick={closeSheet}
        />
        <div
          dir="rtl"
          className="fixed left-0 right-0 bottom-0 bg-white rounded-t-3xl shadow-2xl z-50 overflow-hidden"
          style={{
            height: SHEET_FULL,
            transform: `translateY(${sheetTranslate}px)`,
            transition: dragging ? 'none' : 'transform 0.34s cubic-bezier(0.22,1,0.3,1)',
            display: 'flex', flexDirection: 'column',
          }}
          onTouchStart={onContentTouchStart}
          onTouchMove={onContentTouchMove}
          onTouchEnd={onContentTouchEnd}
          onWheel={onContentWheel}
        >
          {/* drag handle */}
          <div
            className="w-full pt-3 pb-2 flex justify-center cursor-grab active:cursor-grabbing"
            style={{ flexShrink: 0, touchAction: 'none' }}
            onMouseDown={onMouseDown}
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
            style={{
              flex: '1 1 auto', minHeight: 0,
              paddingBottom: 100,
              // Scrolls only when the card is full and not being dragged — otherwise the card moves,
              // not the content (and iOS can't rubber-band the body inside the sheet).
              overflowY: snap === 'full' && !dragging ? 'auto' : 'hidden',
              overscrollBehavior: 'none',
              touchAction: snap === 'full' && !dragging ? 'pan-y' : 'none',
            }}
          >
            {detailBody}
          </div>
        </div>

        {/* CTA pinned to the viewport (sibling of the sheet). Hidden at peek so it doesn't float over
            the map while the card is tucked away. */}
        <div
          className="fixed bottom-0 left-0 right-0 z-[60] bg-white px-5"
          style={{
            paddingTop: 14,
            paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
            boxShadow: '0 -2px 16px rgba(0,0,0,0.08)',
            transform: entered && snap !== 'peek' ? 'translateY(0)' : 'translateY(100%)',
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
        @keyframes edm-toast { 0% { opacity:0; transform:translateY(-12px) } 15% { opacity:1; transform:translateY(0) } 80% { opacity:1 } 100% { opacity:0 } }
      `}</style>

      {/* ── Approval toast ── */}
      {approvedToast && (
        <div
          className="fixed top-16 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 px-4 py-3 rounded-2xl shadow-lg text-white text-[14px] font-bold"
          style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', animation: 'edm-toast 4.5s ease forwards', whiteSpace: 'nowrap' }}
        >
          <span>✅</span>
          <span>{hasGroup ? 'אושרת! נוספת לקבוצת הצ׳אט של האירוע 💬' : 'אושרת לאירוע! נתראה שם 🎉'}</span>
        </div>
      )}

      {/* ── Pending (awaiting approval) toast ── */}
      {pendingToast && (
        <div
          className="fixed top-16 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 px-4 py-3 rounded-2xl shadow-lg text-white text-[14px] font-bold"
          style={{ background: 'linear-gradient(135deg,#F59E0B,#D97706)', animation: 'edm-toast 4.5s ease forwards', whiteSpace: 'nowrap' }}
        >
          <span>⏳</span>
          <span>{priced ? 'הכרטיס נרכש! ממתין לאישור המארגן' : 'הבקשה נשלחה! ממתין לאישור המארגן'}</span>
        </div>
      )}

      {/* ── Rejected (refund) toast ── */}
      {rejectedToast && (
        <div
          className="fixed top-16 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 px-4 py-3 rounded-2xl shadow-lg text-white text-[14px] font-bold"
          style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', animation: 'edm-toast 5s ease forwards', whiteSpace: 'nowrap' }}
        >
          <span>↩️</span>
          <span>{priced ? 'הבקשה נדחתה — התשלום הוחזר' : 'הבקשה נדחתה על ידי המארגן'}</span>
        </div>
      )}

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
          {isOwner && (
            <button
              onClick={() => setShowEdit(true)}
              aria-label="ערוך אירוע"
              className="w-10 h-10 flex items-center justify-center rounded-full active:bg-gray-100 transition-colors"
              style={{ touchAction: 'manipulation' }}
            >
              <Pencil size={18} color="#F97316" strokeWidth={2} />
            </button>
          )}
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
        style={{ height: 'calc(100% - 57px)', paddingBottom: 100 }}
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
