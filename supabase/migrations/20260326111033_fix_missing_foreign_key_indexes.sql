/*
  # Add Missing Foreign Key Indexes

  1. Performance Improvements
    - Add indexes on all foreign key columns that are missing them
    - This improves JOIN performance and foreign key constraint checks
  
  2. Indexes Added
    - admin_actions(admin_id)
    - admin_actions(target_user_id)
    - chabad_houses(created_by)
    - conversations(participant_2_id)
    - event_join_requests(user_id)
    - messages(conversation_id)
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