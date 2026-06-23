import { ChevronLeft, Mail, Heart } from 'lucide-react';

interface AboutScreenProps {
  onBack?: () => void;
}

const APP_VERSION = '1.0.0';

export function AboutScreen({ onBack }: AboutScreenProps) {
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)' }} dir="rtl">
      {/* Header */}
      <header
        className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-b border-gray-100"
        style={{ paddingTop: 'env(safe-area-inset-top)', boxShadow: '0 1px 0 rgba(0,0,0,0.05)' }}
      >
        <div className="flex items-center h-16 px-4 gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors active:scale-95">
            <ChevronLeft className="w-5 h-5 text-gray-600" strokeWidth={2} />
          </button>
          <h1 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Heebo, sans-serif' }}>אודות FOMO</h1>
        </div>
      </header>

      {/* Content */}
      <div className="px-6 pb-16 flex flex-col items-center text-center" style={{ paddingTop: 'calc(4rem + env(safe-area-inset-top) + 2.5rem)' }}>
        {/* Logo */}
        <div
          className="w-24 h-24 rounded-[26px] flex items-center justify-center mb-5"
          style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', boxShadow: '0 12px 30px rgba(249,115,22,0.45)' }}
        >
          <span className="text-white text-[34px] font-black" style={{ fontFamily: 'Heebo, sans-serif' }}>FOMO</span>
        </div>

        <h2 className="text-[22px] font-black text-gray-900" style={{ fontFamily: 'Heebo, sans-serif' }}>FOMO</h2>
        <p className="text-[13px] text-gray-400 mt-1 mb-6">גרסה {APP_VERSION}</p>

        <p className="text-[15px] text-gray-600 leading-relaxed max-w-[300px] mb-8" style={{ fontFamily: 'Rubik, sans-serif' }}>
          האפליקציה שמחברת מטיילים ישראלים סביב העולם — מצאו אירועים, מפגשים והמלצות במקום שבו אתם נמצאים, והכירו אנשים חדשים בדרך. 🌍
        </p>

        {/* Contact */}
        <a
          href="mailto:hello@fomo.app"
          className="w-full max-w-[320px] flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-white active:scale-[0.98] transition-transform"
          style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', boxShadow: '0 8px 24px rgba(249,115,22,0.35)', fontFamily: 'Heebo, sans-serif' }}
        >
          <Mail className="w-5 h-5" /> צרו קשר
        </a>

        <p className="text-[12px] text-gray-400 mt-10 flex items-center gap-1.5">
          נבנה עם <Heart className="w-3.5 h-3.5 text-orange-500" fill="#F97316" /> בישראל
        </p>
        <p className="text-[11px] text-gray-300 mt-2">© {new Date().getFullYear()} FOMO. כל הזכויות שמורות.</p>
      </div>
    </div>
  );
}
