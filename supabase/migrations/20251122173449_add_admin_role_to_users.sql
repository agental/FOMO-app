/*
  # Add Admin Role to Users Table

  ## Changes
  - Add `role` field to users table with default value 'user'
  - Valid values: 'user' or 'admin'
  - Create index for faster role-based queries
*/

-- Add role column if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS role text DEFAULT 'user' NOT NULL;

-- Add check constraint
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin'));

-- Create index for role
CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);