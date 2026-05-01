/*
  # Fix Missing Foreign Key Indexes

  1. New Indexes
    - Add index on `events.user_id` to optimize foreign key queries
    - Add index on `messages.sender_id` to optimize foreign key queries
    - Add index on `posts.user_id` to optimize foreign key queries

  2. Security
    - Improves query performance for foreign key lookups
    - Prevents suboptimal query execution plans
*/

-- Add index for events.user_id foreign key
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);

-- Add index for messages.sender_id foreign key
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);

-- Add index for posts.user_id foreign key
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
