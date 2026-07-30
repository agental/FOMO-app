/*
  # Enable realtime for chat messages

  So new direct messages and group messages trigger instant notifications
  (the global notification listener subscribes to postgres_changes on these).
  Safe/idempotent: only adds a table to the publication if it isn't already there.
*/

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['messages', 'group_messages'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t)
       AND NOT EXISTS (
         SELECT 1 FROM pg_publication_tables
         WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
       ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
