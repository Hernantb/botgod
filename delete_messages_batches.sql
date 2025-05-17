-- Primero, obtén el recuento total de mensajes
SELECT COUNT(*) FROM messages WHERE conversation_id = '4a42aa05-2ffd-418b-aa52-29e7c571eee8';

-- Luego, elimina mensajes antiguos en lotes
-- Ejecuta cada bloque por separado para evitar problemas

-- Primer lote de eliminación (los 200 más antiguos)
DELETE FROM messages 
WHERE id IN (
    SELECT id 
    FROM messages 
    WHERE conversation_id = '4a42aa05-2ffd-418b-aa52-29e7c571eee8'
    ORDER BY created_at ASC 
    LIMIT 200
);

-- Espera un momento, luego ejecuta otro lote
-- Segundo lote
DELETE FROM messages 
WHERE id IN (
    SELECT id 
    FROM messages 
    WHERE conversation_id = '4a42aa05-2ffd-418b-aa52-29e7c571eee8'
    ORDER BY created_at ASC 
    LIMIT 200
);

-- Repite este bloque cuantas veces sea necesario hasta que queden aproximadamente 200 mensajes
-- Puedes verificar el recuento después de cada eliminación:
SELECT COUNT(*) FROM messages WHERE conversation_id = '4a42aa05-2ffd-418b-aa52-29e7c571eee8'; 