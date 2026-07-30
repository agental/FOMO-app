import { useState, useEffect, useRef, useId } from 'react';
import { X, Phone, Globe, Navigation, Share2, Star, Send, ChevronDown, ChevronUp, Trash2, Heart, Images, ImageOff, Copy, Plus, Loader2 } from 'lucide-react';
import { type AdminLocation, supabase } from '../lib/supabase';
import { OpenLocationSheet } from './OpenLocationSheet';
import { WebViewModal } from './WebViewModal';
import { UserAvatar } from './UserAvatar';
import { ShareToChatSheet } from './ShareToChatSheet';
import { encodePlace } from '../utils/placeMessage';
import { calculateDistance } from '../utils/distance';
import { placeCategory } from '../utils/placeCategory';
import { placePinColor } from '../utils/placePinColor';
import { loadPlaceSavers, toggleSavedPlace, type PlaceSaver } from '../services/savedPlacesService';

/**
 * The place sheet. Opens at HALF and drags to FULL (same snap machine as EventDetailsModal).
 *
 * Reads top-down like the reference: a big name with a share + save ribbon, the address, a row of
 * facts (how many saved it · how far · photos), the description, a row of actions led by a hanging
 * OPEN sign, then who loved it, then reviews. Tapping "תמונות" throws the gallery full-screen.
 */
interface AdminLocationBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  location: AdminLocation | null;
  currentUserId?: string;
  userLocation?: { latitude: number; longitude: number } | null;
}

interface Review {
  id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  users?: { display_name: string; avatar_url?: string | null };
}

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HEEBO = "'Heebo', sans-serif";
const INK   = '#111827';
const MUTED = '#9AA0AC';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getOpenStatus(hours: Record<string, { open: string; close: string; closed: boolean }> | null | undefined) {
  if (!hours) return null;
  const now = new Date();
  const today = hours[now.getDay().toString()];
  if (!today) return null;
  if (today.closed) return { isOpen: false, todayOpen: null, todayClose: null };
  const cur = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  return { isOpen: cur >= today.open && cur <= today.close, todayOpen: today.open, todayClose: today.close };
}

/** Star row. `uid` keeps the half-star gradient id unique across instances. */
function Stars({ rating, size = 13, uid }: { rating: number; size?: number; uid: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = i < Math.floor(rating);
        const isHalf = !filled && i === Math.floor(rating) && rating - Math.floor(rating) >= 0.5;
        const gid = `${uid}-star-${i}`;
        return (
          <svg key={i} viewBox="0 0 20 20" width={size} height={size} className="flex-shrink-0">
            {isHalf && (
              <defs>
                <linearGradient id={gid}>
                  <stop offset="50%" stopColor="#F59E0B" />
                  <stop offset="50%" stopColor="#D1D5DB" />
                </linearGradient>
              </defs>
            )}
            <polygon
              points="10,1 12.9,7 19.5,7.6 14.5,12 16.2,18.5 10,15 3.8,18.5 5.5,12 0.5,7.6 7.1,7"
              fill={filled ? '#F59E0B' : isHalf ? `url(#${gid})` : '#D1D5DB'}
            />
          </svg>
        );
      })}
    </div>
  );
}

/** The open/closed status as a little sign hanging off two strings. */
function HangingSign({ open, sub }: { open: boolean; sub?: string | null }) {
  const color = open ? '#15A150' : '#EF4444';
  const bg    = open ? '#E8F8EE' : '#FDECEC';
  return (
    <div style={{ position: 'relative', flexShrink: 0, paddingTop: 10 }}>
      <svg
        width="100%" height="11" viewBox="0 0 100 11" preserveAspectRatio="none"
        style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}
        aria-hidden
      >
        <line x1="50" y1="1.5" x2="13" y2="11" stroke="#CFD3DC" strokeWidth="1.1" vectorEffect="non-scaling-stroke" />
        <line x1="50" y1="1.5" x2="87" y2="11" stroke="#CFD3DC" strokeWidth="1.1" vectorEffect="non-scaling-stroke" />
      </svg>
      <span style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translate(-50%,-50%)',
        width: 6, height: 6, borderRadius: '50%', background: '#fff', boxShadow: 'inset 0 0 0 1.2px #CFD3DC',
      }} />
      <div style={{ background: bg, borderRadius: 15, padding: '7px 18px', textAlign: 'center' }}>
        <div style={{ fontSize: 13.5, fontWeight: 900, color, fontFamily: HEEBO, lineHeight: 1.15 }}>
          {open ? 'פתוח' : 'סגור'}
        </div>
        {sub && (
          <div style={{ fontSize: 10.5, fontWeight: 700, color, opacity: 0.75, fontFamily: HEEBO, marginTop: 1, whiteSpace: 'nowrap' }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Apple-style photo mosaic: one big photo on the right with up to two stacked on the left, and a
 * "+N" veil on the last when there are more. Keeps its shape (and the space) even with no photos —
 * then it's muted skeleton squares, so the card never jumps between a place with and without pics.
 */
function PhotoMosaic({ photos, color, canAdd, uploading, onOpen, onAdd }: {
  photos: string[]; color: string; canAdd: boolean; uploading: boolean;
  onOpen: (i: number) => void; onAdd: () => void;
}) {
  const H = 178, GAP = 6, RADIUS = 18;
  const cell = (child: React.ReactNode, key: React.Key, onClick?: () => void): React.ReactNode => (
    <button
      key={key} onClick={onClick} disabled={!onClick}
      style={{
        position: 'relative', flex: 1, minHeight: 0, width: '100%', padding: 0, border: 'none',
        background: '#EEF0F3', cursor: onClick ? 'pointer' : 'default', overflow: 'hidden',
      }}
    >
      {child}
    </button>
  );

  const img = (src: string) => (
    <img src={src} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
  );

  // Empty state — skeleton squares + (admins) an add button.
  if (photos.length === 0) {
    const skeleton = (label?: React.ReactNode, onClick?: () => void) => (
      <div
        onClick={onClick}
        style={{
          flex: 1, minHeight: 0, background: '#F1F2F5', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 5, cursor: onClick ? 'pointer' : 'default',
        }}
      >
        {label}
      </div>
    );
    return (
      <div style={{ display: 'flex', gap: GAP, height: H, borderRadius: RADIUS, overflow: 'hidden' }} dir="rtl">
        {skeleton(
          canAdd
            ? (uploading
                ? <Loader2 size={22} className="animate-spin" color={color} />
                : <><Plus size={26} strokeWidth={2.4} color={color} /><span style={{ fontSize: 13, fontWeight: 800, color, fontFamily: HEEBO }}>הוסף תמונה</span></>)
            : <><ImageOff size={22} strokeWidth={1.8} color="#C4C9D2" /><span style={{ fontSize: 12.5, fontWeight: 700, color: '#A6ACB8', fontFamily: HEEBO }}>אין תמונות עדיין</span></>,
          canAdd && !uploading ? onAdd : undefined,
        )}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: GAP, minWidth: 0 }}>
          {skeleton(<Images size={18} strokeWidth={1.8} color="#CDD2DB" />)}
          {skeleton(<Images size={18} strokeWidth={1.8} color="#CDD2DB" />)}
        </div>
      </div>
    );
  }

  // One photo → full-width hero.
  if (photos.length === 1) {
    return (
      <div style={{ height: H, borderRadius: RADIUS, overflow: 'hidden' }} dir="rtl">
        {cell(img(photos[0]), 0, () => onOpen(0))}
      </div>
    );
  }

  const rightCount = Math.min(photos.length - 1, 2); // 1 or 2 stacked cells beside the hero
  return (
    <div style={{ display: 'flex', gap: GAP, height: H, borderRadius: RADIUS, overflow: 'hidden' }} dir="rtl">
      {/* hero */}
      <div style={{ flex: 1.55, minWidth: 0, display: 'flex' }}>
        {cell(img(photos[0]), 'hero', () => onOpen(0))}
      </div>
      {/* stacked column */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: GAP }}>
        {Array.from({ length: rightCount }).map((_, k) => {
          const i = k + 1;
          const isLast = k === rightCount - 1;
          const extra = photos.length - 3;
          return cell(
            <>
              {img(photos[i])}
              {isLast && extra > 0 && (
                <span style={{
                  position: 'absolute', inset: 0, background: 'rgba(17,24,39,0.5)',
                  display: 'grid', placeItems: 'center', color: '#fff', fontSize: 20, fontWeight: 900, fontFamily: HEEBO,
                }}>
                  +{extra}
                </span>
              )}
            </>,
            i,
            () => onOpen(i),
          );
        })}
      </div>
    </div>
  );
}

const pillBase: React.CSSProperties = {
  flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
  background: '#F1F2F5', border: 'none', borderRadius: 50, padding: '9px 15px',
  fontSize: 13, fontWeight: 800, color: INK, fontFamily: HEEBO, cursor: 'pointer',
};

export function AdminLocationBottomSheet({ isOpen, onClose, location, currentUserId, userLocation }: AdminLocationBottomSheetProps) {
  const uid = useId();
  // A tapped base-map POI is fed in as a synthetic place keyed by a text id (not an admin_locations
  // uuid). Its photos/upload live only on real admin places; save + reviews work for both.
  const isRealPlace = !!location && UUID_RE.test(location.id);

  /* ── sheet snap machine: three detents, like Apple Maps ──
     peek  — title + address only; the map is yours again
     half  — the card, opened here
     full  — everything                                                                     */
  const winH = typeof window !== 'undefined' ? window.innerHeight : 800;
  const SHEET_FULL = Math.round(winH * 0.92);
  const SHEET_HALF = Math.round(winH * 0.55);
  const SHEET_PEEK = Math.round(winH * 0.27);
  const OFF_HALF   = SHEET_FULL - SHEET_HALF; // how far down the sheet sits at each detent
  const OFF_PEEK   = SHEET_FULL - SHEET_PEEK;

  const [snap, setSnap]         = useState<'peek' | 'half' | 'full'>('half');
  const [dragDy, setDragDy]     = useState(0);
  const [dragging, setDragging] = useState(false);
  const [entered, setEntered]   = useState(false);
  const dragStartY = useRef(0);
  const scrollRef  = useRef<HTMLDivElement>(null);
  const cardDrag   = useRef(false);
  const lastY      = useRef(0);

  const [showFullHours, setShowFullHours] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const [webUrl, setWebUrl]   = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null); // index being viewed, or null
  const [showShare, setShowShare] = useState(false);
  const [savers, setSavers]   = useState<PlaceSaver[]>([]);
  const [photos, setPhotos]   = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /* reviews */
  const [reviews, setReviews]                 = useState<Review[]>([]);
  const [myRating, setMyRating]               = useState(0);
  const [hoverRating, setHoverRating]         = useState(0);
  const [myComment, setMyComment]             = useState('');
  const [submitting, setSubmitting]           = useState(false);
  const [reviewError, setReviewError]         = useState('');
  const [myExistingReview, setMyExistingReview] = useState<Review | null>(null);
  const [isAdmin, setIsAdmin]                 = useState(false);

  useEffect(() => {
    if (currentUserId) {
      supabase.from('users').select('role').eq('id', currentUserId).single()
        .then(({ data }) => setIsAdmin(data?.role === 'admin'));
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!isOpen || !location) return;
    setSnap('half'); setDragDy(0); setEntered(false);
    setShowFullHours(false); setShowNav(false); setWebUrl(null); setLightbox(null);
    // Seed instantly from the (possibly stale) prop so the mosaic paints…
    setPhotos(location.place_photos?.length ? location.place_photos
      : location.place_photo_url ? [location.place_photo_url]
      : location.image_url ? [location.image_url] : []);
    // …then refresh from the DB, so photos an admin added earlier are always remembered even if the
    // map's copy of this place hasn't reloaded yet.
    if (isRealPlace) {
      supabase.from('admin_locations').select('place_photos').eq('id', location.id).maybeSingle()
        .then(({ data }) => { if (data?.place_photos?.length) setPhotos(data.place_photos); });
    }
    fetchReviews();
    loadPlaceSavers(location.id).then(setSavers);
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [isOpen, location?.id]);

  /* Admins can add photos to a place (RLS only lets admins UPDATE admin_locations). Uploads every
     picked file to the shared `images` bucket, then writes the whole list back to place_photos in
     one update — so a refresh (or reopening the sheet) always finds them. */
  const addPhotos = async (files: FileList) => {
    if (!location || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop() || 'jpg';
        const key = `place-photos/${location.id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const { error: upErr } = await supabase.storage.from('images').upload(key, file, { cacheControl: '3600', upsert: false });
        if (upErr) { console.error('photo upload:', upErr.message); continue; }
        uploaded.push(supabase.storage.from('images').getPublicUrl(key).data.publicUrl);
      }
      if (uploaded.length === 0) { alert('העלאת התמונות נכשלה'); return; }

      const next = [...photos, ...uploaded];
      const { error: dbErr } = await supabase.from('admin_locations').update({ place_photos: next }).eq('id', location.id);
      if (dbErr) { alert('רק מנהל יכול להוסיף תמונות כאן'); return; }
      setPhotos(next); // persisted — reopening will refetch the same list
    } finally {
      setUploading(false);
    }
  };

  const fetchReviews = async () => {
    if (!location) return;
    const { data } = await supabase
      .from('location_reviews')
      .select('*, users(display_name, avatar_url)')
      .eq('location_id', location.id)
      .order('created_at', { ascending: false });
    if (data) {
      setReviews(data);
      if (currentUserId) {
        const mine = data.find(r => r.user_id === currentUserId) || null;
        setMyExistingReview(mine);
        if (mine) { setMyRating(mine.rating); setMyComment(mine.comment || ''); }
        else { setMyRating(0); setMyComment(''); }
      }
    }
  };

  const submitReview = async () => {
    if (!currentUserId || !location || myRating === 0) return;
    setSubmitting(true);
    setReviewError('');
    try {
      const payload = { location_id: location.id, user_id: currentUserId, rating: myRating, comment: myComment || null };
      const { error } = myExistingReview
        ? await supabase.from('location_reviews').update(payload).eq('id', myExistingReview.id)
        : await supabase.from('location_reviews').insert(payload);
      if (error) { setReviewError(error.message); return; }
      await fetchReviews();
    } finally {
      setSubmitting(false);
    }
  };

  /* ── drag (handle only) ── */
  const closeSheet = () => { setEntered(false); setTimeout(onClose, 320); };

  const UP = -55, DOWN = 90;

  const onDragEnd = () => {
    const d = dragDy;
    setDragging(false); setDragDy(0);

    if (snap === 'full') {
      if (d >= 120) { setSnap('half'); scrollRef.current?.scrollTo({ top: 0 }); } // back to the title
    } else if (snap === 'half') {
      if (d <= UP) setSnap('full');
      else if (d >= DOWN) setSnap('peek'); // down goes to peek — it doesn't close
    } else { // peek
      if (d <= UP) setSnap('half');
      else if (d >= DOWN) closeSheet();   // only from peek does down actually close it
    }
  };
  const onMouseDown  = (e: React.MouseEvent) => { dragStartY.current = e.clientY; setDragging(true); };

  /* One finger, two jobs: scroll the content, or move the whole card. The card wins whenever the
     content underneath has no scrolling left to give — and the hand-off happens MID-gesture, so
     pulling down from deep in the reviews scrolls back to the top and then keeps going, carrying
     the card down with it. Without that hand-off the drag just rewound the scroll and the card
     never budged. */
  const onContentTouchStart = (e: React.TouchEvent) => {
    const y = e.touches[0].clientY;
    dragStartY.current = y;
    lastY.current = y;
    // A touch outside the scrolling area (grabber, title, buttons) always moves the card.
    const inScroll = !!scrollRef.current && scrollRef.current.contains(e.target as Node);
    cardDrag.current = !inScroll || snap !== 'full' || (scrollRef.current?.scrollTop ?? 0) <= 0;
  };

  const onContentTouchMove = (e: React.TouchEvent) => {
    const y = e.touches[0].clientY;
    const goingDown = y > lastY.current;
    lastY.current = y;

    if (!cardDrag.current) {
      // the scroll just ran out at the top and the finger is still pulling down → take the card
      if (goingDown && (scrollRef.current?.scrollTop ?? 0) <= 0) {
        cardDrag.current = true;
        dragStartY.current = y; // rebase, so the card starts from here instead of jumping
      } else return;
    }

    const dy = y - dragStartY.current;
    if (snap === 'full' && dy < 0) { // pulled back up past where the card took over → give it back
      cardDrag.current = false;
      setDragging(false);
      setDragDy(0);
      return;
    }
    setDragging(true);
    setDragDy(dy);
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

  if (!isOpen || !location) return null;

  /* ── derived ── */
  const displayName    = location.place_name || location.name;
  const displayAddress = location.place_address || location.address || '';
  const displayPhone   = location.place_phone || location.phone || '';
  const displayWebsite = location.place_website || location.website || '';

  const rawPin   = location.pin_color || '';
  const pipe     = rawPin.indexOf('|');
  const pinEmoji = (pipe !== -1 ? rawPin.slice(pipe + 1) : '') || '📍';
  const pinColor = (pipe !== -1 ? rawPin.slice(0, pipe) : (rawPin.startsWith('#') ? rawPin : '')) || placePinColor(pinEmoji);

  const avgRating   = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;
  const rating      = location.place_rating ?? avgRating;
  const reviewCount = location.place_review_count ?? (reviews.length || null);
  const category    = placeCategory(location.place_types);

  const openStatus = getOpenStatus(location.opening_hours);
  const isOpenNow  = openStatus ? openStatus.isOpen : location.place_open_now;
  const hasOpenInfo = openStatus !== null || location.place_open_now != null;
  const signSub = openStatus
    ? (openStatus.isOpen ? (openStatus.todayClose ? `עד ${openStatus.todayClose}` : null)
                         : (openStatus.todayOpen ? `נפתח ${openStatus.todayOpen}` : null))
    : null;

  const km = userLocation
    ? calculateDistance(userLocation.latitude, userLocation.longitude, location.latitude, location.longitude)
    : null;
  const distanceText = km == null ? null : km < 1 ? `${Math.round(km * 1000)} מ׳ ממך` : `${km.toFixed(1)} ק״מ ממך`;

  const mapsUrl = location.google_maps_url || `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
  const isSaved = !!currentUserId && savers.some(s => s.userId === currentUserId);

  const toggleSave = async () => {
    if (!currentUserId || !location) return;
    const was = isSaved;
    setSavers(prev => was // optimistic
      ? prev.filter(s => s.userId !== currentUserId)
      : [...prev, { userId: currentUserId, name: 'את/ה', avatarUrl: null, savedAt: new Date().toISOString() }]);
    const { error } = await toggleSavedPlace(currentUserId, location.id, was);
    if (error) { console.error('toggleSavedPlace:', error.message); }
    loadPlaceSavers(location.id).then(setSavers); // resync with the real row (name/avatar)
  };

  // Outside the app it's plain text. Inside, the payload rides along invisibly and the chat renders
  // it as a map card (same trick shared events use) — with the plain text as the fallback body.
  const sharePlain = [`${pinEmoji} ${displayName}`, displayAddress || null, mapsUrl]
    .filter(Boolean).join('\n');

  const shareText = encodePlace({
    id: location.id,
    name: displayName,
    lat: location.latitude,
    lng: location.longitude,
    emoji: pinEmoji,
    color: pinColor,
    address: displayAddress || null,
  }, sharePlain);

  const copyAddress = async () => {
    if (!displayAddress) return;
    try { await navigator.clipboard.writeText(displayAddress); alert('הכתובת הועתקה'); } catch { /* no-op */ }
  };

  const basePx = snap === 'full' ? 0 : snap === 'half' ? OFF_HALF : OFF_PEEK;
  const sheetTranslate = !entered ? SHEET_FULL : Math.min(SHEET_FULL, Math.max(0, basePx + dragDy));

  // The map is the point of this screen — the lower the sheet sits, the clearer it gets.
  const scrim = 0; // no dark backdrop — keep the map fully bright behind the sheet

  return (
    <>
      <style>{`.pl-hscroll::-webkit-scrollbar{display:none}.pl-hscroll{scrollbar-width:none}`}</style>

      <div
        className="fixed inset-0 z-50"
        style={{
          background: `rgba(0,0,0,${scrim.toFixed(3)})`,
          transition: dragging ? 'none' : 'background 0.34s ease',
        }}
        onClick={closeSheet}
      />

      <div
        className="fixed left-0 right-0 bottom-0 bg-white rounded-t-3xl shadow-2xl z-50 overflow-hidden"
        style={{
          height: SHEET_FULL,
          transform: `translateY(${sheetTranslate}px)`,
          transition: dragging ? 'none' : 'transform 0.34s cubic-bezier(0.22,1,0.3,1)',
          display: 'flex',
          flexDirection: 'column',
        }}
        dir="rtl"
        onTouchStart={onContentTouchStart}
        onTouchMove={onContentTouchMove}
        onTouchEnd={onContentTouchEnd}
        onWheel={onContentWheel}
      >
        {/* grabber */}
        <div
          className="flex justify-center pt-2.5 pb-1.5 cursor-grab active:cursor-grabbing"
          style={{ flexShrink: 0, touchAction: 'none' }}
          onMouseDown={onMouseDown}
        >
          <div className="w-9 h-1 rounded-full bg-gray-300" />
        </div>

        {/* ── The head: pinned. It lives OUTSIDE the scroller, so nothing the content does —
               a scroll, an iOS rubber-band — can ever push the title down the card. ── */}
        <div style={{ flexShrink: 0 }}>
          {/* Title + share + save ribbon */}
          <div className="px-5 pt-1" style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <h2 style={{
              flex: 1, minWidth: 0, margin: 0,
              fontSize: 30, lineHeight: 1.14, fontWeight: 900, color: INK, fontFamily: HEEBO,
              letterSpacing: '-0.01em',
            }}>
              {displayName}
            </h2>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexShrink: 0 }}>
              <button
                onClick={() => setShowShare(true)}
                aria-label="שתף"
                style={{
                  width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer',
                  background: '#fff', boxShadow: '0 3px 12px rgba(0,0,0,0.10), inset 0 0 0 1px #EEF0F3',
                  display: 'grid', placeItems: 'center',
                }}
              >
                <Share2 size={18} strokeWidth={2.2} color={INK} />
              </button>

              {/* the bookmark ribbon */}
              <button
                onClick={toggleSave}
                disabled={!currentUserId}
                aria-label={isSaved ? 'הסר משמורים' : 'שמור מקום'}
                style={{
                  width: 46, height: 62, border: 'none', padding: 0,
                  cursor: currentUserId ? 'pointer' : 'default',
                  background: isSaved ? '#FEE9EC' : '#fff',
                  filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.12))',
                  clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 78%, 0 100%)',
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 12,
                  transition: 'background 0.18s ease',
                }}
              >
                <Heart
                  size={20} strokeWidth={2.2}
                  color={isSaved ? '#EF4444' : '#B6BBC5'}
                  fill={isSaved ? '#EF4444' : 'none'}
                />
              </button>
            </div>
          </div>

          {/* ── Subtitle: category · rating · distance (Apple-style, one clean line) ── */}
          <div className="px-5 mt-1.5" style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            {category && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13.5, fontWeight: 800, color: pinColor, fontFamily: HEEBO }}>
                <span>{pinEmoji}</span>{category}
              </span>
            )}
            {rating != null && (
              <>
                {category && <span style={{ color: '#D7DAE0', fontSize: 12 }}>·</span>}
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13.5, fontWeight: 800, color: INK, fontFamily: HEEBO }}>
                  <Star size={13} className="fill-amber-400 text-amber-400" strokeWidth={0} />
                  {rating.toFixed(1)}
                  {reviewCount ? <span style={{ color: MUTED, fontWeight: 700 }}>({reviewCount.toLocaleString()})</span> : null}
                </span>
              </>
            )}
            {distanceText && (
              <>
                {(category || rating != null) && <span style={{ color: '#D7DAE0', fontSize: 12 }}>·</span>}
                <span style={{ fontSize: 13.5, fontWeight: 700, color: MUTED, fontFamily: HEEBO }}>{distanceText}</span>
              </>
            )}
          </div>

          {/* ── Address ── */}
          {displayAddress && (
            <button
              onClick={copyAddress}
              className="px-5 mt-1.5"
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'right', width: '100%' }}
            >
              <Copy size={13} strokeWidth={2.2} color={MUTED} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 13.5, color: MUTED, fontWeight: 600, fontFamily: HEEBO, lineHeight: 1.4 }}>
                {displayAddress}
              </span>
            </button>
          )}
        </div>

        {/* ── Everything below the head scrolls (only when the card is full) ── */}
        <div
          ref={scrollRef}
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            paddingTop: 0,
            paddingBottom: 'max(28px, env(safe-area-inset-bottom))',
            // Scrolls only when the card is full AND we're not moving it. The instant the card takes
            // the finger this locks, or iOS rubber-bands the content around inside the sheet.
            // `overscroll-contain` is not enough — it stops the scroll chaining to the parent, not
            // the elastic bounce here.
            overflowY: snap === 'full' && !dragging ? 'auto' : 'hidden',
            overscrollBehavior: 'none',
            touchAction: snap === 'full' && !dragging ? 'pan-y' : 'none',
          }}
        >
          {/* ── Photo mosaic (Apple-style) — the hero of the card ── */}
          <div className="px-5" style={{ paddingTop: 14 }}>
            <PhotoMosaic
              photos={photos}
              color={pinColor}
              canAdd={isAdmin && isRealPlace}
              uploading={uploading}
              onOpen={(i) => setLightbox(i)}
              onAdd={() => fileRef.current?.click()}
            />
            {/* admins can keep adding once there are already photos */}
            {isAdmin && photos.length > 0 && (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                style={{
                  marginTop: 8, width: '100%', height: 40, borderRadius: 13, cursor: 'pointer',
                  border: `1.5px dashed ${pinColor}66`, background: `${pinColor}0D`, color: pinColor,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  fontSize: 13.5, fontWeight: 800, fontFamily: HEEBO,
                }}
              >
                {uploading
                  ? <><Loader2 size={15} className="animate-spin" /> מעלה…</>
                  : <><Plus size={16} strokeWidth={2.6} /> הוסף תמונות</>}
              </button>
            )}
          </div>
          <input
            ref={fileRef} type="file" accept="image/*" multiple hidden
            onChange={(e) => { if (e.target.files?.length) addPhotos(e.target.files); e.currentTarget.value = ''; }}
          />

          {/* ── Description ── */}
          {location.description && (
            <p className="px-5 mt-3" style={{ fontSize: 15, lineHeight: 1.6, color: '#6C727E', fontFamily: "'Rubik', sans-serif", margin: 0 }}>
              {location.description}
            </p>
          )}

          {/* ── Actions, led by the hanging sign ── */}
          <div className="pl-hscroll" style={{ display: 'flex', alignItems: 'flex-end', gap: 9, overflowX: 'auto', padding: '16px 20px 0' }}>
            {hasOpenInfo && <HangingSign open={!!isOpenNow} sub={signSub} />}

            <button onClick={() => setShowNav(true)} style={{ ...pillBase, background: '#2F80ED', color: '#fff', padding: '11px 17px' }}>
              <Navigation size={15} strokeWidth={0} fill="currentColor" />
              ניווט
            </button>

            {displayPhone && (
              <button onClick={() => { window.location.href = `tel:${displayPhone}`; }} style={{ ...pillBase, padding: '11px 17px' }}>
                <Phone size={15} strokeWidth={2.2} />
                חייג
              </button>
            )}

            {displayWebsite && (
              <button onClick={() => setWebUrl(displayWebsite)} style={{ ...pillBase, padding: '11px 17px' }}>
                <Globe size={15} strokeWidth={2.2} />
                אתר
              </button>
            )}
          </div>

          {/* ── Hours ── */}
          {location.opening_hours && (
            <div className="px-5 mt-5">
              <button
                onClick={() => setShowFullHours(v => !v)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  background: '#F8F9FB', border: 'none', borderRadius: 16, padding: '12px 14px', cursor: 'pointer',
                }}
              >
                <span style={{ flex: 1, textAlign: 'right', fontSize: 13.5, fontWeight: 800, color: INK, fontFamily: HEEBO }}>
                  שעות פתיחה
                </span>
                {showFullHours ? <ChevronUp size={16} color={MUTED} /> : <ChevronDown size={16} color={MUTED} />}
              </button>

              {showFullHours && (
                <div style={{ padding: '10px 14px 0' }}>
                  {DAY_NAMES.map((day, i) => {
                    const h = location.opening_hours![i.toString()];
                    const today = new Date().getDay() === i;
                    return (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', padding: '4px 0',
                        fontSize: 12.5, fontFamily: HEEBO,
                        fontWeight: today ? 800 : 600, color: today ? INK : MUTED,
                      }}>
                        <span>{day}{today ? ' ◀' : ''}</span>
                        {h?.closed ? <span style={{ color: '#EF4444' }}>סגור</span> : <span>{h?.open} – {h?.close}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Popularity: ❤️ count + progress toward the "featured spot" threshold ── */}
          {(() => {
            const GOAL = 50;                                   // saves needed to become a featured spot
            const n = savers.length;
            const remaining = Math.max(0, GOAL - n);
            const pct = Math.min(100, Math.round((n / GOAL) * 100));
            const reached = n >= GOAL;
            return (
              <div className="px-5 mt-6">
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <Heart size={17} strokeWidth={0} fill={n ? '#EF4444' : '#CBD0DA'} />
                  <span style={{ fontSize: 14, fontWeight: 800, color: n ? INK : MUTED, fontFamily: HEEBO }}>
                    {n > 0
                      ? <><b style={{ fontWeight: 900 }}>{n}</b> אהבו את המקום</>
                      : 'היה הראשון שאוהב — הקש על הלב'}
                  </span>
                </div>

                {/* progress bar toward becoming a featured spot ⭐ */}
                <div style={{ marginTop: 12, position: 'relative', height: 9, borderRadius: 999, background: '#EEF0F4', overflow: 'hidden' }}>
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0, right: 0, width: `${pct}%`, borderRadius: 999,
                    background: reached ? 'linear-gradient(90deg,#16A34A,#22C55E)' : 'linear-gradient(90deg,#EC4899,#F97316)',
                    transition: 'width 0.6s cubic-bezier(0.22,1,0.32,1)',
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 7, gap: 10 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: reached ? '#16A34A' : '#6B7280', fontFamily: HEEBO }}>
                    {reached
                      ? <>🎉 עבר את הרף! בקרוב יסומן כמקום מומלץ ⭐</>
                      : <>עוד <b style={{ fontWeight: 900, color: '#F97316' }}>{remaining}</b> לייקים והמקום יהפוך למומלץ ⭐</>}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: MUTED, fontFamily: HEEBO, whiteSpace: 'nowrap' }}>{n}/{GOAL}</span>
                </div>
              </div>
            );
          })()}

          {/* ── Reviews ── */}
          <div className="px-5 mt-7">
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ fontSize: 16.5, fontWeight: 900, color: INK, fontFamily: HEEBO, margin: 0 }}>ביקורות</h3>
              {avgRating && (
                <div className="flex items-center gap-1.5 bg-amber-50 px-3 py-1.5 rounded-xl">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span className="text-sm font-bold text-amber-700">{avgRating.toFixed(1)}</span>
                  <span className="text-xs text-amber-500">({reviews.length})</span>
                </div>
              )}
            </div>

            {currentUserId && (
              <div className="bg-gray-50 rounded-2xl p-4 mb-4 border border-gray-200">
                <p className="text-sm font-semibold text-gray-700 mb-3">
                  {myExistingReview ? 'הביקורת שלך' : 'כתוב ביקורת'}
                </p>
                <div className="flex gap-1 mb-3">
                  {[1, 2, 3, 4, 5].map(s => (
                    <button
                      key={s}
                      type="button"
                      onMouseEnter={() => setHoverRating(s)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setMyRating(s)}
                      className="transition-transform hover:scale-110 active:scale-90"
                    >
                      <Star className={`w-8 h-8 ${s <= (hoverRating || myRating) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
                    </button>
                  ))}
                </div>
                <textarea
                  value={myComment}
                  onChange={e => setMyComment(e.target.value)}
                  placeholder="ספר על החוויה שלך..."
                  rows={2}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none bg-white"
                />
                {reviewError && <p className="text-xs text-red-500 mt-1">{reviewError}</p>}
                <button
                  onClick={submitReview}
                  disabled={myRating === 0 || submitting}
                  className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl active:bg-blue-700 disabled:opacity-40 transition-colors"
                >
                  <Send className="w-4 h-4" />
                  {submitting ? 'שולח...' : myExistingReview ? 'עדכן ביקורת' : 'פרסם ביקורת'}
                </button>
              </div>
            )}

            {reviews.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Star className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">אין ביקורות עדיין — היה הראשון!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reviews.map(r => (
                  <div key={r.id} className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                    <div className="flex items-center gap-3 mb-2">
                      <UserAvatar userId={r.user_id} displayName={r.users?.display_name || 'משתמש'} avatarUrl={r.users?.avatar_url || undefined} size="small" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{r.users?.display_name || 'משתמש'}</p>
                        <div className="flex items-center gap-1.5">
                          <Stars rating={r.rating} size={11} uid={`${uid}-${r.id}`} />
                          <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString('he-IL')}</span>
                        </div>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={async () => {
                            if (!confirm('למחוק ביקורת זו?')) return;
                            await supabase.from('location_reviews').delete().eq('id', r.id);
                            fetchReviews();
                          }}
                          className="w-7 h-7 flex items-center justify-center rounded-full active:bg-red-100 text-gray-300 transition-colors flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {r.comment && <p className="text-sm text-gray-600 leading-relaxed">{r.comment}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Photo lightbox ── */}
      {lightbox !== null && photos.length > 0 && (
        <div className="fixed inset-0 z-[70]" style={{ background: '#000' }} dir="ltr">
          <button
            onClick={() => setLightbox(null)}
            aria-label="סגור"
            style={{
              position: 'absolute', top: 'max(16px, env(safe-area-inset-top))', right: 16, zIndex: 2,
              width: 40, height: 40, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: 'rgba(255,255,255,0.16)', backdropFilter: 'blur(6px)',
              display: 'grid', placeItems: 'center',
            }}
          >
            <X size={20} color="#fff" strokeWidth={2.4} />
          </button>

          <div
            // jump straight to the tapped photo (dir=ltr, so scrollLeft = index × width)
            ref={(el) => { if (el && lightbox) el.scrollLeft = lightbox * el.clientWidth; }}
            className="pl-hscroll"
            style={{ display: 'flex', height: '100%', overflowX: 'auto', scrollSnapType: 'x mandatory' }}
          >
            {photos.map((p, i) => (
              <div key={i} style={{ flex: '0 0 100%', height: '100%', scrollSnapAlign: 'center', display: 'grid', placeItems: 'center' }}>
                <img src={p} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              </div>
            ))}
          </div>

          {photos.length > 1 && (
            <div style={{
              position: 'absolute', bottom: 'max(22px, env(safe-area-inset-bottom))', left: 0, right: 0,
              textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 12.5, fontWeight: 700, fontFamily: HEEBO,
            }}>
              החלק לתמונות נוספות · {photos.length} תמונות
            </div>
          )}
        </div>
      )}

      <ShareToChatSheet
        isOpen={showShare}
        onClose={() => setShowShare(false)}
        currentUserId={currentUserId}
        title={displayName}
        subtitle={displayAddress || category || undefined}
        emoji={pinEmoji}
        color={pinColor}
        text={shareText}
        plainText={sharePlain}
        url={mapsUrl}
      />

      {showNav && (
        <OpenLocationSheet
          lat={location.latitude}
          lng={location.longitude}
          name={displayName}
          onClose={() => setShowNav(false)}
        />
      )}

      <WebViewModal isOpen={!!webUrl} url={webUrl || ''} onClose={() => setWebUrl(null)} />
    </>
  );
}
