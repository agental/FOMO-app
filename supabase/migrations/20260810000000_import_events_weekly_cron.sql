-- ============================================================================
-- FOMO — weekly auto-import of external events (phangan.events → import-events fn).
--
-- Runs the `import-events` Edge Function once a week so new Thailand events show
-- up automatically. Uses pg_cron + pg_net to POST to the function with the shared
-- x-import-secret. Past events are pruned by the existing daily auto-delete cron.
--
-- BEFORE running this block, replace the two placeholders below:
--   <PROJECT_REF>    → your Supabase project ref (the subdomain in your project URL)
--   <IMPORT_SECRET>  → the same value you set with:  supabase secrets set IMPORT_SECRET=...
--
-- Run the whole block in the Supabase SQL Editor.
-- ============================================================================

create extension if not exists pg_cron  with schema extensions;
create extension if not exists pg_net   with schema extensions;

-- Remove a prior copy so re-running this file is safe.
select cron.unschedule('import-external-events-weekly')
where exists (select 1 from cron.job where jobname = 'import-external-events-weekly');

-- Schedule: every Monday at 02:00 UTC.
select cron.schedule(
  'import-external-events-weekly',
  '0 2 * * 1',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/import-events',
    headers := jsonb_build_object(
      'Content-Type',    'application/json',
      'x-import-secret', '<IMPORT_SECRET>'
    ),
    body    := '{}'::jsonb
  );
  $$
);

select 'FOMO weekly import cron scheduled ✓' as status;
