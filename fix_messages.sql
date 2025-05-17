-- Drop existing table if it exists
DROP TABLE IF EXISTS messages CASCADE;

-- Create the messages table with the correct structure
CREATE TABLE messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    conversation_id UUID REFERENCES conversations(id),
    content TEXT NOT NULL,
    sender_type TEXT CHECK (sender_type IN ('user', 'bot', 'agent')),
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create necessary indexes
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Enable insert for anonymous users" ON messages
    FOR INSERT TO anon
    WITH CHECK (true);

CREATE POLICY "Enable select for anonymous users" ON messages
    FOR SELECT TO anon
    USING (true);

CREATE POLICY "Enable update for anonymous users" ON messages
    FOR UPDATE TO anon
    USING (true)
    WITH CHECK (true);

-- Create trigger for updating conversation last_message
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations
    SET 
        message = NEW.message,
        last_message_time = NEW.created_at
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_message_insert
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_last_message(); 