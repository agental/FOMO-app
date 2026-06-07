import { useState, useEffect, useRef } from 'react';
import { ArrowRight, LogOut, MessageCircle, Edit2, Search, Check, Camera, MapPin, Globe, Loader2, Heart, Ticket, X, Cake, Settings, ChevronLeft, Plus } from 'lucide-react';
import { supabase, type User } from '../lib/supabase';
import { flagEmoji } from '../utils/flags';
import { COUNTRIES } from '../utils/countries';
import { SUGGESTED_LANGUAGES, SUGGESTED_INTERESTS } from '../utils/suggestions';
import { FloatingNavBar } from './FloatingNavBar';
import { CountriesVisitedCard } from './CountriesVisitedCard';

interface ProfileScreenProps {
  onBack: () => void;
  currentUserId?: string | null;
  onNavigateToMap?: () => void;
  onNavigateToMessages?: () => void;
  onNavigateToMyEvents?: () => void;
  onNavigateToSettings?: () => void;
  viewUserId?: string;
  onMessageUser?: (otherUserId: string) => void;
}

function InstagramIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function OrangeRing({ value, size = 136 }: { value: number; size?: number }) {
  const stroke = 3.5;
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const cx = size / 2;
  return (
    <svg width={size} height={size} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)', pointerEvents: 'none' }}>
      <defs>
        <linearGradient id="rg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FB923C" />
          <stop offset="100%" stopColor="#DC2626" />
        </linearGradient>
      </defs>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="url(#rg)" strokeWidth={stroke}
        className="fomo-animated"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - value / 100)}
        style={{
          transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)',
          filter: 'drop-shadow(0 0 5px rgba(249,115,22,0.65))',
        }}
      />
    </svg>
  );
}

function calcCompletion(p: User): number {
  let s = 0;
  if (p.display_name)      s += 20;
  if (p.avatar_url)        s += 20;
  if (p.bio)               s += 15;
  if (p.age)               s += 10;
  if (p.current_country)   s += 10;
  if (p.languages?.length) s += 15;
  if (p.interests?.length) s += 10;
  return Math.min(s, 100);
}

function SectionCard({ label, icon, children, noMargin, onEdit }: { label: string; icon: React.ReactNode; children: React.ReactNode; noMargin?: boolean; onEdit?: () => void }) {
  return (
    <div style={{
      background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
      padding: '18px 18px 20px',
      boxShadow: 'var(--shadow-card)',
      marginBottom: noMargin ? 0 : 12,
      height: noMargin ? '100%' : undefined,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 11,
            background: 'linear-gradient(135deg, #FFF7ED, #FFEDD5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            border: '1px solid rgba(249,115,22,0.12)',
          }}>
            {icon}
          </div>
          <span style={{
            fontSize: 11, fontWeight: 800, color: 'var(--color-text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.1em',
            fontFamily: 'Heebo, sans-serif',
          }}>{label}</span>
        </div>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`עריכת ${label}`}
            className="fomo-press"
            style={{
              width: 32, height: 32, borderRadius: 10, flexShrink: 0,
              background: '#F9FAFB', border: '1.5px solid var(--color-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <Edit2 size={13} style={{ color: 'var(--color-text-muted)' }} />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

const INTEREST_EMOJI: Record<string, string> = {
  'יוגה':'🧘','מסיבות':'🎉','טיולים':'🥾','גלישה':'🏄','אוכל':'🍜','צילום':'📸',
  'מוזיקה':'🎵','ספורט':'⚽','אמנות':'🎨','קריאה':'📚','בישול':'👨‍🍳','טבע':'🌿',
  'חיות':'🐾','משחקים':'🎮','סרטים':'🎬','קפה':'☕','יין':'🍷','טכנולוגיה':'💻',
  'אופנה':'👗','כושר':'💪','מדיטציה':'🧘‍♀️','ריקוד':'💃','שחייה':'🏊','אופניים':'🚴',
  'קמפינג':'🏕️','צלילה':'🤿','סקי':'⛷️','כדורגל':'⚽','כדורסל':'🏀','טניס':'🎾',
};

export default function ProfileScreen({
  onBack, currentUserId, onNavigateToMap, onNavigateToMessages, onNavigateToMyEvents, onNavigateToSettings, viewUserId, onMessageUser,
}: ProfileScreenProps) {
  const [profile,              setProfile]              = useState<User | null>(null);
  const [eventsCount,          setEventsCount]          = useState(0);
  const [loading,              setLoading]              = useState(true);
  const [isSelectingCountries, setIsSelectingCountries] = useState(false);
  const [selectedCountries,    setSelectedCountries]    = useState<string[]>([]);
  const [countrySearch,        setCountrySearch]        = useState('');
  const [uploadingAvatar,      setUploadingAvatar]      = useState(false);
  const [editField,            setEditField]            = useState<'languages' | 'interests' | null>(null);
  const [editValues,           setEditValues]           = useState<string[]>([]);
  const [editCustom,           setEditCustom]           = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const targetUserId = viewUserId || currentUserId;
  const isOwnProfile = !viewUserId || viewUserId === currentUserId;

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUserId) return;
    if (!file.type.startsWith('image/')) { alert('נא להעלות קובץ תמונה בלבד'); return; }
    if (file.size > 5 * 1024 * 1024) { alert('התמונה גדולה מדי. גודל מקסימלי: 5MB'); return; }

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `avatars/${currentUserId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('users').update({ avatar_url: publicUrl }).eq('id', currentUserId);
      if (updateError) throw updateError;

      setProfile(p => (p ? { ...p, avatar_url: publicUrl } : p));
    } catch (err: any) {
      console.error('Avatar upload error:', err);
      alert(err?.message || 'שגיאה בהעלאת התמונה');
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  useEffect(() => {
    if (targetUserId) { loadProfile(); loadStats(); }
  }, [targetUserId]);

  const loadProfile = async () => {
    if (!targetUserId) return;
    const { data } = await supabase.from('users').select('*').eq('id', targetUserId).maybeSingle();
    if (data) { setProfile(data); setSelectedCountries(data.selected_countries || []); }
    setLoading(false);
  };

  const loadStats = async () => {
    if (!targetUserId) return;
    const { count } = await supabase
      .from('events').select('id', { count: 'exact', head: true }).eq('user_id', targetUserId);
    setEventsCount(count || 0);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const saveCountries = async () => {
    if (!currentUserId) return;
    await supabase.from('users').update({ selected_countries: selectedCountries }).eq('id', currentUserId);
    await loadProfile();
    setIsSelectingCountries(false);
  };

  /* ── Section editor (languages / interests) ── */
  const openEditor = (field: 'languages' | 'interests') => {
    setEditField(field);
    setEditValues((field === 'languages' ? profile?.languages : profile?.interests) || []);
    setEditCustom('');
  };
  const toggleEditValue = (v: string) =>
    setEditValues(prev => (prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]));
  const addEditCustom = () => {
    const v = editCustom.trim();
    if (v && !editValues.includes(v)) { setEditValues(prev => [...prev, v]); setEditCustom(''); }
  };
  const saveEditor = async () => {
    if (!currentUserId || !editField) return;
    await supabase.from('users').update({ [editField]: editValues }).eq('id', currentUserId);
    setProfile(p => (p ? { ...p, [editField]: editValues } : p));
    setEditField(null);
  };

  /* ── loading ── */
  if (loading) return (
    <div style={{ minHeight: '100dvh', background: '#0C0C10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: '2.5px solid rgba(249,115,22,0.2)', borderTop: '2.5px solid #F97316', animation: 'sp 0.75s linear infinite' }} />
    </div>
  );

  if (!profile) return (
    <div style={{ minHeight: '100dvh', background: '#0C0C10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'Heebo, sans-serif' }}>לא נמצא פרופיל</p>
    </div>
  );

  const completion  = calcCompletion(profile);

  /* ═══════════════════════════════════════════════════ */
  return (
    <div style={{ minHeight: '100dvh', background: '#EFEFEF', overflowX: 'hidden' }} dir="rtl">
      <style>{`
        @keyframes sp{to{transform:rotate(360deg)}}
        .fomo-press{transition:transform .12s ease, box-shadow .12s ease, filter .15s ease, background .15s ease; -webkit-tap-highlight-color:transparent; touch-action:manipulation;}
        .fomo-press:active{transform:scale(.96);}
        @media (hover:hover){ .fomo-press:hover{filter:brightness(1.04);} }
        @media (prefers-reduced-motion: reduce){
          .fomo-press{transition:none;}
          .fomo-press:active{transform:none;}
          .fomo-animated{transition:none !important; animation:none !important;}
        }
      `}</style>

      {/* ══ HERO ══ */}
      <div style={{
        position: 'relative', overflow: 'hidden',
        background: `
          radial-gradient(120% 80% at 82% -10%, rgba(249,115,22,0.20), transparent 52%),
          radial-gradient(110% 70% at 0% 18%, rgba(234,88,12,0.12), transparent 56%),
          radial-gradient(90% 60% at 50% 120%, rgba(251,146,60,0.10), transparent 60%),
          #0A0A0E
        `,
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        paddingBottom: 52,
      }}>
        {/* Subtle dot grid */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.035,
          backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }} />

        {/* Orange radial glow — behind avatar */}
        <div style={{
          position: 'absolute', top: 60, left: '50%', transform: 'translateX(-50%)',
          width: 340, height: 340, borderRadius: '50%', pointerEvents: 'none',
          background: 'radial-gradient(circle at center, rgba(249,115,22,0.2) 0%, rgba(249,115,22,0.06) 45%, transparent 70%)',
        }} />

        {/* ── Top bar ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 18px', marginBottom: 36, position: 'relative',
        }}>
          <button onClick={onBack} className="fomo-press" aria-label="חזרה" style={{
            display: 'flex', alignItems: 'center', gap: 6,
            minHeight: 44, padding: '0 16px', borderRadius: 50,
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.75)', cursor: 'pointer',
            fontFamily: 'Heebo, sans-serif', fontSize: 14, fontWeight: 600,
            backdropFilter: 'blur(8px)',
          }}>
            <ArrowRight size={15} />
            חזרה
          </button>

          <div style={{ display: 'flex', gap: 8 }}>
            {isOwnProfile && (
              <button onClick={onNavigateToSettings} aria-label="הגדרות" className="fomo-press" style={{
                width: 44, height: 44, borderRadius: '50%',
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', backdropFilter: 'blur(8px)',
              }}>
                <Settings size={16} style={{ color: 'rgba(255,255,255,0.75)' }} />
              </button>
            )}
            {isOwnProfile && (
              <button onClick={handleLogout} aria-label="התנתק" className="fomo-press" style={{
                width: 44, height: 44, borderRadius: '50%',
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.18)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', backdropFilter: 'blur(8px)',
              }}>
                <LogOut size={16} style={{ color: '#F87171' }} />
              </button>
            )}
          </div>
        </div>

        {/* ── Avatar block ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>

          {/* Ring + avatar */}
          <div style={{ position: 'relative', width: 136, height: 136, marginBottom: 22 }}>
            <OrangeRing value={completion} size={136} />

            <div
              onClick={isOwnProfile ? () => avatarInputRef.current?.click() : undefined}
              className={isOwnProfile ? 'fomo-press' : undefined}
              role={isOwnProfile ? 'button' : undefined}
              aria-label={isOwnProfile ? 'החלף תמונת פרופיל' : undefined}
              style={{
                position: 'absolute', inset: 8, borderRadius: '50%', overflow: 'hidden',
                background: '#1E2030',
                cursor: isOwnProfile ? 'pointer' : 'default',
                boxShadow: '0 0 0 2px rgba(255,255,255,0.08), 0 24px 64px rgba(0,0,0,0.7), 0 0 40px rgba(249,115,22,0.15)',
              }}>
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.display_name ? `תמונת הפרופיל של ${profile.display_name}` : 'תמונת פרופיל'}
                  draggable={false}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{
                  width: '100%', height: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
                }}>
                  <span style={{ fontSize: 38, fontWeight: 900, color: 'white', letterSpacing: '-1px' }}>
                    {profile.display_name?.[0]?.toUpperCase() || '?'}
                  </span>
                </div>
              )}

              {/* uploading overlay */}
              {uploadingAvatar && (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'rgba(0,0,0,0.55)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Loader2 size={28} style={{ color: 'white', animation: 'sp 0.75s linear infinite' }} />
                </div>
              )}
            </div>

            {/* hidden file input + camera badge — tap to change profile photo */}
            {isOwnProfile && (
              <>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarSelect}
                  style={{ display: 'none' }}
                />
                {!uploadingAvatar && (
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    aria-label="החלף תמונת פרופיל"
                    className="fomo-press"
                    style={{
                      position: 'absolute', bottom: 2, right: 2,
                      width: 40, height: 40, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #F97316, #EA580C)',
                      border: '3px solid #0C0C10',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', padding: 0,
                      boxShadow: '0 4px 14px rgba(249,115,22,0.5)',
                    }}
                  >
                    <Camera size={18} style={{ color: 'white' }} />
                  </button>
                )}
              </>
            )}

            {/* % badge */}
            <div style={{
              position: 'absolute', bottom: -3, left: '50%', transform: 'translateX(-50%)',
              background: 'linear-gradient(90deg, #F97316, #EA580C)',
              borderRadius: 30, padding: '3px 11px',
              fontSize: 11, fontWeight: 900, color: 'white',
              boxShadow: '0 2px 14px rgba(249,115,22,0.55)',
              fontFamily: 'Heebo, sans-serif', whiteSpace: 'nowrap',
              border: '2px solid #0C0C10',
            }}>
              {completion}%
            </div>
          </div>

          {/* Name */}
          <h1 style={{
            margin: '0 0 10px',
            fontSize: 30, fontWeight: 900, color: '#FFFFFF',
            fontFamily: 'Heebo, sans-serif', letterSpacing: '-0.03em', lineHeight: 1,
          }}>
            {profile.display_name}
          </h1>

          {/* Bio */}
          {profile.bio ? (
            <p style={{
              margin: '0 0 18px', padding: '0 24px',
              fontSize: 14, lineHeight: 1.65, textAlign: 'center',
              color: 'rgba(255,255,255,0.48)',
              fontFamily: 'Rubik, sans-serif', maxWidth: 280,
            }}>
              {profile.bio}
            </p>
          ) : isOwnProfile ? (
            <p style={{ margin: '0 0 18px', fontSize: 12, fontStyle: 'italic', color: 'rgba(255,255,255,0.2)', fontFamily: 'Heebo, sans-serif' }}>
              הוסף תיאור אישי
            </p>
          ) : <div style={{ marginBottom: 14 }} />}

          {/* Info chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', padding: '0 20px' }}>
            {profile.age && (
              <Chip>
                <Cake size={11} style={{ color: '#F97316' }} />
                &nbsp;{profile.age}
              </Chip>
            )}
            {profile.current_country && (
              <Chip>
                <MapPin size={11} style={{ color: '#F97316' }} />
                &nbsp;{COUNTRIES[profile.current_country]?.name || profile.current_country}
              </Chip>
            )}
            {profile.instagram && (
              <Chip>
                <InstagramIcon size={11} />
                &nbsp;{profile.instagram.replace('@', '')}
              </Chip>
            )}
          </div>
        </div>
      </div>

      {/* ══ CONTENT SHEET ══ */}
      <div style={{
        background: '#EFEFEF',
        borderRadius: '28px 28px 0 0',
        marginTop: -26,
        padding: '20px 14px 140px',
        position: 'relative',
      }}>

        {/* Events — full-width tile, taps through to My Events */}
        <div
          onClick={isOwnProfile ? onNavigateToMyEvents : undefined}
          role={isOwnProfile ? 'button' : undefined}
          aria-label={isOwnProfile ? 'האירועים שלי' : undefined}
          className={`animate-card-entrance fomo-animated${isOwnProfile ? ' fomo-press' : ''}`}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
            padding: '14px 16px', marginBottom: 12, boxShadow: 'var(--shadow-card)',
            cursor: isOwnProfile ? 'pointer' : 'default',
          }}
        >
          <div style={{
            width: 44, height: 44, borderRadius: 14, flexShrink: 0,
            background: 'var(--color-primary-tint)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Ticket size={22} style={{ color: 'var(--color-primary)' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--color-text-heading)', fontFamily: 'Heebo, sans-serif', lineHeight: 1 }}>{eventsCount}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', fontFamily: 'Heebo, sans-serif', marginTop: 4 }}>אירועים</div>
          </div>
          {isOwnProfile && <ChevronLeft size={18} style={{ color: 'var(--color-primary)', opacity: 0.6, flexShrink: 0 }} />}
        </div>

        {/* Action buttons — viewing other user */}
        {!isOwnProfile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
            <button
              onClick={() => onMessageUser?.(targetUserId!)}
              className="fomo-press"
              style={{
                width: '100%', height: 58, borderRadius: 20, border: 'none',
                background: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
                color: 'white', fontSize: 16, fontWeight: 900,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
                boxShadow: '0 8px 30px rgba(249,115,22,0.4)',
              }}
            >
              <MessageCircle size={20} />
              שלח הודעה
            </button>

            {profile.instagram ? (
              <a
                href={profile.instagram.startsWith('http') ? profile.instagram : `https://instagram.com/${profile.instagram.replace('@', '')}`}
                target="_blank" rel="noopener noreferrer"
                className="fomo-press"
                style={{
                  width: '100%', height: 52, borderRadius: 18,
                  background: 'linear-gradient(135deg, #F43F5E, #C026D3, #F97316)',
                  color: 'white', fontSize: 15, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  textDecoration: 'none', cursor: 'pointer',
                  fontFamily: 'Heebo, sans-serif',
                  boxShadow: '0 6px 22px rgba(244,63,94,0.3)',
                }}
              >
                <InstagramIcon size={18} />
                פתח באינסטגרם
              </a>
            ) : (
              <div style={{
                width: '100%', height: 46, borderRadius: 18,
                border: '2px dashed #E5E7EB',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                color: '#D1D5DB', fontSize: 13, fontFamily: 'Heebo, sans-serif',
              }}>
                <InstagramIcon size={15} />
                אינסטגרם לא מחובר
              </div>
            )}
          </div>
        )}

        {/* Profile completion */}
        {isOwnProfile && completion < 100 && (
          <div className="animate-card-entrance fomo-animated" style={{
            background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '18px 18px 20px',
            marginBottom: 12, animationDelay: '60ms',
            boxShadow: 'var(--shadow-card)',
            border: '1.5px solid rgba(249,115,22,0.15)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
              <div style={{
                width: 46, height: 46, borderRadius: 15, flexShrink: 0,
                background: 'linear-gradient(135deg, #F97316, #EA580C)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(249,115,22,0.35)',
              }}>
                <span style={{ color: 'white', fontSize: 13, fontWeight: 900, fontFamily: 'Heebo, sans-serif' }}>{completion}%</span>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#111827', fontFamily: 'Heebo, sans-serif' }}>
                  השלם את הפרופיל שלך
                </p>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: '#6B7280', fontFamily: 'Rubik, sans-serif' }}>
                  פרופיל מלא מקבל פי 3 יותר חיבורים
                </p>
              </div>
            </div>
            {/* Progress bar */}
            <div style={{ height: 7, background: '#F3F4F6', borderRadius: 99, overflow: 'hidden' }}
              role="progressbar" aria-valuenow={completion} aria-valuemin={0} aria-valuemax={100} aria-label="השלמת פרופיל">
              <div className="fomo-animated" style={{
                height: '100%', borderRadius: 99,
                background: 'linear-gradient(90deg, #FB923C, #EA580C)',
                width: `${completion}%`,
                transition: 'width 1.2s cubic-bezier(0.4,0,0.2,1)',
                boxShadow: '0 0 10px rgba(249,115,22,0.45)',
              }} />
            </div>
          </div>
        )}

        {/* Languages + Interests — bento pair (editable) */}
        {(() => {
          const showLang = isOwnProfile || (profile.languages?.length ?? 0) > 0;
          const showInterests = isOwnProfile || (profile.interests?.length ?? 0) > 0;
          if (!showLang && !showInterests) return null;

          const addPrompt = (field: 'languages' | 'interests', text: string) => (
            <button onClick={() => openEditor(field)} className="fomo-press" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 30, cursor: 'pointer',
              background: 'transparent', border: '1.5px dashed var(--color-border)',
              color: 'var(--color-text-muted)', fontSize: 13, fontWeight: 700, fontFamily: 'Heebo, sans-serif',
            }}>
              <Plus size={14} /> {text}
            </button>
          );

          return (
            <div
              className="animate-card-entrance fomo-animated"
              style={{
                display: 'grid',
                gridTemplateColumns: (showLang && showInterests) ? '1fr 1fr' : '1fr',
                gap: 12, marginBottom: 12, alignItems: 'stretch',
                animationDelay: '120ms',
              }}
            >
              {showLang && (
                <SectionCard noMargin label="שפות" icon={<MessageCircle size={16} style={{ color: 'var(--color-primary)' }} />} onEdit={isOwnProfile ? () => openEditor('languages') : undefined}>
                  {profile.languages && profile.languages.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {profile.languages.map((lang: string) => (
                        <span key={lang} style={{
                          padding: '8px 16px', borderRadius: 30,
                          background: 'var(--gradient-primary)',
                          color: 'white', fontSize: 13, fontWeight: 700,
                          fontFamily: 'Heebo, sans-serif',
                          boxShadow: '0 3px 12px rgba(249,115,22,0.32)',
                        }}>
                          {lang}
                        </span>
                      ))}
                    </div>
                  ) : addPrompt('languages', 'הוסף שפות')}
                </SectionCard>
              )}

              {showInterests && (
                <SectionCard noMargin label="תחומי עניין" icon={<Heart size={16} style={{ color: 'var(--color-primary)' }} />} onEdit={isOwnProfile ? () => openEditor('interests') : undefined}>
                  {profile.interests && profile.interests.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {profile.interests.map((interest: string) => (
                        <span key={interest} style={{
                          padding: '8px 14px', borderRadius: 30,
                          background: '#F9FAFB', border: '1.5px solid var(--color-border)',
                          color: 'var(--color-text-secondary)', fontSize: 13, fontWeight: 700,
                          fontFamily: 'Heebo, sans-serif', cursor: 'default',
                        }}>
                          {INTEREST_EMOJI[interest] || '✨'}&nbsp;{interest}
                        </span>
                      ))}
                    </div>
                  ) : addPrompt('interests', 'הוסף תחומי עניין')}
                </SectionCard>
              )}
            </div>
          );
        })()}

        {/* Countries Visited — full interactive card */}
        <div className="animate-card-entrance fomo-animated" style={{ animationDelay: '160ms' }}>
          <CountriesVisitedCard
            userId={targetUserId!}
            visitedCodes={profile.visited_countries || []}
            isOwnProfile={isOwnProfile}
            onUpdate={(codes) => setProfile(p => p ? { ...p, visited_countries: codes } : p)}
          />
        </div>

        {/* Travel destinations — own profile, editable */}
        {isOwnProfile && (
          <button
            onClick={() => setIsSelectingCountries(true)}
            className="fomo-press animate-card-entrance fomo-animated"
            aria-label="ערוך מדינות לטיול"
            style={{
              width: '100%', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
              padding: '18px 18px 20px', animationDelay: '200ms',
              boxShadow: 'var(--shadow-card)',
              border: 'none', cursor: 'pointer', textAlign: 'right',
              marginBottom: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 11, flexShrink: 0,
                    background: 'linear-gradient(135deg, #FFF7ED, #FFEDD5)',
                    border: '1px solid rgba(249,115,22,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Globe size={16} style={{ color: '#F97316' }} />
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 800, color: '#6B7280',
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                    fontFamily: 'Heebo, sans-serif',
                  }}>מדינות לטיול</span>
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                  {(profile.selected_countries || []).slice(0, 10).map((c: string) => (
                    <span key={c} style={{ fontSize: 24 }}>{flagEmoji(c)}</span>
                  ))}
                  {(profile.selected_countries || []).length > 10 && (
                    <span style={{
                      fontSize: 12, fontWeight: 800, color: '#F97316',
                      background: '#FFF7ED', borderRadius: 20, padding: '3px 8px',
                      fontFamily: 'Heebo, sans-serif',
                    }}>
                      +{(profile.selected_countries || []).length - 10}
                    </span>
                  )}
                  {!(profile.selected_countries || []).length && (
                    <span style={{ fontSize: 13, color: '#D1D5DB', fontFamily: 'Heebo, sans-serif' }}>הוסף מדינות</span>
                  )}
                </div>
              </div>
              <div style={{
                width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                background: '#F9FAFB', border: '1.5px solid #EBEBEB',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginRight: 10,
              }}>
                <Edit2 size={14} style={{ color: '#6B7280' }} />
              </div>
            </div>
          </button>
        )}
      </div>

      {/* ══ COUNTRY PICKER ══ */}
      {isSelectingCountries && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'flex-end',
          }}
          onClick={() => setIsSelectingCountries(false)}
        >
          <div
            style={{
              background: '#fff', width: '100%',
              borderRadius: '28px 28px 0 0',
              maxHeight: '88dvh', display: 'flex', flexDirection: 'column',
              boxShadow: '0 -20px 60px rgba(0,0,0,0.25)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid #F3F4F6', flexShrink: 0, position: 'relative' }}>
              <div style={{ width: 40, height: 4, borderRadius: 99, background: '#E5E7EB', margin: '0 auto 18px' }} />
              <button
                type="button"
                onClick={() => setIsSelectingCountries(false)}
                aria-label="סגור"
                className="fomo-press"
                style={{
                  position: 'absolute', top: 14, left: 16,
                  width: 36, height: 36, borderRadius: '50%',
                  background: '#F3F4F6', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <X size={18} style={{ color: '#6B7280' }} />
              </button>
              <h3 style={{ margin: '0 0 14px', fontSize: 19, fontWeight: 900, color: '#111827', fontFamily: 'Heebo, sans-serif' }}>
                בחר מדינות לטיול
              </h3>
              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#6B7280' }} />
                <input
                  type="text" value={countrySearch}
                  onChange={e => setCountrySearch(e.target.value)}
                  placeholder="חיפוש מדינה..."
                  style={{
                    width: '100%', height: 44, borderRadius: 99,
                    background: '#F3F4F6', border: 'none', outline: 'none',
                    paddingRight: 38, paddingLeft: 16,
                    fontSize: 14, fontFamily: 'Heebo, sans-serif', boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div style={{
              flex: 1, overflowY: 'auto', padding: '12px 14px',
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
            }}>
              {Object.entries(COUNTRIES)
                .filter(([code, c]) =>
                  !countrySearch || c.name.includes(countrySearch) || code.toLowerCase().includes(countrySearch.toLowerCase())
                )
                .map(([code, c]) => {
                  const selected = selectedCountries.includes(code);
                  return (
                    <button
                      key={code}
                      aria-pressed={selected}
                      onClick={() => setSelectedCountries(
                        selected ? selectedCountries.filter(x => x !== code) : [...selectedCountries, code]
                      )}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 9,
                        minHeight: 44, padding: '11px 12px', borderRadius: 16, textAlign: 'right',
                        border: selected ? '2px solid #F97316' : '1.5px solid #EBEBEB',
                        background: selected ? '#FFF7ED' : '#FAFAFA',
                        cursor: 'pointer', transition: 'all 0.14s',
                      }}
                    >
                      <span style={{ fontSize: 22, flexShrink: 0 }}>{c.flag}</span>
                      <span style={{
                        fontSize: 13, fontWeight: 600, flex: 1,
                        color: selected ? '#EA580C' : '#374151',
                        fontFamily: 'Heebo, sans-serif',
                      }}>{c.name}</span>
                      {selected && <Check size={14} style={{ color: '#F97316', flexShrink: 0 }} />}
                    </button>
                  );
                })}
            </div>

            <div style={{
              padding: '14px 16px',
              paddingBottom: 'max(14px, env(safe-area-inset-bottom))',
              borderTop: '1px solid #F3F4F6', flexShrink: 0,
            }}>
              <button
                onClick={saveCountries}
                className="fomo-press"
                style={{
                  width: '100%', height: 58, borderRadius: 20, border: 'none',
                  background: 'linear-gradient(135deg, #F97316, #EA580C)',
                  color: 'white', fontSize: 16, fontWeight: 900, cursor: 'pointer',
                  fontFamily: 'Heebo, sans-serif',
                  boxShadow: '0 8px 28px rgba(249,115,22,0.38)',
                }}
              >
                שמור ({selectedCountries.length} מדינות)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ SECTION EDITOR (languages / interests) ══ */}
      {editField && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setEditField(null)}
        >
          <div
            dir="rtl"
            onClick={e => e.stopPropagation()}
            style={{ background: '#fff', width: '100%', borderRadius: '28px 28px 0 0', maxHeight: '88dvh', display: 'flex', flexDirection: 'column', boxShadow: '0 -20px 60px rgba(0,0,0,0.25)' }}
          >
            <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid var(--color-divider)', flexShrink: 0, position: 'relative' }}>
              <div style={{ width: 40, height: 4, borderRadius: 99, background: '#E5E7EB', margin: '0 auto 18px' }} />
              <button type="button" onClick={() => setEditField(null)} aria-label="סגור" className="fomo-press" style={{ position: 'absolute', top: 14, left: 16, width: 36, height: 36, borderRadius: '50%', background: '#F3F4F6', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} style={{ color: '#6B7280' }} />
              </button>
              <h3 style={{ margin: 0, fontSize: 19, fontWeight: 900, color: 'var(--color-text-heading)', fontFamily: 'Heebo, sans-serif' }}>
                {editField === 'languages' ? 'עריכת שפות' : 'עריכת תחומי עניין'}
              </h3>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
              {editValues.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  {editValues.map(v => (
                    <button key={v} onClick={() => toggleEditValue(v)} className="fomo-press" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 30, border: 'none', cursor: 'pointer', background: 'var(--gradient-primary)', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'Heebo, sans-serif' }}>
                      {v} <X size={13} />
                    </button>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
                <input
                  type="text" value={editCustom}
                  onChange={e => setEditCustom(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEditCustom(); } }}
                  placeholder={editField === 'languages' ? 'הוסף שפה...' : 'הוסף תחום עניין...'}
                  style={{ flex: 1, height: 44, borderRadius: 14, background: '#F3F4F6', border: 'none', outline: 'none', padding: '0 16px', fontSize: 14, fontFamily: 'Heebo, sans-serif', boxSizing: 'border-box' }}
                />
                <button onClick={addEditCustom} className="fomo-press" style={{ padding: '0 18px', height: 44, borderRadius: 14, border: 'none', cursor: 'pointer', background: 'var(--gradient-primary)', color: '#fff', fontSize: 14, fontWeight: 800, fontFamily: 'Heebo, sans-serif' }}>
                  הוסף
                </button>
              </div>

              <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Heebo, sans-serif' }}>הצעות</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {(editField === 'languages' ? SUGGESTED_LANGUAGES : SUGGESTED_INTERESTS).map(s => {
                  const sel = editValues.includes(s);
                  return (
                    <button key={s} onClick={() => toggleEditValue(s)} className="fomo-press" style={{ padding: '8px 14px', borderRadius: 30, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'Heebo, sans-serif', border: sel ? '1.5px solid var(--color-primary)' : '1.5px solid var(--color-border)', background: sel ? 'var(--color-primary-tint)' : '#FAFAFA', color: sel ? 'var(--color-primary-dark)' : 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      {sel && <Check size={13} />} {s}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ padding: '14px 16px', paddingBottom: 'max(14px, env(safe-area-inset-bottom))', borderTop: '1px solid var(--color-divider)', flexShrink: 0 }}>
              <button onClick={saveEditor} className="fomo-press" style={{ width: '100%', height: 56, borderRadius: 18, border: 'none', cursor: 'pointer', background: 'var(--gradient-primary)', color: '#fff', fontSize: 16, fontWeight: 900, fontFamily: 'Heebo, sans-serif', boxShadow: 'var(--shadow-primary)' }}>
                שמור ({editValues.length})
              </button>
            </div>
          </div>
        </div>
      )}

      <FloatingNavBar
        activeTab="home"
        currentUserId={currentUserId}
        onHomeClick={onBack}
        onMapClick={onNavigateToMap}
        onChatClick={onNavigateToMessages}
        onMyEventsClick={onNavigateToMyEvents}
      />
    </div>
  );
}

/* ── tiny helpers ── */

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      background: 'rgba(255,255,255,0.08)',
      border: '1px solid rgba(255,255,255,0.11)',
      borderRadius: 30, padding: '6px 13px',
      fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.8)',
      fontFamily: 'Heebo, sans-serif', backdropFilter: 'blur(6px)',
    }}>
      {children}
    </span>
  );
}

