-- ============================================================================
-- FOMO — per-event cover framing. `image_focus_y` is the vertical focal point the
-- organizer/admin sets by dragging the cover (0 = show the top … 100 = show the
-- bottom; 50 = center). The app applies it as CSS object-position so the cover is
-- framed the way they chose instead of a fixed center crop.
--
-- Owner/admin can update it via the existing events UPDATE policy + the
-- guard_event_noncreator_update trigger (it's a content field on their own event).
--
-- Run this whole block in the Supabase SQL Editor.
-- ============================================================================

alter table public.events
  add column if not exists image_focus_y int not null default 50;

select 'FOMO event image_focus_y ready ✓' as status;
