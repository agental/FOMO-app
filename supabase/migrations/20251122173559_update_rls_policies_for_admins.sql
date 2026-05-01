/*
  # Update RLS Policies for Admin Access

  ## Changes
  - Add policies allowing admins to update any post
  - Add policies allowing admins to delete any post
  - Add policies allowing admins to update any event
  - Add policies allowing admins to delete any event

  ## Security
  - Uses is_admin() helper function for checks
  - Admins can manage all content regardless of ownership
  - Regular users' existing policies remain unchanged
  - All admin actions should be logged via frontend
*/

-- Posts: Allow admins to update any post
CREATE POLICY "Admins can update any post"
  ON posts FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Posts: Allow admins to delete any post
CREATE POLICY "Admins can delete any post"
  ON posts FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));

-- Events: Allow admins to update any event
CREATE POLICY "Admins can update any event"
  ON events FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Events: Allow admins to delete any event
CREATE POLICY "Admins can delete any event"
  ON events FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));