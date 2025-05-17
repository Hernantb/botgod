-- Migrar mensajes existentes de las conversaciones a la tabla messages
INSERT INTO messages (
    conversation_id,
    business_id,
    content,
    message,
    event_type,
    status,
    sender_type,
    phone_number,
    created_at,
    message_type,
    user_id,
    read
)
SELECT 
    c.id as conversation_id,
    c.business_id,
    c.message as content,
    c.message,
    'message' as event_type,
    COALESCE(c.status, 'received') as status,
    CASE 
        WHEN c.user_id LIKE '+%' THEN 'user'
        ELSE 'agent'
    END as sender_type,
    c.user_id as phone_number,
    COALESCE(c.last_message_time, c.created_at) as created_at,
    COALESCE(c.message_type, 'text') as message_type,
    (
        SELECT bu.user_id 
        FROM business_users bu 
        WHERE bu.business_id = c.business_id 
        LIMIT 1
    ) as user_id,
    true as read
FROM conversations c
WHERE c.message IS NOT NULL
AND NOT EXISTS (
    SELECT 1 
    FROM messages m 
    WHERE m.conversation_id = c.id 
    AND m.message = c.message
    AND m.created_at = COALESCE(c.last_message_time, c.created_at)
);

-- Actualizar las conversaciones para reflejar el último mensaje
UPDATE conversations c
SET 
    last_message = (
        SELECT message 
        FROM messages m 
        WHERE m.conversation_id = c.id 
        ORDER BY m.created_at DESC 
        LIMIT 1
    ),
    last_message_time = (
        SELECT created_at 
        FROM messages m 
        WHERE m.conversation_id = c.id 
        ORDER BY m.created_at DESC 
        LIMIT 1
    )
WHERE EXISTS (
    SELECT 1 
    FROM messages m 
    WHERE m.conversation_id = c.id
); 