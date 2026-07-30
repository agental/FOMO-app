/*
  # Enable realtime for event_join_requests

  So approval / rejection / new-request notifications reach users instantly
  (the global in-app notification listener subscribes to postgres_changes on
  this table). Safe/idempotent: only adds the table to the publication if it
  isn't already there.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'event_join_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_join_requests;
  END IF;
END $$;
