/*
  # Create Admin Helper Functions

  ## New Functions

  ### `is_admin(user_id uuid)`
  - Checks if a user has admin role
  - Returns boolean
  - Used in RLS policies
  - Security definer for consistent checks

  ### `log_admin_action(...)`
  - Logs administrative actions to audit trail
  - Validates that caller is admin
  - Returns the action ID
  - Used by frontend when admins perform actions
*/

-- Create helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = user_id AND role = 'admin'
  );
$$;

-- Create a function to log admin actions
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