/*
  # מחיקת שדה username ממסד הנתונים

  1. שינויים בטבלת `users`
    - מחיקת עמודת username
    - מחיקת אינדקס ייחודי users_username_unique_idx
    - שמירה על display_name בלבד לתצוגה

  2. עדכון Trigger Function
    - עדכון handle_new_user() להסרת יצירת username
    - שמירה רק על display_name

  3. הערות חשובות
    - display_name ישמש כשם התצוגה היחיד
    - אין צורך ב-username עוד
    - המערכת תסתמך רק על id ו-display_name
*/

-- Drop the unique index on username first
DROP INDEX IF EXISTS users_username_unique_idx;

-- Drop the username column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'username'
  ) THEN
    ALTER TABLE users DROP COLUMN username;
  END IF;
END $$;

-- Update the trigger function to not create username
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_display_name text;
BEGIN
  -- Get display name from metadata or email
  user_display_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    initcap(split_part(NEW.email, '@', 1))
  );
  
  -- Insert the user profile without username
  INSERT INTO public.users (
    id,
    email,
    display_name,
    selected_countries,
    profile_completed
  )
  VALUES (
    NEW.id,
    NEW.email,
    user_display_name,
    ARRAY[]::text[],
    false
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$;