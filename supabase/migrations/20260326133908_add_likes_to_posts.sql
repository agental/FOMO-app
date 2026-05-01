/*
  # Add likes field to posts table

  1. Changes
    - Add `likes` column (uuid array, default empty array)
    - Stores user IDs of users who liked the post
  
  2. Purpose
    - Track which users liked each post/recommendation
    - Enable like/unlike functionality
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'likes'
  ) THEN
    ALTER TABLE posts ADD COLUMN likes uuid[] DEFAULT '{}';
  END IF;
END $$;
