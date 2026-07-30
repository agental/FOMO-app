/*
  # Restrict group message reads to approved members (privacy fix)

  Today `group_messages` is world-readable: anyone holding the anon key (which ships inside the
  client bundle, so it is effectively public) can read every group's messages straight from the REST
  API. The client-side fix stops a non-member from *seeing* them in the UI, but the data itself is
  still exposed. This migration enforces it in the database.

  After this, a row in group_messages is readable ONLY by a signed-in user who is an APPROVED member
  of that channel. Unauthenticated (anon) reads are blocked entirely.

  Not affected (they run as SECURITY DEFINER and intentionally bypass RLS):
    - get_chat_list()               → chat list previews / unread counts
    - soft_delete_group_message()   → "message deleted"

  Realtime: postgres_changes respects RLS, so approved members keep receiving their groups' messages
  live, and non-members stop receiving them — which is the point.

  ── ROLLBACK (if anything breaks, run this one statement and chats work again) ────────────────
      CREATE POLICY "group_messages_read_all" ON public.group_messages FOR SELECT USING (true);
  ─────────────────────────────────────────────────────────────────────────────────────────────
*/

-- Diagnostic helper: call from the app (supabase.rpc('whoami')) to confirm the JWT reaches Postgres.
-- Should return your user id. If it returns NULL while signed in, RLS by auth.uid() cannot work —
-- run the ROLLBACK above and say so.
CREATE OR REPLACE FUNCTION public.whoami()
RETURNS text
LANGUAGE sql
STABLE
AS $$ SELECT auth.uid()::text $$;

GRANT EXECUTE ON FUNCTION public.whoami() TO authenticated, anon;

-- Make sure RLS is actually on (a table with RLS disabled ignores every policy).
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

-- Drop whatever permissive SELECT policies exist today (names vary by how the table was created).
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'group_messages' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.group_messages', p.policyname);
  END LOOP;
END $$;

-- Only approved members of the channel may read its messages.
CREATE POLICY "group_messages_select_approved_members"
  ON public.group_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.group_members gm
      WHERE gm.channel_id::text = group_messages.channel_id::text
        AND gm.user_id::text    = auth.uid()::text
        AND gm.status = 'approved'
    )
  );
