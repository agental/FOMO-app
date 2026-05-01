/*
  # Add pin_color to chabad_houses table

  ## Changes
  - Add `pin_color` column to `chabad_houses` table
    - Type: text
    - Default: '#9333EA' (purple)
    - Stores the hex color code for the location pin on the map
  
  ## Notes
  - This allows users to customize the color of their location pins
  - Default purple matches the existing color scheme
*/

ALTER TABLE chabad_houses 
ADD COLUMN IF NOT EXISTS pin_color text DEFAULT '#9333EA';
