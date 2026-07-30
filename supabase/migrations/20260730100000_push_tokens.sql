-- ============================================================================
-- FOMO — push_tokens: Expo push tokens for BACKGROUND / remote notifications.
-- The app only fires LOCAL banners while open; to notify a user when the app is
-- backgrounded/closed we need their device push token stored server-side, and an
-- Edge Function (send-push) that pushes to it via the Expo Push API when a new
-- message arrives.
--
-- Run this whole block in the Supabase SQL Editor.
-- ============================================================================

create table if not exists public.push_tokens (
  token       text primary key,                 -- ExponentPushToken[...]; one row per device token
  user_id     uuid not null references public.users(id) on delete cascade,
  platform    text,                             -- 'ios' | 'android'
  updated_at  timestamptz not null default now()
);

create index if not exists push_tokens_user_id_idx on public.push_tokens(user_id);

alter table public.push_tokens enable row level security;

-- A user may only SEE / delete their OWN tokens. Writes go through the RPC below (so a device that
-- switches accounts cleanly re-assigns the token). The send-push Edge Function uses the service role,
-- which bypasses RLS, so it can read every recipient's tokens.
drop policy if exists push_tokens_own_select on public.push_tokens;
drop policy if exists push_tokens_own_delete on public.push_tokens;
create policy push_tokens_own_select on public.push_tokens for select using (auth.uid() = user_id);
create policy push_tokens_own_delete on public.push_tokens for delete using (auth.uid() = user_id);

grant select, delete on public.push_tokens to authenticated;

-- Register (or re-assign) the caller's device token. SECURITY DEFINER so that when the SAME device
-- signs in as a DIFFERENT user, the token row is reassigned to the new user (on conflict) — otherwise
-- RLS would block updating a row owned by the previous account and the old user would keep getting
-- this device's pushes.
create or replace function public.register_push_token(p_token text, p_platform text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_token is null or p_token = '' then
    return;
  end if;
  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), p_platform, now())
  on conflict (token)
  do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;

grant execute on function public.register_push_token(text, text) to authenticated;

select 'FOMO push_tokens ready ✓' as status;
