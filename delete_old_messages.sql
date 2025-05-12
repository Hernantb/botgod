-- Script para eliminar mensajes antiguos manteniendo los 200 más recientes
-- Para la conversación con ID: 4a42aa05-2ffd-418b-aa52-29e7c571eee8

-- 1. Crear tabla temporal para almacenar los IDs a mantener
CREATE TEMP TABLE recent_message_ids AS
SELECT id 
FROM messages 
WHERE conversation_id = '4a42aa05-2ffd-418b-aa52-29e7c571eee8'
ORDER BY created_at DESC 
LIMIT 200;

-- 2. Eliminar todos los mensajes que no están en la tabla temporal
DELETE FROM messages 
WHERE conversation_id = '4a42aa05-2ffd-418b-aa52-29e7c571eee8'
AND id NOT IN (SELECT id FROM recent_message_ids);

-- 3. Eliminar la tabla temporal
DROP TABLE recent_message_ids;

-- Función para borrar mensajes antiguos
CREATE OR REPLACE FUNCTION delete_old_messages(
    days_to_keep INTEGER,
    batch_size INTEGER DEFAULT 1000
)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
    cutoff_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Calcular la fecha de corte
    cutoff_date := NOW() - (days_to_keep || ' days')::INTERVAL;
    
    -- Borrar mensajes antiguos en lotes
    WITH messages_to_delete AS (
        SELECT id
        FROM messages
        WHERE created_at < cutoff_date
        LIMIT batch_size
        FOR UPDATE SKIP LOCKED
    )
    DELETE FROM messages
    WHERE id IN (SELECT id FROM messages_to_delete);
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Función para contar mensajes por período
CREATE OR REPLACE FUNCTION count_messages_by_period(
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE (
    period TEXT,
    message_count BIGINT,
    storage_size_bytes BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        CASE
            WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 'últimas_24_horas'
            WHEN created_at >= NOW() - INTERVAL '7 days' THEN 'última_semana'
            WHEN created_at >= NOW() - INTERVAL '30 days' THEN 'último_mes'
            ELSE 'más_antiguos'
        END as period,
        COUNT(*) as message_count,
        SUM(LENGTH(content)) as storage_size_bytes
    FROM messages
    WHERE (start_date IS NULL OR created_at >= start_date)
    AND (end_date IS NULL OR created_at <= end_date)
    GROUP BY 1
    ORDER BY 
        CASE period
            WHEN 'últimas_24_horas' THEN 1
            WHEN 'última_semana' THEN 2
            WHEN 'último_mes' THEN 3
            ELSE 4
        END;
END;
$$ LANGUAGE plpgsql; 