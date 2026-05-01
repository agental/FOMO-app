import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Eye, EyeOff, AlertCircle, CheckCircle2, Mail, Lock, User, ArrowRight } from 'lucide-react';

interface AuthScreenProps {
  onAuthSuccess: (userId: string) => void;
}

// ── Floating meetup pin definitions ──────────────────────────────────────────
// bx/by = base position as % of screen width/height
const PIN_DATA = [
  { id: 0, emoji: '☕', label: 'קפה',  bx: 10, by: 18, phase: 0.0 },
  { id: 1, emoji: '🍻', label: '',      bx: 80, by: 13, phase: 1.4 },
  { id: 2, emoji: '🏖️', label: 'חוף',  bx: 88, by: 46, phase: 0.8 },
  { id: 3, emoji: '🎧', label: '',      bx: 5,  by: 50, phase: 2.1 },
  { id: 4, emoji: '🍕', label: 'פיצה', bx: 16, by: 74, phase: 0.4 },
  { id: 5, emoji: '🌅', label: '',      bx: 73, by: 70, phase: 1.9 },
  { id: 6, emoji: '🏄', label: 'גלים', bx: 91, by: 28, phase: 1.1 },
  { id: 7, emoji: '🥾', label: '',      bx: 3,  by: 34, phase: 2.6 },
];

// ── Particle ring around logo ─────────────────────────────────────────────────
const PARTICLE_COUNT = 16;
const P_COLORS = [
  'rgba(14,206,200,0.75)',
  'rgba(14,165,233,0.65)',
  'rgba(245,158,11,0.60)',
  'rgba(20,184,166,0.70)',
  'rgba(56,189,248,0.60)',
];

// ── Physics constants ─────────────────────────────────────────────────────────
const SPRING    = 0.018;   // how fast pins return to base
const DAMPING   = 0.88;    // velocity damping (< 1 = slows down)
const REPEL_R   = 130;     // mouse repulsion radius (px)
const REPEL_F   = 5.5;     // repulsion force strength
const FLOAT_AMP = 7;       // px amplitude of natural float

export function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  // ── Auth state ──────────────────────────────────────────────────────────────
  const [step,             setStep]             = useState<'landing' | 'form'>('landing');
  const [isLogin,          setIsLogin]          = useState(true);
  const [email,            setEmail]            = useState('');
  const [password,         setPassword]         = useState('');
  const [displayName,      setDisplayName]      = useState('');
  const [loading,          setLoading]          = useState(false);
  const [error,            setError]            = useState<string | null>(null);
  const [success,          setSuccess]          = useState<string | null>(null);
  const [showPassword,     setShowPassword]     = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [emailFocused,     setEmailFocused]     = useState(false);
  const [passwordFocused,  setPasswordFocused]  = useState(false);
  const [nameFocused,      setNameFocused]      = useState(false);
  const [logoHovered,      setLogoHovered]      = useState(false);

  // ── Animation refs (avoid React re-renders during RAF loop) ─────────────────
  const pinEls    = useRef<(HTMLDivElement | null)[]>([]);  // DOM refs for pins
  const mouseRef  = useRef({ x: -999, y: -999 });           // live mouse position
  const physRef   = useRef(                                  // per-pin physics state
    PIN_DATA.map(() => ({ x: 0, y: 0, vx: 0, vy: 0, ready: false }))
  );
  const rafRef    = useRef<number>(0);
  const timeRef   = useRef(0);

  // ── Initialize pin positions once mounted ────────────────────────────────────
  useEffect(() => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    PIN_DATA.forEach((p, i) => {
      physRef.current[i].x = (p.bx / 100) * W;
      physRef.current[i].y = (p.by / 100) * H;
      physRef.current[i].ready = true;
    });
  }, []);

  // ── Track mouse / touch position ─────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    const onTouch = (e: TouchEvent) => {
      if (e.touches[0]) {
        mouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('touchmove', onTouch, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onTouch);
    };
  }, []);

  // ── Main RAF animation loop ──────────────────────────────────────────────────
  useEffect(() => {
    const W = () => window.innerWidth;
    const H = () => window.innerHeight;

    const tick = (t: number) => {
      const dt  = Math.min(t - timeRef.current, 32); // cap at 32ms
      timeRef.current = t;
      const time = t / 1000;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      PIN_DATA.forEach((p, i) => {
        const s = physRef.current[i];
        if (!s.ready) return;
        const el = pinEls.current[i];
        if (!el) return;

        // Base position with gentle sine wave float
        const bx = (p.bx / 100) * W();
        const by = (p.by / 100) * H() + Math.sin(time * 0.6 + p.phase) * FLOAT_AMP;

        // Spring force toward base
        s.vx += (bx - s.x) * SPRING;
        s.vy += (by - s.y) * SPRING;

        // Mouse repulsion
        const dx   = s.x - mx;
        const dy   = s.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < REPEL_R && dist > 0) {
          const force = ((REPEL_R - dist) / REPEL_R) * REPEL_F;
          s.vx += (dx / dist) * force;
          s.vy += (dy / dist) * force;
        }

        // Damping
        s.vx *= DAMPING;
        s.vy *= DAMPING;

        // Integrate
        s.x += s.vx * (dt / 16);
        s.y += s.vy * (dt / 16);

        // Apply to DOM directly — zero React re-renders
        el.style.transform = `translate(${s.x}px, ${s.y}px)`;
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // ── Auth handlers ────────────────────────────────────────────────────────────
  const calcStrength = (pwd: string) => {
    let s = 0;
    if (pwd.length >= 6) s++;
    if (pwd.length >= 10) s++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) s++;
    if (/\d/.test(pwd)) s++;
    if (/[^a-zA-Z0-9]/.test(pwd)) s++;
    return Math.min(s, 4);
  };

  const strengthColor = ['#EF4444', '#F97316', '#EAB308', '#22C55E'][passwordStrength - 1] || '#D1D5DB';
  const strengthLabel = ['חלשה', 'בינונית', 'חזקה', 'חזקה מאוד'][passwordStrength - 1] || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setSuccess(null); setLoading(true);
    try {
      if (isLogin) {
        if (!email || !password) { setError('אנא הזן אימייל וסיסמה'); setLoading(false); return; }
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: password.trim() });
        if (error) { setError(error.message.includes('Invalid login credentials') ? 'אימייל או סיסמה שגויים' : error.message); setLoading(false); return; }
        if (data.user) { setSuccess('מתחבר...'); await new Promise(r => setTimeout(r, 500)); onAuthSuccess(data.user.id); }
      } else {
        if (!email || !password || !displayName) { setError('אנא מלא את כל השדות'); setLoading(false); return; }
        if (password.length < 6) { setError('הסיסמה חייבת להכיל לפחות 6 תווים'); setLoading(false); return; }
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password: password.trim(),
          options: { data: { display_name: displayName.trim() } },
        });
        if (error) { setError(error.message.includes('User already registered') ? 'משתמש עם אימייל זה כבר קיים' : error.message); setLoading(false); return; }
        if (data.user) { setSuccess('ברוך הבא! 🎉'); await new Promise(r => setTimeout(r, 1000)); onAuthSuccess(data.user.id); }
      }
    } catch (err: any) {
      setError(err?.message || 'אירעה שגיאה');
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    setError(null); setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) { setError('שגיאה בכניסה כאורח'); return; }
      if (data.user) { setSuccess('נכנס כאורח...'); await new Promise(r => setTimeout(r, 400)); onAuthSuccess(data.user.id); }
    } catch { setError('אירעה שגיאה'); }
    finally { setLoading(false); }
  };

  // ── Input style helpers ──────────────────────────────────────────────────────
  const inputWrap = (focused: boolean): React.CSSProperties => ({
    position: 'relative', borderRadius: 9999,
    background: focused ? '#fff' : '#F8FAFC',
    border: `1.5px solid ${focused ? '#0EA5E9' : '#E2E8F0'}`,
    boxShadow: focused ? '0 0 0 3px rgba(14,165,233,0.15)' : '0 1px 2px rgba(0,0,0,0.04)',
    transition: 'all 0.2s', display: 'flex', alignItems: 'center', height: 52,
  });
  const inputField: React.CSSProperties = {
    flex: 1, background: 'transparent', border: 'none', outline: 'none',
    color: '#0F172A', fontSize: 15, fontFamily: "'Heebo', sans-serif",
    height: '100%', paddingRight: 4, paddingLeft: 16,
  };
  const iconBox: React.CSSProperties = {
    width: 44, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100dvh', width: '100%', position: 'relative',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        fontFamily: "'Heebo', sans-serif",
        background: 'linear-gradient(135deg, #020B18 0%, #041529 40%, #062040 70%, #030E1A 100%)',
      }}
    >
      {/* ── Ocean glow layers ──────────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 70% 50% at 50% 40%, rgba(14,165,233,0.12) 0%, transparent 70%)',
      }} />
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 50% 40% at 20% 80%, rgba(14,206,200,0.08) 0%, transparent 60%)',
      }} />
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 40% 30% at 80% 20%, rgba(56,189,248,0.07) 0%, transparent 60%)',
      }} />

      {/* ── Floating meetup pins (positioned absolutely, animated via RAF) ── */}
      {PIN_DATA.map((pin, i) => (
        <div
          key={pin.id}
          ref={el => { pinEls.current[i] = el; }}
          style={{
            position: 'fixed', top: 0, left: 0, zIndex: 3,
            // Initial off-screen; RAF will set the real transform immediately
            transform: `translate(${(pin.bx / 100) * 400}px, ${(pin.by / 100) * 800}px)`,
            pointerEvents: 'none',
            willChange: 'transform',
          }}
        >
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.35))',
          }}>
            {/* Pin bubble */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: pin.label ? 6 : 0,
              padding: pin.label ? '8px 14px 8px 10px' : '10px',
              borderRadius: 9999,
              background: 'rgba(255,255,255,0.10)',
              border: '1px solid rgba(255,255,255,0.22)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.15)',
              whiteSpace: 'nowrap',
            }}>
              <span style={{ fontSize: 22, lineHeight: 1 }}>{pin.emoji}</span>
              {pin.label && (
                <span style={{
                  fontSize: 12, fontWeight: 600,
                  color: 'rgba(255,255,255,0.90)',
                  letterSpacing: '0.02em',
                }}>
                  {pin.label}
                </span>
              )}
            </div>
            {/* Pin tail */}
            <div style={{
              width: 3, height: 8,
              background: 'linear-gradient(to bottom, rgba(255,255,255,0.25), transparent)',
              borderRadius: 2,
              marginTop: -1,
            }} />
            {/* Pin dot */}
            <div style={{
              width: 5, height: 5, borderRadius: '50%',
              background: 'rgba(255,255,255,0.35)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            }} />
          </div>
        </div>
      ))}

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div style={{
        position: 'relative', zIndex: 4,
        display: 'flex', flexDirection: 'column',
        minHeight: '100dvh',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>

        {/* ── Hero area ──────────────────────────────────────────────────── */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '40px 24px 24px',
          animation: 'fomoFadeUp 0.9s cubic-bezier(0.22,1,0.36,1) both',
        }}>

          {/* ── Logo + particle ring ──────────────────────────────────────── */}
          <div
            style={{ position: 'relative', marginBottom: 28, cursor: 'default' }}
            onMouseEnter={() => setLogoHovered(true)}
            onMouseLeave={() => setLogoHovered(false)}
          >
            {/* Particles orbiting the logo — pure CSS animation */}
            {Array.from({ length: PARTICLE_COUNT }, (_, i) => {
              const radius  = 68 + (i % 3) * 14;
              const size    = 3 + (i % 4);
              const dur     = 6 + (i % 4) * 1.2;
              const color   = P_COLORS[i % P_COLORS.length];
              const delay   = -(i / PARTICLE_COUNT) * dur;
              // When logo hovered, particles spread outward via CSS var
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    top: '50%', left: '50%',
                    width: size, height: size,
                    borderRadius: '50%',
                    background: color,
                    boxShadow: `0 0 ${size * 2}px ${color}`,
                    animation: `orbit${i % 3 === 0 ? 'CW' : 'CCW'} ${dur}s linear ${delay}s infinite`,
                    // orbit radius as inline var
                    '--r': `${logoHovered ? radius + 22 : radius}px`,
                    transition: '--r 0.4s',
                  } as React.CSSProperties}
                />
              );
            })}

            {/* Outer glow ring */}
            <div style={{
              position: 'absolute', inset: -20,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(14,206,200,0.12) 0%, transparent 70%)',
              animation: 'glowPulse 3s ease-in-out infinite',
            }} />

            {/* Logo text */}
            <div style={{
              position: 'relative', zIndex: 1,
              textAlign: 'center',
            }}>
              <h1 style={{
                fontSize: 'clamp(72px, 20vw, 108px)',
                fontWeight: 900,
                lineHeight: 1,
                margin: 0,
                background: 'linear-gradient(135deg, #FFFFFF 0%, #BAE6FD 50%, #67E8F9 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                letterSpacing: '-3px',
                filter: 'drop-shadow(0 0 30px rgba(14,206,200,0.35))',
              }}>
                FOMO
              </h1>
            </div>
          </div>

          {/* Tagline */}
          <p style={{
            fontSize: 15, fontWeight: 500,
            color: 'rgba(255,255,255,0.55)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            margin: 0,
            textAlign: 'center',
          }}>
            גלה  ·  חווה  ·  התחבר
          </p>
        </div>

        {/* ── Bottom sheet ──────────────────────────────────────────────── */}
        <div style={{
          width: '100%', maxWidth: 480, margin: '0 auto',
          background: '#FFFFFF',
          borderRadius: '28px 28px 0 0',
          boxShadow: '0 -8px 48px rgba(0,0,0,0.25)',
          animation: 'fomoSlideUp 0.65s cubic-bezier(0.22,1,0.36,1) both',
          overflow: 'hidden',
        }}>

          {/* Turquoise accent bar */}
          <div style={{
            height: 3,
            background: 'linear-gradient(90deg, #0ECEC8, #0EA5E9, #0ECEC8)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 3s linear infinite',
          }} />

          {/* Drag handle */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
            <div style={{ width: 36, height: 4, borderRadius: 9999, background: '#E2E8F0' }} />
          </div>

          <div style={{ padding: '10px 24px 32px' }}>

            {step === 'landing' ? (
              /* ── Landing view ──────────────────────────────────────────── */
              <>
                {/* Primary CTA */}
                <button
                  type="button"
                  onClick={() => { setIsLogin(true); setStep('form'); }}
                  style={{
                    width: '100%', height: 56, borderRadius: 9999, border: 'none',
                    background: 'linear-gradient(135deg, #0369A1, #0EA5E9)',
                    color: '#fff', fontSize: 16, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    cursor: 'pointer', transition: 'all 0.22s',
                    fontFamily: "'Heebo', sans-serif",
                    boxShadow: '0 6px 24px rgba(14,165,233,0.40)',
                    marginBottom: 20,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 32px rgba(14,165,233,0.50)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(14,165,233,0.40)'; }}
                >
                  <Mail size={18} strokeWidth={2} />
                  התחבר עם אימייל
                </button>

                <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: 13, margin: '0 0 16px' }}>
                  או התחבר עם
                </p>

                {/* Social circle buttons */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 24 }}>
                  {/* Google */}
                  <button type="button"
                    onClick={async () => { await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/` } }); }}
                    style={socialBtn}
                    onMouseEnter={e => applyHover(e, true)}
                    onMouseLeave={e => applyHover(e, false)}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  </button>

                  {/* Apple */}
                  <button type="button" style={socialBtn}
                    onMouseEnter={e => applyHover(e, true)}
                    onMouseLeave={e => applyHover(e, false)}
                  >
                    <svg width="22" height="22" fill="#0F172A" viewBox="0 0 24 24">
                      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                    </svg>
                  </button>

                  {/* Facebook */}
                  <button type="button" style={socialBtn}
                    onMouseEnter={e => applyHover(e, true)}
                    onMouseLeave={e => applyHover(e, false)}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24">
                      <path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </button>
                </div>

                <p style={{ textAlign: 'center', color: '#64748B', fontSize: 13, margin: '0 0 6px' }}>
                  אין לך חשבון?{' '}
                  <button onClick={() => { setIsLogin(false); setStep('form'); }} style={{
                    background: 'none', border: 'none', color: '#0EA5E9',
                    fontWeight: 700, fontSize: 13, cursor: 'pointer',
                    fontFamily: "'Heebo', sans-serif",
                  }}>הירשם</button>
                </p>
                <p style={{ textAlign: 'center', margin: 0 }}>
                  <button onClick={handleGuest} style={{
                    background: 'none', border: 'none', color: '#94A3B8',
                    fontSize: 12, cursor: 'pointer', fontFamily: "'Heebo', sans-serif",
                  }}>המשך כאורח ←</button>
                </p>
              </>
            ) : (
              /* ── Form view ─────────────────────────────────────────────── */
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <button type="button"
                    onClick={() => { setStep('landing'); setError(null); setSuccess(null); }}
                    style={{
                      width: 36, height: 36, borderRadius: 9999,
                      background: '#F1F5F9', border: 'none', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', color: '#475569',
                    }}
                  >
                    <ArrowRight size={16} strokeWidth={2.5} />
                  </button>

                  <div style={{ flex: 1, display: 'flex', background: '#F1F5F9', borderRadius: 9999, padding: 3 }}>
                    {['התחברות', 'הרשמה'].map((label, i) => {
                      const active = isLogin ? i === 0 : i === 1;
                      return (
                        <button key={label}
                          onClick={() => { setIsLogin(i === 0); setError(null); setSuccess(null); setPasswordStrength(0); }}
                          style={{
                            flex: 1, height: 34, borderRadius: 9999,
                            fontSize: 13, fontWeight: 700,
                            transition: 'all 0.22s',
                            background: active ? 'linear-gradient(135deg, #0369A1, #0EA5E9)' : 'transparent',
                            color: active ? '#fff' : '#94A3B8',
                            boxShadow: active ? '0 2px 10px rgba(14,165,233,0.30)' : 'none',
                            border: 'none', cursor: 'pointer',
                            fontFamily: "'Heebo', sans-serif",
                          }}
                        >{label}</button>
                      );
                    })}
                  </div>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {!isLogin && (
                    <div style={inputWrap(nameFocused)}>
                      <div style={iconBox}><User size={16} strokeWidth={2} color={nameFocused ? '#0EA5E9' : '#CBD5E1'} /></div>
                      <input type="text" value={displayName}
                        onChange={e => setDisplayName(e.target.value)}
                        onFocus={() => setNameFocused(true)} onBlur={() => setNameFocused(false)}
                        placeholder="השם שלך" style={inputField} />
                    </div>
                  )}

                  <div style={inputWrap(emailFocused)}>
                    <div style={iconBox}><Mail size={16} strokeWidth={2} color={emailFocused ? '#0EA5E9' : '#CBD5E1'} /></div>
                    <input id="emailInput" type="email" value={email}
                      onChange={e => setEmail(e.target.value)}
                      onFocus={() => setEmailFocused(true)} onBlur={() => setEmailFocused(false)}
                      placeholder="name@example.com" style={inputField} />
                  </div>

                  <div style={inputWrap(passwordFocused)}>
                    <div style={iconBox}><Lock size={16} strokeWidth={2} color={passwordFocused ? '#0EA5E9' : '#CBD5E1'} /></div>
                    <input id="passwordInput"
                      type={showPassword ? 'text' : 'password'} value={password}
                      onChange={e => { setPassword(e.target.value); if (!isLogin) setPasswordStrength(calcStrength(e.target.value)); }}
                      onFocus={() => setPasswordFocused(true)} onBlur={() => setPasswordFocused(false)}
                      placeholder="סיסמה" style={inputField} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={{
                      width: 44, height: '100%', flexShrink: 0,
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {!isLogin && password.length > 0 && (
                    <div style={{ padding: '2px 4px 0' }}>
                      <div style={{ display: 'flex', gap: 5, marginBottom: 3 }}>
                        {[0,1,2,3].map(i => (
                          <div key={i} style={{
                            flex: 1, height: 3, borderRadius: 9999,
                            background: i < passwordStrength ? strengthColor : '#E2E8F0',
                            transition: 'background 0.3s',
                          }} />
                        ))}
                      </div>
                      <span style={{ fontSize: 11, color: strengthColor, fontWeight: 500 }}>{strengthLabel}</span>
                    </div>
                  )}

                  {isLogin && (
                    <div style={{ textAlign: 'left' }}>
                      <button type="button" style={{
                        background: 'none', border: 'none', color: '#94A3B8',
                        fontSize: 12, cursor: 'pointer', fontFamily: "'Heebo', sans-serif",
                      }}>שכחתי סיסמה</button>
                    </div>
                  )}

                  {error && (
                    <div style={{
                      background: '#FEF2F2', border: '1px solid #FECACA',
                      borderRadius: 12, padding: '10px 14px',
                      display: 'flex', alignItems: 'flex-start', gap: 8,
                      color: '#DC2626', fontSize: 13,
                    }}>
                      <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                      {error}
                    </div>
                  )}

                  {success && (
                    <div style={{
                      background: '#F0FDF4', border: '1px solid #BBF7D0',
                      borderRadius: 12, padding: '10px 14px',
                      display: 'flex', alignItems: 'center', gap: 8,
                      color: '#16A34A', fontSize: 13,
                    }}>
                      <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
                      {success}
                    </div>
                  )}

                  <button id="btnEmailLogin" type="submit" disabled={loading}
                    style={{
                      width: '100%', height: 54, borderRadius: 9999, border: 'none',
                      background: loading ? '#BAE6FD' : 'linear-gradient(135deg, #0369A1, #0EA5E9)',
                      color: '#fff', fontSize: 16, fontWeight: 800,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      boxShadow: loading ? 'none' : '0 6px 20px rgba(14,165,233,0.38)',
                      transition: 'all 0.22s', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      fontFamily: "'Heebo', sans-serif", marginTop: 4,
                    }}
                    onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(14,165,233,0.50)'; } }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(14,165,233,0.38)'; }}
                  >
                    {loading ? (
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%',
                        border: '2.5px solid rgba(255,255,255,0.35)',
                        borderTopColor: '#fff', animation: 'spin 0.7s linear infinite',
                      }} />
                    ) : (
                      isLogin ? 'התחבר לחשבון' : 'צור חשבון חינם'
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Global styles + keyframes ──────────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800;900&display=swap');

        input::placeholder { color: #CBD5E1 !important; }
        input { font-family: 'Heebo', sans-serif !important; }

        /* Spinner */
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Hero entrance */
        @keyframes fomoFadeUp {
          from { opacity: 0; transform: translateY(32px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fomoSlideUp {
          from { opacity: 0; transform: translateY(80px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Particle orbits — clockwise and counter-clockwise */
        @keyframes orbitCW {
          from { transform: rotate(0deg)   translateX(var(--r)) rotate(0deg); }
          to   { transform: rotate(360deg) translateX(var(--r)) rotate(-360deg); }
        }
        @keyframes orbitCCW {
          from { transform: rotate(0deg)    translateX(var(--r)) rotate(0deg); }
          to   { transform: rotate(-360deg) translateX(var(--r)) rotate(360deg); }
        }

        /* Logo glow pulse */
        @keyframes glowPulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.08); }
        }

        /* Accent bar shimmer */
        @keyframes shimmer {
          0%   { background-position: 0% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
}

// ── Static styles ──────────────────────────────────────────────────────────────
const socialBtn: React.CSSProperties = {
  width: 58, height: 58, borderRadius: 9999,
  background: '#fff',
  border: '1.5px solid #E2E8F0',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', transition: 'all 0.18s',
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
};

const applyHover = (e: React.MouseEvent<HTMLButtonElement>, enter: boolean) => {
  e.currentTarget.style.background    = enter ? '#F0F9FF' : '#fff';
  e.currentTarget.style.borderColor   = enter ? '#BAE6FD' : '#E2E8F0';
  e.currentTarget.style.transform     = enter ? 'translateY(-3px)' : 'translateY(0)';
  e.currentTarget.style.boxShadow     = enter ? '0 8px 20px rgba(14,165,233,0.18)' : '0 2px 8px rgba(0,0,0,0.06)';
};