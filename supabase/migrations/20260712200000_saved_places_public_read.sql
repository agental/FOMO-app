/*
  # saved_places: let everyone see WHO saved a place

  The place sheet now shows "N שמרו את המקום" plus the list of the people who did (like the
  "Top visitors" list in the reference design). The original SELECT policy only let you read your
  OWN rows, so that list would always come back with just you.

  Reading is now open to any signed-in user; WRITING is unchanged — you can still only add or
  remove your own save.
*/

drop policy if exists "saved_places_select_own" on public.saved_places;

create policy "saved_places_select_all" on public.saved_places
  for select to authenticated
  using (auth.uid() is not null);
