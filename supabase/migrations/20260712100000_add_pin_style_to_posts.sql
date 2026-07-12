/*
  # posts: let the author style their recommendation's map pin

  Until now a recommendation's pin emoji + colour were DERIVED from its category (`tags[0]`).
  The create form now shows a live pin preview and lets the author pick their own emoji and a
  colour from the app palette, so we need somewhere to keep that choice.

  Both are nullable: when they're null the pin falls back to the category-derived look, so every
  existing recommendation keeps rendering exactly as it does today.
*/

alter table public.posts add column if not exists pin_emoji text;
alter table public.posts add column if not exists pin_color text;
