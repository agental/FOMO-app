/*
  # Fix Mutable Search Path on Functions

  Functions without a fixed search_path are vulnerable to search_path injection attacks.
  Adding SET search_path = '' forces fully-qualified object references and eliminates the risk.

  Functions fixed:
    - public.update_admin_locations_updated_at
    - public.validate_private_event_attendees
*/

CREATE OR REPLACE FUNCTION public.update_admin_locations_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_private_event_attendees()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_private boolean;
  v_user_id uuid;
  v_creator_id uuid;
  v_approved_users uuid[];
BEGIN
  SELECT is_private, user_id INTO v_is_private, v_creator_id
  FROM public.events WHERE id = NEW.id;

  IF v_is_private IS FALSE OR v_is_private IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT ARRAY_AGG(user_id) INTO v_approved_users
  FROM public.event_join_requests
  WHERE event_id = NEW.id AND status = 'approved';

  IF NEW.attendees IS NOT NULL AND array_length(NEW.attendees, 1) > 0 THEN
    FOR v_user_id IN SELECT UNNEST(NEW.attendees)
    LOOP
      IF v_user_id != v_creator_id AND (v_approved_users IS NULL OR NOT v_user_id = ANY(v_approved_users)) THEN
        RAISE EXCEPTION 'User % cannot join private event without approval', v_user_id;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;
