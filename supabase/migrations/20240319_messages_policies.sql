-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for business users" ON messages
FOR SELECT
USING (
  conversation_id IN (
    SELECT c.id 
    FROM conversations c
    JOIN business_users bu ON c.business_id = bu.business_id
    WHERE bu.user_id = auth.uid()
  )
);

CREATE POLICY "Enable insert for business users" ON messages
FOR INSERT
WITH CHECK (
  conversation_id IN (
    SELECT c.id 
    FROM conversations c
    JOIN business_users bu ON c.business_id = bu.business_id
    WHERE bu.user_id = auth.uid()
  )
);

CREATE POLICY "Enable update for business users" ON messages
FOR UPDATE
USING (
  conversation_id IN (
    SELECT c.id 
    FROM conversations c
    JOIN business_users bu ON c.business_id = bu.business_id
    WHERE bu.user_id = auth.uid()
  )
)
WITH CHECK (
  conversation_id IN (
    SELECT c.id 
    FROM conversations c
    JOIN business_users bu ON c.business_id = bu.business_id
    WHERE bu.user_id = auth.uid()
  )
); 