/*
  # Add emoji field to events table

  1. Changes
    - Add `emoji` column to events table to store the selected emoji for display on maps and cards

  2. Notes
    - Column is optional (nullable) for backwards compatibility with existing events
    - Default emojis can be derived from event_type if emoji is not set
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'emoji'
  ) THEN
    ALTER TABLE events ADD COLUMN emoji text;
  END IF;
END $$;