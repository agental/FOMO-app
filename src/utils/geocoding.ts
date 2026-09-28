import { loadMapKit } from './mapkit';

export interface ReverseGeocodeResult {
  countryCode: string | null;
  countryName: string | null;
  city: string | null;
  address: string | null;
}

export interface ForwardGeocodeResult {
  latitude: number;
  longitude: number;
  address: string;
  city: string | null;
  countryCode: string | null;
}

/* Geocoding via Apple MapKit JS (replaces Mapbox). `loadMapKit()` is idempotent/cached, so calling it
   here is cheap. Note: like the map itself, the MapKit token is origin-locked → works in prod/TestFlight,
   not in an Expo Go LAN origin. A MapKit `Place` exposes coordinate / countryCode / country / locality /
   formattedAddress, which map 1:1 onto the fields the app used from Mapbox. */

/**
 * Search a place/address by text and return its coordinates — used to move the event pin to a typed
 * location. `proximity` (the user's current lng/lat) biases results toward nearby places.
 */
export async function forwardGeocode(
  query: string,
  proximity?: { longitude: number; latitude: number }
): Promise<ForwardGeocodeResult | null> {
  if (!query.trim()) return null;

  try {
    const mapkit = await loadMapKit();
    const geocoder = new mapkit.Geocoder({ language: 'he', getsUserLocation: false });
    const opts: Record<string, unknown> = {};
    if (proximity) opts.coordinate = new mapkit.Coordinate(proximity.latitude, proximity.longitude);

    const place = await new Promise<any>((resolve, reject) => {
      geocoder.lookup(query.trim(), (err: any, data: any) => {
        if (err) return reject(err);
        resolve(data?.results?.[0] || null);
      }, opts);
    });
    if (!place?.coordinate) return null;

    return {
      longitude: place.coordinate.longitude,
      latitude: place.coordinate.latitude,
      address: place.formattedAddress || query.trim(),
      city: place.locality || null,
      countryCode: place.countryCode ? String(place.countryCode).toUpperCase() : null,
    };
  } catch (error) {
    console.error('[forwardGeocode] Error:', error);
    return null;
  }
}

export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<ReverseGeocodeResult> {
  const empty: ReverseGeocodeResult = { countryCode: null, countryName: null, city: null, address: null };

  try {
    const mapkit = await loadMapKit();
    const geocoder = new mapkit.Geocoder({ language: 'he', getsUserLocation: false });

    const place = await new Promise<any>((resolve, reject) => {
      geocoder.reverseLookup(new mapkit.Coordinate(latitude, longitude), (err: any, data: any) => {
        if (err) return reject(err);
        resolve(data?.results?.[0] || null);
      });
    });
    if (!place) return empty;

    return {
      countryCode: place.countryCode ? String(place.countryCode).toUpperCase() : null,
      countryName: place.country || null,
      city: place.locality || null,
      address: place.formattedAddress || null,
    };
  } catch (error) {
    console.error('[reverseGeocode] Error:', error);
    return empty;
  }
}
