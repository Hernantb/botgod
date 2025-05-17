-- Drop existing policies
DROP POLICY IF EXISTS "Users can view messages from their business" ON messages;
DROP POLICY IF EXISTS "Users can insert messages to their business" ON messages;

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create more permissive policies for testing
CREATE POLICY "Users can view messages"
    ON messages FOR SELECT
    USING (true);

CREATE POLICY "Users can insert messages"
    ON messages FOR INSERT
    WITH CHECK (true);

-- Grant necessary permissions
GRANT ALL ON messages TO authenticated;
GRANT ALL ON messages TO anon;

-- Verify existing messages
SELECT COUNT(*) as message_count FROM messages; 