/*
  # Fix Missing Foreign Key Indexes and Remove Unused Indexes

  1. Foreign Key Indexes Added
    - Add index on `admin_actions.admin_id` for better query performance
    - Add index on `admin_actions.target_user_id` for better query performance
    - Add index on `chabad_houses.created_by` for better query performance
    - Add index on `conversations.participant_2_id` for better query performance
    
  2. Unused Indexes Removed
    - Remove `idx_events_user_id` (not being used)
    - Remove `idx_messages_sender_id` (not being used)
    - Remove `idx_posts_user_id` (not being used)

  3. Security & Performance
    - Improves query performance on foreign key lookups
    - Reduces index overhead by removing unused indexes
*/

-- Add missing foreign key indexes
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin_id ON public.admin_actions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_target_user_id ON public.admin_actions(target_user_id);
CREATE INDEX IF NOT EXISTS idx_chabad_houses_created_by ON public.chabad_houses(created_by);
CREATE INDEX IF NOT EXISTS idx_conversations_participant_2_id ON public.conversations(participant_2_id);

-- Remove unused indexes
DROP INDEX IF EXISTS public.idx_events_user_id;
DROP INDEX IF EXISTS public.idx_messages_sender_id;
DROP INDEX IF EXISTS public.idx_posts_user_id;