/*
  # Allow users to update their own join requests

  1. Changes
    - Add policy allowing users to update their own join requests from 'rejected' to 'pending'
    - This enables users to resubmit requests after rejection

  2. Security
    - Users can only update their own requests (auth.uid() = user_id)
    - Users can only change status from 'rejected' to 'pending'
    - Event creators still control approval/rejection through existing policy
*/

CREATE POLICY "Users can update their own rejected requests"
  ON event_join_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'rejected')
  WITH CHECK (auth.uid() = user_id AND status = 'pending');
