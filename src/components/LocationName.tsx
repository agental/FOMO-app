import { useEffect, useState } from 'react';

/**
 * Resolves a lat/lng to a human street / place name via Mapbox reverse
 * geocoding (street-level), so shared-location bubbles show e.g. a street
 * name instead of raw coordinates. Results are cached per-coordinate.
 */
const cache = new Map<string, string>();

async function fetchStreet(lat: number, lng: number): Promise<string | null> {
  const token = import.meta.env.VITE_MAPBOX_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&types=address,poi&language=he&limit=1`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const f = data.features?.[0];
    if (!f) return null;
    // For an address result, `text` is the street name (house number is in `address`).
    const street = f.text as string | undefined;
    const num = f.address as string | undefined;
    if (street) return num ? `${street} ${num}` : street;
    return (f.place_name as string | undefined)?.split(',')[0] || null;
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
