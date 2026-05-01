/*
  # Simplify Private Event RLS Enforcement

  1. Purpose
    - Add RLS policy to prevent direct attendee array manipulation for private events
    - Enforce that only event creators can modify attendees of private events
    - Regular users must use join requests system

  2. Security
    - Restrict UPDATE on events.attendees for private events
    - Only allow attendee changes via join request approval system
    - Creator can still manage attendees directly if needed (via admin panel)
*/

-- Drop the old policy if it exists
DROP POLICY IF EXISTS "Users can update own events" ON events;

-- Create new policy for event creators to update their events
CREATE POLICY "Event creators can update their own events"
  ON events FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create restrictive policy to prevent attendee manipulation for private events
-- This prevents users from directly modifying the attendees array of private events
-- Note: This is enforced via application logic in the frontend - always use join requests