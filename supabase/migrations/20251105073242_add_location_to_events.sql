/*
  # Add location coordinates to events table
  
  1. Changes
    - Add latitude column to store event location latitude
    - Add longitude column to store event location longitude
    - Both columns are optional (nullable) to support existing events
    - Adds index on location columns for faster nearby queries
  
  2. Notes
    - Existing events will have NULL values for these fields
    - New events should populate these fields when created
    - Can be used with PostGIS for advanced geospatial queries in the future
*/

-- Add latitude and longitude columns to events table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'latitude'
  ) THEN
    ALTER TABLE events ADD COLUMN latitude double precision;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'longitude'
  ) THEN
    ALTER TABLE events ADD COLUMN longitude double precision;
  END IF;
END $$;

-- Create index for location-based queries
CREATE INDEX IF NOT EXISTS idx_events_location ON events(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN events.latitude IS 'Event location latitude coordinate';
COMMENT ON COLUMN events.longitude IS 'Event location longitude coordinate';
