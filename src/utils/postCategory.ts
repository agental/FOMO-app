// The categories a user can pick for a community recommendation, and the emoji each one wears.
// One source of truth: the picker in CreatePostForm, the map pin, and the feed card all read this,
// so the icon the user chose is the icon that shows up on the map.
import { placePinColor } from './placePinColor';

export interface PostCategory { id: string; emoji: string }

export const POST_CATEGORIES: PostCategory[] = [
  { id: 'מסעדה',   emoji: '🍽️' },
  { id: 'קפה',     emoji: '☕' },
  { id: 'בר',      emoji: '🍸' },
  { id: 'מלון',    emoji: '🏨' },
  { id: 'חוף',     emoji: '🏖️' },
  { id: 'אטרקציה', emoji: '🎡' },
  { id: 'חנות',    emoji: '🛍️' },
  { id: 'טבע',     emoji: '🌿' },
  { id: 'אחר',     emoji: '📍' },
];

const BY_ID: Record<string, string> = Object.fromEntries(POST_CATEGORIES.map(c => [c.id, c.emoji]));

/** Emoji for a recommendation's category (posts store it as `tags[0]`). Falls back to 📍. */
export function postCategoryEmoji(tag?: string | null): string {
  return (tag && BY_ID[tag]) || '📍';
}

/**
 * How a recommendation's pin should look. The author can style it explicitly (`pin_emoji` /
 * `pin_color`); when they haven't, it falls back to the look derived from its category — so
 * recommendations created before the picker existed render exactly as they did.
 */
export function postPinStyle(post: { pin_emoji?: string | null; pin_color?: string | null; tags?: string[] | null }) {
  const emoji = post.pin_emoji || postCategoryEmoji(post.tags?.[0]);
  return { emoji, color: post.pin_color || placePinColor(emoji) };
}

/**
 * Mapbox POI icon (`maki` / `class`) → our category, so tapping a place on the map pre-fills it.
 * Mapbox uses these ids in its `poi-label` layer.
 */
export const MAKI_TO_CATEGORY: Record<string, string> = {
  // food
  restaurant: 'מסעדה', 'fast-food': 'מסעדה', food: 'מסעדה', 'food-and-drink': 'מסעדה',
  pizza: 'מסעדה', sushi: 'מסעדה', bakery: 'מסעדה', 'ice-cream': 'מסעדה', bbq: 'מסעדה', noodle: 'מסעדה',
  // coffee
  cafe: 'קפה', teahouse: 'קפה', coffee: 'קפה',
  // drinks / nightlife
  bar: 'בר', beer: 'בר', nightclub: 'בר', alcohol_shop: 'בר', 'alcohol-shop': 'בר',
  // lodging
  lodging: 'מלון', hotel: 'מלון', hostel: 'מלון', motel: 'מלון', guest_house: 'מלון', campsite: 'מלון',
  // beach / water
  beach: 'חוף', swimming: 'חוף', marina: 'חוף', harbor: 'חוף',
  // attractions & culture
  attraction: 'אטרקציה', museum: 'אטרקציה', monument: 'אטרקציה', 'amusement-park': 'אטרקציה',
  aquarium: 'אטרקציה', zoo: 'אטרקציה', cinema: 'אטרקציה', theatre: 'אטרקציה', art_gallery: 'אטרקציה',
  castle: 'אטרקציה', 'religious-jewish': 'אטרקציה', place_of_worship: 'אטרקציה',
  // shopping
  shop: 'חנות', grocery: 'חנות', 'clothing-store': 'חנות', 'shopping-mall': 'חנות',
  marketplace: 'חנות', 'convenience-store': 'חנות', commercial: 'חנות',
  // nature
  park: 'טבע', garden: 'טבע', natural: 'טבע', mountain: 'טבע', wetland: 'טבע', forest: 'טבע',
  picnic_site: 'טבע', viewpoint: 'טבע',
};

/** Best-guess category for a tapped Mapbox POI (checks both `maki` and `class`). */
export function categoryFromPoi(props: { maki?: string; class?: string } | null | undefined): string | null {
  if (!props) return null;
  return MAKI_TO_CATEGORY[props.maki ?? ''] || MAKI_TO_CATEGORY[props.class ?? ''] || null;
}
