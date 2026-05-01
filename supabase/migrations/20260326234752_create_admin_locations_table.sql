/*
  # Create admin_locations table

  ## Purpose
  Separates admin-created custom locations from the system Chabad houses table.
  This enables:
  - Chabad houses to keep their fixed original pin design
  - Admin locations to use the new dynamic pin design with customizable color and image

  ## New Tables
  - `admin_locations`
    - `id` (uuid, primary key)
    - `name` (text, required) - Location display name
    - `description` (text, optional) - Short description
    - `address` (text, optional) - Street address
    - `city` (text, optional) - City name
    - `country` (text, required) - ISO country code
    - `latitude` (decimal, required) - Map coordinate
    - `longitude` (decimal, required) - Map coordinate
    - `phone` (text, optional) - Contact phone
    - `email` (text, optional) - Contact email
    - `website` (text, optional) - Website URL
    - `image_url` (text, optional) - Pin image URL
    - `pin_color` (text, default '#EF4444') - Custom pin color hex code
    - `created_by` (uuid, FK to users) - Admin who created it
    - `created_at` (timestamptz) - Creation timestamp
    - `updated_at` (timestamptz) - Last update timestamp

  ## Security
  - RLS enabled on admin_locations
  - All authenticated users can SELECT (view locations on map)
  - Only users with role='admin' can INSERT, UPDATE, DELETE

  ## Notes
  1. chabad_houses table is NOT modified - retains its existing data and structure
  2. Admin-created entries previously stored in chabad_houses are migrated in a separate step
*/

CREATE TABLE IF NOT EXISTS admin_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  address text,
  city text,
  country text NOT NULL,
  latitude decimal(10,7) NOT NULL,
  longitude decimal(10,7) NOT NULL,
  phone text,
  email text,
  website text,
  image_url text,
  pin_color text DEFAULT '#EF4444',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE admin_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view admin locations"
  ON admin_locations
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert admin locations"
  ON admin_locations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update admin locations"
  ON admin_locations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete admin locations"
  ON admin_locations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_admin_locations_coordinates ON admin_locations (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_admin_locations_country ON admin_locations (country);
CREATE INDEX IF NOT EXISTS idx_admin_locations_created_by ON admin_locations (created_by);

CREATE OR REPLACE FUNCTION update_admin_locations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_admin_locations_updated_at
  BEFORE UPDATE ON admin_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_locations_updated_at();
