/*
  # Add Private Event Join Enforcement

  1. Purpose
    - Prevent users from joining private events without approval
    - Enforce that users can only be in attendees array if:
      - They are the event creator, OR
      - The event is public (is_private = false), OR
      - They have an approved join request (status = 'approved')

  2. Implementation
    - Create a trigger function to validate attendee updates
    - Ensure private event attendees are validated
    - Prevent direct attendee array manipulation for private events

  3. Security
    - Enforce at database level, not just UI
    - Prevents API bypass attempts
*/

CREATE OR REPLACE FUNCTION validate_private_event_attendees()
RETURNS TRIGGER AS $$
DECLARE
  v_is_private boolean;
  v_user_id uuid;
  v_creator_id uuid;
  v_approved_users uuid[];
BEGIN
  -- Get event details
  SELECT is_private, user_id INTO v_is_private, v_creator_id
  FROM events WHERE id = NEW.id;

  -- If event is not private, no validation needed
  IF v_is_private IS FALSE OR v_is_private IS NULL THEN
    RETURN NEW;
  END IF;

  -- For private events, validate attendees
  -- Get all users with approved status
  SELECT ARRAY_AGG(user_id) INTO v_approved_users
  FROM event_join_requests
  WHERE event_id = NEW.id AND status = 'approved';

  -- Check each attendee
  IF NEW.attendees IS NOT NULL AND array_length(NEW.attendees, 1) > 0 THEN
    FOR v_user_id IN SELECT UNNEST(NEW.attendees)
    LOOP
      -- Allow if: creator or has approved request
      IF v_user_id != v_creator_id AND (v_approved_users IS NULL OR NOT v_user_id = ANY(v_approved_users)) THEN
        RAISE EXCEPTION 'User % cannot join private event without approval', v_user_id;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS validate_private_event_attendees_trigger ON events;

-- Create trigger
CREATE TRIGGER validate_private_event_attendees_trigger
BEFORE UPDATE ON events
FOR EACH ROW
WHEN (NEW.attendees IS DISTINCT FROM OLD.attendees)
EXECUTE FUNCTION validate_private_event_attendees();