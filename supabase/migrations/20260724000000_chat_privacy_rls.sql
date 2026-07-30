/*
  # Chat privacy: restrict reads to the people actually in the conversation

  VERIFIED PROBLEM (tested against production with a freshly-registered account that belongs to
  nothing): any signed-in user — and in fact anyone holding the anon key, which ships inside the
  client bundle — could read EVERY group message, EVERY private DM, and EVERY conversation row
  straight from the REST API. The client-side fixes stop it showing in the UI; this closes it at
  the database.

  After this migration:
    - group_messages : readable only by APPROVED members of that channel
    - messages (DMs) : readable only by the two participants of the conversation
    - conversations  : readable only by its two participants
    - anon (not signed in) : no read access to any of the three

  Only SELECT policies are touched — sending messages, marking as read, creating conversations and
  joining groups all keep working. SECURITY DEFINER functions (get_chat_list, soft_delete_group_message)
  bypass RLS by design and are unaffected.

  Realtime also respects RLS, so this additionally stops the global notification listener from
  receiving strangers' messages.

  ── ROLLBACK (restores the old open behaviour instantly) ─────────────────────────────────────
      CREATE POLICY "tmp_open" ON public.group_messages FOR SELECT USING (true);
      CREATE POLICY "tmp_open" ON public.messages       FOR SELECT USING (true);
      CREATE POLICY "tmp_open" ON public.conversations  FOR SELECT USING (true);
  ─────────────────────────────────────────────────────────────────────────────────────────────
*/

-- Diagnostic: call supabase.rpc('whoami') from the app; must return your user id while signed in.
CREATE OR REPLACE FUNCTION public.whoami()
RETURNS text LANGUAGE sql STABLE
AS $$ SELECT auth.uid()::text $$;
GRANT EXECUTE ON FUNCTION public.whoami() TO authenticated, anon;

ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations  ENABLE ROW LEVEL SECURITY;

-- Remove the existing permissive SELECT policies (names vary by how the tables were created).
DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['group_messages', 'messages', 'conversations'] LOOP
    FOR p IN SELECT policyname FROM pg_policies
             WHERE schemaname = 'public' AND tablename = t AND cmd = 'SELECT'
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
  END LOOP;
END $$;

-- 1) Group messages → approved members of that channel only.
CREATE POLICY "group_messages_select_approved_members"
  ON public.group_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.channel_id::text = group_messages.channel_id::text
        AND gm.user_id::text    = auth.uid()::text
        AND gm.status = 'approved'
    )
  );

-- 2) Conversations → the two participants only.
CREATE POLICY "conversations_select_participants"
  ON public.conversations FOR SELECT TO authenticated
  USING (
    participant_1_id::text = auth.uid()::text
    OR participant_2_id::text = auth.uid()::text
  );

-- 3) Direct messages → only if you are a participant of their conversation.
CREATE POLICY "messages_select_participants"
  ON public.messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id::text = messages.conversation_id::text
        AND (c.participant_1_id::text = auth.uid()::text
          OR c.participant_2_id::text = auth.uid()::text)
    )
  );
