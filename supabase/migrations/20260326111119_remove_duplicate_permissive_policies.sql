/*
  # Remove Duplicate Permissive Policies

  1. Security & Performance
    - Remove duplicate SELECT policies that cause confusion and potential security issues
    - Keep the more descriptive policy names
  
  2. Policies Removed
    - "Anyone can view events" (keeping "Everyone can view events")
    - "Anyone can view posts" (keeping "Everyone can view posts")
    - "Anyone can view user profiles" (keeping "Authenticated users can view profiles")
*/

-- Remove duplicate events SELECT policy
DROP POLICY IF EXISTS "Anyone can view events" ON events;

-- Remove duplicate posts SELECT policy
DROP POLICY IF EXISTS "Anyone can view posts" ON posts;

-- Remove duplicate users SELECT policy
DROP POLICY IF EXISTS "Anyone can view user profiles" ON users;