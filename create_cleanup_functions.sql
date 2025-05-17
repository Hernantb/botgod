-- Función para contar mensajes por período
CREATE OR REPLACE FUNCTION public.count_messages_by_period()
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
    GROUP BY 1
    ORDER BY 
        CASE period
            WHEN 'últimas_24_horas' THEN 1
            WHEN 'última_semana' THEN 2
            WHEN 'último_mes' THEN 3
            ELSE 4
        END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para borrar mensajes antiguos manteniendo solo los últimos N mensajes
CREATE OR REPLACE FUNCTION public.delete_old_messages_keep_last_n(
    messages_to_keep INTEGER,
    batch_size INTEGER DEFAULT 1000
)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
    cutoff_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Encontrar la fecha del mensaje N más reciente
    SELECT created_at INTO cutoff_date
    FROM (
        SELECT created_at
        FROM messages
        ORDER BY created_at DESC
        OFFSET messages_to_keep
        LIMIT 1
    ) subquery;

    -- Si no hay suficientes mensajes para borrar, salir
    IF cutoff_date IS NULL THEN
        RETURN 0;
    END IF;
    
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Otorgar permisos para ejecutar las funciones
GRANT EXECUTE ON FUNCTION public.count_messages_by_period() TO anon;
GRANT EXECUTE ON FUNCTION public.delete_old_messages_keep_last_n(INTEGER, INTEGER) TO anon; 