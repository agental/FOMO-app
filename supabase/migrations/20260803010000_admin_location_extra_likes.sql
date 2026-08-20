-- ============================================================================
-- FOMO — admin can EDIT how many likes an admin_location pin shows.
-- `extra_likes` is added on top of the real `saved_places` count. The featured
-- alert (RPC below) counts real saves + extra_likes, so a manually-boosted pin
-- also triggers the "passed 50 likes → upgrade the pin ⭐" alert in the admin panel.
--
-- Run this whole block in the Supabase SQL Editor.
-- ============================================================================

alter table public.admin_locations
  add column if not exists extra_likes int not null default 0;

create or replace function public.admin_pending_featured_locations(p_threshold int default 50)
returns table (id uuid, name text, saves bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'not authorized';
  end if;
  return query
    select l.id, l.name, (count(s.*) + coalesce(l.extra_likes, 0))::bigint as saves
    from public.admin_locations l
    left join public.saved_places s on s.location_id = l.id
    where coalesce(l.is_featured, false) = false
    group by l.id, l.name, l.extra_likes
    having (count(s.*) + coalesce(l.extra_likes, 0)) >= p_threshold
    order by (count(s.*) + coalesce(l.extra_likes, 0)) desc;
end;
$$;

grant execute on function public.admin_pending_featured_locations(int) to authenticated;

select 'FOMO admin extra_likes ready ✓' as status;
