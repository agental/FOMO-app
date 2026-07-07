// GeoJSON helpers for the map's admin-drawn "central area" highlights. Areas are polygons
// (a boundary ring of [lng,lat] points) persisted in the `map_areas` table and shown to
// everyone. Rendered with fill + line layers that scale correctly with zoom.

export interface AreaShape {
  id: string;
  name: string;
  polygon: [number, number][]; // boundary ring: [lng,lat] points (not necessarily closed)
  color?: string | null;
}

/** Ensure the ring is closed (first point repeated at the end) for a valid GeoJSON Polygon. */
function closeRing(ring: [number, number][]): [number, number][] {
  if (ring.length < 3) return ring;
  const [fx, fy] = ring[0];
  const [lx, ly] = ring[ring.length - 1];
  return fx === lx && fy === ly ? ring : [...ring, ring[0]];
}

/** FeatureCollection of area polygons, each carrying its id + name + color in properties. */
export function buildAreasFC(areas: AreaShape[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: areas
      .filter(a => Array.isArray(a.polygon) && a.polygon.length >= 3)
      .map(a => ({
        type: 'Feature',
        properties: { id: a.id, name: a.name, color: a.color || '#F97316' },
        geometry: { type: 'Polygon', coordinates: [closeRing(a.polygon)] },
      })),
  };
}

/** Simple average-of-vertices centroid — good enough to place a name label inside the area. */
export function polygonCentroid(ring: [number, number][]): [number, number] {
  let x = 0, y = 0, n = 0;
  for (const [lng, lat] of ring) { x += lng; y += lat; n++; }
  return n ? [x / n, y / n] : [0, 0];
}
