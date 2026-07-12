// Google Places `types[]` → a short Hebrew category label, for the Apple-Maps-style line under
// the place name ("בית קפה · ★ 4.6"). Google returns types most-specific-first, but pads the list
// with generics (point_of_interest / establishment), so we take the first SPECIFIC match and only
// fall back to a broad one ("חנות" / "אוכל") if nothing better exists.

const LABELS: Record<string, string> = {
  // food & drink
  restaurant: 'מסעדה', cafe: 'בית קפה', bar: 'בר', bakery: 'מאפייה', night_club: 'מועדון',
  meal_takeaway: 'טייק אווי', meal_delivery: 'משלוחים', liquor_store: 'חנות משקאות',
  // lodging
  lodging: 'לינה', hotel: 'מלון', hostel: 'הוסטל', campground: 'קמפינג', rv_park: 'קרוואנים',
  // wellness
  spa: 'ספא', gym: 'חדר כושר', beauty_salon: 'מכון יופי', hair_care: 'מספרה',
  // health
  pharmacy: 'בית מרקחת', hospital: 'בית חולים', doctor: 'רופא', dentist: 'רופא שיניים',
  veterinary_care: 'וטרינר',
  // shopping
  shopping_mall: 'קניון', supermarket: 'סופרמרקט', grocery_or_supermarket: 'מכולת',
  convenience_store: 'חנות נוחות', clothing_store: 'חנות בגדים', book_store: 'חנות ספרים',
  jewelry_store: 'תכשיטים', shoe_store: 'חנות נעליים', laundry: 'מכבסה',
  // outdoors & culture
  park: 'פארק', tourist_attraction: 'אתר תיירות', museum: 'מוזיאון', art_gallery: 'גלריה',
  zoo: 'גן חיות', aquarium: 'אקווריום', amusement_park: 'פארק שעשועים', movie_theater: 'קולנוע',
  library: 'ספרייה', stadium: 'אצטדיון',
  // worship
  synagogue: 'בית כנסת', church: 'כנסייה', mosque: 'מסגד', hindu_temple: 'מקדש',
  place_of_worship: 'בית תפילה',
  // money & services
  bank: 'בנק', atm: 'כספומט', post_office: 'דואר', police: 'משטרה', travel_agency: 'סוכנות נסיעות',
  // transport
  airport: 'שדה תעופה', bus_station: 'תחנת אוטובוס', train_station: 'תחנת רכבת',
  subway_station: 'רכבת תחתית', taxi_stand: 'תחנת מוניות', car_rental: 'השכרת רכב',
  gas_station: 'תחנת דלק', parking: 'חניון', ferry_terminal: 'מסוף מעבורות',
  // education
  school: 'בית ספר', university: 'אוניברסיטה',
  // broad fallbacks (only used if nothing more specific matched)
  store: 'חנות', food: 'אוכל',
};

const BROAD = new Set(['store', 'food']);

/** Short Hebrew category for a place, or null when Google gave us nothing usable. */
export function placeCategory(types?: string[] | null): string | null {
  if (!types?.length) return null;
  let broad: string | null = null;
  for (const t of types) {
    const label = LABELS[t];
    if (!label) continue;
    if (BROAD.has(t)) { broad = broad ?? label; continue; }
    return label; // first specific hit wins
  }
  return broad;
}
