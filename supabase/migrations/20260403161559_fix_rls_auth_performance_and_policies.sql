/*
  # Fix RLS Auth Performance and Duplicate Policies

  1. admin_locations policies
    - Drop and recreate all 4 policies using (select auth.uid()) for performance
    - The SELECT policy uses (select auth.uid()) IS NOT NULL instead of auth.uid() IS NOT NULL

  2. events UPDATE policies
    - Drop the older "Event creators can update their own events" policy
    - Keep "Users and admins can update events" which already uses (select auth.uid())
    - This eliminates the duplicate permissive UPDATE policy warning

  3. Notes
    - Wrapping auth.uid() in (select auth.uid()) prevents per-row re-evaluation
    - This is the Supabase recommended pattern for RLS performance
*/

-- Fix admin_locations RLS policies
DROP POLICY IF EXISTS "Authenticated users can view admin locations" ON public.admin_locations;
DROP POLICY IF EXISTS "Admins can insert admin locations" ON public.admin_locations;
DROP POLICY IF EXISTS "Admins can update admin locations" ON public.admin_locations;
DROP POLICY IF EXISTS "Admins can delete admin locations" ON public.admin_locations;

CREATE POLICY "Authenticated users can view admin locations"
  ON public.admin_locations FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Admins can insert admin locations"
  ON public.admin_locations FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (select auth.uid()) AND users.role = 'admin'
  ));

CREATE POLICY "Admins can update admin locations"
  ON public.admin_locations FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (select auth.uid()) AND users.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (select auth.uid()) AND users.role = 'admin'
  ));

CREATE POLICY "Admins can delete admin locations"
  ON public.admin_locations FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (select auth.uid()) AND users.role = 'admin'
  ));

-- Fix duplicate UPDATE policies on events
-- Drop the older policy that uses bare auth.uid()
DROP POLICY IF EXISTS "Event creators can update their own events" ON public.events;
