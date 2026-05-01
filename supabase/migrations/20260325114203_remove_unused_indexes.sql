/*
  # Remove Unused Indexes

  1. Performance Improvements
    - Remove indexes that are not being used to reduce database overhead
    - Indexes consume storage and slow down write operations
    - Keep only the essential foreign key indexes we just added

  2. Changes
    - Drop unused indexes on posts, events, users, admin_actions, conversations, messages, chabad_houses, event_join_requests
    - This will improve write performance and reduce storage usage
*/

-- Drop unused indexes on posts
DROP INDEX IF EXISTS posts_country_idx;
DROP INDEX IF EXISTS posts_created_at_idx;

-- Drop unused indexes on events
DROP INDEX IF EXISTS events_country_idx;
DROP INDEX IF EXISTS events_event_date_idx;
DROP INDEX IF EXISTS events_created_at_idx;
DROP INDEX IF EXISTS idx_events_location;

-- Drop unused indexes on users
DROP INDEX IF EXISTS users_role_idx;

-- Drop unused indexes on admin_actions
DROP INDEX IF EXISTS admin_actions_admin_id_idx;
DROP INDEX IF EXISTS admin_actions_created_at_idx;
DROP INDEX IF EXISTS admin_actions_target_idx;
DROP INDEX IF EXISTS admin_actions_target_user_idx;

-- Drop unused indexes on conversations
DROP INDEX IF EXISTS idx_conversations_participant_1;
DROP INDEX IF EXISTS idx_conversations_participant_2;

-- Drop unused indexes on messages
DROP INDEX IF EXISTS idx_messages_conversation_time;
DROP INDEX IF EXISTS idx_messages_unread;

-- Drop unused indexes on chabad_houses
DROP INDEX IF EXISTS chabad_houses_location_idx;
DROP INDEX IF EXISTS chabad_houses_country_idx;
DROP INDEX IF EXISTS chabad_houses_created_by_idx;

-- Drop unused indexes on event_join_requests
DROP INDEX IF EXISTS event_join_requests_event_id_idx;
DROP INDEX IF EXISTS event_join_requests_user_id_idx;
DROP INDEX IF EXISTS event_join_requests_status_idx;

-- Note: We keep idx_events_user_id, idx_messages_sender_id, idx_posts_user_id
-- because they are foreign key indexes needed for query performance
