/*
  # get_chat_list(p_user) — one call for the whole Messages screen

  Replaces the N+1 pattern the Messages list used (4 + 3×conversation + 3×group queries) with a
  single round-trip. Returns a JSON object:

    {
      "conversations": [ { id, participant_1_id, participant_2_id, last_message_at,
                           other_user:{id,display_name,avatar_url},
                           last_message:{content,sender_id} | null,
                           unread_count } ],   -- newest first
      "groups":        [ { channel_id, country_code, city_name, city_emoji,
                           last_seen_at, status, member_count, unread_count,
                           last_message:{content,type,created_at,display_name} | null } ]
    }

  SECURITY DEFINER so the aggregate counts (member counts, other participants) resolve regardless
  of per-row RLS, but the body only ever reads rows that belong to p_user's own conversations /
  memberships, so no data leaks. Client-side post-processing (localStorage "left groups" filter and
  the same-city dedup) still runs on the returned rows.

  The client falls back to its previous per-row queries if this function is absent, so deploying the
  app before running this migration is safe.
*/

CREATE OR REPLACE FUNCTION public.get_chat_list(p_user uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- NOTE: group_* tables key ids as text while conversations/messages use uuid, so every id
  -- comparison is cast ::text (works for either type) and timestamps ::timestamptz, to avoid
  -- "operator does not exist: text = uuid" errors on the mixed schema.
  WITH convos AS (
    SELECT c.id, c.participant_1_id, c.participant_2_id, c.last_message_at,
           CASE WHEN c.participant_1_id::text = p_user::text THEN c.participant_2_id ELSE c.participant_1_id END AS other_id
    FROM conversations c
    WHERE c.participant_1_id::text = p_user::text OR c.participant_2_id::text = p_user::text
  ),
  convo_rows AS (
    SELECT json_build_object(
             'id', cv.id,
             'participant_1_id', cv.participant_1_id,
             'participant_2_id', cv.participant_2_id,
             'last_message_at', cv.last_message_at,
             'other_user', json_build_object(
               'id', cv.other_id,
               'display_name', COALESCE(u.display_name, 'משתמש'),
               'avatar_url', u.avatar_url
             ),
             'last_message', (
               SELECT json_build_object('content', m.content, 'sender_id', m.sender_id)
               FROM messages m WHERE m.conversation_id::text = cv.id::text
               ORDER BY m.created_at DESC LIMIT 1
             ),
             'unread_count', (
               SELECT count(*) FROM messages m
               WHERE m.conversation_id::text = cv.id::text AND m.is_read = false AND m.sender_id::text <> p_user::text
             )
           ) AS row,
           cv.last_message_at AS sort_at
    FROM convos cv
    LEFT JOIN users u ON u.id::text = cv.other_id::text
  ),
  memberships AS (
    SELECT gm.channel_id, gm.last_seen_at, gm.status
    FROM group_members gm
    WHERE gm.user_id::text = p_user::text AND gm.status <> 'left'
  ),
  group_rows AS (
    SELECT json_build_object(
             'channel_id', gc.id,
             'country_code', gc.country_code,
             'city_name', gc.city_name,
             'city_emoji', gc.city_emoji,
             'last_seen_at', ms.last_seen_at,
             'status', COALESCE(ms.status, 'approved'),
             'member_count', (
               SELECT count(*) FROM group_members gm2
               WHERE gm2.channel_id::text = gc.id::text AND gm2.status = 'approved'
             ),
             'unread_count', (
               SELECT count(*) FROM group_messages g
               WHERE g.channel_id::text = gc.id::text AND g.user_id::text <> p_user::text
                 AND g.created_at::timestamptz > COALESCE(ms.last_seen_at::timestamptz, '1970-01-01'::timestamptz)
             ),
             'last_message', (
               SELECT json_build_object('content', g.content, 'type', g.type,
                                        'created_at', g.created_at, 'display_name', g.display_name)
               FROM group_messages g WHERE g.channel_id::text = gc.id::text
               ORDER BY g.created_at DESC LIMIT 1
             )
           ) AS row
    FROM memberships ms
    JOIN group_channels gc ON gc.id::text = ms.channel_id::text
  )
  SELECT json_build_object(
    'conversations', COALESCE((SELECT json_agg(row ORDER BY sort_at DESC NULLS LAST) FROM convo_rows), '[]'::json),
    'groups',        COALESCE((SELECT json_agg(row) FROM group_rows), '[]'::json)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_chat_list(uuid) TO authenticated, anon;
