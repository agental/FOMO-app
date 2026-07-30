-- ============================================================================
-- FOMO — "featured location" admin alert.
-- When a map location crosses the like/save threshold (default 50), the admin
-- panel shows it so the admin can upgrade its pin to the featured design. Once
-- upgraded, the admin marks it featured and it stops showing.
--
-- Run this whole block in the Supabase SQL Editor.
-- ============================================================================

-- Flag set by the admin once the pin has been upgraded (so the alert clears).
alter table public.admin_locations
  add column if not exists is_featured boolean not null default false;

-- Locations that passed the threshold and are NOT featured yet (admin-only).
-- SECURITY DEFINER so it can count every user's saved_places (RLS would otherwise
-- only expose the caller's own saves); gated to admins.
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
    select l.id, l.name, count(s.*) as saves
    from public.admin_locations l
    join public.saved_places s on s.location_id = l.id
    where coalesce(l.is_featured, false) = false
    group by l.id, l.name
    having count(s.*) >= p_threshold
    order by count(s.*) desc;
end;
$$;

grant execute on function public.admin_pending_featured_locations(int) to authenticated;

select 'FOMO featured-locations ready ✓' as status;
