import { useState, useEffect } from 'react';
import { Bell, Calendar, Clock, Users, MessageCircle, UserPlus, Star, Megaphone } from 'lucide-react';
import { SettingsToggle } from './SettingsToggle';
import { BackButton } from './BackButton';
import { loadLocalPrefs, loadCloudPrefs, savePrefs, type Prefs } from '../utils/userPrefs';

interface NotificationsScreenProps {
  currentUserId?: string | null;
  onBack?: () => void;
}

const COLUMN = 'notification_prefs' as const;

const DEFAULTS: Prefs = {
  push: true,
  newEvents: true,
  eventReminders: true,
  eventUpdates: true,
  messages: true,
  joinRequests: true,
  requestDecisions: true,
  recommendations: false,
  marketing: false,
};

export function NotificationsScreen({ currentUserId, onBack }: NotificationsScreenProps) {
  const [prefs, setPrefs] = useState<Prefs>(() => loadLocalPrefs(COLUMN, currentUserId, DEFAULTS));

  // Pull the cloud copy once available (overrides the local seed).
  useEffect(() => {
    let cancelled = false;
    loadCloudPrefs(COLUMN, currentUserId, DEFAULTS).then(cloud => {
      if (!cancelled && cloud) setPrefs(cloud);
    });
    return () => { cancelled = true; };
  }, [currentUserId]);

  const setPref = (key: string, value: boolean) => {
    setPrefs(prev => {
      const next = { ...prev, [key]: value };
      void savePrefs(COLUMN, currentUserId, next);
      return next;
    });
  };

  const pushOff = !prefs.push;

  const sections: { title: string; rows: { key: string; icon: React.ReactNode; label: string; sublabel?: string; master?: boolean }[] }[] = [
    {
      title: 'כללי',
      rows: [
        { key: 'push', icon: <Bell className="w-5 h-5" />, label: 'התראות פוש', sublabel: 'הפעלה/כיבוי של כל ההתראות', master: true },
      ],
    },
    {
      title: 'אירועים',
      rows: [
        { key: 'newEvents',     icon: <Calendar className="w-5 h-5" />, label: 'אירועים חדשים באזור שלי', sublabel: 'כשנפתח אירוע במדינות שלך' },
        { key: 'eventReminders',icon: <Clock className="w-5 h-5" />,    label: 'תזכורות לאירועים', sublabel: 'לפני אירוע שאתה משתתף בו' },
        { key: 'eventUpdates',  icon: <Users className="w-5 h-5" />,    label: 'עדכונים על אירועים שלי', sublabel: 'שינויים, ביטולים ומשתתפים חדשים' },
      ],
    },
    {
      title: 'חברתי',
      rows: [
        { key: 'messages',        icon: <MessageCircle className="w-5 h-5" />, label: 'הודעות חדשות', sublabel: 'כשמישהו שולח לך הודעה' },
        { key: 'joinRequests',    icon: <UserPlus className="w-5 h-5" />,      label: 'בקשות הצטרפות', sublabel: 'כשמבקשים להצטרף לאירוע שלך' },
        { key: 'requestDecisions',icon: <Star className="w-5 h-5" />,          label: 'אישור בקשות', sublabel: 'כשמאשרים או דוחים את בקשתך' },
      ],
    },
    {
      title: 'תוכן ושיווק',
      rows: [
        { key: 'recommendations', icon: <Star className="w-5 h-5" />,     label: 'המלצות ומקומות חדשים', sublabel: 'המלצות שמשתפים באזור שלך' },
        { key: 'marketing',       icon: <Megaphone className="w-5 h-5" />, label: 'טיפים והצעות מ-FOMO', sublabel: 'חדשות, מבצעים ועדכוני אפליקציה' },
      ],
    },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)' }} dir="rtl">
      {/* Header */}
      <header
        className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-b border-gray-100"
        style={{ paddingTop: 'env(safe-area-inset-top)', boxShadow: '0 1px 0 rgba(0,0,0,0.05)' }}
      >
        <div className="flex items-center h-16 px-4 gap-3">
          <BackButton onClick={onBack} />
          <h1 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Heebo, sans-serif' }}>התראות</h1>
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
              {section.rows.map((row, ri) => {
                const disabled = !row.master && pushOff;
                return (
                  <div
                    key={row.key}
                    className={`w-full flex items-center gap-4 px-4 py-4 ${ri < section.rows.length - 1 ? 'border-b border-gray-100' : ''} ${disabled ? 'opacity-50' : ''}`}
                  >
                    <span className="flex-shrink-0 text-gray-400">{row.icon}</span>
                    <div className="flex-1 text-right">
                      <p className="text-sm font-medium text-gray-900" style={{ fontFamily: 'Heebo, sans-serif' }}>{row.label}</p>
                      {row.sublabel && <p className="text-xs text-gray-400 mt-0.5">{row.sublabel}</p>}
                    </div>
                    <SettingsToggle checked={!!prefs[row.key]} onChange={(v) => setPref(row.key, v)} disabled={disabled} />
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <p className="text-[12px] text-gray-400 text-center px-6 leading-relaxed">
          ההעדפות נשמרות בחשבונך ומסתנכרנות בין המכשירים שלך.
        </p>
      </div>
    </div>
  );
}
