import { useEffect, useState } from 'react';
import { X, ExternalLink, Check } from 'lucide-react';
import type { GuideItem } from '../data/countryGuides';

/**
 * The full description of one guide item (an app, a SIM, a tip…). Opens above the
 * section list. Renders the item's paragraphs, optional quick-fact bullets, and an
 * optional website link. Icon is the item's emoji on a tile in the section's colour.
 */
interface GuideItemSheetProps {
  item: GuideItem | null;
  color: string;
  onClose: () => void;
}

const HEEBO = "'Heebo', sans-serif";
const RUBIK = "'Rubik', sans-serif";
const INK = '#111827';
const MUTED = '#8B90A0';

export function GuideItemSheet({ item, color, onClose }: GuideItemSheetProps) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!item) { setEntered(false); return; }
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [item]);

  if (!item) return null;

  const close = () => { setEntered(false); setTimeout(onClose, 240); };
  const paragraphs = item.description.split('\n').filter(Boolean);

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-[60]"
        style={{ opacity: entered ? 1 : 0, transition: 'opacity 0.24s ease' }}
        onClick={close}
      />
      <div
        className="fixed left-0 right-0 bottom-0 bg-white rounded-t-3xl z-[60] flex flex-col"
        style={{
          maxHeight: '86vh',
          transform: entered ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.32s cubic-bezier(0.22,1,0.3,1)',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.2)',
        }}
        dir="rtl"
      >
        {/* Pinned header */}
        <div style={{ flexShrink: 0, padding: '10px 20px 14px', borderBottom: '1px solid #F2F3F6' }}>
          <div className="w-9 h-1 rounded-full bg-gray-300 mx-auto" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginTop: 14 }}>
            <span style={{
              width: 56, height: 56, borderRadius: 17, flexShrink: 0, fontSize: 28,
              background: item.image ? '#F1F2F5' : `${color}18`,
              display: 'grid', placeItems: 'center', overflow: 'hidden',
              boxShadow: `inset 0 0 0 1.5px ${color}22`,
            }}>
              {item.image
                ? <img src={item.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (item.emoji || '📌')}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: 21, fontWeight: 900, color: INK, fontFamily: HEEBO, lineHeight: 1.15 }}>
                  {item.name}
                </h2>
                {item.tag && (
                  <span style={{
                    fontSize: 11, fontWeight: 800, color, background: `${color}16`,
                    borderRadius: 20, padding: '2px 9px', fontFamily: HEEBO,
                  }}>
                    {item.tag}
                  </span>
                )}
              </div>
              {item.subtitle && (
                <p style={{ margin: '3px 0 0', fontSize: 13.5, fontWeight: 600, color: MUTED, fontFamily: HEEBO }}>
                  {item.subtitle}
                </p>
              )}
            </div>
            <button
              onClick={close} aria-label="סגור"
              style={{
                width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: '#F1F2F5', display: 'grid', placeItems: 'center', flexShrink: 0, alignSelf: 'flex-start',
              }}
            >
              <X size={16} strokeWidth={2.6} color="#6C727E" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '18px 20px 26px', overscrollBehavior: 'contain' }}>
          {paragraphs.map((p, i) => (
            <p key={i} style={{
              margin: i === 0 ? 0 : '13px 0 0', fontSize: 15, lineHeight: 1.65, color: '#374151',
              fontFamily: RUBIK, whiteSpace: 'pre-line',
            }}>
              {p}
            </p>
          ))}

          {item.bullets && item.bullets.length > 0 && (
            <div style={{ marginTop: 18, background: '#F8F9FB', borderRadius: 16, padding: '14px 16px' }}>
              {item.bullets.map((b, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: i === 0 ? 0 : 10 }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                    background: `${color}1A`, display: 'grid', placeItems: 'center',
                  }}>
                    <Check size={12} strokeWidth={3} color={color} />
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: INK, fontFamily: HEEBO, lineHeight: 1.4 }}>
                    {b}
                  </span>
                </div>
              ))}
            </div>
          )}

          {item.link && (
            <a
              href={item.link} target="_blank" rel="noreferrer"
              style={{
                marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                height: 52, borderRadius: 16, background: color, color: '#fff',
                fontSize: 15.5, fontWeight: 800, fontFamily: HEEBO, textDecoration: 'none',
                boxShadow: `0 8px 22px ${color}4D`,
              }}
            >
              <ExternalLink size={17} strokeWidth={2.4} />
              {item.linkLabel || 'למידע נוסף'}
            </a>
          )}
        </div>
      </div>
    </>
  );
}
