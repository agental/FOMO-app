/*
  # Allow anonymous users to use the app

  1. Security Changes
    - Update RLS policies to allow anonymous (guest) users
    - Anonymous users can view public content (events, posts, chabad houses)
    - Anonymous users can create their own content
    - Anonymous users can only modify/delete their own content
    
  2. Changes
    - Update users table policies to allow anonymous users
    - Update posts table policies to allow anonymous viewing and creation
    - Update events table policies to allow anonymous viewing and creation
    - Update chabad_houses to allow anonymous viewing
    - Update conversations and messages to allow anonymous users
    - Update event_join_requests to allow anonymous users
    
  3. Security Notes
    - Anonymous users still use auth.uid() for ownership checks
    - Anonymous users can only access their own data
    - Public content (posts, events) is viewable by everyone including anonymous users
*/

-- Users table: Allow anonymous users to view all profiles and manage their own
DROP POLICY IF EXISTS "Anyone can view user profiles" ON users;
CREATE POLICY "Anyone can view user profiles"
  ON users FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON users;
CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  TO authenticated, anon
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated, anon
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Posts table: Allow anonymous users to view and create posts
DROP POLICY IF EXISTS "Anyone can view posts" ON posts;
CREATE POLICY "Anyone can view posts"
  ON posts FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can create posts" ON posts;
CREATE POLICY "Authenticated users can create posts"
  ON posts FOR INSERT
  TO authenticated, anon
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users and admins can update posts" ON posts;
CREATE POLICY "Users and admins can update posts"
  ON posts FOR UPDATE
  TO authenticated, anon
  USING (user_id = auth.uid() OR is_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users and admins can delete posts" ON posts;
CREATE POLICY "Users and admins can delete posts"
  ON posts FOR DELETE
  TO authenticated, anon
  USING (user_id = auth.uid() OR is_admin(auth.uid()));

-- Events table: Allow anonymous users to view and create events
DROP POLICY IF EXISTS "Anyone can view events" ON events;
CREATE POLICY "Anyone can view events"
  ON events FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can create events" ON events;
CREATE POLICY "Authenticated users can create events"
  ON events FOR INSERT
  TO authenticated, anon
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users and admins can update events" ON events;
CREATE POLICY "Users and admins can update events"
  ON events FOR UPDATE
  TO authenticated, anon
  USING (user_id = auth.uid() OR is_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users and admins can delete events" ON events;
CREATE POLICY "Users and admins can delete events"
  ON events FOR DELETE
  TO authenticated, anon
  USING (user_id = auth.uid() OR is_admin(auth.uid()));

-- Chabad houses: Allow anonymous users to view
DROP POLICY IF EXISTS "Anyone can view Chabad houses" ON chabad_houses;
CREATE POLICY "Anyone can view Chabad houses"
  ON chabad_houses FOR SELECT
  TO authenticated, anon
  USING (true);

-- Conversations: Allow anonymous users
DROP POLICY IF EXISTS "Participants can view conversations" ON conversations;
CREATE POLICY "Participants can view conversations"
  ON conversations FOR SELECT
  TO authenticated, anon
  USING (participant_1_id = auth.uid() OR participant_2_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can create conversations" ON conversations;
CREATE POLICY "Authenticated users can create conversations"
  ON conversations FOR INSERT
  TO authenticated, anon
  WITH CHECK (participant_1_id = auth.uid() OR participant_2_id = auth.uid());

DROP POLICY IF EXISTS "Participants can update conversations" ON conversations;
CREATE POLICY "Participants can update conversations"
  ON conversations FOR UPDATE
  TO authenticated, anon
  USING (participant_1_id = auth.uid() OR participant_2_id = auth.uid());

-- Messages: Allow anonymous users
DROP POLICY IF EXISTS "Participants can view messages" ON messages;
CREATE POLICY "Participants can view messages"
  ON messages FOR SELECT
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND (conversations.participant_1_id = auth.uid() OR conversations.participant_2_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Participants can send messages" ON messages;
CREATE POLICY "Participants can send messages"
  ON messages FOR INSERT
  TO authenticated, anon
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND (conversations.participant_1_id = auth.uid() OR conversations.participant_2_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Sender can update own messages" ON messages;
CREATE POLICY "Sender can update own messages"
  ON messages FOR UPDATE
  TO authenticated, anon
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- Event join requests: Allow anonymous users
DROP POLICY IF EXISTS "Users can view relevant join requests" ON event_join_requests;
CREATE POLICY "Users can view relevant join requests"
  ON event_join_requests FOR SELECT
  TO authenticated, anon
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_join_requests.event_id
      AND events.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create join requests" ON event_join_requests;
CREATE POLICY "Users can create join requests"
  ON event_join_requests FOR INSERT
  TO authenticated, anon
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own pending requests" ON event_join_requests;
CREATE POLICY "Users can delete their own pending requests"
  ON event_join_requests FOR DELETE
  TO authenticated, anon
  USING (user_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "Event creators can update requests for their events" ON event_join_requests;
CREATE POLICY "Event creators can update requests for their events"
  ON event_join_requests FOR UPDATE
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_join_requests.event_id
      AND events.user_id = auth.uid()
    )
  );
