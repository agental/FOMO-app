-- ============================================================================
-- FOMO — the EVENT ORGANIZER is the admin of their event's group chat.
--
-- Bug: the group-admin RPCs authorized only APP admins (users.role = 'admin'),
-- so the person who CREATED the event could not edit the group description or
-- approve/reject members of their own event chat — while an unrelated app admin
-- WAS treated as the admin. This makes the event's organizer the admin of that
-- event's group (app admins still allowed as a safety net). CITY groups are
-- unchanged (still app-admin moderated).
--
-- Event channels are keyed by country_code = 'event:<eventId>' (see
-- 20260717030000_auto_join_event_group_on_approve.sql), so the organizer is
-- events.user_id for that event.
--
-- Run this whole block in the Supabase SQL Editor.
-- ============================================================================

-- Owner of a group channel who gets admin rights: for an EVENT channel that's the
-- event's organizer; NULL for a city channel.
create or replace function public._group_channel_owner(p_channel_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select e.user_id
  from public.group_channels gc
  join public.events e on gc.country_code = 'event:' || e.id::text
  where gc.id = p_channel_id
$$;

-- May the caller run admin actions on this channel? App admin OR the event organizer.
create or replace function public._can_admin_group(p_channel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin(auth.uid())
      or auth.uid() = public._group_channel_owner(p_channel_id)
$$;

-- Approve a pending member (returns rows updated; the client checks > 0).
drop function if exists public.approve_group_member(uuid, uuid);
create function public.approve_group_member(p_channel_id uuid, p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_rows integer;
begin
  if not public._can_admin_group(p_channel_id) then
    raise exception 'not authorized';
  end if;
  update public.group_members
     set status = 'approved'
   where channel_id = p_channel_id and user_id = p_user_id and status <> 'approved';
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

-- Reject a pending member (removes the pending request).
drop function if exists public.reject_group_member(uuid, uuid);
create function public.reject_group_member(p_channel_id uuid, p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_rows integer;
begin
  if not public._can_admin_group(p_channel_id) then
    raise exception 'not authorized';
  end if;
  delete from public.group_members
   where channel_id = p_channel_id and user_id = p_user_id and status = 'pending';
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

-- Edit the group description.
drop function if exists public.update_group_description(uuid, text);
create function public.update_group_description(p_channel_id uuid, p_description text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._can_admin_group(p_channel_id) then
    raise exception 'not authorized';
  end if;
  update public.group_channels set description = p_description where id = p_channel_id;
end;
$$;

grant execute on function public.approve_group_member(uuid, uuid) to authenticated;
grant execute on function public.reject_group_member(uuid, uuid) to authenticated;
grant execute on function public.update_group_description(uuid, text) to authenticated;

select 'FOMO event-organizer group admin ready ✓' as status;
