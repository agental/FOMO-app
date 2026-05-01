/*
  # Update RLS Policies for User Profiles

  1. Changes
    - Drop old policies
    - Create new policies respecting visibility settings
    - Public profiles can be viewed by anyone authenticated
    - Private profiles only by owner
    - Users can always read/update their own profile

  2. Security
    - SELECT: Public profiles OR owner
    - UPDATE: Only owner
    - INSERT: Only authenticated users creating their own profile
    - DELETE: Prevented (no delete policy)
*/

-- Drop all existing policies on users table
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Users can insert own data" ON users;
DROP POLICY IF EXISTS "Users can read public profiles" ON users;
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON users;
DROP POLICY IF EXISTS "Enable update for users based on id" ON users;

-- RLS Policy: Users can read public profiles or their own profile
CREATE POLICY "Users can view public profiles and own profile"
  ON users FOR SELECT
  TO authenticated
  USING (
    visibility = 'public' OR auth.uid() = id
  );

-- RLS Policy: Users can update only their own profile
CREATE POLICY "Users can update only own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- RLS Policy: Users can insert their own profile on signup
CREATE POLICY "Users can create own profile"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);
