CREATE OR REPLACE FUNCTION create_messages_table()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create messages table if it doesn't exist
  CREATE TABLE IF NOT EXISTS messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES conversations(id),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    sender_type VARCHAR(10) CHECK (sender_type IN ('user', 'bot', 'agent')),
    user_id UUID NOT NULL,
    read BOOLEAN DEFAULT false,
    business_id UUID NOT NULL REFERENCES businesses(id)
  );

  -- Create indexes for better performance
  CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
  CREATE INDEX IF NOT EXISTS idx_messages_business_id ON messages(business_id);

  -- Enable RLS
  ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

  -- Create policies
  DROP POLICY IF EXISTS "Users can view messages from their business conversations" ON messages;
  CREATE POLICY "Users can view messages from their business conversations"
    ON messages
    FOR SELECT
    USING (
      business_id IN (
        SELECT b.id 
        FROM businesses b
        JOIN business_users bu ON b.id = bu.business_id
        WHERE bu.user_id = auth.uid()
      )
    );

  DROP POLICY IF EXISTS "Users can insert messages into their business conversations" ON messages;
  CREATE POLICY "Users can insert messages into their business conversations"
    ON messages
    FOR INSERT
    WITH CHECK (
      business_id IN (
        SELECT b.id 
        FROM businesses b
        JOIN business_users bu ON b.id = bu.business_id
        WHERE bu.user_id = auth.uid()
      )
    );

  DROP POLICY IF EXISTS "Users can update messages in their business conversations" ON messages;
  CREATE POLICY "Users can update messages in their business conversations"
    ON messages
    FOR UPDATE
    USING (
      business_id IN (
        SELECT b.id 
        FROM businesses b
        JOIN business_users bu ON b.id = bu.business_id
        WHERE bu.user_id = auth.uid()
      )
    )
    WITH CHECK (
      business_id IN (
        SELECT b.id 
        FROM businesses b
        JOIN business_users bu ON b.id = bu.business_id
        WHERE bu.user_id = auth.uid()
      )
    );
END;
$$; 