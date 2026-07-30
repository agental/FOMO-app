import { useState, useEffect, useCallback } from 'react';
import { Landmark, ShieldCheck, Clock, AlertTriangle, Check, RefreshCw, ExternalLink, X } from 'lucide-react';
import {
  getMySellerAccount, startSellerOnboarding, isSellerReady, openHostedUrl,
  type SellerAccount,
} from '../services/paymentService';

/* ============================================================================
   FOMO — Seller onboarding (bank connect)

   Shown to an organizer who turned on paid tickets. They must connect a payout
   account before a paid event can be published: the money from ticket sales lands
   there after the event. We never collect the IBAN ourselves — the "connect"
   button opens the provider's hosted KYC page (bank + ID), and we track only the
   resulting status.
   ============================================================================ */

const ORANGE = '#F97316';
const ORANGE_DARK = '#EA580C';
const GRADIENT = `linear-gradient(135deg, ${ORANGE}, ${ORANGE_DARK})`;
const FONT = 'Heebo, sans-serif';

type Props = {
  userId: string;
  onClose: () => void;
  /** Fired when the account reaches an active/payouts-enabled state. */
  onReady?: (account: SellerAccount) => void;
};

export function SellerOnboardingSheet({ userId, onClose, onReady }: Props) {
  const [account, setAccount] = useState<SellerAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const a = await getMySellerAccount(userId);
    setAccount(a);
    setLoading(false);
    if (isSellerReady(a) && a) onReady?.(a);
  }, [userId, onReady]);

  useEffect(() => { load(); }, [load]);

  // While the KYC page is open in another tab, poll so the status flips here when they return.
  useEffect(() => {
    if (loading || isSellerReady(account)) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [loading, account, load]);

  const connect = async () => {
    setConnecting(true);
    setError('');
    const res = await startSellerOnboarding();
    setConnecting(false);
    if (res.url) { openHostedUrl(res.url); return; }
    setError(res.error || 'שגיאה. נסה שוב.');
  };

  const ready = isSellerReady(account);
  const pending = !!account && !ready && account.status !== 'restricted' && account.status !== 'disabled';
  const blocked = !!account && (account.status === 'restricted' || account.status === 'disabled');
  const bankLast4 = account?.details?.bank_last4 as string | undefined;

  return (
    <>
      <div className="fixed inset-0 z-[75]" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }} onClick={onClose} />
      <div
        className="fixed bottom-0 left-0 right-0 z-[76] bg-white" dir="rtl"
        style={{ borderRadius: '26px 26px 0 0', animation: 'so-up 0.32s cubic-bezier(0.16,1,0.3,1)', paddingBottom: 'max(24px, env(safe-area-inset-bottom))', maxHeight: '92vh', overflowY: 'auto' }}
      >
        <style>{`@keyframes so-up { from { transform: translateY(100%) } to { transform: translateY(0) } }`}</style>

        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
        <button onClick={onClose} aria-label="סגור" className="absolute top-3 left-3 w-9 h-9 rounded-full flex items-center justify-center active:bg-gray-100">
          <X className="w-5 h-5 text-gray-400" />
        </button>

        {/* header icon */}
        <div className="flex flex-col items-center px-6 pt-3">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: ready ? 'linear-gradient(135deg,#22c55e,#16a34a)' : GRADIENT, boxShadow: `0 10px 26px ${ready ? 'rgba(34,197,94,0.4)' : `${ORANGE}55`}` }}>
            {ready ? <Check className="w-8 h-8 text-white" strokeWidth={3} /> : <Landmark className="w-8 h-8 text-white" strokeWidth={2} />}
          </div>

          {loading ? (
            <p className="text-[15px] text-gray-400 py-6" style={{ fontFamily: FONT }}>בודק את חשבון התשלומים…</p>
          ) : ready ? (
            <>
              <p className="text-[20px] font-black text-gray-900 mb-1.5 text-center" style={{ fontFamily: FONT }}>חשבון התשלומים מחובר ✓</p>
              <p className="text-[14px] text-gray-500 text-center leading-relaxed mb-1">
                הכסף מרכישת הכרטיסים יועבר לחשבון שלך אחרי האירוע.
              </p>
              {bankLast4 && (
                <p className="text-[13px] text-gray-400 text-center" dir="ltr">•••• {bankLast4}</p>
              )}
            </>
          ) : (
            <>
              <p className="text-[20px] font-black text-gray-900 mb-1.5 text-center" style={{ fontFamily: FONT }}>
                {pending ? 'האימות בתהליך' : 'חבר חשבון לקבלת תשלומים'}
              </p>
              <p className="text-[14px] text-gray-500 text-center leading-relaxed">
                {pending
                  ? 'החשבון נשלח לאימות. זה עשוי לקחת כמה דקות. אפשר להשלים פרטים חסרים בכל רגע.'
                  : 'כדי לפרסם אירוע בתשלום, חבר את החשבון שאליו יגיע הכסף. האימות מתבצע בעמוד מאובטח של ספק הסליקה — פרטי הבנק לא נשמרים אצלנו.'}
              </p>
            </>
          )}
        </div>

        {/* trust bullets — only before/while connecting */}
        {!loading && !ready && (
          <div className="px-6 pt-6 space-y-3">
            <Bullet icon={<ShieldCheck className="w-4 h-4" style={{ color: ORANGE }} />} text="האימות והבנק מנוהלים בעמוד מאובטח של ספק הסליקה (KYC)." />
            <Bullet icon={<Clock className="w-4 h-4" style={{ color: ORANGE }} />} text="הכסף משתחרר אליך אחרי שהאירוע מתקיים — הגנה על הקונים." />
            <Bullet icon={<Landmark className="w-4 h-4" style={{ color: ORANGE }} />} text="עמלת פלטפורמה קטנה נגבית מכל כרטיס; השאר מגיע אליך." />
          </div>
        )}

        {blocked && (
          <div className="px-6 pt-5">
            <div className="flex items-start gap-2.5 rounded-2xl p-3.5" style={{ background: '#FEF2F2' }}>
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#EF4444' }} />
              <p className="text-[13px] text-[#B91C1C] leading-relaxed" style={{ fontFamily: FONT }}>
                האימות לא הושלם. פתח שוב את עמוד הספק והשלם את הפרטים החסרים כדי להפעיל תשלומים.
              </p>
            </div>
          </div>
        )}

        {error && <p className="px-6 pt-4 text-[13px] text-[#EF4444] text-center" style={{ fontFamily: FONT }}>{error}</p>}

        {/* actions */}
        <div className="px-6 pt-6">
          {ready ? (
            <button onClick={onClose}
              className="w-full font-black text-[17px] text-white active:scale-[0.97] transition-transform"
              style={{ fontFamily: FONT, height: 54, borderRadius: 27, background: GRADIENT, boxShadow: `0 8px 24px ${ORANGE}55` }}>
              המשך
            </button>
          ) : (
            <>
              <button onClick={connect} disabled={connecting}
                className="w-full flex items-center justify-center gap-2 font-black text-[17px] text-white active:scale-[0.97] transition-transform disabled:opacity-60"
                style={{ fontFamily: FONT, height: 54, borderRadius: 27, background: GRADIENT, boxShadow: `0 8px 24px ${ORANGE}55` }}>
                {connecting ? 'פותח…' : (<>{pending ? 'המשך אימות' : 'חבר חשבון תשלומים'} <ExternalLink className="w-4 h-4" /></>)}
              </button>
              {pending && (
                <button onClick={load}
                  className="w-full flex items-center justify-center gap-2 mt-3 text-[14px] font-bold text-gray-500 py-2.5" style={{ fontFamily: FONT }}>
                  <RefreshCw className="w-4 h-4" /> בדוק סטטוס
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Bullet({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${ORANGE}14` }}>{icon}</div>
      <p className="text-[13.5px] text-gray-600 leading-relaxed" style={{ fontFamily: FONT }}>{text}</p>
    </div>
  );
}
