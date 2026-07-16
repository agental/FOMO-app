import { useEffect, useState } from 'react';
import { X, ChevronLeft } from 'lucide-react';
import type { GuideSection, GuideItem } from '../data/countryGuides';

/**
 * The list of items inside one guide section ("8 אפליקציות", "4 רשתות סים"…).
 * Each row opens that item's full description (GuideItemSheet), which renders above.
 */
interface GuideSectionSheetProps {
  section: GuideSection | null;
  onClose: () => void;
  onOpenItem: (item: GuideItem) => void;
}

const HEEBO = "'Heebo', sans-serif";
const INK = '#111827';
const MUTED = '#8B90A0';

export function GuideSectionSheet({ section, onClose, onOpenItem }: GuideSectionSheetProps) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!section) { setEntered(false); return; }
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [section]);

  if (!section) return null;

  const color = section.color;
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
          maxHeight: '82vh',
          transform: entered ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s cubic-bezier(0.22,1,0.3,1)',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
        }}
        dir="rtl"
      >
        <div style={{ flexShrink: 0, padding: '10px 20px 12px' }}>
          <div className="w-9 h-1 rounded-full bg-gray-300 mx-auto" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
            <span style={{
              width: 46, height: 46, borderRadius: 14, flexShrink: 0, fontSize: 23,
              background: `${color}18`, display: 'grid', placeItems: 'center',
            }}>
              {section.emoji}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 19, fontWeight: 900, color: INK, fontFamily: HEEBO, lineHeight: 1.15 }}>
                {section.title}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 12.5, fontWeight: 700, color: MUTED, fontFamily: HEEBO }}>
                {section.subtitle || `${section.items.length} פריטים`}
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

        <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '4px 14px 22px', overscrollBehavior: 'contain' }}>
          {section.items.map((item, i) => (
            <button
              key={item.id}
              onClick={() => onOpenItem(item)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 13, padding: '12px 8px',
                background: 'none', border: 'none', borderTop: i > 0 ? '1px solid #F0F1F4' : 'none',
                cursor: 'pointer', textAlign: 'right',
              }}
            >
              <span style={{
                width: 46, height: 46, borderRadius: 14, flexShrink: 0, fontSize: 24,
                background: item.image ? '#F1F2F5' : `${color}14`,
                display: 'grid', placeItems: 'center', overflow: 'hidden',
              }}>
                {item.image
                  ? <img src={item.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : (item.emoji || '📌')}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{
                    fontSize: 15.5, fontWeight: 800, color: INK, fontFamily: HEEBO,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {item.name}
                  </span>
                  {item.tag && (
                    <span style={{
                      fontSize: 10.5, fontWeight: 800, color, background: `${color}16`,
                      borderRadius: 20, padding: '1px 8px', flexShrink: 0, fontFamily: HEEBO,
                    }}>
                      {item.tag}
                    </span>
                  )}
                </span>
                {item.subtitle && (
                  <span style={{
                    display: 'block', fontSize: 12.5, color: MUTED, fontFamily: "'Rubik',sans-serif", marginTop: 2,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {item.subtitle}
                  </span>
                )}
              </span>
              <ChevronLeft size={18} color="#C3C8D2" style={{ flexShrink: 0 }} />
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
