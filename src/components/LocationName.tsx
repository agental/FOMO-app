import { useEffect, useState } from 'react';
import { loadMapKit } from '../utils/mapkit';

/**
 * Resolves a lat/lng to a human street / place name via Apple MapKit reverse
 * geocoding, so shared-location bubbles show e.g. a street name instead of raw
 * coordinates. Results are cached per-coordinate.
 */
const cache = new Map<string, string>();

async function fetchStreet(lat: number, lng: number): Promise<string | null> {
  try {
    const mapkit = await loadMapKit();
    const geocoder = new mapkit.Geocoder({ language: 'he', getsUserLocation: false });
    const place = await new Promise<any>((resolve) => {
      geocoder.reverseLookup(new mapkit.Coordinate(lat, lng), (err: any, data: any) => {
        resolve(err ? null : (data?.results?.[0] || null));
      });
    });
    if (!place) return null;
    const name = (place.name as string | undefined)?.trim();
    if (name) return name;
    return (place.formattedAddress as string | undefined)?.split(',')[0]?.trim() || null;
  } catch {
    return null;
  }
}

export function LocationName({ lat, lng, fallback }: { lat: number; lng: number; fallback?: string | null }) {
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  const [name, setName] = useState<string | null>(() => cache.get(key) ?? null);

  useEffect(() => {
    if (cache.has(key)) { setName(cache.get(key)!); return; }
    let cancelled = false;
    fetchStreet(lat, lng).then(n => {
      if (n) {
        cache.set(key, n);
        if (!cancelled) setName(n);
      }
    });
    return () => { cancelled = true; };
  }, [key, lat, lng]);

  return <>{name || fallback || 'מיקום משותף'}</>;
}
