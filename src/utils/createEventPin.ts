import { getCategoryColor, getCategoryEmoji } from './eventCategories';
import { createCirclePin } from './createCirclePin';

/**
 * EVENT map pin — an Apple-Maps-style circular pin. Events with a photo show the
 * image cropped to a circle inside a white ring; events without a photo show the
 * category emoji on a colour circle. "Happening today" events get a pulsing ring.
 * Built on the shared `createCirclePin` primitive so events, places and meetups
 * share one visual language. (`_badgeEmoji` is kept for call-site compatibility;
 * events intentionally have no corner badge.)
 */
export function createEventPinSVG(
  eventType: string,
  _badgeEmoji?: string,
  imageUrl?: string | null,
  isToday?: boolean,
  label = '',
): HTMLDivElement {
  const color = getCategoryColor(eventType);
  return createCirclePin({
    size: 41, // circle diameter — slightly smaller so event pins sit less heavily on the map
    color,
    label,
    variant: imageUrl ? 'photo' : 'color',
    imageUrl,
    emoji: getCategoryEmoji(eventType),
    today: isToday,
  });
}
