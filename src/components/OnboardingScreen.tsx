import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion';
import { Globe, Users, MapPin, MessageCircle, Plus, Calendar, Sparkles, ArrowLeft } from 'lucide-react';

interface OnboardingScreenProps {
  onComplete: () => void;
  onLogin?: () => void;
}

/* ──────────────────────────────────────────────────────────────────────────
   Brand tokens — everything stays anchored in the FOMO warm-orange family so
   the experience feels alive but unmistakably on-brand.
   ────────────────────────────────────────────────────────────────────────── */
const BRAND = '#F97316';
const BRAND_DARK = '#EA580C';
const BRAND_GRADIENT = `linear-gradient(135deg, ${BRAND}, ${BRAND_DARK})`;

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

/* ──────────────────────────────────────────────────────────────────────────
   Ambient background — drifting aurora blobs + a dotted "map" with pulsing
   destination pins. Accent crossfades per slide for the dynamic-gradient feel.
   ────────────────────────────────────────────────────────────────────────── */
function AmbientBackground({ accent, reduce }: { accent: string; reduce: boolean | null }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {/* base wash */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #FFF7ED 60%, #FFEDD5 100%)' }} />

      {/* drifting aurora blobs */}
      <motion.div
        className="absolute rounded-full"
        style={{ width: 360, height: 360, top: '-8%', right: '-12%', background: accent, filter: 'blur(90px)', opacity: 0.22 }}
        animate={reduce ? {} : { x: [0, 30, 0], y: [0, 24, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute rounded-full"
        style={{ width: 300, height: 300, bottom: '4%', left: '-14%', background: '#FDBA74', filter: 'blur(90px)', opacity: 0.28 }}
        animate={reduce ? {} : { x: [0, -26, 0], y: [0, -20, 0], scale: [1, 1.12, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
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
    </div>
  );
}

/* Slide-in/out transition for whole slides (RTL-aware: forward moves leftward). */
const slideVariants: Variants = {
  enter: (dir: number) => ({ x: dir > 0 ? 70 : -70, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -70 : 70, opacity: 0 }),
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
      style={{ background: `linear-gradient(135deg, ${accent}, ${BRAND_DARK})`, boxShadow: `0 20px 50px ${accent}55` }}
    >
      <Icon className="w-16 h-16 text-white" strokeWidth={1.8} />
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
    case 'celebrate':
      return (
        <div className="relative w-64 h-64 flex items-center justify-center">
          {kind === 'celebrate' && !reduce &&
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
                style={{ width: 30, height: 30, top: i * 8, left: '50%', marginLeft: -15, background: 'white', boxShadow: '0 6px 16px rgba(0,0,0,0.12)' }}
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
          {/* floating event cards */}
          {[{ t: '🎉 מסיבה הערב', x: 8, y: 8 }, { t: '🏕️ טרק בבוקר', x: 96, y: 196 }].map((c, i) => (
            <Float key={i} reduce={reduce} delay={i * 0.8}>
              <motion.div {...cardEnter(0.4 + i * 0.2)} className="absolute bg-white rounded-2xl px-3.5 py-2.5 flex items-center gap-2"
                style={{ left: c.x, top: c.y, boxShadow: '0 12px 28px rgba(0,0,0,0.12)' }}>
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
              <motion.div {...cardEnter(0.3 + i * 0.15)} className="absolute w-14 h-14 rounded-full bg-white flex items-center justify-center text-2xl"
                style={{ left: a.x, top: a.y, boxShadow: '0 10px 22px rgba(0,0,0,0.14)' }}>
                {a.e}
              </motion.div>
            </Float>
          ))}
          {/* central you */}
          <motion.div {...cardEnter(0.2)} className="absolute left-1/2 top-1/2 w-[72px] h-[72px] -ml-9 -mt-9 rounded-full flex items-center justify-center"
            style={{ background: BRAND_GRADIENT, boxShadow: `0 14px 30px ${accent}66` }}>
            <Users className="w-8 h-8 text-white" />
          </motion.div>
        </div>
      );
    }

    case 'chat':
      return (
        <div className="relative w-64 h-64 flex flex-col justify-center gap-3 px-2">
          {[
            { me: false, t: 'מישהו ב-Koh Phangan? 🌴', d: 0.2 },
            { me: true, t: 'כן! מסיבת Full Moon הערב 🔥', d: 0.7 },
            { me: false, t: 'מצטרף! איפה נפגשים?', d: 1.2 },
          ].map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: m.me ? 30 : -30, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ ...spring, delay: m.d }} className="flex" style={{ justifyContent: m.me ? 'flex-start' : 'flex-end' }}>
              <div className="px-4 py-2.5 max-w-[78%] text-[14px] font-semibold" style={{
                fontFamily: 'Rubik, sans-serif',
                background: m.me ? BRAND_GRADIENT : 'white',
                color: m.me ? 'white' : '#1C1C1E',
                borderRadius: m.me ? '18px 18px 18px 6px' : '18px 18px 6px 18px',
                boxShadow: '0 6px 16px rgba(0,0,0,0.10)',
              }}>{m.t}</div>
            </motion.div>
          ))}
          {/* typing indicator */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.7 }}
            className="flex self-end items-center gap-1 bg-white px-3 py-2.5 rounded-full" style={{ boxShadow: '0 6px 16px rgba(0,0,0,0.10)' }}>
            {[0, 1, 2].map((d) => (
              <motion.span key={d} className="w-2 h-2 rounded-full" style={{ background: accent }}
                animate={reduce ? {} : { y: [0, -5, 0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15 }} />
            ))}
          </motion.div>
          {/* notification pop */}
          <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...spring, delay: 2 }}
            className="absolute top-1 left-3 flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-full" style={{ boxShadow: '0 8px 20px rgba(0,0,0,0.14)' }}>
            <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: BRAND_GRADIENT }}>
              <MessageCircle className="w-3 h-3 text-white" />
            </span>
            <span className="text-[12px] font-black" style={{ color: accent, fontFamily: 'Heebo, sans-serif' }}>3 חדשות</span>
          </motion.div>
        </div>
      );

    case 'create':
      return (
        <div className="relative w-64 h-64 flex items-center justify-center">
          <Halo accent={accent} reduce={reduce} />
          {/* expanding event card behind */}
          <motion.div initial={{ opacity: 0, y: 30, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ ...spring, delay: 0.5 }}
            className="absolute bg-white rounded-3xl p-4 w-52" style={{ boxShadow: '0 18px 40px rgba(0,0,0,0.14)' }}>
            <div className="h-20 rounded-2xl mb-3" style={{ background: 'linear-gradient(135deg,#FFEDD5,#FED7AA)' }} />
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4" style={{ color: accent }} />
              <div className="h-3 w-24 rounded-full bg-gray-200" />
            </div>
            <div className="h-3 w-36 rounded-full bg-gray-100" />
          </motion.div>
          {/* floating + button */}
          <Float reduce={reduce}>
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...spring, delay: 0.2 }}
              className="relative z-10 w-20 h-20 rounded-full flex items-center justify-center -mt-24"
              style={{ background: BRAND_GRADIENT, boxShadow: `0 16px 36px ${accent}77` }}>
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
            style={{ background: BRAND_GRADIENT, boxShadow: `0 14px 30px ${accent}66` }}>
            <Globe className="w-8 h-8 text-white" />
          </motion.div>
        </div>
      );
  }
}

/* Premium primary button — spring press, glow, haptic. */
function PrimaryButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <motion.button
      onClick={() => { haptic(12); onClick(); }}
      whileTap={{ scale: 0.97 }}
      className="w-full h-14 text-white rounded-2xl font-black flex items-center justify-center gap-2"
      style={{ fontFamily: 'Heebo, sans-serif', background: BRAND_GRADIENT, boxShadow: `0 12px 30px ${BRAND}66` }}
    >
      {children}
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

      {/* ── Top bar: progress + skip ── */}
      <div className="relative z-10 px-6" style={{ paddingTop: 'max(18px, env(safe-area-inset-top))' }}>
        <div className="flex items-center gap-3 pt-2">
          <div className="flex-1 flex gap-1.5">
            {SLIDES.map((_, i) => (
              <div key={i} className="h-1.5 flex-1 rounded-full overflow-hidden" style={{ background: 'rgba(234,88,12,0.15)' }}>
                <motion.div className="h-full rounded-full" style={{ background: BRAND_GRADIENT }}
                  initial={false} animate={{ width: i <= index ? '100%' : '0%' }}
                  transition={{ duration: i === index ? 0.5 : 0.25, ease: 'easeOut' }} />
              </div>
            ))}
          </div>
          {!isFinal && (
            <button onClick={() => { haptic(6); onComplete(); }} aria-label="דלג"
              className="text-[13px] font-bold px-2 py-1 active:opacity-60 transition-opacity"
              style={{ color: 'rgba(124,45,18,0.55)', fontFamily: 'Heebo, sans-serif' }}>
              דלג
            </button>
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
            className="w-full flex flex-col items-center justify-center px-8 cursor-grab active:cursor-grabbing"
          >
            {slide.showLogo && (
              <motion.h1
                initial={{ opacity: 0, scale: 0.8, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ ...spring, delay: 0.1 }}
                className="text-3xl font-black mb-6"
                style={{ fontFamily: 'Righteous, cursive', letterSpacing: '0.2em', background: BRAND_GRADIENT, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
              >
                FOMO
              </motion.h1>
            )}

            <div className="flex items-center justify-center" style={{ minHeight: 260 }}>
              <Illustration kind={slide.illustration} accent={slide.accent} reduce={reduce} />
            </div>

            <motion.h2
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.18 }}
              className="text-[27px] font-black text-center leading-tight mt-6"
              style={{ fontFamily: 'Heebo, sans-serif', color: '#1C1C1E' }}
            >
              {slide.title}
            </motion.h2>

            {slide.subtitle && (
              <motion.p
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.26 }}
                className="text-[15px] font-bold text-center mt-2"
                style={{ fontFamily: 'Heebo, sans-serif', color: slide.accent }}
              >
                {slide.subtitle}
              </motion.p>
            )}

            <motion.p
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.32 }}
              className="text-[15.5px] text-center leading-relaxed mt-3 max-w-sm"
              style={{ fontFamily: 'Rubik, sans-serif', color: '#52525B' }}
            >
              {slide.body}
            </motion.p>
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
            <button
              onClick={() => { haptic(6); (onLogin || onComplete)(); }}
              className="w-full h-12 rounded-2xl font-bold active:scale-[0.98] transition-transform"
              style={{ fontFamily: 'Heebo, sans-serif', color: BRAND_DARK, background: 'rgba(249,115,22,0.10)' }}
            >
              כבר יש לי חשבון
            </button>
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
