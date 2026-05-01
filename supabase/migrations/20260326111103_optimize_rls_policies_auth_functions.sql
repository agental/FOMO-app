/*
  # Optimize RLS Policies for Better Performance

  1. Performance Improvements
    - Replace auth.uid() with (select auth.uid()) in all RLS policies
    - This prevents re-evaluation of auth functions for each row
    - Significantly improves query performance at scale
  
  2. Tables Updated
    - users
    - posts
    - events
    - admin_actions
    - conversations
    - messages
    - chabad_houses
    - event_join_requests
*/

-- Drop and recreate users policies with optimized auth calls
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (id = (select auth.uid()));

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

-- Optimize posts policies
DROP POLICY IF EXISTS "Authenticated users can create posts" ON posts;
DROP POLICY IF EXISTS "Users and admins can delete posts" ON posts;
DROP POLICY IF EXISTS "Users and admins can update posts" ON posts;

CREATE POLICY "Authenticated users can create posts"
  ON posts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users and admins can delete posts"
  ON posts FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()) OR is_admin((select auth.uid())));

CREATE POLICY "Users and admins can update posts"
  ON posts FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()) OR is_admin((select auth.uid())))
  WITH CHECK (user_id = (select auth.uid()) OR is_admin((select auth.uid())));

-- Optimize events policies
DROP POLICY IF EXISTS "Authenticated users can create events" ON events;
DROP POLICY IF EXISTS "Users and admins can delete events" ON events;
DROP POLICY IF EXISTS "Users and admins can update events" ON events;

CREATE POLICY "Authenticated users can create events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users and admins can delete events"
  ON events FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()) OR is_admin((select auth.uid())));

CREATE POLICY "Users and admins can update events"
  ON events FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()) OR is_admin((select auth.uid())))
  WITH CHECK (user_id = (select auth.uid()) OR is_admin((select auth.uid())));

-- Optimize admin_actions policies
DROP POLICY IF EXISTS "Only admins can insert admin actions" ON admin_actions;
DROP POLICY IF EXISTS "Only admins can view admin actions" ON admin_actions;

CREATE POLICY "Only admins can insert admin actions"
  ON admin_actions FOR INSERT
  TO authenticated
  WITH CHECK (is_admin((select auth.uid())));

CREATE POLICY "Only admins can view admin actions"
  ON admin_actions FOR SELECT
  TO authenticated
  USING (is_admin((select auth.uid())));

-- Optimize conversations policies
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Participants can update conversations" ON conversations;
DROP POLICY IF EXISTS "Participants can view conversations" ON conversations;

CREATE POLICY "Authenticated users can create conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (participant_1_id = (select auth.uid()) OR participant_2_id = (select auth.uid()));

CREATE POLICY "Participants can update conversations"
  ON conversations FOR UPDATE
  TO authenticated
  USING (participant_1_id = (select auth.uid()) OR participant_2_id = (select auth.uid()))
  WITH CHECK (participant_1_id = (select auth.uid()) OR participant_2_id = (select auth.uid()));

CREATE POLICY "Participants can view conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (participant_1_id = (select auth.uid()) OR participant_2_id = (select auth.uid()));

-- Optimize messages policies
DROP POLICY IF EXISTS "Participants can send messages" ON messages;
DROP POLICY IF EXISTS "Participants can view messages" ON messages;
DROP POLICY IF EXISTS "Sender can update own messages" ON messages;

CREATE POLICY "Participants can send messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = (select auth.uid()) AND
    EXISTS (
      SELECT 1 FROM conversations
      WHERE id = conversation_id
      AND (participant_1_id = (select auth.uid()) OR participant_2_id = (select auth.uid()))
    )
  );

CREATE POLICY "Participants can view messages"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE id = conversation_id
      AND (participant_1_id = (select auth.uid()) OR participant_2_id = (select auth.uid()))
    )
  );

CREATE POLICY "Sender can update own messages"
  ON messages FOR UPDATE
  TO authenticated
  USING (sender_id = (select auth.uid()))
  WITH CHECK (sender_id = (select auth.uid()));

-- Optimize chabad_houses policies
DROP POLICY IF EXISTS "Admins can delete Chabad houses" ON chabad_houses;
DROP POLICY IF EXISTS "Admins can insert Chabad houses" ON chabad_houses;
DROP POLICY IF EXISTS "Admins can update Chabad houses" ON chabad_houses;

CREATE POLICY "Admins can delete Chabad houses"
  ON chabad_houses FOR DELETE
  TO authenticated
  USING (is_admin((select auth.uid())));

CREATE POLICY "Admins can insert Chabad houses"
  ON chabad_houses FOR INSERT
  TO authenticated
  WITH CHECK (is_admin((select auth.uid())));

CREATE POLICY "Admins can update Chabad houses"
  ON chabad_houses FOR UPDATE
  TO authenticated
  USING (is_admin((select auth.uid())))
  WITH CHECK (is_admin((select auth.uid())));

-- Optimize event_join_requests policies
DROP POLICY IF EXISTS "Event creators can update requests for their events" ON event_join_requests;
DROP POLICY IF EXISTS "Users can create join requests" ON event_join_requests;
DROP POLICY IF EXISTS "Users can delete their own pending requests" ON event_join_requests;
DROP POLICY IF EXISTS "Users can view relevant join requests" ON event_join_requests;

CREATE POLICY "Event creators can update requests for their events"
  ON event_join_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_join_requests.event_id
      AND events.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_join_requests.event_id
      AND events.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can create join requests"
  ON event_join_requests FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete their own pending requests"
  ON event_join_requests FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()) AND status = 'pending');

CREATE POLICY "Users can view relevant join requests"
  ON event_join_requests FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_join_requests.event_id
      AND events.user_id = (select auth.uid())
    )
  );