/*
  # Remove unused indexes to reduce overhead

  1. Performance Improvements
    - Remove indexes that are not being used
    - Reduces storage overhead and write operation costs
    - Improves INSERT/UPDATE/DELETE performance
    
  2. Changes
    - Drop idx_admin_actions_admin_id (not used)
    - Drop idx_admin_actions_target_user_id (not used)
    - Drop idx_chabad_houses_created_by (not used)
    - Drop idx_conversations_participant_2_id (not used)
    - Drop idx_event_join_requests_user_id (not used)
    - Drop idx_messages_conversation_id (not used)
    
  3. Note
    - These indexes were created but are not being utilized by queries
    - Can be re-added if query patterns change in the future
*/

-- Drop unused indexes
DROP INDEX IF EXISTS idx_admin_actions_admin_id;
DROP INDEX IF EXISTS idx_admin_actions_target_user_id;
DROP INDEX IF EXISTS idx_chabad_houses_created_by;
DROP INDEX IF EXISTS idx_conversations_participant_2_id;
DROP INDEX IF EXISTS idx_event_join_requests_user_id;
DROP INDEX IF EXISTS idx_messages_conversation_id;
