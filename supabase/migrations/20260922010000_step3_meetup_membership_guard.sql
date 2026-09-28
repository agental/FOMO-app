-- ============================================================================
-- FOMO — Phase 1 / Step 3: MEETUP MEMBERSHIP GUARD (trigger body hardening)
--
-- Problem: guard_meetup_noncreator_update() currently lets a NON-owner set
-- `attendees` / `pending_requests` to ANY value — so a regular user can add or
-- remove OTHER users, or self-approve on an approval meetup (move themselves from
-- pending_requests into attendees).
--
-- Fix (trigger body only — no frontend change, no RLS change, no new grants):
--   A non-owner may only add/remove THEMSELVES from the two arrays. Every other
--   user's entries must stay byte-identical (array_remove-of-self equality, which
--   also blocks reordering/duplicating other users). A non-owner may never add
--   themselves to `attendees` on an approval meetup (blocks self-approval and the
--   direct-join bypass), and may never route themselves through pending on an
--   open meetup.
--
-- Owner / admin / internal(no-auth) paths are UNCHANGED (still unrestricted).
-- Columns are text[] (verified live); comparisons use auth.uid()::text.
-- privacy values in prod are only 'open' | 'approval' (verified live).
--
-- NOTE: to test the non-owner paths in SQL you MUST simulate an authenticated
-- caller, else auth.uid() is NULL and the guard early-returns:
--   set local role authenticated;
--   select set_config('request.jwt.claims', json_build_object('sub','<uuid>')::text, true);
-- ============================================================================

create or replace function public.guard_meetup_noncreator_update()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid text;

  v_old_attendees text[];
  v_new_attendees text[];

  v_old_pending text[];
  v_new_pending text[];

  v_old_in_attendees boolean;
  v_new_in_attendees boolean;

  v_old_in_pending boolean;
  v_new_in_pending boolean;
begin
  -- Preserve existing privileged behavior (owner / admin / internal no-auth).
  if auth.uid() is null
     or auth.uid() = old.user_id
     or public.is_admin(auth.uid())
  then
    return new;
  end if;

  v_uid := auth.uid()::text;

  -- A non-creator cannot edit normal meetup fields.
  if (
    to_jsonb(new)
      - 'attendees'
      - 'pending_requests'
      - 'updated_at'
  )
  is distinct from
  (
    to_jsonb(old)
      - 'attendees'
      - 'pending_requests'
      - 'updated_at'
  )
  then
    raise exception 'רק יוצר המפגש יכול לערוך אותו';
  end if;

  v_old_attendees := coalesce(old.attendees, '{}'::text[]);
  v_new_attendees := coalesce(new.attendees, '{}'::text[]);

  v_old_pending := coalesce(old.pending_requests, '{}'::text[]);
  v_new_pending := coalesce(new.pending_requests, '{}'::text[]);

  /*
   * After removing the caller from both OLD and NEW arrays, every OTHER entry
   * must remain exactly unchanged. Stronger than a set EXCEPT: it also prevents
   * changing/reordering/duplicating another user's entries.
   */
  if array_remove(v_new_attendees, v_uid)
     is distinct from
     array_remove(v_old_attendees, v_uid)
  then
    raise exception 'לא ניתן לשנות משתתפים אחרים במפגש';
  end if;

  if array_remove(v_new_pending, v_uid)
     is distinct from
     array_remove(v_old_pending, v_uid)
  then
    raise exception 'לא ניתן לשנות בקשות הצטרפות של משתמשים אחרים';
  end if;

  -- Prevent duplicate self entries.
  if (
    select count(*)
    from unnest(v_new_attendees) as x(uid)
    where x.uid = v_uid
  ) > 1 then
    raise exception 'משתמש לא יכול להופיע יותר מפעם אחת ברשימת המשתתפים';
  end if;

  if (
    select count(*)
    from unnest(v_new_pending) as x(uid)
    where x.uid = v_uid
  ) > 1 then
    raise exception 'משתמש לא יכול להופיע יותר מפעם אחת ברשימת הבקשות';
  end if;

  v_old_in_attendees := v_uid = any(v_old_attendees);
  v_new_in_attendees := v_uid = any(v_new_attendees);

  v_old_in_pending := v_uid = any(v_old_pending);
  v_new_in_pending := v_uid = any(v_new_pending);

  /*
   * Approval meetup: a normal user must not approve themselves by adding
   * themselves directly to attendees (covers pending->attendees AND direct add).
   */
  if new.privacy = 'approval'
     and not v_old_in_attendees
     and v_new_in_attendees
  then
    raise exception 'המפגש דורש אישור להצטרפות';
  end if;

  /*
   * Open meetup: joining is direct through attendees, not pending_requests.
   */
  if new.privacy = 'open'
     and not v_old_in_pending
     and v_new_in_pending
  then
    raise exception 'מפגש פתוח אינו דורש בקשת הצטרפות';
  end if;

  return new;
end;
$function$;

select 'FOMO step3 meetup membership guard ✓' as status;
