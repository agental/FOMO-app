import { useEffect, useRef } from 'react';
import { ChevronLeft } from 'lucide-react';
import { createPlacePinSVG } from '../utils/createLocationPin';
import { createChabadPinSVG } from '../utils/createChabadPin';
import { placePinColor } from '../utils/placePinColor';
import type { PlacePayload } from '../utils/placeMessage';

/**
 * A shared place, rendered in the chat as a map with the place's own pin standing on it.
 *
 * The map is a Mapbox Static Images render (a plain <img> — no GL context, so a thread full of
 * these stays cheap), and the pin is the very same `createPlacePinSVG` the live map uses, dropped
 * on the centre point. Tapping opens the place.
 */
const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
const W = 250, MAP_H = 132;

export function PlaceChatCard({ data, onClick }: { data: PlacePayload; onClick: () => void }) {
  const pinRef = useRef<HTMLDivElement>(null);

  const emoji = data.emoji || '📍';
  const color = data.color || placePinColor(emoji);
  const isChabad = (data.id || '').startsWith('chabad:'); // shared Chabad house → use its real pin

  useEffect(() => {
    const host = pinRef.current;
    if (!host) return;
    host.replaceChildren(isChabad ? createChabadPinSVG() : createPlacePinSVG(emoji, color));
  }, [emoji, color, isChabad]);

  // @2x so it stays sharp on a phone; no logo/attribution chrome inside a chat bubble.
  const mapUrl = TOKEN
    ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${data.lng},${data.lat},15.4,0/${W}x${MAP_H}@2x`
      + `?access_token=${TOKEN}&attribution=false&logo=false`
    : null;

  return (
    <button
      onClick={onClick}
      dir="rtl"
      style={{
        width: W, borderRadius: 20, overflow: 'hidden', position: 'relative',
        border: 'none', padding: 0, cursor: 'pointer', textAlign: 'right', display: 'block',
        background: '#fff', boxShadow: '0 6px 22px rgba(0,0,0,0.18)',
      }}
    >
      {/* map */}
      <div style={{ position: 'relative', height: MAP_H, background: '#E8EAED' }}>
        {mapUrl && (
          <img
            src={mapUrl}
            alt=""
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}

        {/* the pin stands on the centre of the map — its tip is the coordinate */}
        <div
          ref={pinRef}
          style={{
            position: 'absolute', left: '50%', top: '50%',
            transform: `translate(-50%, -100%) scale(${isChabad ? 0.9 : 1.15})`,
            transformOrigin: 'bottom center',
            lineHeight: 0, pointerEvents: 'none',
          }}
        />

        <span style={{
          position: 'absolute', top: 9, right: 9,
          background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(4px)',
          borderRadius: 20, padding: '3px 9px',
          fontSize: 11, fontWeight: 800, color, fontFamily: 'Heebo, sans-serif',
        }}>
          {isChabad ? '🕎 בית חב״ד' : `${emoji} מקום`}
        </span>
      </div>

      {/* footer */}
      <div style={{ padding: '10px 12px 11px', borderTop: '1px solid #EFF1F4' }}>
        <p style={{
          fontSize: 15, fontWeight: 800, color: '#111827', margin: 0, lineHeight: 1.25,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'Heebo, sans-serif',
        }}>
          {data.name}
        </p>

        {data.address && (
          <p style={{
            fontSize: 11.5, color: '#6B7280', fontWeight: 600, margin: '3px 0 0', lineHeight: 1.35,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {data.address}
          </p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          <span style={{ fontSize: 12.5, fontWeight: 800, color, fontFamily: 'Heebo, sans-serif' }}>פתח במפה</span>
          <ChevronLeft size={16} style={{ color }} strokeWidth={2.5} />
        </div>
      </div>
    </button>
  );
}
