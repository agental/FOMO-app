import { useState, useMemo } from 'react';
import { ChevronLeft, MapPin, Compass } from 'lucide-react';
import type { AdminLocation } from '../lib/supabase';
import { COUNTRIES } from '../utils/countries';
import { placePinColor } from '../utils/placePinColor';
import {
  getCountryGuide, GUIDE_COUNTRY_CODES,
  type GuideSection, type GuideItem,
} from '../data/countryGuides';
import { GuideSectionSheet } from './GuideSectionSheet';
import { GuideItemSheet } from './GuideItemSheet';

/**
 * The home "מקומות" tab, rebuilt as a per-country travel GUIDE.
 *
 *   country grid  →  a country's sections (apps / SIM / money / …)  →  a section's
 *   items  →  one item's full description.
 *
 * The selected country is driven by the existing country row in HomeScreen
 * (`countryCode` / `onSelectCountry`), so tapping a flag up top switches the guide.
 * Real admin places for the country are woven in as their own rail.
 */
interface CountryGuideProps {
  countryCode: string | null;
  onSelectCountry: (code: string | null) => void;
  onOpenMap?: () => void;
  places?: AdminLocation[];
  onSelectPlace?: (loc: AdminLocation) => void;
}

const HEEBO = "'Heebo', sans-serif";
const RUBIK = "'Rubik', sans-serif";
const INK = '#111827';
const MUTED = '#8B90A0';
const BRAND = '#F97316';

export function CountryGuide({ countryCode, onSelectCountry, onOpenMap, places = [], onSelectPlace }: CountryGuideProps) {
  const [openSection, setOpenSection] = useState<GuideSection | null>(null);
  const [openItem, setOpenItem] = useState<GuideItem | null>(null);

  const guide = getCountryGuide(countryCode);
  const country = countryCode ? COUNTRIES[countryCode] : undefined;

  const countryPlaces = useMemo(
    () => (countryCode ? places.filter(p => p.country === countryCode) : []),
    [places, countryCode],
  );

  /* ── No guide for the current selection: prompt + the picker grid ── */
  if (!guide) {
    return (
      <div style={{ padding: '8px 18px 0' }}>
        <div style={{ textAlign: 'center', padding: '18px 12px 24px' }}>
          <div style={{
            width: 72, height: 72, margin: '0 auto 14px', borderRadius: 24,
            background: `${BRAND}14`, display: 'grid', placeItems: 'center',
          }}>
            <Compass size={34} strokeWidth={1.8} color={BRAND} />
          </div>
          <h3 style={{ fontSize: 20, fontWeight: 900, color: INK, fontFamily: HEEBO, margin: 0 }}>
            {country ? `המדריך ל${country.name} בהכנה` : 'בחר מדינה למדריך'}
          </h3>
          <p style={{ fontSize: 13.5, color: MUTED, fontFamily: RUBIK, margin: '6px auto 0', maxWidth: 260, lineHeight: 1.5 }}>
            {country ? 'בינתיים אפשר לפתוח מדריך למדינה אחרת' : 'כל מה שצריך לדעת — אפליקציות, סימים, כסף, בטיחות ועוד'}
          </p>
        </div>
        <CountryPickerGrid activeCode={countryCode} onSelect={onSelectCountry} />
      </div>
    );
  }

  const openItemColor = openSection?.color || BRAND;

  return (
    <div style={{ paddingBottom: 8 }}>
      {/* ── Hero ── */}
      <div style={{
        margin: '6px 18px 0', height: 158, borderRadius: 24, overflow: 'hidden',
        position: 'relative', background: '#EAEAEA', boxShadow: '0 6px 22px rgba(0,0,0,0.12)',
      }}>
        {country?.image && (
          <img src={country.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(8,12,22,0.88), rgba(8,12,22,0.15) 62%, rgba(8,12,22,0.28))' }} />
        <div style={{ position: 'absolute', top: 12, right: 14 }}>
          <span style={{
            fontSize: 34, lineHeight: 1, filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.35))',
          }}>
            {country?.flag}
          </span>
        </div>
        <div style={{ position: 'absolute', right: 16, left: 16, bottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 27, fontWeight: 900, color: '#fff', fontFamily: HEEBO, lineHeight: 1.1 }}>
            {country?.name || countryCode}
          </h2>
          {guide.intro && (
            <p style={{ margin: '5px 0 0', fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.9)', fontFamily: RUBIK, lineHeight: 1.45 }}>
              {guide.intro}
            </p>
          )}
        </div>
      </div>

      {/* ── Section cards (the guide's table of contents) ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '16px 18px 4px',
      }}>
        {guide.sections.map(section => (
          <button
            key={section.id}
            onClick={() => setOpenSection(section)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10,
              padding: '15px 15px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
              background: '#FFFFFF', textAlign: 'right',
              boxShadow: '0 2px 14px rgba(0,0,0,0.05)',
            }}
          >
            <span style={{
              width: 50, height: 50, borderRadius: 16, fontSize: 25, display: 'grid', placeItems: 'center',
              background: `${section.color}15`, boxShadow: `inset 0 0 0 1.5px ${section.color}24`,
            }}>
              {section.emoji}
            </span>
            <span style={{ width: '100%' }}>
              <span style={{ display: 'block', fontSize: 15, fontWeight: 800, color: INK, fontFamily: HEEBO, lineHeight: 1.25 }}>
                {section.title}
              </span>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: MUTED, fontFamily: HEEBO, marginTop: 3 }}>
                {section.items.length} פריטים
              </span>
            </span>
          </button>
        ))}
      </div>

      {/* ── Real places for this country ── */}
      {countryPlaces.length > 0 && (
        <section style={{ marginTop: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px 11px' }}>
            <h3 style={{ fontSize: 16.5, fontWeight: 900, color: INK, fontFamily: HEEBO, margin: 0 }}>
              מקומות מומלצים
            </h3>
            {onOpenMap && (
              <button
                onClick={onOpenMap}
                style={{
                  display: 'flex', alignItems: 'center', gap: 3, border: 'none', cursor: 'pointer',
                  background: `${BRAND}12`, color: BRAND, fontSize: 12.5, fontWeight: 800, fontFamily: HEEBO,
                  padding: '6px 11px', borderRadius: 50,
                }}
              >
                <MapPin size={13} strokeWidth={2.6} />
                במפה
              </button>
            )}
          </div>
          <div
            className="cg-hscroll"
            style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '2px 18px 6px', scrollSnapType: 'x proximity' }}
          >
            <style>{`.cg-hscroll::-webkit-scrollbar{display:none}.cg-hscroll{scrollbar-width:none}`}</style>
            {countryPlaces.slice(0, 12).map(p => {
              const emoji = p.emoji || '📍';
              const color = p.pin_color || placePinColor(emoji);
              const photo = p.place_photo_url || p.image_url || p.place_photos?.[0];
              return (
                <button
                  key={p.id}
                  onClick={() => onSelectPlace?.(p)}
                  style={{
                    flexShrink: 0, width: 158, padding: 0, border: 'none', cursor: 'pointer',
                    background: '#FFFFFF', borderRadius: 18, overflow: 'hidden', textAlign: 'right',
                    boxShadow: '0 2px 14px rgba(0,0,0,0.06)', scrollSnapAlign: 'start',
                  }}
                >
                  <div style={{ height: 92, background: photo ? '#EAEAEA' : `${color}14`, display: 'grid', placeItems: 'center', position: 'relative' }}>
                    {photo
                      ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: 34 }}>{emoji}</span>}
                  </div>
                  <div style={{ padding: '9px 11px 12px' }}>
                    <p style={{
                      margin: 0, fontSize: 13.5, fontWeight: 800, color: INK, fontFamily: HEEBO,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {p.name}
                    </p>
                    {(p.city || p.address) && (
                      <p style={{
                        margin: '2px 0 0', fontSize: 11.5, fontWeight: 600, color: MUTED, fontFamily: HEEBO,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {p.city || p.address}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Jump to other guides ── */}
      <section style={{ marginTop: 26 }}>
        <h3 style={{ fontSize: 16.5, fontWeight: 900, color: INK, fontFamily: HEEBO, margin: '0 0 11px', padding: '0 18px' }}>
          מדריכים נוספים
        </h3>
        <CountryPickerGrid activeCode={countryCode} onSelect={onSelectCountry} />
      </section>

      <GuideSectionSheet
        section={openSection}
        onClose={() => setOpenSection(null)}
        onOpenItem={setOpenItem}
      />
      <GuideItemSheet
        item={openItem}
        color={openItemColor}
        onClose={() => setOpenItem(null)}
      />
    </div>
  );
}

/* Grid of countries that have a guide — used both as the empty-state picker and the
   "מדריכים נוספים" strip. Image card with flag + name. */
function CountryPickerGrid({ activeCode, onSelect }: { activeCode: string | null; onSelect: (code: string) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '0 18px' }}>
      {GUIDE_COUNTRY_CODES.map(code => {
        const c = COUNTRIES[code];
        if (!c) return null;
        const active = code === activeCode;
        return (
          <button
            key={code}
            onClick={() => onSelect(code)}
            style={{
              position: 'relative', height: 104, borderRadius: 18, overflow: 'hidden', cursor: 'pointer',
              border: active ? `2.5px solid ${BRAND}` : 'none', padding: 0, background: '#EAEAEA',
              boxShadow: '0 3px 14px rgba(0,0,0,0.09)',
            }}
          >
            <img src={c.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(8,12,22,0.8), rgba(8,12,22,0.05) 70%)' }} />
            <div style={{ position: 'absolute', right: 11, bottom: 9, left: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 19, lineHeight: 1, flexShrink: 0 }}>{c.flag}</span>
              <span style={{
                fontSize: 15, fontWeight: 900, color: '#fff', fontFamily: HEEBO,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                textShadow: '0 1px 6px rgba(0,0,0,0.4)',
              }}>
                {c.name}
              </span>
            </div>
            <ChevronLeft
              size={18} color="#fff"
              style={{ position: 'absolute', left: 8, top: 8, filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))' }}
            />
          </button>
        );
      })}
    </div>
  );
}
