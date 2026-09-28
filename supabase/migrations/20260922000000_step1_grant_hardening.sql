-- ============================================================================
-- FOMO — Phase 1 / Step 1: FUNCTION GRANT HARDENING (grants only)
--
-- Revoke direct client (PUBLIC / anon / authenticated) EXECUTE from internal
-- helper functions and trigger-only functions. `service_role` is INTENTIONALLY
-- left untouched (trusted server key; no client reach).
--
-- This migration changes NOTHING except EXECUTE grants:
--   • no function bodies      • no RLS policies      • no indexes
--   • no triggers             • no secrets           • no get_chat_list
--
-- Safe because:
--   • The two _ensure_* helpers are called only by SECURITY DEFINER RPCs
--     (join_event_group / join_meetup_group) and by triggers — all of which run
--     as the function/table OWNER (postgres), so the inner call is permitted
--     regardless of the caller's EXECUTE grant.
--   • The guard_* / sync_* / add_* / validate_* / update_conversation_timestamp /
--     fomo_notify_push functions are TRIGGER functions: Postgres fires a trigger
--     function as the table owner and does NOT check the invoking role's EXECUTE
--     privilege, so revoking client EXECUTE cannot stop the triggers.
--   • None of these functions are called directly via supabase.rpc() from the
--     frontend (verified by grep across src/).
--
-- Run this whole block in the Supabase SQL Editor.
-- ============================================================================

-- ── Internal helpers (must NOT be directly client-callable) ─────────────────
revoke execute on function public._ensure_event_group_member(uuid, uuid)  from public, anon, authenticated;
revoke execute on function public._ensure_meetup_group_member(uuid, uuid) from public, anon, authenticated;

-- ── Trigger-only functions (invoked by triggers as owner; no client EXECUTE needed) ──
revoke execute on function public.guard_group_member_write()          from public, anon, authenticated;
revoke execute on function public.guard_event_noncreator_update()     from public, anon, authenticated;
revoke execute on function public.guard_meetup_noncreator_update()    from public, anon, authenticated;
revoke execute on function public.sync_meetup_group_members()         from public, anon, authenticated;
revoke execute on function public.add_approved_buyer_to_event_group() from public, anon, authenticated;
revoke execute on function public.validate_private_event_attendees()  from public, anon, authenticated;
revoke execute on function public.update_conversation_timestamp()     from public, anon, authenticated;
revoke execute on function public.fomo_notify_push()                  from public, anon, authenticated;

select 'FOMO step1 grant hardening ✓' as status;
