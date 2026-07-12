import { Heart, Star } from 'lucide-react';
import { type EnrichedPlace, formatDistance, statusText } from '../utils/placeFeed';

/**
 * A place card for the home feed. `list` is the full-width row; `compact` is the tile used inside
 * the horizontal carousels. Everything shown here (category, rating, distance, open status, the
 * pin's emoji + colour, the "new" flag) comes from data that was already being stored.
 */
interface PlaceCardProps {
  place: EnrichedPlace;
  variant?: 'list' | 'compact';
  saved?: boolean;
  onToggleSave?: () => void;
  onClick: () => void;
}

const HEEBO = "'Heebo', sans-serif";

function NewBadge() {
  return (
    <span style={{
      position: 'absolute', top: 6, right: 6,
      background: 'linear-gradient(135deg,#F97316,#EA580C)', color: '#fff',
      fontSize: 9.5, fontWeight: 800, padding: '2px 6px', borderRadius: 6,
      fontFamily: HEEBO, boxShadow: '0 2px 6px rgba(249,115,22,0.4)',
    }}>
      חדש
    </span>
  );
}

function SaveButton({ saved, onToggle, floating }: { saved: boolean; onToggle: () => void; floating?: boolean }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onToggle(); }}
      aria-label={saved ? 'הסר משמורים' : 'שמור מקום'}
      style={{
        ...(floating
          ? { position: 'absolute', top: 6, left: 6, width: 30, height: 30, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(4px)', boxShadow: '0 2px 8px rgba(0,0,0,0.18)' }
          : { width: 34, height: 34, background: 'transparent' }),
        flexShrink: 0, borderRadius: '50%', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'transform 0.15s',
      }}
      onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.88)')}
      onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
    >
      <Heart
        size={17}
        strokeWidth={2.2}
        color={saved ? '#EF4444' : '#9CA3AF'}
        fill={saved ? '#EF4444' : 'none'}
      />
    </button>
  );
}

export function PlaceCard({ place: p, variant = 'list', saved = false, onToggleSave, onClick }: PlaceCardProps) {
  const distance = formatDistance(p.distanceKm);
  const status   = statusText(p.status);
  const isOpen   = p.status?.isOpen;

  /* ── compact tile (carousels) ── */
  if (variant === 'compact') {
    return (
      <div onClick={onClick} style={{ width: 168, flexShrink: 0, cursor: 'pointer', scrollSnapAlign: 'start' }}>
        <div style={{
          position: 'relative', width: '100%', height: 112, borderRadius: 16, overflow: 'hidden',
          background: p.photo ? '#F3F4F6' : `${p.color}18`,
          display: 'grid', placeItems: 'center',
          boxShadow: '0 2px 10px rgba(0,0,0,0.07)',
        }}>
          {p.photo
            ? <img src={p.photo} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            : <span style={{ fontSize: 40 }}>{p.emoji}</span>}
          {p.isNew && <NewBadge />}
          {onToggleSave && <SaveButton saved={saved} onToggle={onToggleSave} floating />}
        </div>

        <p style={{
          fontSize: 13.5, fontWeight: 800, color: '#111827', fontFamily: HEEBO,
          margin: '8px 0 2px', lineHeight: 1.3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {p.name}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: '#9CA3AF', fontFamily: HEEBO, fontWeight: 600 }}>
          {p.rating != null && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Star size={10} strokeWidth={2} color="#FACC15" fill="#FACC15" />
              {p.rating.toFixed(1)}
            </span>
          )}
          {p.rating != null && distance && <span style={{ color: '#E5E7EB' }}>·</span>}
          {distance && <span>{distance}</span>}
        </div>

        {status && (
          <p style={{ fontSize: 11, fontWeight: 700, marginTop: 2, fontFamily: HEEBO, color: isOpen ? '#16A34A' : '#EF4444' }}>
            {isOpen ? 'פתוח' : 'סגור'}
          </p>
        )}
      </div>
    );
  }

  /* ── list row ── */
  return (
    <div
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 14px', cursor: 'pointer' }}
    >
      {/* photo / emoji */}
      <div style={{
        position: 'relative', width: 92, height: 92, borderRadius: 18, flexShrink: 0, overflow: 'hidden',
        background: p.photo ? '#F3F4F6' : `${p.color}18`,
        display: 'grid', placeItems: 'center',
      }}>
        {p.photo
          ? <img src={p.photo} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          : <span style={{ fontSize: 38 }}>{p.emoji}</span>}
        {p.isNew && <NewBadge />}
      </div>

      {/* text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 15.5, fontWeight: 800, color: '#111827', fontFamily: HEEBO,
          margin: '0 0 5px', lineHeight: 1.3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {p.name}
        </p>

        {/* category · rating · distance */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
          {p.category && (
            <span style={{
              fontSize: 11, fontWeight: 800, color: p.color, background: `${p.color}18`,
              padding: '2px 7px', borderRadius: 7, fontFamily: HEEBO, whiteSpace: 'nowrap',
            }}>
              {p.category}
            </span>
          )}
          {p.rating != null && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: '#6B7280', fontWeight: 700, fontFamily: HEEBO }}>
              <Star size={11} strokeWidth={2} color="#FACC15" fill="#FACC15" />
              {p.rating.toFixed(1)}
              {p.reviewCount ? <span style={{ color: '#C0C4CC', fontWeight: 600 }}>({p.reviewCount})</span> : null}
            </span>
          )}
          {distance && (
            <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600, fontFamily: HEEBO }}>· {distance}</span>
          )}
        </div>

        {/* open status / city */}
        {status ? (
          <p style={{ fontSize: 12, fontWeight: 700, fontFamily: HEEBO, margin: 0, color: isOpen ? '#16A34A' : '#EF4444' }}>
            {status}
          </p>
        ) : p.city ? (
          <p style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600, fontFamily: HEEBO, margin: 0 }}>{p.city}</p>
        ) : null}
      </div>

      {onToggleSave && <SaveButton saved={saved} onToggle={onToggleSave} />}
    </div>
  );
}
