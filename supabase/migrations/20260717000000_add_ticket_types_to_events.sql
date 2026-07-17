/*
  # Add ticket_types to events

  Lets an event creator offer several ticket types (e.g. "רגיל" ₪50, "VIP" ₪120)
  instead of a single price. Each buyer picks a type on the event page.

  1. Changes
    - `events.ticket_types` (jsonb, default '[]') — array of { id, name, price }.
      The existing `price` column is kept as the entry (lowest) price so the
      event cards and any legacy code keep working unchanged.

  2. Notes
    - Additive and backfill-safe: existing rows get an empty array, so they keep
      behaving as single-price (or free) events.
*/

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS ticket_types jsonb NOT NULL DEFAULT '[]'::jsonb;
