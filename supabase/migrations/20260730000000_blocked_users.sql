/*
  # Blocked users (private-chat "block")

  Lets a user block another user from the private-chat 3-dots menu. Each row is one direction
  (blocker → blocked). A user manages only their OWN blocks:
    - SELECT / INSERT / DELETE : only rows where blocker_id = auth.uid()
  The client hides blocked users from the messages list and closes the open chat.

  (Server-side enforcement — stopping a blocked user from sending you NEW messages — can be layered
  on later via the messages INSERT policy; this table is the foundation.)

  Run once in the Supabase SQL Editor.
*/

create table if not exists public.blocked_users (
  blocker_id uuid not null references public.users(id) on delete cascade,
  blocked_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

create index if not exists idx_blocked_users_blocker on public.blocked_users(blocker_id);

alter table public.blocked_users enable row level security;

drop policy if exists blocked_users_select_own on public.blocked_users;
create policy blocked_users_select_own on public.blocked_users
  for select to authenticated using (blocker_id = auth.uid());

drop policy if exists blocked_users_insert_own on public.blocked_users;
create policy blocked_users_insert_own on public.blocked_users
  for insert to authenticated with check (blocker_id = auth.uid());

drop policy if exists blocked_users_delete_own on public.blocked_users;
create policy blocked_users_delete_own on public.blocked_users
  for delete to authenticated using (blocker_id = auth.uid());

select 'FOMO blocked_users ready ✓' as result;
