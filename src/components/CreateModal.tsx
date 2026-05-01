import { Calendar, FileText, X, Hop as Home } from 'lucide-react';

type CreateModalProps = {
  onSelectEvent: () => void;
  onSelectPost: () => void;
  onSelectLocation?: () => void;
  onClose: () => void;
  isAdmin?: boolean;
};

export function CreateModal({ onSelectEvent, onSelectPost, onSelectLocation, onClose, isAdmin = false }: CreateModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end justify-center z-40 animate-fade-in"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="bg-gradient-to-br from-white to-brand-50/30 w-full max-w-md rounded-t-[32px] p-7 animate-slide-up border-t-4 border-brand-400 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">+ יצירת תוכן</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <div className="space-y-4">
          <button
            onClick={onSelectEvent}
            className="w-full p-6 bg-gradient-to-br from-brand-500 to-brand-600 text-white rounded-3xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.03] active:scale-[0.97] shadow-xl hover:-translate-y-1 group"
          >
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 bg-white/25 backdrop-blur-sm rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <Calendar className="w-8 h-8" strokeWidth={2.5} />
              </div>
              <div className="text-right flex-1">
                <h3 className="text-2xl font-bold mb-1.5" style={{ fontFamily: 'Heebo, sans-serif' }}>📅 יצירת אירוע</h3>
                <p className="text-white/90 text-sm font-medium" style={{ fontFamily: 'Rubik, sans-serif' }}>
                  ארגן פגישה, טיול או פעילות
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={onSelectPost}
            className="w-full p-6 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 text-white rounded-3xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.03] active:scale-[0.97] shadow-xl hover:-translate-y-1 group"
          >
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 bg-white/25 backdrop-blur-sm rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <FileText className="w-8 h-8" strokeWidth={2.5} />
              </div>
              <div className="text-right flex-1">
                <h3 className="text-2xl font-bold mb-1.5" style={{ fontFamily: 'Heebo, sans-serif' }}>💡 המלצה חדשה</h3>
                <p className="text-white/90 text-sm font-medium" style={{ fontFamily: 'Rubik, sans-serif' }}>
                  שתף מקום מומלץ או עסק מגניב
                </p>
              </div>
            </div>
          </button>

          {isAdmin && onSelectLocation && (
            <button
              onClick={onSelectLocation}
              className="w-full p-6 bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 text-white rounded-3xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.03] active:scale-[0.97] shadow-xl hover:-translate-y-1 group"
            >
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-white/25 backdrop-blur-sm rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Home className="w-8 h-8" strokeWidth={2.5} />
                </div>
                <div className="text-right flex-1">
                  <h3 className="text-2xl font-bold mb-1.5" style={{ fontFamily: 'Heebo, sans-serif' }}>🏠 הוספת מקום</h3>
                  <p className="text-white/90 text-sm font-medium" style={{ fontFamily: 'Rubik, sans-serif' }}>
                    הוסף בית חב״ד או מקום חשוב למפה
                  </p>
                </div>
              </div>
            </button>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full mt-4 py-3 text-gray-600 font-semibold hover:bg-gray-100 rounded-xl transition-colors"
        >
          ביטול
        </button>
      </div>
    </div>
  );
}
