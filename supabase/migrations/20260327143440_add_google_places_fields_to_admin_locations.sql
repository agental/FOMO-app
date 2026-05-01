/*
  # Add Google Places fields to admin_locations

  ## Purpose
  Enables admin locations to store full Google Places API data so the business card
  can display real Google Maps style place information.

  ## Changes to admin_locations
  - `google_place_id` (text) - Google Places place ID
  - `place_name` (text) - Business name from Google Places
  - `place_address` (text) - Full formatted address from Google Places
  - `place_rating` (numeric) - Star rating from Google Places (0-5)
  - `place_review_count` (integer) - Number of Google reviews
  - `place_photo_url` (text) - Primary photo URL from Google Places
  - `place_photos` (text[]) - Array of photo URLs from Google Places
  - `place_phone` (text) - Phone number from Google Places
  - `place_website` (text) - Website from Google Places
  - `place_types` (text[]) - Business categories from Google Places
  - `place_open_now` (boolean) - Current open/closed status
  - `google_maps_url` (text) - Original Google Maps link pasted by admin

  ## Notes
  1. All new fields are optional to maintain backward compatibility
  2. Existing rows retain their current data
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_locations' AND column_name = 'google_place_id'
  ) THEN
    ALTER TABLE admin_locations ADD COLUMN google_place_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_locations' AND column_name = 'place_name'
  ) THEN
    ALTER TABLE admin_locations ADD COLUMN place_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_locations' AND column_name = 'place_address'
  ) THEN
    ALTER TABLE admin_locations ADD COLUMN place_address text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_locations' AND column_name = 'place_rating'
  ) THEN
    ALTER TABLE admin_locations ADD COLUMN place_rating numeric(3,1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_locations' AND column_name = 'place_review_count'
  ) THEN
    ALTER TABLE admin_locations ADD COLUMN place_review_count integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_locations' AND column_name = 'place_photo_url'
  ) THEN
    ALTER TABLE admin_locations ADD COLUMN place_photo_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_locations' AND column_name = 'place_photos'
  ) THEN
    ALTER TABLE admin_locations ADD COLUMN place_photos text[];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_locations' AND column_name = 'place_phone'
  ) THEN
    ALTER TABLE admin_locations ADD COLUMN place_phone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_locations' AND column_name = 'place_website'
  ) THEN
    ALTER TABLE admin_locations ADD COLUMN place_website text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_locations' AND column_name = 'place_types'
  ) THEN
    ALTER TABLE admin_locations ADD COLUMN place_types text[];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_locations' AND column_name = 'place_open_now'
  ) THEN
    ALTER TABLE admin_locations ADD COLUMN place_open_now boolean;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_locations' AND column_name = 'google_maps_url'
  ) THEN
    ALTER TABLE admin_locations ADD COLUMN google_maps_url text;
  END IF;
END $$;
