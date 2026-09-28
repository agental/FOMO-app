-- ============================================================================
-- FOMO — fill the PUSH gaps (2026-09-28)
--
-- Adds real push (via the existing public.fomo_notify_push() → send-push) for:
--   1. Event join REQUEST      → the event organizer
--   2. Event request DECISION   → the requester (approved / rejected)
--   3. Meetup request DECISION  → the requester (approved / rejected)  [send-push change only]
--   4. New user REPORT          → all app admins
--   5. Admin BAN set/changed    → the banned user
--
-- The recipient/message logic all lives in the send-push Edge Function (which
-- must be redeployed alongside this migration). Here we only wire the triggers.
-- NOTE: run this in the Supabase SQL Editor, then redeploy the send-push function.
-- ============================================================================

-- 1 + 2 — event join requests (INSERT = new request, UPDATE = approve/reject).
drop trigger if exists fomo_push_event_request on public.event_join_requests;
create trigger fomo_push_event_request
  after insert or update on public.event_join_requests
  for each row execute function public.fomo_notify_push();

-- 3 — meetups: NO trigger change needed. The existing trigger
--     `trg_notify_meetup_request` already fires AFTER UPDATE OF pending_requests
--     WHEN pending_requests changed, which covers new request, approval AND
--     rejection (the app's approve/reject both mutate pending_requests in a
--     single UPDATE). The updated send-push code now handles approved/rejected;
--     recreating the trigger broader would only add wasted no-op invocations.

-- 4 — a new report → notify admins.
drop trigger if exists fomo_push_report on public.message_reports;
create trigger fomo_push_report
  after insert on public.message_reports
  for each row execute function public.fomo_notify_push();

-- 5 — an admin ban (banned_until) set/changed → notify the banned user.
drop trigger if exists fomo_push_ban on public.users;
create trigger fomo_push_ban
  after update of banned_until on public.users
  for each row when (new.banned_until is distinct from old.banned_until)
  execute function public.fomo_notify_push();
