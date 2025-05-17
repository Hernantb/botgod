-- Drop existing policies first
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON messages;
DROP POLICY IF EXISTS "Enable read access for all users" ON messages;
DROP POLICY IF EXISTS "Enable update for users based on business_id" ON messages;

-- Drop existing indexes
DROP INDEX IF EXISTS idx_messages_conversation_id;
DROP INDEX IF EXISTS idx_messages_created_at;
DROP INDEX IF EXISTS idx_messages_business_id;

-- Drop the messages table and its dependencies
DROP TABLE IF EXISTS messages CASCADE;

-- Recreate the messages table
CREATE TABLE messages (
    id uuid primary key default uuid_generate_v4(),
    conversation_id uuid references conversations(id),
    message text not null,
    content text,
    event_type varchar(50) default 'message',
    status message_status default 'received',
    sender_type varchar(50) not null check (sender_type in ('user', 'bot', 'agent')),
    business_id uuid references businesses(id),
    phone_number varchar(50),
    created_at timestamp with time zone default now(),
    file_name text,
    file_size integer,
    file_url text,
    message_type varchar(50) default 'text' check (message_type in ('text', 'image', 'file', 'video', 'audio')),
    user_id uuid references auth.users(id),
    read boolean default false
);

-- Create indexes for messages
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_business_id ON messages(business_id);

-- Enable RLS on messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for messages
CREATE POLICY "Enable insert for authenticated users" ON messages
FOR INSERT TO authenticated
WITH CHECK (
    business_id IN (
        SELECT b.id 
        FROM businesses b
        JOIN business_users bu ON b.id = bu.business_id
        WHERE bu.user_id = auth.uid()
    )
);

CREATE POLICY "Enable read access for business users" ON messages
FOR SELECT TO authenticated
USING (
    business_id IN (
        SELECT b.id 
        FROM businesses b
        JOIN business_users bu ON b.id = bu.business_id
        WHERE bu.user_id = auth.uid()
    )
);

CREATE POLICY "Enable update for users based on business_id" ON messages
FOR UPDATE TO authenticated
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