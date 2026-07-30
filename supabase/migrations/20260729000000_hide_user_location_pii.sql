/*
  # Hide user latitude/longitude regardless of is_location_shared

  Found while reviewing the earlier email-PII fix: `users.latitude` / `users.longitude` were in the
  "safe columns" grant, so any signed-in user could read anyone's exact GPS coordinates via the API
  — even with `is_location_shared = false`. The client never actually uses another user's lat/long
  (checked: the only read was ProfileScreen's full-profile select, and the value isn't rendered
  anywhere in that component — dead data on the wire, not a real feature).

  Fix: drop latitude/longitude from the authenticated grant entirely. If a "how far away" / shared-
  location feature is built later, it needs a SECURITY DEFINER function that returns coordinates only
  when is_location_shared = true for that row — a plain column grant can't be conditional on another
  column's value, only RLS on rows can, and column visibility isn't row-scoped.

  Run once in the Supabase SQL Editor.
*/

revoke select on public.users from authenticated;
grant select (
  id, display_name, avatar_url, selected_countries, is_location_shared,
  created_at, updated_at, bio, age, current_country, languages, interests, visited_countries,
  full_name, countries, home_base, instagram, telegram, whatsapp, visibility, profile_completed,
  role, gender
) on public.users to authenticated;

select 'FOMO location PII locked ✓' as result;
