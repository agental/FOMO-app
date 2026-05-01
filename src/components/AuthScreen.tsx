import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Eye, EyeOff, AlertCircle, CheckCircle2, Mail, Lock, User, ArrowRight } from 'lucide-react';

interface AuthScreenProps {
  onAuthSuccess: (userId: string) => void;
}

const VIDEO =
  'https://videos.pexels.com/video-files/1909463/1909463-uhd_2560_1440_24fps.mp4';

export function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
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

  const inputWrap = (focused: boolean): React.CSSProperties => ({
    position: 'relative',
    borderRadius: 9999,
    background: focused ? '#ffffff' : '#F8FAFC',
    border: `1.5px solid ${focused ? '#F97316' : '#E2E8F0'}`,
    boxShadow: focused ? '0 0 0 3.5px rgba(249,115,22,0.12)' : '0 1px 2px rgba(0,0,0,0.04)',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    height: 52,
  });

  const inputField: React.CSSProperties = {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#0F172A',
    fontSize: 15,
    fontFamily: "'Heebo', sans-serif",
    height: '100%',
    paddingRight: 4,
    paddingLeft: 16,
  };

  const iconBox: React.CSSProperties = {
    width: 44, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100dvh',
        width: '100%',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: "'Heebo', sans-serif",
      }}
    >
      {/* Background video */}
      <video
        autoPlay muted loop playsInline
        style={{
          position: 'fixed', inset: 0, zIndex: 0,
          width: '100%', height: '100%',
          objectFit: 'cover',
          transform: 'scale(1.04)',
          filter: 'saturate(1.15)',
        }}
        src={VIDEO}
      />
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1,
        background: 'linear-gradient(170deg, rgba(0,0,0,0.20) 0%, rgba(0,0,0,0.04) 38%, rgba(0,0,0,0.60) 68%, rgba(0,0,0,0.90) 100%)',
      }} />

      {/* Content */}
      <div style={{
        position: 'relative', zIndex: 2,
        display: 'flex', flexDirection: 'column',
        minHeight: '100dvh',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>

        {/* Hero */}
        <div style={{
          flex: 1,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '40px 28px 32px',
          animation: 'fadeUp 0.8s ease-out both',
        }}>
          {/* Logo mark */}
          <div style={{
            width: 64, height: 64, borderRadius: 20,
            background: 'rgba(255,255,255,0.15)',
            border: '1.5px solid rgba(255,255,255,0.30)',
            backdropFilter: 'blur(16px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 18,
            boxShadow: '0 8px 32px rgba(0,0,0,0.20)',
          }}>
            {/* Wave icon */}
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12c1.5-3 3-4.5 4.5-4.5S10.5 9 12 9s3-1.5 4.5-1.5S19.5 9 21 12"/>
              <path d="M3 17c1.5-3 3-4.5 4.5-4.5S10.5 14 12 14s3-1.5 4.5-1.5S19.5 14 21 17"/>
            </svg>
          </div>

          <h1 style={{
            fontSize: 32, fontWeight: 800,
            color: '#FFFFFF',
            letterSpacing: '-0.5px',
            marginBottom: 10,
            textShadow: '0 2px 24px rgba(0,0,0,0.40)',
            textAlign: 'center',
          }}>
            ברוכים הבאים ל-FOMO
          </h1>

          <p style={{
            fontSize: 15,
            color: 'rgba(255,255,255,0.72)',
            fontWeight: 400,
            textAlign: 'center',
            lineHeight: 1.6,
            maxWidth: 260,
            margin: 0,
          }}>
            מצא מטיילים ישראלים,{' '}
            <span style={{ color: 'rgba(255,255,255,0.90)', fontWeight: 600 }}>
              חווה את העולם יחד.
            </span>
          </p>
        </div>

        {/* Bottom sheet */}
        <div style={{
          width: '100%',
          maxWidth: 480,
          margin: '0 auto',
          background: '#FFFFFF',
          borderRadius: '28px 28px 0 0',
          boxShadow: '0 -4px 40px rgba(0,0,0,0.16)',
          animation: 'slideUp 0.55s cubic-bezier(0.22,1,0.36,1) both',
          overflow: 'hidden',
        }}>

          {/* Drag handle */}
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 6 }}>
            <div style={{ width: 36, height: 4, borderRadius: 9999, background: '#E2E8F0' }} />
          </div>

          <div style={{ padding: '12px 24px 36px' }}>

            {step === 'landing' ? (
              /* ── Landing view ── */
              <>
                {/* Primary CTA */}
                <button
                  type="button"
                  onClick={() => { setIsLogin(true); setStep('form'); }}
                  style={{
                    width: '100%', height: 56, borderRadius: 9999, border: 'none',
                    background: '#1B2D5C',
                    color: '#fff', fontSize: 16, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    cursor: 'pointer', transition: 'all 0.2s',
                    fontFamily: "'Heebo', sans-serif",
                    boxShadow: '0 4px 20px rgba(27,45,92,0.30)',
                    marginBottom: 20,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#243d7a'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#1B2D5C'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  <Mail size={18} strokeWidth={2} />
                  התחבר עם אימייל
                </button>

                {/* Divider */}
                <p style={{
                  textAlign: 'center', color: '#94A3B8',
                  fontSize: 13, fontWeight: 500,
                  margin: '0 0 18px',
                }}>
                  או התחבר עם
                </p>

                {/* Social icon buttons */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 28 }}>
                  {/* Google */}
                  <button
                    type="button"
                    onClick={async () => { await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/` } }); }}
                    style={socialCircleBtn}
                    onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.transform = 'translateY(0)'; }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  </button>

                  {/* Apple */}
                  <button
                    type="button"
                    style={socialCircleBtn}
                    onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.transform = 'translateY(0)'; }}
                  >
                    <svg width="22" height="22" fill="#0F172A" viewBox="0 0 24 24">
                      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                    </svg>
                  </button>

                  {/* Facebook */}
                  <button
                    type="button"
                    style={socialCircleBtn}
                    onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.transform = 'translateY(0)'; }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24">
                      <path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </button>
                </div>

                {/* Footer */}
                <p style={{ textAlign: 'center', color: '#64748B', fontSize: 13, margin: '0 0 8px' }}>
                  אין לך חשבון?{' '}
                  <button
                    onClick={() => { setIsLogin(false); setStep('form'); }}
                    style={{
                      background: 'none', border: 'none',
                      color: '#F97316', fontWeight: 700, fontSize: 13,
                      cursor: 'pointer', fontFamily: "'Heebo', sans-serif",
                    }}
                  >
                    הירשם
                  </button>
                </p>
                <p style={{ textAlign: 'center', margin: 0 }}>
                  <button onClick={handleGuest} style={{
                    background: 'none', border: 'none',
                    color: '#94A3B8', fontSize: 12, cursor: 'pointer',
                    fontFamily: "'Heebo', sans-serif",
                  }}>
                    המשך כאורח ←
                  </button>
                </p>
              </>
            ) : (
              /* ── Form view ── */
              <>
                {/* Back + Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <button
                    type="button"
                    onClick={() => { setStep('landing'); setError(null); setSuccess(null); }}
                    style={{
                      width: 36, height: 36, borderRadius: 9999,
                      background: '#F1F5F9', border: 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', color: '#475569', flexShrink: 0,
                    }}
                  >
                    <ArrowRight size={16} strokeWidth={2.5} />
                  </button>

                  <div style={{
                    flex: 1, display: 'flex',
                    background: '#F1F5F9', borderRadius: 9999, padding: 3,
                  }}>
                    {['התחברות', 'הרשמה'].map((label, i) => {
                      const active = isLogin ? i === 0 : i === 1;
                      return (
                        <button
                          key={label}
                          onClick={() => { setIsLogin(i === 0); setError(null); setSuccess(null); setPasswordStrength(0); }}
                          style={{
                            flex: 1, height: 34, borderRadius: 9999,
                            fontSize: 13, fontWeight: 700,
                            transition: 'all 0.22s',
                            background: active ? '#1B2D5C' : 'transparent',
                            color: active ? '#fff' : '#94A3B8',
                            boxShadow: active ? '0 2px 8px rgba(27,45,92,0.25)' : 'none',
                            border: 'none', cursor: 'pointer',
                            fontFamily: "'Heebo', sans-serif",
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Form fields */}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {!isLogin && (
                    <div style={inputWrap(nameFocused)}>
                      <div style={iconBox}>
                        <User size={16} strokeWidth={2} color={nameFocused ? '#F97316' : '#CBD5E1'} />
                      </div>
                      <input
                        type="text" value={displayName}
                        onChange={e => setDisplayName(e.target.value)}
                        onFocus={() => setNameFocused(true)}
                        onBlur={() => setNameFocused(false)}
                        placeholder="השם שלך"
                        style={inputField}
                      />
                    </div>
                  )}

                  <div style={inputWrap(emailFocused)}>
                    <div style={iconBox}>
                      <Mail size={16} strokeWidth={2} color={emailFocused ? '#F97316' : '#CBD5E1'} />
                    </div>
                    <input
                      id="emailInput" type="email" value={email}
                      onChange={e => setEmail(e.target.value)}
                      onFocus={() => setEmailFocused(true)}
                      onBlur={() => setEmailFocused(false)}
                      placeholder="name@example.com"
                      style={inputField}
                    />
                  </div>

                  <div style={inputWrap(passwordFocused)}>
                    <div style={iconBox}>
                      <Lock size={16} strokeWidth={2} color={passwordFocused ? '#F97316' : '#CBD5E1'} />
                    </div>
                    <input
                      id="passwordInput"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => { setPassword(e.target.value); if (!isLogin) setPasswordStrength(calcStrength(e.target.value)); }}
                      onFocus={() => setPasswordFocused(true)}
                      onBlur={() => setPasswordFocused(false)}
                      placeholder="סיסמה"
                      style={inputField}
                    />
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
                        background: 'none', border: 'none',
                        color: '#94A3B8', fontSize: 12, cursor: 'pointer',
                        fontFamily: "'Heebo', sans-serif",
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

                  {/* Submit */}
                  <button
                    id="btnEmailLogin" type="submit" disabled={loading}
                    style={{
                      width: '100%', height: 54, borderRadius: 9999, border: 'none',
                      background: loading ? '#93C5FD' : '#1B2D5C',
                      color: '#fff', fontSize: 16, fontWeight: 800,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      boxShadow: loading ? 'none' : '0 6px 20px rgba(27,45,92,0.30)',
                      transition: 'all 0.22s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: "'Heebo', sans-serif",
                      marginTop: 4,
                    }}
                    onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = '#243d7a'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#1B2D5C'; e.currentTarget.style.transform = 'translateY(0)'; }}
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

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800;900&display=swap');
        input::placeholder { color: #CBD5E1 !important; }
        input { font-family: 'Heebo', sans-serif !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(70px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

const socialCircleBtn: React.CSSProperties = {
  width: 58, height: 58, borderRadius: 9999,
  background: '#ffffff',
  border: '1.5px solid #E2E8F0',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', transition: 'all 0.18s',
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
};