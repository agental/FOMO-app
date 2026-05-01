import { useState } from 'react';
import { LogOut, Globe, Bell, Shield, Info, ChevronLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { FloatingNavBar } from './FloatingNavBar';

interface SettingsScreenProps {
  currentUserId?: string | null;
  onBack?: () => void;
  onNavigateToHome?: () => void;
  onNavigateToMap?: () => void;
  onNavigateToMessages?: () => void;
  onSignOut?: () => void;
}

interface SettingRow {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onClick?: () => void;
  destructive?: boolean;
}

export function SettingsScreen({
  currentUserId,
  onBack,
  onNavigateToHome,
  onNavigateToMap,
  onNavigateToMessages,
  onSignOut,
}: SettingsScreenProps) {
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      onSignOut?.();
    } catch (err) {
      console.error('Sign out error:', err);
    } finally {
      setSigningOut(false);
    }
  };

  const sections: { title: string; rows: SettingRow[] }[] = [
    {
      title: 'כללי',
      rows: [
        {
          icon: <Globe className="w-5 h-5" />,
          label: 'מדינות נבחרות',
          sublabel: 'ניהול מדינות שאתה עוקב אחריהן',
        },
        {
          icon: <Bell className="w-5 h-5" />,
          label: 'התראות',
          sublabel: 'ניהול העדפות התראות',
        },
      ],
    },
    {
      title: 'פרטיות ואבטחה',
      rows: [
        {
          icon: <Shield className="w-5 h-5" />,
          label: 'פרטיות',
          sublabel: 'שליטה על מה שאחרים רואים',
        },
      ],
    },
    {
      title: 'אודות',
      rows: [
        {
          icon: <Info className="w-5 h-5" />,
          label: 'אודות FOMO',
          sublabel: 'גרסה 1.0.0',
        },
      ],
    },
    {
      title: '',
      rows: [
        {
          icon: <LogOut className="w-5 h-5" />,
          label: signingOut ? 'מתנתק...' : 'התנתקות',
          onClick: handleSignOut,
          destructive: true,
        },
      ],
    },
  ];

  return (
    <div
      className="min-h-screen"
      style={{ background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)' }}
      dir="rtl"
    >
      {/* Header */}
      <header
        className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-b border-gray-100"
        style={{ paddingTop: 'env(safe-area-inset-top)', boxShadow: '0 1px 0 rgba(0,0,0,0.05)' }}
      >
        <div className="flex items-center h-16 px-4 gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors active:scale-95"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" strokeWidth={2} />
          </button>
          <h1
            className="text-lg font-bold text-gray-900"
            style={{ fontFamily: 'Heebo, sans-serif' }}
          >
            הגדרות
          </h1>
        </div>
      </header>

      {/* Content */}
      <div
        className="px-4 pb-32"
        style={{ paddingTop: 'calc(4rem + env(safe-area-inset-top) + 1.5rem)' }}
      >
        {sections.map((section, si) => (
          <div key={si} className="mb-6">
            {section.title ? (
              <p
                className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 px-1"
                style={{ fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '0.08em' }}
              >
                {section.title}
              </p>
            ) : null}
            <div className="bg-white rounded-2xl overflow-hidden border border-gray-100" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              {section.rows.map((row, ri) => (
                <button
                  key={ri}
                  onClick={row.onClick}
                  disabled={!row.onClick || signingOut}
                  className={`w-full flex items-center gap-4 px-4 py-4 text-right transition-colors
                    ${row.onClick ? 'active:bg-gray-50 hover:bg-gray-50' : 'cursor-default'}
                    ${ri < section.rows.length - 1 ? 'border-b border-gray-100' : ''}
                  `}
                >
                  <span className={`flex-shrink-0 ${row.destructive ? 'text-rose-500' : 'text-gray-400'}`}>
                    {row.icon}
                  </span>
                  <div className="flex-1 text-right">
                    <p
                      className={`text-sm font-medium ${row.destructive ? 'text-rose-500' : 'text-gray-900'}`}
                      style={{ fontFamily: 'Heebo, sans-serif' }}
                    >
                      {row.label}
                    </p>
                    {row.sublabel && (
                      <p className="text-xs text-gray-400 mt-0.5" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                        {row.sublabel}
                      </p>
                    )}
                  </div>
                  {!row.destructive && row.onClick && (
                    <ChevronLeft className="w-4 h-4 text-gray-300 flex-shrink-0 rotate-180" strokeWidth={2} />
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <FloatingNavBar
        activeTab="settings"
        currentUserId={currentUserId}
        onHomeClick={onNavigateToHome}
        onMapClick={onNavigateToMap}
        onChatClick={onNavigateToMessages}
        onSettingsClick={() => {}}
      />
    </div>
  );
}
