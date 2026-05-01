/*
  # Create Chabad Houses Table
  
  ## Description
  This migration creates a table for storing Chabad house locations that admins can add to the map.
  
  ## New Tables
  
  ### `chabad_houses`
  - `id` (uuid, primary key) - Unique identifier
  - `name` (text, required) - Name of the Chabad house
  - `description` (text) - Description/details about the location
  - `address` (text) - Full address
  - `city` (text) - City name
  - `country` (text, required) - Country code
  - `latitude` (decimal, required) - Latitude coordinate
  - `longitude` (decimal, required) - Longitude coordinate
  - `phone` (text) - Contact phone number
  - `email` (text) - Contact email
  - `website` (text) - Website URL
  - `image_url` (text) - Image of the location
  - `created_by` (uuid, foreign key) - Admin who created this entry
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  
  ## Security
  - Enable RLS on `chabad_houses` table
  - All authenticated users can SELECT (view) Chabad houses
  - Only admins can INSERT new Chabad houses
  - Only admins can UPDATE existing Chabad houses
  - Only admins can DELETE Chabad houses
*/

-- Create the chabad_houses table
CREATE TABLE IF NOT EXISTS chabad_houses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  address text,
  city text,
  country text NOT NULL,
  latitude decimal(10, 8) NOT NULL,
  longitude decimal(11, 8) NOT NULL,
  phone text,
  email text,
  website text,
  image_url text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE chabad_houses ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can view Chabad houses
CREATE POLICY "Anyone can view Chabad houses"
  ON chabad_houses
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Only admins can insert Chabad houses
CREATE POLICY "Admins can insert Chabad houses"
  ON chabad_houses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Policy: Only admins can update Chabad houses
CREATE POLICY "Admins can update Chabad houses"
  ON chabad_houses
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

-- Policy: Only admins can delete Chabad houses
CREATE POLICY "Admins can delete Chabad houses"
  ON chabad_houses
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Create index for location-based queries
CREATE INDEX IF NOT EXISTS chabad_houses_location_idx ON chabad_houses(latitude, longitude);
CREATE INDEX IF NOT EXISTS chabad_houses_country_idx ON chabad_houses(country);
CREATE INDEX IF NOT EXISTS chabad_houses_created_by_idx ON chabad_houses(created_by);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_chabad_houses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_chabad_houses_updated_at
  BEFORE UPDATE ON chabad_houses
  FOR EACH ROW
  EXECUTE FUNCTION update_chabad_houses_updated_at();
