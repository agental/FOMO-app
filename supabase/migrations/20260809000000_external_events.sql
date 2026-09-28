-- ============================================================================
-- FOMO — external (aggregated) events. Pulled from public event sites (e.g.
-- phangan.events) by the `import-events` Edge Function. They are shown like any
-- event but instead of the join/approval flow they carry a `external_url` — a
-- "buy tickets" link. `source` + `source_uid` dedupe re-imports; `is_external`
-- flags them for the buy-tickets UI and lets us wipe them cleanly.
--
-- Run this whole block in the Supabase SQL Editor.
-- ============================================================================

alter table public.events
  add column if not exists external_url text,
  add column if not exists source       text,
  add column if not exists source_uid   text,
  add column if not exists is_external  boolean not null default false;

-- One row per (source, source_uid) so re-imports UPDATE instead of duplicating.
-- Full (non-partial) unique index: NULLs are distinct, so normal (source=null) events never collide,
-- and it works cleanly as the ON CONFLICT arbiter for the upsert.
create unique index if not exists events_source_uid_key
  on public.events (source, source_uid);

-- System user that "owns" imported events (FK target for events.user_id). Fill
-- every NOT NULL column the events insert/trigger path expects.
insert into public.users (id, email, display_name, role, selected_countries, is_location_shared, is_seed, profile_completed)
values ('e0000000-0000-4000-a000-000000000001', 'events-bot@fomo.local', 'אירועי תאילנד', 'user', array['TH'], false, true, true)
on conflict (id) do nothing;

select 'FOMO external-events schema ready ✓' as status;
