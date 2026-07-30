/*
  # Hide user email (PII) from the API

  After the earlier fix, anon can no longer read the users table, but any SIGNED-IN user could
  still pull every other user's email via REST (`/users?select=email`). Email is the one clearly
  sensitive column with no legitimate cross-user use in the app — every normal profile read already
  requests only display_name / avatar_url / etc.

  Fix: column-level REVOKE so no API role (anon or authenticated) can select `email` at all. Admins,
  who legitimately need it for the dashboard, read it through admin_list_users() — a SECURITY DEFINER
  function that returns the roster (incl. email) only when the caller is an admin.

  The app writes email on signup via upsert (INSERT privilege, unaffected) and reads its OWN email
  from the auth session, not this table — so nothing user-facing breaks. The client reads that used
  `select('*')`/`users(*)` were switched to explicit safe columns in the same change.

  NOTE (still open, separate feature-logic fix): users.latitude/longitude are readable by any
  signed-in user regardless of is_location_shared. Enforcing the share flag needs a view/RPC and is
  left as a follow-up.

  Run once in the Supabase SQL Editor.
*/

-- A column-level REVOKE does NOT override a table-level GRANT, and Supabase grants `authenticated`
-- SELECT on the whole table. So drop the table-wide SELECT and grant back every column EXCEPT email.
revoke select on public.users from authenticated;
grant select (
  id, display_name, avatar_url, selected_countries, is_location_shared, latitude, longitude,
  created_at, updated_at, bio, age, current_country, languages, interests, visited_countries,
  full_name, countries, home_base, instagram, telegram, whatsapp, visibility, profile_completed,
  role, gender
) on public.users to authenticated;

create or replace function public.admin_list_users()
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(u order by u.created_at desc), '[]'::json)
  from public.users u
  where public.is_admin(auth.uid());
$$;
revoke execute on function public.admin_list_users() from anon;
grant execute on function public.admin_list_users() to authenticated;

select 'FOMO email PII locked ✓' as result;
