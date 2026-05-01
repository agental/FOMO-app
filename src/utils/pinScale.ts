export type PinType = 'event' | 'meetup' | 'place' | 'admin' | 'yeshiva';

// Base scale per pin type — preserves visual hierarchy at every zoom level
// 'admin' is tuned so that the 36×41 admin pin renders at the same visual
// size as the 44×54 event pin (44/36 ≈ 1.22).
const BASE_SCALE: Record<PinType, number> = {
  event:   1.00,
  admin:   1.22,
  meetup:  0.88,
  place:   0.75,
  yeshiva: 0.95,
};

// Zoom range over which scaling occurs
const ZOOM_MIN   = 9;
const ZOOM_MAX   = 16;
const FACTOR_MIN = 0.70;   // scale multiplier when fully zoomed out
const FACTOR_MAX = 1.25;   // scale multiplier when fully zoomed in

/**
 * Returns the CSS transform scale for a pin given its type and the current
 * map zoom level. The zoom factor is interpolated linearly between FACTOR_MIN
 * and FACTOR_MAX, then multiplied by the type's base scale so the visual
 * hierarchy (event > meetup > place) is maintained at every zoom level.
 */
export function getPinScale(type: PinType, zoom: number): number {
  const t = Math.max(0, Math.min(1, (zoom - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN)));
  const zoomFactor = FACTOR_MIN + t * (FACTOR_MAX - FACTOR_MIN);
  return BASE_SCALE[type] * zoomFactor;
}
