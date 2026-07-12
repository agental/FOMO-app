// Turns a raw `admin_locations` row into everything the places feed and the place card need:
// category, pin emoji + colour, open/closed status, distance and a "new" flag. All of it comes
// from data already stored — none of it required a schema change.
import type { AdminLocation } from '../lib/supabase';
import { placeCategory } from './placeCategory';
import { placePinColor } from './placePinColor';
import { calculateDistance } from './distance';

export type OpenStatus = { isOpen: boolean; opensAt: string | null; closesAt: string | null } | null;

/**
 * Today's open/closed status. `opening_hours` is admin-entered only (Google never fills it here),
 * keys are "0"–"6" with Sunday = 0, so fall back to Google's `place_open_now` when it's missing.
 */
export function getOpenStatus(loc: Pick<AdminLocation, 'opening_hours' | 'place_open_now'>): OpenStatus {
  const hours = loc.opening_hours;
  if (hours) {
    const now = new Date();
    const today = hours[now.getDay().toString()];
    if (today) {
      if (today.closed) return { isOpen: false, opensAt: null, closesAt: null };
      const cur = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      return { isOpen: cur >= today.open && cur <= today.close, opensAt: today.open, closesAt: today.close };
    }
  }
  if (loc.place_open_now != null) return { isOpen: loc.place_open_now, opensAt: null, closesAt: null };
  return null;
}

export interface EnrichedPlace {
  loc: AdminLocation;
  id: string;
  name: string;
  city: string | null;
  photo: string | null;
  emoji: string;
  color: string;
  category: string | null;
  rating: number | null;
  reviewCount: number | null;
  status: OpenStatus;
  distanceKm: number | null;
  isNew: boolean;
}

const NEW_DAYS = 7;

export function enrichPlace(
  loc: AdminLocation,
  userLocation?: { latitude: number; longitude: number } | null,
): EnrichedPlace {
  // pin_color is a packed "#RRGGBB|🍕" string — the `emoji` column is never written.
  const raw   = loc.pin_color || '';
  const pipe  = raw.indexOf('|');
  const emoji = (pipe !== -1 ? raw.slice(pipe + 1) : '') || '📍';
  const color = (pipe !== -1 ? raw.slice(0, pipe) : (raw.startsWith('#') ? raw : '')) || placePinColor(emoji);

  const distanceKm = userLocation
    ? calculateDistance(userLocation.latitude, userLocation.longitude, loc.latitude, loc.longitude)
    : null;

  const addedMs = loc.created_at ? Date.now() - new Date(loc.created_at).getTime() : Infinity;

  return {
    loc,
    id: loc.id,
    name: loc.place_name || loc.name,
    city: loc.city || null,
    photo: loc.place_photo_url || loc.image_url || loc.place_photos?.[0] || null,
    emoji,
    color,
    category: placeCategory(loc.place_types),
    rating: loc.place_rating ?? null,
    reviewCount: loc.place_review_count ?? null,
    status: getOpenStatus(loc),
    distanceKm,
    isNew: addedMs < NEW_DAYS * 24 * 60 * 60 * 1000,
  };
}

export function formatDistance(km: number | null): string | null {
  if (km == null) return null;
  return km < 1 ? `${Math.round(km * 1000)} מ׳` : `${km.toFixed(1)} ק״מ`;
}

/** Short status text for a card: "פתוח · נסגר 22:00" / "סגור · נפתח 09:00". */
export function statusText(s: OpenStatus): string | null {
  if (!s) return null;
  if (s.isOpen) return s.closesAt ? `פתוח · נסגר ${s.closesAt}` : 'פתוח עכשיו';
  return s.opensAt ? `סגור · נפתח ${s.opensAt}` : 'סגור עכשיו';
}

/** Free-text match across the fields a user would actually type. */
export function matchesQuery(p: EnrichedPlace, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [p.name, p.city, p.category, p.loc.address, p.loc.description]
    .some(v => (v || '').toLowerCase().includes(needle));
}
