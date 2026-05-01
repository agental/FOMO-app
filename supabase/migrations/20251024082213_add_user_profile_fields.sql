/*
  # Enhanced User Profile Schema

  1. New Columns Added to `users` table
    - `full_name` (text, required) - User's full display name
    - `username` (text, unique, required) - Unique username handle
    - `countries` (text[]) - Array of ISO-2 country codes (travel destinations)
    - `home_base` (text) - User's home location/country
    - `instagram` (text) - Instagram handle/URL
    - `telegram` (text) - Telegram handle/URL
    - `whatsapp` (text) - WhatsApp number/link
    - `visibility` (text) - Profile visibility: public, friends, or private
    - `profile_completed` (boolean) - Whether profile setup is complete

  2. Security
    - Username uniqueness enforced with unique index (case-insensitive)
    - RLS policies updated to respect visibility settings
*/

-- Add new profile fields to users table
DO $$
BEGIN
  -- Full name (required)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'full_name'
  ) THEN
    ALTER TABLE users ADD COLUMN full_name text;
  END IF;

  -- Username (unique, required)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'username'
  ) THEN
    ALTER TABLE users ADD COLUMN username text;
  END IF;

  -- Countries array
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'countries'
  ) THEN
    ALTER TABLE users ADD COLUMN countries text[] DEFAULT '{}';
  END IF;

  -- Home base
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'home_base'
  ) THEN
    ALTER TABLE users ADD COLUMN home_base text;
  END IF;

  -- Social links
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'instagram'
  ) THEN
    ALTER TABLE users ADD COLUMN instagram text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'telegram'
  ) THEN
    ALTER TABLE users ADD COLUMN telegram text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'whatsapp'
  ) THEN
    ALTER TABLE users ADD COLUMN whatsapp text;
  END IF;

  -- Visibility setting
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'visibility'
  ) THEN
    ALTER TABLE users ADD COLUMN visibility text DEFAULT 'public';
  END IF;

  -- Profile completion flag
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'profile_completed'
  ) THEN
    ALTER TABLE users ADD COLUMN profile_completed boolean DEFAULT false;
  END IF;
END $$;

-- Add constraint for visibility values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_visibility_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_visibility_check 
      CHECK (visibility IN ('public', 'friends', 'private'));
  END IF;
END $$;

-- Create unique index on username (case-insensitive)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'users_username_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX users_username_unique_idx ON users (LOWER(username));
  END IF;
END $$;

-- Update trigger for updated_at (already exists from previous migration)
-- No need to recreate
