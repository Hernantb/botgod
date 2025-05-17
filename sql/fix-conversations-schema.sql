-- Verificar si la columna last_message_time existe y añadirla si no
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'conversations' 
        AND column_name = 'last_message_time'
    ) THEN
        -- Añadir la columna last_message_time
        ALTER TABLE conversations 
        ADD COLUMN last_message_time TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Actualizar los registros existentes para establecer last_message_time
UPDATE conversations
SET last_message_time = created_at
WHERE last_message_time IS NULL;

