/*
  # Allow anonymous users to create posts and events
  
  1. Changes
    - Drop existing restrictive policies
    - Create new policies that allow anonymous users to create content
  
  2. Security
    - This is for demo purposes
    - In production, proper authentication should be required
*/

-- Drop existing policies for posts
DROP POLICY IF EXISTS "Users can create own posts" ON posts;
DROP POLICY IF EXISTS "Users can update own posts" ON posts;
DROP POLICY IF EXISTS "Users can delete own posts" ON posts;

-- Create new policies for posts that allow anon users
CREATE POLICY "Anyone can create posts"
  ON posts FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update posts"
  ON posts FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete posts"
  ON posts FOR DELETE
  TO anon, authenticated
  USING (true);

-- Drop existing policies for events
DROP POLICY IF EXISTS "Users can create own events" ON events;
DROP POLICY IF EXISTS "Users can update own events" ON events;
DROP POLICY IF EXISTS "Users can delete own events" ON events;
DROP POLICY IF EXISTS "Anyone can join events" ON events;

-- Create new policies for events that allow anon users
CREATE POLICY "Anyone can create events"
  ON events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update events"
  ON events FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete events"
  ON events FOR DELETE
  TO anon, authenticated
  USING (true);

-- Update view policies to include anon users
DROP POLICY IF EXISTS "Anyone can view posts" ON posts;
DROP POLICY IF EXISTS "Anyone can view events" ON events;

CREATE POLICY "Anyone can view posts"
  ON posts FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can view events"
  ON events FOR SELECT
  TO anon, authenticated
  USING (true);