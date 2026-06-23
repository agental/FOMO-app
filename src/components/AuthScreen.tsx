import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Eye, EyeOff, AlertCircle, CheckCircle2, Mail, Lock, User, ArrowRight } from 'lucide-react';
import { createMeetupPinSVG } from '../utils/createMeetupPin';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface AuthScreenProps {
  onAuthSuccess: (userId: string) => void;
}

/* ── Floating pin definitions ─────────────────────────────────────────────── */
const PIN_DATA = [
  { id: 0, emoji: '☕',  bx:  8, by: 14, phase: 0.0, scale: 1.35, avatarUrl: 'https://i.pravatar.cc/150?img=12' },
  { id: 1, emoji: '🍻',  bx: 79, by: 11, phase: 1.4, scale: 1.10, avatarUrl: 'https://i.pravatar.cc/150?img=7'  },
  { id: 2, emoji: '🏖️', bx: 86, by: 43, phase: 0.8, scale: 1.20, avatarUrl: 'https://i.pravatar.cc/150?img=5'  },
  { id: 3, emoji: '🎉',  bx:  3, by: 48, phase: 2.1, scale: 1.00, avatarUrl: 'https://randomuser.me/api/portraits/women/62.jpg' },
  { id: 4, emoji: '🍕',  bx: 14, by: 72, phase: 0.4, scale: 1.20, avatarUrl: 'https://i.pravatar.cc/150?img=8'  },
  { id: 5, emoji: '🌿',  bx: 71, by: 69, phase: 1.9, scale: 1.10, avatarUrl: 'https://i.pravatar.cc/150?img=15' },
  { id: 6, emoji: '🏄',  bx: 90, by: 25, phase: 1.1, scale: 1.05, avatarUrl: 'https://i.pravatar.cc/150?img=33' },
  { id: 7, emoji: '🥾',  bx:  2, by: 31, phase: 2.6, scale: 1.05, avatarUrl: 'https://i.pravatar.cc/150?img=3'  },
];

/* ── Physics constants ────────────────────────────────────────────────────── */
const SPRING    = 0.018;
const DAMPING   = 0.88;
const REPEL_R   = 130;
const REPEL_F   = 5.5;
const FLOAT_AMP = 7;

/* Bangkok at night coordinates */
const BKK: [number, number] = [100.5347, 13.7450];

export function AuthScreen({ onAuthSuccess }: AuthScreenProps) {

  /* ── Auth state ──────────────────────────────────────────────────────────── */
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

  /* ── Refs ────────────────────────────────────────────────────────────────── */
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<mapboxgl.Map | null>(null);
  const driftRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const pinRefs         = useRef<(HTMLDivElement | null)[]>([]);
  const pinSvgRefs      = useRef<(HTMLDivElement | null)[]>([]);
  const mouseRef        = useRef({ x: -999, y: -999 });
  const physRef         = useRef(PIN_DATA.map(() => ({ x: 0, y: 0, vx: 0, vy: 0, ready: false })));
  const pinRafRef       = useRef<number>(0);
  const pinTimeRef      = useRef(0);

  /* ── Mapbox Bangkok background ───────────────────────────────────────────── */
  useEffect(() => {
    if (!mapContainerRef.current) return;

    (mapboxgl as typeof mapboxgl).accessToken = import.meta.env.VITE_MAPBOX_TOKEN as string;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: BKK,
      zoom: 13.5,
      pitch: 0,
      bearing: 12,
      interactive: false,
      attributionControl: false,
      fadeDuration: 300,
    });
    mapRef.current = map;

    map.on('load', () => {
      /* Strip every symbol layer — removes all text labels, road names, POIs */
      const style = map.getStyle();
      if (style?.layers) {
        for (const layer of style.layers) {
          if (layer.type === 'symbol') {
            try { map.removeLayer(layer.id); } catch { /* layer already removed */ }
          }
        }
      }

      /* Enhance road glow: boost the line layers slightly for cinematic look */
      const lineLayers = (style?.layers ?? []).filter(l => l.type === 'line');
      for (const layer of lineLayers) {
        if (layer.id.includes('road') || layer.id.includes('street') || layer.id.includes('highway')) {
          try {
            map.setPaintProperty(layer.id, 'line-opacity', 0.9);
          } catch { /* skip */ }
        }
      }

      /* Very slow bearing drift — one full revolution in ~25 minutes */
      let b = 12;
      driftRef.current = setInterval(() => {
        b += 0.005;
        map.setBearing(b % 360);
      }, 50);
    });

    return () => {
      if (driftRef.current) clearInterval(driftRef.current);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  /* ── Inject SVG pins ─────────────────────────────────────────────────────── */
  useEffect(() => {
    PIN_DATA.forEach((pin, i) => {
      const el = pinSvgRefs.current[i];
      if (!el) return;
      el.innerHTML = '';
      el.appendChild(createMeetupPinSVG(pin.emoji, pin.avatarUrl ?? null));
    });
  }, []);

  /* ── Init pin physics positions ──────────────────────────────────────────── */
  useEffect(() => {
    const W = window.innerWidth, H = window.innerHeight;
    PIN_DATA.forEach((p, i) => {
      physRef.current[i].x = (p.bx / 100) * W;
      physRef.current[i].y = (p.by / 100) * H;
      physRef.current[i].ready = true;
    });
  }, []);

  /* ── Track pointer ───────────────────────────────────────────────────────── */
  useEffect(() => {
    const onMove  = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    const onTouch = (e: TouchEvent) => {
      if (e.touches[0]) mouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    window.addEventListener('mousemove', onMove,  { passive: true });
    window.addEventListener('touchmove', onTouch, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onTouch);
    };
  }, []);

  /* ── Pin physics RAF ─────────────────────────────────────────────────────── */
  useEffect(() => {
    const tick = (t: number) => {
      const dt   = Math.min(t - pinTimeRef.current, 32);
      pinTimeRef.current = t;
      const time = t / 1000;
      const mx = mouseRef.current.x, my = mouseRef.current.y;

      PIN_DATA.forEach((p, i) => {
        const s  = physRef.current[i];
        const el = pinRefs.current[i];
        if (!s.ready || !el) return;

        const bx = (p.bx / 100) * window.innerWidth;
        const by = (p.by / 100) * window.innerHeight + Math.sin(time * 0.6 + p.phase) * FLOAT_AMP;

        s.vx += (bx - s.x) * SPRING;
        s.vy += (by - s.y) * SPRING;

        const dx = s.x - mx, dy = s.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < REPEL_R && dist > 0) {
          const force = ((REPEL_R - dist) / REPEL_R) * REPEL_F;
          s.vx += (dx / dist) * force;
          s.vy += (dy / dist) * force;
        }

        s.vx *= DAMPING; s.vy *= DAMPING;
        s.x  += s.vx * (dt / 16);
        s.y  += s.vy * (dt / 16);

        el.style.transform = `translate(${s.x}px, ${s.y}px)`;
      });

      pinRafRef.current = requestAnimationFrame(tick);
    };
    pinRafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(pinRafRef.current);
  }, []);

  /* ── Auth handlers ───────────────────────────────────────────────────────── */
  const calcStrength = (pwd: string) => {
    let s = 0;
    if (pwd.length >= 6)  s++;
    if (pwd.length >= 10) s++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) s++;
    if (/\d/.test(pwd))            s++;
    if (/[^a-zA-Z0-9]/.test(pwd)) s++;
    return Math.min(s, 4);
  };
  const strengthColor = ['#EF4444','#F97316','#EAB308','#22C55E'][passwordStrength - 1] || '#D1D5DB';
  const strengthLabel = ['חלשה','בינונית','חזקה','חזקה מאוד'][passwordStrength - 1] || '';

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
    } catch (err: unknown) { setError((err as Error)?.message || 'אירעה שגיאה'); }
    finally { setLoading(false); }
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

  // OAuth sign-in (Google / Apple / Facebook). On success Supabase redirects;
  // if the provider isn't enabled in the project it returns an error instead.
  const handleOAuth = async (provider: 'google' | 'apple' | 'facebook') => {
    setError(null); setSuccess(null);
    const names: Record<typeof provider, string> = { google: 'Google', apple: 'Apple', facebook: 'Facebook' };
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/` },
      });
      if (error) setError(`ההתחברות עם ${names[provider]} אינה זמינה כרגע`);
    } catch {
      setError(`ההתחברות עם ${names[provider]} אינה זמינה כרגע`);
    }
  };

  // Password reset — emails the user a recovery link.
  const handleForgotPassword = async () => {
    setError(null); setSuccess(null);
    if (!email.trim()) { setError('הזן את כתובת האימייל שלך כדי לאפס סיסמה'); return; }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/`,
      });
      if (error) { setError(error.message); return; }
      setSuccess('שלחנו קישור לאיפוס הסיסמה לאימייל שלך 📧');
    } catch {
      setError('אירעה שגיאה בשליחת הקישור');
    }
  };

  /* ── Input helpers ───────────────────────────────────────────────────────── */
  const inputWrap = (focused: boolean): React.CSSProperties => ({
    position: 'relative', borderRadius: 9999,
    background: focused ? '#fff' : '#F8FAFC',
    border: `1.5px solid ${focused ? '#F97316' : '#E2E8F0'}`,
    boxShadow: focused ? '0 0 0 3px rgba(249,115,22,0.14)' : '0 1px 2px rgba(0,0,0,0.04)',
    transition: 'all 0.2s', display: 'flex', alignItems: 'center', height: 52,
  });
  const inputField: React.CSSProperties = {
    flex: 1, background: 'transparent', border: 'none', outline: 'none',
    color: '#0F172A', fontSize: 15, fontFamily: "'Heebo', sans-serif",
    height: '100%', paddingRight: 4, paddingLeft: 16,
  };
  const iconBox: React.CSSProperties = {
    width: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  /* ── Render ──────────────────────────────────────────────────────────────── */
  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100dvh', width: '100%', position: 'relative',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        fontFamily: "'Heebo', sans-serif",
        background: '#060D1B',
      }}
    >
      {/* ── Mapbox Bangkok map (blurred) ── */}
      <div
        ref={mapContainerRef}
        style={{
          position: 'fixed', inset: 0, zIndex: 0,
          filter: 'brightness(0.85) contrast(1.1)',
          pointerEvents: 'none',
        }}
      />

      {/* ── Overlay layers (z-index 1) ── */}

      {/* Teal glow — bottom-left city district feel */}
      <div style={{
        position: 'fixed', bottom: '-12%', left: '-10%', zIndex: 1, pointerEvents: 'none',
        width: '60vw', height: '60vw', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,220,210,0.13) 0%, transparent 60%)',
      }} />

      {/* Orange glow — top-right warm district */}
      <div style={{
        position: 'fixed', top: '-10%', right: '-12%', zIndex: 1, pointerEvents: 'none',
        width: '55vw', height: '55vw', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,140,0,0.11) 0%, transparent 60%)',
      }} />

      {/* Deep vignette — darken edges, leave center clear */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none',
        background: `
          radial-gradient(ellipse 90% 75% at 50% 40%,
            transparent 20%,
            rgba(3,7,18,0.60) 70%,
            rgba(3,7,18,0.88) 100%
          )
        `,
      }} />

      {/* Additional top/bottom fade for sheet blending */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none',
        background: `
          linear-gradient(
            to bottom,
            rgba(3,7,18,0.50) 0%,
            transparent 22%,
            transparent 55%,
            rgba(3,7,18,0.40) 80%
          )
        `,
      }} />

      {/* ── Floating SVG pins (z-index 3) ── */}
      {PIN_DATA.map((pin, i) => (
        <div
          key={pin.id}
          ref={el => { pinRefs.current[i] = el; }}
          style={{
            position: 'fixed', top: 0, left: 0, zIndex: 3,
            transform: `translate(${(pin.bx / 100) * 390}px, ${(pin.by / 100) * 800}px)`,
            pointerEvents: 'none', willChange: 'transform',
          }}
        >
          <div
            ref={el => { pinSvgRefs.current[i] = el; }}
            style={{ transform: `scale(${pin.scale})`, transformOrigin: 'top left', opacity: 0.95 }}
          />
        </div>
      ))}

      {/* ── Main layout (z-index 4) ── */}
      <div style={{
        position: 'relative', zIndex: 4,
        display: 'flex', flexDirection: 'column',
        minHeight: '100dvh',
        paddingTop: 'env(safe-area-inset-top)',
      }}>

        {/* ── Hero ── */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '24px 24px 28px',
          minHeight: 0,
          animation: 'fomoFadeUp 0.9s cubic-bezier(0.22,1,0.36,1) both',
        }}>

          {/* Logo + sonar rings */}
          <div style={{ position: 'relative', marginBottom: 24 }}>

            {/* Orange glow bloom behind logo */}
            <div style={{
              position: 'absolute', left: '50%', top: '50%',
              width: 300, height: 200,
              transform: 'translate(-50%, -50%)',
              background: 'radial-gradient(ellipse, rgba(249,115,22,0.22) 0%, rgba(249,115,22,0.06) 45%, transparent 68%)',
              borderRadius: '50%', pointerEvents: 'none',
            }} />

            {/* Sonar rings */}
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                position: 'absolute',
                width: 60, height: 60,
                left: '50%', top: '50%',
                borderRadius: '50%',
                border: '1.5px solid rgba(249,115,22,0.55)',
                animation: `sonar 3.6s ${i * 1.2}s ease-out infinite`,
                pointerEvents: 'none', zIndex: 0,
              }} />
            ))}

            <h1 dir="ltr" style={{
              position: 'relative', zIndex: 1,
              fontSize: 'clamp(76px, 22vw, 112px)',
              fontWeight: 900, lineHeight: 1, margin: 0,
              color: '#FFFFFF', letterSpacing: '-4px',
              fontFamily: "'Heebo', sans-serif",
              textShadow: '0 0 60px rgba(255,255,255,0.12), 0 4px 24px rgba(0,0,0,0.60)',
            }}>
              FOMO<span style={{ color: '#F97316', letterSpacing: 0 }}>.</span>
            </h1>
          </div>

          <p style={{
            fontSize: 13, fontWeight: 500,
            color: 'rgba(255,255,255,0.40)',
            letterSpacing: '0.18em', textTransform: 'uppercase',
            margin: 0, textAlign: 'center',
            textShadow: '0 1px 8px rgba(0,0,0,0.60)',
          }}>
            גלה  ·  חווה  ·  התחבר
          </p>
        </div>

        {/* ── Bottom sheet ── */}
        <div style={{
          width: '100%', maxWidth: 480, margin: '0 auto',
          background: '#FFFFFF',
          borderRadius: '28px 28px 0 0',
          boxShadow: '0 -16px 80px rgba(0,0,0,0.55)',
          animation: 'fomoSlideUp 0.65s cubic-bezier(0.22,1,0.36,1) both',
          overflow: 'hidden',
        }}>

          <div style={{
            height: 3,
            background: 'linear-gradient(90deg, #F97316, #FBBF24, #F97316)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 3s linear infinite',
          }} />

          <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
            <div style={{ width: 36, height: 4, borderRadius: 9999, background: '#E2E8F0' }} />
          </div>

          <div style={{
            paddingTop: 10,
            paddingLeft: 24,
            paddingRight: 24,
            paddingBottom: 'max(32px, calc(env(safe-area-inset-bottom) + 16px))',
          }}>

            {step === 'landing' ? (
              <>
                <button
                  type="button"
                  onClick={() => { setIsLogin(true); setStep('form'); }}
                  style={{
                    width: '100%', height: 56, borderRadius: 9999, border: 'none',
                    background: 'linear-gradient(135deg, #F97316, #EA580C)',
                    color: '#fff', fontSize: 16, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    cursor: 'pointer', transition: 'all 0.22s',
                    fontFamily: "'Heebo', sans-serif",
                    boxShadow: '0 6px 24px rgba(249,115,22,0.42)', marginBottom: 20,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 32px rgba(249,115,22,0.52)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)';    e.currentTarget.style.boxShadow = '0 6px 24px rgba(249,115,22,0.42)'; }}
                >
                  <Mail size={18} strokeWidth={2} />
                  המשך עם אימייל
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                  <div style={{ flex: 1, height: 1, background: '#F1F5F9' }} />
                  <span style={{ fontSize: 12, color: '#94A3B8', flexShrink: 0 }}>או המשך עם</span>
                  <div style={{ flex: 1, height: 1, background: '#F1F5F9' }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginBottom: 24 }}>
                  <button type="button" style={socialBtn} onClick={() => handleOAuth('apple')}
                    onMouseEnter={e => applySocialHover(e, true)} onMouseLeave={e => applySocialHover(e, false)}>
                    <svg width="21" height="21" fill="#0F172A" viewBox="0 0 24 24">
                      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                    </svg>
                  </button>
                  <button type="button"
                    onClick={() => handleOAuth('google')}
                    style={socialBtn}
                    onMouseEnter={e => applySocialHover(e, true)} onMouseLeave={e => applySocialHover(e, false)}>
                    <svg width="21" height="21" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  </button>
                  <button type="button" style={socialBtn} onClick={() => handleOAuth('facebook')}
                    onMouseEnter={e => applySocialHover(e, true)} onMouseLeave={e => applySocialHover(e, false)}>
                    <svg width="21" height="21" viewBox="0 0 24 24">
                      <path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </button>
                </div>

                <p style={{ textAlign: 'center', color: '#64748B', fontSize: 13, margin: '0 0 6px' }}>
                  אין לך חשבון?{' '}
                  <button onClick={() => { setIsLogin(false); setStep('form'); }}
                    style={{ background: 'none', border: 'none', color: '#F97316', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'Heebo', sans-serif" }}>
                    הירשם
                  </button>
                </p>
                <p style={{ textAlign: 'center', margin: 0 }}>
                  <button onClick={handleGuest}
                    style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: 12, cursor: 'pointer', fontFamily: "'Heebo', sans-serif" }}>
                    המשך כאורח ←
                  </button>
                </p>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <button type="button"
                    onClick={() => { setStep('landing'); setError(null); setSuccess(null); }}
                    style={{ width: 36, height: 36, borderRadius: 9999, background: '#F1F5F9', border: 'none', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#475569' }}>
                    <ArrowRight size={16} strokeWidth={2.5} />
                  </button>
                  <div style={{ flex: 1, display: 'flex', background: '#F1F5F9', borderRadius: 9999, padding: 3 }}>
                    {['התחברות', 'הרשמה'].map((label, i) => {
                      const active = isLogin ? i === 0 : i === 1;
                      return (
                        <button key={label}
                          onClick={() => { setIsLogin(i === 0); setError(null); setSuccess(null); setPasswordStrength(0); }}
                          style={{ flex: 1, height: 34, borderRadius: 9999, fontSize: 13, fontWeight: 700, transition: 'all 0.22s', background: active ? 'linear-gradient(135deg, #F97316, #EA580C)' : 'transparent', color: active ? '#fff' : '#94A3B8', boxShadow: active ? '0 2px 10px rgba(249,115,22,0.30)' : 'none', border: 'none', cursor: 'pointer', fontFamily: "'Heebo', sans-serif" }}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {!isLogin && (
                    <div style={inputWrap(nameFocused)}>
                      <div style={iconBox}><User size={16} strokeWidth={2} color={nameFocused ? '#F97316' : '#CBD5E1'} /></div>
                      <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
                        onFocus={() => setNameFocused(true)} onBlur={() => setNameFocused(false)}
                        placeholder="השם שלך" style={inputField} />
                    </div>
                  )}
                  <div style={inputWrap(emailFocused)}>
                    <div style={iconBox}><Mail size={16} strokeWidth={2} color={emailFocused ? '#F97316' : '#CBD5E1'} /></div>
                    <input id="emailInput" type="email" value={email} onChange={e => setEmail(e.target.value)}
                      onFocus={() => setEmailFocused(true)} onBlur={() => setEmailFocused(false)}
                      placeholder="name@example.com" style={inputField} />
                  </div>
                  <div style={inputWrap(passwordFocused)}>
                    <div style={iconBox}><Lock size={16} strokeWidth={2} color={passwordFocused ? '#F97316' : '#CBD5E1'} /></div>
                    <input id="passwordInput" type={showPassword ? 'text' : 'password'} value={password}
                      onChange={e => { setPassword(e.target.value); if (!isLogin) setPasswordStrength(calcStrength(e.target.value)); }}
                      onFocus={() => setPasswordFocused(true)} onBlur={() => setPasswordFocused(false)}
                      placeholder="סיסמה" style={inputField} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      style={{ width: 44, height: '100%', flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {!isLogin && password.length > 0 && (
                    <div style={{ padding: '2px 4px 0' }}>
                      <div style={{ display: 'flex', gap: 5, marginBottom: 3 }}>
                        {[0,1,2,3].map(i => (
                          <div key={i} style={{ flex: 1, height: 3, borderRadius: 9999, background: i < passwordStrength ? strengthColor : '#E2E8F0', transition: 'background 0.3s' }} />
                        ))}
                      </div>
                      <span style={{ fontSize: 11, color: strengthColor, fontWeight: 500 }}>{strengthLabel}</span>
                    </div>
                  )}

                  {isLogin && (
                    <div style={{ textAlign: 'left' }}>
                      <button type="button" onClick={handleForgotPassword} style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: 12, cursor: 'pointer', fontFamily: "'Heebo', sans-serif" }}>שכחתי סיסמה</button>
                    </div>
                  )}

                  {error && (
                    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 8, color: '#DC2626', fontSize: 13 }}>
                      <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />{error}
                    </div>
                  )}
                  {success && (
                    <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, color: '#16A34A', fontSize: 13 }}>
                      <CheckCircle2 size={15} style={{ flexShrink: 0 }} />{success}
                    </div>
                  )}

                  <button id="btnEmailLogin" type="submit" disabled={loading}
                    style={{ width: '100%', height: 54, borderRadius: 9999, border: 'none', background: loading ? '#FED7AA' : 'linear-gradient(135deg, #F97316, #EA580C)', color: '#fff', fontSize: 16, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: loading ? 'none' : '0 6px 20px rgba(249,115,22,0.38)', transition: 'all 0.22s', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Heebo', sans-serif", marginTop: 4 }}
                    onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(249,115,22,0.50)'; } }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(249,115,22,0.38)'; }}
                  >
                    {loading
                      ? <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} />
                      : isLogin ? 'התחבר לחשבון' : 'צור חשבון חינם'
                    }
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800;900&display=swap');
        input::placeholder { color: #CBD5E1 !important; }
        input { font-family: 'Heebo', sans-serif !important; }
        .mapboxgl-ctrl-logo,
        .mapboxgl-ctrl-attrib { display: none !important; }
        @keyframes spin        { to { transform: rotate(360deg); } }
        @keyframes fomoFadeUp  { from { opacity:0; transform:translateY(32px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fomoSlideUp { from { opacity:0; transform:translateY(80px); } to { opacity:1; transform:translateY(0); } }
        @keyframes sonar       { 0% { transform:translate(-50%,-50%) scale(1); opacity:.60; } 80% { opacity:.08; } 100% { transform:translate(-50%,-50%) scale(7.5); opacity:0; } }
        @keyframes shimmer     { 0% { background-position:0% 0; } 100% { background-position:200% 0; } }
      `}</style>
    </div>
  );
}

/* ── Static button styles ─────────────────────────────────────────────────── */
const socialBtn: React.CSSProperties = {
  width: 58, height: 58, borderRadius: 9999,
  background: '#fff', border: '1.5px solid #E2E8F0',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', transition: 'all 0.18s',
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
};
const applySocialHover = (e: React.MouseEvent<HTMLButtonElement>, on: boolean) => {
  e.currentTarget.style.background  = on ? '#FFF7ED' : '#fff';
  e.currentTarget.style.borderColor = on ? '#FDBA74' : '#E2E8F0';
  e.currentTarget.style.transform   = on ? 'translateY(-3px)' : 'translateY(0)';
  e.currentTarget.style.boxShadow   = on ? '0 8px 20px rgba(249,115,22,0.16)' : '0 2px 8px rgba(0,0,0,0.06)';
};
