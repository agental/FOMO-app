/*
  # Fix RLS policies to use SELECT subqueries for auth functions

  1. Performance Improvements
    - Replace auth.<function>() with (SELECT auth.<function>())
    - Prevents re-evaluation of auth functions for each row
    - Significantly improves query performance at scale
    
  2. Updated Policies
    - posts: delete and update policies
    - events: delete and update policies
    - event_join_requests: view policy
    
  3. Security
    - No security changes - same logic, better performance
*/

-- Drop and recreate posts policies with SELECT subqueries
DROP POLICY IF EXISTS "Users and admins can delete posts" ON posts;
CREATE POLICY "Users and admins can delete posts"
  ON posts FOR DELETE
  TO authenticated
  USING (
    (user_id = (SELECT auth.uid())) OR 
    (SELECT is_admin((SELECT auth.uid())))
  );

DROP POLICY IF EXISTS "Users and admins can update posts" ON posts;
CREATE POLICY "Users and admins can update posts"
  ON posts FOR UPDATE
  TO authenticated
  USING (
    (user_id = (SELECT auth.uid())) OR 
    (SELECT is_admin((SELECT auth.uid())))
  )
  WITH CHECK (
    (user_id = (SELECT auth.uid())) OR 
    (SELECT is_admin((SELECT auth.uid())))
  );

-- Drop and recreate events policies with SELECT subqueries
DROP POLICY IF EXISTS "Users and admins can delete events" ON events;
CREATE POLICY "Users and admins can delete events"
  ON events FOR DELETE
  TO authenticated
  USING (
    (user_id = (SELECT auth.uid())) OR 
    (SELECT is_admin((SELECT auth.uid())))
  );

DROP POLICY IF EXISTS "Users and admins can update events" ON events;
CREATE POLICY "Users and admins can update events"
  ON events FOR UPDATE
  TO authenticated
  USING (
    (user_id = (SELECT auth.uid())) OR 
    (SELECT is_admin((SELECT auth.uid())))
  )
  WITH CHECK (
    (user_id = (SELECT auth.uid())) OR 
    (SELECT is_admin((SELECT auth.uid())))
  );

-- Drop and recreate event_join_requests policy with SELECT subquery
DROP POLICY IF EXISTS "Users can view relevant join requests" ON event_join_requests;
CREATE POLICY "Users can view relevant join requests"
  ON event_join_requests FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid()) OR
    EXISTS (
      SELECT 1 FROM events 
      WHERE events.id = event_join_requests.event_id 
      AND events.user_id = (SELECT auth.uid())
    )
  );
