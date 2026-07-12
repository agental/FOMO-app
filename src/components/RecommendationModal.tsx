import { useState, useEffect } from 'react';
import { X, Star, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { COUNTRIES } from '../utils/countries';
import { UserAvatar } from './UserAvatar';
import { postPinStyle } from '../utils/postCategory';

/**
 * A community recommendation, opened from the home feed OR from its bubble on the map.
 * Was inlined in HomeScreen; extracted so the map can open the exact same thing.
 * Star ratings live in `post_ratings` (the table may not exist yet — failures are non-fatal).
 */
interface RecommendationModalProps {
  rec: any;
  currentUserId?: string | null;
  onClose: () => void;
  onOpenMapAt?: (lat: number, lng: number) => void;
}

export function RecommendationModal({ rec, currentUserId, onClose, onOpenMapAt }: RecommendationModalProps) {
  const [rating, setRating]   = useState<{ avg: number | null; count: number; mine: number }>({ avg: null, count: 0, mine: 0 });
  const [bump, setBump]       = useState(0);

  const loadRatings = async (postId: string) => {
    try {
      const { data, error } = await supabase.from('post_ratings').select('rating, user_id').eq('post_id', postId);
      if (error || !data) return;
      const count = data.length;
      const avg   = count ? data.reduce((s, r) => s + (r.rating || 0), 0) / count : null;
      const mine  = (currentUserId && data.find(r => r.user_id === currentUserId)?.rating) || 0;
      setRating({ avg, count, mine });
    } catch { /* post_ratings may not exist yet */ }
  };

  useEffect(() => { if (rec?.id) loadRatings(rec.id); }, [rec?.id]);

  const rate = async (n: number) => {
    if (!currentUserId || !rec) return;
    setRating(prev => ({ ...prev, mine: n }));
    setBump(b => b + 1);
    try {
      const { error } = await supabase.from('post_ratings').upsert(
        { post_id: rec.id, user_id: currentUserId, rating: n },
        { onConflict: 'post_id,user_id' },
      );
      if (error) { console.error('rate error:', error.message); return; }
      loadRatings(rec.id);
    } catch (err) { console.error('rate error:', err); }
  };

  if (!rec) return null;

  const author   = rec.users?.display_name;
  const { emoji: catEmoji, color: catColor } = postPinStyle(rec); // same look as the map pin
  const place    = [rec.city, rec.country ? COUNTRIES[rec.country]?.name : null].filter(Boolean).join(', ');

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end justify-center animate-fade-in" dir="rtl" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md rounded-t-[28px] animate-slide-up overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
      >
        {rec.image_url ? (
          <div style={{ position: 'relative', height: 200 }}>
            <img src={rec.image_url} alt={rec.place_name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <button
              onClick={onClose} aria-label="סגור"
              style={{ position: 'absolute', top: 14, left: 14, width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        ) : (
          <div className="relative pt-3">
            <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto" />
            <button onClick={onClose} aria-label="סגור" className="absolute top-2 left-4 w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        )}

        <div className="px-6 pt-4">
          {/* who recommended it */}
          {author && (
            <div className="flex items-center gap-2.5 mb-3">
              <UserAvatar userId={rec.user_id} displayName={author} avatarUrl={rec.users?.avatar_url || undefined} size="small" />
              <div>
                <p className="text-[14px] font-black text-gray-900" style={{ fontFamily: 'Heebo, sans-serif' }}>{author}</p>
                <p className="text-[11.5px] font-semibold" style={{ color: '#8B90A0', fontFamily: 'Heebo, sans-serif' }}>ממליץ על המקום הזה</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 mb-2">
            <span
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-[19px]"
              style={{ background: `${catColor}1F`, boxShadow: `inset 0 0 0 1.5px ${catColor}` }}
            >
              {catEmoji}
            </span>
            <h2 className="text-2xl font-black text-gray-900" style={{ fontFamily: 'Heebo, sans-serif' }}>
              {rec.place_name || 'המלצה'}
            </h2>
          </div>

          {rec.tags?.[0] && (
            <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 700, color: catColor, background: `${catColor}18`, borderRadius: 20, padding: '3px 12px', fontFamily: 'Heebo, sans-serif' }}>
              {rec.tags[0]}
            </span>
          )}

          <p className="text-[15px] text-gray-600 leading-relaxed mt-3" style={{ fontFamily: 'Rubik, sans-serif' }}>{rec.content}</p>

          {place && (
            <div className="flex items-center gap-2 mt-4 text-[14px] font-semibold" style={{ color: '#6B7280', fontFamily: 'Rubik, sans-serif' }}>
              <MapPin className="w-4 h-4" style={{ color: '#F97316' }} />
              {place}
            </div>
          )}
        </div>

        {/* rating */}
        <div className="px-6 pt-5">
          <style>{`
            @keyframes recStarPop { 0% { transform: scale(0.5); } 55% { transform: scale(1.28); } 100% { transform: scale(1); } }
            @media (prefers-reduced-motion: reduce) { .rec-star { animation: none !important; } }
          `}</style>
          <div className="rounded-2xl border border-gray-100 px-4 py-3.5" style={{ background: '#FAFAFA' }}>
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-black text-gray-700" style={{ fontFamily: 'Heebo, sans-serif' }}>
                {rating.mine > 0 ? 'הדירוג שלך' : 'דרגו את המקום'}
              </span>
              {rating.avg != null && rating.count > 0 && (
                <span className="flex items-center gap-1 text-[13px] font-bold text-gray-400" style={{ fontFamily: 'Rubik, sans-serif' }}>
                  <Star className="w-3.5 h-3.5" style={{ color: '#F97316' }} fill="#F97316" />
                  {rating.avg.toFixed(1)} · {rating.count}
                </span>
              )}
            </div>
            <div key={bump} className="flex gap-2 mt-2.5" style={{ direction: 'ltr', justifyContent: 'flex-end' }}>
              {[1, 2, 3, 4, 5].map(n => {
                const filled = n <= rating.mine;
                return (
                  <button
                    key={n} type="button" onClick={() => rate(n)} aria-label={`דרג ${n} מתוך 5`} className="rec-star"
                    style={{ background: 'none', border: 'none', padding: 2, cursor: currentUserId ? 'pointer' : 'default', lineHeight: 0, animation: filled ? `recStarPop 0.42s cubic-bezier(0.34,1.56,0.64,1) ${(n - 1) * 70}ms both` : 'none' }}
                  >
                    <Star className="w-9 h-9" strokeWidth={2} style={{ color: filled ? '#F97316' : '#D1D5DB', fill: filled ? '#F97316' : 'none', transition: 'color 0.18s, fill 0.18s' }} />
                  </button>
                );
              })}
            </div>
            <p className="text-[11.5px] mt-2" style={{ color: rating.mine > 0 ? '#16A34A' : '#9CA3AF', fontFamily: 'Rubik, sans-serif', transition: 'color 0.2s' }}>
              {!currentUserId ? 'התחברו כדי לדרג' : rating.mine > 0 ? 'תודה על הדירוג! 🎉' : 'אופציונלי — לא חובה לדרג'}
            </p>
          </div>
        </div>

        {onOpenMapAt && rec.latitude != null && rec.longitude != null && (
          <div className="px-5 pt-5">
            <button
              onClick={() => { const r = rec; onClose(); onOpenMapAt(r.latitude, r.longitude); }}
              className="w-full h-14 rounded-2xl font-black text-white active:scale-[0.98] transition flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', boxShadow: '0 8px 24px rgba(249,115,22,0.35)', fontFamily: 'Heebo, sans-serif' }}
            >
              <MapPin className="w-5 h-5" /> פתח במפה
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
