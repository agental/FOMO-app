import { useState, useEffect, useRef } from 'react';
import { X, Check, Search } from 'lucide-react';

const CATEGORIES = [
  { id: 'parties',   label: 'מסיבות', emoji: '🎉', color: '#A855F7' },
  { id: 'sports',    label: 'אטרקציות', emoji: '🎡', color: '#0EA5E9' },
  { id: 'treks',     label: 'טיולים', emoji: '🏕️', color: '#22C55E' },
  { id: 'workshops', label: 'סדנאות', emoji: '🧘', color: '#FACC15' },
];

const DATE_OPTIONS = [
  { id: 'today',    label: 'היום' },
  { id: 'tomorrow', label: 'מחר'  },
  { id: 'week',     label: 'השבוע' },
];

interface FilterSheetProps {
  visible: boolean;
  initialCategory: string | null;
  initialDate: string | null;
  initialSearch?: string;
  onApply: (category: string | null, date: string | null, search: string) => void;
  onClose: () => void;
}

export function FilterSheet({ visible, initialCategory, initialDate, initialSearch = '', onApply, onClose }: FilterSheetProps) {
  const [category, setCategory] = useState<string | null>(initialCategory);
  const [date,     setDate]     = useState<string | null>(initialDate);
  const [search,   setSearch]   = useState(initialSearch);
  const [mounted,  setMounted]  = useState(false);

  // Drag state
  const [dragY,    setDragY]    = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStart  = useRef<number>(0);
  const sheetRef   = useRef<HTMLDivElement>(null);

  /* sync local state when sheet re-opens */
  useEffect(() => {
    if (visible) {
      setCategory(initialCategory);
      setDate(initialDate);
      setSearch(initialSearch);
      setDragY(0);
      requestAnimationFrame(() => setMounted(true));
    } else {
      setMounted(false);
    }
  }, [visible, initialCategory, initialDate, initialSearch]);

  if (!visible) return null;

  const handleApply = () => {
    onApply(category, date, search);
    onClose();
  };

  const handleClear = () => {
    setCategory(null);
    setDate(null);
    setSearch('');
  };

  const activeCount = (category ? 1 : 0) + (date ? 1 : 0) + (search ? 1 : 0);

  /* ── drag handlers ── */
  const onPointerDown = (e: React.PointerEvent) => {
    dragStart.current = e.clientY;
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const delta = e.clientY - dragStart.current;
    setDragY(Math.max(0, delta)); // only allow downward drag
  };

  const onPointerUp = () => {
    setDragging(false);
    const sheetH = sheetRef.current?.offsetHeight ?? 300;
    if (dragY > sheetH * 0.35) {
      // dragged past 35% of sheet height → dismiss
      onClose();
    } else {
      // snap back
      setDragY(0);
    }
  };

  const sheetTransform = mounted
    ? `translateY(${dragY}px)`
    : 'translateY(100%)';

  const backdropOpacity = mounted
    ? Math.max(0, 1 - dragY / ((sheetRef.current?.offsetHeight ?? 300) * 0.6))
    : 0;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 800 }} dir="rtl">

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.45)',
          opacity:    backdropOpacity,
          transition: dragging ? 'none' : 'opacity 0.28s ease',
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        style={{
          position:  'absolute', bottom: 0, left: 0, right: 0,
          background: '#FFFFFF',
          borderRadius: '28px 28px 0 0',
          boxShadow:  '0 -12px 60px rgba(0,0,0,0.18)',
          transform:  sheetTransform,
          transition: dragging ? 'none' : 'transform 0.38s cubic-bezier(0.22,1,0.36,1)',
          paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
          overflow: 'hidden',
          touchAction: 'none',
        }}
      >
        {/* Drag handle — touch target for swipe-to-close */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', cursor: 'grab' }}
        >
          <div style={{ width: 40, height: 4, borderRadius: 9999, background: '#E2E8F0' }} />
        </div>

        {/* Header — also draggable */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 20px 18px',
            cursor: 'grab',
            userSelect: 'none',
          }}
        >
          <h2 style={{
            fontSize: 20, fontWeight: 800, color: '#111827',
            fontFamily: "'Heebo', sans-serif", margin: 0,
          }}>סינון</h2>

          {activeCount > 0 && (
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={handleClear}
              style={{
                fontSize: 13, fontWeight: 600, color: '#F97316',
                background: '#FFF7ED', border: '1px solid #FED7AA',
                borderRadius: 9999, padding: '4px 12px',
                cursor: 'pointer', fontFamily: "'Heebo', sans-serif",
              }}
            >
              נקה הכל
            </button>
          )}
        </div>

        {/* ── Search section ── */}
        <div style={{ padding: '0 20px 20px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: '#F5F5F5', borderRadius: 16,
            padding: '0 14px', height: 46,
            border: search ? '1.5px solid #F97316' : '1.5px solid transparent',
          }}>
            <Search size={16} color={search ? '#F97316' : '#9CA3AF'} strokeWidth={2} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="חפש אירועים, מקומות..."
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                fontSize: 14, fontFamily: "'Heebo', sans-serif", color: '#111827',
                textAlign: 'right',
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  width: 18, height: 18, borderRadius: '50%', background: '#D1D5DB',
                  border: 'none', cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >
                <X size={11} color="#fff" strokeWidth={3} />
              </button>
            )}
          </div>
        </div>

        {/* ── Category section ── */}
        <div style={{ padding: '0 20px 22px' }}>
          <p style={{
            fontSize: 12, fontWeight: 700, color: '#9CA3AF',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            fontFamily: "'Heebo', sans-serif", margin: '0 0 12px',
          }}>קטגוריה</p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
          }}>
            {CATEGORIES.map(cat => {
              const active = category === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setCategory(active ? null : cat.id)}
                  style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: 6, padding: '14px 8px',
                    borderRadius: 18,
                    border: active ? `2px solid ${cat.color}` : '1.5px solid #F3F4F6',
                    background: active ? `${cat.color}12` : '#FAFAFA',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    position: 'relative',
                  }}
                >
                  {active && (
                    <div style={{
                      position: 'absolute', top: 7, left: 7,
                      width: 16, height: 16, borderRadius: '50%',
                      background: cat.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Check size={9} color="#fff" strokeWidth={3} />
                    </div>
                  )}
                  <span style={{ fontSize: 26, lineHeight: 1 }}>{cat.emoji}</span>
                  <span style={{
                    fontSize: 12, fontWeight: 700,
                    color: active ? cat.color : '#6B7280',
                    fontFamily: "'Heebo', sans-serif",
                  }}>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: '#F3F4F6', margin: '0 20px 20px' }} />

        {/* ── Date section ── */}
        <div style={{ padding: '0 20px 28px' }}>
          <p style={{
            fontSize: 12, fontWeight: 700, color: '#9CA3AF',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            fontFamily: "'Heebo', sans-serif", margin: '0 0 12px',
          }}>תאריך</p>

          <div style={{ display: 'flex', gap: 10 }}>
            {DATE_OPTIONS.map(opt => {
              const active = date === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setDate(active ? null : opt.id)}
                  style={{
                    flex: 1, padding: '11px 8px',
                    borderRadius: 14,
                    border: active ? '2px solid #F97316' : '1.5px solid #F3F4F6',
                    background: active
                      ? 'linear-gradient(135deg, #FFF7ED, #FFEDD5)'
                      : '#FAFAFA',
                    cursor: 'pointer',
                    fontSize: 13, fontWeight: 700,
                    color: active ? '#EA580C' : '#6B7280',
                    fontFamily: "'Heebo', sans-serif",
                    transition: 'all 0.18s ease',
                    boxShadow: active ? '0 2px 8px rgba(249,115,22,0.18)' : 'none',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Bottom actions ── */}
        <div style={{
          display: 'flex', gap: 12,
          padding: '0 20px',
        }}>
          {/* Close */}
          <button
            onClick={onClose}
            style={{
              width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
              background: '#F3F4F6', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'background 0.15s',
            }}
          >
            <X size={20} color="#374151" strokeWidth={2} />
          </button>

          {/* Apply */}
          <button
            onClick={handleApply}
            style={{
              flex: 1, height: 52, borderRadius: 16, border: 'none',
              background: 'linear-gradient(135deg, #F97316, #EA580C)',
              color: '#fff', fontSize: 16, fontWeight: 800,
              fontFamily: "'Heebo', sans-serif",
              cursor: 'pointer',
              boxShadow: '0 4px 18px rgba(249,115,22,0.38)',
              transition: 'all 0.18s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {activeCount > 0 && (
              <span style={{
                background: 'rgba(255,255,255,0.25)',
                borderRadius: 9999, width: 22, height: 22,
                fontSize: 12, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{activeCount}</span>
            )}
            החל סינון
          </button>
        </div>
      </div>
    </div>
  );
}
