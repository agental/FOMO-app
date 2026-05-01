/*
  # Remove Unused Indexes

  1. Performance Improvements
    - Remove indexes that are not being used by queries
    - Reduces storage overhead and improves write performance
  
  2. Indexes Removed
    - idx_events_user_id (replaced by foreign key index)
    - idx_messages_sender_id (not used in queries)
    - idx_posts_user_id (replaced by foreign key index)
*/

-- Remove unused index on events.user_id
DROP INDEX IF EXISTS idx_events_user_id;

-- Remove unused index on messages.sender_id
DROP INDEX IF EXISTS idx_messages_sender_id;

-- Remove unused index on posts.user_id
DROP INDEX IF EXISTS idx_posts_user_id;