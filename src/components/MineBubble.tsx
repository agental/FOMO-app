import React, { useEffect, useRef } from 'react';

interface MineBubbleProps {
  noPad?: boolean;
  children: React.ReactNode;
}

export function MineBubble({ noPad = false, children }: MineBubbleProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef  = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const w = el.offsetWidth, h = el.offsetHeight;
      if (!w || !h) return;
      const r = 18, k = r * 0.5523;
      const d =
        `M0 ${r}C0 ${k} ${k} 0 ${r} 0` +
        `H${w - r}C${w - k} 0 ${w} ${k} ${w} ${r}` +
        `V${h - r}C${w} ${h - k} ${w - k} ${h} ${w - r} ${h}` +
        `H${r}C${k} ${h} 0 ${h - k} 0 ${h - r}` +
        `V${r}Z`;
      pathRef.current?.setAttribute('d', d);
      svgRef.current?.setAttribute('viewBox', `0 0 ${w} ${h}`);
    };
    const ro = new ResizeObserver(update);
    ro.observe(el);
    update();
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapRef} style={{ position: 'relative', padding: noPad ? 0 : '10px 14px' }}>
      <svg ref={svgRef} width="100%" height="100%"
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
        <path ref={pathRef} fill="#065BFD" />
      </svg>
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  );
}
