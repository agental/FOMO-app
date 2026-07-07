/*
  # map_areas — admin-drawn central-area highlights

  Admins draw a named polygon on the map; the boundary is stored here and every user sees it
  (rendered as a translucent fill + outline + name label). Mirrors the admin_locations pattern:
  direct client writes gated by RLS (admins only), everyone can read, realtime broadcasts changes.

  ## Table
  - `id`          uuid PK
  - `name`        text — Hebrew label shown on the map
  - `polygon`     jsonb — boundary ring: array of [lng, lat] points
  - `color`       text — accent colour (fill + outline); defaults to brand orange
  - `created_by`  uuid → users(id)
  - `created_at` / `updated_at` timestamptz

  ## Security
  - SELECT: any authenticated user
  - INSERT / UPDATE / DELETE: admins only (users.role = 'admin')
*/

create table if not exists public.map_areas (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  polygon     jsonb not null,
  color       text default '#F97316',
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table public.map_areas enable row level security;

drop policy if exists "map_areas_select" on public.map_areas;
create policy "map_areas_select" on public.map_areas
  for select to authenticated
  using (auth.uid() is not null);

drop policy if exists "map_areas_insert" on public.map_areas;
create policy "map_areas_insert" on public.map_areas
  for insert to authenticated
  with check (exists (select 1 from public.users where users.id = auth.uid() and users.role = 'admin'));

drop policy if exists "map_areas_update" on public.map_areas;
create policy "map_areas_update" on public.map_areas
  for update to authenticated
  using (exists (select 1 from public.users where users.id = auth.uid() and users.role = 'admin'))
  with check (exists (select 1 from public.users where users.id = auth.uid() and users.role = 'admin'));

drop policy if exists "map_areas_delete" on public.map_areas;
create policy "map_areas_delete" on public.map_areas
  for delete to authenticated
  using (exists (select 1 from public.users where users.id = auth.uid() and users.role = 'admin'));

-- keep updated_at fresh
create or replace function public.set_map_areas_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_map_areas_updated_at on public.map_areas;
create trigger trg_map_areas_updated_at
  before update on public.map_areas
  for each row execute function public.set_map_areas_updated_at();

-- realtime so all clients see draws/deletes live (no-op if already published)
do $$ begin
  alter publication supabase_realtime add table public.map_areas;
exception when others then null; end $$;
