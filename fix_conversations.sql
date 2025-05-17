-- Drop existing table if it exists
DROP TABLE IF EXISTS conversations CASCADE;

-- Create the conversations table with the correct structure
CREATE TABLE conversations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    business_id UUID REFERENCES businesses(id),
    last_message TEXT,
    last_message_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_bot_active BOOLEAN DEFAULT true,
    sender_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create necessary indexes
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_business_id ON conversations(business_id);
CREATE INDEX idx_conversations_last_message_time ON conversations(last_message_time);

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Enable insert for anonymous users" ON conversations
    FOR INSERT TO anon
    WITH CHECK (true);

CREATE POLICY "Enable select for anonymous users" ON conversations
    FOR SELECT TO anon
    USING (true);

CREATE POLICY "Enable update for anonymous users" ON conversations
    FOR UPDATE TO anon
    USING (true)
    WITH CHECK (true); 