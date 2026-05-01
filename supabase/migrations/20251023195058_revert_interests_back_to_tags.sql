/*
  # Revert interests back to tags in events table

  1. Changes
    - Rename `interests` column back to `tags` in events table
    - Reverts the previous migration

  2. Notes
    - Data is preserved during the rename
    - All existing interests will now be called tags again
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'interests'
  ) THEN
    ALTER TABLE events RENAME COLUMN interests TO tags;
  END IF;
END $$;
