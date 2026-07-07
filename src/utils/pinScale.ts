export type PinType = 'event' | 'meetup' | 'place' | 'admin' | 'yeshiva';

// Circular pins bake their own diameter (events larger than places), so the zoom
// curve no longer needs a per-type base — it is a single multiplier applied to every
// pin. Kept per-type in the signature for call-site compatibility.
const BASE_SCALE: Record<PinType, number> = {
  event:   1,
  admin:   1,
  meetup:  1,
  place:   1,
  yeshiva: 1,
};

// Zoom range over which scaling occurs. Zoomed far out, pins shrink toward small
// dots (Apple-style); zoomed in, they grow a little past their base size.
const ZOOM_MIN   = 9;
const ZOOM_MAX   = 16;
const FACTOR_MIN = 0.60;   // scale multiplier when fully zoomed out
const FACTOR_MAX = 1.15;   // scale multiplier when fully zoomed in

/**
 * CSS transform scale for a pin at the current map zoom. Interpolated linearly
 * between FACTOR_MIN and FACTOR_MAX across the zoom range.
 */
export function getPinScale(type: PinType, zoom: number): number {
  const t = Math.max(0, Math.min(1, (zoom - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN)));
  const zoomFactor = FACTOR_MIN + t * (FACTOR_MAX - FACTOR_MIN);
  return BASE_SCALE[type] * zoomFactor;
}

// Name labels under pins appear once the map is zoomed in enough that they won't
// crowd each other; below this they are hidden (the selected pin always shows its
// label regardless of zoom).
const LABEL_ZOOM = 13.3;

/** Whether pin name labels should be visible at the given zoom level. */
export function labelVisibleAtZoom(zoom: number): boolean {
  return zoom >= LABEL_ZOOM;
}
