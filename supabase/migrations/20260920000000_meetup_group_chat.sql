/*
  # Meetup ("ציוץ") chat = reuse the city/event group system

  Today a meetup chat is its own thing (`meetup_messages` + `attendees[]`/`pending_requests[]` arrays on
  `meetups`) and never shows in the Messages list. City/event chats use group_channels/group_members/
  group_messages and DO show in the list. This makes a meetup reuse that exact system (channel keyed
  `meetup:<id>`), so the meetup chat looks like a group chat AND appears in Messages once you join/are
  approved — mirroring `_ensure_event_group_member` / the auto-join-on-approve trigger.

  Idempotent. Run in the Supabase SQL editor.
*/

-- ── helper: ensure the meetup's channel exists and the user is an APPROVED member (bypasses RLS) ──
CREATE OR REPLACE FUNCTION _ensure_meetup_group_member(p_meetup_id uuid, p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_text text; v_emoji text; v_country text; v_channel uuid; v_display text; v_avatar text;
BEGIN
  IF p_user_id IS NULL THEN RETURN NULL; END IF;
  PERFORM set_config('fomo.member_write', 'ok', true); -- authorize the approved-member upsert (guard_group_member_write)
  SELECT text, emoji INTO v_text, v_emoji FROM meetups WHERE id = p_meetup_id;
  v_country := 'meetup:' || p_meetup_id::text;
  IF v_emoji IS NULL OR v_emoji = '' THEN v_emoji := '☕'; END IF;

  SELECT id INTO v_channel FROM group_channels WHERE country_code = v_country LIMIT 1;
  IF v_channel IS NULL THEN
    INSERT INTO group_channels (country_code, city_slug, city_name, city_emoji)
    VALUES (v_country, v_emoji, COALESCE(NULLIF(v_text, ''), 'ציוץ'), v_emoji)
    ON CONFLICT (country_code, city_slug) DO NOTHING;
    SELECT id INTO v_channel FROM group_channels WHERE country_code = v_country LIMIT 1;
  END IF;
  IF v_channel IS NULL THEN RETURN NULL; END IF;

  SELECT display_name, avatar_url INTO v_display, v_avatar FROM users WHERE id = p_user_id;

  INSERT INTO group_members (channel_id, user_id, display_name, avatar_url, last_seen_at, status)
  VALUES (v_channel, p_user_id, COALESCE(v_display, 'משתמש'), v_avatar, now(), 'approved')
  ON CONFLICT (channel_id, user_id) DO UPDATE SET status = 'approved';

  RETURN v_channel;
END;
$$;

-- ── trigger: on meetup create / attendees change → organizer + every attendee become approved members ──
CREATE OR REPLACE FUNCTION sync_meetup_group_members()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid;
BEGIN
  PERFORM _ensure_meetup_group_member(NEW.id, NEW.user_id);           -- organizer
  IF NEW.attendees IS NOT NULL THEN
    FOREACH v_uid IN ARRAY NEW.attendees LOOP
      PERFORM _ensure_meetup_group_member(NEW.id, v_uid);             -- open-join OR approved attendee
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_meetup_group_members ON meetups;
CREATE TRIGGER trg_sync_meetup_group_members
  AFTER INSERT OR UPDATE OF attendees ON meetups
  FOR EACH ROW EXECUTE FUNCTION sync_meetup_group_members();

-- ── RPC: let the organizer / an attendee add THEMSELVES (called when opening the chat) ──
CREATE OR REPLACE FUNCTION join_meetup_group(p_meetup_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_ok boolean;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  SELECT (user_id = v_uid OR v_uid = ANY(COALESCE(attendees, '{}'::uuid[])))
    INTO v_ok FROM meetups WHERE id = p_meetup_id;
  IF NOT COALESCE(v_ok, false) THEN RETURN NULL; END IF;
  RETURN _ensure_meetup_group_member(p_meetup_id, v_uid);
END;
$$;
GRANT EXECUTE ON FUNCTION join_meetup_group(uuid) TO authenticated;

-- ── backfill: existing meetups → channels + approved members (so current chats appear immediately) ──
DO $$
DECLARE r record; v_uid uuid;
BEGIN
  FOR r IN SELECT id, user_id, attendees FROM meetups LOOP
    PERFORM _ensure_meetup_group_member(r.id, r.user_id);
    IF r.attendees IS NOT NULL THEN
      FOREACH v_uid IN ARRAY r.attendees LOOP
        PERFORM _ensure_meetup_group_member(r.id, v_uid);
      END LOOP;
    END IF;
  END LOOP;
END $$;

SELECT 'FOMO meetup group chat ready ✓' AS status;
