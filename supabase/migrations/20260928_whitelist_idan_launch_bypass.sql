-- Whitelist a specific user to bypass the pre-launch gate (they can enter the app before launch).
-- Mechanism: get_launch_state() → shouldShowLaunch() skips the launch screen when
-- users.launch_bypass = true (see 20260921000000_launch_mode.sql lines 30, 147, 168).
--
-- Run this in the Supabase SQL Editor (no service-role key locally → manual apply).
-- Idempotent: safe to re-run.

update public.users
set launch_bypass = true
where lower(email) = 'idan1825@gmail.com';

-- Verify (should return the row with launch_bypass = true):
-- select id, email, launch_bypass from public.users where lower(email) = 'idan1825@gmail.com';
