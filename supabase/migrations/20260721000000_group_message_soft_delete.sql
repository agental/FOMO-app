/*
  # Soft-delete for group messages (WhatsApp-style "message deleted")

  Instead of hard-deleting a group message, we mark it with `deleted_at`. The original content stays
  in the row so group ADMINS can still see what was written; everyone else sees a "message deleted"
  placeholder (enforced in the client render). REPLICA IDENTITY FULL so the realtime UPDATE payload
  carries the row, letting other members' open chats flip the message to "deleted" live.

  Run once in the Supabase SQL Editor.
*/

ALTER TABLE public.group_messages
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.group_messages REPLICA IDENTITY FULL;
