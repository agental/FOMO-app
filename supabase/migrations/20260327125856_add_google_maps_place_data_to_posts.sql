/*
  # Add Google Maps Place Data to Posts

  1. New Columns
    - `google_place_id` (text) - Unique Google Place identifier for caching
    - `place_name` (text) - Official place name from Google Maps
    - `place_address` (text) - Full formatted address
    - `place_rating` (numeric) - Google rating (1-5 scale)
    - `place_photo_url` (text) - Primary photo URL from Google Places
    - `city` (text) - City name extracted from place data
    
  2. Purpose
    - Store Google Maps place data for recommendations
    - Enable rich place information display
    - Cache API responses to reduce costs
    - Support navigation and place linking
    
  3. Indexes
    - Add index on google_place_id for quick lookups
*/

DO $$
BEGIN
  -- Add google_place_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'google_place_id'
  ) THEN
    ALTER TABLE posts ADD COLUMN google_place_id text;
  END IF;

  -- Add place_name
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'place_name'
  ) THEN
    ALTER TABLE posts ADD COLUMN place_name text;
  END IF;

  -- Add place_address
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'place_address'
  ) THEN
    ALTER TABLE posts ADD COLUMN place_address text;
  END IF;

  -- Add place_rating
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'place_rating'
  ) THEN
    ALTER TABLE posts ADD COLUMN place_rating numeric(2,1);
  END IF;

  -- Add place_photo_url
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'place_photo_url'
  ) THEN
    ALTER TABLE posts ADD COLUMN place_photo_url text;
  END IF;

  -- Add city
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'city'
  ) THEN
    ALTER TABLE posts ADD COLUMN city text;
  END IF;
END $$;

-- Create index on google_place_id for efficient lookups
CREATE INDEX IF NOT EXISTS posts_google_place_id_idx ON posts (google_place_id) WHERE google_place_id IS NOT NULL;