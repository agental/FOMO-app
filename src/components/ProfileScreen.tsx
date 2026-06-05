import { useState, useEffect } from 'react';
import { ArrowRight, LogOut, MessageCircle, Edit2, Search, Check, Camera, MapPin, Globe } from 'lucide-react';
import { supabase, type User } from '../lib/supabase';
import { flagEmoji } from '../utils/flags';
import { COUNTRIES } from '../utils/countries';
import { FloatingNavBar } from './FloatingNavBar';
import { ImageUpload } from './ImageUpload';
import { CountriesVisitedCard } from './CountriesVisitedCard';

interface ProfileScreenProps {
  onBack: () => void;
  currentUserId?: string | null;
  onNavigateToMap?: () => void;
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

function SectionCard({ label, emoji, children }: { label: string; emoji: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 22,
      padding: '18px 18px 20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 20px rgba(0,0,0,0.06)',
      marginBottom: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 11,
          background: 'linear-gradient(135deg, #FFF7ED, #FFEDD5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, flexShrink: 0,
          border: '1px solid rgba(249,115,22,0.12)',
        }}>
          {emoji}
        </div>
        <span style={{
          fontSize: 11, fontWeight: 800, color: '#9CA3AF',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          fontFamily: 'Heebo, sans-serif',
        }}>{label}</span>
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
  onBack, currentUserId, onNavigateToMap, viewUserId, onMessageUser,
}: ProfileScreenProps) {
  const [profile,              setProfile]              = useState<User | null>(null);
  const [eventsCount,          setEventsCount]          = useState(0);
  const [loading,              setLoading]              = useState(true);
  const [isEditing,            setIsEditing]            = useState(false);
  const [isSelectingCountries, setIsSelectingCountries] = useState(false);
  const [selectedCountries,    setSelectedCountries]    = useState<string[]>([]);
  const [countrySearch,        setCountrySearch]        = useState('');

  const targetUserId = viewUserId || currentUserId;
  const isOwnProfile = !viewUserId || viewUserId === currentUserId;

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
  const memberSince = new Date(profile.created_at).toLocaleDateString('he-IL', { year: 'numeric', month: 'short' });

  /* ═══════════════════════════════════════════════════ */
  return (
    <div style={{ minHeight: '100dvh', background: '#EFEFEF', overflowX: 'hidden' }} dir="rtl">

      {/* ══ HERO ══ */}
      <div style={{
        position: 'relative', overflow: 'hidden',
        background: '#0C0C10',
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
          <button onClick={onBack} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 16px', borderRadius: 50,
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.75)', cursor: 'pointer',
            fontFamily: 'Heebo, sans-serif', fontSize: 14, fontWeight: 600,
            backdropFilter: 'blur(8px)', transition: 'all 0.15s',
          }}>
            <ArrowRight size={15} />
            חזרה
          </button>

          <div style={{ display: 'flex', gap: 8 }}>
            {isOwnProfile && isEditing && (
              <button onClick={() => setIsEditing(false)} style={{
                padding: '9px 18px', borderRadius: 50,
                background: 'rgba(249,115,22,0.15)',
                border: '1px solid rgba(249,115,22,0.3)',
                color: '#FB923C', cursor: 'pointer',
                fontFamily: 'Heebo, sans-serif', fontSize: 14, fontWeight: 700,
                backdropFilter: 'blur(8px)', transition: 'all 0.15s',
              }}>סיום</button>
            )}
            {isOwnProfile && !isEditing && (
              <button onClick={() => setIsEditing(true)} style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'rgba(255,255,255,0.65)',
                backdropFilter: 'blur(8px)', transition: 'all 0.15s',
              }}>
                <Edit2 size={15} />
              </button>
            )}
            {isOwnProfile && (
              <button onClick={handleLogout} style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.18)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', backdropFilter: 'blur(8px)', transition: 'all 0.15s',
              }}>
                <LogOut size={15} style={{ color: '#F87171' }} />
              </button>
            )}
          </div>
        </div>

        {/* ── Avatar block ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>

          {/* Ring + avatar */}
          <div style={{ position: 'relative', width: 136, height: 136, marginBottom: 22 }}>
            <OrangeRing value={completion} size={136} />

            <div style={{
              position: 'absolute', inset: 8, borderRadius: '50%', overflow: 'hidden',
              background: '#1E2030',
              boxShadow: '0 0 0 2px rgba(255,255,255,0.08), 0 24px 64px rgba(0,0,0,0.7), 0 0 40px rgba(249,115,22,0.15)',
            }}>
              {isEditing && isOwnProfile ? (
                <ImageUpload
                  currentImageUrl={profile.avatar_url}
                  onImageChange={url => setProfile({ ...profile, avatar_url: url })}
                  userId={currentUserId!}
                />
              ) : profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
            </div>

            {isEditing && isOwnProfile && (
              <div style={{
                position: 'absolute', inset: 8, borderRadius: '50%',
                background: 'rgba(0,0,0,0.52)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none',
              }}>
                <Camera size={28} style={{ color: 'white' }} />
              </div>
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
              <Chip>🎂&nbsp;{profile.age}</Chip>
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

        {/* Stats strip */}
        <div style={{
          background: '#fff',
          borderRadius: 22,
          display: 'grid', gridTemplateColumns: '1fr 1px 1fr 1px 1fr',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 6px 24px rgba(0,0,0,0.07)',
          marginBottom: 12,
        }}>
          {[
            { value: eventsCount,                            label: 'אירועים', icon: '🎪' },
            { value: profile.visited_countries?.length || 0, label: 'מדינות',  icon: '✈️' },
            { value: memberSince,                             label: 'חבר מאז', icon: '📅' },
          ].flatMap(({ value, label, icon }, i) => [
            <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 6px' }}>
              <span style={{ fontSize: 22, marginBottom: 5 }}>{icon}</span>
              <span style={{ fontSize: 17, fontWeight: 900, color: '#111827', fontFamily: 'Heebo, sans-serif', lineHeight: 1 }}>{value}</span>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#9CA3AF', fontFamily: 'Heebo, sans-serif', marginTop: 4 }}>{label}</span>
            </div>,
            i < 2 ? <div key={`d${i}`} style={{ background: '#F3F4F6' }} /> : null,
          ])}
        </div>

        {/* Action buttons — viewing other user */}
        {!isOwnProfile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
            <button
              onClick={() => onMessageUser?.(targetUserId!)}
              style={{
                width: '100%', height: 58, borderRadius: 20, border: 'none',
                background: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
                color: 'white', fontSize: 16, fontWeight: 900,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
                boxShadow: '0 8px 30px rgba(249,115,22,0.4)',
                transition: 'transform 0.12s, box-shadow 0.12s',
              }}
            >
              <MessageCircle size={20} />
              שלח הודעה
            </button>

            {profile.instagram ? (
              <a
                href={profile.instagram.startsWith('http') ? profile.instagram : `https://instagram.com/${profile.instagram.replace('@', '')}`}
                target="_blank" rel="noopener noreferrer"
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
          <div style={{
            background: '#fff', borderRadius: 22, padding: '18px 18px 20px',
            marginBottom: 12,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 20px rgba(0,0,0,0.06)',
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
                <p style={{ margin: '3px 0 0', fontSize: 12, color: '#9CA3AF', fontFamily: 'Rubik, sans-serif' }}>
                  פרופיל מלא מקבל פי 3 יותר חיבורים
                </p>
              </div>
            </div>
            {/* Progress bar */}
            <div style={{ height: 7, background: '#F3F4F6', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 99,
                background: 'linear-gradient(90deg, #FB923C, #EA580C)',
                width: `${completion}%`,
                transition: 'width 1.2s cubic-bezier(0.4,0,0.2,1)',
                boxShadow: '0 0 10px rgba(249,115,22,0.45)',
              }} />
            </div>
          </div>
        )}

        {/* Languages */}
        {profile.languages && profile.languages.length > 0 && (
          <SectionCard label="שפות" emoji="💬">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {profile.languages.map((lang: string) => (
                <span key={lang} style={{
                  padding: '8px 16px', borderRadius: 30,
                  background: 'linear-gradient(135deg, #F97316, #EA580C)',
                  color: 'white', fontSize: 13, fontWeight: 700,
                  fontFamily: 'Heebo, sans-serif',
                  boxShadow: '0 3px 12px rgba(249,115,22,0.32)',
                }}>
                  💬&nbsp;{lang}
                </span>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Interests */}
        {profile.interests && profile.interests.length > 0 && (
          <SectionCard label="תחומי עניין" emoji="❤️">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {profile.interests.map((interest: string) => (
                <span key={interest} style={{
                  padding: '8px 14px', borderRadius: 30,
                  background: '#F9FAFB', border: '1.5px solid #EBEBEB',
                  color: '#374151', fontSize: 13, fontWeight: 700,
                  fontFamily: 'Heebo, sans-serif', cursor: 'default',
                }}>
                  {INTEREST_EMOJI[interest] || '✨'}&nbsp;{interest}
                </span>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Countries Visited — full interactive card */}
        <CountriesVisitedCard
          userId={targetUserId!}
          visitedCodes={profile.visited_countries || []}
          isOwnProfile={isOwnProfile}
          onUpdate={(codes) => setProfile(p => p ? { ...p, visited_countries: codes } : p)}
        />

        {/* Travel destinations — own profile, editable */}
        {isOwnProfile && (
          <button
            onClick={() => setIsSelectingCountries(true)}
            style={{
              width: '100%', background: '#fff', borderRadius: 22,
              padding: '18px 18px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 20px rgba(0,0,0,0.06)',
              border: 'none', cursor: 'pointer', textAlign: 'right',
              marginBottom: 12, transition: 'transform 0.12s',
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
                    fontSize: 11, fontWeight: 800, color: '#9CA3AF',
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
                <Edit2 size={14} style={{ color: '#9CA3AF' }} />
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
            <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
              <div style={{ width: 40, height: 4, borderRadius: 99, background: '#E5E7EB', margin: '0 auto 18px' }} />
              <h3 style={{ margin: '0 0 14px', fontSize: 19, fontWeight: 900, color: '#111827', fontFamily: 'Heebo, sans-serif' }}>
                בחר מדינות לטיול
              </h3>
              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
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
                      onClick={() => setSelectedCountries(
                        selected ? selectedCountries.filter(x => x !== code) : [...selectedCountries, code]
                      )}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 9,
                        padding: '11px 12px', borderRadius: 16, textAlign: 'right',
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
                style={{
                  width: '100%', height: 58, borderRadius: 20, border: 'none',
                  background: 'linear-gradient(135deg, #F97316, #EA580C)',
                  color: 'white', fontSize: 16, fontWeight: 900, cursor: 'pointer',
                  fontFamily: 'Heebo, sans-serif',
                  boxShadow: '0 8px 28px rgba(249,115,22,0.38)',
                  transition: 'transform 0.12s, box-shadow 0.12s',
                }}
              >
                שמור ({selectedCountries.length} מדינות)
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

