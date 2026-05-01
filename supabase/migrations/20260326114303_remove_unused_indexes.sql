/*
  # Remove Unused Indexes

  1. Changes
    - Remove unused index `idx_admin_actions_admin_id` from admin_actions table
    - Remove unused index `idx_admin_actions_target_user_id` from admin_actions table
    - Remove unused index `idx_chabad_houses_created_by` from chabad_houses table
    - Remove unused index `idx_conversations_participant_2_id` from conversations table

  2. Performance
    - Reduces storage overhead
    - Improves write performance by eliminating unnecessary index maintenance
*/

-- Remove unused indexes
DROP INDEX IF EXISTS idx_admin_actions_admin_id;
DROP INDEX IF EXISTS idx_admin_actions_target_user_id;
DROP INDEX IF EXISTS idx_chabad_houses_created_by;
DROP INDEX IF EXISTS idx_conversations_participant_2_id;
