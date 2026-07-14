import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, MapPin } from 'lucide-react';
import { placePinColor } from '../utils/placePinColor';

interface AuthScreenProps {
  onAuthSuccess: (userId: string) => void; // kept for API compatibility; OAuth resolves via App's onAuthStateChange
}

/* City chats, shown as a gently marquee-ing strip at the top — a live taste of the feature. */
const CITIES = [
  { flag: '🇹🇭', name: 'בנגקוק' },
  { flag: '🇮🇱', name: 'תל אביב' },
  { flag: '🇮🇳', name: 'גואה' },
  { flag: '🇵🇹', name: 'ליסבון' },
  { flag: '🇬🇪', name: 'טביליסי' },
  { flag: '🇻🇳', name: 'האנוי' },
  { flag: '🇨🇴', name: 'מדיין' },
  { flag: '🇬🇷', name: 'סנטוריני' },
];

const AVATAR_B = 'https://i.pravatar.cc/150?img=8';

// The Ko Phangan group preview — a beach-coloured icon circle (same colour the map uses for 🏖️).
const BEACH_EMOJI = '🏖️';
const BEACH_COLOR = placePinColor(BEACH_EMOJI);

// iOS must show "Sign in with Apple" whenever another social login is offered, and it reads best on top.
const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

const HEEBO = "'Heebo', sans-serif";
const RUBIK = "'Rubik', sans-serif";
const INK = '#141821';

export function AuthScreen(_props: AuthScreenProps) {
  const [error, setError] = useState<string | null>(null);
  const [busy,  setBusy]  = useState<'google' | 'apple' | null>(null);

  // OAuth sign-in (Google / Apple only). Native bridge is the only path that works in the WebView:
  // Google/Apple block OAuth in embedded webviews, so the auth URL is handed to App.js which opens
  // the system browser; the implicit-flow tokens come back via __fomoSetSession → SIGNED_IN.
  const handleOAuth = async (provider: 'google' | 'apple') => {
    setError(null);
    setBusy(provider);
    const names = { google: 'Google', apple: 'Apple' } as const;
    const rn = (window as unknown as { ReactNativeWebView?: { postMessage: (m: string) => void } }).ReactNativeWebView;
    const nativeRedirect = (window as unknown as { __fomoRedirectUri?: string }).__fomoRedirectUri;
    try {
      if (rn && nativeRedirect) {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: { skipBrowserRedirect: true, redirectTo: nativeRedirect },
        });
        if (error || !data?.url) { setError(`ההתחברות עם ${names[provider]} אינה זמינה כרגע`); setBusy(null); return; }
        rn.postMessage(JSON.stringify({ type: 'oauth', url: data.url }));
        return; // native browser takes over
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/` },
      });
      if (error) { setError(`ההתחברות עם ${names[provider]} אינה זמינה כרגע`); setBusy(null); }
    } catch {
      setError(`ההתחברות עם ${names[provider]} אינה זמינה כרגע`);
      setBusy(null);
    }
  };

  const AppleButton = (
    <button
      type="button" onClick={() => handleOAuth('apple')} disabled={busy !== null}
      style={{
        width: '100%', height: 56, borderRadius: 16, border: 'none', background: '#000', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        fontSize: 16, fontWeight: 700, fontFamily: HEEBO,
        cursor: busy ? 'default' : 'pointer', opacity: busy && busy !== 'apple' ? 0.5 : 1,
        boxShadow: '0 6px 18px rgba(0,0,0,0.16)', transition: 'opacity 0.2s',
      }}
    >
      {busy === 'apple' ? <Spinner light /> : (
        <>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="#fff" aria-hidden>
            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
          </svg>
          המשך עם Apple
        </>
      )}
    </button>
  );

  const GoogleButton = (
    <button
      type="button" onClick={() => handleOAuth('google')} disabled={busy !== null}
      style={{
        width: '100%', height: 56, borderRadius: 16, background: '#fff', color: '#3C4043', border: '1px solid #DADCE0',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        fontSize: 16, fontWeight: 700, fontFamily: HEEBO,
        cursor: busy ? 'default' : 'pointer', opacity: busy && busy !== 'google' ? 0.5 : 1,
        boxShadow: '0 4px 14px rgba(0,0,0,0.07)', transition: 'opacity 0.2s',
      }}
    >
      {busy === 'google' ? <Spinner /> : (
        <>
          <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          המשך עם Google
        </>
      )}
    </button>
  );

  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100dvh', width: '100%', position: 'relative',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        fontFamily: HEEBO,
        background: 'linear-gradient(180deg, #FFFFFF 0%, #FFFFFF 70%, #FFF7ED 100%)',
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      {/* ── Wordmark ── */}
      <div style={{ textAlign: 'center', paddingTop: 18, paddingBottom: 12 }}>
        <span dir="ltr" style={{ fontSize: 30, fontWeight: 900, color: INK, letterSpacing: '-1.5px', fontFamily: HEEBO }}>
          FOMO<span style={{ color: '#F97316' }}>.</span>
        </span>
      </div>

      {/* ── City-chats strip (marquee) ── */}
      <div style={{ borderTop: '1px solid #F1F1F3', borderBottom: '1px solid #F1F1F3', overflow: 'hidden', padding: '11px 0' }}>
        <div className="fomo-marquee" style={{ display: 'flex', width: 'max-content', animation: 'fomoMarquee 34s linear infinite' }}>
          {[...CITIES, ...CITIES].map((c, i) => (
            <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '0 16px', borderInlineEnd: '1px solid #F1F1F3', whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: 16 }}>{c.flag}</span>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: '#3A3F4A', fontFamily: HEEBO }}>{c.name}</span>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', boxShadow: '0 0 0 3px rgba(34,197,94,0.18)' }} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Heading ── */}
      <div style={{ padding: '26px 26px 0', animation: 'fomoFadeUp 0.7s cubic-bezier(0.22,1,0.36,1) both' }}>
        <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.2, fontWeight: 900, color: INK, fontFamily: HEEBO }}>
          מצא חברים לטיול,<br />בכל מקום בעולם 🎉
        </h1>
        <p style={{ margin: '10px 0 0', fontSize: 15.5, fontWeight: 500, color: '#6B7280', fontFamily: RUBIK }}>
          הצטרף לאירועים, דבר עם מטיילים והכיר את המקום — לפני שאתה שם.
        </p>
      </div>

      {/* ── Floating feature-preview cards ── */}
      <div style={{ position: 'relative', flex: 1, minHeight: 300, margin: '8px 0' }}>
        {/* City chat — the Ko Phangan group */}
        <div className="fomo-float" style={{ ...floatCard, top: '4%', insetInlineEnd: '5%', animation: 'fomoFloatA 6s ease-in-out infinite' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
            <span style={{
              width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
              display: 'grid', placeItems: 'center', fontSize: 13,
              background: `${BEACH_COLOR}22`, boxShadow: `inset 0 0 0 1.6px ${BEACH_COLOR}`,
            }}>
              {BEACH_EMOJI}
            </span>
            <span style={{ fontSize: 12, fontWeight: 800, color: INK, fontFamily: HEEBO }}>קו פנגן 🇹🇭</span>
            <span style={cityDot} />
          </div>
          <div style={bubble}>מי בא לחוף הפלמינגו עכשיו? 🏖️</div>
        </div>

        {/* Map */}
        <div className="fomo-float" style={{ ...floatCard, top: '30%', insetInlineStart: '6%', width: 150, animation: 'fomoFloatB 7s ease-in-out infinite' }}>
          <div style={{ position: 'relative', height: 74, borderRadius: 12, overflow: 'hidden', background: 'linear-gradient(135deg,#E8F0E4,#DDE7F0)' }}>
            {/* faux roads */}
            <div style={{ position: 'absolute', top: 26, left: -4, right: -4, height: 6, background: '#fff', opacity: 0.9, transform: 'rotate(-8deg)' }} />
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: 52, width: 6, background: '#fff', opacity: 0.9, transform: 'rotate(6deg)' }} />
            <div style={{ position: 'absolute', top: 40, right: 14, width: 34, height: 24, borderRadius: 6, background: '#CFE3C4' }} />
            {/* teardrop pin */}
            <div style={{ position: 'absolute', left: '50%', top: '46%', transform: 'translate(-50%,-100%)' }}>
              <div style={{ width: 20, height: 20, borderRadius: '50% 50% 50% 0', transform: 'rotate(45deg)', background: 'linear-gradient(135deg,#FB923C,#EA580C)', boxShadow: '0 3px 6px rgba(234,88,12,0.4)' }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff', position: 'absolute', top: 6.5, left: 6.5, transform: 'rotate(-45deg)' }} />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 7 }}>
            <MapPin size={13} color="#EA580C" strokeWidth={2.4} />
            <span style={{ fontSize: 12, fontWeight: 800, color: INK, fontFamily: HEEBO }}>מקומות שווים לידך</span>
          </div>
        </div>

        {/* Event / home card */}
        <div className="fomo-float" style={{ ...floatCard, top: '52%', insetInlineEnd: '9%', width: 172, animation: 'fomoFloatC 6.6s ease-in-out infinite' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#F97316,#EA580C)', display: 'grid', placeItems: 'center', fontSize: 20, flexShrink: 0 }}>🎉</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: INK, fontFamily: HEEBO, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>מסיבת גג · הערב</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#9AA0AC', fontFamily: HEEBO }}>12 מטיילים מגיעים</div>
            </div>
          </div>
        </div>

        {/* Recommendation thumbtack */}
        <div className="fomo-float" style={{ ...floatCard, top: '76%', insetInlineStart: '12%', animation: 'fomoFloatA 7.4s ease-in-out infinite', animationDelay: '0.5s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src={AVATAR_B} alt="" style={{ ...avatarS, boxShadow: '0 0 0 2px #fff, 0 0 0 4px #7A57C2' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: INK, fontFamily: HEEBO }}>המליץ: הקפה הכי טוב בעיר ☕</span>
          </div>
        </div>
      </div>

      {/* ── Buttons + legal ── */}
      <div style={{ padding: '0 26px max(28px, calc(env(safe-area-inset-bottom) + 16px))', animation: 'fomoFadeUp 0.7s 0.06s cubic-bezier(0.22,1,0.36,1) both' }}>
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 14, padding: '11px 14px', color: '#DC2626', fontSize: 13 }}>
            <AlertCircle size={15} style={{ flexShrink: 0 }} />{error}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {isIOS ? <>{AppleButton}{GoogleButton}</> : <>{GoogleButton}{AppleButton}</>}
        </div>
        <p style={{ margin: '16px 0 0', textAlign: 'center', fontSize: 11.5, lineHeight: 1.6, color: '#9AA0AC', fontFamily: RUBIK }}>
          בהמשך אתה מאשר את <span style={{ color: '#EA580C', fontWeight: 700 }}>תנאי השימוש</span> ו<span style={{ color: '#EA580C', fontWeight: 700 }}>מדיניות הפרטיות</span>
        </p>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800;900&family=Rubik:wght@400;500;600&display=swap');
        @keyframes fomoFadeUp  { from { opacity:0; transform:translateY(22px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fomoMarquee { from { transform:translateX(0); } to { transform:translateX(-50%); } }
        @keyframes fomoFloatA  { 0%,100% { transform:translateY(0) rotate(-4deg); } 50% { transform:translateY(-12px) rotate(-4deg); } }
        @keyframes fomoFloatB  { 0%,100% { transform:translateY(0) rotate(3deg); } 50% { transform:translateY(-14px) rotate(3deg); } }
        @keyframes fomoFloatC  { 0%,100% { transform:translateY(0) rotate(-2deg); } 50% { transform:translateY(-10px) rotate(-2deg); } }
        @keyframes spin        { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) {
          .fomo-marquee, .fomo-float { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

/* ── shared styles ── */
const floatCard: React.CSSProperties = {
  position: 'absolute', background: '#fff', borderRadius: 16, padding: '11px 13px',
  boxShadow: '0 12px 30px rgba(20,24,33,0.10), 0 2px 6px rgba(20,24,33,0.05)',
  width: 176, willChange: 'transform',
};
const avatarS: React.CSSProperties = { width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 };
const cityDot: React.CSSProperties = { width: 6, height: 6, borderRadius: '50%', background: '#22C55E', marginInlineStart: 'auto' };
const bubble: React.CSSProperties = {
  background: '#F3F4F6', borderRadius: '4px 12px 12px 12px', padding: '7px 11px',
  fontSize: 12.5, color: '#374151', fontFamily: RUBIK, lineHeight: 1.35,
};

/* Button busy spinner. `light` = white on dark (Apple); default = orange on white (Google). */
function Spinner({ light }: { light?: boolean }) {
  return (
    <div style={{
      width: 20, height: 20, borderRadius: '50%',
      border: `2.5px solid ${light ? 'rgba(255,255,255,0.35)' : 'rgba(249,115,22,0.3)'}`,
      borderTopColor: light ? '#fff' : '#F97316', animation: 'spin 0.7s linear infinite',
    }} />
  );
}
