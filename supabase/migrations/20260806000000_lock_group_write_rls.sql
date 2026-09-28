-- ============================================================================
-- FOMO — SECURITY FIX: close the group WRITE holes found in the RLS audit.
--
-- Holes (all from permissive "WITH CHECK true" / unrestricted policies):
--   1. group_members INSERT (check true)  → self-insert as 'approved'      (self-approve)
--   2. group_members UPDATE (own row, no status limit) → flip own status   (self-approve)
--   3. group_messages INSERT (check true) → post to any channel + forge sender
-- Reads were already locked (approved members only); this locks the writes.
--
-- Legit flows stay working:
--   • request-to-join  → self INSERT with status='pending'
--   • leave / rejoin   → self UPDATE to 'left' / 'pending'
--   • markSeen         → self UPDATE of an ALREADY-approved row (status unchanged)
--   • admin approve    → approve_group_member RPC (admin passes _can_admin_group)
--   • event auto-join  → _ensure_event_group_member sets a session flag the guard honors
--
-- ⚠️ TEST RIGHT AFTER RUNNING (see the checklist in the chat). Rollback is at the bottom.
-- Requires _can_admin_group (from 20260805000000) — recreated here so this is self-contained.
-- ============================================================================

-- ── helpers (idempotent) ────────────────────────────────────────────────────
create or replace function public._group_channel_owner(p_channel_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select e.user_id from public.group_channels gc
  join public.events e on gc.country_code = 'event:' || e.id::text
  where gc.id::text = p_channel_id::text
$$;

create or replace function public._can_admin_group(p_channel_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.is_admin(auth.uid()), false)
      or coalesce(auth.uid()::text = public._group_channel_owner(p_channel_id)::text, false)
$$;

-- ── 1) group_members INSERT: only yourself, only as 'pending' ───────────────
drop policy if exists group_members_insert on public.group_members;
drop policy if exists group_members_insert_self on public.group_members;
create policy group_members_insert_self on public.group_members
  for insert to authenticated
  with check (user_id::text = auth.uid()::text and status = 'pending');

-- ── 2) guard trigger: block a NON-admin from becoming 'approved' via a direct
--       write. Authorized server paths (admin approve → _can_admin_group; event
--       auto-join → the session flag) are allowed. ──────────────────────────
create or replace function public.guard_group_member_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_setting('fomo.member_write', true) = 'ok'
     or coalesce(public._can_admin_group(new.channel_id::uuid), false) then
    return new;
  end if;
  if new.status = 'approved'
     and (tg_op = 'INSERT' or coalesce(old.status, '') <> 'approved') then
    raise exception 'approval must go through approve_group_member';
  end if;
  return new;
end; $$;

drop trigger if exists trg_guard_group_member_write on public.group_members;
create trigger trg_guard_group_member_write
  before insert or update on public.group_members
  for each row execute function public.guard_group_member_write();

-- ── 3) event auto-join writer sets the bypass flag (faithful reproduction of
--       _ensure_event_group_member + the one set_config line) ────────────────
create or replace function public._ensure_event_group_member(p_event_id uuid, p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has     boolean;
  v_title   text;
  v_emoji   text;
  v_country text;
  v_channel uuid;
  v_display text;
  v_avatar  text;
begin
  perform set_config('fomo.member_write', 'ok', true);   -- authorize the approved-member upsert below

  select has_group, title, emoji into v_has, v_title, v_emoji from events where id = p_event_id;
  if not coalesce(v_has, false) then return null; end if;

  v_country := 'event:' || p_event_id::text;
  if v_emoji is null or v_emoji = '' then v_emoji := '🎪'; end if;

  select id into v_channel from group_channels where country_code = v_country limit 1;
  if v_channel is null then
    insert into group_channels (country_code, city_slug, city_name, city_emoji)
    values (v_country, v_emoji, coalesce(v_title, 'אירוע'), v_emoji)
    on conflict (country_code, city_slug) do nothing;
    select id into v_channel from group_channels where country_code = v_country limit 1;
  end if;
  if v_channel is null then return null; end if;

  select display_name, avatar_url into v_display, v_avatar from users where id = p_user_id;

  insert into group_members (channel_id, user_id, display_name, avatar_url, last_seen_at, status)
  values (v_channel, p_user_id, coalesce(v_display, 'משתמש'), v_avatar, now(), 'approved')
  on conflict (channel_id, user_id) do update set status = 'approved';

  return v_channel;
end;
$$;

-- ── 4) group_messages INSERT: admin, OR yourself AND an approved member ─────
drop policy if exists group_messages_insert on public.group_messages;
create policy group_messages_insert on public.group_messages
  for insert to authenticated
  with check (
    public._can_admin_group(channel_id::uuid)
    or (
      user_id::text = auth.uid()::text
      and exists (
        select 1 from public.group_members gm
        where gm.channel_id::text = group_messages.channel_id::text
          and gm.user_id::text = auth.uid()::text
          and gm.status = 'approved'
      )
    )
  );

select 'FOMO group write RLS locked ✓' as status;

-- ============================================================================
-- ROLLBACK — run ONLY if a legit flow breaks; restores the previous behavior:
--
--   drop trigger if exists trg_guard_group_member_write on public.group_members;
--   drop policy  if exists group_members_insert_self on public.group_members;
--   create policy group_members_insert on public.group_members for insert to public with check (true);
--   drop policy  if exists group_messages_insert on public.group_messages;
--   create policy group_messages_insert on public.group_messages for insert to public with check (true);
-- ============================================================================
