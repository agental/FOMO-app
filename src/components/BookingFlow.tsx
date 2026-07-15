import { useState, useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, Check, ChevronLeft, Calendar, MapPin, Delete, Lock } from 'lucide-react';
import type { Event } from '../lib/supabase';
import { flagEmoji } from '../utils/flags';
import { COUNTRIES } from '../utils/countries';

/* ============================================================
   FOMO — Booking + Payment flow
   Full-screen, multi-step ticket purchase that matches the
   FOMO design language (orange #F97316, Heebo/Rubik, RTL).
   Steps: tickets → contact → payment → summary → PIN → done.
   ============================================================ */

type BookingFlowProps = {
  event: Event;
  price: number;                 // base ticket price (₪)
  currentUserId?: string | null;
  onClose: () => void;
  onComplete: () => Promise<void> | void; // called after a successful payment
};

const ORANGE = '#F97316';
const ORANGE_DARK = '#EA580C';
const GRADIENT = `linear-gradient(135deg, ${ORANGE}, ${ORANGE_DARK})`;
const FONT = 'Heebo, sans-serif';

type Step = 'tickets' | 'contact' | 'payment' | 'summary' | 'pin';
type Status = 'idle' | 'processing' | 'success' | 'failed';

const TIERS = [
  { id: 'economy', label: 'רגיל', mult: 1, perk: 'כניסה רגילה לאירוע' },
  { id: 'vip',     label: 'VIP',  mult: 2, perk: 'כניסה מהירה + אזור VIP' },
] as const;

type SavedCard = { id: string; brand: 'mastercard' | 'visa'; last4: string; name: string };

const slide = (dir: number) => ({
  initial: { x: dir * 50, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit:    { x: dir * -50, opacity: 0 },
});

export function BookingFlow({ event, price, onClose, onComplete }: BookingFlowProps) {
  const [step, setStep] = useState<Step>('tickets');
  const [dir, setDir]   = useState(1);

  /* ── tickets ── */
  const [tier, setTier]   = useState<typeof TIERS[number]['id']>('economy');
  const [seats, setSeats] = useState(1);

  /* ── contact ── */
  const [fullName, setFullName] = useState('');
  const [gender, setGender]     = useState('');
  const [birth, setBirth]       = useState('');
  const [email, setEmail]       = useState('');
  const [phone, setPhone]       = useState('');
  const [country, setCountry]   = useState('IL');
  const [agree, setAgree]       = useState(false);

  /* ── payment ── */
  const [methods, setMethods] = useState<SavedCard[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string>('apay');
  const [showAddCard, setShowAddCard] = useState(false);

  /* ── pin / result ── */
  const [pin, setPin]       = useState('');
  const [status, setStatus] = useState<Status>('idle');

  const tierObj   = TIERS.find(t => t.id === tier)!;
  const unitPrice = Math.round(price * tierObj.mult);
  const subtotal  = unitPrice * seats;
  const fee       = Math.round(subtotal * 0.1);   // עמלת שירות 10%
  const total     = subtotal + fee;

  const go = (next: Step, d = 1) => { setDir(d); setStep(next); };

  /* process the (mock) payment once the 4-digit PIN is filled */
  useEffect(() => {
    if (pin.length < 4 || status !== 'idle') return;
    setStatus('processing');
    const t = setTimeout(() => {
      // mock gateway — succeeds when online, otherwise show the failure state
      if (navigator.onLine) setStatus('success');
      else setStatus('failed');
    }, 1400);
    return () => clearTimeout(t);
  }, [pin, status]);

  /* on success → register attendance, then close */
  useEffect(() => {
    if (status !== 'success') return;
    if ('vibrate' in navigator) navigator.vibrate(20);
    const t = setTimeout(async () => {
      try {
        await onComplete();
      } catch {
        // DB write failed after payment "succeeded" — show failure so user can retry
        setStatus('failed');
      }
    }, 1700);
    return () => clearTimeout(t);
  }, [status]);

  const retryPayment = () => { setStatus('idle'); setPin(''); };
  const cancelPin    = () => { setStatus('idle'); setPin(''); go('summary', -1); };

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
        @keyframes bf-sheet { from { transform: translateY(100%) } to { transform: translateY(0) } }
      `}</style>

      <AnimatePresence mode="wait" custom={dir}>
        {/* ─────────────── STEP · TICKETS ─────────────── */}
        {step === 'tickets' && (
          <motion.div key="tickets" {...slide(dir)} transition={{ duration: 0.25 }} className="flex flex-col h-full">
            <Header title="הזמנת כרטיסים" onBack={onClose} />

            {/* tier tabs */}
            <div className="flex px-5 gap-6 border-b border-gray-200 bg-white flex-shrink-0">
              {TIERS.map(t => {
                const active = tier === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTier(t.id)}
                    className="relative pb-3 pt-1 text-[15px] font-bold transition-colors"
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

              <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-1">{tierObj.perk}</p>
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

            <BottomCTA label="המשך" onClick={() => go('payment')} disabled={!contactValid} />
          </motion.div>
        )}

        {/* ─────────────── STEP · PAYMENT ─────────────── */}
        {step === 'payment' && (
          <motion.div key="payment" {...slide(dir)} transition={{ duration: 0.25 }} className="flex flex-col h-full">
            <Header title="תשלום" onBack={() => go('contact', -1)} />

            <div className="flex-1 overflow-y-auto px-5 pt-4">
              <p className="text-[14px] text-gray-500 mb-5">בחר את אמצעי התשלום הרצוי.</p>

              <div className="flex flex-col gap-3">
                <PayOption id="paypal"     label="PayPal"     selected={selectedMethod === 'paypal'}     onSelect={() => setSelectedMethod('paypal')}     icon={<PayPalIcon />} />
                <PayOption id="gpay"        label="Google Pay" selected={selectedMethod === 'gpay'}        onSelect={() => setSelectedMethod('gpay')}        icon={<GPayIcon />} />
                <PayOption id="apay"        label="Apple Pay"  selected={selectedMethod === 'apay'}        onSelect={() => setSelectedMethod('apay')}        icon={<ApplePayIcon />} />
                {methods.map(m => (
                  <PayOption key={m.id} id={m.id} label={`•••• •••• •••• ${m.last4}`} selected={selectedMethod === m.id} onSelect={() => setSelectedMethod(m.id)} icon={m.brand === 'visa' ? <VisaIcon /> : <MastercardIcon />} />
                ))}
              </div>

              {/* add new card */}
              <button
                onClick={() => setShowAddCard(true)}
                className="w-full mt-4 py-4 rounded-[16px] text-[15px] font-bold active:scale-[0.98] transition-transform"
                style={{ fontFamily: FONT, color: ORANGE, background: '#FFF7ED', border: `1.5px dashed ${ORANGE}80` }}
              >
                + הוסף כרטיס חדש
              </button>
            </div>

            <BottomCTA label="המשך" onClick={() => go('summary')} />
          </motion.div>
        )}

        {/* ─────────────── STEP · SUMMARY ─────────────── */}
        {step === 'summary' && (
          <motion.div key="summary" {...slide(dir)} transition={{ duration: 0.25 }} className="flex flex-col h-full">
            <Header title="סיכום הזמנה" onBack={() => go('payment', -1)} />

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

              {/* payment method */}
              <div className="flex items-center justify-between bg-white rounded-[20px] px-4 py-3.5 border border-black/[0.05]" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.05)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[8px] flex items-center justify-center bg-gray-50 border border-gray-100">
                    {selectedMethod === 'paypal' ? <PayPalIcon /> : selectedMethod === 'gpay' ? <GPayIcon /> : selectedMethod === 'apay' ? <ApplePayIcon /> : <MastercardIcon />}
                  </div>
                  <span className="text-[14px] font-bold text-gray-900" style={{ fontFamily: FONT }}>
                    {selectedMethod === 'paypal' ? 'PayPal' : selectedMethod === 'gpay' ? 'Google Pay' : selectedMethod === 'apay' ? 'Apple Pay' : `•••• ${methods.find(m => m.id === selectedMethod)?.last4 ?? ''}`}
                  </span>
                </div>
                <button onClick={() => go('payment', -1)} className="text-[13px] font-bold" style={{ color: ORANGE, fontFamily: FONT }}>שנה</button>
              </div>
            </div>

            <BottomCTA label={`שלם ₪${total}`} onClick={() => go('pin')} />
          </motion.div>
        )}

        {/* ─────────────── STEP · PIN ─────────────── */}
        {step === 'pin' && (
          <motion.div key="pin" {...slide(dir)} transition={{ duration: 0.25 }} className="flex flex-col h-full">
            <Header title="אישור תשלום" onBack={cancelPin} />

            <div className="flex-1 flex flex-col items-center px-6 pt-10">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-5" style={{ background: '#FFF7ED' }}>
                <Lock className="w-7 h-7" style={{ color: ORANGE }} strokeWidth={2.2} />
              </div>
              <p className="text-[19px] font-black text-gray-900 mb-1" style={{ fontFamily: FONT }}>הזן את הקוד הסודי</p>
              <p className="text-[14px] text-gray-400 mb-9 text-center">הזן את קוד האישור בן 4 הספרות<br />כדי להשלים את התשלום</p>

              {/* dots */}
              <div className="flex gap-4 mb-2">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="w-4 h-4 rounded-full transition-all"
                    style={{ background: i < pin.length ? ORANGE : 'transparent', border: i < pin.length ? 'none' : '2px solid #D1D5DB' }} />
                ))}
              </div>
            </div>

            {/* numpad */}
            <div className="px-8 pb-2 grid grid-cols-3 gap-y-3 gap-x-6" style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(n => (
                <NumKey key={n} onClick={() => setPin(p => (p.length < 4 ? p + n : p))}>{n}</NumKey>
              ))}
              <div />
              <NumKey onClick={() => setPin(p => (p.length < 4 ? p + '0' : p))}>0</NumKey>
              <NumKey onClick={() => setPin(p => p.slice(0, -1))}><Delete className="w-6 h-6 text-gray-700" /></NumKey>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─────────────── ADD-CARD sheet ─────────────── */}
      {showAddCard && (
        <AddCardSheet
          onClose={() => setShowAddCard(false)}
          onSave={(card) => {
            setMethods(m => [...m, card]);
            setSelectedMethod(card.id);
            setShowAddCard(false);
          }}
        />
      )}

      {/* ─────────────── PROCESSING / SUCCESS / FAILED ─────────────── */}
      {status !== 'idle' && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-8" style={{ background: 'rgba(17,24,39,0.55)', backdropFilter: 'blur(4px)' }}>
          {status === 'processing' && (
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 rounded-full border-[3px] border-white/30 border-t-white animate-spin" />
              <p className="text-white text-[15px] font-bold mt-5" style={{ fontFamily: FONT }}>מעבד תשלום…</p>
            </div>
          )}

          {status === 'success' && (
            <div className="bg-white rounded-[28px] w-full max-w-[340px] px-6 py-9 text-center" style={{ animation: 'bf-pop 0.4s cubic-bezier(0.16,1,0.3,1)' }}>
              <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-5" style={{ background: GRADIENT, boxShadow: `0 10px 30px ${ORANGE}66` }}>
                <Check className="w-10 h-10 text-white" strokeWidth={3} />
              </div>
              <p className="text-[22px] font-black text-gray-900 mb-2" style={{ fontFamily: FONT }}>התשלום בוצע! 🎉</p>
              <p className="text-[14px] text-gray-500 leading-relaxed">הכרטיס שלך מאושר.<br />נתראה ב{event.title}!</p>
            </div>
          )}

          {status === 'failed' && (
            <div className="bg-white rounded-[28px] w-full max-w-[340px] px-6 py-8 text-center" style={{ animation: 'bf-pop 0.4s cubic-bezier(0.16,1,0.3,1)' }}>
              <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-5" style={{ background: 'linear-gradient(135deg,#F87171,#EF4444)', boxShadow: '0 10px 30px rgba(239,68,68,0.4)' }}>
                <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </div>
              <p className="text-[22px] font-black mb-2" style={{ color: '#EF4444', fontFamily: FONT }}>אופס, נכשל!</p>
              <p className="text-[14px] text-gray-500 leading-relaxed mb-6">התשלום נכשל. בדוק/י את חיבור<br />האינטרנט ונסה/י שוב.</p>
              <button onClick={retryPayment} className="w-full font-black text-[16px] text-white active:scale-[0.97] transition-transform mb-3"
                style={{ fontFamily: FONT, height: 52, borderRadius: 26, background: GRADIENT, boxShadow: `0 8px 24px ${ORANGE}55` }}>
                נסה שוב
              </button>
              <button onClick={cancelPin} className="w-full text-[15px] font-bold text-gray-400 py-2" style={{ fontFamily: FONT }}>ביטול</button>
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

function NumKey({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={() => { if ('vibrate' in navigator) navigator.vibrate(8); onClick(); }}
      className="h-16 rounded-2xl flex items-center justify-center text-[26px] font-bold text-gray-900 active:bg-orange-50 transition-colors"
      style={{ fontFamily: FONT }}
    >
      {children}
    </button>
  );
}

function PayOption({ label, selected, onSelect, icon }:
  { id: string; label: string; selected: boolean; onSelect: () => void; icon: ReactNode }) {
  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center gap-4 active:scale-[0.98] transition-all"
      style={{ background: '#fff', border: `1.5px solid ${selected ? ORANGE : '#E5E7EB'}`, borderRadius: 16, padding: '14px 16px', boxShadow: selected ? `0 4px 14px ${ORANGE}22` : 'none' }}
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-[10px] flex items-center justify-center bg-gray-50 border border-gray-100">{icon}</div>
      <span className="text-[15px] font-bold text-gray-900 flex-1 text-right" style={{ fontFamily: FONT, direction: label.startsWith('•') ? 'ltr' : 'rtl', textAlign: 'right' }}>{label}</span>
      <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ border: selected ? 'none' : '2px solid #D1D5DB', background: selected ? ORANGE : 'transparent' }}>
        {selected && <Check className="w-3 h-3 text-white" strokeWidth={3.5} />}
      </span>
    </button>
  );
}

/* ── Add new card (bottom sheet) ── */
function AddCardSheet({ onClose, onSave }: { onClose: () => void; onSave: (c: SavedCard) => void }) {
  const [name, setName]     = useState('');
  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv]       = useState('');

  const fmtNumber = (v: string) => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
  const fmtExpiry = (v: string) => { const d = v.replace(/\D/g, '').slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; };
  const last4  = number.replace(/\D/g, '').slice(-4);
  const valid  = name.trim() && number.replace(/\D/g, '').length >= 15 && expiry.length === 5 && cvv.length >= 3;

  return (
    <>
      <div className="fixed inset-0 z-[65]" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }} onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-[66] bg-[#F8FAFB]" dir="rtl"
        style={{ borderRadius: '26px 26px 0 0', animation: 'bf-sheet 0.32s cubic-bezier(0.16,1,0.3,1)', paddingBottom: 'max(24px, env(safe-area-inset-bottom))', maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
        <p className="text-[18px] font-black text-gray-900 text-center pt-2 pb-5" style={{ fontFamily: FONT }}>הוספת כרטיס</p>

        {/* card visual */}
        <div className="px-5">
          <div className="rounded-[20px] p-5 mb-5 relative overflow-hidden" style={{ background: GRADIENT, boxShadow: `0 12px 30px ${ORANGE}55`, aspectRatio: '1.6 / 1' }}>
            <div className="absolute -top-8 -left-8 w-40 h-40 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />
            <div className="absolute top-10 -left-2 w-28 h-28 rounded-full" style={{ background: 'rgba(255,255,255,0.10)' }} />
            <div className="relative flex flex-col h-full justify-between text-white">
              <div className="flex items-center justify-between">
                <div className="w-11 h-8 rounded-md" style={{ background: 'rgba(255,255,255,0.35)' }} />
                <span className="text-[15px] font-black tracking-wide" style={{ fontFamily: FONT }}>FOMO</span>
              </div>
              <p className="text-[19px] font-semibold tracking-[0.12em]" dir="ltr" style={{ fontFamily: FONT }}>
                {fmtNumber(number) || '•••• •••• •••• ••••'}
              </p>
              <div className="flex items-center justify-between" dir="ltr">
                <div>
                  <p className="text-[9px] opacity-70 uppercase tracking-wider">Card Holder</p>
                  <p className="text-[13px] font-semibold truncate max-w-[170px]">{name || 'YOUR NAME'}</p>
                </div>
                <div>
                  <p className="text-[9px] opacity-70 uppercase tracking-wider">Expires</p>
                  <p className="text-[13px] font-semibold">{expiry || 'MM/YY'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* inputs */}
        <div className="px-5">
          <Field label="שם בעל הכרטיס">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="ישראל ישראלי"
              className="w-full text-[16px] font-medium text-[#1C1C1E] placeholder-[#C7C7CC] bg-transparent outline-none" />
          </Field>
          <Field label="מספר כרטיס">
            <input value={fmtNumber(number)} onChange={e => setNumber(e.target.value)} placeholder="0000 0000 0000 0000" inputMode="numeric" dir="ltr"
              className="w-full text-[16px] font-medium text-[#1C1C1E] placeholder-[#C7C7CC] bg-transparent outline-none text-right" />
          </Field>
          <div className="flex gap-3">
            <div className="flex-1"><Field label="תוקף">
              <input value={expiry} onChange={e => setExpiry(fmtExpiry(e.target.value))} placeholder="MM/YY" inputMode="numeric" dir="ltr"
                className="w-full text-[16px] font-medium text-[#1C1C1E] placeholder-[#C7C7CC] bg-transparent outline-none text-right" />
            </Field></div>
            <div className="flex-1"><Field label="CVV">
              <input value={cvv} onChange={e => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="123" inputMode="numeric" dir="ltr"
                className="w-full text-[16px] font-medium text-[#1C1C1E] placeholder-[#C7C7CC] bg-transparent outline-none text-right" />
            </Field></div>
          </div>
        </div>

        <div className="px-5 pt-2">
          <button onClick={() => onSave({ id: `card-${Date.now()}`, brand: number.replace(/\s/g, '').startsWith('4') ? 'visa' : 'mastercard', last4, name })} disabled={!valid}
            className="w-full font-black text-[17px] text-white active:scale-[0.97] transition-transform disabled:opacity-50"
            style={{ fontFamily: FONT, height: 54, borderRadius: 27, background: valid ? GRADIENT : '#D1D5DB', boxShadow: valid ? `0 8px 24px ${ORANGE}55` : 'none' }}>
            הוסף כרטיס
          </button>
        </div>
      </div>
    </>
  );
}

/* ── payment-brand icons ── */
function MastercardIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24"><circle cx="9" cy="12" r="6" fill="#EB001B" /><circle cx="15" cy="12" r="6" fill="#F79E1B" fillOpacity="0.9" /></svg>
  );
}
function VisaIcon() {
  return (
    <svg width="34" height="22" viewBox="0 0 38 12" fill="none"><text x="0" y="11" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="12" fill="#1A1F71" letterSpacing="0.5">VISA</text></svg>
  );
}
function PayPalIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#003087"><path d="M7.144 19.532l1.049-5.751c.11-.605.686-1.075 1.31-1.075h5.358c3.746 0 6.03-2.088 6.55-5.66.026-.169.039-.333.039-.494C21.45 4.22 19.454 3 16.544 3H8.502c-.63 0-1.205.434-1.32 1.044L4.527 18.532c-.117.61.352 1.19.98 1.19h1.295a.76.76 0 00.342-.19z" /><path opacity=".5" d="M19.447 8.125c-.527 3.467-2.756 5.432-6.354 5.432H11.3c-.624 0-1.185.454-1.299 1.055l-1.14 6.234a.754.754 0 00.742.891h2.48c.525 0 1.004-.363 1.1-.88l.461-2.53a1.11 1.11 0 011.1-.88h.698c3.163 0 5.289-1.742 5.73-4.834.198-1.354.01-2.461-.725-3.488z" /></svg>
  );
}
function GPayIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
  );
}
function ApplePayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#000"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" /></svg>
  );
}
