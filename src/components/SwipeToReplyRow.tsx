import { useRef, type ReactNode, type CSSProperties } from 'react';
import { Reply } from 'lucide-react';

/* WhatsApp-style swipe-to-reply.
   Wrap a message row: drag it horizontally toward the center and, past a
   threshold, it fires onReply(). The bubble tracks the finger (GPU transform,
   no re-render) and springs back on release; a reply icon fades in in the
   revealed gap. Direction is fixed by `align` so the bubble only ever slides
   INWARD (mine → left, other → right) — matching WhatsApp and never pushing a
   bubble off the edge. `touch-action: pan-y` lets vertical scrolling pass
   through untouched while horizontal drags come to us. */

const TRIGGER = 52;  // px of inward travel needed to fire a reply
const MAX = 82;      // px the bubble is allowed to travel
const DECIDE = 8;    // px before we commit the gesture to horizontal vs vertical

// The align of the row the finger is currently on (set at touchstart, cleared at touchend). The
// window-level swipe-back reads this to bail out for a "mine" (end) bubble WITHOUT a DOM lookup —
// deterministic even if the touch target / closest() behaves oddly on the WebView.
let touchedRowAlign: 'start' | 'end' | null = null;
export const getTouchedRowAlign = () => touchedRowAlign;

export function SwipeToReplyRow({
  onReply,
  align,
  style,
  children,
}: {
  onReply: () => void;
  align: 'start' | 'end'; // 'end' = my bubble (right), 'start' = other (left)
  style?: CSSProperties;  // merged into the outer wrapper (e.g. minWidth:0 for a flex child)
  children: ReactNode;
}) {
  const slideRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);
  const st = useRef({ x0: 0, y0: 0, dir: '' as '' | 'h' | 'v', d: 0 });
  // ALL bubbles swipe the SAME way — to the RIGHT (WhatsApp-style). This also sidesteps the edge
  // swipe-back completely: that only fires on a LEFT drag from the right edge, so a right-swipe on a
  // "mine" bubble can never trigger it.
  const dirSign = 1;

  const setIcon = (p: number) => {
    const el = iconRef.current;
    if (!el) return;
    el.style.opacity = String(Math.min(1, p));
    el.style.transform = `scale(${0.55 + 0.45 * Math.min(1, p)})`;
  };

  const onStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    st.current = { x0: t.clientX, y0: t.clientY, dir: '', d: 0 };
    touchedRowAlign = align; // tell the swipe-back this touch began on a message bubble
  };

  const onMove = (e: React.TouchEvent) => {
    const s = st.current;
    const t = e.touches[0];
    const rawdx = t.clientX - s.x0;
    const dy = t.clientY - s.y0;

    if (s.dir === '') {
      if (Math.abs(rawdx) > DECIDE && Math.abs(rawdx) > Math.abs(dy)) s.dir = 'h';
      else if (Math.abs(dy) > DECIDE) s.dir = 'v';
      else return;
    }
    if (s.dir !== 'h') return; // vertical → let the list scroll

    // We own this horizontal gesture — stop it bubbling to the window-level swipe-back handler,
    // which would otherwise slide the WHOLE chat sideways (its edge-swipe overlaps a right-aligned
    // "mine" bubble swiped left).
    e.stopPropagation();

    let d = rawdx * dirSign;           // travel in the allowed inward direction
    if (d < 0) d = 0;                  // ignore wrong-way drags
    if (d > MAX) d = MAX + (d - MAX) * 0.18; // rubber-band past the cap
    s.d = d;

    if (slideRef.current) {
      slideRef.current.style.transition = 'none';
      slideRef.current.style.transform = `translateX(${d * dirSign}px)`;
    }
    setIcon(d / TRIGGER);
  };

  const onEnd = () => {
    touchedRowAlign = null;
    const s = st.current;
    const fired = s.dir === 'h' && s.d >= TRIGGER;
    if (slideRef.current) {
      slideRef.current.style.transition = 'transform 190ms cubic-bezier(0.22,1,0.36,1)';
      slideRef.current.style.transform = 'translateX(0)';
    }
    if (iconRef.current) {
      iconRef.current.style.transition = 'opacity 160ms ease';
      iconRef.current.style.opacity = '0';
    }
    s.dir = '';
    s.d = 0;
    if (fired) {
      try { navigator.vibrate?.(12); } catch { /* not supported */ }
      onReply();
    }
  };

  return (
    <div
      data-swipe-reply={align}
      style={{ position: 'relative', touchAction: 'pan-y', ...style }}
      onTouchStart={onStart}
      onTouchMove={onMove}
      onTouchEnd={onEnd}
      onTouchCancel={onEnd}
    >
      {/* Reply icon revealed in the gap the sliding bubble opens up */}
      <div
        ref={iconRef}
        style={{
          position: 'absolute', top: '50%', marginTop: -15,
          left: 14, right: 'auto',
          width: 30, height: 30, borderRadius: '50%',
          background: 'rgba(234,88,12,0.16)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: 0, pointerEvents: 'none', zIndex: 0,
        }}
      >
        <Reply size={16} style={{ color: '#EA580C' }} />
      </div>
      <div ref={slideRef} style={{ position: 'relative', zIndex: 1, willChange: 'transform' }}>
        {children}
      </div>
    </div>
  );
}
