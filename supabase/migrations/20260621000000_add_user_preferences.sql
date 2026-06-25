-- Cloud-synced user preferences for the Notifications and Privacy settings screens.
-- Stored as flexible JSONB so new toggles can be added without further migrations.
-- Location sharing keeps its own dedicated column (users.is_location_shared),
-- which the map reads from; privacy_prefs carries the remaining privacy toggles.
alter table public.users
  add column if not exists notification_prefs jsonb not null default '{}'::jsonb,
  add column if not exists privacy_prefs       jsonb not null default '{}'::jsonb;

-- No new RLS policies are required: the existing "users can update their own row"
-- policy already covers these columns.
