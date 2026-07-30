import { supabase } from '../lib/supabase';

/*
  Event group chat — reuses the city-chat tables (group_channels / group_members /
  group_messages) so an event group looks & behaves EXACTLY like a city group.

  An event's channel is keyed by a per-event country_code ("event:<id>"), which is
  unique, so it resolves/creates cleanly and renders with the city-chat UI (the
  CityGroupChat component reads its flag/labels from props, not from COUNTRIES).

  Membership is done SERVER-SIDE via the `join_event_group` RPC (SECURITY DEFINER),
  because the group tables' RLS only lets a user add themselves as 'pending'. The
  RPC verifies the caller is the organizer or an approved attendee, then adds them
  as an approved member. Approved buyers are also auto-added by a DB trigger.
*/

export const eventCountryCode = (eventId: string) => `event:${eventId}`;
/** Fallback emoji shown as the group's avatar when the event has none. */
export const EVENT_GROUP_FALLBACK_EMOJI = '🎪';

type EventLike = { id: string };

/** Ensure the caller is an approved member of the event's group. Returns the channel id, or null. */
export async function joinEventGroup(event: EventLike): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('join_event_group', { p_event_id: event.id });
    if (error) { console.error('[joinEventGroup] rpc failed:', error); return null; }
    return (data as string | null) ?? null;
  } catch (e) {
    console.error('[joinEventGroup] failed:', e);
    return null;
  }
}
