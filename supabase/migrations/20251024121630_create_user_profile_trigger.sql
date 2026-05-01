/*
  # Auto-create user profile on signup
  
  1. Changes
    - Create a trigger function that automatically creates a user profile when a new auth user signs up
    - This ensures every authenticated user has a corresponding profile in the users table
    
  2. Security
    - Trigger runs with security definer privileges
    - Only creates profile if one doesn't already exist
    - Uses auth user's ID and metadata
*/

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, selected_countries)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    ARRAY[]::text[]
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger on auth.users table
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
