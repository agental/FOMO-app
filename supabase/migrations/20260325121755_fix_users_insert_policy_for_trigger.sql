/*
  # Fix users INSERT policy to allow trigger to create profiles

  1. Security Fix
    - Allow the handle_new_user() trigger function to INSERT into users table
    - The trigger runs with SECURITY DEFINER so it bypasses RLS
    - But we need to ensure RLS allows INSERT from auth context
    
  2. Changes
    - Add INSERT policy for authenticated users to create their own profile
    - This allows the trigger to work properly when new users sign up
    
  3. Security
    - Policy only allows users to insert their own profile (id = auth.uid())
    - Prevents users from creating profiles for other users
*/

-- Allow authenticated users to insert their own profile
-- This is needed for the trigger to work when auth.users INSERT happens
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' 
    AND policyname = 'Users can insert own profile'
  ) THEN
    CREATE POLICY "Users can insert own profile"
      ON users FOR INSERT
      TO authenticated
      WITH CHECK (id = (SELECT auth.uid()));
  END IF;
END $$;
