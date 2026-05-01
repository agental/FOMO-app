/*
  # Fix user insert policy

  1. Changes
    - Drop the existing restrictive INSERT policy
    - Create a new INSERT policy that allows authenticated users to create their own profile
    - This fixes the issue where users couldn't be created after signup

  2. Security
    - Users can only insert their own record (where auth.uid() = id)
    - Policy applies only to authenticated users
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Users can create own profile" ON users;

-- Create new policy that allows authenticated users to insert their own profile
CREATE POLICY "Users can create own profile"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);
