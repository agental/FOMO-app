/*
  # Auto-join buyers/organizer to the event group (server-side, RLS-safe)

  Fixes: an approved buyer was not added to the event's group chat, because the
  client added the buyer only from THEIR OWN device (group RLS lets a user add
  only themselves, and only as 'pending' for city groups), so a cross-device
  approval never joined them — and the organizer could hit the same wall.

  This moves group membership to the server:
    - `_ensure_event_group_member(event, user)` — SECURITY DEFINER helper that
      finds/creates the event's group channel and upserts the user as an approved
      member (bypasses RLS).
    - Trigger on event_join_requests → when a request becomes 'approved', the
      buyer is auto-added (works regardless of who is online).
    - `join_event_group(event)` RPC → lets the organizer or an approved attendee
      add THEMSELVES (used at event creation and when opening the group).

  Idempotent: re-running replaces the functions/trigger; membership upserts.
*/

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS has_group boolean NOT NULL DEFAULT false;

-- ── shared helper: ensure the event's channel exists and the user is an approved member ──
CREATE OR REPLACE FUNCTION _ensure_event_group_member(p_event_id uuid, p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has     boolean;
  v_title   text;
  v_emoji   text;
  v_country text;
  v_channel uuid;
  v_display text;
  v_avatar  text;
BEGIN
  SELECT has_group, title, emoji INTO v_has, v_title, v_emoji FROM events WHERE id = p_event_id;
  IF NOT COALESCE(v_has, false) THEN RETURN NULL; END IF;

  v_country := 'event:' || p_event_id::text;
  IF v_emoji IS NULL OR v_emoji = '' THEN v_emoji := '🎪'; END IF;

  SELECT id INTO v_channel FROM group_channels WHERE country_code = v_country LIMIT 1;
  IF v_channel IS NULL THEN
    INSERT INTO group_channels (country_code, city_slug, city_name, city_emoji)
    VALUES (v_country, v_emoji, COALESCE(v_title, 'אירוע'), v_emoji)
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

-- ── trigger: approved request → add the buyer automatically ──
CREATE OR REPLACE FUNCTION add_approved_buyer_to_event_group()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> 'approved' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'approved' THEN
    RETURN NEW;
  END IF;
  PERFORM _ensure_event_group_member(NEW.event_id, NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_add_approved_buyer_to_event_group ON event_join_requests;
CREATE TRIGGER trg_add_approved_buyer_to_event_group
  AFTER INSERT OR UPDATE OF status ON event_join_requests
  FOR EACH ROW
  EXECUTE FUNCTION add_approved_buyer_to_event_group();

-- ── RPC: the organizer / an approved attendee adds themselves (creation + open group) ──
CREATE OR REPLACE FUNCTION join_event_group(p_event_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_creator uuid;
  v_allowed boolean;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;

  SELECT user_id INTO v_creator FROM events WHERE id = p_event_id;

  v_allowed := (v_uid = v_creator)
    OR EXISTS (SELECT 1 FROM events WHERE id = p_event_id AND v_uid = ANY(attendees))
    OR EXISTS (SELECT 1 FROM event_join_requests
               WHERE event_id = p_event_id AND user_id = v_uid AND status = 'approved');

  IF NOT v_allowed THEN RETURN NULL; END IF;

  RETURN _ensure_event_group_member(p_event_id, v_uid);
END;
$$;

GRANT EXECUTE ON FUNCTION join_event_group(uuid) TO anon, authenticated;
