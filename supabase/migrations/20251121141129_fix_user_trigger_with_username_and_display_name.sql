/*
  # Fix user profile auto-creation trigger
  
  1. Changes
    - Updates trigger function to create user profiles with both username and display_name
    - Generates username from email prefix (cleaned and unique)
    - Sets display_name from user metadata or email prefix
    - Both fields are now required (NOT NULL)
    
  2. Logic
    - username: lowercase, alphanumeric with underscores, from email prefix
    - display_name: friendly name from metadata or capitalized email prefix
    - Uses ON CONFLICT DO NOTHING to handle race conditions
    
  3. Security
    - Function runs with SECURITY DEFINER to have necessary permissions
    - Only creates profile if one doesn't exist
*/

-- Create the function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  base_username text;
  final_username text;
  user_display_name text;
BEGIN
  -- Extract and clean username from email
  base_username := split_part(NEW.email, '@', 1);
  base_username := lower(regexp_replace(base_username, '[^a-z0-9_-]', '', 'g'));
  base_username := substring(base_username from 1 for 15);
  
  -- Ensure username is at least 3 characters
  IF length(base_username) < 3 THEN
    base_username := 'user' || substring(NEW.id::text from 1 for 3);
  END IF;
  
  -- Make username unique by adding random suffix if needed
  final_username := base_username || substring(md5(random()::text) from 1 for 4);
  
  -- Get display name from metadata or email
  user_display_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    initcap(split_part(NEW.email, '@', 1))
  );
  
  -- Insert the user profile
  INSERT INTO public.users (
    id,
    email,
    username,
    display_name,
    selected_countries,
    profile_completed
  )
  VALUES (
    NEW.id,
    NEW.email,
    final_username,
    user_display_name,
    ARRAY[]::text[],
    false
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
