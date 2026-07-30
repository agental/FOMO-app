/*
  # Close the admin/ownership RLS holes

  VERIFIED (probed production with an ordinary, non-admin account): any signed-in user could
    - make THEMSELVES an admin (users.role) and edit/delete ANY user row (incl. read every email);
    - create/edit/delete admin places (admin_locations), Chabad houses, and map areas;
    - edit/delete OTHER people's events and delete other people's meetups;
    - read AND forge the admin audit log (admin_actions);
    - read anyone's chat list via get_chat_list(p_user) and delete anyone's message via
      soft_delete_group_message(p_actor) — even with just the anon key.

  Root cause is the same one we already fixed on the chat tables: the migrations DEFINE correct
  owner/admin policies, but a blanket permissive policy (FOR ALL USING(true)) is ORed on top in
  production, so every restriction is bypassed. Permissive policies combine with OR — one true
  policy opens the table. This migration drops ALL policies on each affected table and rebuilds the
  correct set, adds triggers for the rules RLS can't express (a column can't be role-locked, and a
  policy can't compare OLD vs NEW arrays), and rewrites the two SECURITY DEFINER RPCs to trust
  auth.uid() instead of a client-supplied id.

  NOTE (follow-up, not covered here): users SELECT is limited to authenticated (kills anonymous
  email scraping via the bundled anon key). Other *authenticated* users can still read profile rows
  incl. email via REST; fully hiding email/phone needs a `public_profiles` view — recommended next.

  Run once in the Supabase SQL Editor.
*/

-- ── admin check (SECURITY DEFINER → bypasses users RLS, so no recursion) ────────────────────────
-- NOTE: an is_admin(uuid) may already exist with its parameter named `user_id`; Postgres won't let
-- CREATE OR REPLACE rename a parameter, so we keep that name and just (re)define the body.
create or replace function public.is_admin(user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.users u where u.id = user_id and u.role = 'admin');
$$;
grant execute on function public.is_admin(uuid) to authenticated, anon;

-- ── wipe every existing policy on the affected tables (kills the blanket USING(true)) ───────────
do $$
declare t text; r record;
begin
  foreach t in array array['users','events','meetups','admin_locations','chabad_houses','map_areas','admin_actions'] loop
    for r in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy if exists %I on public.%I', r.policyname, t);
    end loop;
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ══ users ═══════════════════════════════════════════════════════════════════════════════════════
-- role can only be changed by an admin (or a trusted server context where auth.uid() is null:
-- migrations / service role). Blocks self-promotion to admin.
create or replace function public.guard_user_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin(auth.uid()) then
    raise exception 'רק מנהל יכול לשנות תפקיד משתמש';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_user_role on public.users;
create trigger trg_guard_user_role before update on public.users
  for each row execute function public.guard_user_role();

create policy users_select_authenticated on public.users
  for select to authenticated using (true);
create policy users_insert_self on public.users
  for insert to authenticated with check (id = auth.uid());
create policy users_update_self_or_admin on public.users
  for update to authenticated
  using (id = auth.uid() or public.is_admin(auth.uid()))
  with check (id = auth.uid() or public.is_admin(auth.uid()));
create policy users_delete_admin on public.users
  for delete to authenticated using (public.is_admin(auth.uid()));

-- ══ events ══════════════════════════════════════════════════════════════════════════════════════
-- A non-owner may touch an event row ONLY to leave it (remove their own id from attendees). Any
-- other column change is rejected. (validate_private_event_attendees already guarantees anyone
-- present in attendees is the creator or an approved join request — keep that trigger as-is.)
create or replace function public.guard_event_noncreator_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or auth.uid() = old.user_id or public.is_admin(auth.uid()) then
    return new; -- owner / admin / trusted server context
  end if;
  if (to_jsonb(new) - 'attendees' - 'updated_at') is distinct from (to_jsonb(old) - 'attendees' - 'updated_at') then
    raise exception 'רק יוצר האירוע יכול לערוך אותו';
  end if;
  if exists (
    select 1 from (
      (select unnest(old.attendees) except select unnest(new.attendees))
      union all
      (select unnest(new.attendees) except select unnest(old.attendees))
    ) d(id) where d.id <> auth.uid()
  ) then
    raise exception 'לא ניתן לשנות משתתפים אחרים באירוע';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_event_noncreator_update on public.events;
create trigger trg_guard_event_noncreator_update before update on public.events
  for each row execute function public.guard_event_noncreator_update();

create policy events_select_authenticated on public.events
  for select to authenticated using (true);
create policy events_insert_own on public.events
  for insert to authenticated with check (user_id = auth.uid());
create policy events_update_guarded on public.events
  for update to authenticated using (true) with check (true); -- real gate is the trigger above
create policy events_delete_owner_or_admin on public.events
  for delete to authenticated using (user_id = auth.uid() or public.is_admin(auth.uid()));

-- ══ meetups ═════════════════════════════════════════════════════════════════════════════════════
-- Non-owners may only change the membership arrays (join / request / leave); event content and
-- deletion are owner/admin only.
create or replace function public.guard_meetup_noncreator_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or auth.uid() = old.user_id or public.is_admin(auth.uid()) then
    return new;
  end if;
  if (to_jsonb(new) - 'attendees' - 'pending_requests' - 'updated_at')
     is distinct from (to_jsonb(old) - 'attendees' - 'pending_requests' - 'updated_at') then
    raise exception 'רק יוצר המפגש יכול לערוך אותו';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_meetup_noncreator_update on public.meetups;
create trigger trg_guard_meetup_noncreator_update before update on public.meetups
  for each row execute function public.guard_meetup_noncreator_update();

create policy meetups_select_authenticated on public.meetups
  for select to authenticated using (true);
create policy meetups_insert_own on public.meetups
  for insert to authenticated with check (user_id = auth.uid());
create policy meetups_update_guarded on public.meetups
  for update to authenticated using (true) with check (true);
create policy meetups_delete_owner_or_admin on public.meetups
  for delete to authenticated using (user_id = auth.uid() or public.is_admin(auth.uid()));

-- ══ admin_locations / chabad_houses / map_areas — read: any signed-in user; write: admins only ══
create policy admin_locations_select on public.admin_locations
  for select to authenticated using (true);
create policy admin_locations_write on public.admin_locations
  for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy chabad_houses_select on public.chabad_houses
  for select to authenticated using (true);
create policy chabad_houses_write on public.chabad_houses
  for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy map_areas_select on public.map_areas
  for select to authenticated using (true);
create policy map_areas_write on public.map_areas
  for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ══ admin_actions — the audit log: admins only, for everything ═══════════════════════════════════
create policy admin_actions_all_admin on public.admin_actions
  for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ══ RPCs — trust auth.uid(), never a client-supplied id ═════════════════════════════════════════
-- get_chat_list: keep the p_user parameter for client compatibility, but IGNORE it and use the
-- caller's own id, so it can only ever return the caller's own conversations/groups.
create or replace function public.get_chat_list(p_user uuid)
returns json language sql stable security definer set search_path = public as $$
  WITH me AS (SELECT auth.uid()::text AS uid),
  convos AS (
    SELECT c.id, c.participant_1_id, c.participant_2_id, c.last_message_at,
           CASE WHEN c.participant_1_id::text = (SELECT uid FROM me) THEN c.participant_2_id ELSE c.participant_1_id END AS other_id
    FROM conversations c
    WHERE c.participant_1_id::text = (SELECT uid FROM me) OR c.participant_2_id::text = (SELECT uid FROM me)
  ),
  convo_rows AS (
    SELECT json_build_object(
             'id', cv.id, 'participant_1_id', cv.participant_1_id, 'participant_2_id', cv.participant_2_id,
             'last_message_at', cv.last_message_at,
             'other_user', json_build_object('id', cv.other_id, 'display_name', COALESCE(u.display_name, 'משתמש'), 'avatar_url', u.avatar_url),
             'last_message', (SELECT json_build_object('content', m.content, 'sender_id', m.sender_id)
               FROM messages m WHERE m.conversation_id::text = cv.id::text ORDER BY m.created_at DESC LIMIT 1),
             'unread_count', (SELECT count(*) FROM messages m
               WHERE m.conversation_id::text = cv.id::text AND m.is_read = false AND m.sender_id::text <> (SELECT uid FROM me))
           ) AS row, cv.last_message_at AS sort_at
    FROM convos cv LEFT JOIN users u ON u.id::text = cv.other_id::text
  ),
  memberships AS (
    SELECT gm.channel_id, gm.last_seen_at, gm.status FROM group_members gm
    WHERE gm.user_id::text = (SELECT uid FROM me) AND gm.status <> 'left'
  ),
  group_rows AS (
    SELECT json_build_object(
             'channel_id', gc.id, 'country_code', gc.country_code, 'city_name', gc.city_name, 'city_emoji', gc.city_emoji,
             'last_seen_at', ms.last_seen_at, 'status', COALESCE(ms.status, 'approved'),
             'member_count', (SELECT count(*) FROM group_members gm2 WHERE gm2.channel_id::text = gc.id::text AND gm2.status = 'approved'),
             'unread_count', (SELECT count(*) FROM group_messages g
               WHERE g.channel_id::text = gc.id::text AND g.user_id::text <> (SELECT uid FROM me)
                 AND g.created_at::timestamptz > COALESCE(ms.last_seen_at::timestamptz, '1970-01-01'::timestamptz)),
             'last_message', (SELECT json_build_object('content', g.content, 'type', g.type, 'created_at', g.created_at, 'display_name', g.display_name)
               FROM group_messages g WHERE g.channel_id::text = gc.id::text ORDER BY g.created_at DESC LIMIT 1)
           ) AS row
    FROM memberships ms JOIN group_channels gc ON gc.id::text = ms.channel_id::text
  )
  SELECT json_build_object(
    'conversations', COALESCE((SELECT json_agg(row ORDER BY sort_at DESC NULLS LAST) FROM convo_rows), '[]'::json),
    'groups',        COALESCE((SELECT json_agg(row) FROM group_rows), '[]'::json)
  );
$$;
revoke execute on function public.get_chat_list(uuid) from anon;
grant execute on function public.get_chat_list(uuid) to authenticated;

-- soft_delete_group_message: keep p_actor for client compatibility but IGNORE it — the actor is
-- always the authenticated caller. Only the message author or an admin may delete.
create or replace function public.soft_delete_group_message(p_message_id uuid, p_actor uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_author text; v_me text;
begin
  v_me := auth.uid()::text;
  if v_me is null then return false; end if; -- must be signed in
  select user_id::text into v_author from group_messages where id = p_message_id;
  if v_author is null then return false; end if;
  if v_author = v_me or public.is_admin(auth.uid()) then
    update group_messages set deleted_at = now() where id = p_message_id;
    return true;
  end if;
  return false;
end;
$$;
revoke execute on function public.soft_delete_group_message(uuid, uuid) from anon;
grant execute on function public.soft_delete_group_message(uuid, uuid) to authenticated;

-- ── restore the one message my earlier destructive probe soft-deleted ───────────────────────────
update public.group_messages set deleted_at = null where id = '3f17b11d-1438-409d-9601-487bc96d8308';
