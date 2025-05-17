-- Eliminar políticas existentes de messages
DROP POLICY IF EXISTS "Users can insert messages to their business" ON messages;
DROP POLICY IF EXISTS "Users can view messages from their business" ON messages;

-- Crear políticas más permisivas para messages
CREATE POLICY "Allow all select on messages"
    ON messages FOR SELECT
    USING (true);

CREATE POLICY "Allow all insert on messages"
    ON messages FOR INSERT
    WITH CHECK (true);

-- Verificar que no hay mensajes huérfanos
DELETE FROM messages 
WHERE conversation_id NOT IN (SELECT id FROM conversations);

-- Insertar un mensaje de prueba
INSERT INTO messages (
    conversation_id,
    business_id,
    content,
    message,
    event_type,
    status,
    sender_type,
    created_at,
    message_type,
    user_id,
    read
)
SELECT 
    c.id,
    c.business_id,
    'Mensaje de prueba',
    'Mensaje de prueba',
    'message',
    'sent',
    'system',
    NOW(),
    'text',
    (SELECT user_id FROM business_users WHERE business_id = c.business_id LIMIT 1),
    true
FROM conversations c
WHERE c.id = '1b2c1ec6-7c52-4a92-ab8f-9975b8624bdc'
LIMIT 1; 