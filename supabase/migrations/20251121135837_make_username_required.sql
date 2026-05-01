/*
  # Make Username Required and Remove display_name

  1. Changes to `users` table
    - Make `username` column NOT NULL
    - Remove `display_name` column (if exists)
    - Ensure username uniqueness is enforced

  2. Data Migration
    - For any existing users without username, generate a default username
    - This ensures backward compatibility

  3. Important Notes
    - Username field should already exist from previous migration (20251024082213)
    - Unique index on username already exists (users_username_unique_idx)
    - This migration enforces the NOT NULL constraint
*/

-- Generate username for any users that don't have one
-- Use email prefix as a fallback
DO $$
DECLARE
  user_record RECORD;
  base_username text;
  final_username text;
  counter integer;
BEGIN
  FOR user_record IN
    SELECT id, email
    FROM users
    WHERE username IS NULL
  LOOP
    -- Extract username from email (before @)
    base_username := split_part(user_record.email, '@', 1);

    -- Clean the username: lowercase, remove special chars, limit to 20 chars
    base_username := lower(regexp_replace(base_username, '[^a-z0-9_-]', '', 'g'));
    base_username := substring(base_username from 1 for 15);

    -- Ensure it's at least 3 characters
    IF length(base_username) < 3 THEN
      base_username := 'user' || substring(user_record.id::text from 1 for 3);
    END IF;

    -- Check if username is available, if not append numbers
    final_username := base_username;
    counter := 1;

    WHILE EXISTS (SELECT 1 FROM users WHERE LOWER(username) = LOWER(final_username)) LOOP
      final_username := base_username || counter::text;
      counter := counter + 1;

      -- Safety check to prevent infinite loop
      IF counter > 1000 THEN
        final_username := 'user' || substring(user_record.id::text from 1 for 8);
        EXIT;
      END IF;
    END LOOP;

    -- Update the user with the generated username
    UPDATE users
    SET username = final_username
    WHERE id = user_record.id;

    RAISE NOTICE 'Generated username % for user %', final_username, user_record.email;
  END LOOP;
END $$;

-- Now make username NOT NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'username'
  ) THEN
    ALTER TABLE users ALTER COLUMN username SET NOT NULL;
  END IF;
END $$;

-- Remove display_name column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'display_name'
  ) THEN
    ALTER TABLE users DROP COLUMN display_name;
  END IF;
END $$;
