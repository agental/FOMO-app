/*
  # Add missing foreign key indexes

  1. New Indexes
    - `events_user_id_idx` on `public.events(user_id)` - covers events_user_id_fkey
    - `messages_sender_id_idx` on `public.messages(sender_id)` - covers messages_sender_id_fkey
    - `posts_user_id_idx` on `public.posts(user_id)` - covers posts_user_id_fkey

  2. Notes
    - These indexes prevent full table scans when joining or filtering by foreign key columns
    - Using IF NOT EXISTS to avoid errors if any already exist
*/

CREATE INDEX IF NOT EXISTS events_user_id_idx ON public.events(user_id);
CREATE INDEX IF NOT EXISTS messages_sender_id_idx ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS posts_user_id_idx ON public.posts(user_id);
