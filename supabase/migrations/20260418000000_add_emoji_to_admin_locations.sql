-- Add emoji column to admin_locations for the map pin badge
alter table public.admin_locations
  add column if not exists emoji text;
