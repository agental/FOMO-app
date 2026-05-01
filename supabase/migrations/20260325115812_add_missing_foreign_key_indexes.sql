/*
  # Add missing indexes for foreign keys

  1. Performance Improvements
    - Add indexes for all unindexed foreign key columns
    - Improves query performance for joins and lookups
    
  2. New Indexes
    - admin_actions: admin_id, target_user_id
    - chabad_houses: created_by
    - conversations: participant_2_id
    - event_join_requests: user_id
    - messages: conversation_id
    
  3. Security
    - No RLS changes - only performance improvements
*/

-- Add index for admin_actions.admin_id
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin_id 
  ON admin_actions(admin_id);

-- Add index for admin_actions.target_user_id
CREATE INDEX IF NOT EXISTS idx_admin_actions_target_user_id 
  ON admin_actions(target_user_id);

-- Add index for chabad_houses.created_by
CREATE INDEX IF NOT EXISTS idx_chabad_houses_created_by 
  ON chabad_houses(created_by);

-- Add index for conversations.participant_2_id
CREATE INDEX IF NOT EXISTS idx_conversations_participant_2_id 
  ON conversations(participant_2_id);

-- Add index for event_join_requests.user_id
CREATE INDEX IF NOT EXISTS idx_event_join_requests_user_id 
  ON event_join_requests(user_id);

-- Add index for messages.conversation_id
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id 
  ON messages(conversation_id);
