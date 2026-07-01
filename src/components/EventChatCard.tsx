import { Calendar, MapPin, ChevronLeft } from 'lucide-react';
import { COUNTRIES } from '../utils/countries';
import type { EventPayload } from '../utils/eventMessage';

const CATEGORY_FALLBACK = 'https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg?auto=compress&cs=tinysrgb&w=600';

/**
 * A shared-event message rendered as a glassmorphism card with the event image,
 * title, date and place, plus a "view event" action. Tapping opens the event.
 */
export function EventChatCard({ data, onClick }: { data: EventPayload; onClick: () => void }) {
  const place = [data.city, data.country ? COUNTRIES[data.country]?.name : null].filter(Boolean).join(', ');
  const when = data.date
    ? new Date(data.date).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })
    : '';
  const bg = data.image || CATEGORY_FALLBACK;

  return (
    <button
      onClick={onClick}
      dir="rtl"
      style={{
        width: 250, borderRadius: 20, overflow: 'hidden', position: 'relative',
        border: 'none', padding: 0, cursor: 'pointer', textAlign: 'right', display: 'block',
        boxShadow: '0 6px 22px rgba(0,0,0,0.18)',
      }}
    >
      {/* Image */}
      <div style={{ position: 'relative', height: 150 }}>
        <img src={bg} alt={data.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.05) 55%, transparent 100%)' }} />
        <span style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(4px)', borderRadius: 20, padding: '3px 9px', fontSize: 11, fontWeight: 800, color: '#EA580C', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'Heebo, sans-serif' }}>
          {data.emoji || '📅'} אירוע
        </span>
      </div>

      {/* Glass footer */}
      <div style={{
        padding: '10px 12px 11px',
        background: 'rgba(255,255,255,0.6)',
        backdropFilter: 'blur(18px) saturate(180%)',
        WebkitBackdropFilter: 'blur(18px) saturate(180%)',
        borderTop: '1px solid rgba(255,255,255,0.5)',
      }}>
        <p style={{ fontSize: 15, fontWeight: 800, color: '#111827', margin: 0, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'Heebo, sans-serif' }}>
          {data.title}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
          {when && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11.5, color: '#6B7280', fontWeight: 600 }}>
              <Calendar size={12} strokeWidth={2.2} /> {when}
            </span>
          )}
          {place && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11.5, color: '#6B7280', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <MapPin size={12} strokeWidth={2.2} /> {place}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          <span style={{ fontSize: 12.5, fontWeight: 800, color: '#EA580C', fontFamily: 'Heebo, sans-serif' }}>צפה באירוע</span>
          <ChevronLeft size={16} style={{ color: '#EA580C' }} strokeWidth={2.5} />
        </div>
      </div>
    </button>
  );
}
