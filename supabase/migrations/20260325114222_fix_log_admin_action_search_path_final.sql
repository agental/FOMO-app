/*
  # Fix log_admin_action Function Search Path (Final Fix)

  1. Security Improvements
    - Properly set search_path to prevent manipulation attacks
    - Use fully qualified function names

  2. Changes
    - Recreate function with proper search_path configuration
    - Use public schema prefix for is_admin function call
*/

-- Drop and recreate the function with proper search path
DROP FUNCTION IF EXISTS log_admin_action(text, text, uuid, jsonb);

CREATE OR REPLACE FUNCTION public.log_admin_action(
  action_type text,
  target_type text,
  target_id uuid,
  details jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  IF NOT public.is_admin(current_user_id) THEN
    RAISE EXCEPTION 'Only admins can log actions';
  END IF;

  INSERT INTO public.admin_actions (admin_id, action_type, target_type, target_id, details)
  VALUES (current_user_id, action_type, target_type, target_id, details);
END;
$$;
