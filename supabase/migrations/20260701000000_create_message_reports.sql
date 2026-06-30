/*
  # Message reports (group chat moderation)

  Lets any user report a group-chat message. Reports are visible to admins only,
  who can review/dismiss them. A snapshot of the message is stored so the report
  stays meaningful even if the original message is later deleted.
*/

CREATE TABLE IF NOT EXISTS message_reports (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id        uuid,
  channel_id        uuid,
  reporter_id       uuid REFERENCES users(id) ON DELETE SET NULL,
  reported_user_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  message_content   text,
  message_type      text,
  reason            text,
  status            text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'dismissed')),
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE message_reports ENABLE ROW LEVEL SECURITY;

-- Any signed-in user can file a report (as themselves)
CREATE POLICY "Users can create message reports"
  ON message_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

-- Only admins can read reports
CREATE POLICY "Admins can view message reports"
  ON message_reports FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'));

-- Only admins can resolve/update reports
CREATE POLICY "Admins can update message reports"
  ON message_reports FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'));

CREATE INDEX IF NOT EXISTS message_reports_status_idx ON message_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS message_reports_reported_user_idx ON message_reports(reported_user_id);
