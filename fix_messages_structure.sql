-- Primero, vamos a verificar la estructura actual
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM 
    information_schema.columns 
WHERE 
    table_name = 'messages';

-- Desactivar RLS temporalmente
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Enable read access for users based on business_id" ON messages;
DROP POLICY IF EXISTS "Enable insert for users based on business_id" ON messages;
DROP POLICY IF EXISTS "Enable update for users based on business_id" ON messages;

-- Crear una política que permita acceso público temporal
CREATE POLICY "Allow public access" ON messages
    FOR ALL
    TO public
    USING (true)
    WITH CHECK (true);

-- Verificar los mensajes existentes
SELECT * FROM messages LIMIT 5; 