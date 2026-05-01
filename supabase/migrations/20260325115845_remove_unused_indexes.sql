/*
  # Remove unused indexes

  1. Performance Improvements
    - Remove indexes that are not being used
    - Reduces storage overhead
    - Improves INSERT/UPDATE performance
    
  2. Removed Indexes
    - idx_events_user_id (unused)
    - idx_messages_sender_id (unused)
    - idx_posts_user_id (unused)
    
  3. Notes
    - These indexes were never used by queries
    - Foreign key indexes are still present and used
*/

-- Remove unused index on events.user_id
DROP INDEX IF EXISTS idx_events_user_id;

-- Remove unused index on messages.sender_id
DROP INDEX IF EXISTS idx_messages_sender_id;

-- Remove unused index on posts.user_id
DROP INDEX IF EXISTS idx_posts_user_id;
