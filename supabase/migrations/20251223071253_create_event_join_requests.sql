/*
  # Create event join requests table

  1. New Tables
    - `event_join_requests`
      - `id` (uuid, primary key)
      - `event_id` (uuid, foreign key to events)
      - `user_id` (uuid, foreign key to users) - the user requesting to join
      - `status` (text) - pending, approved, rejected
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Purpose
    - Allow users to request to join events
    - Event creators can approve or reject requests
    - Prevents automatic joining - requires approval

  3. Security
    - Enable RLS on event_join_requests table
    - Users can create their own requests
    - Users can view their own requests
    - Event creators can view and update requests for their events
*/

CREATE TABLE IF NOT EXISTS event_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(event_id, user_id)
);

ALTER TABLE event_join_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own requests"
  ON event_join_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Event creators can view requests for their events"
  ON event_join_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_join_requests.event_id
      AND events.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create join requests"
  ON event_join_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Event creators can update requests for their events"
  ON event_join_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_join_requests.event_id
      AND events.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_join_requests.event_id
      AND events.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own pending requests"
  ON event_join_requests FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'pending');

CREATE INDEX IF NOT EXISTS event_join_requests_event_id_idx ON event_join_requests(event_id);
CREATE INDEX IF NOT EXISTS event_join_requests_user_id_idx ON event_join_requests(user_id);
CREATE INDEX IF NOT EXISTS event_join_requests_status_idx ON event_join_requests(status);
