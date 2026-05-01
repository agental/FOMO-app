/*
  # Add is_private column to events

  1. Changes
    - Adds `is_private` boolean column to the `events` table with a default of false
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'is_private'
  ) THEN
    ALTER TABLE events ADD COLUMN is_private boolean NOT NULL DEFAULT false;
  END IF;
END $$;
