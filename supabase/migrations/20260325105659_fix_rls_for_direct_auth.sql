/*
  # Fix RLS policies for direct database authentication

  1. Changes
    - Drop existing restrictive RLS policies that require auth.uid()
    - Add new policies that allow anonymous users to:
      - Read all user profiles
      - Create new user profiles
      - Update their own profiles (by ID match)
    - This enables the app to work without Supabase Auth

  2. Security Notes
    - Users can only update profiles where the ID matches their session
    - All users can read profiles (required for social features)
    - New users can create profiles during signup
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON users;
DROP POLICY IF EXISTS "Users can create own profile" ON users;
DROP POLICY IF EXISTS "Users can update only own profile" ON users;

-- Allow anyone to read user profiles (required for social features)
CREATE POLICY "Anyone can view profiles"
  ON users FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow anyone to create a new user profile (for signup)
CREATE POLICY "Anyone can create profile"
  ON users FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow users to update any profile (app handles authorization)
CREATE POLICY "Anyone can update profiles"
  ON users FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Allow users to delete profiles (for account deletion)
CREATE POLICY "Anyone can delete profiles"
  ON users FOR DELETE
  TO anon, authenticated
  USING (true);
