import { X, MessageCircle, Instagram } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { UserAvatar } from './UserAvatar';
import { InterestTag } from './InterestTag';
import { flagEmoji } from '../utils/flags';

interface UserProfileModalProps {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  instagram?: string;
  bio?: string;
  age?: number;
  languages?: string[];
  interests?: string[];
  visitedCountries?: string[];
  homeBase?: string;
  onClose: () => void;
  onSendMessage: () => void;
}

export function UserProfileModal({
  displayName,
  avatarUrl,
  instagram,
  bio,
  age,
  languages = [],
  interests = [],
  visitedCountries = [],
  homeBase,
  onClose,
  onSendMessage,
}: UserProfileModalProps) {
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

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
    setIsDragging(false);
    if (currentY > 150) {
      onClose();
    }
    setCurrentY(0);
    setStartY(0);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[100] flex items-end"
      onClick={handleBackdropClick}
      dir="rtl"
    >
      <div
        ref={sheetRef}
        className="bg-white rounded-t-3xl w-full max-h-[85vh] overflow-y-auto shadow-2xl transition-transform"
        style={{
          transform: `translateY(${currentY}px)`,
          touchAction: 'pan-y',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="sticky top-0 bg-white z-10 pt-3 pb-2 px-4">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-4"></div>
          <button
            onClick={onClose}
            className="absolute left-4 top-3 p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-5">
          <div className="flex flex-col items-center text-center pt-2">
            <div className="relative mb-3">
              <UserAvatar
                avatarUrl={avatarUrl}
                displayName={displayName}
                size="xlarge"
                className="ring-4 ring-white shadow-lg"
              />
              {homeBase && (
                <div className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center text-2xl">
                  {flagEmoji(homeBase)}
                </div>
              )}
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-1" style={{ fontFamily: 'Heebo, sans-serif' }}>
              {displayName}
              {age && <span className="text-gray-600">, {age}</span>}
            </h2>

            {instagram && (
              <a
                href={instagram.startsWith('http') ? instagram : `https://instagram.com/${instagram.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 mt-2 bg-gradient-to-r from-rose-500 via-pink-500 to-orange-500 rounded-full text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all"
              >
                <Instagram className="w-3.5 h-3.5" />
                <span>@{instagram.replace('@', '').replace('https://instagram.com/', '')}</span>
              </a>
            )}

            <button
              onClick={onSendMessage}
              className="w-full mt-4 flex items-center justify-center gap-2 bg-gradient-to-r from-brand-500 to-brand-600 text-white py-3 px-6 rounded-xl font-bold shadow-md hover:shadow-lg transition-all active:scale-95"
              style={{ fontFamily: 'Heebo, sans-serif' }}
            >
              <MessageCircle className="w-5 h-5" />
              <span>שלח הודעה</span>
            </button>
          </div>

          {bio && (
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="text-sm font-bold text-gray-700 mb-2" style={{ fontFamily: 'Heebo, sans-serif' }}>
                אודות
              </h3>
              <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap" style={{ fontFamily: 'Rubik, sans-serif' }}>
                {bio}
              </p>
            </div>
          )}

          {interests.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-2" style={{ fontFamily: 'Heebo, sans-serif' }}>
                תחומי עניין
              </h3>
              <div className="flex flex-wrap gap-2">
                {interests.map((interest, idx) => (
                  <InterestTag key={idx} interest={interest} />
                ))}
              </div>
            </div>
          )}

          {languages.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-2" style={{ fontFamily: 'Heebo, sans-serif' }}>
                שפות
              </h3>
              <div className="flex flex-wrap gap-2">
                {languages.map((language, idx) => (
                  <div
                    key={idx}
                    className="inline-flex items-center px-3 py-1.5 bg-gray-100 rounded-full text-sm font-medium text-gray-700"
                    style={{ fontFamily: 'Rubik, sans-serif' }}
                  >
                    {language}
                  </div>
                ))}
              </div>
            </div>
          )}

          {visitedCountries.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-2" style={{ fontFamily: 'Heebo, sans-serif' }}>
                מדינות שביקרתי ({visitedCountries.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {visitedCountries.slice(0, 15).map((country, idx) => (
                  <div
                    key={idx}
                    className="inline-flex items-center px-3 py-1.5 bg-blue-50 rounded-full text-sm"
                  >
                    <span className="text-xl mr-1">{flagEmoji(country)}</span>
                  </div>
                ))}
                {visitedCountries.length > 15 && (
                  <div className="inline-flex items-center px-3 py-1.5 bg-gray-100 rounded-full text-sm font-medium text-gray-600">
                    +{visitedCountries.length - 15}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
