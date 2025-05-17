-- SQL para verificar el límite de resultados en Supabase
SELECT COUNT(*) FROM messages 
WHERE conversation_id = '4a42aa05-2ffd-418b-aa52-29e7c571eee8';

-- SQL para obtener los mensajes más recientes primero
SELECT * FROM messages 
WHERE conversation_id = '4a42aa05-2ffd-418b-aa52-29e7c571eee8' 
ORDER BY created_at DESC 
LIMIT 50; 