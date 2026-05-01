-- Enable pg_cron extension (requires Supabase dashboard: Database → Extensions → pg_cron)
create extension if not exists pg_cron with schema extensions;

-- Grant usage so the cron job can call our function
grant usage on schema public to postgres;

-- Function: deletes events whose date passed more than 30 days ago
create or replace function public.delete_old_events()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.events
  where event_date < now() - interval '30 days';
end;
$$;

-- Schedule: runs every day at 03:00 UTC
select cron.schedule(
  'delete-old-events-daily',        -- job name (unique)
  '0 3 * * *',                      -- cron expression: daily at 03:00 UTC
  $$ select public.delete_old_events(); $$
);
