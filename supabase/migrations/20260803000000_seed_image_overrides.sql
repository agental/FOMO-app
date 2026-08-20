/*
  # seed_image_overrides — the "learning" table for admin-curated seed-event covers

  When an admin replaces a generated seed event's cover image in the app, the app saves the choice
  here keyed by the event's template (seed_key, e.g. 'beach:2'). The seed-events Edge Function reads
  this table and REUSES that image for the same template on future generations — so the system learns
  the admin's preferred image per event type.

  Run in the Supabase SQL Editor.
*/
create table if not exists public.seed_image_overrides (
  seed_key   text primary key,
  image_url  text not null,
  updated_at timestamptz not null default now()
);

alter table public.seed_image_overrides enable row level security;

-- Everyone signed-in may read; only admins may write (the app's admin cover-edit).
create policy seed_img_read   on public.seed_image_overrides for select to authenticated using (true);
create policy seed_img_insert on public.seed_image_overrides for insert to authenticated with check (public.is_admin(auth.uid()));
create policy seed_img_update on public.seed_image_overrides for update to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
