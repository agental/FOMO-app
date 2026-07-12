/*
  # saved_places — a user's saved / favourite places

  Lets any logged-in user save an admin place (the ❤️ on a place card) and see them under the
  "שמורים" filter in the places feed. Private per user: you can only read/write your own rows.

  ## Table
  - `id`           uuid PK
  - `user_id`      uuid → users(id), cascade
  - `location_id`  uuid → admin_locations(id), cascade
  - `created_at`   timestamptz
  - UNIQUE (user_id, location_id) — saving twice is a no-op

  ## Security
  - SELECT / INSERT / DELETE: only rows where user_id = auth.uid()
*/

create table if not exists public.saved_places (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  location_id uuid not null references public.admin_locations(id) on delete cascade,
  created_at  timestamptz default now(),
  unique (user_id, location_id)
);

alter table public.saved_places enable row level security;

drop policy if exists "saved_places_select_own" on public.saved_places;
create policy "saved_places_select_own" on public.saved_places
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "saved_places_insert_own" on public.saved_places;
create policy "saved_places_insert_own" on public.saved_places
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "saved_places_delete_own" on public.saved_places;
create policy "saved_places_delete_own" on public.saved_places
  for delete to authenticated
  using (user_id = auth.uid());

create index if not exists idx_saved_places_user     on public.saved_places (user_id);
create index if not exists idx_saved_places_location on public.saved_places (location_id);
