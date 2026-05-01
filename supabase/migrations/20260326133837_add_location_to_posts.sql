/*
  # Add location fields to posts table

  1. Changes
    - Add `latitude` column (double precision, nullable)
    - Add `longitude` column (double precision, nullable)
    - Add index on (latitude, longitude) for spatial queries
  
  2. Purpose
    - Enable location-based recommendations/posts
    - Allow posts to appear on the map
    - Support nearby recommendations search
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'latitude'
  ) THEN
    ALTER TABLE posts ADD COLUMN latitude double precision;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'longitude'
  ) THEN
    ALTER TABLE posts ADD COLUMN longitude double precision;
  END IF;
END $$;

-- Add index for location-based queries
CREATE INDEX IF NOT EXISTS posts_location_idx ON posts (latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
