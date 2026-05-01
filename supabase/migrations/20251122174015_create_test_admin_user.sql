/*
  # Create Test Admin User

  ## Purpose
  - Create or update a test admin user for development
  - This allows testing the admin functionality

  ## Important Notes
  - This is a development/testing migration
  - In production, admin users should be created manually via secure process
  - You can change the email to match your test account
*/

-- Update or create test admin user
-- Change this email to match your test user
DO $$
DECLARE
  v_admin_email text := 'admin@test.com';
  v_user_id uuid;
BEGIN
  -- Check if user exists with this email in auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_admin_email
  LIMIT 1;

  -- If user exists in auth.users, update their role in the users table
  IF v_user_id IS NOT NULL THEN
    -- Check if user record exists in users table
    IF EXISTS (SELECT 1 FROM users WHERE id = v_user_id) THEN
      UPDATE users SET role = 'admin' WHERE id = v_user_id;
      RAISE NOTICE 'Updated user % to admin role', v_admin_email;
    ELSE
      RAISE NOTICE 'User % exists in auth but not in users table yet', v_admin_email;
    END IF;
  ELSE
    RAISE NOTICE 'No user found with email %. Please create an account with this email first.', v_admin_email;
  END IF;
END $$;