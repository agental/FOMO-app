import { useEffect, useState } from 'react';
import { subscribeToast, playChime, type ToastItem } from '../utils/toast';

/*
  Global toast host — mounted once at the app root (main.tsx). Renders immediate,
  tappable, iOS-style notification banners on top of every screen (web / PWA). On the
  native app, real system notifications are used instead (see utils/nativeNotify).
  Auto-dismisses after 5s.
*/
export function ToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => subscribeToast((t) => {
    setToasts((prev) => [...prev, t]);
    playChime();
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 5000);
  }), []);

  const dismiss = (id: number) => setToasts((prev) => prev.filter((x) => x.id !== id));

  if (!toasts.length) return null;

  return (
    <div
      dir="rtl"
      style={{
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top) + 8px)',
        left: 0, right: 0, zIndex: 3000,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        pointerEvents: 'none', padding: '0 8px',
      }}
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => { try { t.onClick?.(); } finally { dismiss(t.id); } }}
          style={{
            pointerEvents: 'auto',
            display: 'flex', alignItems: 'center', gap: 11, width: '100%', maxWidth: 440,
            padding: 12, borderRadius: 20, border: 'none', cursor: 'pointer', textAlign: 'right',
            background: 'rgba(255,255,255,0.82)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.22)',
            animation: 'fomo-toast-in 0.34s cubic-bezier(0.22,1,0.36,1)',
          }}
        >
          {/* app-icon tile, tinted by the notification's colour */}
          <span
            style={{
              flexShrink: 0, width: 38, height: 38, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
              background: t.background || 'linear-gradient(135deg,#F97316,#EA580C)',
            }}
          >
            {t.emoji || '🔔'}
          </span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: 'block', fontFamily: 'Heebo, sans-serif', fontWeight: 800, fontSize: 13, color: '#1C1C1E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {t.title || 'FOMO'}
            </span>
            <span style={{ display: 'block', fontFamily: 'Rubik, sans-serif', fontSize: 14, color: '#3A3A3C', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {t.text}
            </span>
          </span>
        </button>
      ))}
      <style>{`@keyframes fomo-toast-in { from { opacity: 0; transform: translateY(-18px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>
    </div>
  );
}
