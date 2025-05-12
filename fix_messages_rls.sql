-- Drop existing policies
DROP POLICY IF EXISTS "Enable insert for anonymous users" ON messages;
DROP POLICY IF EXISTS "Enable select for anonymous users" ON messages;
DROP POLICY IF EXISTS "Enable update for anonymous users" ON messages;

-- Create more permissive policies for development
CREATE POLICY "Enable all operations for all users" ON messages
    FOR ALL
    USING (true)
    WITH CHECK (true); 