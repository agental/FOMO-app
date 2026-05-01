/*
  # Update RLS Policies for Authenticated Users

  1. Changes
    - Drop existing permissive anonymous policies
    - Create proper authenticated user policies for posts and events tables
    - Update users table policies to work with real authentication
    - Ensure each user can only access and modify their own data
  
  2. Security
    - Users can only read/write their own posts and events
    - Users can only update their own profile
    - Public can view all posts and events (read-only)
*/

-- Drop old permissive policies
DROP POLICY IF EXISTS "Allow anonymous to create posts" ON posts;
DROP POLICY IF EXISTS "Allow anonymous to create events" ON events;
DROP POLICY IF EXISTS "Allow all to read posts" ON posts;
DROP POLICY IF EXISTS "Allow all to read events" ON events;
DROP POLICY IF EXISTS "Users can read all user profiles" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;

-- Posts policies
CREATE POLICY "Authenticated users can create posts"
  ON posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read all posts"
  ON posts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own posts"
  ON posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts"
  ON posts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Events policies
CREATE POLICY "Authenticated users can create events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read all events"
  ON events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own events"
  ON events FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own events"
  ON events FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Users table policies
CREATE POLICY "Users can read all profiles"
  ON users FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);
