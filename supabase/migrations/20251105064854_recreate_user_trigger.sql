/*
  # Recreate user profile auto-creation trigger
  
  1. Changes
    - Creates a trigger function that automatically creates a user profile when signing up
    - Trigger runs after insert on auth.users table
    - Automatically populates display_name from user metadata
    
  2. Security
    - Function runs with SECURITY DEFINER to have necessary permissions
    - Only creates profile if one doesn't exist (ON CONFLICT DO NOTHING)
*/

-- Create the function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, selected_countries, profile_completed)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    ARRAY[]::text[],
    false
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
