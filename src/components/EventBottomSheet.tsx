import { useEffect, useRef, useState } from 'react';
import { X, Calendar, MapPin, Users, ArrowRight } from 'lucide-react';
import { type Event } from '../lib/supabase';
import { getCategoryEmoji, getCategoryLabel } from '../utils/eventCategories';

interface EventBottomSheetProps {
  event: Event | null;
  onClose: () => void;
  onViewDetails: (event: Event) => void;
}

export function EventBottomSheet({ event, onClose, onViewDetails }: EventBottomSheetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (event) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [event]);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartY(e.touches[0].clientY);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const deltaY = e.touches[0].clientY - startY;
    if (deltaY > 0) {
      setCurrentY(deltaY);
    }
  };

  const handleTouchEnd = () => {
    if (currentY > 100) {
      handleClose();
    }
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
    if (deltaY > 0) {
      setCurrentY(deltaY);
    }
  };

  const handleMouseUp = () => {
    if (currentY > 100) {
      handleClose();
    }
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

  if (!event) return null;

  const eventTypeLabel = getCategoryLabel(event.event_type || 'parties');

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 transition-opacity duration-300"
          style={{ opacity: isOpen ? 1 : 0 }}
          onClick={handleClose}
        />
      )}

      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-50 transition-transform duration-300 ease-out"
        style={{
          transform: isOpen
            ? `translateY(${currentY}px)`
            : 'translateY(100%)',
          maxHeight: '50vh',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="w-full py-3 flex justify-center cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
        >
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>

        <div className="px-6 pb-6 overflow-y-auto" style={{ maxHeight: 'calc(50vh - 48px)' }}>
          <button
            onClick={handleClose}
            className="absolute top-4 left-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>

          <div className="flex items-start gap-3 mb-4">
            <div className="text-5xl">{event.emoji || getCategoryEmoji(event.event_type || 'parties')}</div>
            <div className="flex-1 pt-2">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">{event.title}</h2>
              <span className="inline-block px-3 py-1 bg-blue-100 text-blue-600 text-xs font-semibold rounded-full">
                {eventTypeLabel}
              </span>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex items-start gap-3 text-gray-700">
              <MapPin className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">{event.city}</p>
                {event.address && (
                  <p className="text-sm text-gray-500">{event.address}</p>
                )}
              </div>
            </div>

            {event.date && (
              <div className="flex items-center gap-3 text-gray-700">
                <Calendar className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <div>
                  <p className="font-semibold">
                    {new Date(event.date).toLocaleDateString('he-IL', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                  {event.time && (
                    <p className="text-sm text-gray-500">
                      שעה: {event.time}
                    </p>
                  )}
                </div>
              </div>
            )}

            {event.max_attendees && (
              <div className="flex items-center gap-3 text-gray-700">
                <Users className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <p className="font-semibold">עד {event.max_attendees} משתתפים</p>
              </div>
            )}
          </div>

          {event.description && (
            <p className="text-gray-600 text-sm mb-6 line-clamp-3">
              {event.description}
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => onViewDetails(event)}
              className="flex-1 bg-blue-500 text-white py-3 rounded-xl font-semibold hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
            >
              <span>צפה בפרטים המלאים</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
