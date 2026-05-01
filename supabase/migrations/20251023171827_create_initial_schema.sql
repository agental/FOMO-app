/*
  # Create initial schema for travel app

  ## New Tables
  
  ### `users`
  - `id` (uuid, primary key) - User ID from auth.users
  - `email` (text) - User email
  - `display_name` (text) - Display name
  - `avatar_url` (text, nullable) - Profile picture URL
  - `selected_countries` (text[]) - Array of country codes (ISO-2)
  - `is_location_shared` (boolean) - Whether user shares location
  - `latitude` (numeric, nullable) - Current latitude
  - `longitude` (numeric, nullable) - Current longitude
  - `created_at` (timestamptz) - Account creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `posts`
  - `id` (uuid, primary key) - Post ID
  - `user_id` (uuid, foreign key) - Author ID
  - `content` (text) - Post text content
  - `image_url` (text, nullable) - Optional post image
  - `country` (text) - Country code (ISO-2)
  - `city` (text, nullable) - City name
  - `tags` (text[]) - Array of tags
  - `created_at` (timestamptz) - Post creation timestamp

  ### `events`
  - `id` (uuid, primary key) - Event ID
  - `user_id` (uuid, foreign key) - Creator ID
  - `title` (text) - Event title
  - `description` (text) - Event description
  - `image_url` (text, nullable) - Event cover image
  - `country` (text) - Country code (ISO-2)
  - `city` (text) - City name
  - `address` (text, nullable) - Full address
  - `latitude` (numeric, nullable) - Event latitude
  - `longitude` (numeric, nullable) - Event longitude
  - `event_date` (timestamptz) - When event happens
  - `tags` (text[]) - Array of tags
  - `attendees` (uuid[]) - Array of attending user IDs
  - `created_at` (timestamptz) - Event creation timestamp

  ## Security
  - Enable RLS on all tables
  - Add policies for authenticated users
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text NOT NULL,
  avatar_url text,
  selected_countries text[] DEFAULT '{}',
  is_location_shared boolean DEFAULT false,
  latitude numeric,
  longitude numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
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

-- Create posts table
CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content text NOT NULL,
  image_url text,
  country text NOT NULL,
  city text,
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view posts"
  ON posts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create own posts"
  ON posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts"
  ON posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts"
  ON posts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create events table
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  image_url text,
  country text NOT NULL,
  city text NOT NULL,
  address text,
  latitude numeric,
  longitude numeric,
  event_date timestamptz NOT NULL,
  tags text[] DEFAULT '{}',
  attendees uuid[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view events"
  ON events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own events"
  ON events FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own events"
  ON events FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS posts_country_idx ON posts(country);
CREATE INDEX IF NOT EXISTS posts_created_at_idx ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS events_country_idx ON events(country);
CREATE INDEX IF NOT EXISTS events_event_date_idx ON events(event_date);
CREATE INDEX IF NOT EXISTS events_created_at_idx ON events(created_at DESC);