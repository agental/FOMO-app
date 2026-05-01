import { X, Calendar, Coffee } from 'lucide-react';

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
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity duration-300"
        onClick={onClose}
      />
      <div
        className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-50 animate-in slide-in-from-bottom duration-300"
        dir="rtl"
      >
        <div className="w-full py-3 flex justify-center">
          <div className="w-10 h-1.5 bg-gray-300 rounded-full" />
        </div>

        <div className="px-5 pb-8">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold text-gray-900">מה תרצה להוסיף?</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          <div className="space-y-3">
            {/* Event */}
            <button
              onClick={onSelectEvent}
              className="w-full flex items-center gap-4 p-5 bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 rounded-2xl transition-all active:scale-[0.98] border border-blue-200"
            >
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                <Calendar className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1 text-right">
                <h3 className="text-lg font-bold text-gray-900">אירוע</h3>
                <p className="text-sm text-gray-500">מסיבה, טרק, סדנה וכו׳</p>
              </div>
            </button>

            {/* Meetup / ישיבה */}
            <button
              onClick={onSelectMeetup}
              className="w-full flex items-center gap-4 p-5 bg-gradient-to-br from-orange-50 to-orange-100 hover:from-orange-100 hover:to-orange-200 rounded-2xl transition-all active:scale-[0.98] border border-orange-200"
            >
              <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                <Coffee className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1 text-right">
                <h3 className="text-lg font-bold text-gray-900">ישיבה ספונטנית</h3>
                <p className="text-sm text-gray-500">פגישה מיידית עם אנשים בסביבה</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
