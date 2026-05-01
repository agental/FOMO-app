/*
  # Create Admin Actions Audit Log Table

  ## New Table: `admin_actions`
  - Audit log for all administrative actions
  - Tracks which admin performed what action
  - Stores details about the action and target
  - Helps maintain transparency and accountability

  ## Fields
  - `id` (uuid, primary key) - Unique action ID
  - `admin_id` (uuid, foreign key) - Admin who performed the action
  - `action_type` (text) - Type of action (e.g., 'delete_post', 'delete_event', 'ban_user')
  - `target_type` (text) - Type of target (e.g., 'post', 'event', 'user')
  - `target_id` (uuid) - ID of the target object
  - `target_user_id` (uuid, nullable) - User ID affected by the action
  - `details` (jsonb, nullable) - Additional details about the action
  - `created_at` (timestamptz) - When the action was performed

  ## Security
  - RLS enabled
  - Only admins can view and insert records
  - Automatic indexes for performance
*/

-- Create admin_actions table
CREATE TABLE IF NOT EXISTS admin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  target_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;

-- Only admins can view admin actions
CREATE POLICY "Only admins can view admin actions"
  ON admin_actions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Only admins can insert admin actions
CREATE POLICY "Only admins can insert admin actions"
  ON admin_actions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
    AND auth.uid() = admin_id
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS admin_actions_admin_id_idx ON admin_actions(admin_id);
CREATE INDEX IF NOT EXISTS admin_actions_created_at_idx ON admin_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS admin_actions_target_idx ON admin_actions(target_type, target_id);
CREATE INDEX IF NOT EXISTS admin_actions_target_user_idx ON admin_actions(target_user_id) WHERE target_user_id IS NOT NULL;