import { useState, useEffect } from 'react';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { MapPin, Eye, UserCheck, Cake, Instagram, MessageCircle, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { BackButton } from './BackButton';
import { SettingsToggle } from './SettingsToggle';
import { loadLocalPrefs, loadCloudPrefs, savePrefs, type Prefs } from '../utils/userPrefs';

interface PrivacyScreenProps {
  currentUserId?: string | null;
  onBack?: () => void;
}

const COLUMN = 'privacy_prefs' as const;

const DEFAULTS: Prefs = {
  shareLocation: false,   // authoritative source is users.is_location_shared
  showOnMap: true,
  publicProfile: true,
  showAge: true,
  showInstagram: true,
  allowMessages: true,
  discoverable: true,
};

export function PrivacyScreen({ currentUserId, onBack }: PrivacyScreenProps) {
  const swipeRef = useSwipeBack<HTMLDivElement>(onBack); // swipe from an edge to slide the screen back
  const [prefs, setPrefs] = useState<Prefs>(() => loadLocalPrefs(COLUMN, currentUserId, DEFAULTS));

  // Load the cloud copy, then let the dedicated is_location_shared column win
  // for the location toggle (it's what the map actually reads).
  useEffect(() => {
    if (!currentUserId) return;
    let cancelled = false;
    (async () => {
      const cloud = await loadCloudPrefs(COLUMN, currentUserId, DEFAULTS);
      const { data } = await supabase.from('users').select('is_location_shared').eq('id', currentUserId).maybeSingle();
      if (cancelled) return;
      setPrefs(prev => {
        const merged = { ...prev, ...(cloud || {}) };
        if (data && typeof data.is_location_shared === 'boolean') merged.shareLocation = data.is_location_shared;
        return merged;
      });
    })();
    return () => { cancelled = true; };
  }, [currentUserId]);

  const setPref = (key: string, value: boolean) => {
    setPrefs(prev => {
      const next = { ...prev, [key]: value };
      void savePrefs(COLUMN, currentUserId, next);
      // Location sharing is also backed by a real column the map reads from.
      if (key === 'shareLocation' && currentUserId) {
        supabase.from('users').update({ is_location_shared: value }).eq('id', currentUserId)
          .then(({ error }) => { if (error) console.error('Update location sharing error:', error); });
      }
      return next;
    });
  };

  const sections: { title: string; rows: { key: string; icon: React.ReactNode; label: string; sublabel?: string }[] }[] = [
    {
      title: 'מיקום',
      rows: [
        { key: 'shareLocation', icon: <MapPin className="w-5 h-5" />, label: 'שיתוף מיקום', sublabel: 'אפשר למשתמשים אחרים לראות את מיקומך' },
        { key: 'showOnMap',     icon: <Eye className="w-5 h-5" />,    label: 'הצג אותי במפה', sublabel: 'הופעת הפרופיל שלך במפת המשתמשים' },
      ],
    },
    {
      title: 'פרופיל',
      rows: [
        { key: 'publicProfile', icon: <UserCheck className="w-5 h-5" />, label: 'פרופיל ציבורי', sublabel: 'כל אחד יכול לצפות בפרופיל שלך' },
        { key: 'showAge',       icon: <Cake className="w-5 h-5" />,      label: 'הצגת גיל', sublabel: 'הצג את הגיל שלך בפרופיל' },
        { key: 'showInstagram', icon: <Instagram className="w-5 h-5" />, label: 'הצגת אינסטגרם', sublabel: 'הצג קישור לאינסטגרם שלך' },
      ],
    },
    {
      title: 'תקשורת',
      rows: [
        { key: 'allowMessages', icon: <MessageCircle className="w-5 h-5" />, label: 'אפשר הודעות מכולם', sublabel: 'אם כבוי — רק משתתפים משותפים' },
        { key: 'discoverable',  icon: <Search className="w-5 h-5" />,        label: 'ניתן לחיפוש', sublabel: 'אפשר למשתמשים למצוא אותך בחיפוש' },
      ],
    },
  ];

  return (
    <div ref={swipeRef} className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)' }} dir="rtl">
      {/* Header */}
      <header
        className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-b border-gray-100"
        style={{ paddingTop: 'env(safe-area-inset-top)', boxShadow: '0 1px 0 rgba(0,0,0,0.05)' }}
      >
        <div className="flex items-center h-16 px-4 gap-3">
          <BackButton onClick={onBack} />
          <h1 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Heebo, sans-serif' }}>פרטיות ואבטחה</h1>
        </div>
      </header>

      {/* Content */}
      <div className="px-4 pb-16" style={{ paddingTop: 'calc(4rem + env(safe-area-inset-top) + 1.5rem)' }}>
        {sections.map((section, si) => (
          <div key={si} className="mb-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 px-1" style={{ fontFamily: 'Heebo, sans-serif', letterSpacing: '0.08em' }}>
              {section.title}
            </p>
            <div className="bg-white rounded-2xl overflow-hidden border border-gray-100" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              {section.rows.map((row, ri) => (
                <div key={row.key} className={`w-full flex items-center gap-4 px-4 py-4 ${ri < section.rows.length - 1 ? 'border-b border-gray-100' : ''}`}>
                  <span className="flex-shrink-0 text-gray-400">{row.icon}</span>
                  <div className="flex-1 text-right">
                    <p className="text-sm font-medium text-gray-900" style={{ fontFamily: 'Heebo, sans-serif' }}>{row.label}</p>
                    {row.sublabel && <p className="text-xs text-gray-400 mt-0.5">{row.sublabel}</p>}
                  </div>
                  <SettingsToggle checked={!!prefs[row.key]} onChange={(v) => setPref(row.key, v)} />
                </div>
              ))}
            </div>
          </div>
        ))}

        <p className="text-[12px] text-gray-400 text-center px-6 leading-relaxed">
          ההגדרות נשמרות בחשבונך ומסתנכרנות בין המכשירים שלך.
        </p>
      </div>
    </div>
  );
}
