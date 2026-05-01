/*
  # Add profile fields to users table
  
  1. New Columns
    - `bio` (text) - User biography/description
    - `age` (integer) - User age
    - `current_country` (text) - Current location country code
    - `languages` (text[]) - Languages the user speaks
    - `interests` (text[]) - User interests/hobbies
    - `visited_countries` (text[]) - Countries the user has visited
  
  2. Notes
    - All fields are optional
    - Arrays default to empty arrays
*/

-- Add new profile columns to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'bio'
  ) THEN
    ALTER TABLE users ADD COLUMN bio text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'age'
  ) THEN
    ALTER TABLE users ADD COLUMN age integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'current_country'
  ) THEN
    ALTER TABLE users ADD COLUMN current_country text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'languages'
  ) THEN
    ALTER TABLE users ADD COLUMN languages text[] DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'interests'
  ) THEN
    ALTER TABLE users ADD COLUMN interests text[] DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'visited_countries'
  ) THEN
    ALTER TABLE users ADD COLUMN visited_countries text[] DEFAULT '{}';
  END IF;
END $$;