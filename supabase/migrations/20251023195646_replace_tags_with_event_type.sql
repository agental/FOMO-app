/*
  # Replace tags with event_type in events table

  1. Changes
    - Remove `tags` column from events table
    - Add `event_type` column to store single event type identifier
    - Event type will map to interest categories (parties, treks, yoga, surfing, food, photography)

  2. Notes
    - Existing data will be lost during this migration
    - Event type is optional (nullable)
*/

DO $$
BEGIN
  -- Drop tags column if exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'tags'
  ) THEN
    ALTER TABLE events DROP COLUMN tags;
  END IF;

  -- Add event_type column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'event_type'
  ) THEN
    ALTER TABLE events ADD COLUMN event_type text;
  END IF;
END $$;
