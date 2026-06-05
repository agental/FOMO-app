import { useState, useRef, useEffect } from 'react';
import { X, Search, Check } from 'lucide-react';
import { ALL_COUNTRIES, ALPHABET_LETTERS, TOTAL_COUNTRIES } from '../data/allCountries';

interface CountriesPickerModalProps {
  isOpen: boolean;
  selected: string[];
  onClose: () => void;
  onDone: (codes: string[]) => void;
}

export function CountriesPickerModal({ isOpen, selected, onClose, onDone }: CountriesPickerModalProps) {
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<string[]>(selected);
  const listRef = useRef<HTMLDivElement>(null);
  const letterRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => { if (isOpen) setDraft(selected); }, [isOpen]);

  const filtered = query.trim()
    ? ALL_COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.iso2.toLowerCase().includes(query.toLowerCase())
      )
    : ALL_COUNTRIES;

  const toggle = (code: string) =>
    setDraft(d => d.includes(code) ? d.filter(x => x !== code) : [...d, code]);

  const scrollToLetter = (letter: string) => {
    const el = letterRefs.current[letter];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (!isOpen) return null;

  // Group by first letter
  const groups: Record<string, typeof ALL_COUNTRIES> = {};
  for (const c of filtered) {
    const l = c.name[0].toUpperCase();
    if (!groups[l]) groups[l] = [];
    groups[l].push(c);
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', width: '100%',
          borderRadius: '24px 24px 0 0',
          maxHeight: '92dvh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 -20px 60px rgba(0,0,0,0.2)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '20px 20px 14px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontSize: 19, fontWeight: 800, color: '#111827', fontFamily: 'Heebo, sans-serif' }}>
              Select Countries
            </span>
            <button
              onClick={() => onDone(draft)}
              style={{
                fontSize: 15, fontWeight: 700, color: '#F97316',
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'Heebo, sans-serif',
              }}
            >
              Done
            </button>
          </div>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            {query ? (
              <button
                onClick={() => setQuery('')}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <X size={15} style={{ color: '#9CA3AF' }} />
              </button>
            ) : (
              <Search size={15} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
            )}
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search countries..."
              style={{
                width: '100%', height: 44, borderRadius: 12,
                background: '#F3F4F6', border: 'none', outline: 'none',
                paddingRight: 38, paddingLeft: 14,
                fontSize: 15, fontFamily: 'system-ui, sans-serif',
                boxSizing: 'border-box', color: '#111827',
              }}
            />
          </div>
        </div>

        {/* Count bar */}
        <div style={{
          padding: '6px 20px 10px', flexShrink: 0,
          borderBottom: '1px solid #F3F4F6',
          fontSize: 12, color: '#9CA3AF', fontFamily: 'Heebo, sans-serif',
        }}>
          {draft.length} selected · {TOTAL_COUNTRIES} countries total
        </div>

        {/* Country list + alphabet index */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
          {/* List */}
          <div ref={listRef} style={{ flex: 1, overflowY: 'auto', paddingBottom: 32 }}>
            {Object.entries(groups).map(([letter, countries]) => (
              <div key={letter}>
                <div
                  ref={el => { letterRefs.current[letter] = el; }}
                  style={{
                    padding: '8px 20px 4px',
                    fontSize: 12, fontWeight: 700, color: '#9CA3AF',
                    fontFamily: 'system-ui, sans-serif',
                    background: '#FAFAFA',
                    borderBottom: '1px solid #F3F4F6',
                  }}
                >
                  {letter}
                </div>
                {countries.map(c => {
                  const sel = draft.includes(c.iso2);
                  return (
                    <div
                      key={c.iso2}
                      onClick={() => toggle(c.iso2)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: '13px 20px',
                        background: sel ? '#FFF7ED' : '#fff',
                        borderBottom: '1px solid #F9FAFB',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontSize: 26, lineHeight: 1, flexShrink: 0 }}>{c.flag}</span>
                      <span style={{
                        flex: 1, fontSize: 15, fontWeight: 500,
                        color: sel ? '#C2410C' : '#111827',
                        fontFamily: 'system-ui, sans-serif',
                      }}>
                        {c.name}
                      </span>
                      {sel && (
                        <div style={{
                          width: 24, height: 24, borderRadius: '50%',
                          background: '#F97316',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <Check size={13} color="#fff" strokeWidth={3} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Alphabet index */}
          {!query && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: '8px 4px',
              gap: 1, flexShrink: 0,
            }}>
              {ALPHABET_LETTERS.map(l => (
                <button
                  key={l}
                  onClick={() => scrollToLetter(l)}
                  style={{
                    fontSize: 10, fontWeight: 700, color: '#F97316',
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '1px 6px', fontFamily: 'system-ui, sans-serif',
                    lineHeight: 1.4,
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Done button */}
        <div style={{
          padding: '12px 16px',
          paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
          borderTop: '1px solid #F3F4F6', flexShrink: 0,
        }}>
          <button
            onClick={() => onDone(draft)}
            style={{
              width: '100%', height: 52, borderRadius: 16, border: 'none',
              background: 'linear-gradient(135deg, #F97316, #EA580C)',
              color: '#fff', fontSize: 16, fontWeight: 800,
              cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
              boxShadow: '0 6px 20px rgba(249,115,22,0.35)',
            }}
          >
            Done · {draft.length} countries
          </button>
        </div>
      </div>
    </div>
  );
}