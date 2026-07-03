import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion';
import { Globe, Users, MapPin, MessageCircle, Plus, Calendar, Sparkles, ArrowLeft } from 'lucide-react';
import { MessageBubble } from './MessageBubble';

interface OnboardingScreenProps {
  onComplete: () => void;
  onLogin?: () => void;
}

/* ──────────────────────────────────────────────────────────────────────────
   Brand tokens — warm FOMO orange family + a frosted-glass surface language.
   ────────────────────────────────────────────────────────────────────────── */
const BRAND = '#F97316';
const BRAND_DARK = '#EA580C';
const BRAND_GRADIENT = `linear-gradient(135deg, ${BRAND}, ${BRAND_DARK})`;

/** Frosted glass panel used across the flow. */
const glass = (blur = 30, alpha = 0.5): React.CSSProperties => ({
  background: `rgba(255,255,255,${alpha})`,
  backdropFilter: `blur(${blur}px) saturate(180%)`,
  WebkitBackdropFilter: `blur(${blur}px) saturate(180%)`,
  border: '1px solid rgba(255,255,255,0.75)',
});

/** Light haptic tick — works on Android WebView; silently no-ops elsewhere. */
const haptic = (ms: number) => {
  try { navigator.vibrate?.(ms); } catch { /* unsupported */ }
};

type IllustrationKey = 'world' | 'events' | 'social' | 'chat' | 'create' | 'community' | 'celebrate';

interface Slide {
  key: string;
  illustration: IllustrationKey;
  showLogo?: boolean;
  isFinal?: boolean;
  title: string;
  subtitle?: string;
  body: string;
  accent: string;
}

/* Text is intentionally unchanged from the original flow. */
const SLIDES: Slide[] = [
  {
    key: 'welcome',
    illustration: 'world',
    showLogo: true,
    title: 'ברוכים הבאים ל-FOMO',
    subtitle: 'הבית של המטיילים הישראלים ברחבי העולם',
    body: 'גלה מה קורה סביבך, הכיר אנשים חדשים, הצטרף לאירועים — ואל תפספס אף חוויה בדרך.',
    accent: BRAND,
  },
  {
    key: 'discover',
    illustration: 'events',
    title: 'לא יודעים מה לעשות ביעד החדש?',
    body: 'FOMO מרכזת עבורכם את כל האירועים, המסיבות, הטיולים והמפגשים שמתקיימים סביבכם — בזמן אמת.',
    accent: '#FB923C',
  },
  {
    key: 'together',
    illustration: 'social',
    title: 'אל תטיילו לבד',
    body: 'מצאו ישראלים שנמצאים בדיוק באזור שלכם, הכירו חברים חדשים והצטרפו לחוויות משותפות.',
    accent: BRAND,
  },
  {
    key: 'info',
    illustration: 'chat',
    title: 'כל המידע המקומי במקום אחד',
    body: 'בכל יעד יש קבוצות צ׳אט ייעודיות. שאלו, קבלו המלצות והתעדכנו ממטיילים שנמצאים בשטח.',
    accent: '#F59E0B',
  },
  {
    key: 'create',
    illustration: 'create',
    title: 'החוויה הבאה מתחילה אצלכם',
    body: 'לא מצאתם אירוע שמתאים? צרו מפגש, טיול, ארוחה או מסיבה משלכם — והזמינו מטיילים להצטרף.',
    accent: BRAND_DARK,
  },
  {
    key: 'community',
    illustration: 'community',
    title: 'קהילה ישראלית בכל מקום בעולם',
    body: 'תאילנד, דרום אמריקה, אירופה או אוסטרליה — הקהילה הישראלית תמיד קרובה אליכם.',
    accent: BRAND,
  },
  {
    key: 'final',
    illustration: 'celebrate',
    isFinal: true,
    title: 'העולם מחכה לכם',
    body: 'אלפי מטיילים ישראלים כבר משתמשים ב-FOMO כדי להכיר אנשים, למצוא אירועים ולגלות חוויות בלתי נשכחות.',
    accent: BRAND,
  },
];

/* Destinations used by the animated map layers (percent coordinates). */
const PINS = [
  { x: 22, y: 34 }, { x: 42, y: 28 }, { x: 64, y: 40 },
  { x: 78, y: 30 }, { x: 55, y: 58 }, { x: 30, y: 62 }, { x: 84, y: 56 },
];

/* Drifting light particles for extra life. */
const PARTICLES = Array.from({ length: 14 }).map((_, i) => ({
  left: (i * 37) % 100,
  top: (i * 53) % 100,
  size: 3 + (i % 3) * 2,
  dur: 9 + (i % 5) * 2,
  delay: (i % 7) * 0.6,
}));

/* ──────────────────────────────────────────────────────────────────────────
   Ambient background — living aurora blobs, a dotted "map" with pulsing pins,
   drifting light motes and a slow sheen. Accent crossfades per slide.
   ────────────────────────────────────────────────────────────────────────── */
function AmbientBackground({ accent, reduce }: { accent: string; reduce: boolean | null }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {/* base wash */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #FFF7ED 55%, #FFE4CC 100%)' }} />

      {/* animated accent tint (crossfades per slide) */}
      <motion.div
        className="absolute inset-0"
        style={{ background: `radial-gradient(120% 90% at 50% -10%, ${accent}26 0%, transparent 55%)` }}
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* drifting aurora blobs */}
      <motion.div
        className="absolute rounded-full"
        style={{ width: 380, height: 380, top: '-10%', right: '-14%', background: accent, filter: 'blur(96px)', opacity: 0.26 }}
        animate={reduce ? {} : { x: [0, 34, 0], y: [0, 26, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 13, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute rounded-full"
        style={{ width: 320, height: 320, bottom: '2%', left: '-16%', background: '#FDBA74', filter: 'blur(96px)', opacity: 0.3 }}
        animate={reduce ? {} : { x: [0, -28, 0], y: [0, -22, 0], scale: [1, 1.14, 1] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute rounded-full"
        style={{ width: 240, height: 240, top: '38%', left: '58%', background: '#FCA5A5', filter: 'blur(90px)', opacity: 0.18 }}
        animate={reduce ? {} : { x: [0, -22, 18, 0], y: [0, 18, -16, 0], scale: [1, 1.12, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* dotted map + pulsing destination pins */}
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice" viewBox="0 0 100 100">
        {Array.from({ length: 90 }).map((_, i) => {
          const col = i % 15, row = Math.floor(i / 15);
          return <circle key={i} cx={4 + col * 6.6} cy={20 + row * 9} r={0.35} fill={accent} opacity={0.1} />;
        })}
        {PINS.map((p, i) => (
          <g key={i}>
            {!reduce && (
              <motion.circle
                cx={p.x} cy={p.y} r={1.4} fill={accent}
                initial={{ opacity: 0.5, scale: 1 }}
                animate={{ opacity: [0.5, 0, 0.5], scale: [1, 4, 1] }}
                transition={{ duration: 3, repeat: Infinity, delay: i * 0.4, ease: 'easeOut' }}
                style={{ transformOrigin: `${p.x}px ${p.y}px` }}
              />
            )}
            <circle cx={p.x} cy={p.y} r={0.9} fill={accent} opacity={0.55} />
          </g>
        ))}
      </svg>

      {/* drifting light motes */}
      {!reduce && PARTICLES.map((p, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{ left: `${p.left}%`, top: `${p.top}%`, width: p.size, height: p.size, background: 'rgba(255,255,255,0.85)', boxShadow: `0 0 8px ${accent}88` }}
          animate={{ y: [0, -26, 0], opacity: [0, 0.9, 0] }}
          transition={{ duration: p.dur, repeat: Infinity, delay: p.delay, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

/* Slide-in/out transition for whole slides (RTL-aware: forward moves leftward). */
const slideVariants: Variants = {
  enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0, scale: 0.94 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0, scale: 0.94 }),
};

const spring = { type: 'spring' as const, stiffness: 320, damping: 32 };

/* Floating wrapper for the hero illustrations. */
function Float({ children, reduce, delay = 0 }: { children: React.ReactNode; reduce: boolean | null; delay?: number }) {
  return (
    <motion.div
      animate={reduce ? {} : { y: [0, -12, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay }}
    >
      {children}
    </motion.div>
  );
}

function Halo({ accent, reduce }: { accent: string; reduce: boolean | null }) {
  return (
    <>
      {[0, 1].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{ inset: -22 - i * 18, border: `2px solid ${accent}`, opacity: 0 }}
          animate={reduce ? { opacity: 0.15 } : { opacity: [0, 0.25, 0], scale: [0.85, 1.15, 0.85] }}
          transition={{ duration: 3.5, repeat: Infinity, delay: i * 0.6, ease: 'easeInOut' }}
        />
      ))}
    </>
  );
}

/* Big round gradient badge holding a lucide icon. */
function IconBadge({ Icon, accent }: { Icon: typeof Globe; accent: string }) {
  return (
    <div
      className="relative w-32 h-32 rounded-[34px] flex items-center justify-center"
      style={{ background: `linear-gradient(135deg, ${accent}, ${BRAND_DARK})`, boxShadow: `0 20px 50px ${accent}55, inset 0 2px 4px rgba(255,255,255,0.35)` }}
    >
      <Icon className="w-16 h-16 text-white" strokeWidth={1.8} />
    </div>
  );
}

/* FOMO wordmark — matches the home-screen logo (Inter black + orange dot),
   with the letters springing in and the dot popping last. */
function FomoWordmark({ reduce }: { reduce: boolean | null }) {
  const letters = ['F', 'O', 'M', 'O'];
  return (
    <div
      dir="ltr"
      className="flex items-end"
      style={{ fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 900, letterSpacing: '-0.04em', fontSize: 52, color: '#1C1C1E', lineHeight: 1 }}
    >
      {letters.map((ch, i) => (
        <motion.span
          key={i}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 22, scale: 0.6 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...spring, delay: 0.1 + i * 0.08 }}
          style={{ display: 'inline-block' }}
        >
          {ch}
        </motion.span>
      ))}
      <motion.span
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 14, delay: 0.5 }}
        style={{ display: 'inline-block', color: BRAND }}
      >
        .
      </motion.span>
    </div>
  );
}

/* ── Hero for slide 1: a living globe where the orange FOMO dot flies between
   real Israeli-traveler destinations, lighting each one up on arrival. ────── */
function WorldHero({ accent, reduce }: { accent: string; reduce: boolean | null }) {
  const T = 7;                       // full loop, seconds
  const cx = 130, cy = 130, R = 84;  // globe centre + radius
  const dests = [
    { name: 'בנגקוק', x: 66, y: 74 },
    { name: 'ברצלונה', x: 190, y: 66 },
    { name: 'באלי', x: 196, y: 168 },
    { name: 'מדיין', x: 72, y: 182 },
  ];
  const N = dests.length;
  const loop = [...dests, dests[0]];            // return to start
  const times = loop.map((_, i) => i / N);      // arrival times, 0..1

  const arc = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const dx = mx - cx, dy = my - cy, len = Math.hypot(dx, dy) || 1;
    const k = 20; // bulge outward from the centre
    return `M${a.x},${a.y} Q${mx + (dx / len) * k},${my + (dy / len) * k} ${b.x},${b.y}`;
  };

  return (
    <div className="relative" style={{ width: 260, height: 260 }} dir="ltr">
      {/* golden-hour glow behind the globe */}
      <div className="absolute rounded-full" style={{ inset: 8, background: `radial-gradient(circle at 46% 32%, ${accent}44, transparent 62%)`, filter: 'blur(12px)' }} />

      <svg className="absolute inset-0" width="260" height="260" viewBox="0 0 260 260" style={{ overflow: 'visible' }}>
        <defs>
          <radialGradient id="fomoGlobe" cx="42%" cy="30%" r="78%">
            <stop offset="0%" stopColor="#FFF5E6" />
            <stop offset="55%" stopColor="#FFD9A6" />
            <stop offset="100%" stopColor="#F59E48" />
          </radialGradient>
        </defs>

        {/* globe body + rim */}
        <circle cx={cx} cy={cy} r={R} fill="url(#fomoGlobe)" />
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#fff" strokeOpacity={0.55} strokeWidth={1} />
        {/* latitude lines */}
        {[-52, -26, 0, 26, 52].map((o, i) => (
          <ellipse key={i} cx={cx} cy={cy + o} rx={Math.sqrt(Math.max(R * R - o * o, 0))} ry={Math.max(5, (R - Math.abs(o)) * 0.3)} fill="none" stroke="#fff" strokeOpacity={0.26} strokeWidth={1} />
        ))}
        {/* longitude lines */}
        {[0.34, 0.68, 1].map((f, i) => (
          <ellipse key={i} cx={cx} cy={cy} rx={R * f} ry={R} fill="none" stroke="#fff" strokeOpacity={0.2} strokeWidth={1} />
        ))}

        {/* connecting travel arcs (drifting dashes) */}
        {dests.map((d, i) => (
          <motion.path key={i} d={arc(d, dests[(i + 1) % N])} fill="none" stroke={accent} strokeOpacity={0.5} strokeWidth={1.6} strokeDasharray="3 6" strokeLinecap="round"
            animate={reduce ? {} : { strokeDashoffset: [0, -18] }} transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }} />
        ))}

        {/* destination pins — pulse/light up as the dot arrives */}
        {dests.map((d, i) => (
          <g key={i}>
            {!reduce && (
              <motion.circle cx={d.x} cy={d.y} r={5} fill={accent}
                animate={{ r: [5, 18], opacity: [0.55, 0] }}
                transition={{ duration: 1, repeat: Infinity, repeatDelay: T - 1, delay: (i / N) * T, ease: 'easeOut' }} />
            )}
            <circle cx={d.x} cy={d.y} r={4.5} fill="#fff" />
            <motion.circle cx={d.x} cy={d.y} r={3} fill={accent} style={{ transformOrigin: `${d.x}px ${d.y}px` }}
              animate={reduce ? {} : { scale: [1, 1.5, 1] }}
              transition={{ duration: 0.7, repeat: Infinity, repeatDelay: T - 0.7, delay: (i / N) * T }} />
          </g>
        ))}
      </svg>

      {/* city labels (glass pills) — brighten on arrival */}
      {dests.map((d, i) => {
        const dx = d.x - cx, dy = d.y - cy, len = Math.hypot(dx, dy) || 1;
        const lx = d.x + (dx / len) * 13, ly = d.y + (dy / len) * 13;
        return (
          <motion.div key={i} className="absolute px-2 py-0.5 rounded-full whitespace-nowrap"
            style={{ left: lx, top: ly, transform: 'translate(-50%,-50%)', ...glass(8, 0.62), fontFamily: 'Heebo, sans-serif', fontSize: 11, fontWeight: 700, color: BRAND_DARK, boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}
            animate={reduce ? { opacity: 0.9 } : { opacity: [0.5, 1, 0.5], scale: [0.96, 1.06, 0.96] }}
            transition={{ duration: 1, repeat: Infinity, repeatDelay: T - 1, delay: (i / N) * T }}>
            {d.name}
          </motion.div>
        );
      })}

      {/* the flying FOMO dot (the brand mark, come to life) */}
      <motion.div className="absolute rounded-full" style={{ width: 15, height: 15, marginLeft: -7.5, marginTop: -7.5, background: accent, boxShadow: `0 0 16px 2px ${accent}` }}
        initial={{ x: dests[0].x, y: dests[0].y }}
        animate={reduce ? { x: dests[0].x, y: dests[0].y } : { x: loop.map(p => p.x), y: loop.map(p => p.y) }}
        transition={{ duration: T, repeat: Infinity, ease: 'easeInOut', times }}
      >
        {!reduce && <motion.span className="absolute inset-0 rounded-full" style={{ background: accent }} animate={{ scale: [1, 2.3], opacity: [0.5, 0] }} transition={{ duration: 0.9, repeat: Infinity, ease: 'easeOut' }} />}
      </motion.div>
    </div>
  );
}

/* ── Per-slide illustrations ─────────────────────────────────────────────── */
function Illustration({ kind, accent, reduce }: { kind: IllustrationKey; accent: string; reduce: boolean | null }) {
  const cardEnter = (delay: number) => ({
    initial: { opacity: 0, y: 16, scale: 0.92 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { ...spring, delay },
  });

  switch (kind) {
    case 'world':
      return <WorldHero accent={accent} reduce={reduce} />;

    case 'celebrate':
      return (
        <div className="relative w-64 h-64 flex items-center justify-center">
          {!reduce &&
            Array.from({ length: 22 }).map((_, i) => {
              const ang = (i / 22) * Math.PI * 2;
              const dist = 110 + (i % 3) * 16;
              const colors = ['#F97316', '#FB923C', '#FBBF24', '#EA580C', '#FDBA74'];
              return (
                <motion.div
                  key={i}
                  className="absolute rounded-sm"
                  style={{ width: 8, height: 8, background: colors[i % colors.length] }}
                  initial={{ x: 0, y: 0, opacity: 0, rotate: 0 }}
                  animate={{ x: Math.cos(ang) * dist, y: Math.sin(ang) * dist, opacity: [0, 1, 0], rotate: 220 }}
                  transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.08, ease: 'easeOut' }}
                />
              );
            })}
          <Halo accent={accent} reduce={reduce} />
          <Float reduce={reduce}>
            <IconBadge Icon={Globe} accent={accent} />
          </Float>
          {/* orbiting pins */}
          {!reduce && [0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute"
              style={{ width: 240, height: 240 }}
              animate={{ rotate: 360 }}
              transition={{ duration: 14 + i * 6, repeat: Infinity, ease: 'linear' }}
            >
              <div
                className="absolute rounded-full flex items-center justify-center"
                style={{ width: 30, height: 30, top: i * 8, left: '50%', marginLeft: -15, ...glass(8, 0.8), boxShadow: '0 6px 16px rgba(0,0,0,0.12)' }}
              >
                <MapPin className="w-4 h-4" style={{ color: accent }} />
              </div>
            </motion.div>
          ))}
        </div>
      );

    case 'events':
      return (
        <div className="relative w-64 h-64">
          {/* dropping pins */}
          {[{ x: 30, y: 40 }, { x: 130, y: 70 }, { x: 90, y: 150 }].map((p, i) => (
            <motion.div
              key={i}
              className="absolute"
              style={{ left: p.x, top: p.y }}
              initial={{ y: -40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ ...spring, delay: 0.2 + i * 0.25 }}
            >
              <div className="relative flex items-center justify-center w-11 h-11 rounded-full" style={{ background: BRAND_GRADIENT, boxShadow: `0 8px 18px ${accent}66` }}>
                <MapPin className="w-5 h-5 text-white" />
                {!reduce && (
                  <motion.span className="absolute inset-0 rounded-full" style={{ border: `2px solid ${accent}` }}
                    animate={{ scale: [1, 2], opacity: [0.6, 0] }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }} />
                )}
              </div>
            </motion.div>
          ))}
          {/* floating glass event cards */}
          {[{ t: '🎉 מסיבה הערב', x: 8, y: 8 }, { t: '🏕️ טרק בבוקר', x: 96, y: 196 }].map((c, i) => (
            <Float key={i} reduce={reduce} delay={i * 0.8}>
              <motion.div {...cardEnter(0.4 + i * 0.2)} className="absolute rounded-2xl px-3.5 py-2.5 flex items-center gap-2"
                style={{ left: c.x, top: c.y, ...glass(14, 0.6), boxShadow: '0 12px 28px rgba(0,0,0,0.12)' }}>
                <span className="text-[15px] font-bold whitespace-nowrap" style={{ fontFamily: 'Heebo, sans-serif', color: '#1C1C1E' }}>{c.t}</span>
              </motion.div>
            </Float>
          ))}
        </div>
      );

    case 'social': {
      const avatars = [
        { e: '🧑‍🦱', x: 18, y: 30 }, { e: '👩', x: 168, y: 28 },
        { e: '🧔', x: 12, y: 168 }, { e: '👱‍♀️', x: 176, y: 172 },
      ];
      return (
        <div className="relative w-64 h-64">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 256 256">
            {avatars.map((a, i) => (
              <motion.line key={i} x1={128} y1={128} x2={a.x + 26} y2={a.y + 26}
                stroke={accent} strokeWidth={2} strokeDasharray="4 5"
                initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.5 }}
                transition={{ duration: 0.8, delay: 0.5 + i * 0.15 }} />
            ))}
          </svg>
          {avatars.map((a, i) => (
            <Float key={i} reduce={reduce} delay={i * 0.5}>
              <motion.div {...cardEnter(0.3 + i * 0.15)} className="absolute w-14 h-14 rounded-full flex items-center justify-center text-2xl"
                style={{ left: a.x, top: a.y, ...glass(10, 0.72), boxShadow: '0 10px 22px rgba(0,0,0,0.14)' }}>
                {a.e}
              </motion.div>
            </Float>
          ))}
          {/* central you */}
          <motion.div {...cardEnter(0.2)} className="absolute left-1/2 top-1/2 w-[72px] h-[72px] -ml-9 -mt-9 rounded-full flex items-center justify-center"
            style={{ background: BRAND_GRADIENT, boxShadow: `0 14px 30px ${accent}66, inset 0 2px 4px rgba(255,255,255,0.35)` }}>
            <Users className="w-8 h-8 text-white" />
          </motion.div>
        </div>
      );
    }

    case 'chat':
      /* Slide 4 — the REAL app message bubbles (MessageBubble = the exact iMessage
         frame used in the chats), with the app's real colors. */
      return (
        <div className="relative w-72 flex flex-col gap-2 px-1" dir="rtl">
          {[
            { mine: false, t: 'מישהו ב-Koh Phangan? 🌴', d: 0.2 },
            { mine: true, t: 'כן! מסיבת Full Moon הערב 🔥', d: 0.65 },
            { mine: false, t: 'מצטרף! איפה נפגשים?', d: 1.1 },
          ].map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: m.mine ? 26 : -26, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ ...spring, delay: m.d }}
              style={{ display: 'flex', justifyContent: m.mine ? 'flex-end' : 'flex-start' }}
            >
              <div style={{ maxWidth: '82%' }}>
                {/* mirrors ChatScreen: MessageBubble mine={!mine}, orange for me / white for others */}
                <MessageBubble mine={!m.mine} color={m.mine ? '#FFD4A8' : '#FFFFFF'} contentStyle={{ padding: '7px 13px' }}>
                  <p dir="rtl" style={{ fontSize: 14, lineHeight: 1.4, margin: 0, fontWeight: 600, wordBreak: 'break-word', color: m.mine ? '#7C3400' : '#111111', fontFamily: 'Rubik, sans-serif' }}>
                    {m.t}
                  </p>
                </MessageBubble>
              </div>
            </motion.div>
          ))}

          {/* real-style typing indicator (translucent dots, increasing size) */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}
            style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 6, paddingInlineStart: 10, marginTop: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              {[4, 5, 6].map((sz, d) => (
                <motion.span key={d} style={{ width: sz, height: sz, borderRadius: '50%', background: 'rgba(0,0,0,0.3)' }}
                  animate={reduce ? {} : { y: [0, -4, 0] }} transition={{ duration: 1.2, repeat: Infinity, delay: d * 0.16, ease: 'easeInOut' }} />
              ))}
            </div>
            <span dir="rtl" style={{ fontSize: 12.5, fontWeight: 500, color: 'rgba(0,0,0,0.6)', fontFamily: 'Rubik, sans-serif' }}>אורי מקליד/ה</span>
          </motion.div>
        </div>
      );

    case 'create':
      return (
        <div className="relative w-64 h-64 flex items-center justify-center">
          <Halo accent={accent} reduce={reduce} />
          {/* expanding glass event card behind */}
          <motion.div initial={{ opacity: 0, y: 30, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ ...spring, delay: 0.5 }}
            className="absolute rounded-3xl p-4 w-52" style={{ ...glass(16, 0.62), boxShadow: '0 18px 40px rgba(0,0,0,0.14)' }}>
            <div className="h-20 rounded-2xl mb-3" style={{ background: 'linear-gradient(135deg,#FFEDD5,#FED7AA)' }} />
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4" style={{ color: accent }} />
              <div className="h-3 w-24 rounded-full" style={{ background: 'rgba(0,0,0,0.12)' }} />
            </div>
            <div className="h-3 w-36 rounded-full" style={{ background: 'rgba(0,0,0,0.07)' }} />
          </motion.div>
          {/* floating + button */}
          <Float reduce={reduce}>
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...spring, delay: 0.2 }}
              className="relative z-10 w-20 h-20 rounded-full flex items-center justify-center -mt-24"
              style={{ background: BRAND_GRADIENT, boxShadow: `0 16px 36px ${accent}77, inset 0 2px 4px rgba(255,255,255,0.35)` }}>
              <Plus className="w-10 h-10 text-white" strokeWidth={2.4} />
              {!reduce && (
                <motion.span className="absolute inset-0 rounded-full" style={{ border: `3px solid ${accent}` }}
                  animate={{ scale: [1, 1.7], opacity: [0.7, 0] }} transition={{ duration: 1.8, repeat: Infinity }} />
              )}
            </motion.div>
          </Float>
        </div>
      );

    case 'community':
      return (
        <div className="relative w-72 h-64">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 288 256">
            {/* animated travel routes */}
            {[[40, 80, 150, 60], [150, 60, 250, 120], [40, 80, 130, 190], [250, 120, 150, 200]].map((r, i) => (
              <motion.path key={i} d={`M${r[0]},${r[1]} Q${(r[0] + r[2]) / 2},${Math.min(r[1], r[3]) - 40} ${r[2]},${r[3]}`}
                fill="none" stroke={accent} strokeWidth={2} strokeDasharray="5 6" strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.55 }}
                transition={{ duration: 1.1, delay: 0.3 + i * 0.2 }} />
            ))}
            {[[40, 80], [150, 60], [250, 120], [130, 190], [150, 200]].map((p, i) => (
              <g key={i}>
                {!reduce && (
                  <motion.circle cx={p[0]} cy={p[1]} r={5} fill={accent}
                    animate={{ r: [5, 14], opacity: [0.5, 0] }} transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.3 }} />
                )}
                <circle cx={p[0]} cy={p[1]} r={5} fill={accent} />
                <circle cx={p[0]} cy={p[1]} r={2} fill="white" />
              </g>
            ))}
          </svg>
          <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...spring, delay: 0.4 }}
            className="absolute left-1/2 top-1/2 -ml-8 -mt-8 w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: BRAND_GRADIENT, boxShadow: `0 14px 30px ${accent}66, inset 0 2px 4px rgba(255,255,255,0.35)` }}>
            <Globe className="w-8 h-8 text-white" />
          </motion.div>
        </div>
      );
  }
}

/* Premium primary button — spring press, glass sheen, haptic. */
function PrimaryButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <motion.button
      onClick={() => { haptic(12); onClick(); }}
      whileTap={{ scale: 0.97 }}
      className="relative w-full h-14 text-white rounded-2xl font-black flex items-center justify-center gap-2 overflow-hidden"
      style={{ fontFamily: 'Heebo, sans-serif', background: BRAND_GRADIENT, boxShadow: `0 14px 34px ${BRAND}66, inset 0 1px 0 rgba(255,255,255,0.4)` }}
    >
      <span className="relative z-10 flex items-center gap-2">{children}</span>
      {/* moving sheen */}
      <motion.span
        aria-hidden
        className="absolute top-0 bottom-0 w-1/3"
        style={{ background: 'linear-gradient(100deg, transparent, rgba(255,255,255,0.45), transparent)' }}
        animate={{ x: ['-160%', '260%'] }}
        transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 1.4, ease: 'easeInOut' }}
      />
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
    <div className="fixed inset-0 flex flex-col overflow-hidden" dir="rtl" style={{ background: '#FFF7ED' }}>
      <AmbientBackground accent={slide.accent} reduce={reduce} />

      {/* ── Top bar: glass progress + skip ── */}
      <div className="relative z-10 px-6" style={{ paddingTop: 'max(18px, env(safe-area-inset-top))' }}>
        <div className="flex items-center gap-3 pt-2">
          <div className="flex-1 flex gap-1.5">
            {SLIDES.map((_, i) => (
              <div key={i} className="h-1.5 flex-1 rounded-full overflow-hidden" style={{ ...glass(6, 0.4) }}>
                <motion.div className="h-full rounded-full" style={{ background: BRAND_GRADIENT }}
                  initial={false} animate={{ width: i <= index ? '100%' : '0%' }}
                  transition={{ duration: i === index ? 0.5 : 0.25, ease: 'easeOut' }} />
              </div>
            ))}
          </div>
          {!isFinal && (
            <motion.button whileTap={{ scale: 0.94 }} onClick={() => { haptic(6); onComplete(); }} aria-label="דלג"
              className="text-[13px] font-bold rounded-full px-3 py-1"
              style={{ color: BRAND_DARK, ...glass(10, 0.5), fontFamily: 'Heebo, sans-serif' }}>
              דלג
            </motion.button>
          )}
        </div>
      </div>

      {/* ── Slides ── */}
      <div className="relative z-10 flex-1 flex items-stretch">
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div
            key={index}
            custom={dir}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={spring}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={(_, info) => {
              if (info.offset.x < -60) paginate(1);
              else if (info.offset.x > 60) paginate(-1);
            }}
            className="w-full flex flex-col items-center justify-center px-6 cursor-grab active:cursor-grabbing"
          >
            {slide.showLogo && (
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.05 }}
                className="mb-5"
              >
                <FomoWordmark reduce={reduce} />
              </motion.div>
            )}

            {/* Hero illustration floats above the frosted card */}
            <div className="flex items-center justify-center" style={{ minHeight: 260 }}>
              <Illustration kind={slide.illustration} accent={slide.accent} reduce={reduce} />
            </div>

            {/* Frosted glass content card holding the (unchanged) text */}
            <motion.div
              initial={{ opacity: 0, y: 22, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ ...spring, delay: 0.12 }}
              className="w-full max-w-sm rounded-[30px] px-6 py-6 mt-4 text-center"
              style={{ ...glass(30, 0.5), boxShadow: `0 24px 60px ${slide.accent}22, inset 0 1px 0 rgba(255,255,255,0.9)` }}
            >
              <motion.h2
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.2 }}
                className="text-[26px] font-black leading-tight"
                style={{ fontFamily: 'Heebo, sans-serif', color: '#1C1C1E' }}
              >
                {slide.title}
              </motion.h2>

              {slide.subtitle && (
                <motion.p
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.28 }}
                  className="text-[15px] font-bold mt-2"
                  style={{ fontFamily: 'Heebo, sans-serif', color: slide.accent }}
                >
                  {slide.subtitle}
                </motion.p>
              )}

              <motion.p
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.34 }}
                className="text-[15px] leading-relaxed mt-3"
                style={{ fontFamily: 'Rubik, sans-serif', color: '#52525B' }}
              >
                {slide.body}
              </motion.p>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Bottom actions ── */}
      <div className="relative z-10 px-6 pt-3" style={{ paddingBottom: 'max(22px, env(safe-area-inset-bottom))' }}>
        {isFinal ? (
          <div className="space-y-3">
            <PrimaryButton onClick={onComplete}>
              <Sparkles className="w-5 h-5" />
              <span>התחל עכשיו</span>
            </PrimaryButton>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => { haptic(6); (onLogin || onComplete)(); }}
              className="w-full h-12 rounded-2xl font-bold"
              style={{ fontFamily: 'Heebo, sans-serif', color: BRAND_DARK, ...glass(14, 0.5) }}
            >
              כבר יש לי חשבון
            </motion.button>
          </div>
        ) : (
          <PrimaryButton onClick={() => paginate(1)}>
            <span>{index === 0 ? 'בואו נתחיל' : 'המשך'}</span>
            <ArrowLeft className="w-5 h-5" />
          </PrimaryButton>
        )}
      </div>
    </div>
  );
}
