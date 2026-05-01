import { useState, useEffect, useRef } from 'react';
import { X, MapPin, Phone, Globe, Navigation, Share2, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { type AdminLocation } from '../lib/supabase';

interface AdminLocationBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  location: AdminLocation | null;
}

function renderStars(rating: number) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = i < Math.floor(rating);
        const isHalf = !filled && i === Math.floor(rating) && rating - Math.floor(rating) >= 0.5;
        return (
          <svg key={i} viewBox="0 0 20 20" className="w-4 h-4 flex-shrink-0">
            <defs>
              {isHalf && (
                <linearGradient id={`al-half-${i}`}>
                  <stop offset="50%" stopColor="#F59E0B" />
                  <stop offset="50%" stopColor="#D1D5DB" />
                </linearGradient>
              )}
            </defs>
            <polygon
              points="10,1 12.9,7 19.5,7.6 14.5,12 16.2,18.5 10,15 3.8,18.5 5.5,12 0.5,7.6 7.1,7"
              fill={filled ? '#F59E0B' : isHalf ? `url(#al-half-${i})` : '#D1D5DB'}
            />
          </svg>
        );
      })}
    </div>
  );
}

function formatReviewCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toLocaleString();
}

function formatPlaceType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
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
  const isOpen = cur >= dayHours.open && cur <= dayHours.close;
  return { isOpen, todayOpen: dayHours.open, todayClose: dayHours.close };
}

export function AdminLocationBottomSheet({ isOpen, onClose, location }: AdminLocationBottomSheetProps) {
  const [activePhoto, setActivePhoto] = useState(0);
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (location) setActivePhoto(0);
  }, [location]);

  const handleClose = () => {
    setTimeout(onClose, 300);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartY(e.touches[0].clientY);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const deltaY = e.touches[0].clientY - startY;
    if (deltaY > 0) setCurrentY(deltaY);
  };

  const handleTouchEnd = () => {
    if (currentY > 80) handleClose();
    setCurrentY(0);
    setIsDragging(false);
    setStartY(0);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setStartY(e.clientY);
    setIsDragging(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    const deltaY = e.clientY - startY;
    if (deltaY > 0) setCurrentY(deltaY);
  };

  const handleMouseUp = () => {
    if (currentY > 80) handleClose();
    setCurrentY(0);
    setIsDragging(false);
    setStartY(0);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, currentY, startY]);

  if (!isOpen || !location) return null;

  const photos = location.place_photos?.length
    ? location.place_photos
    : location.place_photo_url
    ? [location.place_photo_url]
    : location.image_url
    ? [location.image_url]
    : [];

  const displayName = location.place_name || location.name;
  const displayAddress = location.place_address || location.address || '';
  const displayPhone = location.place_phone || location.phone || '';
  const displayWebsite = location.place_website || location.website || '';
  const hasGoogleData = !!location.google_place_id;
  const openStatus = getOpenStatus(location.opening_hours);
  const [showFullHours, setShowFullHours] = useState(false);

  const primaryType = location.place_types?.[0];

  const handleNavigate = () => {
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`,
      '_blank'
    );
  };

  const handleGoogleMaps = () => {
    if (location.google_maps_url) {
      window.open(location.google_maps_url, '_blank', 'noopener,noreferrer');
    } else {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`,
        '_blank'
      );
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: displayName,
        text: displayAddress,
        url: location.google_maps_url || `https://www.google.com/maps?q=${location.latitude},${location.longitude}`,
      }).catch(() => {});
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity duration-300"
        style={{ opacity: isOpen ? 1 : 0 }}
        onClick={handleClose}
      />

      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 z-50 overflow-hidden"
        style={{
          transform: isOpen ? `translateY(${currentY}px)` : 'translateY(100%)',
          transition: isDragging ? 'none' : 'transform 0.3s ease-out',
          maxHeight: '88vh',
        }}
        dir="rtl"
      >
        <div className="relative w-full h-full overflow-y-auto">
          {/* Full-bleed photo header */}
          {photos.length > 0 && (
            <div className="relative w-full h-64 bg-gray-100 flex-shrink-0">
              <img
                src={photos[activePhoto]}
                alt={displayName}
                className="w-full h-full object-cover"
                style={{ transition: 'opacity 0.2s' }}
              />

              {/* Drag handle */}
              <div
                className="absolute top-3 left-1/2 -translate-x-1/2 flex justify-center cursor-grab active:cursor-grabbing z-10"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleMouseDown}
              >
                <div className="w-10 h-1 bg-white/60 backdrop-blur-sm rounded-full shadow-lg" />
              </div>

              {/* Close button */}
              <button
                onClick={handleClose}
                className="absolute top-3 left-3 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors z-10"
              >
                <X className="w-4 h-4 text-gray-700" />
              </button>

              {/* Photo navigation */}
              {photos.length > 1 && (
                <>
                  <button
                    onClick={() => setActivePhoto(p => Math.max(0, p - 1))}
                    disabled={activePhoto === 0}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors disabled:opacity-40 z-10"
                  >
                    <ChevronRight className="w-4 h-4 text-gray-700" />
                  </button>
                  <button
                    onClick={() => setActivePhoto(p => Math.min(photos.length - 1, p + 1))}
                    disabled={activePhoto === photos.length - 1}
                    className="absolute left-12 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors disabled:opacity-40 z-10"
                  >
                    <ChevronLeft className="w-4 h-4 text-gray-700" />
                  </button>

                  {/* Photo dots */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1 z-10">
                    {photos.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setActivePhoto(i)}
                        className={`rounded-full transition-all ${
                          i === activePhoto ? 'w-5 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/60'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* Photo count badge */}
              {photos.length > 1 && (
                <div className="absolute top-3 right-3 bg-black/50 text-white text-xs font-medium px-2 py-1 rounded-full backdrop-blur-sm z-10">
                  {activePhoto + 1} / {photos.length}
                </div>
              )}
            </div>
          )}

          {/* White content card with overlap */}
          <div
            className="relative bg-white shadow-2xl pb-6"
            style={{
              marginTop: photos.length > 0 ? '-32px' : '0',
              borderTopLeftRadius: '28px',
              borderTopRightRadius: '28px',
              minHeight: photos.length > 0 ? 'calc(88vh - 232px)' : '88vh',
            }}
          >
            {/* Drag handle for no-photo state */}
            {photos.length === 0 && (
              <div
                className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleMouseDown}
              >
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>
            )}

            {/* Close button for no-photo state */}
            {photos.length === 0 && (
              <button
                onClick={handleClose}
                className="absolute top-4 left-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors z-10"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            )}

            <div className="px-5 pt-6 space-y-4">
            {/* Business name + category */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 leading-tight">{displayName}</h2>
              {primaryType && (
                <p className="text-sm text-gray-500 mt-0.5">{formatPlaceType(primaryType)}</p>
              )}
              {location.description && (
                <p className="text-sm text-gray-600 mt-1 leading-relaxed">{location.description}</p>
              )}
            </div>

            {/* Rating block */}
            {hasGoogleData && location.place_rating && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg font-bold text-gray-800">{location.place_rating.toFixed(1)}</span>
                {renderStars(location.place_rating)}
                {location.place_review_count && (
                  <button
                    onClick={handleGoogleMaps}
                    className="text-sm text-blue-600 font-medium hover:underline"
                  >
                    {formatReviewCount(location.place_review_count)} ביקורות
                  </button>
                )}
                {location.place_open_now !== undefined && (
                  <span className={`text-sm font-semibold ${location.place_open_now ? 'text-green-600' : 'text-red-500'}`}>
                    {location.place_open_now ? 'פתוח עכשיו' : 'סגור עכשיו'}
                  </span>
                )}
              </div>
            )}

            {/* Action buttons — Google Maps style */}
            <div className="flex gap-2.5">
              <button
                onClick={handleNavigate}
                className="flex-1 flex flex-col items-center gap-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl transition-colors shadow-lg shadow-blue-600/20"
              >
                <Navigation className="w-5 h-5" />
                <span className="text-xs font-bold">ניווט</span>
              </button>
              {displayWebsite && (
                <button
                  onClick={() => window.open(displayWebsite, '_blank', 'noopener,noreferrer')}
                  className="flex-1 flex flex-col items-center gap-1 py-3.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-2xl transition-colors border border-gray-200"
                >
                  <Globe className="w-5 h-5 text-blue-500" />
                  <span className="text-xs font-bold">אתר</span>
                </button>
              )}
              {displayPhone && (
                <button
                  onClick={() => window.open(`tel:${displayPhone}`)}
                  className="flex-1 flex flex-col items-center gap-1 py-3.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-2xl transition-colors border border-gray-200"
                >
                  <Phone className="w-5 h-5 text-green-500" />
                  <span className="text-xs font-bold">חייג</span>
                </button>
              )}
              <button
                onClick={handleShare}
                className="flex-1 flex flex-col items-center gap-1 py-3.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-2xl transition-colors border border-gray-200"
              >
                <Share2 className="w-5 h-5 text-gray-500" />
                <span className="text-xs font-bold">שתף</span>
              </button>
            </div>

            <div className="border-t border-gray-100" />

            {/* Place details list */}
            <div className="space-y-3">
              {displayAddress && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MapPin className="w-4 h-4 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 leading-relaxed">{displayAddress}</p>
                    {(location.city || location.country) && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {location.city ? `${location.city}` : ''}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {displayPhone && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Phone className="w-4 h-4 text-gray-600" />
                  </div>
                  <a
                    href={`tel:${displayPhone}`}
                    className="text-sm text-blue-600 font-medium hover:underline"
                  >
                    {displayPhone}
                  </a>
                </div>
              )}

              {displayWebsite && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Globe className="w-4 h-4 text-gray-600" />
                  </div>
                  <button
                    onClick={() => window.open(displayWebsite, '_blank', 'noopener,noreferrer')}
                    className="text-sm text-blue-600 font-medium hover:underline truncate max-w-[240px] text-right"
                  >
                    {displayWebsite.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </button>
                </div>
              )}

              {(openStatus || location.place_open_now !== undefined) && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Clock className="w-4 h-4 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {openStatus ? (
                        <>
                          <span className={`text-sm font-bold ${openStatus.isOpen ? 'text-green-600' : 'text-red-500'}`}>
                            {openStatus.isOpen ? '● פתוח עכשיו' : '● סגור עכשיו'}
                          </span>
                          {openStatus.todayOpen && (
                            <span className="text-xs text-gray-500">
                              {openStatus.isOpen ? `סוגר ב-${openStatus.todayClose}` : `נפתח ב-${openStatus.todayOpen}`}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className={`text-sm font-bold ${location.place_open_now ? 'text-green-600' : 'text-red-500'}`}>
                          {location.place_open_now ? '● פתוח עכשיו' : '● סגור עכשיו'}
                        </span>
                      )}
                      {openStatus && location.opening_hours && (
                        <button
                          type="button"
                          onClick={() => setShowFullHours(v => !v)}
                          className="text-xs text-blue-500 font-medium hover:underline"
                        >
                          {showFullHours ? 'הסתר' : 'כל השעות'}
                        </button>
                      )}
                    </div>

                    {showFullHours && location.opening_hours && (
                      <div className="mt-2 space-y-1">
                        {DAY_NAMES.map((day, i) => {
                          const h = location.opening_hours![i.toString()];
                          const isToday = new Date().getDay() === i;
                          return (
                            <div key={i} className={`flex items-center justify-between text-xs py-0.5 ${isToday ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
                              <span>{day}{isToday ? ' (היום)' : ''}</span>
                              {h?.closed
                                ? <span className="text-red-500">סגור</span>
                                : <span>{h?.open} – {h?.close}</span>
                              }
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Category tags */}
            {location.place_types && location.place_types.length > 0 && (
              <>
                <div className="border-t border-gray-100" />
                <div className="flex flex-wrap gap-2">
                  {location.place_types.slice(0, 5).map(type => (
                    <span
                      key={type}
                      className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium"
                    >
                      {formatPlaceType(type)}
                    </span>
                  ))}
                </div>
              </>
            )}

            {/* Google Maps link */}
            <div className="border-t border-gray-100 pt-1">
              <button
                onClick={handleGoogleMaps}
                className="w-full flex items-center justify-center gap-2 py-3 text-blue-600 text-sm font-semibold hover:bg-blue-50 rounded-xl transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
                פתח ב-Google Maps
              </button>
            </div>
          </div>
          </div>
        </div>
      </div>
    </>
  );
}
