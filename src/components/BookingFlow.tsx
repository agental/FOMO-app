import { useState, useEffect, useRef, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, Check, ChevronLeft, Calendar, MapPin, Lock, ExternalLink } from 'lucide-react';
import type { Event } from '../lib/supabase';
import type { TicketType } from '../types/event';
import { flagEmoji } from '../utils/flags';
import { COUNTRIES } from '../utils/countries';
import { createTicketCheckout, getPaymentStatus, openHostedUrl } from '../services/paymentService';

/* ============================================================
   FOMO — Booking + Payment flow

   Real payments: ticket selection + contact, then the buyer is sent to the payment
   provider's hosted page (card / Apple Pay / Google Pay / Bit all live there). We poll
   the `payments` row — the webhook flips it to `paid` — and only then show success.
   The provider handles the card details, so nothing sensitive is entered in-app.
   Steps: tickets → contact → summary → (hosted pay).
   ============================================================ */

type BookingFlowProps = {
  event: Event;
  price: number;                 // entry (lowest) ticket price (₪) — used as a fallback
  ticketTypes?: TicketType[];    // creator-defined ticket types (רגיל / VIP / …); overrides the built-in tiers
  currentUserId?: string | null;
  onClose: () => void;
  onComplete: (info?: { ticketLabel: string; amount: number }) => Promise<void> | void; // called after a confirmed payment
};

const ORANGE = '#F97316';
const ORANGE_DARK = '#EA580C';
const GRADIENT = `linear-gradient(135deg, ${ORANGE}, ${ORANGE_DARK})`;
const FONT = 'Heebo, sans-serif';

type Step = 'tickets' | 'contact' | 'summary';
type Status = 'idle' | 'processing' | 'success' | 'failed';

const TIERS = [
  { id: 'economy', label: 'רגיל', mult: 1, perk: 'כניסה רגילה לאירוע' },
  { id: 'vip',     label: 'VIP',  mult: 2, perk: 'כניסה מהירה + אזור VIP' },
] as const;

const POLL_MS = 3000;
const POLL_MAX = 100; // ~5 minutes of polling before we give up waiting

const slide = (dir: number) => ({
  initial: { x: dir * 50, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit:    { x: dir * -50, opacity: 0 },
});

export function BookingFlow({ event, price, ticketTypes, onClose, onComplete }: BookingFlowProps) {
  // The selectable tickets: creator-defined types when present (absolute prices),
  // otherwise the built-in רגיל/VIP tiers derived from the single price.
  const tickets = (ticketTypes && ticketTypes.length > 0)
    ? ticketTypes.map(t => ({ id: t.id, label: t.name, price: t.price, perk: '' }))
    : TIERS.map(t => ({ id: t.id, label: t.label, price: Math.round(price * t.mult), perk: t.perk }));

  const [step, setStep] = useState<Step>('tickets');
  const [dir, setDir]   = useState(1);

  /* ── tickets ── */
  const [tier, setTier]   = useState<string>(tickets[0].id);
  const [seats, setSeats] = useState(1);

  /* ── contact ── */
  const [fullName, setFullName] = useState('');
  const [gender, setGender]     = useState('');
  const [birth, setBirth]       = useState('');
  const [email, setEmail]       = useState('');
  const [phone, setPhone]       = useState('');
  const [country, setCountry]   = useState('IL');
  const [agree, setAgree]       = useState(false);

  /* ── result ── */
  const [status, setStatus]   = useState<Status>('idle');
  const [errMsg, setErrMsg]   = useState('');
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const triesRef = useRef(0);

  const tierObj   = tickets.find(t => t.id === tier) ?? tickets[0];
  const unitPrice = tierObj.price;
  const subtotal  = unitPrice * seats;
  const fee       = Math.round(subtotal * 0.1);   // עמלת שירות 10% (השרת הוא מקור האמת)
  const total     = subtotal + fee;

  const go = (next: Step, d = 1) => { setDir(d); setStep(next); };

  const stopPolling = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  useEffect(() => stopPolling, []); // clean up on unmount

  /* Create the checkout, open the hosted page, then poll the order until it settles. */
  const pay = async () => {
    setErrMsg('');
    setStatus('processing');
    triesRef.current = 0;

    const res = await createTicketCheckout({ eventId: event.id, ticketLabel: tierObj.label, quantity: seats });
    if (res.error || !res.url || !res.paymentId) {
      setErrMsg(res.error || 'לא ניתן לפתוח תשלום כרגע.');
      setStatus('failed');
      return;
    }

    openHostedUrl(res.url);
    const paymentId = res.paymentId;
    stopPolling();
    pollRef.current = setInterval(async () => {
      triesRef.current += 1;
      const st = await getPaymentStatus(paymentId);
      if (st === 'paid' || st === 'released') { stopPolling(); setStatus('success'); }
      else if (st === 'failed' || st === 'refunded') { stopPolling(); setErrMsg('התשלום לא הושלם.'); setStatus('failed'); }
      else if (triesRef.current >= POLL_MAX) { stopPolling(); setErrMsg('לא קיבלנו אישור תשלום. אם חויבת, הכרטיס יעודכן בקרוב.'); setStatus('failed'); }
    }, POLL_MS);
  };

  /* on success → let the parent record/refresh the pending request, then close */
  useEffect(() => {
    if (status !== 'success') return;
    if ('vibrate' in navigator) navigator.vibrate(20);
    const t = setTimeout(async () => {
      try { await onComplete({ ticketLabel: tierObj.label, amount: total }); }
      catch { setStatus('failed'); setErrMsg('התשלום עבר אך רישום הכרטיס נכשל. פנה למארגן.'); }
    }, 1500);
    return () => clearTimeout(t);
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const cancelPay = () => { stopPolling(); setStatus('idle'); };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  const heroImg = event.image_url || '';

  const contactValid = fullName.trim() && email.trim() && phone.trim() && agree;

  return (
    <div
      className="fixed inset-0 z-[60] bg-[#F9F7F5] flex flex-col"
      dir="rtl"
      style={{ animation: 'bf-up 0.36s cubic-bezier(0.16,1,0.3,1)' }}
    >
      <style>{`
        @keyframes bf-up { from { transform: translateY(100%) } to { transform: translateY(0) } }
        @keyframes bf-pop { 0% { transform: scale(0.6); opacity: 0 } 60% { transform: scale(1.08) } 100% { transform: scale(1); opacity: 1 } }
      `}</style>

      <AnimatePresence mode="wait" custom={dir}>
        {/* ─────────────── STEP · TICKETS ─────────────── */}
        {step === 'tickets' && (
          <motion.div key="tickets" {...slide(dir)} transition={{ duration: 0.25 }} className="flex flex-col h-full">
            <Header title="הזמנת כרטיסים" onBack={onClose} />

            {/* ticket-type tabs */}
            <div className="flex px-5 gap-6 border-b border-gray-200 bg-white flex-shrink-0 overflow-x-auto">
              {tickets.map(t => {
                const active = tier === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTier(t.id)}
                    className="relative pb-3 pt-1 text-[15px] font-bold transition-colors whitespace-nowrap flex-shrink-0"
                    style={{ fontFamily: FONT, color: active ? ORANGE : '#9CA3AF' }}
                  >
                    {t.label}
                    {active && (
                      <motion.div layoutId="tierTab" className="absolute bottom-0 left-0 right-0 h-[3px] rounded-full" style={{ background: ORANGE }} />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto px-5 pt-7">
              {/* event mini summary */}
              <div className="flex items-center gap-3 bg-white rounded-[20px] p-3 mb-6 border border-black/[0.05]" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.05)' }}>
                <div className="w-14 h-14 rounded-[14px] overflow-hidden flex-shrink-0" style={{ background: GRADIENT }}>
                  {heroImg && <img src={heroImg} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="min-w-0">
                  <p className="text-[15px] font-bold text-gray-900 truncate" style={{ fontFamily: FONT }}>{event.title}</p>
                  <p className="text-[12px] text-gray-400 mt-0.5">{flagEmoji(event.country ?? 'IL')} {event.city}</p>
                </div>
              </div>

              <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-1">{tierObj.perk || `כרטיס ${tierObj.label}`}</p>
              <p className="text-[15px] font-bold text-gray-900 mb-7" style={{ fontFamily: FONT }}>בחר כמות כרטיסים</p>

              {/* seat stepper */}
              <div className="flex items-center justify-center gap-8 py-4">
                <button
                  onClick={() => setSeats(s => Math.max(1, s - 1))}
                  className="w-14 h-14 rounded-2xl flex items-center justify-center bg-white border border-gray-200 active:scale-90 transition-transform disabled:opacity-40"
                  disabled={seats <= 1}
                >
                  <Minus className="w-6 h-6" style={{ color: ORANGE }} strokeWidth={2.5} />
                </button>
                <span className="text-[44px] font-black text-gray-900 w-16 text-center tabular-nums" style={{ fontFamily: FONT }}>{seats}</span>
                <button
                  onClick={() => setSeats(s => Math.min(10, s + 1))}
                  className="w-14 h-14 rounded-2xl flex items-center justify-center active:scale-90 transition-transform"
                  style={{ background: GRADIENT, boxShadow: `0 6px 18px ${ORANGE}55` }}
                >
                  <Plus className="w-6 h-6 text-white" strokeWidth={2.5} />
                </button>
              </div>

              <p className="text-center text-[13px] text-gray-400 mt-3">₪{unitPrice} לכרטיס</p>
            </div>

            <BottomCTA label={`המשך · ₪${subtotal}`} onClick={() => go('contact')} />
          </motion.div>
        )}

        {/* ─────────────── STEP · CONTACT ─────────────── */}
        {step === 'contact' && (
          <motion.div key="contact" {...slide(dir)} transition={{ duration: 0.25 }} className="flex flex-col h-full">
            <Header title="פרטי קשר" onBack={() => go('tickets', -1)} />

            <div className="flex-1 overflow-y-auto px-5 pt-4 pb-2">
              <Field label="שם מלא *">
                <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="ישראל ישראלי"
                  className="w-full text-[16px] font-medium text-[#1C1C1E] placeholder-[#C7C7CC] bg-transparent outline-none" />
              </Field>

              <Field label="מגדר">
                <select value={gender} onChange={e => setGender(e.target.value)}
                  className="w-full text-[16px] text-[#1C1C1E] bg-transparent outline-none appearance-none"
                  style={{ color: gender ? '#1C1C1E' : '#C7C7CC' }}>
                  <option value="" disabled>בחר/י</option>
                  <option value="male">זכר</option>
                  <option value="female">נקבה</option>
                  <option value="other">אחר</option>
                </select>
              </Field>

              <Field label="תאריך לידה">
                <input type="date" value={birth} onChange={e => setBirth(e.target.value)}
                  className="w-full text-[16px] text-[#1C1C1E] bg-transparent outline-none" style={{ color: birth ? '#1C1C1E' : '#C7C7CC' }} />
              </Field>

              <Field label="אימייל *">
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" dir="ltr"
                  className="w-full text-[16px] font-medium text-[#1C1C1E] placeholder-[#C7C7CC] bg-transparent outline-none text-right" />
              </Field>

              <Field label="טלפון *">
                <div className="flex items-center gap-2">
                  <span className="text-[18px]">{flagEmoji(country)}</span>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="050-000-0000" dir="ltr"
                    className="flex-1 text-[16px] font-medium text-[#1C1C1E] placeholder-[#C7C7CC] bg-transparent outline-none text-right" />
                </div>
              </Field>

              <Field label="מדינה">
                <select value={country} onChange={e => setCountry(e.target.value)}
                  className="w-full text-[16px] text-[#1C1C1E] bg-transparent outline-none appearance-none">
                  {Object.entries(COUNTRIES).map(([code, c]) => (
                    <option key={code} value={code}>{c.flag} {c.name}</option>
                  ))}
                </select>
              </Field>

              {/* terms */}
              <button onClick={() => setAgree(a => !a)} className="flex items-start gap-3 px-1 mt-2 text-right w-full">
                <span className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors"
                  style={{ background: agree ? GRADIENT : '#fff', border: agree ? 'none' : '2px solid #D1D5DB' }}>
                  {agree && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                </span>
                <span className="text-[13px] text-gray-500 leading-relaxed">
                  אני מאשר/ת את <span className="font-semibold" style={{ color: ORANGE }}>תנאי השימוש</span>, <span className="font-semibold" style={{ color: ORANGE }}>הנחיות הקהילה</span> ו<span className="font-semibold" style={{ color: ORANGE }}>מדיניות הפרטיות</span> (חובה)
                </span>
              </button>
            </div>

            <BottomCTA label="המשך" onClick={() => go('summary')} disabled={!contactValid} />
          </motion.div>
        )}

        {/* ─────────────── STEP · SUMMARY ─────────────── */}
        {step === 'summary' && (
          <motion.div key="summary" {...slide(dir)} transition={{ duration: 0.25 }} className="flex flex-col h-full">
            <Header title="סיכום הזמנה" onBack={() => go('contact', -1)} />

            <div className="flex-1 overflow-y-auto px-5 pt-4 pb-2">
              {/* event card */}
              <div className="flex items-center gap-3 bg-white rounded-[20px] p-3 mb-4 border border-black/[0.05]" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.05)' }}>
                <div className="w-16 h-16 rounded-[14px] overflow-hidden flex-shrink-0" style={{ background: GRADIENT }}>
                  {heroImg && <img src={heroImg} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="min-w-0">
                  <p className="text-[15px] font-bold text-gray-900 truncate mb-1" style={{ fontFamily: FONT }}>{event.title}</p>
                  <p className="text-[12px] font-medium flex items-center gap-1" style={{ color: ORANGE }}>
                    <Calendar className="w-3.5 h-3.5" /> {fmtDate(event.event_date ?? '')} · {fmtTime(event.event_date ?? '')}
                  </p>
                  <p className="text-[12px] text-gray-400 mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {event.city}
                  </p>
                </div>
              </div>

              {/* contact */}
              <Card>
                <Row label="שם מלא" value={fullName || '—'} />
                <Divider />
                <Row label="טלפון" value={phone || '—'} ltr />
                <Divider />
                <Row label="אימייל" value={email || '—'} ltr />
              </Card>

              {/* price breakdown */}
              <Card>
                <Row label={`כרטיס ${tierObj.label} × ${seats}`} value={`₪${subtotal}`} />
                <Divider />
                <Row label="עמלת שירות" value={`₪${fee}`} />
                <Divider />
                <div className="flex items-center justify-between px-4 py-3.5">
                  <span className="text-[15px] font-black text-gray-900" style={{ fontFamily: FONT }}>סה״כ לתשלום</span>
                  <span className="text-[20px] font-black" style={{ color: ORANGE, fontFamily: FONT }}>₪{total}</span>
                </div>
              </Card>

              {/* secure-payment note */}
              <div className="flex items-center gap-2.5 bg-white rounded-[20px] px-4 py-3.5 border border-black/[0.05]" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.05)' }}>
                <div className="w-9 h-9 rounded-[8px] flex items-center justify-center flex-shrink-0" style={{ background: '#F0FDF4' }}>
                  <Lock className="w-4.5 h-4.5" style={{ color: '#16A34A' }} />
                </div>
                <p className="text-[12.5px] text-gray-500 leading-snug">התשלום מתבצע בעמוד מאובטח של ספק הסליקה. פרטי האשראי לא נשמרים באפליקציה.</p>
              </div>
            </div>

            <BottomCTA label={`שלם ₪${total}`} onClick={pay} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─────────────── PROCESSING / SUCCESS / FAILED ─────────────── */}
      {status !== 'idle' && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-8" style={{ background: 'rgba(17,24,39,0.55)', backdropFilter: 'blur(4px)' }}>
          {status === 'processing' && (
            <div className="bg-white rounded-[28px] w-full max-w-[340px] px-6 py-8 text-center" style={{ animation: 'bf-pop 0.4s cubic-bezier(0.16,1,0.3,1)' }}>
              <div className="w-14 h-14 rounded-full border-[3px] border-orange-200 border-t-orange-500 animate-spin mx-auto" />
              <p className="text-gray-900 text-[17px] font-black mt-6 mb-1.5" style={{ fontFamily: FONT }}>ממתין לאישור התשלום…</p>
              <p className="text-[13.5px] text-gray-500 leading-relaxed mb-6">השלם את התשלום בעמוד שנפתח.<br />החלון הזה יתעדכן אוטומטית ברגע שנקבל אישור.</p>
              <button onClick={cancelPay} className="w-full text-[15px] font-bold text-gray-400 py-2 flex items-center justify-center gap-1.5" style={{ fontFamily: FONT }}>
                <ExternalLink className="w-4 h-4" /> ביטול
              </button>
            </div>
          )}

          {status === 'success' && (
            <div className="bg-white rounded-[28px] w-full max-w-[340px] px-6 py-9 text-center" style={{ animation: 'bf-pop 0.4s cubic-bezier(0.16,1,0.3,1)' }}>
              <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-5" style={{ background: GRADIENT, boxShadow: `0 10px 30px ${ORANGE}66` }}>
                <Check className="w-10 h-10 text-white" strokeWidth={3} />
              </div>
              <p className="text-[22px] font-black text-gray-900 mb-2" style={{ fontFamily: FONT }}>התשלום בוצע! 🎉</p>
              <p className="text-[14px] text-gray-500 leading-relaxed">הכרטיס נרכש. ממתין לאישור המארגן.</p>
            </div>
          )}

          {status === 'failed' && (
            <div className="bg-white rounded-[28px] w-full max-w-[340px] px-6 py-8 text-center" style={{ animation: 'bf-pop 0.4s cubic-bezier(0.16,1,0.3,1)' }}>
              <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-5" style={{ background: 'linear-gradient(135deg,#F87171,#EF4444)', boxShadow: '0 10px 30px rgba(239,68,68,0.4)' }}>
                <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </div>
              <p className="text-[22px] font-black mb-2" style={{ color: '#EF4444', fontFamily: FONT }}>התשלום לא הושלם</p>
              <p className="text-[14px] text-gray-500 leading-relaxed mb-6">{errMsg || 'משהו השתבש. נסה שוב.'}</p>
              <button onClick={pay} className="w-full font-black text-[16px] text-white active:scale-[0.97] transition-transform mb-3"
                style={{ fontFamily: FONT, height: 52, borderRadius: 26, background: GRADIENT, boxShadow: `0 8px 24px ${ORANGE}55` }}>
                נסה שוב
              </button>
              <button onClick={cancelPay} className="w-full text-[15px] font-bold text-gray-400 py-2" style={{ fontFamily: FONT }}>סגור</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Sub-components
   ============================================================ */

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div
      className="flex items-center justify-between px-3 bg-white flex-shrink-0"
      style={{ paddingTop: 'max(14px, env(safe-area-inset-top))', paddingBottom: 12 }}
    >
      <button
        onClick={onBack}
        aria-label="חזור"
        className="w-10 h-10 flex items-center justify-center rounded-full active:bg-gray-100 transition-colors"
        style={{ touchAction: 'manipulation' }}
      >
        <ChevronLeft className="w-6 h-6 -scale-x-100" style={{ color: '#111827' }} strokeWidth={2.2} />
      </button>
      <span className="text-[16px] font-black text-gray-900" style={{ fontFamily: FONT }}>{title}</span>
      <div className="w-10 h-10" />
    </div>
  );
}

function BottomCTA({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <div
      className="flex-shrink-0 bg-white px-5"
      style={{ paddingTop: 14, paddingBottom: 'max(20px, env(safe-area-inset-bottom))', boxShadow: '0 -2px 16px rgba(0,0,0,0.06)' }}
    >
      <button
        onClick={onClick}
        disabled={disabled}
        className="w-full font-black text-[17px] text-white active:scale-[0.97] transition-transform disabled:opacity-50"
        style={{ fontFamily: FONT, height: 56, borderRadius: 28, background: disabled ? '#D1D5DB' : GRADIENT, boxShadow: disabled ? 'none' : `0 8px 24px ${ORANGE}55` }}
      >
        {label}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bg-white rounded-[18px] mb-3 border border-black/[0.05]" style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
      <div className="px-4 pt-3 pb-3">
        <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-1.5">{label}</p>
        {children}
      </div>
    </div>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white rounded-[20px] mb-4 border border-black/[0.05] overflow-hidden" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.05)' }}>
      {children}
    </div>
  );
}

function Row({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-[13px] text-gray-400">{label}</span>
      <span className="text-[14px] font-semibold text-gray-900" style={{ fontFamily: FONT, direction: ltr ? 'ltr' : 'rtl' }}>{value}</span>
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-gray-100 mx-4" />;
}
