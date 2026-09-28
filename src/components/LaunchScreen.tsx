import { useEffect, useRef, useState } from 'react';
import { Link2, Check, Bell, Users } from 'lucide-react';
import {
  fetchLaunchState,
  shouldShowLaunch,
  buildReferralLink,
  type LaunchState,
} from '../services/launchService';
import { CountdownTimer } from './launch/CountdownTimer';
import { LaunchBackground } from './launch/LaunchBackground';
import { InviteFriendsScreen } from './InviteFriendsScreen';
import { copyToClipboard } from '../utils/nativeShare';
import { supabase, hardSignOut } from '../lib/supabase';
import { loadValue, saveValue } from '../utils/warmCache';

const SF = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Heebo, sans-serif";
const INK = '#111827';
const SECONDARY = '#6E6E73'; // Apple's secondaryLabel
const ORANGE = '#F97316';

/**
 * Launch Mode screen — a premium, native-iOS pre-launch waiting room. Near-white background, a single
 * subtle warm glow behind the profile photo, one unified countdown surface, and restrained typography
 * (system font stack — resolves to real SF Pro + its Hebrew companion glyphs on iOS). Re-checks the
 * server on focus and hands control back to the app (onEnterApp) once launch is over / access granted.
 *
 * Presentation only — countdown, referral, config and share LOGIC are unchanged (launchService).
 */
export function LaunchScreen({
  initialState,
  currentUserId,
  onEnterApp,
}: {
  initialState: LaunchState;
  currentUserId: string | null;
  onEnterApp: () => void;
}) {
  const [state, setState] = useState<LaunchState>(initialState);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [name, setName] = useState<string>('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [notified, setNotified] = useState<boolean>(() => loadValue<boolean>(`launchNotified:${currentUserId}`, false));
  const [showInvite, setShowInvite] = useState(false);
  const enteredRef = useRef(false);

  const enterOnce = () => {
    if (enteredRef.current) return;
    enteredRef.current = true;
    onEnterApp();
  };

  // Hero — the user's own photo + first name (name used only for alt text / fallback initial).
  useEffect(() => {
    if (!currentUserId) return;
    let alive = true;
    supabase.from('users').select('avatar_url, display_name').eq('id', currentUserId).maybeSingle()
      .then(({ data }) => {
        if (!alive || !data) return;
        const d = data as { avatar_url?: string; display_name?: string };
        setAvatar(d.avatar_url || null);
        setName((d.display_name || '').trim().split(' ')[0] || '');
      });
    return () => { alive = false; };
  }, [currentUserId]);

  // Refresh from the server on focus; if launch is over / access granted, enter the app.
  useEffect(() => {
    const refresh = async () => {
      const next = await fetchLaunchState();
      if (!next) return; // fail-open
      if (!shouldShowLaunch(next)) { enterOnce(); return; }
      setState(next);
    };
    const onVis = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const code = state.referralCode || '';
  const link = code ? buildReferralLink(code) : 'https://fomo-tal.netlify.app';
  const inviteMessage = `אני כבר בפנים ב-FOMO 🔥 האפליקציה שתשנה את הדרך שאת/ה מגלה אירועים ואנשים בטיול. הצטרף/י דרך הלינק שלי:`;

  const onCopyLink = () => {
    if (!copyToClipboard(link)) return;
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1600);
  };
  const onNotify = () => {
    setNotified(true);
    if (currentUserId) saveValue(`launchNotified:${currentUserId}`, true);
  };
  const onSignOut = () => { hardSignOut().catch(() => {}); };

  const d = state.launchAtMs ? new Date(state.launchAtMs) : null;
  const dateLabel = d ? `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}` : null;

  return (
    <div
      dir="rtl"
      style={{
        position: 'fixed',
        inset: 0,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        background: '#FFFFFF',
        // Native-app feel: no text selection / iOS long-press "copy" callout (no inputs here).
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
    >
      <LaunchBackground />

      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 430,
          margin: '0 auto',
          minHeight: '100dvh',
          padding: '0 26px',
          paddingTop: 'max(44px, env(safe-area-inset-top, 0px))',
          paddingBottom: 'max(28px, env(safe-area-inset-bottom, 0px))',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Logo */}
        <div dir="ltr" style={{ fontFamily: SF, fontWeight: 700, fontSize: 26, color: INK, letterSpacing: '-1px' }}>
          FOMO<span style={{ color: ORANGE }}>.</span>
        </div>

        {/* Profile photo — small, thin flat border, almost no glow */}
        <div
          style={{
            marginTop: 56,
            width: 92,
            height: 92,
            borderRadius: '50%',
            border: `2px solid ${ORANGE}`,
            padding: 2,
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
          }}
        >
          {avatar ? (
            <img
              src={avatar}
              alt={name}
              style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div
              style={{
                width: '100%', height: '100%', borderRadius: '50%',
                background: '#FFF4EC', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: SF, fontWeight: 700, fontSize: 32, color: ORANGE,
              }}
            >
              {(name || 'F').charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Headline */}
        <div style={{ marginTop: 22, fontFamily: SF, fontWeight: 700, fontSize: 26, color: INK, textAlign: 'center', lineHeight: 1.25, letterSpacing: '-0.3px' }}>
          משהו גדול בדרך
        </div>
        <div style={{ marginTop: 6, fontFamily: SF, fontWeight: 400, fontSize: 14, color: SECONDARY, textAlign: 'center', lineHeight: 1.45, maxWidth: 260 }}>
          שתפו את הסטורי ותהיו חלק מהרגע שבו FOMO עולה לאוויר.
        </div>

        {/* Countdown */}
        <div style={{ width: '100%', marginTop: 32 }}>
          <CountdownTimer state={state} onComplete={enterOnce} />
        </div>

        {/* Primary + secondary actions — narrower, centered, restrained */}
        <div style={{ width: '100%', maxWidth: 300, display: 'flex', flexDirection: 'column', gap: 10, marginTop: 32 }}>
          <button
            onClick={() => setShowInvite(true)}
            className="fomo-press"
            style={{
              width: '100%', height: 50, borderRadius: 20, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #F97316, #EA580C)',
              color: '#fff', fontFamily: SF, fontWeight: 600, fontSize: 16, letterSpacing: '-0.2px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(249,115,22,0.14)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
            }}
          >
            <span>ספר לחברים</span>
            <Users size={17} strokeWidth={2.2} />
          </button>

          <button
            onClick={onNotify}
            disabled={notified}
            className="fomo-press"
            style={{
              width: '100%', height: 46, borderRadius: 20, border: 'none',
              cursor: notified ? 'default' : 'pointer',
              background: notified ? 'rgba(60,60,67,0.06)' : 'rgba(249,115,22,0.10)',
              color: notified ? SECONDARY : '#C2410C',
              fontFamily: SF, fontWeight: 600, fontSize: 15, letterSpacing: '-0.1px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <span>{notified ? 'נעדכן אותך בהשקה' : 'עדכנו אותי בהשקה'}</span>
            {notified ? <Check size={15} strokeWidth={2.6} /> : <Bell size={15} strokeWidth={2.2} />}
          </button>
        </div>

        {/* Quiet tertiary action */}
        {code && (
          <button
            onClick={onCopyLink}
            style={{
              marginTop: 14, background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, padding: 6,
              fontFamily: SF, fontWeight: 500, fontSize: 13, color: SECONDARY,
            }}
          >
            {linkCopied ? <Check size={13} strokeWidth={2.6} /> : <Link2 size={13} strokeWidth={2.2} />}
            <span>{linkCopied ? 'הקישור הועתק' : 'העתק קישור הזמנה'}</span>
          </button>
        )}

        {/* Footer — pushed to the bottom */}
        <div style={{ marginTop: 'auto', paddingTop: 40, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontFamily: SF, fontWeight: 500, fontSize: 13, color: SECONDARY }}>
            {dateLabel ? `עולים לאוויר · ${dateLabel}` : 'עולים לאוויר בקרוב'}
          </div>
          <button
            onClick={onSignOut}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: SF, fontWeight: 400, fontSize: 12, color: 'rgba(60,60,67,0.4)', padding: 4 }}
          >
            התנתקות
          </button>
        </div>
      </div>

      {showInvite && (
        <InviteFriendsScreen
          onBack={() => setShowInvite(false)}
          avatar={avatar}
          name={name}
          shareText={inviteMessage}
          link={link}
        />
      )}
    </div>
  );
}
