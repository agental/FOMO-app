/*
  # Add has_group to events

  Lets an event creator turn on a group chat for the event. When on, every approved
  buyer is auto-added to the event's group (which reuses the city-chat tables).

  1. Changes
    - `events.has_group` (boolean, default false) — whether this event has a group chat.

  2. Notes
    - Additive and safe: existing events default to false (no group).
    - The group itself lives in the existing group_channels / group_members /
      group_messages tables, keyed by country_code = 'event:<event id>'. No new
      group tables are needed.
*/

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS has_group boolean NOT NULL DEFAULT false;
