import { useState, useMemo, useEffect } from 'react';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { Search, ChevronRight, MapPin } from 'lucide-react';
import { COUNTRIES } from '../utils/countries';
import { CONTINENTS, getContinentForCountry } from '../utils/continents';
import { supabase } from '../lib/supabase';

interface CountrySelectionScreenProps {
  currentUserId?: string | null;
  selectedCountries: Set<string>;
  onToggleCountry: (code: string) => void;
  onContinue: () => void;
  onBack?: () => void;
}

const ACCENT = '#F97316';
const ACCENT_DARK = '#EA580C';
const POPULAR = ['IL', 'TH', 'IN', 'US', 'ES', 'IT', 'GR', 'TR', 'JP', 'FR', 'DE', 'GB'];

const CONTINENT_ORDER: Array<keyof typeof CONTINENTS> = ['asia', 'europe', 'americas', 'africa', 'oceania'];

function CountryCircle({
  code,
  flag,
  name,
  selected,
  onToggle,
}: {
  code: string;
  flag: string;
  name: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={selected}
      aria-label={`${name}${selected ? ' (נבחרה)' : ''}`}
      className="flex flex-col items-center gap-1.5 active:scale-90 transition-transform flex-shrink-0"
      style={{ width: 72 }}
    >
      {/* ring + circle */}
      <div style={{ position: 'relative' }}>
        <div
          style={{
            padding: 3,
            borderRadius: '50%',
            background: selected
              ? `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DARK})`
              : 'transparent',
            border: selected ? 'none' : '2.5px solid #E5E5E5',
          }}
        >
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: '50%',
              background: selected ? 'white' : '#F5F5F5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              lineHeight: 1,
              border: selected ? '2px solid white' : 'none',
            }}
          >
            {flag}
          </div>
        </div>
        {selected && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: ACCENT,
              border: '2px solid white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}
      </div>
      <span
        style={{
          fontSize: 11,
          fontFamily: 'Heebo, sans-serif',
          fontWeight: selected ? 700 : 500,
          color: selected ? ACCENT : '#3D3D3D',
          textAlign: 'center',
          lineHeight: 1.3,
          maxWidth: 68,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {name}
      </span>
    </button>
  );
}

function ContinentRow({
  title,
  codes,
  selectedCountries,
  onToggle,
}: {
  title: string;
  codes: string[];
  selectedCountries: Set<string>;
  onToggle: (code: string) => void;
}) {
  if (codes.length === 0) return null;
  return (
    <div className="mb-6">
      <p
        className="px-5 mb-3 text-[14px] font-black"
        style={{ fontFamily: 'Heebo, sans-serif', color: '#1C1C1E' }}
      >
        {title}
      </p>
      <div
        className="flex gap-4 overflow-x-auto hide-scrollbar px-5"
        style={{ paddingBottom: 4 }}
      >
        {codes.map(code => {
          const country = COUNTRIES[code];
          if (!country) return null;
          return (
            <CountryCircle
              key={code}
              code={code}
              flag={country.flag}
              name={country.name}
              selected={selectedCountries.has(code)}
              onToggle={() => onToggle(code)}
            />
          );
        })}
      </div>
    </div>
  );
}

export function CountrySelectionScreen({
  currentUserId,
  selectedCountries,
  onToggleCountry,
  onContinue,
  onBack,
}: CountrySelectionScreenProps) {
  const swipeRef = useSwipeBack<HTMLDivElement>(onBack); // swipe from an edge to slide the screen back
  const [searchQuery, setSearchQuery] = useState('');
  const [currentLocation, setCurrentLocation] = useState<string | null>(null);

  // Auto-detect the user's real country and sync it to their profile (current_country).
  // Uses the WebView's native location bridge, with a browser-geolocation fallback.
  useEffect(() => {
    let done = false;
    const apply = async (lat: number, lng: number) => {
      if (done) return; done = true;
      try {
        const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
        const data = await res.json();
        const code: string | undefined = data.countryCode;
        if (code && COUNTRIES[code]) {
          setCurrentLocation(code);
          if (currentUserId) supabase.from('users').update({ current_country: code }).eq('id', currentUserId);
        }
      } catch { /* ignore */ }
    };
    const onNative = (e: Event) => { const d = (e as CustomEvent).detail; if (d?.lat != null) apply(d.lat, d.lng); };
    window.addEventListener('nativeLocation', onNative);
    // The WebView wrapper obtains location on app start and stores it here — use it if already available.
    const nl = (window as unknown as { _nativeLocation?: { lat: number; lng: number } })._nativeLocation;
    if (nl?.lat != null) apply(nl.lat, nl.lng);
    else if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        p => apply(p.coords.latitude, p.coords.longitude),
        () => {},
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
      );
    }
    return () => window.removeEventListener('nativeLocation', onNative);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  // Group countries by continent
  const byContinent = useMemo(() => {
    const groups: Partial<Record<keyof typeof CONTINENTS, string[]>> = {};
    for (const continent of CONTINENT_ORDER) groups[continent] = [];
    Object.keys(COUNTRIES).forEach(code => {
      const c = getContinentForCountry(code);
      if (groups[c]) groups[c]!.push(code);
    });
    return groups;
  }, []);

  // Search results
  const filtered = useMemo(() => {
    if (searchQuery === '') return null;
    return Object.entries(COUNTRIES)
      .filter(([code, country]) =>
        country.name.includes(searchQuery) ||
        code.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .map(([code]) => code);
  }, [searchQuery]);

  const showSections = filtered === null;

  return (
    <div
      ref={swipeRef}
      className="min-h-screen flex flex-col overflow-x-hidden max-w-full"
      dir="rtl"
      style={{ background: '#FFFFFF' }}
    >
      {/* ── Header ── */}
      <div
        className="sticky top-0 z-10 px-5 pb-4 bg-white"
        style={{
          paddingTop: 'max(20px, env(safe-area-inset-top))',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        {/* Top row: back (right) + auto-detected current location (left corner) */}
        <div className="flex items-center justify-between mb-4" style={{ minHeight: 26 }}>
          {onBack ? (
            <button
              onClick={onBack}
              className="flex items-center gap-1 active:opacity-60 transition-opacity"
              style={{ color: 'rgba(0,0,0,0.35)', fontFamily: 'Heebo, sans-serif', fontSize: 14 }}
            >
              <ChevronRight className="w-4 h-4" />
              חזרה
            </button>
          ) : <span />}

          {currentLocation && COUNTRIES[currentLocation] && (
            <button
              onClick={() => onToggleCountry(currentLocation)}
              title="הוסף את המיקום הנוכחי לבחירה"
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 active:scale-95 transition-transform"
              style={{
                background: selectedCountries.has(currentLocation) ? 'rgba(249,115,22,0.12)' : '#F5F5F5',
                border: `1px solid ${selectedCountries.has(currentLocation) ? ACCENT : 'rgba(0,0,0,0.08)'}`,
                fontFamily: 'Heebo, sans-serif',
              }}
            >
              <MapPin className="w-3.5 h-3.5" style={{ color: ACCENT }} />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#1C1C1E' }}>
                {COUNTRIES[currentLocation].flag} {COUNTRIES[currentLocation].name}
              </span>
            </button>
          )}
        </div>

        <h2
          className="text-[26px] font-black text-center mb-1"
          style={{ fontFamily: 'Heebo, sans-serif', color: '#1C1C1E' }}
        >
          באילו מדינות אתם מטיילים?
        </h2>
        <p className="text-center mb-5" style={{ color: 'rgba(0,0,0,0.38)', fontSize: 13, fontFamily: 'Heebo, sans-serif' }}>
          בחרו את המדינות שבהן תרצו להכיר מטיילים אחרים
        </p>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(0,0,0,0.3)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="חיפוש מדינה..."
            aria-label="חיפוש מדינה"
            className="w-full h-11 pr-10 pl-4 text-sm outline-none"
            style={{
              background: '#F5F5F5',
              borderRadius: 14,
              color: '#1C1C1E',
              fontFamily: 'Heebo, sans-serif',
              border: '1px solid rgba(0,0,0,0.07)',
            }}
          />
        </div>

      </div>

      {/* ── Content ── */}
      <div className="flex-1 pt-5 pb-28 overflow-y-auto">

        {showSections ? (
          <>
            {/* Popular */}
            <ContinentRow
              title="🔥 פופולריות"
              codes={POPULAR}
              selectedCountries={selectedCountries}
              onToggle={onToggleCountry}
            />

            {/* Per continent */}
            {CONTINENT_ORDER.map(key => (
              <ContinentRow
                key={key}
                title={`${CONTINENTS[key].emoji} ${CONTINENTS[key].name}`}
                codes={byContinent[key] || []}
                selectedCountries={selectedCountries}
                onToggle={onToggleCountry}
              />
            ))}
          </>
        ) : (
          /* Search / filter result — wrap grid of circles */
          <div className="flex flex-wrap gap-x-2 gap-y-5 px-5">
            {filtered!.map(code => {
              const country = COUNTRIES[code];
              if (!country) return null;
              return (
                <CountryCircle
                  key={code}
                  code={code}
                  flag={country.flag}
                  name={country.name}
                  selected={selectedCountries.has(code)}
                  onToggle={() => onToggleCountry(code)}
                />
              );
            })}
            {filtered!.length === 0 && (
              <p className="w-full text-center py-10" style={{ color: 'rgba(0,0,0,0.35)', fontFamily: 'Heebo, sans-serif' }}>
                לא נמצאו מדינות
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom button ── */}
      <div
        className="fixed bottom-0 left-0 right-0 px-5"
        style={{
          paddingTop: 14,
          paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
          background: 'linear-gradient(to top, #ffffff 65%, transparent)',
        }}
      >
        <button
          onClick={onContinue}
          disabled={selectedCountries.size === 0}
          className="w-full text-white font-black text-[17px] active:scale-[0.97] transition-transform disabled:opacity-40"
          style={{
            fontFamily: 'Heebo, sans-serif',
            height: 56,
            borderRadius: 28,
            background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DARK})`,
            boxShadow: selectedCountries.size > 0 ? `0 8px 24px ${ACCENT}55` : 'none',
          }}
        >
          המשך {selectedCountries.size > 0 ? `(${selectedCountries.size} נבחרו)` : ''}
        </button>
      </div>

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
