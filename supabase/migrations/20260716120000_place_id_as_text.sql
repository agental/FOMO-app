/*
  # Let base-map POIs share the admin-place tables

  A tapped Mapbox POI isn't an `admin_locations` row — we key it by a stable text key
  ("lat,lng|name"). To let those POIs be saved (❤️) and reviewed/rated with the SAME sheet and
  tables as admin places, `location_id` must accept any text, not just an admin_locations uuid.

  This drops the foreign key on `location_id` in `saved_places` and `location_reviews` (regardless
  of its auto-generated name) and widens the column to text. Existing uuid values are preserved
  (uuid → text cast). Trade-off: no cascade-delete from admin_locations anymore.
*/

-- Drop every FK constraint that sits on a `location_id` column in these two tables.
do $$
declare r record;
begin
  for r in
    select rel.relname as tbl, con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public'
      and rel.relname in ('saved_places', 'location_reviews')
      and con.contype = 'f'
      and (select attname from pg_attribute
           where attrelid = con.conrelid and attnum = con.conkey[1]) = 'location_id'
  loop
    execute format('alter table public.%I drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

-- Widen location_id to text in both tables (only where they exist).
alter table public.saved_places alter column location_id type text using location_id::text;

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'location_reviews' and column_name = 'location_id') then
    alter table public.location_reviews alter column location_id type text using location_id::text;
  end if;
end $$;
