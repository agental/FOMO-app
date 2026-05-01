/*
  # Add display_name back to users table

  1. Changes to `users` table
    - Add `display_name` column as required field
    - Keep `username` as required and unique (for identification)
    - display_name is for public display, username is for unique identity

  2. Data Migration
    - Initialize display_name from username for existing users
    - Convert username to a more readable format (capitalize first letter)

  3. Important Notes
    - username remains required and unique (for @mentions, URLs, etc.)
    - display_name is what users see in the UI
    - This gives users both a unique identifier and a friendly display name
*/

-- Add display_name column back
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'display_name'
  ) THEN
    ALTER TABLE users ADD COLUMN display_name text;
  END IF;
END $$;

-- Populate display_name from username for existing users
-- Capitalize first letter and replace underscores/hyphens with spaces
UPDATE users
SET display_name = initcap(replace(replace(username, '_', ' '), '-', ' '))
WHERE display_name IS NULL;

-- Make display_name required
ALTER TABLE users ALTER COLUMN display_name SET NOT NULL;
