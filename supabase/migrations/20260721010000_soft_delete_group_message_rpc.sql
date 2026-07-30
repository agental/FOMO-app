/*
  # soft_delete_group_message(p_message_id, p_actor)

  Marks a group message as deleted (WhatsApp-style). group_messages has no UPDATE RLS policy, so a
  direct client UPDATE is silently blocked (0 rows) — the delete looked like it worked locally but
  never persisted and never reached other members. This SECURITY DEFINER function performs the update
  server-side after verifying the actor is EITHER the message author OR an app admin (users.role =
  'admin') — the same permission model the client uses (canDelete = isMine || amAdmin). Because it runs
  as the table owner, the UPDATE is captured by logical replication and pushed to every member's open
  chat in realtime. Returns true if the delete was applied.

  Run once in the Supabase SQL Editor.
*/

CREATE OR REPLACE FUNCTION public.soft_delete_group_message(p_message_id uuid, p_actor uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author   text;
  v_is_admin boolean;
BEGIN
  SELECT user_id::text INTO v_author FROM group_messages WHERE id = p_message_id;
  IF v_author IS NULL THEN
    RETURN false; -- message not found (or already gone)
  END IF;

  SELECT (role = 'admin') INTO v_is_admin FROM users WHERE id::text = p_actor::text;

  IF v_author = p_actor::text OR COALESCE(v_is_admin, false) THEN
    UPDATE group_messages SET deleted_at = now() WHERE id = p_message_id;
    RETURN true;
  END IF;

  RETURN false; -- not the author and not an admin → not allowed
END;
$$;

GRANT EXECUTE ON FUNCTION public.soft_delete_group_message(uuid, uuid) TO authenticated, anon;
