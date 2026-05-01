/*
  # תיקון policy ל-INSERT בטבלת users

  1. שינויים
    - הוספת policy שמאפשרת לטריגר ליצור משתמשים חדשים
    - הטריגר רץ עם SECURITY DEFINER אז הוא צריך גישה מלאה
    - המשתמשים לא יכולים ליצור ישירות - רק דרך הטריגר

  2. אבטחה
    - רק משתמשים מאומתים יכולים לקרוא פרופילים
    - רק המשתמש עצמו יכול לעדכן את הפרופיל שלו
    - ה-INSERT מתבצע דרך הטריגר בלבד
*/

-- אין צורך ב-policy ל-INSERT כי הטריגר רץ עם SECURITY DEFINER
-- נוודא שה-policies הקיימות נכונות

-- מחיקת policies ישנות אם קיימות
DROP POLICY IF EXISTS "Users can insert own profile" ON users;

-- וידוא שה-policies הנכונות קיימות
DO $$
BEGIN
  -- Policy לקריאה - כל המשתמשים המאומתים יכולים לראות פרופילים
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' 
    AND policyname = 'Authenticated users can view profiles'
  ) THEN
    CREATE POLICY "Authenticated users can view profiles"
      ON users FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  -- Policy לעדכון - רק המשתמש עצמו יכול לעדכן את הפרופיל שלו
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' 
    AND policyname = 'Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile"
      ON users FOR UPDATE
      TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;
