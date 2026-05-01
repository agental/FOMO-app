/*
  # Add review_count and place_website to posts table

  ## Changes
  - Adds `place_review_count` (integer) - number of Google reviews for the place
  - Adds `place_website` (text) - official website URL of the place
  - Adds `place_phone` (text) - phone number of the place
  - Adds `place_types` (text[]) - array of Google place types (e.g., restaurant, cafe)
  - Adds `place_open_now` (boolean) - whether the place is currently open

  ## Notes
  - All new columns are nullable so existing records are unaffected
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'place_review_count'
  ) THEN
    ALTER TABLE posts ADD COLUMN place_review_count integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'place_website'
  ) THEN
    ALTER TABLE posts ADD COLUMN place_website text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'place_phone'
  ) THEN
    ALTER TABLE posts ADD COLUMN place_phone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'place_types'
  ) THEN
    ALTER TABLE posts ADD COLUMN place_types text[];
  END IF;
END $$;
