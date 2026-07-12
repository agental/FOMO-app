import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, Clock, Search } from 'lucide-react';
import type { AdminLocation } from '../lib/supabase';
import { PlaceCard } from './PlaceCard';
import { enrichPlace, matchesQuery, type EnrichedPlace } from '../utils/placeFeed';
import { placePinColor } from '../utils/placePinColor';
import { loadSavedPlaceIds, toggleSavedPlace } from '../services/savedPlacesService';

/**
 * The "מקומות" home feed, built as a traveller's GUIDE rather than a list.
 *
 * The organising device is the app's own pin language: every category becomes a tile in its own
 * colour, carrying the emoji its places use. That doubles as the guide's table of contents and
 * replaces the row of look-alike filter chips. Browsing shows rails; any filter/search collapses
 * into one ranked list.
 */
interface PlacesFeedProps {
  places: AdminLocation[];
  currentUserId?: string;
  searchQuery?: string;
  userLocation?: { latitude: number; longitude: number } | null;
  onSelectPlace: (loc: AdminLocation) => void;
  onOpenMap?: () => void;
}

type Sort = 'distance' | 'rating' | 'new';
const ALL   = '__all__';
const SAVED = '__saved__';

const HEEBO = "'Heebo', sans-serif";
const INK   = '#111827';
const MUTED = '#8B90A0';
const BRAND = '#F97316';

interface Tile { key: string; label: string; emoji: string; color: string }

function CategoryTile({ tile, active, onClick }: { tile: Tile; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0, width: 74, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
      }}
    >
      <span style={{
        width: 60, height: 60, borderRadius: 21, display: 'grid', placeItems: 'center', fontSize: 27,
        background: active ? tile.color : `${tile.color}14`,
        boxShadow: active ? `0 7px 18px ${tile.color}59` : 'inset 0 0 0 1.5px ' + `${tile.color}2E`,
        transform: active ? 'translateY(-1px)' : 'none',
        transition: 'all 0.2s cubic-bezier(0.34,1.4,0.64,1)',
      }}>
        {tile.emoji}
      </span>
      <span style={{
        fontSize: 11.5, fontWeight: active ? 800 : 700, fontFamily: HEEBO,
        color: active ? INK : MUTED, whiteSpace: 'nowrap',
        overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 74, transition: 'color 0.2s',
      }}>
        {tile.label}
      </span>
    </button>
  );
}

function Rail({ title, items, savedIds, onSave, onSelect }: {
  title: string;
  items: EnrichedPlace[];
  savedIds: Set<string>;
  onSave?: (id: string) => void;
  onSelect: (loc: AdminLocation) => void;
}) {
  if (items.length < 2) return null;
  return (
    <section style={{ marginTop: 24 }}>
      <h3 style={{ fontSize: 16.5, fontWeight: 900, color: INK, fontFamily: HEEBO, margin: '0 0 11px', padding: '0 18px' }}>
        {title}
      </h3>
      <div className="pf-hscroll" style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '2px 18px 4px', scrollSnapType: 'x proximity' }}>
        {items.map(p => (
          <PlaceCard
            key={p.id}
            place={p}
            variant="compact"
            saved={savedIds.has(p.id)}
            onToggleSave={onSave ? () => onSave(p.id) : undefined}
            onClick={() => onSelect(p.loc)}
          />
        ))}
      </div>
    </section>
  );
}

export function PlacesFeed({ places, currentUserId, searchQuery = '', userLocation, onSelectPlace, onOpenMap }: PlacesFeedProps) {
  const [active, setActive]     = useState<string>(ALL);
  const [sort, setSort]         = useState<Sort>(userLocation ? 'distance' : 'new');
  const [openNow, setOpenNow]   = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!currentUserId) return;
    loadSavedPlaceIds(currentUserId).then(setSavedIds);
  }, [currentUserId]);

  const toggleSave = async (id: string) => {
    if (!currentUserId) return;
    const was = savedIds.has(id);
    setSavedIds(prev => { const n = new Set(prev); was ? n.delete(id) : n.add(id); return n; }); // optimistic
    const { error } = await toggleSavedPlace(currentUserId, id, was);
    if (error) { // table missing / offline → put it back
      setSavedIds(prev => { const n = new Set(prev); was ? n.add(id) : n.delete(id); return n; });
      console.error('toggleSavedPlace:', error.message);
    }
  };

  const enriched = useMemo(() => places.map(l => enrichPlace(l, userLocation)), [places, userLocation]);

  /* Guide table of contents: one tile per category, wearing that category's own emoji + colour. */
  const tiles = useMemo<Tile[]>(() => {
    const byCat = new Map<string, EnrichedPlace[]>();
    enriched.forEach(p => {
      if (!p.category) return;
      const arr = byCat.get(p.category) ?? [];
      arr.push(p);
      byCat.set(p.category, arr);
    });

    const cats: Tile[] = [...byCat.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 8)
      .map(([label, list]) => {
        // the emoji most of this category's places actually use
        const freq = new Map<string, number>();
        list.forEach(p => freq.set(p.emoji, (freq.get(p.emoji) ?? 0) + 1));
        const emoji = [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];
        return { key: label, label, emoji, color: placePinColor(emoji) };
      });

    return [
      { key: ALL, label: 'הכל', emoji: '🧭', color: BRAND },
      ...(currentUserId ? [{ key: SAVED, label: 'שמורים', emoji: '❤️', color: '#EF4444' }] : []),
      ...cats,
    ];
  }, [enriched, currentUserId]);

  const q = searchQuery.trim();
  const isFiltering = !!q || active !== ALL || openNow;

  const sortList = (list: EnrichedPlace[]) => {
    const out = [...list];
    if (sort === 'distance' && userLocation) out.sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
    else if (sort === 'rating') out.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    else out.sort((a, b) => new Date(b.loc.created_at).getTime() - new Date(a.loc.created_at).getTime());
    return out;
  };

  const filtered = useMemo(() => {
    let list = enriched;
    if (active === SAVED)      list = list.filter(p => savedIds.has(p.id));
    else if (active !== ALL)   list = list.filter(p => p.category === active);
    if (openNow)               list = list.filter(p => p.status?.isOpen);
    if (q)                     list = list.filter(p => matchesQuery(p, q));
    return sortList(list);
  }, [enriched, active, openNow, q, sort, savedIds, userLocation]);

  const nearby = useMemo(
    () => (userLocation ? [...enriched].sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9)).slice(0, 10) : []),
    [enriched, userLocation],
  );
  const fresh     = useMemo(() => enriched.filter(p => p.isNew).slice(0, 10), [enriched]);
  const allSorted = useMemo(() => sortList(enriched), [enriched, sort, userLocation]);

  const mapUrl = useMemo(() => {
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token || !enriched.length) return null;
    const markers = enriched.slice(0, 12)
      .map(p => `pin-s+${p.color.replace('#', '')}(${p.loc.longitude.toFixed(5)},${p.loc.latitude.toFixed(5)})`)
      .join(',');
    return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${markers}/auto/640x200@2x?padding=48&access_token=${token}`;
  }, [enriched]);

  const catCount = tiles.filter(t => t.key !== ALL && t.key !== SAVED).length;

  /* one control system: quiet by default, solid ink when on (green only for the semantic "open") */
  const sortPill = (id: Sort, label: string) => {
    if (id === 'distance' && !userLocation) return null;
    const on = sort === id;
    return (
      <button
        key={id}
        onClick={() => setSort(id)}
        style={{
          border: 'none', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
          padding: '7px 13px', borderRadius: 50, fontSize: 12.5, fontWeight: 700, fontFamily: HEEBO,
          background: on ? INK : '#FFFFFF', color: on ? '#fff' : MUTED,
          boxShadow: on ? '0 3px 10px rgba(17,24,39,0.22)' : 'inset 0 0 0 1px #ECEDF1',
          transition: 'all 0.18s ease',
        }}
      >
        {label}
      </button>
    );
  };

  const groupedList = (items: EnrichedPlace[]) => (
    <div style={{ margin: '0 18px', background: '#FFFFFF', borderRadius: 22, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.055)' }}>
      {items.map((p, i) => (
        <div key={p.id}>
          {i > 0 && <div style={{ height: 1, background: '#F2F3F6', margin: '0 14px' }} />}
          <PlaceCard
            place={p}
            saved={savedIds.has(p.id)}
            onToggleSave={currentUserId ? () => toggleSave(p.id) : undefined}
            onClick={() => onSelectPlace(p.loc)}
          />
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <style>{`.pf-hscroll::-webkit-scrollbar{display:none}.pf-hscroll{scrollbar-width:none}`}</style>

      {/* ── Guide cover: the map is the hero ── */}
      {mapUrl && (
        <div
          onClick={onOpenMap}
          style={{
            margin: '6px 18px 0', height: 138, borderRadius: 22, overflow: 'hidden',
            position: 'relative', cursor: onOpenMap ? 'pointer' : 'default',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)', background: '#EAEAEA',
          }}
        >
          <img src={mapUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,12,20,0.72), rgba(10,12,20,0.05) 65%)' }} />
          <div style={{ position: 'absolute', bottom: 12, right: 14, left: 14, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
            <div>
              <p style={{ fontSize: 17, fontWeight: 900, color: '#fff', fontFamily: HEEBO, margin: 0, lineHeight: 1.2 }}>
                המדריך שלך
              </p>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.82)', fontFamily: HEEBO, margin: '2px 0 0' }}>
                {places.length} מקומות{catCount ? ` · ${catCount} קטגוריות` : ''}
              </p>
            </div>
            {onOpenMap && (
              <span style={{
                display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0,
                background: 'rgba(255,255,255,0.94)', color: INK,
                fontSize: 12, fontWeight: 800, fontFamily: HEEBO,
                padding: '6px 10px', borderRadius: 50,
              }}>
                פתח מפה
                <ChevronLeft size={14} strokeWidth={2.6} />
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Table of contents ── */}
      <div className="pf-hscroll" style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '18px 18px 2px' }}>
        {tiles.map(t => (
          <CategoryTile key={t.key} tile={t} active={active === t.key} onClick={() => setActive(t.key)} />
        ))}
      </div>

      {/* ── Controls (one system) ── */}
      <div className="pf-hscroll" style={{ display: 'flex', gap: 7, overflowX: 'auto', padding: '14px 18px 0', alignItems: 'center' }}>
        {sortPill('distance', 'קרובים אליי')}
        {sortPill('rating', 'הכי מדורגים')}
        {sortPill('new', 'חדשים')}
        <button
          onClick={() => setOpenNow(v => !v)}
          style={{
            border: 'none', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '7px 13px', borderRadius: 50, fontSize: 12.5, fontWeight: 700, fontFamily: HEEBO,
            background: openNow ? '#16A34A' : '#FFFFFF', color: openNow ? '#fff' : MUTED,
            boxShadow: openNow ? '0 3px 10px rgba(22,163,74,0.3)' : 'inset 0 0 0 1px #ECEDF1',
            transition: 'all 0.18s ease',
          }}
        >
          <Clock size={12.5} strokeWidth={2.5} />
          פתוח עכשיו
        </button>
      </div>

      {/* ── Results ── */}
      {isFiltering ? (
        filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '52px 28px' }}>
            <Search size={30} strokeWidth={1.6} style={{ margin: '0 auto 12px', color: '#CBD0DA' }} />
            <p style={{ fontSize: 15, fontWeight: 800, color: INK, fontFamily: HEEBO, margin: 0 }}>אין מקומות שמתאימים</p>
            <p style={{ fontSize: 12.5, color: MUTED, fontFamily: HEEBO, margin: '5px 0 0' }}>
              נסה קטגוריה אחרת, או כבה את "פתוח עכשיו"
            </p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 12.5, color: MUTED, fontWeight: 700, fontFamily: HEEBO, padding: '18px 20px 9px', margin: 0 }}>
              {filtered.length} מקומות
            </p>
            {groupedList(filtered)}
          </>
        )
      ) : (
        <>
          <Rail title="קרובים אליך"    items={nearby} savedIds={savedIds} onSave={currentUserId ? toggleSave : undefined} onSelect={onSelectPlace} />
          <Rail title="נוספו לאחרונה" items={fresh}  savedIds={savedIds} onSave={currentUserId ? toggleSave : undefined} onSelect={onSelectPlace} />

          <h3 style={{ fontSize: 16.5, fontWeight: 900, color: INK, fontFamily: HEEBO, margin: '26px 0 11px', padding: '0 18px' }}>
            כל המקומות
          </h3>
          {groupedList(allSorted)}
        </>
      )}
    </div>
  );
}
