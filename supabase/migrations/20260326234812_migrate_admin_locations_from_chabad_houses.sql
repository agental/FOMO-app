/*
  # Migrate admin-created locations from chabad_houses to admin_locations

  ## Purpose
  Any rows in chabad_houses that were created by an admin user (created_by IS NOT NULL)
  are custom/admin locations, not actual system Chabad houses. This migration moves them
  to the correct admin_locations table and removes them from chabad_houses.

  ## Changes
  1. INSERT into admin_locations: all chabad_houses rows where created_by IS NOT NULL
  2. DELETE from chabad_houses: those same rows

  ## Notes
  - The 8 seeded Chabad house rows have created_by = NULL and are NOT affected
  - pin_color is preserved during the move (default '#EF4444' used if NULL)
  - Data integrity is maintained - no data is lost
*/

INSERT INTO admin_locations (
  id,
  name,
  description,
  address,
  city,
  country,
  latitude,
  longitude,
  phone,
  email,
  website,
  image_url,
  pin_color,
  created_by,
  created_at,
  updated_at
)
SELECT
  id,
  name,
  description,
  address,
  city,
  country,
  latitude,
  longitude,
  phone,
  email,
  website,
  image_url,
  COALESCE(pin_color, '#EF4444'),
  created_by,
  created_at,
  updated_at
FROM chabad_houses
WHERE created_by IS NOT NULL;

DELETE FROM chabad_houses
WHERE created_by IS NOT NULL;
