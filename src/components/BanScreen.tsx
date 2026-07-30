import { Ban } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { isPermanent } from '../services/banService';

/*
  Shown INSTEAD of the app when the signed-in user is banned. Blocks access to everything, states
  whether the ban is temporary (with the release date) or permanent, shows the admin's reason, and
  offers a sign-out.
*/

export function BanScreen({ until, reason }: { until: string | null; reason: string | null }) {
  const permanent = isPermanent(until);
  const releaseText = permanent
    ? 'החסימה היא לצמיתות.'
    : until
      ? `החסימה בתוקף עד ${new Date(until).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })}.`
      : '';

  return (
    <div dir="rtl" style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'linear-gradient(160deg, #1A0F0F 0%, #2A1212 55%, #0A0606 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '32px 26px', textAlign: 'center', fontFamily: "'Heebo','Rubik',sans-serif",
    }}>
      <div style={{
        width: 88, height: 88, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(239,68,68,0.14)', border: '1px solid rgba(239,68,68,0.35)', marginBottom: 22,
      }}>
        <Ban size={44} style={{ color: '#F87171' }} strokeWidth={1.8} />
      </div>

      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: '#fff' }}>הגישה שלך נחסמה</h1>
      <p style={{ margin: '12px 0 0', fontSize: 15, lineHeight: 1.6, color: 'rgba(255,255,255,0.72)', maxWidth: 360 }}>
        חשבונך נחסם על ידי צוות FOMO עקב הפרת כללי הקהילה. {releaseText}
      </p>

      {reason && (
        <div style={{
          marginTop: 20, maxWidth: 360, width: '100%',
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16,
          padding: '13px 15px', textAlign: 'right',
        }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>סיבה</p>
          <p style={{ margin: '5px 0 0', fontSize: 14.5, color: 'rgba(255,255,255,0.9)', lineHeight: 1.5, wordBreak: 'break-word' }}>{reason}</p>
        </div>
      )}

      <button
        onClick={() => supabase.auth.signOut()}
        style={{
          marginTop: 30, height: 50, padding: '0 40px', borderRadius: 25, border: 'none', cursor: 'pointer',
          background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 15.5, fontWeight: 700, fontFamily: 'inherit',
        }}
      >
        התנתקות
      </button>
    </div>
  );
}
