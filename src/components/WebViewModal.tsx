import { X } from 'lucide-react';

interface WebViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
}

export function WebViewModal({ isOpen, onClose, url }: WebViewModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-white z-[60] flex flex-col">
      <div className="bg-gray-100 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <button
          onClick={onClose}
          className="w-10 h-10 bg-white rounded-full flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm"
        >
          <X className="w-6 h-6 text-gray-700" />
        </button>
        <span className="text-sm text-gray-600 font-medium">הרשמה לשבת/חג</span>
        <div className="w-10" />
      </div>

      <div className="flex-1 relative">
        <iframe
          src={url}
          className="w-full h-full border-0"
          title="Shabbat Registration"
          allow="clipboard-write; payment"
        />
      </div>
    </div>
  );
}
