/*
  # Admin bans — block a user from entering the app (temporary or permanent)

  Adds two columns to users:
    - banned_until  timestamptz  — NULL = not banned; a future timestamp = banned until then;
                                   a far-future date (e.g. 2999) = permanent.
    - banned_reason text         — shown to the user on the ban screen.

  An admin sets these from the dashboard (the users UPDATE policy already lets admins update any
  row; banned_* aren't the `role` column so the role-guard trigger doesn't block them). The app
  reads its OWN banned_until on login and shows a ban screen instead of the app.

  Because users has column-level SELECT grants (from the email/location PII fix), the new columns
  must be granted too, otherwise the client can't read them.

  Run once in the Supabase SQL Editor.
*/

alter table public.users add column if not exists banned_until  timestamptz;
alter table public.users add column if not exists banned_reason text;

grant select (banned_until, banned_reason) on public.users to authenticated;

select 'FOMO user bans ready ✓' as result;
