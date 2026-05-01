/*
  # Initial Schema for Israeli Travel Social App - הטיול הגדול

  ## Tables Created:

  ### profiles
    - User profile information
    - Links to auth.users
    - Stores selected countries, interests, and location preferences

  ### countries
    - Reference table for all countries
    - Includes Hebrew names and flag emojis

  ### events
    - Travel events created by users
    - Includes location, date, capacity, and attendance tracking

  ### posts
    - Social posts from users
    - Can include images and location tags

  ### event_attendees
    - Many-to-many relationship for event participation

  ### chats
    - Direct messages and group chats
    - Can be country-based or private

  ### chat_members
    - Many-to-many relationship for chat participation

  ### messages
    - Chat messages with text and optional images

  ### post_likes
    - Like tracking for posts

  ## Security

  All tables have RLS (Row Level Security) enabled with appropriate policies
  to ensure users can only access data they're authorized to see.
*/

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  bio text,
  selected_countries jsonb DEFAULT '[]'::jsonb,
  interests text[] DEFAULT '{}'::text[],
  current_location jsonb,
  is_location_shared boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Countries table
CREATE TABLE IF NOT EXISTS countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_he text,
  code text UNIQUE NOT NULL,
  flag_emoji text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE countries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view countries"
  ON countries FOR SELECT
  TO authenticated
  USING (true);

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  location jsonb NOT NULL,
  event_date timestamptz NOT NULL,
  cover_image_url text,
  capacity integer,
  tags text[] DEFAULT '{}'::text[],
  attendees_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view events"
  ON events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update own events"
  ON events FOR UPDATE
  TO authenticated
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can delete own events"
  ON events FOR DELETE
  TO authenticated
  USING (auth.uid() = creator_id);

-- Posts table
CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  image_url text,
  location jsonb,
  tags text[] DEFAULT '{}'::text[],
  likes_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view posts"
  ON posts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create posts"
  ON posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update own posts"
  ON posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can delete own posts"
  ON posts FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id);

-- Event attendees table
CREATE TABLE IF NOT EXISTS event_attendees (
  event_id uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'going',
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view event attendees"
  ON event_attendees FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can join events"
  ON event_attendees FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own attendance"
  ON event_attendees FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave events"
  ON event_attendees FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Chats table
CREATE TABLE IF NOT EXISTS chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  name text,
  country_code text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chat members can view chats"
  ON chats FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_members
      WHERE chat_members.chat_id = chats.id
      AND chat_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create chats"
  ON chats FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Chat members table
CREATE TABLE IF NOT EXISTS chat_members (
  chat_id uuid REFERENCES chats(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at timestamptz DEFAULT now(),
  last_read_at timestamptz DEFAULT now(),
  PRIMARY KEY (chat_id, user_id)
);

ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chat members can view membership"
  ON chat_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_members cm
      WHERE cm.chat_id = chat_members.chat_id
      AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join chats"
  ON chat_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave chats"
  ON chat_members FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own membership"
  ON chat_members FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid REFERENCES chats(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content text,
  image_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chat members can view messages"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_members
      WHERE chat_members.chat_id = messages.chat_id
      AND chat_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Chat members can send messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM chat_members
      WHERE chat_members.chat_id = messages.chat_id
      AND chat_members.user_id = auth.uid()
    )
  );

-- Post likes table
CREATE TABLE IF NOT EXISTS post_likes (
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view post likes"
  ON post_likes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can like posts"
  ON post_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike posts"
  ON post_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_events_location ON events USING gin(location);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_selected_countries ON profiles USING gin(selected_countries);
