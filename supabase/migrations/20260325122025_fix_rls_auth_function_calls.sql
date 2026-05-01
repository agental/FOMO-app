/*
  # Fix RLS policies to use auth.uid() correctly

  1. Security Improvements
    - Replace inline SELECT auth.uid() subqueries with direct auth.uid() calls
    - This is more efficient and follows PostgreSQL best practices
    - Improves policy evaluation performance
    
  2. Changes
    - Update all RLS policies to use auth.uid() directly instead of (SELECT auth.uid() AS uid)
    - This applies to users, posts, events, conversations, messages, and other tables
    
  3. Note
    - Both syntaxes work, but direct function calls are preferred
    - No functional change, only performance optimization
*/

-- Users table policies
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Posts table policies
DROP POLICY IF EXISTS "Authenticated users can create posts" ON posts;
CREATE POLICY "Authenticated users can create posts"
  ON posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users and admins can update posts" ON posts;
CREATE POLICY "Users and admins can update posts"
  ON posts FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR is_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users and admins can delete posts" ON posts;
CREATE POLICY "Users and admins can delete posts"
  ON posts FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR is_admin(auth.uid()));

-- Events table policies
DROP POLICY IF EXISTS "Authenticated users can create events" ON events;
CREATE POLICY "Authenticated users can create events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users and admins can update events" ON events;
CREATE POLICY "Users and admins can update events"
  ON events FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR is_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users and admins can delete events" ON events;
CREATE POLICY "Users and admins can delete events"
  ON events FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR is_admin(auth.uid()));

-- Conversations table policies
DROP POLICY IF EXISTS "Participants can view conversations" ON conversations;
CREATE POLICY "Participants can view conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (participant_1_id = auth.uid() OR participant_2_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can create conversations" ON conversations;
CREATE POLICY "Authenticated users can create conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (participant_1_id = auth.uid() OR participant_2_id = auth.uid());

DROP POLICY IF EXISTS "Participants can update conversations" ON conversations;
CREATE POLICY "Participants can update conversations"
  ON conversations FOR UPDATE
  TO authenticated
  USING (participant_1_id = auth.uid() OR participant_2_id = auth.uid());

-- Messages table policies
DROP POLICY IF EXISTS "Participants can view messages" ON messages;
CREATE POLICY "Participants can view messages"
  ON messages FOR SELECT
  TO authenticated
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
  TO authenticated
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
  TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- Event join requests policies
DROP POLICY IF EXISTS "Users can view relevant join requests" ON event_join_requests;
CREATE POLICY "Users can view relevant join requests"
  ON event_join_requests FOR SELECT
  TO authenticated
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
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own pending requests" ON event_join_requests;
CREATE POLICY "Users can delete their own pending requests"
  ON event_join_requests FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "Event creators can update requests for their events" ON event_join_requests;
CREATE POLICY "Event creators can update requests for their events"
  ON event_join_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_join_requests.event_id
      AND events.user_id = auth.uid()
    )
  );

-- Admin actions policies
DROP POLICY IF EXISTS "Only admins can view admin actions" ON admin_actions;
CREATE POLICY "Only admins can view admin actions"
  ON admin_actions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Only admins can insert admin actions" ON admin_actions;
CREATE POLICY "Only admins can insert admin actions"
  ON admin_actions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Chabad houses policies
DROP POLICY IF EXISTS "Admins can insert Chabad houses" ON chabad_houses;
CREATE POLICY "Admins can insert Chabad houses"
  ON chabad_houses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update Chabad houses" ON chabad_houses;
CREATE POLICY "Admins can update Chabad houses"
  ON chabad_houses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete Chabad houses" ON chabad_houses;
CREATE POLICY "Admins can delete Chabad houses"
  ON chabad_houses FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );
