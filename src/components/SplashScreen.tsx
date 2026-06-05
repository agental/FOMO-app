import { useEffect, useRef, useState, useCallback } from 'react';

type Phase = 'dot' | 'assemble' | 'hold' | 'exit';

/* Emoji ghosts in background — same positions as AuthScreen pins */
const PIN_GHOSTS = [
  { emoji: '☕',  x:  8, y: 14, delay: 0.40 },
  { emoji: '🍻',  x: 78, y: 12, delay: 0.90 },
  { emoji: '🏖️', x: 85, y: 44, delay: 1.60 },
  { emoji: '🍕',  x: 14, y: 71, delay: 0.65 },
  { emoji: '🌿',  x: 70, y: 68, delay: 1.20 },
  { emoji: '🎉',  x:  3, y: 47, delay: 1.00 },
  { emoji: '🏄',  x: 89, y: 25, delay: 0.75 },
];

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef  = useRef<Phase>('dot');
  const [phase, setPhase] = useState<Phase>('dot');

  const advance = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  /* ── Phase timeline ── */
  useEffect(() => {
    const timers = [
      setTimeout(() => advance('assemble'), 1500),
      setTimeout(() => advance('hold'),     2700),
      setTimeout(() => advance('exit'),     3500),
      setTimeout(() => onComplete(),        4300),
    ];
    return () => timers.forEach(clearTimeout);
  }, [advance, onComplete]);

  /* ── Canvas: central dot glow + ripples + inward particles ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });

    /* Particles: start spread around edges, drift toward center */
    const makeParts = () => {
      const W = canvas.width, H = canvas.height;
      const cx = W / 2, cy = H / 2;
      return Array.from({ length: 55 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const dist  = 100 + Math.random() * Math.max(W, H) * 0.55;
        return {
          x:     cx + Math.cos(angle) * dist,
          y:     cy + Math.sin(angle) * dist,
          size:  0.6 + Math.random() * 1.6,
          speed: 0.38 + Math.random() * 0.70,
          op:    0.10 + Math.random() * 0.28,
        };
      });
    };
    const parts = makeParts();

    let startMs = 0;
    let rafId   = 0;

    const draw = (ms: number) => {
      if (!startMs) startMs = ms;
      const t  = (ms - startMs) / 1000;
      const W  = canvas.width, H = canvas.height;
      const cx = W / 2, cy = H / 2;
      const ph = phaseRef.current;

      ctx.clearRect(0, 0, W, H);

      /* ── Central dot (fades out when text assembles) ── */
      const dotIn   = Math.min(1, t * 5);
      const dotOut  = ph === 'assemble' ? Math.max(0, 1 - (t - 1.5) * 4)
                    : ph === 'hold' || ph === 'exit' ? 0
                    : 1;
      const dotAlpha = dotIn * dotOut;

      if (dotAlpha > 0.01) {
        const pulse = 1 + Math.sin(t * 4.5) * 0.10;
        const dr    = 9 * pulse;
        // double-circle glow layers (no shadowBlur for mobile perf)
        ([  [72, 0.020], [46, 0.052], [24, 0.115]  ] as [number, number][]).forEach(([r, a]) => {
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(249,115,22,${a * dotAlpha})`;
          ctx.fill();
        });
        // bright core
        ctx.beginPath();
        ctx.arc(cx, cy, dr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(249,115,22,${0.97 * dotAlpha})`;
        ctx.fill();
      }

      /* ── Ripple rings ── */
      const ringFade = ph === 'exit' ? Math.max(0, 1 - (t - 3.5) * 5) : 1;
      for (let i = 0; i < 3; i++) {
        const tOff  = t - i * 0.88;
        if (tOff <= 0) continue;
        const cycle = tOff % 3.2;
        const r     = cycle * 150;
        const op    = Math.max(0, 0.42 * (1 - cycle / 3.2)) * ringFade;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(249,115,22,${op})`;
        ctx.lineWidth   = 1.2;
        ctx.stroke();
      }

      /* ── Particles drifting inward ── */
      const partOp = Math.min(1, Math.max(0, (t - 0.45) * 2.0));
      parts.forEach(p => {
        const dx   = cx - p.x, dy = cy - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 6) {
          p.x += (dx / dist) * p.speed;
          p.y += (dy / dist) * p.speed;
        } else {
          // respawn at edge
          const a = Math.random() * Math.PI * 2;
          const d = 110 + Math.random() * Math.max(W, H) * 0.5;
          p.x = cx + Math.cos(a) * d;
          p.y = cy + Math.sin(a) * d;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(249,115,22,${p.op * partOp})`;
        ctx.fill();
      });

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const isText = phase === 'assemble' || phase === 'hold' || phase === 'exit';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#060D1B',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity:    phase === 'exit' ? 0 : 1,
        transition: phase === 'exit' ? 'opacity 0.9s cubic-bezier(0.4,0,0.2,1)' : 'none',
        overflow: 'hidden',
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      {/* Ambient glow blobs */}
      <div style={{
        position: 'absolute', bottom: '-15%', left: '-10%', pointerEvents: 'none',
        width: '55vw', height: '55vw', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,200,190,0.07) 0%, transparent 65%)',
      }} />
      <div style={{
        position: 'absolute', top: '-12%', right: '-10%', pointerEvents: 'none',
        width: '50vw', height: '50vw', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(249,115,22,0.06) 0%, transparent 65%)',
      }} />

      {/* Canvas */}
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />

      {/* Emoji pin ghosts */}
      {PIN_GHOSTS.map((g, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${g.x}%`, top: `${g.y}%`,
          transform: 'translate(-50%, -50%)',
          fontSize: 22, opacity: 0,
          animation: `ghostPop 1.4s ${g.delay}s ease-out forwards`,
          pointerEvents: 'none',
        }}>{g.emoji}</div>
      ))}

      {/* ── Logo assembly ── */}
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
        <h1
          dir="ltr"
          style={{
            fontSize: 'clamp(76px, 22vw, 112px)',
            fontWeight: 900, lineHeight: 1, margin: 0,
            color: '#FFFFFF', letterSpacing: '-4px',
            fontFamily: "'Heebo', sans-serif",
            whiteSpace: 'nowrap',
          }}
        >
          {/* F O M O — cascade in from dot position */}
          {['F','O','M','O'].map((ch, i) => (
            <span
              key={i}
              style={{
                display: 'inline-block',
                opacity:    isText ? 1 : 0,
                transform:  isText ? 'translateY(0) scale(1)'
                                   : 'translateY(22px) scale(0.72)',
                filter:     isText ? 'blur(0px)' : 'blur(8px)',
                transition: [
                  `opacity  0.55s ${i * 0.075}s ease-out`,
                  `transform 0.55s ${i * 0.075}s cubic-bezier(0.22,1,0.36,1)`,
                  `filter   0.45s ${i * 0.075}s ease-out`,
                ].join(', '),
              }}
            >{ch}</span>
          ))}

          {/* "." — born from the canvas dot, overshoots then settles */}
          <span
            style={{
              display: 'inline-block',
              color: '#F97316',
              letterSpacing: 0,
              animation: isText ? 'dotBorn 1.7s 0.30s ease-out both' : 'none',
            }}
          >.</span>
        </h1>

        {/* Tagline — fades in during hold */}
        <p style={{
          margin: '16px 0 0',
          fontSize: 12, fontWeight: 500,
          color: 'rgba(255,255,255,0.30)',
          letterSpacing: '0.22em', textTransform: 'uppercase',
          fontFamily: "'Heebo', sans-serif",
          opacity:    phase === 'hold' || phase === 'exit' ? 1 : 0,
          transform:  phase === 'hold' || phase === 'exit' ? 'translateY(0)' : 'translateY(10px)',
          transition: 'opacity 0.7s 0.20s ease-out, transform 0.7s 0.20s ease-out',
        }}>
          גלה  ·  חווה  ·  התחבר
        </p>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@900&display=swap');

        @keyframes ghostPop {
          0%   { opacity: 0;    transform: translate(-50%,-50%) scale(0.45); }
          55%  { opacity: 0.26; transform: translate(-50%,-50%) scale(1.12); }
          100% { opacity: 0.15; transform: translate(-50%,-50%) scale(1.00); }
        }

        @keyframes dotBorn {
          0%   { opacity: 0; transform: scale(3.2); filter: blur(10px);
                 text-shadow: 0 0 70px rgba(249,115,22,1.0),
                              0 0 140px rgba(249,115,22,0.70); }
          30%  { opacity: 1; filter: blur(0px);
                 text-shadow: 0 0 35px rgba(249,115,22,0.90),
                              0 0 70px rgba(249,115,22,0.50); }
          65%  { transform: scale(1.10);
                 text-shadow: 0 0 20px rgba(249,115,22,0.60); }
          100% { transform: scale(1.00);
                 text-shadow: 0 0 10px rgba(249,115,22,0.35); }
        }
      `}</style>
    </div>
  );
}
