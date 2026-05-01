/*
  # Cleanup duplicate SELECT policies

  1. Changes
    - Remove duplicate SELECT policies on users table
    - Keep only one comprehensive SELECT policy that allows:
      - All authenticated users to view all profiles
    
  2. Security
    - Maintains proper access control
    - Simplifies policy structure
*/

-- Drop all existing SELECT policies
DROP POLICY IF EXISTS "Users can read all profiles" ON users;
DROP POLICY IF EXISTS "Users can view all profiles" ON users;
DROP POLICY IF EXISTS "Users can view public profiles and own profile" ON users;

-- Create single comprehensive SELECT policy
CREATE POLICY "Authenticated users can view all profiles"
  ON users
  FOR SELECT
  TO authenticated
  USING (true);
