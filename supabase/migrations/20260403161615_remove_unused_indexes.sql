/*
  # Remove Unused Indexes

  Dropping indexes that have never been used by the query planner.
  Unused indexes waste storage and slow down writes without benefiting reads.

  Removed indexes:
    - idx_admin_locations_coordinates (admin_locations)
    - idx_admin_locations_country (admin_locations)
    - idx_admin_locations_created_by (admin_locations)
    - idx_chabad_houses_created_by (chabad_houses)
    - idx_admin_actions_admin_id (admin_actions)
    - idx_admin_actions_target_user_id (admin_actions)
    - idx_conversations_participant_2_id (conversations)
    - posts_location_idx (posts)
    - posts_google_place_id_idx (posts)
*/

DROP INDEX IF EXISTS public.idx_admin_locations_coordinates;
DROP INDEX IF EXISTS public.idx_admin_locations_country;
DROP INDEX IF EXISTS public.idx_admin_locations_created_by;
DROP INDEX IF EXISTS public.idx_chabad_houses_created_by;
DROP INDEX IF EXISTS public.idx_admin_actions_admin_id;
DROP INDEX IF EXISTS public.idx_admin_actions_target_user_id;
DROP INDEX IF EXISTS public.idx_conversations_participant_2_id;
DROP INDEX IF EXISTS public.posts_location_idx;
DROP INDEX IF EXISTS public.posts_google_place_id_idx;
