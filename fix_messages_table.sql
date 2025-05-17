-- Primero, desactivar RLS temporalmente
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

-- Eliminar la restricción existente de sender_type
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_sender_type_check;

-- Actualizar los valores existentes
UPDATE messages SET sender_type = 'bot' WHERE sender_type IN ('system', 'agent', 'assistant');

-- Agregar la nueva restricción
ALTER TABLE messages ADD CONSTRAINT messages_sender_type_check 
    CHECK (sender_type IN ('user', 'bot'));

-- Verificar los mensajes
SELECT sender_type, COUNT(*) as count 
FROM messages 
GROUP BY sender_type;

-- Crear una política que permita acceso público temporal
DROP POLICY IF EXISTS "Allow public access" ON messages;
CREATE POLICY "Allow public access" ON messages
    FOR ALL
    TO public
    USING (true)
    WITH CHECK (true);

-- Mostrar algunos mensajes recientes
SELECT id, sender_type, content, created_at
FROM messages
ORDER BY created_at DESC
LIMIT 5; 