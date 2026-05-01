/*
  # Add max_attendees column to events table

  1. Changes
    - Add `max_attendees` column to events table
    - Default value of 20 for existing events
    - Column is required (NOT NULL) with default

  2. Purpose
    - Allow event creators to set maximum capacity
    - Display capacity information on event cards
*/

ALTER TABLE events ADD COLUMN IF NOT EXISTS max_attendees integer NOT NULL DEFAULT 20;
