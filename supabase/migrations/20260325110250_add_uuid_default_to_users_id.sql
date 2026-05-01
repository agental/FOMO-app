/*
  # Add UUID default value to users.id column

  1. Changes
    - Add gen_random_uuid() as default value for id column in users table
    - This allows automatic ID generation when creating new users

  2. Security
    - No security changes, just adding a default value
*/

-- Add default UUID generation to id column
ALTER TABLE users 
ALTER COLUMN id SET DEFAULT gen_random_uuid();
