/*
  # Allow admins to update any user (e.g. promote/demote role)

  A plain `EXISTS (SELECT 1 FROM users ...)` check inside the users table's own
  UPDATE policy would recurse. We use a SECURITY DEFINER helper that bypasses RLS
  when checking the caller's role, then grant admins UPDATE on any user row.
*/

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin');
$$;

DROP POLICY IF EXISTS "Admins can update any user" ON public.users;
CREATE POLICY "Admins can update any user"
  ON public.users FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
