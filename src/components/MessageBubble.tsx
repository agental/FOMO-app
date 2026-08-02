import { memo, useLayoutEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';

/**
 * Pixel-perfect Apple iMessage bubble, reproduced from the source SVG as a
 * SINGLE continuous vector path. The corner radius (16), the right-side cap and
 * the tail Bézier geometry are taken verbatim from the SVG; only the straight
 * top / bottom / left edges stretch with the message size. The tail keeps its
 * exact shape regardless of bubble width or height.
 *
 * Outgoing (mine) → tail on the bottom-right (as in the source SVG).
 * Incoming        → the same path mirrored horizontally (tail bottom-left).
 */

const TAIL = 5.5; // horizontal overshoot of the tail beyond the bubble body

// Builds the exact outline for a body of W×H. Tail anchored to the bottom-right.
function bubblePath(W: number, H: number): string {
  return [
    'M16 0',
    `H${W - 16}`,
    `A16 16 0 0 1 ${W} 16`,
    `V${H - 12.5}`,
    `C${W} ${H - 11.5} ${W} ${H - 9.5} ${W + 0.5} ${H - 6.5}`,
    `C${W + 1.001} ${H - 3.4914} ${W + 3.833} ${H - 0.6667} ${W + TAIL} ${H}`,
    `C${W - 0.9} ${H} ${W - 5} ${H - 2.1667} ${W - 6} ${H - 3.5}`,
    `A16 16 0 0 1 ${W - 16} ${H}`,
    'H16',
    `A16 16 0 0 1 0 ${H - 16}`,
    'V16',
    'A16 16 0 0 1 16 0',
    'Z',
  ].join(' ');
}

// Same body, no tail — a plain rounded rectangle (for grouped messages).
function roundedRectPath(W: number, H: number): string {
  return [
    'M16 0',
    `H${W - 16}`,
    `A16 16 0 0 1 ${W} 16`,
    `V${H - 16}`,
    `A16 16 0 0 1 ${W - 16} ${H}`,
    'H16',
    `A16 16 0 0 1 0 ${H - 16}`,
    'V16',
    'A16 16 0 0 1 16 0',
    'Z',
  ].join(' ');
}

type Props = {
  mine: boolean;
  color: string;
  children: ReactNode;
  /** When false, render a plain rounded bubble with no tail (grouped messages). */
  tail?: boolean;
  /** Applied to the inner content box (padding etc.). */
  contentStyle?: CSSProperties;
};

export const MessageBubble = memo(function MessageBubble({ mine, color, children, tail = true, contentStyle }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { w, h } = size;
  const svgW = tail ? w + TAIL + 1 : w;

  return (
    <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
      {w > 0 && (
        <svg
          width={svgW}
          height={h}
          viewBox={`0 0 ${svgW} ${h}`}
          style={{
            position: 'absolute',
            top: 0,
            left: tail && !mine ? -TAIL : 0,
            zIndex: 0,
            overflow: 'visible',
            filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.15))',
          }}
          aria-hidden="true"
        >
          <path
            d={tail ? bubblePath(w, h) : roundedRectPath(w, h)}
            fill={color}
            transform={tail && !mine ? `translate(${w + TAIL},0) scale(-1,1)` : undefined}
          />
        </svg>
      )}
      <div ref={contentRef} style={{ position: 'relative', zIndex: 1, ...contentStyle }}>
        {children}
      </div>
    </div>
  );
});
