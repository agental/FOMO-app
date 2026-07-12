// A user's saved / favourite places (the ❤️ on a place card). Private per user — RLS only lets
// you read and write your own rows. Backed by the `saved_places` table.
import { supabase } from '../lib/supabase';

/** The ids of every place this user has saved. Empty set on error (feed still works). */
export async function loadSavedPlaceIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('saved_places')
    .select('location_id')
    .eq('user_id', userId);
  if (error) { console.error('loadSavedPlaceIds:', error.message); return new Set(); }
  return new Set((data ?? []).map(r => r.location_id as string));
}

/** Save or un-save a place. `currentlySaved` is the state BEFORE the tap. */
export async function toggleSavedPlace(userId: string, locationId: string, currentlySaved: boolean) {
  return currentlySaved
    ? supabase.from('saved_places').delete().eq('user_id', userId).eq('location_id', locationId)
    : supabase.from('saved_places').insert({ user_id: userId, location_id: locationId });
}

export interface PlaceSaver {
  userId: string;
  name: string;
  avatarUrl: string | null;
  savedAt: string;
}

/** Everyone who saved a place — powers the "who loved it" list on the place sheet. */
export async function loadPlaceSavers(locationId: string): Promise<PlaceSaver[]> {
  const { data, error } = await supabase
    .from('saved_places')
    .select('user_id, created_at, users(display_name, avatar_url)')
    .eq('location_id', locationId)
    .order('created_at', { ascending: true }); // earliest saver first — they get #1
  if (error) { console.error('loadPlaceSavers:', error.message); return []; }
  return (data ?? []).map((r: any) => ({
    userId:    r.user_id,
    name:      r.users?.display_name || 'מטייל',
    avatarUrl: r.users?.avatar_url ?? null,
    savedAt:   r.created_at,
  }));
}
