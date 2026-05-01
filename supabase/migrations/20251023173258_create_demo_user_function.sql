/*
  # Create demo user helper function
  
  1. Changes
    - Temporarily remove foreign key constraint on users table
    - Allow creating demo users without auth
  
  2. Notes
    - This is for demo purposes only
    - In production, users should go through proper auth flow
*/

-- Drop the foreign key constraint temporarily
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- Insert a demo user
INSERT INTO users (id, email, display_name, selected_countries)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'demo@example.com',
  'משתמש דמו',
  ARRAY['IL', 'TH', 'JP']
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  display_name = EXCLUDED.display_name,
  selected_countries = EXCLUDED.selected_countries;