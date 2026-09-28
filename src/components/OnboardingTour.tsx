import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronUp, X } from 'lucide-react';

/**
 * First-run coach-mark tour. Draws a dark overlay with a rounded spotlight "hole" around a real UI
 * element (located by a data-tour="…" attribute), a bouncing arrow, and a tooltip card that explains it.
 * Steps without a `target` render centered (welcome / finish). Fully RTL, matches the app's orange theme.
 */
export interface TourStep {
  target?: string;   // CSS selector (e.g. '[data-tour="nav-map"]'); omit for a centered card
  emoji: string;
  title: string;
  body: string;
}

interface Props {
  steps: TourStep[];
  onFinish: () => void;   // called on the last "בוא נתחיל" or on skip
}

const PAD = 10;            // spotlight padding around the target (px)
const GAP = 16;            // gap between the spotlight and the tooltip
const CARD_W = 300;        // tooltip width
const MARGIN = 14;         // min viewport margin for the tooltip

type Rect = { top: number; left: number; width: number; height: number };

export function OnboardingTour({ steps, onFinish }: Props) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [ready, setReady] = useState(false);
  const seekingRef = useRef(false);
  const step = steps[i];
  const isLast = i === steps.length - 1;

  const measure = useCallback(() => {
    if (!step?.target) { setRect(null); setReady(true); return; }
    const el = document.querySelector(step.target) as HTMLElement | null;
    if (!el) {
      // Target not on screen (e.g. a conditional row) — skip this step gracefully.
      if (!seekingRef.current) {
        seekingRef.current = true;
        setI(prev => (prev < steps.length - 1 ? prev + 1 : prev));
      }
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    setReady(true);
  }, [step, steps.length]);

  // On each step: bring the target into view, then measure once layout settles.
  useLayoutEffect(() => {
    seekingRef.current = false;
    setReady(false);
    const el = step?.target ? (document.querySelector(step.target) as HTMLElement | null) : null;
    if (el) {
      try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch { /* older WebView */ }
    }
    const t = setTimeout(measure, el ? 360 : 30);
    return () => clearTimeout(t);
  }, [i, measure, step]);

  // Keep the spotlight glued if the page scrolls/resizes under it.
  useEffect(() => {
    const on = () => measure();
    window.addEventListener('resize', on);
    window.addEventListener('scroll', on, true);
    return () => { window.removeEventListener('resize', on); window.removeEventListener('scroll', on, true); };
  }, [measure]);

  const next = () => { if (i < steps.length - 1) setI(i + 1); else onFinish(); };
  const back = () => { if (i > 0) setI(i - 1); };

  const vw = typeof window !== 'undefined' ? window.innerWidth : 390;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 844;

  // Spotlight rect (padded). For a centered step it's a zero-size point off-screen → full dark.
  const sr: Rect = rect
    ? { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }
    : { top: vh / 2, left: vw / 2, width: 0, height: 0 };

  // Tooltip placement: below the target if it sits in the top half, otherwise above. Centered if no target.
  const centered = !rect;
  const below = rect ? rect.top + rect.height / 2 < vh * 0.5 : false;
  const targetCenterX = rect ? rect.left + rect.width / 2 : vw / 2;
  const cardLeft = Math.max(MARGIN, Math.min(targetCenterX - CARD_W / 2, vw - CARD_W - MARGIN));
  const cardTop = below ? sr.top + sr.height + GAP : undefined;
  const cardBottom = below ? undefined : vh - (sr.top - GAP);

  // Arrow x position (clamped inside the card), pointing at the target.
  const arrowX = Math.max(18, Math.min(targetCenterX - cardLeft, CARD_W - 18));

  return (
    <div
      className="fixed inset-0 z-[9000]"
      style={{ fontFamily: 'Heebo, sans-serif', pointerEvents: 'auto' }}
      role="dialog"
      aria-modal="true"
    >
      {/* Spotlight — the box-shadow paints the dim everywhere EXCEPT the hole; the rings glow the target. */}
      <motion.div
        className="absolute rounded-[18px]"
        initial={false}
        animate={{ top: sr.top, left: sr.left, width: sr.width, height: sr.height }}
        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
        style={{
          pointerEvents: 'none',
          boxShadow: centered
            ? '0 0 0 9999px rgba(9,11,20,0.80)'
            : '0 0 0 9999px rgba(9,11,20,0.74), inset 0 0 0 2px rgba(255,255,255,0.92), 0 0 0 3px rgba(249,115,22,0.9), 0 0 26px 4px rgba(249,115,22,0.5)',
        }}
      />

      {/* Pulsing ring for a bit of life (skipped for centered steps). */}
      {!centered && ready && (
        <motion.div
          className="absolute rounded-[20px] pointer-events-none"
          style={{ top: sr.top - 3, left: sr.left - 3, width: sr.width + 6, height: sr.height + 6, border: '2px solid rgba(249,115,22,0.55)' }}
          animate={{ opacity: [0.7, 0, 0.7], scale: [1, 1.06, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          initial={{ opacity: 0, y: below ? -10 : 10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ type: 'spring', damping: 26, stiffness: 300 }}
          className="absolute"
          style={
            centered
              ? { top: '50%', left: '50%', width: CARD_W }
              : { top: cardTop, bottom: cardBottom, left: cardLeft, width: CARD_W }
          }
        >
          {/* Inner wrapper owns the centering transform so it never fights framer-motion's animated
              transform (y/scale) on the parent — that clash was cropping the centered card off-screen. */}
          <div className="relative" style={centered ? { transform: 'translate(-50%,-50%)' } : undefined}>
          {/* Arrow pointing at the target (only for anchored steps) */}
          {!centered && (
            <motion.div
              className="absolute"
              style={below ? { top: -11, left: arrowX - 9 } : { bottom: -11, left: arrowX - 9 }}
              animate={{ y: below ? [0, -4, 0] : [0, 4, 0] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
            >
              <ChevronUp
                className="w-[22px] h-[22px]"
                style={{ color: '#F97316', transform: below ? 'none' : 'rotate(180deg)', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.25))' }}
                strokeWidth={3}
              />
            </motion.div>
          )}

          <div
            className="rounded-[20px] bg-white p-4 pt-3.5"
            style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.18)' }}
          >
            {/* Skip (X) top corner */}
            <button
              onClick={onFinish}
              aria-label="דלג על ההדרכה"
              className="absolute top-2 left-2 w-7 h-7 rounded-full flex items-center justify-center text-gray-400 active:scale-90 transition"
              style={{ background: '#F3F4F6' }}
            >
              <X className="w-4 h-4" strokeWidth={2.5} />
            </button>

            <div className="flex items-start gap-3">
              <div
                className="flex-shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center text-[22px]"
                style={{ background: 'linear-gradient(135deg,#FFF7ED,#FFEDD5)', boxShadow: 'inset 0 0 0 1px rgba(249,115,22,0.25)' }}
              >
                {step.emoji}
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <h3 className="text-[16px] font-black text-[#0B1220] leading-tight">{step.title}</h3>
              </div>
            </div>

            <p className="text-[13.5px] leading-[1.5] text-gray-600 mt-2.5 mb-3.5 font-medium">{step.body}</p>

            {/* Progress dots */}
            <div className="flex items-center justify-center gap-1.5 mb-3">
              {steps.map((_, idx) => (
                <span
                  key={idx}
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: idx === i ? 18 : 6,
                    height: 6,
                    background: idx === i ? '#F97316' : idx < i ? '#FDBA74' : '#E5E7EB',
                  }}
                />
              ))}
            </div>

            <div className="flex items-center justify-between gap-2">
              {i > 0 ? (
                <button
                  onClick={back}
                  className="flex items-center gap-0.5 text-[13px] font-bold text-gray-400 px-2 py-2 active:scale-95 transition"
                >
                  <ChevronLeft className="w-4 h-4" strokeWidth={2.5} />
                  חזור
                </button>
              ) : (
                <button onClick={onFinish} className="text-[13px] font-semibold text-gray-400 px-2 py-2 active:scale-95 transition">
                  דלג
                </button>
              )}

              <button
                onClick={next}
                className="flex-1 max-w-[160px] text-white text-[14px] font-black py-2.5 rounded-[13px] active:scale-[0.97] transition"
                style={{ background: 'linear-gradient(135deg,#F97316,#EA580C)', boxShadow: '0 4px 14px rgba(249,115,22,0.4)' }}
              >
                {isLast ? 'בוא נתחיל 🎉' : `הבא (${i + 1}/${steps.length})`}
              </button>
            </div>
          </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
