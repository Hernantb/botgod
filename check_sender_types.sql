-- Primero, verificar los valores únicos de sender_type que existen
SELECT DISTINCT sender_type, COUNT(*) as count
FROM messages
GROUP BY sender_type;

-- Desactivar RLS temporalmente para poder ver todos los registros
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

-- Verificar algunos registros de ejemplo
SELECT id, sender_type, content, created_at
FROM messages
LIMIT 5; 