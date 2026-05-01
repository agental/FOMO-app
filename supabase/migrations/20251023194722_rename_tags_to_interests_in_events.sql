/*
  # Rename tags to interests in events table

  1. Changes
    - Rename `tags` column to `interests` in events table
    - This better reflects the actual purpose of the field

  2. Notes
    - Data is preserved during the rename
    - All existing tags will now be called interests
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'tags'
  ) THEN
    ALTER TABLE events RENAME COLUMN tags TO interests;
  END IF;
END $$;
