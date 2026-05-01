import { useState, useEffect } from 'react';
import { ArrowRight, LogOut, MessageCircle, Instagram, Edit2, Search, Check, Camera } from 'lucide-react';
import { supabase, type User } from '../lib/supabase';
import { flagEmoji } from '../utils/flags';
import { COUNTRIES } from '../utils/countries';
import { FloatingNavBar } from './FloatingNavBar';
import { UserAvatar } from './UserAvatar';
import { ImageUpload } from './ImageUpload';

interface ProfileScreenProps {
  onBack: () => void;
  currentUserId?: string | null;
  onNavigateToMap?: () => void;
  viewUserId?: string;
  onMessageUser?: (otherUserId: string) => void;
}

/* ── Circular progress ring around avatar ── */
function CircularProgress({ value, size = 116 }: { value: number; size?: number }) {
  const stroke = 4;
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - value / 100);
  const cx = size / 2;

  return (
    <svg
      width={size} height={size}
      className="absolute inset-0 pointer-events-none"
      style={{ transform: 'rotate(-90deg)' }}
    >
      <defs>
        <linearGradient id="pgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#20D5EC" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>
      </defs>
      {/* track */}
      <circle cx={cx} cy={cx} r={r} fill="none"
        stroke="rgba(255,255,255,0.15)" strokeWidth={stroke} />
      {/* progress */}
      <circle cx={cx} cy={cx} r={r} fill="none"
        stroke="url(#pgGrad)" strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)' }}
      />
    </svg>
  );
}

/* ── Compute profile completion 0–100 ── */
function calcCompletion(p: User): number {
  let s = 0;
  if (p.display_name) s += 20;
  if (p.avatar_url)   s += 20;
  if (p.bio)          s += 15;
  if (p.age)          s += 10;
  if (p.current_country) s += 10;
  if (p.languages?.length)  s += 15;
  if (p.interests?.length)  s += 10;
  return Math.min(s, 100);
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

  /* ── loading / empty states ── */
  if (loading) return (
    <div className="min-h-screen bg-[#0A1628] flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-[#20D5EC]/30 border-t-[#20D5EC] rounded-full animate-spin" />
    </div>
  );

  if (!profile) return (
    <div className="min-h-screen bg-[#0A1628] flex items-center justify-center">
      <p className="text-white/60">לא נמצא פרופיל</p>
    </div>
  );

  const completion  = calcCompletion(profile);
  const memberSince = new Date(profile.created_at).toLocaleDateString('he-IL', { year: 'numeric', month: 'long' });

  /* ══════════════════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-[#F0F5FA] overflow-x-hidden" dir="rtl">

      {/* ── HERO GRADIENT HEADER ── */}
      <div
        className="relative overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #0A1628 0%, #0D2745 55%, #0C7BA0 100%)',
          paddingTop: 'max(1.25rem, env(safe-area-inset-top))',
        }}
      >
        {/* Decorative blobs */}
        <div className="absolute top-0 left-0 w-64 h-64 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #20D5EC, transparent)', transform: 'translate(-30%, -30%)' }} />
        <div className="absolute bottom-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #38BDF8, transparent)', transform: 'translate(30%, 30%)' }} />

        {/* Top bar */}
        <div className="relative flex items-center justify-between px-5 mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-white/80 hover:text-white active:scale-95 transition-all px-3 py-2 rounded-xl hover:bg-white/10"
          >
            <ArrowRight className="w-5 h-5" />
            <span className="text-sm font-medium">חזרה</span>
          </button>

          <div className="flex items-center gap-2">
            {isOwnProfile && isEditing && (
              <button
                onClick={() => setIsEditing(false)}
                className="text-[#20D5EC] text-sm font-semibold px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all active:scale-95"
              >
                סיום
              </button>
            )}
            {isOwnProfile && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all active:scale-95"
              >
                <Edit2 className="w-4 h-4 text-white/80" />
              </button>
            )}
            {isOwnProfile && (
              <button
                onClick={handleLogout}
                className="w-9 h-9 rounded-xl bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center transition-all active:scale-95"
              >
                <LogOut className="w-4 h-4 text-red-300" />
              </button>
            )}
          </div>
        </div>

        {/* Avatar area */}
        <div className="flex flex-col items-center pb-10">

          {/* Avatar + circular progress */}
          <div className="relative mb-4" style={{ width: 116, height: 116 }}>
            <CircularProgress value={completion} size={116} />

            {/* Avatar */}
            <div className="absolute inset-[6px] rounded-full overflow-hidden ring-2 ring-white/30 shadow-2xl bg-[#0D2745]">
              {isEditing && isOwnProfile ? (
                <ImageUpload
                  currentImageUrl={profile.avatar_url}
                  onImageChange={url => setProfile({ ...profile, avatar_url: url })}
                  userId={currentUserId!}
                />
              ) : profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#20D5EC] to-[#0891B2]">
                  <span className="text-3xl font-bold text-white">
                    {profile.display_name?.[0]?.toUpperCase() || '?'}
                  </span>
                </div>
              )}
            </div>

            {/* Camera icon when editing */}
            {isEditing && isOwnProfile && (
              <div className="absolute inset-[6px] rounded-full bg-black/40 flex items-center justify-center pointer-events-none">
                <Camera className="w-7 h-7 text-white" />
              </div>
            )}

            {/* Completion badge */}
            <div
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[11px] font-bold text-white shadow-lg"
              style={{ background: 'linear-gradient(90deg, #20D5EC, #0891B2)' }}
            >
              {completion}%
            </div>
          </div>

          {/* Name */}
          <h1 className="text-[28px] font-bold text-white tracking-tight mb-1">
            {profile.display_name}
          </h1>

          {/* Bio */}
          {profile.bio ? (
            <p className="text-white/60 text-sm text-center max-w-[260px] leading-relaxed mb-3 px-2">
              {profile.bio}
            </p>
          ) : (
            isOwnProfile && (
              <p className="text-white/30 text-xs italic mb-3">הוסף תיאור אישי</p>
            )
          )}

          {/* Quick info badges */}
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {profile.age && (
              <span className="flex items-center gap-1 bg-white/10 text-white/80 text-xs font-medium px-3 py-1.5 rounded-full">
                🎂 {profile.age}
              </span>
            )}
            {profile.current_country && (
              <span className="flex items-center gap-1 bg-white/10 text-white/80 text-xs font-medium px-3 py-1.5 rounded-full">
                {flagEmoji(profile.current_country)} {COUNTRIES[profile.current_country]?.name || profile.current_country}
              </span>
            )}
            {profile.instagram && (
              <span className="flex items-center gap-1 bg-white/10 text-white/80 text-xs font-medium px-3 py-1.5 rounded-full">
                📸 {profile.instagram.replace('@', '')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── SCROLLABLE CONTENT ── */}
      <div className="px-4 -mt-5 pb-32 space-y-4">

        {/* Stats strip */}
        <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] p-4 grid grid-cols-3 divide-x divide-x-reverse divide-gray-100">
          {[
            { value: eventsCount,                          label: 'אירועים',   emoji: '🎪' },
            { value: profile.visited_countries?.length || 0, label: 'מדינות',    emoji: '✈️' },
            { value: memberSince,                           label: 'חבר מאז',   emoji: '📅' },
          ].map(({ value, label, emoji }) => (
            <div key={label} className="flex flex-col items-center gap-0.5 px-2">
              <span className="text-lg">{emoji}</span>
              <span className="text-lg font-bold text-gray-900">{value}</span>
              <span className="text-[11px] text-gray-400 font-medium">{label}</span>
            </div>
          ))}
        </div>

        {/* Contact buttons (other user's profile) */}
        {!isOwnProfile && (
          <div className="space-y-3">
            <button
              onClick={() => onMessageUser?.(targetUserId!)}
              className="w-full h-14 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg shadow-cyan-200"
              style={{ background: 'linear-gradient(135deg, #20D5EC, #0891B2)' }}
            >
              <MessageCircle className="w-5 h-5" />
              שלח הודעה
            </button>

            {profile.instagram ? (
              <a
                href={profile.instagram.startsWith('http') ? profile.instagram : `https://instagram.com/${profile.instagram.replace('@', '')}`}
                target="_blank" rel="noopener noreferrer"
                className="w-full h-14 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg shadow-pink-200"
                style={{ background: 'linear-gradient(135deg, #F43F5E, #EC4899, #F97316)' }}
              >
                <Instagram className="w-5 h-5" />
                פתח באינסטגרם
              </a>
            ) : (
              <div className="w-full h-12 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center gap-2 text-gray-400 text-sm">
                <Instagram className="w-4 h-4" />
                אינסטגרם לא מחובר
              </div>
            )}
          </div>
        )}

        {/* Profile completion hint (own profile only, incomplete) */}
        {isOwnProfile && completion < 100 && (
          <div
            className="rounded-2xl p-4 flex items-center gap-3"
            style={{ background: 'linear-gradient(135deg, #E0F7FF, #CCF2FF)' }}
          >
            <div className="w-10 h-10 rounded-xl bg-[#20D5EC] flex items-center justify-center flex-shrink-0">
              <span className="text-white text-lg font-bold">{completion}%</span>
            </div>
            <div className="flex-1">
              <p className="text-[#0C7BA0] font-semibold text-sm">השלם את הפרופיל שלך</p>
              <p className="text-[#0C7BA0]/70 text-xs">פרופיל מלא מקבל פי 3 יותר חיבורים</p>
            </div>
          </div>
        )}

        {/* Languages */}
        {profile.languages && profile.languages.length > 0 && (
          <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.06)] p-5">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">שפות</h3>
            <div className="flex flex-wrap gap-2">
              {profile.languages.map((lang: string) => (
                <span
                  key={lang}
                  className="px-4 py-2 rounded-full text-sm font-semibold text-white shadow-sm"
                  style={{ background: 'linear-gradient(135deg, #20D5EC, #0891B2)' }}
                >
                  💬 {lang}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Interests */}
        {profile.interests && profile.interests.length > 0 && (
          <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.06)] p-5">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">תחומי עניין</h3>
            <div className="flex flex-wrap gap-2">
              {profile.interests.map((interest: string) => (
                <span
                  key={interest}
                  className="px-4 py-2 rounded-full text-sm font-semibold bg-gray-50 text-gray-800 border border-gray-100 hover:border-[#20D5EC] hover:bg-[#E0F7FF] transition-all cursor-default active:scale-95"
                >
                  {INTEREST_EMOJI[interest] || '✨'} {interest}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Visited countries */}
        {profile.visited_countries && profile.visited_countries.length > 0 && (
          <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.06)] p-5">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">
              ✈️ מדינות שביקרתי
            </h3>
            <div className="flex flex-wrap gap-2">
              {profile.visited_countries.map((c: string) => (
                <span key={c}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-blue-50 rounded-xl text-sm font-medium text-gray-700 border border-gray-100 hover:border-blue-200 transition-all active:scale-95 cursor-default"
                >
                  <span className="text-xl">{flagEmoji(c)}</span>
                  {COUNTRIES[c]?.name || c}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* My travel countries (own profile) */}
        {isOwnProfile && (
          <button
            onClick={() => setIsSelectingCountries(true)}
            className="w-full bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.06)] p-5 text-right active:scale-[0.98] transition-all"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">מדינות לטיול</p>
                <div className="flex gap-1 flex-wrap mt-2">
                  {(profile.selected_countries || []).slice(0, 8).map((c: string) => (
                    <span key={c} className="text-2xl">{flagEmoji(c)}</span>
                  ))}
                  {(profile.selected_countries || []).length > 8 && (
                    <span className="text-xs font-bold text-[#0891B2] bg-blue-50 px-2 py-1 rounded-full self-center">
                      +{(profile.selected_countries || []).length - 8}
                    </span>
                  )}
                  {(profile.selected_countries || []).length === 0 && (
                    <span className="text-sm text-gray-400">לא נבחרו מדינות</span>
                  )}
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                <Edit2 className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          </button>
        )}
      </div>

      {/* ── COUNTRY PICKER BOTTOM SHEET ── */}
      {isSelectingCountries && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end"
          onClick={() => setIsSelectingCountries(false)}>
          <div
            className="bg-white rounded-t-3xl w-full flex flex-col"
            style={{ maxHeight: '85dvh' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
              <h3 className="text-lg font-bold text-gray-900 mb-3">בחר מדינות לטיול</h3>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text" value={countrySearch}
                  onChange={e => setCountrySearch(e.target.value)}
                  placeholder="חיפוש מדינה..."
                  className="w-full bg-gray-50 rounded-full h-10 pr-10 pl-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#20D5EC]"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 grid grid-cols-2 gap-2">
              {Object.entries(COUNTRIES)
                .filter(([code, c]) =>
                  !countrySearch || c.name.includes(countrySearch) || code.toLowerCase().includes(countrySearch.toLowerCase())
                )
                .map(([code, c]) => {
                  const selected = selectedCountries.includes(code);
                  return (
                    <button key={code}
                      onClick={() => setSelectedCountries(
                        selected ? selectedCountries.filter(x => x !== code) : [...selectedCountries, code]
                      )}
                      className={`flex items-center gap-2 p-3 rounded-xl transition-all border text-right ${
                        selected ? 'border-[#20D5EC] bg-[#E0F7FF]' : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                      }`}
                    >
                      <span className="text-2xl">{c.flag}</span>
                      <span className={`text-sm font-medium flex-1 ${selected ? 'text-[#0C7BA0]' : 'text-gray-700'}`}>
                        {c.name}
                      </span>
                      {selected && <Check className="w-4 h-4 text-[#20D5EC] flex-shrink-0" />}
                    </button>
                  );
                })}
            </div>

            <div className="px-4 py-4 border-t border-gray-100 flex-shrink-0"
              style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
              <button
                onClick={saveCountries}
                className="w-full h-13 rounded-2xl font-bold text-white py-4 text-base active:scale-[0.98] transition-all shadow-lg"
                style={{ background: 'linear-gradient(135deg, #20D5EC, #0891B2)' }}
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
