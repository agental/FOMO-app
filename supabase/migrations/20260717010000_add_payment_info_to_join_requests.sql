/*
  # Add payment info to event_join_requests

  Supports the new "pay first → wait for organizer approval → refund on reject" flow.
  A join request is now created AFTER the buyer pays, and the organizer approves/rejects it.

  1. Changes
    - `event_join_requests.paid_amount` (numeric, nullable) — what the buyer paid (₪).
      NULL / 0 = a free event (no payment). Used to show the refund amount when a paid
      request is rejected.
    - `event_join_requests.ticket_label` (text, nullable) — the name of the ticket type
      the buyer chose (e.g. "רגיל", "VIP"), for display to the organizer and buyer.

  2. Notes
    - Payment is simulated in-app (no real gateway), so a "refund" is a status change
      (rejected) + a notification to the buyer — no money actually moves.
    - Additive and safe: existing rows get NULL for both columns.
    - The status CHECK stays pending/approved/rejected; a rejected row with paid_amount > 0
      represents a refunded ticket.
*/

ALTER TABLE event_join_requests
  ADD COLUMN IF NOT EXISTS paid_amount numeric,
  ADD COLUMN IF NOT EXISTS ticket_label text;
