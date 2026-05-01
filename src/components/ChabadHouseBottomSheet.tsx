import { useEffect, useRef, useState } from 'react';
import { X, MapPin, Phone, Globe, Mail } from 'lucide-react';
import { WebViewModal } from './WebViewModal';
import { type ChabadHouse } from '../lib/supabase';

interface ChabadHouseBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  chabadHouse: ChabadHouse | null;
}

export function ChabadHouseBottomSheet({ isOpen, onClose, chabadHouse }: ChabadHouseBottomSheetProps) {
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [webViewOpen, setWebViewOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  const handleClose = () => {
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

  if (!isOpen || !chabadHouse) return null;

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
          maxHeight: '45vh',
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

        <div className="px-6 pb-6 overflow-y-auto" style={{ maxHeight: 'calc(45vh - 48px)' }}>
          <button
            onClick={handleClose}
            className="absolute top-4 left-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>

          <div className="flex items-start gap-4 mb-6">
            <div className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden bg-white border-2 border-brand-500">
              <img
                src={chabadHouse.image_url || '/images.png'}
                alt={chabadHouse.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 pt-2">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">{chabadHouse.name}</h2>
              {chabadHouse.description && (
                <p className="text-gray-600 text-sm">{chabadHouse.description}</p>
              )}
            </div>
          </div>

          <div className="space-y-4 mb-6">
            {(chabadHouse.city || chabadHouse.address) && (
              <div className="flex items-start gap-3 text-gray-700">
                <MapPin className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  {chabadHouse.city && <p className="font-semibold">{chabadHouse.city}</p>}
                  {chabadHouse.address && <p className="text-sm text-gray-500">{chabadHouse.address}</p>}
                </div>
              </div>
            )}

            {chabadHouse.phone && (
              <div className="flex items-center gap-3 text-gray-700">
                <Phone className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <a href={`tel:${chabadHouse.phone}`} className="font-semibold hover:text-blue-600">
                  {chabadHouse.phone}
                </a>
              </div>
            )}

            {chabadHouse.email && (
              <div className="flex items-center gap-3 text-gray-700">
                <Mail className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <a href={`mailto:${chabadHouse.email}`} className="font-semibold hover:text-blue-600">
                  {chabadHouse.email}
                </a>
              </div>
            )}

            {chabadHouse.website && (
              <div className="flex items-center gap-3 text-gray-700">
                <Globe className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <a
                  href={chabadHouse.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold hover:text-blue-600"
                >
                  {chabadHouse.website.replace(/^https?:\/\/(www\.)?/, '')}
                </a>
              </div>
            )}
          </div>

          {chabadHouse.website && (
            <button
              className="w-full bg-blue-500 text-white py-3 rounded-xl font-semibold hover:bg-blue-600 transition-colors"
              onClick={() => setWebViewOpen(true)}
            >
              באים לשבת/חג
            </button>
          )}
        </div>
      </div>

      {chabadHouse?.website && (
        <WebViewModal
          isOpen={webViewOpen}
          onClose={() => setWebViewOpen(false)}
          url={chabadHouse.website}
        />
      )}
    </>
  );
}
