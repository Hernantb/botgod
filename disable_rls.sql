-- Desactivar RLS temporalmente para la tabla de mensajes
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

-- Crear una política que permita todas las operaciones
CREATE POLICY "Allow all operations" ON messages
    USING (true)
    WITH CHECK (true);

-- Para reactivar RLS después:
-- ALTER TABLE messages ENABLE ROW LEVEL SECURITY; 