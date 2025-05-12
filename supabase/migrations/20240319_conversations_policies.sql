-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable read access for business users" ON conversations;
DROP POLICY IF EXISTS "Enable insert for business users" ON conversations;
DROP POLICY IF EXISTS "Enable update for business users" ON conversations;

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for business users" ON conversations
FOR SELECT
USING (
  business_id IN (
    SELECT business_id 
    FROM business_users 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Enable insert for business users" ON conversations
FOR INSERT
WITH CHECK (
  business_id IN (
    SELECT business_id 
    FROM business_users 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Enable update for business users" ON conversations
FOR UPDATE
USING (
  business_id IN (
    SELECT business_id 
    FROM business_users 
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  business_id IN (
    SELECT business_id 
    FROM business_users 
    WHERE user_id = auth.uid()
  )
); 