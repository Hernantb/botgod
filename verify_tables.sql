-- Verificar la existencia y estructura de las tablas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE';

-- Verificar los mensajes existentes
SELECT COUNT(*) as message_count 
FROM messages;

-- Verificar las conversaciones existentes
SELECT COUNT(*) as conversation_count 
FROM conversations;

-- Verificar la relación entre mensajes y conversaciones
SELECT 
    c.id as conversation_id,
    c.user_id,
    c.business_id,
    COUNT(m.id) as message_count
FROM conversations c
LEFT JOIN messages m ON c.id = m.conversation_id
GROUP BY c.id, c.user_id, c.business_id
LIMIT 5;

-- Verificar los business_users
SELECT 
    bu.user_id,
    bu.business_id,
    b.name as business_name,
    COUNT(DISTINCT c.id) as conversation_count,
    COUNT(DISTINCT m.id) as message_count
FROM business_users bu
JOIN businesses b ON bu.business_id = b.id
LEFT JOIN conversations c ON c.business_id = bu.business_id
LEFT JOIN messages m ON m.conversation_id = c.id
GROUP BY bu.user_id, bu.business_id, b.name;

-- Verificar las políticas de RLS
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename IN ('messages', 'conversations', 'business_users'); 