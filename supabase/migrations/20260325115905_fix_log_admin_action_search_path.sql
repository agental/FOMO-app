/*
  # Fix log_admin_action function search path

  1. Security Fix
    - Add SET search_path = public to log_admin_action function
    - Prevents search path vulnerabilities
    - Makes function immune to search_path manipulation
    
  2. Changes
    - Recreate log_admin_action with fixed search_path
    - No functional changes, only security improvement
    
  3. Security
    - Prevents potential SQL injection via search_path
    - Follows PostgreSQL security best practices
*/

-- Recreate log_admin_action function with fixed search_path
CREATE OR REPLACE FUNCTION log_admin_action(
  p_action_type text,
  p_target_type text,
  p_target_id uuid,
  p_target_user_id uuid DEFAULT NULL,
  p_details jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action_id uuid;
BEGIN
  -- Check if user is admin
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can log actions';
  END IF;

  -- Insert the action
  INSERT INTO admin_actions (
    admin_id,
    action_type,
    target_type,
    target_id,
    target_user_id,
    details
  ) VALUES (
    auth.uid(),
    p_action_type,
    p_target_type,
    p_target_id,
    p_target_user_id,
    COALESCE(p_details, '{}'::jsonb)
  ) RETURNING id INTO v_action_id;

  RETURN v_action_id;
END;
$$;
