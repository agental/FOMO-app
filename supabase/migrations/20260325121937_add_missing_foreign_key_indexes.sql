/*
  # Add missing foreign key indexes for performance

  1. Performance Improvements
    - Add indexes on foreign key columns that are missing them
    - These indexes improve JOIN performance and foreign key constraint checks
    
  2. Changes
    - Add index on events(user_id) for events_user_id_fkey
    - Add index on messages(sender_id) for messages_sender_id_fkey
    - Add index on posts(user_id) for posts_user_id_fkey
    
  3. Security
    - No security changes, only performance optimization
    - Indexes are safe and recommended for all foreign keys
*/

-- Add index for events.user_id foreign key
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);

-- Add index for messages.sender_id foreign key
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);

-- Add index for posts.user_id foreign key
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
