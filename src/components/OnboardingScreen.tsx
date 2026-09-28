import { useState, useRef, useEffect, type CSSProperties, type ReactNode } from 'react';
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion';
import { Plus, Sparkles, ArrowLeft, Search, Send, Map as MapIcon, Calendar, MessageCircle, User } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { EventCard } from './EventCard';
import { createEventPinSVG } from '../utils/createEventPin';
import { createMeetupPinSVG } from '../utils/createMeetupPin';
import { getCategoryColor } from '../utils/eventCategories';
import type { Event } from '../lib/supabase';

interface OnboardingScreenProps {
  onComplete: () => void;
  onLogin?: () => void;
}

/* ──────────────────────────────────────────────────────────────────────────
   A premium floating iPhone whose screen shows the REAL FOMO app — the product,
   alive in your hand. Real components inside: EventCard, map pin renderers,
   MessageBubble. Titanium frame, side buttons, dynamic island, accent glow,
   glass reflection, in-app tab bar. Hebrew text unchanged.
   ────────────────────────────────────────────────────────────────────────── */
const BRAND = '#F97316';
const BRAND_DARK = '#EA580C';
const INK = '#0B1220';
const BRAND_GRADIENT = `linear-gradient(135deg, ${BRAND}, ${BRAND_DARK})`;

const glass = (blur = 30, alpha = 0.5): CSSProperties => ({
  background: `rgba(255,255,255,${alpha})`,
  backdropFilter: `blur(${blur}px) saturate(180%)`,
  WebkitBackdropFilter: `blur(${blur}px) saturate(180%)`,
  border: '1px solid rgba(255,255,255,0.75)',
});

const haptic = (ms: number) => { try { navigator.vibrate?.(ms); } catch { /* unsupported */ } };

const IMG = {
  villa: '/villa-party.jpg',
  moondust: '/seed/moondust.png',
  wildlands: '/seed/wildlands.png',
  chatBg: '/chat-bg.png',
};

type ScreenKey = 'map' | 'events' | 'social' | 'chat' | 'create' | 'world' | 'celebrate';

interface Slide {
  key: string; screen: ScreenKey; showLogo?: boolean; isFinal?: boolean;
  title: string; subtitle?: string; body: string; accent: string;
}

/* Text intentionally unchanged from the original flow. */
const SLIDES: Slide[] = [
  { key: 'welcome', screen: 'map', showLogo: true, title: 'ברוכים הבאים ל-FOMO', subtitle: 'הבית של המטיילים הישראלים ברחבי העולם',
    body: 'גלה מה קורה סביבך, הכיר אנשים חדשים, הצטרף לאירועים — ואל תפספס אף חוויה בדרך.', accent: BRAND },
  { key: 'discover', screen: 'events', title: 'לא יודעים מה לעשות ביעד החדש?',
    body: 'FOMO מרכזת עבורכם את כל האירועים, המסיבות, הטיולים והמפגשים שמתקיימים סביבכם — בזמן אמת.', accent: '#FB923C' },
  { key: 'together', screen: 'social', title: 'אל תטיילו לבד',
    body: 'מצאו ישראלים שנמצאים בדיוק באזור שלכם, הכירו חברים חדשים והצטרפו לחוויות משותפות.', accent: BRAND },
  { key: 'info', screen: 'chat', title: 'כל המידע המקומי במקום אחד',
    body: 'בכל יעד יש קבוצות צ׳אט ייעודיות. שאלו, קבלו המלצות והתעדכנו ממטיילים שנמצאים בשטח.', accent: '#F59E0B' },
  { key: 'create', screen: 'create', title: 'החוויה הבאה מתחילה אצלכם',
    body: 'לא מצאתם אירוע שמתאים? צרו מפגש, טיול, ארוחה או מסיבה משלכם — והזמינו מטיילים להצטרף.', accent: BRAND_DARK },
  { key: 'community', screen: 'world', title: 'קהילה ישראלית בכל מקום בעולם',
    body: 'תאילנד, דרום אמריקה, אירופה או אוסטרליה — הקהילה הישראלית תמיד קרובה אליכם.', accent: BRAND },
  { key: 'final', screen: 'celebrate', isFinal: true, title: 'העולם מחכה לכם',
    body: 'אלפי מטיילים ישראלים כבר משתמשים ב-FOMO כדי להכיר אנשים, למצוא אירועים ולגלות חוויות בלתי נשכחות.', accent: BRAND },
];

const PARTICLES = Array.from({ length: 12 }).map((_, i) => ({
  left: (i * 37) % 100, top: (i * 53) % 100, size: 3 + (i % 3) * 2, dur: 9 + (i % 5) * 2, delay: (i % 7) * 0.6,
}));

const spring = { type: 'spring' as const, stiffness: 320, damping: 32 };
const easeSoft = [0.22, 1, 0.36, 1] as const;

/* ── Ambient stage: golden-hour wash + aurora + motes (keeps the phone the hero) ── */
function AmbientBackground({ accent, reduce }: { accent: string; reduce: boolean | null }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #FFF3E4 52%, #FFE0C4 100%)' }} />
      <motion.div className="absolute inset-0" style={{ background: `radial-gradient(115% 80% at 50% -8%, ${accent}2e 0%, transparent 56%)` }}
        animate={{ opacity: [0.65, 1, 0.65] }} transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.div className="absolute rounded-full" style={{ width: 360, height: 360, top: '-12%', right: '-16%', background: accent, filter: 'blur(100px)', opacity: 0.22 }}
        animate={reduce ? {} : { x: [0, 34, 0], y: [0, 26, 0], scale: [1, 1.12, 1] }} transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.div className="absolute rounded-full" style={{ width: 300, height: 300, bottom: '0%', left: '-18%', background: '#FDBA74', filter: 'blur(100px)', opacity: 0.3 }}
        animate={reduce ? {} : { x: [0, -26, 0], y: [0, -20, 0], scale: [1, 1.15, 1] }} transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }} />
      {!reduce && PARTICLES.map((p, i) => (
        <motion.span key={i} className="absolute rounded-full"
          style={{ left: `${p.left}%`, top: `${p.top}%`, width: p.size, height: p.size, background: 'rgba(255,255,255,0.85)', boxShadow: `0 0 8px ${accent}88` }}
          animate={{ y: [0, -26, 0], opacity: [0, 0.9, 0] }} transition={{ duration: p.dur, repeat: Infinity, delay: p.delay, ease: 'easeInOut' }} />
      ))}
    </div>
  );
}

const slideVariants: Variants = {
  enter: (dir: number) => ({ x: dir > 0 ? 70 : -70, opacity: 0, scale: 0.96 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -70 : 70, opacity: 0, scale: 0.96 }),
};

function FomoWordmark({ reduce }: { reduce: boolean | null }) {
  const letters = ['F', 'O', 'M', 'O'];
  return (
    <div dir="ltr" className="flex items-end" style={{ fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 900, letterSpacing: '-0.04em', fontSize: 44, color: INK, lineHeight: 1 }}>
      {letters.map((ch, i) => (
        <motion.span key={i} initial={reduce ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.6 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...spring, delay: 0.08 + i * 0.07 }} style={{ display: 'inline-block' }}>{ch}</motion.span>
      ))}
      <motion.span initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 14, delay: 0.45 }}
        style={{ display: 'inline-block', color: BRAND }}>.</motion.span>
    </div>
  );
}

/* ── Real app pin plumbing ──────────────────────────────────────────────── */
function DomNode({ make }: { make: () => HTMLElement }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    el.innerHTML = '';
    try { el.appendChild(make()); } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div ref={ref} style={{ lineHeight: 0 }} />;
}

function emojiAvatar(face: string, c1: string, c2: string): string {
  try {
    const s = 96; const cv = document.createElement('canvas'); cv.width = s; cv.height = s;
    const ctx = cv.getContext('2d'); if (!ctx) return '';
    const g = ctx.createLinearGradient(0, 0, s, s); g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    ctx.font = '56px "Apple Color Emoji","Segoe UI Emoji",system-ui,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(face, s / 2, s / 2 + 4);
    return cv.toDataURL('image/png');
  } catch { return ''; }
}

function PinAt({ x, y, delay, reduce, pulseColor, make }: {
  x: number; y: number; delay: number; reduce: boolean | null; pulseColor: string; make: () => HTMLElement;
}) {
  return (
    <motion.div className="absolute" style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-100%)' }}
      initial={{ scale: 0, opacity: 0, y: -6 }} animate={{ scale: 1, opacity: 1, y: 0 }} transition={{ ...spring, delay }}>
      {!reduce && (
        <motion.span className="absolute rounded-full" style={{ width: 38, height: 38, left: '50%', top: 10, marginLeft: -19, background: pulseColor, zIndex: 0 }}
          animate={{ scale: [1, 2.1], opacity: [0.3, 0] }} transition={{ duration: 2.4, repeat: Infinity, delay, ease: 'easeOut' }} />
      )}
      <div style={{ position: 'relative', zIndex: 1 }}><DomNode make={make} /></div>
    </motion.div>
  );
}

function MapPaper() {
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 400" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="200" height="400" fill="#EAF1EC" />
      <path d="M-10 300 Q60 260 120 300 T230 300 L230 420 L-10 420 Z" fill="#CFE6EC" />
      <circle cx="170" cy="70" r="46" fill="#D6E9DE" />
      <rect x="20" y="150" width="54" height="46" rx="10" fill="#D3E8D1" />
      {[['M-10 90 L210 60'], ['M-10 210 L210 250'], ['M40 -10 L70 410'], ['M150 -10 L120 410']].map((d, i) => (
        <path key={i} d={d[0]} stroke="#fff" strokeWidth="7" fill="none" strokeLinecap="round" />
      ))}
      {[['M-10 90 L210 60'], ['M-10 210 L210 250'], ['M40 -10 L70 410'], ['M150 -10 L120 410']].map((d, i) => (
        <path key={i} d={d[0]} stroke="#E7EDE9" strokeWidth="1.4" fill="none" strokeDasharray="2 5" />
      ))}
    </svg>
  );
}

/* iOS-style status bar. */
function StatusBar({ dark = false }: { dark?: boolean }) {
  const c = dark ? '#fff' : INK;
  return (
    <div className="flex items-center justify-between px-5 pt-2 pb-1 select-none" style={{ height: 30 }}>
      <span dir="ltr" style={{ fontSize: 12, fontWeight: 700, color: c, fontFamily: 'Inter, sans-serif' }}>9:41</span>
      <div className="flex items-center gap-1" dir="ltr">
        <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
          {[2, 5, 8, 11].map((x, i) => (<rect key={i} x={x} y={7 - i * 2} width="2.4" height={3 + i * 2} rx="0.6" fill={c} opacity={i === 3 ? 0.5 : 1} />))}
        </svg>
        <svg width="20" height="10" viewBox="0 0 20 10" fill="none">
          <rect x="0.6" y="0.6" width="16" height="8.8" rx="2.4" stroke={c} strokeOpacity="0.5" />
          <rect x="2" y="2" width="12" height="6" rx="1.3" fill={c} />
          <rect x="17.4" y="3.2" width="1.6" height="3.6" rx="0.8" fill={c} opacity="0.5" />
        </svg>
      </div>
    </div>
  );
}

/* The real app's bottom tab bar (browse screens). */
function TabBar({ active }: { active: number }) {
  const icons = [MapIcon, Calendar, MessageCircle, User];
  const order = [icons[0], icons[1], null, icons[2], icons[3]];
  let realIdx = -1;
  return (
    <div className="relative flex items-center justify-around px-2" style={{ height: 36, ...glass(16, 0.92), borderTop: '1px solid rgba(0,0,0,0.06)' }}>
      {order.map((Ic, i) => {
        if (!Ic) {
          return (
            <div key={i} className="rounded-full flex items-center justify-center" style={{ width: 32, height: 32, marginTop: -16, background: BRAND_GRADIENT, boxShadow: `0 6px 14px ${BRAND}66, inset 0 1px 0 rgba(255,255,255,0.4)` }}>
              <Plus className="w-4 h-4 text-white" strokeWidth={2.6} />
            </div>
          );
        }
        realIdx += 1;
        const on = realIdx === active;
        return <Ic key={i} className="w-4 h-4" style={{ color: on ? BRAND : '#9CA3AF' }} strokeWidth={on ? 2.6 : 2} />;
      })}
    </div>
  );
}

/* ── Screen 1 & 3: the live map with REAL pins ──────────────────────────── */
function MapScreen({ accent, reduce, social = false }: { accent: string; reduce: boolean | null; social?: boolean }) {
  const events = [
    { x: 30, y: 34, type: 'parties',   img: IMG.villa as string | null, today: true },
    { x: 68, y: 27, type: 'treks',     img: null as string | null,      today: false },
    { x: 52, y: 52, type: 'sports',    img: null as string | null,      today: false },
    { x: 26, y: 66, type: 'workshops', img: null as string | null,      today: false },
    { x: 74, y: 62, type: 'parties',   img: null as string | null,      today: false },
  ];
  const meetups = [
    { x: 27, y: 33, emoji: '🍻', face: '🧑‍🦱', c1: '#FDBA74', c2: '#F97316' },
    { x: 71, y: 29, emoji: '🏖️', face: '👩',   c1: '#7DD3FC', c2: '#0EA5E9' },
    { x: 31, y: 71, emoji: '🥾', face: '🧔',   c1: '#86EFAC', c2: '#22C55E' },
    { x: 73, y: 67, emoji: '🎉', face: '👱‍♀️', c1: '#D8B4FE', c2: '#7C3AED' },
  ];
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: '#EAF1EC' }}>
      <MapPaper />

      {/* header: location + search */}
      <div className="absolute left-2.5 right-2.5" style={{ top: 6, zIndex: 6 }}>
        <div className="flex items-center gap-2 rounded-2xl px-3 py-2" style={{ ...glass(10, 0.9), boxShadow: '0 6px 16px rgba(0,0,0,0.12)' }}>
          <Search className="w-3.5 h-3.5" style={{ color: '#9CA3AF' }} />
          <span dir="rtl" className="flex-1" style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', fontFamily: 'Heebo, sans-serif' }}>חפש אירועים לידך</span>
          <span dir="rtl" style={{ fontSize: 10.5, fontWeight: 800, color: BRAND_DARK, fontFamily: 'Heebo, sans-serif' }}>קופנגן 🇹🇭</span>
        </div>
      </div>

      {social && (
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {meetups.map((m, i) => (
            <motion.line key={i} x1="50" y1="50" x2={m.x} y2={m.y - 8} stroke={m.c2} strokeWidth="0.6" strokeDasharray="2 2"
              initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.5 }} transition={{ duration: 0.7, delay: 0.4 + i * 0.12 }} />
          ))}
        </svg>
      )}

      {social
        ? meetups.map((m, i) => (
            <PinAt key={i} x={m.x} y={m.y} delay={0.35 + i * 0.14} reduce={reduce} pulseColor={m.c2}
              make={() => createMeetupPinSVG(m.emoji, emojiAvatar(m.face, m.c1, m.c2))} />
          ))
        : events.map((e, i) => (
            <PinAt key={i} x={e.x} y={e.y} delay={i * 0.28} reduce={reduce} pulseColor={getCategoryColor(e.type)}
              make={() => createEventPinSVG(e.type, undefined, e.img, e.today)} />
          ))}

      {/* central "you" */}
      <div className="absolute left-1/2 top-1/2" style={{ transform: 'translate(-50%,-50%)' }}>
        {!reduce && (
          <motion.span className="absolute rounded-full" style={{ width: 26, height: 26, left: '50%', top: '50%', marginLeft: -13, marginTop: -13, background: accent }}
            animate={{ scale: [1, 3], opacity: [0.35, 0] }} transition={{ duration: 2.6, repeat: Infinity, ease: 'easeOut' }} />
        )}
        <div className="rounded-full" style={{ width: 16, height: 16, background: accent, border: '3px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }} />
      </div>

      {social && (
        <motion.div className="absolute left-1/2" style={{ bottom: 12, transform: 'translateX(-50%)' }}
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.9 }}>
          <div className="rounded-full px-3.5 py-1.5 whitespace-nowrap" style={{ background: BRAND_GRADIENT, boxShadow: `0 8px 20px ${BRAND}66` }}>
            <span dir="rtl" style={{ fontSize: 12, fontWeight: 800, color: '#fff', fontFamily: 'Heebo, sans-serif' }}>👋 3 ישראלים לידך</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}

/* ── Screen 2: the real event feed (the app's EventCard, device-width scaled) ── */
const FEED_W = 300;
function mockEvent(o: { id: string; title: string; type: string; img: string | null; date: Date; going: number; cap: number }): Event {
  return {
    id: o.id, user_id: 'other-user', title: o.title, event_type: o.type, emoji: '', image_url: o.img,
    event_date: o.date.toISOString(), attendees: Array.from({ length: o.going }, (_, i) => `u${i}`), max_attendees: o.cap,
    users: { display_name: 'דנה', avatar_url: null },
  } as unknown as Event;
}
function EventsScreen() {
  const now = new Date();
  const today22 = new Date(now); today22.setHours(22, 0, 0, 0);
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1); tomorrow.setHours(21, 0, 0, 0);
  const sat = new Date(now); sat.setDate(now.getDate() + 3); sat.setHours(5, 30, 0, 0);
  const events = [
    mockEvent({ id: 'e1', title: 'מסיבת וילה על החוף', type: 'parties', img: IMG.villa, date: today22, going: 17, cap: 20 }),
    mockEvent({ id: 'e2', title: 'Full Moon Party', type: 'parties', img: IMG.moondust, date: tomorrow, going: 42, cap: 9999 }),
    mockEvent({ id: 'e3', title: 'טרק ג׳ונגל בזריחה', type: 'treks', img: IMG.wildlands, date: sat, going: 5, cap: 15 }),
  ];
  const chips = ['הכל', '🎉 מסיבות', '🏕️ טרקים', '🧘 סדנאות'];
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: '#F3F4F6' }}>
      <div style={{ position: 'absolute', top: 0, left: '50%', width: FEED_W, transform: 'translateX(-50%) scale(0.66)', transformOrigin: 'top center' }}>
        <div className="px-3 pt-2 pb-2">
          <h3 dir="rtl" style={{ fontSize: 20, fontWeight: 900, color: INK, fontFamily: 'Heebo, sans-serif' }}>מה קורה סביבך 🔥</h3>
          <p dir="rtl" style={{ fontSize: 13, color: '#9CA3AF', fontFamily: 'Rubik, sans-serif' }}>קופנגן · עכשיו</p>
        </div>
        <div dir="rtl" className="flex gap-1.5 px-3 pb-2">
          {chips.map((c, i) => (
            <span key={i} style={{ fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 999, whiteSpace: 'nowrap',
              background: i === 0 ? BRAND_GRADIENT : '#fff', color: i === 0 ? '#fff' : '#6B7280', fontFamily: 'Heebo, sans-serif', boxShadow: i === 0 ? `0 4px 10px ${BRAND}44` : '0 1px 3px rgba(0,0,0,0.06)' }}>{c}</span>
          ))}
        </div>
        <div className="px-3 flex flex-col gap-3 pb-4">
          {events.map((ev, i) => (
            <motion.div key={(ev as unknown as { id: string }).id}
              initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ ...spring, delay: 0.2 + i * 0.15 }}>
              <EventCard event={ev} currentUserId="me" onAttendClick={() => {}} />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Screen 4: the real chat (MessageBubble, chat-bg, avatars) ───────────── */
function ChatScreen({ reduce }: { reduce: boolean | null }) {
  const msgs = [
    { mine: false, t: 'מישהו ב-Koh Phangan? 🌴', d: 0.2, a: '🧔' },
    { mine: true, t: 'כן! מסיבת Full Moon הערב 🔥', d: 0.6, a: '' },
    { mine: false, t: 'מצטרף! איפה נפגשים?', d: 1.0, a: '🧑‍🦱' },
  ];
  return (
    <div className="relative w-full h-full overflow-hidden flex flex-col" style={{ background: '#EFe7dd' }}>
      <img src={IMG.chatBg} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.5 }} />
      <div className="relative flex items-center gap-2 px-3 py-2" style={{ ...glass(12, 0.82), borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
        <div className="rounded-full flex items-center justify-center" style={{ width: 30, height: 30, background: BRAND_GRADIENT, fontSize: 15 }}>🌴</div>
        <div dir="rtl">
          <p style={{ fontSize: 12, fontWeight: 900, color: INK, fontFamily: 'Heebo, sans-serif', lineHeight: 1.1 }}>קופנגן</p>
          <p style={{ fontSize: 9.5, color: '#10B981', fontFamily: 'Rubik, sans-serif' }}>128 מחוברים</p>
        </div>
      </div>
      <div className="relative flex-1 flex flex-col gap-1.5 px-2.5 py-3" dir="rtl">
        {msgs.map((m, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: m.mine ? 24 : -24, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} transition={{ ...spring, delay: m.d }}
            style={{ display: 'flex', justifyContent: m.mine ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 4 }}>
            {!m.mine && <span className="rounded-full flex items-center justify-center" style={{ width: 22, height: 22, background: '#fff', fontSize: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}>{m.a}</span>}
            <div style={{ maxWidth: '74%' }}>
              <MessageBubble mine={!m.mine} color={m.mine ? '#FFD4A8' : '#FFFFFF'} contentStyle={{ padding: '6px 11px' }}>
                <p dir="rtl" style={{ fontSize: 12, lineHeight: 1.35, margin: 0, fontWeight: 600, wordBreak: 'break-word', color: m.mine ? '#7C3400' : '#111111', fontFamily: 'Rubik, sans-serif' }}>{m.t}</p>
              </MessageBubble>
            </div>
          </motion.div>
        ))}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }} style={{ display: 'flex', alignItems: 'center', gap: 5, paddingInlineStart: 26, marginTop: 1 }}>
          <div style={{ display: 'flex', gap: 3 }}>
            {[4, 5, 6].map((sz, d) => (
              <motion.span key={d} style={{ width: sz, height: sz, borderRadius: '50%', background: 'rgba(0,0,0,0.28)' }}
                animate={reduce ? {} : { y: [0, -4, 0] }} transition={{ duration: 1.2, repeat: Infinity, delay: d * 0.16, ease: 'easeInOut' }} />
            ))}
          </div>
          <span dir="rtl" style={{ fontSize: 11, fontWeight: 500, color: 'rgba(0,0,0,0.55)', fontFamily: 'Rubik, sans-serif' }}>אורי מקליד/ה</span>
        </motion.div>
      </div>
      <div className="relative flex items-center gap-2 px-2.5 py-2" style={{ ...glass(12, 0.82) }}>
        <div className="flex-1 rounded-full px-3 py-1.5" style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)' }}>
          <span dir="rtl" style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'Rubik, sans-serif' }}>הודעה…</span>
        </div>
        <div className="rounded-full flex items-center justify-center" style={{ width: 30, height: 30, background: BRAND_GRADIENT }}><Send className="w-3.5 h-3.5 text-white" /></div>
      </div>
    </div>
  );
}

/* ── Screen 5: create a meetup ───────────────────────────────────────────── */
function CreateScreen({ accent, reduce }: { accent: string; reduce: boolean | null }) {
  const emojis = ['🎉', '🏖️', '🍕', '🥾', '🍻', '🎶'];
  return (
    <div className="relative w-full h-full overflow-hidden flex flex-col items-center justify-end" style={{ background: 'linear-gradient(180deg,#FFF7ED,#FFE8D2)' }}>
      <motion.div className="absolute" style={{ top: 40 }} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...spring, delay: 0.2 }}>
        <div className="relative rounded-full flex items-center justify-center" style={{ width: 62, height: 62, background: BRAND_GRADIENT, boxShadow: `0 16px 34px ${accent}77, inset 0 2px 4px rgba(255,255,255,0.4)` }}>
          <Plus className="w-8 h-8 text-white" strokeWidth={2.6} />
          {!reduce && (<motion.span className="absolute inset-0 rounded-full" style={{ border: `3px solid ${accent}` }} animate={{ scale: [1, 1.7], opacity: [0.7, 0] }} transition={{ duration: 1.8, repeat: Infinity }} />)}
        </div>
      </motion.div>
      <motion.div className="w-full rounded-t-3xl px-3.5 pt-3.5 pb-4" style={{ background: '#fff', boxShadow: '0 -10px 30px rgba(0,0,0,0.12)' }}
        initial={{ y: 220 }} animate={{ y: 0 }} transition={{ ...spring, delay: 0.45 }} dir="rtl">
        <div className="mx-auto mb-3 rounded-full" style={{ width: 36, height: 4, background: '#E5E7EB' }} />
        <h3 style={{ fontSize: 14, fontWeight: 900, color: INK, fontFamily: 'Heebo, sans-serif' }}>צור מפגש חדש</h3>
        <div className="flex gap-1.5 mt-2.5">
          {emojis.map((e, i) => (
            <motion.div key={i} className="flex items-center justify-center rounded-xl"
              style={{ width: 30, height: 30, fontSize: 15, background: i === 0 ? `${accent}1f` : '#F3F4F6', border: i === 0 ? `1.5px solid ${accent}` : '1.5px solid transparent' }}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 + i * 0.05 }}>{e}</motion.div>
          ))}
        </div>
        <div className="mt-3 rounded-xl px-3 py-2.5" style={{ background: '#F3F4F6' }}>
          <span style={{ fontSize: 11.5, color: '#9CA3AF', fontFamily: 'Rubik, sans-serif' }}>מסיבת חוף בהאד רין 🎉</span>
        </div>
        <div className="mt-2.5 h-9 rounded-xl flex items-center justify-center text-white" style={{ background: BRAND_GRADIENT, fontSize: 12.5, fontWeight: 800, fontFamily: 'Heebo, sans-serif' }}>פרסם מפגש</div>
      </motion.div>
    </div>
  );
}

/* ── Screen 6: world community — flag bubbles orbiting a globe ───────────── */
function WorldScreen({ accent, reduce }: { accent: string; reduce: boolean | null }) {
  const flags = [
    { flag: '🇹🇭', x: 24, y: 27, size: 46, dur: 5.0 }, { flag: '🇻🇳', x: 73, y: 24, size: 40, dur: 6.2 },
    { flag: '🇮🇳', x: 80, y: 58, size: 44, dur: 5.6 }, { flag: '🇵🇪', x: 20, y: 62, size: 42, dur: 6.6 },
    { flag: '🇦🇺', x: 52, y: 79, size: 38, dur: 5.3 }, { flag: '🇬🇪', x: 50, y: 14, size: 36, dur: 6.0 },
  ];
  return (
    <div className="relative w-full h-full overflow-hidden flex items-center justify-center" style={{ background: 'linear-gradient(180deg,#FFF7ED 0%,#FFE9D4 60%,#FFDCC0 100%)' }}>
      {[64, 96].map((r, i) => (<div key={i} className="absolute rounded-full" style={{ width: r * 2, height: r * 2, border: `1px dashed ${accent}44` }} />))}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {flags.map((f, i) => (
          <motion.line key={i} x1="50" y1="50" x2={f.x} y2={f.y} stroke={accent} strokeWidth="0.5" strokeDasharray="2 3"
            initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.4 }} transition={{ duration: 0.8, delay: 0.3 + i * 0.1 }} />
        ))}
      </svg>
      {flags.map((f, i) => (
        <motion.div key={i} className="absolute" style={{ left: `${f.x}%`, top: `${f.y}%`, transform: 'translate(-50%,-50%)' }}
          initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...spring, delay: 0.35 + i * 0.1 }}>
          <motion.div className="flex items-center justify-center rounded-full" style={{ width: f.size, height: f.size, ...glass(8, 0.9), fontSize: f.size * 0.5, boxShadow: '0 8px 18px rgba(0,0,0,0.16)' }}
            animate={reduce ? {} : { y: [0, -6, 0] }} transition={{ duration: f.dur, repeat: Infinity, ease: 'easeInOut', delay: i * 0.2 }}>{f.flag}</motion.div>
        </motion.div>
      ))}
      <div className="relative flex items-center justify-center" style={{ zIndex: 2 }}>
        {!reduce && (<motion.span className="absolute rounded-full" style={{ width: 54, height: 54, background: accent }} animate={{ scale: [1, 2], opacity: [0.4, 0] }} transition={{ duration: 2.6, repeat: Infinity, ease: 'easeOut' }} />)}
        <div className="flex items-center justify-center rounded-full" style={{ width: 54, height: 54, background: BRAND_GRADIENT, boxShadow: `0 12px 28px ${accent}66, inset 0 2px 4px rgba(255,255,255,0.4)`, fontSize: 26 }}>🌍</div>
      </div>
      <motion.div className="absolute left-1/2" style={{ bottom: 14, transform: 'translateX(-50%)' }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.8 }}>
        <div className="rounded-full px-3.5 py-1.5 whitespace-nowrap" style={{ ...glass(10, 0.9), boxShadow: '0 8px 20px rgba(0,0,0,0.14)' }}>
          <span dir="rtl" style={{ fontSize: 11.5, fontWeight: 800, color: BRAND_DARK, fontFamily: 'Heebo, sans-serif' }}>🌍 קהילה ב-40+ מדינות</span>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Screen 7: celebrate ─────────────────────────────────────────────────── */
function CelebrateScreen({ accent, reduce }: { accent: string; reduce: boolean | null }) {
  const colors = ['#F97316', '#FB923C', '#FBBF24', '#EA580C', '#FDBA74', '#34D399', '#60A5FA'];
  return (
    <div className="relative w-full h-full overflow-hidden flex items-center justify-center" style={{ background: 'linear-gradient(180deg,#FFF7ED,#FFE8D2)' }}>
      {!reduce && Array.from({ length: 26 }).map((_, i) => {
        const ang = (i / 26) * Math.PI * 2; const dist = 70 + (i % 3) * 22;
        return (<motion.div key={i} className="absolute rounded-sm" style={{ width: 7, height: 7, background: colors[i % colors.length] }}
          initial={{ x: 0, y: 0, opacity: 0, rotate: 0 }} animate={{ x: Math.cos(ang) * dist, y: Math.sin(ang) * dist, opacity: [0, 1, 0], rotate: 220 }}
          transition={{ duration: 1.9, repeat: Infinity, delay: i * 0.07, ease: 'easeOut' }} />);
      })}
      <motion.div className="relative flex items-center justify-center rounded-full" style={{ width: 94, height: 94, background: BRAND_GRADIENT, boxShadow: `0 20px 50px ${accent}66, inset 0 2px 6px rgba(255,255,255,0.4)` }}
        initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ ...spring, delay: 0.15 }}>
        <motion.svg width="46" height="46" viewBox="0 0 46 46" fill="none">
          <motion.path d="M12 24 L20 32 L34 15" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.5 }} />
        </motion.svg>
      </motion.div>
    </div>
  );
}

function PhoneScreen({ screen, accent, reduce }: { screen: ScreenKey; accent: string; reduce: boolean | null }) {
  const dark = screen === 'chat';
  const withTabs = screen === 'map' || screen === 'social' || screen === 'events';
  let body: ReactNode = null;
  switch (screen) {
    case 'map': body = <MapScreen accent={accent} reduce={reduce} />; break;
    case 'social': body = <MapScreen accent={accent} reduce={reduce} social />; break;
    case 'events': body = <EventsScreen />; break;
    case 'chat': body = <ChatScreen reduce={reduce} />; break;
    case 'create': body = <CreateScreen accent={accent} reduce={reduce} />; break;
    case 'world': body = <WorldScreen accent={accent} reduce={reduce} />; break;
    case 'celebrate': body = <CelebrateScreen accent={accent} reduce={reduce} />; break;
  }
  return (
    <div className="absolute inset-0 flex flex-col">
      <StatusBar dark={dark} />
      <div className="flex-1 relative overflow-hidden">{body}</div>
      {withTabs && <TabBar active={screen === 'events' ? 1 : 0} />}
    </div>
  );
}

/* The premium titanium iPhone. */
function Phone({ slideKey, screen, accent, reduce }: { slideKey: string; screen: ScreenKey; accent: string; reduce: boolean | null }) {
  const railBtn = 'linear-gradient(#4a4a4e,#242427)';
  return (
    <div style={{ perspective: 1200, position: 'relative' }}>
      {/* accent glow halo */}
      <motion.div aria-hidden className="absolute rounded-full" style={{ width: 250, height: 250, left: '50%', top: '46%', transform: 'translate(-50%,-50%)', background: accent, filter: 'blur(80px)', opacity: 0.26, zIndex: 0 }}
        animate={reduce ? {} : { opacity: [0.2, 0.32, 0.2] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }} />

      <motion.div className="ob-phone relative" style={{ width: 220, height: 452, transformStyle: 'preserve-3d', zIndex: 1 }}
        animate={reduce ? { rotateY: -4, rotateX: 2 } : { y: [0, -10, 0], rotateY: [-6, 4, -6], rotateX: [3, 1.5, 3] }}
        transition={reduce ? {} : { duration: 9, repeat: Infinity, ease: 'easeInOut' }}>
        {/* ground shadow */}
        <div className="absolute left-1/2" style={{ bottom: -30, width: 172, height: 30, marginLeft: -86, background: 'rgba(0,0,0,0.22)', filter: 'blur(20px)', borderRadius: '50%' }} />
        {/* side buttons */}
        <div className="absolute" style={{ left: -2.5, top: 100, width: 3, height: 22, borderRadius: 2, background: railBtn }} />
        <div className="absolute" style={{ left: -2.5, top: 134, width: 3, height: 38, borderRadius: 2, background: railBtn }} />
        <div className="absolute" style={{ left: -2.5, top: 182, width: 3, height: 38, borderRadius: 2, background: railBtn }} />
        <div className="absolute" style={{ right: -2.5, top: 156, width: 3, height: 56, borderRadius: 2, background: railBtn }} />
        {/* titanium body */}
        <div className="absolute inset-0" style={{ borderRadius: 48, background: 'linear-gradient(145deg,#4a4a4e 0%,#1a1a1d 30%,#2e2e32 55%,#141416 100%)', padding: 9, boxShadow: `0 40px 80px ${accent}2e, 0 22px 46px rgba(0,0,0,0.45), inset 0 1px 2px rgba(255,255,255,0.3), inset 0 -1px 3px rgba(0,0,0,0.6)` }}>
          <div className="absolute" style={{ inset: 5, borderRadius: 44, boxShadow: 'inset 0 0 0 1.5px rgba(0,0,0,0.55)' }} />
          {/* screen */}
          <div className="relative w-full h-full overflow-hidden" style={{ borderRadius: 40, background: '#fff' }}>
            <AnimatePresence mode="wait">
              <motion.div key={slideKey} className="absolute inset-0"
                initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.45, ease: easeSoft }}>
                <PhoneScreen screen={screen} accent={accent} reduce={reduce} />
              </motion.div>
            </AnimatePresence>
            {/* dynamic island */}
            <div className="absolute left-1/2" style={{ top: 10, width: 84, height: 24, marginLeft: -42, background: '#000', borderRadius: 13, zIndex: 20 }}>
              <div className="absolute rounded-full" style={{ right: 8, top: '50%', marginTop: -4, width: 8, height: 8, background: '#0b0b14', boxShadow: 'inset 0 0 2px rgba(90,90,130,0.9)' }} />
            </div>
            {/* diagonal glass reflection */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(125deg, rgba(255,255,255,0.20) 0%, transparent 24%)', zIndex: 15 }} />
            {/* moving light sweep */}
            {!reduce && (
              <motion.div className="absolute inset-0 pointer-events-none" style={{ mixBlendMode: 'screen', background: 'linear-gradient(105deg, transparent 42%, rgba(255,255,255,0.4) 50%, transparent 58%)', backgroundSize: '220% 100%', zIndex: 16 }}
                animate={{ backgroundPositionX: ['-120%', '220%'] }} transition={{ duration: 5.5, repeat: Infinity, repeatDelay: 1.6, ease: 'easeInOut' }} />
            )}
            <div className="absolute inset-0 pointer-events-none" style={{ borderRadius: 40, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.12)', zIndex: 17 }} />
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function PrimaryButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <motion.button onClick={() => { haptic(12); onClick(); }} whileTap={{ scale: 0.97 }}
      className="relative w-full h-14 text-white rounded-2xl font-black flex items-center justify-center gap-2 overflow-hidden"
      style={{ fontFamily: 'Heebo, sans-serif', background: BRAND_GRADIENT, boxShadow: `0 14px 34px ${BRAND}66, inset 0 1px 0 rgba(255,255,255,0.4)` }}>
      <span className="relative z-10 flex items-center gap-2">{children}</span>
      <motion.span aria-hidden className="absolute top-0 bottom-0 w-1/3" style={{ background: 'linear-gradient(100deg, transparent, rgba(255,255,255,0.45), transparent)' }}
        animate={{ x: ['-160%', '260%'] }} transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 1.4, ease: 'easeInOut' }} />
    </motion.button>
  );
}

export function OnboardingScreen({ onComplete, onLogin }: OnboardingScreenProps) {
  const reduce = useReducedMotion();
  const [[index, dir], setPage] = useState<[number, number]>([0, 0]);
  const slide = SLIDES[index];
  const isFinal = !!slide.isFinal;

  const paginate = (newDir: number) => {
    const next = index + newDir;
    if (next < 0 || next >= SLIDES.length) return;
    haptic(8);
    setPage([next, newDir]);
  };

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden" dir="rtl" style={{ background: '#FFF3E4' }}>
      <AmbientBackground accent={slide.accent} reduce={reduce} />

      <div className="relative z-10 px-6" style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        <div className="flex items-center gap-3 pt-2">
          <div className="flex-1 flex gap-1.5">
            {SLIDES.map((_, i) => (
              <div key={i} className="h-1.5 flex-1 rounded-full overflow-hidden" style={{ ...glass(6, 0.4) }}>
                <motion.div className="h-full rounded-full" style={{ background: BRAND_GRADIENT }} initial={false} animate={{ width: i <= index ? '100%' : '0%' }} transition={{ duration: i === index ? 0.5 : 0.25, ease: 'easeOut' }} />
              </div>
            ))}
          </div>
          {!isFinal && (
            <motion.button whileTap={{ scale: 0.94 }} onClick={() => { haptic(6); onComplete(); }} aria-label="דלג"
              className="text-[13px] font-bold rounded-full px-3 py-1" style={{ color: BRAND_DARK, ...glass(10, 0.5), fontFamily: 'Heebo, sans-serif' }}>דלג</motion.button>
          )}
        </div>
      </div>

      <div className="relative z-10 flex-1 flex items-stretch min-h-0">
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div key={index} custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={spring}
            drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.18}
            onDragEnd={(_, info) => { if (info.offset.x < -60) paginate(1); else if (info.offset.x > 60) paginate(-1); }}
            className="w-full flex flex-col items-center justify-center px-6 cursor-grab active:cursor-grabbing">
            {slide.showLogo && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.05 }} className="mb-3">
                <FomoWordmark reduce={reduce} />
              </motion.div>
            )}

            <div className="ob-stage flex items-center justify-center" style={{ minHeight: 0 }}>
              <Phone slideKey={slide.key} screen={slide.screen} accent={slide.accent} reduce={reduce} />
            </div>

            <motion.div initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ ...spring, delay: 0.12 }} className="w-full max-w-sm text-center mt-6">
              {slide.subtitle && (
                <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.28 }} className="text-[14px] font-bold mb-1.5" style={{ fontFamily: 'Heebo, sans-serif', color: slide.accent }}>{slide.subtitle}</motion.p>
              )}
              <motion.h2 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.2 }} className="text-[23px] font-black leading-tight" style={{ fontFamily: 'Heebo, sans-serif', color: INK }}>{slide.title}</motion.h2>
              <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.34 }} className="text-[14px] leading-relaxed mt-2.5" style={{ fontFamily: 'Rubik, sans-serif', color: '#52525B' }}>{slide.body}</motion.p>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="relative z-10 px-6 pt-3" style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
        {isFinal ? (
          <div className="space-y-3">
            <PrimaryButton onClick={onComplete}><Sparkles className="w-5 h-5" /><span>התחל עכשיו</span></PrimaryButton>
            <motion.button whileTap={{ scale: 0.98 }} onClick={() => { haptic(6); (onLogin || onComplete)(); }} className="w-full h-12 rounded-2xl font-bold" style={{ fontFamily: 'Heebo, sans-serif', color: BRAND_DARK, ...glass(14, 0.5) }}>כבר יש לי חשבון</motion.button>
          </div>
        ) : (
          <PrimaryButton onClick={() => paginate(1)}><span>{index === 0 ? 'בואו נתחיל' : 'המשך'}</span><ArrowLeft className="w-5 h-5" /></PrimaryButton>
        )}
      </div>

      <style>{`
        @media (max-height: 780px) { .ob-phone { transform: scale(0.9); } }
        @media (max-height: 700px) { .ob-phone { transform: scale(0.8); } }
        @media (max-height: 630px) { .ob-phone { transform: scale(0.7); } }
      `}</style>
    </div>
  );
}
