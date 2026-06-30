import { useEffect, useId, useState, type ReactNode } from 'react';

/**
 * Pixel-perfect Apple iMessage IMAGE bubble, reproduced from the source SVG.
 * The photo is clipped with the EXACT outline path from the SVG (a 16-radius
 * rounded rectangle with a fixed bottom tail) — not borderRadius. Only the
 * straight edges stretch with the image size; the corners and the tail keep
 * their exact geometry regardless of width/height.
 *
 * tailLeft = true  → tail on the bottom-left  (received / incoming, as in the SVG)
 * tailLeft = false → mirrored, tail on the bottom-right (outgoing)
 */

const TAIL = 5.5; // horizontal overshoot of the tail beyond the bubble body

// Tail on the bottom-LEFT. Body occupies (0,0)→(W,H); tail extends to x = -5.5.
function clipLeft(W: number, H: number): string {
  return [
    'M16 0',
    'C6.6634 0 0 7.1634 0 16',
    `V${H - 11.5}`,
    `C0 ${H - 10.5} 0 ${H - 8.5} -0.5 ${H - 5.5}`,
    `C-1.0014 ${H - 2.491} -3.8333 ${H + 0.333} -5.5 ${H + 1}`,
    `C0.9 ${H + 1} 5 ${H - 1.167} 6 ${H - 2.5}`,
    `L9.0457 ${H - 1.586}`,
    `C11.1486 ${H - 0.57} 13.5078 ${H} 16 ${H}`,
    `H${W - 16}`,
    `C${W - 7.163} ${H} ${W} ${H - 7.163} ${W} ${H - 16}`,
    'V16',
    `C${W} 7.1634 ${W - 7.163} 0 ${W - 16} 0`,
    'Z',
  ].join(' ');
}

// No tail — a plain rounded rectangle (grouped messages, not last of a run).
function roundedRect(W: number, H: number): string {
  return [
    'M16 0',
    'C6.6634 0 0 7.1634 0 16',
    `V${H - 16}`,
    `C0 ${H - 7.163} 7.163 ${H} 16 ${H}`,
    `H${W - 16}`,
    `C${W - 7.163} ${H} ${W} ${H - 7.163} ${W} ${H - 16}`,
    'V16',
    `C${W} 7.1634 ${W - 7.163} 0 ${W - 16} 0`,
    'Z',
  ].join(' ');
}

// Mirror of the above — tail on the bottom-RIGHT. Tail extends to x = W + 5.5.
function clipRight(W: number, H: number): string {
  return [
    `M${W - 16} 0`,
    `C${W - 6.6634} 0 ${W} 7.1634 ${W} 16`,
    `V${H - 11.5}`,
    `C${W} ${H - 10.5} ${W} ${H - 8.5} ${W + 0.5} ${H - 5.5}`,
    `C${W + 1.0014} ${H - 2.491} ${W + 3.8333} ${H + 0.333} ${W + 5.5} ${H + 1}`,
    `C${W - 0.9} ${H + 1} ${W - 5} ${H - 1.167} ${W - 6} ${H - 2.5}`,
    `L${W - 9.0457} ${H - 1.586}`,
    `C${W - 11.1486} ${H - 0.57} ${W - 13.5078} ${H} ${W - 16} ${H}`,
    'H16',
    `C7.163 ${H} 0 ${H - 7.163} 0 ${H - 16}`,
    'V16',
    'C0 7.1634 7.163 0 16 0',
    'Z',
  ].join(' ');
}

type Props = {
  src: string;
  tailLeft: boolean;
  /** When false, render a plain rounded bubble with no tail (grouped messages). */
  tail?: boolean;
  /** Optional footer overlaid at the bottom of the image (e.g. a location name). */
  caption?: ReactNode;
  /** Max bubble width; height follows the image aspect ratio (capped by maxH). */
  maxW?: number;
  maxH?: number;
  onClick?: () => void;
};

export function ImageBubble({ src, tailLeft, tail = true, caption, maxW = 220, maxH = 300, onClick }: Props) {
  const clipId = useId();
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const ar = img.naturalWidth / img.naturalHeight || 1;
      let w = maxW;
      let h = w / ar;
      if (h > maxH) { h = maxH; w = h * ar; }
      setDims({ w: Math.round(w), h: Math.round(h) });
    };
    img.src = src;
    return () => { cancelled = true; };
  }, [src, maxW, maxH]);

  // Placeholder box (keeps layout stable) until the image dimensions are known.
  if (!dims) {
    return <div style={{ width: maxW, height: Math.round(maxW * 0.75), borderRadius: 16, background: '#E5E5EA' }} />;
  }

  const { w, h } = dims;
  const svgW = tail ? w + TAIL : w;
  const svgH = h + 2;
  const d = !tail ? roundedRect(w, h) : (tailLeft ? clipLeft(w, h) : clipRight(w, h));
  // Only the left-tail variant overshoots to the left, so shift its body right.
  const pathShift = tail && tailLeft ? `translate(${TAIL},0)` : undefined;

  return (
    <div style={{ position: 'relative', display: 'inline-block', lineHeight: 0 }} onClick={onClick}>
      <svg
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        style={{ display: 'block', overflow: 'visible', filter: 'drop-shadow(0 1px 1.5px rgba(0,0,0,0.18))', cursor: onClick ? 'pointer' : 'default' }}
      >
        <defs>
          <clipPath id={clipId}>
            <path d={d} transform={pathShift} />
          </clipPath>
        </defs>
        <image
          href={src}
          x={0}
          y={0}
          width={svgW}
          height={h}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${clipId})`}
        />
      </svg>
      {caption != null && (
        <div
          style={{
            position: 'absolute',
            bottom: 1,
            left: tailLeft && tail ? TAIL : 0,
            width: w,
            boxSizing: 'border-box',
            padding: '16px 12px 8px',
            background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.18) 55%, rgba(0,0,0,0) 100%)',
            borderRadius: '0 0 16px 16px',
            pointerEvents: 'none',
          }}
        >
          {caption}
        </div>
      )}
    </div>
  );
}
