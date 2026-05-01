/**
 * Shared event-filtering utilities used by both HomeScreen and MapScreen.
 * All country matching uses ISO 3166-1 alpha-2 codes (e.g. TH, PH, IL).
 */

/**
 * Returns events that belong to any of the user's selected countries.
 */
export function getEventsForSelectedCountries<T extends { country?: string | null }>(
  events: T[],
  selectedCountries: string[]
): T[] {
  if (!selectedCountries.length) return events;
  return events.filter(e => e.country && selectedCountries.includes(e.country));
}

/**
 * Returns events that belong to one specific country.
 */
export function getEventsForCountry<T extends { country?: string | null }>(
  events: T[],
  countryCode: string
): T[] {
  return events.filter(e => e.country === countryCode);
}

/**
 * Builds the array of country codes to pass to Supabase `.in('country', ...)`.
 * No countries are forced-added — the filter is exactly what the user selected.
 */
export function buildCountryFilterArray(selectedCountries: string[]): string[] {
  return selectedCountries || [];
}

/**
 * Returns true when an item's country is one the user selected.
 * If selectedCountries is empty, everything passes through.
 */
export function shouldShowItem(
  itemCountryCode: string | null | undefined,
  selectedCountries: string[]
): boolean {
  if (!selectedCountries || selectedCountries.length === 0) return true;
  if (!itemCountryCode) return false;
  return selectedCountries.includes(itemCountryCode);
}
