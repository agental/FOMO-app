import { MapPin, Quote } from 'lucide-react';
import { UserAvatar } from './UserAvatar';
import { COUNTRIES } from '../utils/countries';
import { postPinStyle } from '../utils/postCategory';

/**
 * A community recommendation, told author-first — you see WHO recommended it before you see what.
 * The author was always joined in the query (`posts` → `users(display_name, avatar_url)`); it was
 * simply never rendered, which made the card feel anonymous.
 */
interface RecommendationCardProps {
  rec: any;
  onClick: () => void;
}

const HEEBO = "'Heebo', sans-serif";
const INK   = '#111827';
const MUTED = '#8B90A0';

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  const hr  = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (min < 1)  return 'עכשיו';
  if (min < 60) return `לפני ${min} דק׳`;
  if (hr < 24)  return `לפני ${hr} שעות`;
  if (day === 1) return 'אתמול';
  if (day < 7)  return `לפני ${day} ימים`;
  return new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
}

export function RecommendationCard({ rec, onClick }: RecommendationCardProps) {
  const author   = rec.users?.display_name || 'מטייל';
  const tag      = rec.tags?.[0];
  const place    = [rec.city, rec.country ? COUNTRIES[rec.country]?.name : null].filter(Boolean).join(' · ');
  const { emoji: catEmoji, color: catColor } = postPinStyle(rec); // same look as the map pin

  return (
    <div
      onClick={onClick}
      className="active:scale-[0.99] transition-transform"
      style={{ background: '#fff', borderRadius: 20, padding: 14, boxShadow: '0 2px 14px rgba(0,0,0,0.06)', cursor: 'pointer' }}
    >
      {/* who recommended it */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}>
        <UserAvatar
          userId={rec.user_id}
          displayName={author}
          avatarUrl={rec.users?.avatar_url || undefined}
          size="small"
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13.5, fontWeight: 800, color: INK, fontFamily: HEEBO, margin: 0, lineHeight: 1.3 }}>
            {author}
          </p>
          <p style={{ fontSize: 11.5, color: MUTED, fontFamily: HEEBO, fontWeight: 600, margin: '1px 0 0' }}>
            ממליץ על מקום · {timeAgo(rec.created_at)}
          </p>
        </div>
        {tag && (
          <span style={{
            flexShrink: 0, fontSize: 10.5, fontWeight: 800, color: '#EA580C', background: '#FFF3E9',
            borderRadius: 20, padding: '3px 9px', fontFamily: HEEBO,
          }}>
            {tag}
          </span>
        )}
      </div>

      {/* what they said */}
      <div style={{ display: 'flex', gap: 12 }}>
        {rec.image_url ? (
          <img
            src={rec.image_url}
            alt=""
            loading="lazy"
            style={{ width: 82, height: 82, borderRadius: 16, objectFit: 'cover', flexShrink: 0, background: '#F3F4F6' }}
          />
        ) : (
          <div style={{
            width: 82, height: 82, borderRadius: 16, flexShrink: 0, fontSize: 34,
            background: `${catColor}18`, display: 'grid', placeItems: 'center',
          }}>
            {catEmoji}
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          {rec.place_name && (
            <p style={{
              fontSize: 15, fontWeight: 800, color: INK, fontFamily: HEEBO, margin: '0 0 4px',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {rec.place_name}
            </p>
          )}

          <p style={{
            fontSize: 12.5, color: '#5B6070', fontFamily: "'Rubik', sans-serif", lineHeight: 1.5,
            margin: '0 0 6px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            <Quote size={11} strokeWidth={2.5} style={{ display: 'inline', color: '#D8DBE2', marginLeft: 3, verticalAlign: '-1px' }} />
            {rec.content}
          </p>

          {place && (
            <span style={{
              fontSize: 11.5, color: MUTED, fontWeight: 600, fontFamily: HEEBO,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <MapPin size={11} strokeWidth={2.2} />
              {place}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
