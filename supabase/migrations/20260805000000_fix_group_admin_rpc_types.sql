-- ============================================================================
-- FOMO — FIX: approving/rejecting members and editing the group description broke
-- after 20260804000000. Two causes, both fixed here:
--   1) channel_id / user_id are compared as TEXT across this DB (see the many
--      `::text` casts in the RLS policies), but the first version compared them
--      directly as uuid → a runtime "operator does not exist: text = uuid" error.
--   2) the first DROP only targeted the (uuid,uuid) signature; if the original
--      functions were (text,text) a duplicate overload could remain → ambiguous
--      function resolution. We now drop BOTH signatures before recreating.
-- Also hardens the auth check: coalesce(...) so a NULL (non-admin on a city
-- channel) fails CLOSED instead of slipping through.
--
-- Run this whole block in the Supabase SQL Editor.
-- ============================================================================

-- Owner of an event channel (its organizer); NULL for a city channel.
create or replace function public._group_channel_owner(p_channel_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select e.user_id
  from public.group_channels gc
  join public.events e on gc.country_code = 'event:' || e.id::text
  where gc.id::text = p_channel_id::text
$$;

-- App admin OR the event organizer. coalesce → fails closed on NULL.
create or replace function public._can_admin_group(p_channel_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.is_admin(auth.uid()), false)
      or coalesce(auth.uid()::text = public._group_channel_owner(p_channel_id)::text, false)
$$;

drop function if exists public.approve_group_member(uuid, uuid);
drop function if exists public.approve_group_member(text, text);
create function public.approve_group_member(p_channel_id uuid, p_user_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_rows integer;
begin
  if not coalesce(public._can_admin_group(p_channel_id), false) then
    raise exception 'not authorized';
  end if;
  update public.group_members set status = 'approved'
   where channel_id::text = p_channel_id::text
     and user_id::text    = p_user_id::text
     and status <> 'approved';
  get diagnostics v_rows = row_count;
  return v_rows;
end; $$;

drop function if exists public.reject_group_member(uuid, uuid);
drop function if exists public.reject_group_member(text, text);
create function public.reject_group_member(p_channel_id uuid, p_user_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_rows integer;
begin
  if not coalesce(public._can_admin_group(p_channel_id), false) then
    raise exception 'not authorized';
  end if;
  delete from public.group_members
   where channel_id::text = p_channel_id::text
     and user_id::text    = p_user_id::text
     and status = 'pending';
  get diagnostics v_rows = row_count;
  return v_rows;
end; $$;

drop function if exists public.update_group_description(uuid, text);
drop function if exists public.update_group_description(text, text);
create function public.update_group_description(p_channel_id uuid, p_description text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(public._can_admin_group(p_channel_id), false) then
    raise exception 'not authorized';
  end if;
  update public.group_channels set description = p_description where id::text = p_channel_id::text;
end; $$;

grant execute on function public.approve_group_member(uuid, uuid) to authenticated;
grant execute on function public.reject_group_member(uuid, uuid) to authenticated;
grant execute on function public.update_group_description(uuid, text) to authenticated;

select 'FOMO group-admin RPCs fixed (type-safe) ✓' as status;
