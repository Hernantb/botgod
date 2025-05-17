-- Primero, vamos a ver qué valores únicos tenemos en sender_type
SELECT DISTINCT sender_type FROM messages;

-- Eliminar la restricción existente de sender_type si existe
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_sender_type_check;

-- Agregar la nueva restricción para sender_type que incluya 'bot'
ALTER TABLE messages ADD CONSTRAINT messages_sender_type_check 
    CHECK (sender_type IN ('user', 'assistant', 'system', 'bot'));

-- Verificar que todos los registros cumplan con la nueva restricción
SELECT DISTINCT sender_type FROM messages;

-- Restaurar RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Recrear las políticas de seguridad
CREATE POLICY "Enable read access for all" ON messages
    FOR SELECT
    TO public
    USING (true);

CREATE POLICY "Enable insert for all" ON messages
    FOR INSERT
    TO public
    WITH CHECK (true);

CREATE POLICY "Enable update for all" ON messages
    FOR UPDATE
    TO public
    USING (true)
    WITH CHECK (true); 