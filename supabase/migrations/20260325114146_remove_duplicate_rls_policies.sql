/*
  # Remove Duplicate RLS Policies

  1. Security Improvements
    - Remove duplicate permissive policies that cause confusion and potential security issues
    - Keep only the most specific and secure policies

  2. Changes
    - Remove old/duplicate policies
    - Keep the optimized policies created in previous migrations
*/

-- Remove duplicate policies on conversations
DROP POLICY IF EXISTS "Anyone can view conversations" ON conversations;

-- Remove duplicate policies on messages
DROP POLICY IF EXISTS "Anyone can view messages" ON messages;

-- Remove duplicate policies on posts
DROP POLICY IF EXISTS "Users can read all posts" ON posts;

-- Remove duplicate policies on events
DROP POLICY IF EXISTS "Users can read all events" ON events;

-- Remove duplicate policies on users
DROP POLICY IF EXISTS "Anyone can view profiles" ON users;
