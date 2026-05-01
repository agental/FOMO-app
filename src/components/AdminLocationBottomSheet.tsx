import { useState, useEffect, useRef } from 'react';
import { X, MapPin, Phone, Globe, Navigation, Share2, ChevronLeft, ChevronRight, Clock, Star, Send, ChevronDown, ChevronUp } from 'lucide-react';
import { type AdminLocation } from '../lib/supabase';
import { supabase } from '../lib/supabase';

interface AdminLocationBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  location: AdminLocation | null;
  currentUserId?: string;
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

function getOpenStatus(hours: Record<string, { open: string; close: string; closed: boolean }> | null | undefined) {
  if (!hours) return null;
  const now = new Date();
  const day = now.getDay();
  const dayHours = hours[day.toString()];
  if (!dayHours) return null;
  if (dayHours.closed) return { isOpen: false, todayOpen: null, todayClose: null };
  const cur = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  return { isOpen: cur >= dayHours.open && cur <= dayHours.close, todayOpen: dayHours.open, todayClose: dayHours.close };
}

function renderStars(rating: number, size = 'w-4 h-4') {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = i < Math.floor(rating);
        const isHalf = !filled && i === Math.floor(rating) && rating - Math.floor(rating) >= 0.5;
        return (
          <svg key={i} viewBox="0 0 20 20" className={`${size} flex-shrink-0`}>
            <defs>
              {isHalf && <linearGradient id={`half-${i}`}><stop offset="50%" stopColor="#F59E0B" /><stop offset="50%" stopColor="#D1D5DB" /></linearGradient>}
            </defs>
            <polygon points="10,1 12.9,7 19.5,7.6 14.5,12 16.2,18.5 10,15 3.8,18.5 5.5,12 0.5,7.6 7.1,7"
              fill={filled ? '#F59E0B' : isHalf ? `url(#half-${i})` : '#D1D5DB'} />
          </svg>
        );
      })}
    </div>
  );
}

export function AdminLocationBottomSheet({ isOpen, onClose, location, currentUserId }: AdminLocationBottomSheetProps) {
  const [activePhoto, setActivePhoto] = useState(0);
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showFullHours, setShowFullHours] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [myRating, setMyRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [myComment, setMyComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [myExistingReview, setMyExistingReview] = useState<Review | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (location) {
      setActivePhoto(0);
      setShowFullHours(false);
      fetchReviews();
    }
  }, [location]);

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
    try {
      if (myExistingReview) {
        await supabase.from('location_reviews').update({ rating: myRating, comment: myComment || null }).eq('id', myExistingReview.id);
      } else {
        await supabase.from('location_reviews').insert({ location_id: location.id, user_id: currentUserId, rating: myRating, comment: myComment || null });
      }
      await fetchReviews();
    } finally {
      setSubmitting(false);
    }
  };

  const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;

  const handleClose = () => setTimeout(onClose, 200);

  const handleTouchStart = (e: React.TouchEvent) => { setStartY(e.touches[0].clientY); setIsDragging(true); };
  const handleTouchMove = (e: React.TouchEvent) => { if (!isDragging) return; const d = e.touches[0].clientY - startY; if (d > 0) setCurrentY(d); };
  const handleTouchEnd = () => { if (currentY > 80) handleClose(); setCurrentY(0); setIsDragging(false); };
  const handleMouseDown = (e: React.MouseEvent) => { setStartY(e.clientY); setIsDragging(true); };
  const handleMouseMove = (e: MouseEvent) => { if (!isDragging) return; const d = e.clientY - startY; if (d > 0) setCurrentY(d); };
  const handleMouseUp = () => { if (currentY > 80) handleClose(); setCurrentY(0); setIsDragging(false); };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => { document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); };
    }
  }, [isDragging, currentY, startY]);

  if (!isOpen || !location) return null;

  const photos = location.place_photos?.length ? location.place_photos
    : location.place_photo_url ? [location.place_photo_url]
    : location.image_url ? [location.image_url] : [];

  const displayName = location.place_name || location.name;
  const displayAddress = location.place_address || location.address || '';
  const displayPhone = location.place_phone || location.phone || '';
  const displayWebsite = location.place_website || location.website || '';
  const openStatus = getOpenStatus(location.opening_hours);
  const isOpenNow = openStatus ? openStatus.isOpen : location.place_open_now;
  const hasOpenInfo = openStatus !== null || location.place_open_now !== undefined;

  const handleNavigate = () => window.open(`https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`, '_blank');
  const handleGoogleMaps = () => window.open(location.google_maps_url || `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`, '_blank');
  const handleShare = () => navigator.share?.({ title: displayName, text: displayAddress, url: location.google_maps_url || `https://www.google.com/maps?q=${location.latitude},${location.longitude}` }).catch(() => {});

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-[1px]" style={{ opacity: isOpen ? 1 : 0 }} onClick={handleClose} />

      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 z-50 overflow-hidden"
        style={{ transform: isOpen ? `translateY(${currentY}px)` : 'translateY(100%)', transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.32,0.72,0,1)', maxHeight: '92vh' }}
        dir="rtl"
      >
        <div className="w-full h-full overflow-y-auto bg-white" style={{ borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>

          {/* ── Photo header ── */}
          {photos.length > 0 ? (
            <div className="relative w-full h-60 bg-gray-200 flex-shrink-0 overflow-hidden" style={{ borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
              <img src={photos[activePhoto]} alt={displayName} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

              {/* Drag handle */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 cursor-grab z-10"
                onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} onMouseDown={handleMouseDown}>
                <div className="w-10 h-1 bg-white/70 rounded-full" />
              </div>

              {/* Close */}
              <button onClick={handleClose} className="absolute top-3 left-3 w-9 h-9 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow z-10 hover:bg-white transition-colors">
                <X className="w-4 h-4 text-gray-700" />
              </button>

              {/* Photo nav */}
              {photos.length > 1 && (
                <>
                  <button onClick={() => setActivePhoto(p => Math.max(0, p - 1))} disabled={activePhoto === 0}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow disabled:opacity-30 z-10">
                    <ChevronRight className="w-4 h-4 text-gray-700" />
                  </button>
                  <button onClick={() => setActivePhoto(p => Math.min(photos.length - 1, p + 1))} disabled={activePhoto === photos.length - 1}
                    className="absolute left-12 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow disabled:opacity-30 z-10">
                    <ChevronLeft className="w-4 h-4 text-gray-700" />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1 z-10">
                    {photos.map((_, i) => <button key={i} onClick={() => setActivePhoto(i)} className={`rounded-full transition-all ${i === activePhoto ? 'w-5 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/50'}`} />)}
                  </div>
                </>
              )}

              {/* Open/closed badge on photo */}
              {hasOpenInfo && (
                <div className={`absolute bottom-4 right-4 px-3 py-1 rounded-full text-xs font-bold shadow-lg z-10 ${isOpenNow ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                  {isOpenNow ? '● פתוח עכשיו' : '● סגור עכשיו'}
                </div>
              )}
            </div>
          ) : (
            <div className="flex justify-center pt-3 pb-1 cursor-grab" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} onMouseDown={handleMouseDown}>
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
          )}

          {/* ── Content ── */}
          <div className="px-5 pt-5 pb-8 space-y-5">

            {/* Name + rating */}
            <div>
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-2xl font-bold text-gray-900 leading-tight flex-1">{displayName}</h2>
                {photos.length === 0 && (
                  <button onClick={handleClose} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 flex-shrink-0">
                    <X className="w-4 h-4 text-gray-600" />
                  </button>
                )}
              </div>
              {location.description && <p className="text-sm text-gray-500 mt-1 leading-relaxed">{location.description}</p>}

              {/* Stars row */}
              {(location.place_rating || avgRating) && (
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-lg font-bold text-gray-800">{(location.place_rating || avgRating)!.toFixed(1)}</span>
                  {renderStars(location.place_rating || avgRating!)}
                  {(location.place_review_count || reviews.length > 0) && (
                    <span className="text-sm text-gray-400">
                      ({location.place_review_count ? location.place_review_count.toLocaleString() : reviews.length} ביקורות)
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* ── Action buttons ── */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'ניווט', icon: <Navigation className="w-5 h-5" />, onClick: handleNavigate, primary: true },
                ...(displayPhone ? [{ label: 'חייג', icon: <Phone className="w-5 h-5" />, onClick: () => window.open(`tel:${displayPhone}`), primary: false }] : []),
                ...(displayWebsite ? [{ label: 'אתר', icon: <Globe className="w-5 h-5" />, onClick: () => window.open(displayWebsite, '_blank'), primary: false }] : []),
                { label: 'שתף', icon: <Share2 className="w-5 h-5" />, onClick: handleShare, primary: false },
              ].map((btn, i) => (
                <button key={i} onClick={btn.onClick}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl font-medium transition-all active:scale-95 ${btn.primary ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 hover:bg-blue-700' : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'}`}>
                  {btn.icon}
                  <span className="text-xs font-bold">{btn.label}</span>
                </button>
              ))}
            </div>

            {/* ── Info section ── */}
            <div className="bg-gray-50 rounded-2xl divide-y divide-gray-100 overflow-hidden">
              {displayAddress && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{displayAddress}</span>
                </div>
              )}
              {displayPhone && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <a href={`tel:${displayPhone}`} className="text-sm text-blue-600 font-medium">{displayPhone}</a>
                </div>
              )}
              {displayWebsite && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <Globe className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <button onClick={() => window.open(displayWebsite, '_blank')} className="text-sm text-blue-600 truncate max-w-[240px] text-right">
                    {displayWebsite.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </button>
                </div>
              )}
              {hasOpenInfo && (
                <div className="px-4 py-3">
                  <button onClick={() => location.opening_hours && setShowFullHours(v => !v)}
                    className="flex items-center gap-3 w-full">
                    <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 text-right">
                      <span className={`text-sm font-semibold ${isOpenNow ? 'text-green-600' : 'text-red-500'}`}>
                        {isOpenNow ? 'פתוח עכשיו' : 'סגור עכשיו'}
                      </span>
                      {openStatus?.todayOpen && (
                        <span className="text-xs text-gray-400 mr-2">
                          {isOpenNow ? `· סוגר ${openStatus.todayClose}` : `· נפתח ${openStatus.todayOpen}`}
                        </span>
                      )}
                    </div>
                    {location.opening_hours && (showFullHours ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />)}
                  </button>
                  {showFullHours && location.opening_hours && (
                    <div className="mt-2 space-y-1 pr-7">
                      {DAY_NAMES.map((day, i) => {
                        const h = location.opening_hours![i.toString()];
                        const isToday = new Date().getDay() === i;
                        return (
                          <div key={i} className={`flex justify-between text-xs py-0.5 ${isToday ? 'font-bold text-gray-900' : 'text-gray-500'}`}>
                            <span>{day}{isToday ? ' ◀' : ''}</span>
                            {h?.closed ? <span className="text-red-400">סגור</span> : <span>{h?.open} – {h?.close}</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Google Maps link */}
            <button onClick={handleGoogleMaps}
              className="w-full flex items-center justify-center gap-2 py-3 text-blue-600 text-sm font-semibold bg-blue-50 hover:bg-blue-100 rounded-2xl transition-colors">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
              פתח ב-Google Maps
            </button>

            {/* ── Reviews ── */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">ביקורות</h3>
                {avgRating && (
                  <div className="flex items-center gap-1.5 bg-amber-50 px-3 py-1.5 rounded-xl">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span className="text-sm font-bold text-amber-700">{avgRating.toFixed(1)}</span>
                    <span className="text-xs text-amber-500">({reviews.length})</span>
                  </div>
                )}
              </div>

              {/* Write review */}
              {currentUserId && (
                <div className="bg-gray-50 rounded-2xl p-4 mb-4 border border-gray-200">
                  <p className="text-sm font-semibold text-gray-700 mb-3">
                    {myExistingReview ? 'הביקורת שלך' : 'כתוב ביקורת'}
                  </p>
                  <div className="flex gap-1 mb-3">
                    {[1,2,3,4,5].map(s => (
                      <button key={s} type="button"
                        onMouseEnter={() => setHoverRating(s)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => setMyRating(s)}
                        className="transition-transform hover:scale-110 active:scale-90">
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
                  <button
                    onClick={submitReview}
                    disabled={myRating === 0 || submitting}
                    className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors">
                    <Send className="w-4 h-4" />
                    {submitting ? 'שולח...' : myExistingReview ? 'עדכן ביקורת' : 'פרסם ביקורת'}
                  </button>
                </div>
              )}

              {/* Reviews list */}
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
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {r.users?.avatar_url
                            ? <img src={r.users.avatar_url} className="w-full h-full object-cover" />
                            : <span className="text-white text-sm font-bold">{r.users?.display_name?.[0] || '?'}</span>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{r.users?.display_name || 'משתמש'}</p>
                          <div className="flex items-center gap-1.5">
                            {renderStars(r.rating, 'w-3 h-3')}
                            <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString('he-IL')}</span>
                          </div>
                        </div>
                      </div>
                      {r.comment && <p className="text-sm text-gray-600 leading-relaxed">{r.comment}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}