import { useEffect, useState } from 'react';
import { X, ChevronLeft } from 'lucide-react';
import { UserAvatar } from './UserAvatar';
import { postPinStyle } from '../utils/postCategory';

/**
 * Opened when you tap a STACK of recommendations sitting on one place — "5 המלצות על חוף הפלמינגו".
 * Lists who recommended it and their one-liner; tapping a row opens that recommendation in full.
 */
interface RecommendationListSheetProps {
  recs: any[] | null;
  onClose: () => void;
  onOpen: (rec: any) => void;
}

const HEEBO = "'Heebo', sans-serif";
const INK   = '#111827';
const MUTED = '#8B90A0';

export function RecommendationListSheet({ recs, onClose, onOpen }: RecommendationListSheetProps) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!recs) { setEntered(false); return; }
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [recs]);

  if (!recs) return null;

  const placeName = recs[0]?.place_name || 'המקום הזה';
  const { color, emoji } = postPinStyle(recs[0] || {});
  const close = () => { setEntered(false); setTimeout(onClose, 240); };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/45 z-[58]"
        style={{ opacity: entered ? 1 : 0, transition: 'opacity 0.24s ease' }}
        onClick={close}
      />
      <div
        className="fixed left-0 right-0 bottom-0 bg-white rounded-t-3xl z-[58] flex flex-col"
        style={{
          maxHeight: '78vh',
          transform: entered ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s cubic-bezier(0.22,1,0.3,1)',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
        }}
        dir="rtl"
      >
        <div style={{ flexShrink: 0, padding: '10px 20px 12px' }}>
          <div className="w-9 h-1 rounded-full bg-gray-300 mx-auto" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 14 }}>
            <span style={{
              width: 42, height: 42, borderRadius: 13, flexShrink: 0, fontSize: 20,
              background: `${color}1A`, display: 'grid', placeItems: 'center',
            }}>
              {emoji}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: MUTED, fontFamily: HEEBO }}>
                {recs.length} המלצות על
              </p>
              <p style={{
                margin: 0, fontSize: 18, fontWeight: 900, color: INK, fontFamily: HEEBO,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {placeName}
              </p>
            </div>
            <button
              onClick={close} aria-label="סגור"
              style={{
                width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: '#F1F2F5', display: 'grid', placeItems: 'center', flexShrink: 0,
              }}
            >
              <X size={16} strokeWidth={2.6} color="#6C727E" />
            </button>
          </div>
        </div>

        <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '0 14px 20px', overscrollBehavior: 'contain' }}>
          {recs.map((r, i) => {
            const author = r.users?.display_name || 'מטייל';
            return (
              <button
                key={r.id ?? i}
                onClick={() => onOpen(r)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 8px',
                  background: 'none', border: 'none', borderTop: i > 0 ? '1px solid #F0F1F4' : 'none',
                  cursor: 'pointer', textAlign: 'right',
                }}
              >
                <UserAvatar userId={r.user_id} displayName={author} avatarUrl={r.users?.avatar_url || undefined} size="medium" />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontSize: 14.5, fontWeight: 800, color: INK, fontFamily: HEEBO,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {author}
                    </span>
                    {r.tags?.[0] && (
                      <span style={{ fontSize: 11, fontWeight: 700, color, background: `${color}16`, borderRadius: 20, padding: '1px 8px', flexShrink: 0, fontFamily: HEEBO }}>
                        {r.tags[0]}
                      </span>
                    )}
                  </span>
                  {r.content && (
                    <span style={{
                      display: 'block', fontSize: 12.5, color: MUTED, fontFamily: "'Rubik',sans-serif", marginTop: 2,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {r.content}
                    </span>
                  )}
                </span>
                <ChevronLeft size={17} color="#C3C8D2" style={{ flexShrink: 0 }} />
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
