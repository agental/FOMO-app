/*
  # Create Messaging System

  1. New Tables
    - `conversations`
      - `id` (uuid, primary key) - Unique conversation identifier
      - `participant_1_id` (uuid, foreign key to users) - First participant
      - `participant_2_id` (uuid, foreign key to users) - Second participant
      - `last_message_at` (timestamptz) - Timestamp of last message for sorting
      - `created_at` (timestamptz) - Conversation creation time
      - `updated_at` (timestamptz) - Last update time
      - Unique constraint on participant pair (ordered) to prevent duplicates
    
    - `messages`
      - `id` (uuid, primary key) - Unique message identifier
      - `conversation_id` (uuid, foreign key to conversations) - Parent conversation
      - `sender_id` (uuid, foreign key to users) - Message sender
      - `content` (text) - Message text content
      - `is_read` (boolean) - Read status
      - `created_at` (timestamptz) - Message timestamp
      - Index on conversation_id and created_at for fast queries

  2. Security
    - Enable RLS on both tables
    - Users can only view conversations they participate in
    - Users can only view messages in their conversations
    - Users can send messages in their conversations
    - Users can update read status of messages sent to them

  3. Indexes
    - Composite index on conversations for finding by participant pair
    - Index on messages for fetching by conversation and time
*/

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  participant_2_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT different_participants CHECK (participant_1_id != participant_2_id),
  CONSTRAINT ordered_participants CHECK (participant_1_id < participant_2_id)
);

-- Create unique index to prevent duplicate conversations
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_participants 
  ON conversations(participant_1_id, participant_2_id);

-- Create index for finding conversations by participant
CREATE INDEX IF NOT EXISTS idx_conversations_participant_1 
  ON conversations(participant_1_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_participant_2 
  ON conversations(participant_2_id, last_message_at DESC);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for messages
CREATE INDEX IF NOT EXISTS idx_messages_conversation_time 
  ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread 
  ON messages(conversation_id, is_read) WHERE is_read = false;

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversations
CREATE POLICY "Users can view their own conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (
    auth.uid() = participant_1_id OR 
    auth.uid() = participant_2_id
  );

CREATE POLICY "Users can create conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = participant_1_id OR 
    auth.uid() = participant_2_id
  );

CREATE POLICY "Users can update their conversations"
  ON conversations FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = participant_1_id OR 
    auth.uid() = participant_2_id
  );

-- RLS Policies for messages
CREATE POLICY "Users can view messages in their conversations"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND (
        conversations.participant_1_id = auth.uid() OR 
        conversations.participant_2_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can send messages in their conversations"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_id
      AND (
        conversations.participant_1_id = auth.uid() OR 
        conversations.participant_2_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update read status of their messages"
  ON messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND (
        conversations.participant_1_id = auth.uid() OR 
        conversations.participant_2_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND (
        conversations.participant_1_id = auth.uid() OR 
        conversations.participant_2_id = auth.uid()
      )
    )
  );

-- Function to update conversation's last_message_at
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET 
    last_message_at = NEW.created_at,
    updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update conversation timestamp
DROP TRIGGER IF EXISTS trigger_update_conversation_timestamp ON messages;
CREATE TRIGGER trigger_update_conversation_timestamp
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_timestamp();