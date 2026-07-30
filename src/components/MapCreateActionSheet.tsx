import { Calendar, Coffee, X, ChevronLeft } from 'lucide-react';

/*
  The map's "+" chooser — styled EXACTLY like the home screen's CreateModal so both
  entry points feel identical (same overlay, panel, header, cards and cancel button).
  Only the secondary option differs: the map offers a spontaneous meetup.
*/
interface MapCreateActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEvent: () => void;
  onSelectMeetup: () => void;
}

export function MapCreateActionSheet({
  isOpen,
  onClose,
  onSelectEvent,
  onSelectMeetup,
}: MapCreateActionSheetProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end justify-center z-50 animate-fade-in"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-t-[28px] animate-slide-up shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
      >
        {/* grabber */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* header */}
        <div className="flex items-center justify-between px-6 pt-2 pb-5">
          <h2 className="text-[22px] font-black text-gray-900" style={{ fontFamily: 'Heebo, sans-serif' }}>
            מה תרצו ליצור?
          </h2>
          <button
            onClick={onClose}
            aria-label="סגור"
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 active:scale-95 transition"
            style={{ touchAction: 'manipulation' }}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="px-5 space-y-3">
          {/* PRIMARY — Event (the core action) */}
          <button
            onClick={onSelectEvent}
            className="w-full p-5 rounded-3xl text-white active:scale-[0.98] transition-transform"
            style={{
              background: 'linear-gradient(135deg, #F97316, #EA580C)',
              boxShadow: '0 10px 30px rgba(249,115,22,0.35)',
              fontFamily: 'Heebo, sans-serif',
            }}
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.22)' }}>
                <Calendar className="w-7 h-7" strokeWidth={2.4} />
              </div>
              <div className="flex-1 text-right min-w-0">
                <h3 className="text-[19px] font-black mb-0.5">אירוע</h3>
                <p className="text-[13px] text-white/90" style={{ fontFamily: 'Rubik, sans-serif' }}>
                  ארגנו מסיבה, טיול או מפגש — והזמינו אנשים
                </p>
              </div>
              <ChevronLeft className="w-5 h-5 text-white/70 flex-shrink-0" strokeWidth={2.5} />
            </div>
          </button>

          {/* SECONDARY — Spontaneous meetup */}
          <button
            onClick={onSelectMeetup}
            className="w-full p-5 rounded-3xl bg-white border border-gray-100 active:scale-[0.98] transition-transform"
            style={{ boxShadow: 'var(--shadow-card)' }}
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: '#FFF7ED' }}>
                <Coffee className="w-7 h-7" style={{ color: '#F97316' }} strokeWidth={2.2} />
              </div>
              <div className="flex-1 text-right min-w-0">
                <h3 className="text-[18px] font-black text-gray-900 mb-0.5" style={{ fontFamily: 'Heebo, sans-serif' }}>ציוץ על המפה</h3>
                <p className="text-[13px] text-gray-500" style={{ fontFamily: 'Rubik, sans-serif' }}>
                  פגישה מיידית עם אנשים בסביבה
                </p>
              </div>
              <ChevronLeft className="w-5 h-5 text-gray-300 flex-shrink-0" strokeWidth={2.5} />
            </div>
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-3 py-3.5 text-gray-500 font-bold active:opacity-70 transition"
          style={{ fontFamily: 'Heebo, sans-serif' }}
        >
          ביטול
        </button>
      </div>
    </div>
  );
}
