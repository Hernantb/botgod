-- Este script configura los permisos necesarios para eliminar conversaciones y mensajes
-- Debe ejecutarse como administrador en la consola SQL de Supabase

-- 1. Primero habilitar RLS en las tablas si aún no está habilitado
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 2. Limpiar cualquier política existente que pueda estar conflictuando
DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar sus conversaciones" ON conversations;
DROP POLICY IF EXISTS "Usuarios de servicio pueden eliminar cualquier conversación" ON conversations;
DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar mensajes de sus conversaciones" ON messages;
DROP POLICY IF EXISTS "Usuarios de servicio pueden eliminar cualquier mensaje" ON messages;

-- 3. Crear políticas para usuarios autenticados (dashboard)
-- Permitir a usuarios autenticados eliminar sus propias conversaciones
CREATE POLICY "Usuarios autenticados pueden eliminar sus conversaciones"
  ON conversations
  FOR DELETE 
  USING (
    -- Usuarios pueden eliminar conversaciones donde:
    (auth.uid() IN ( -- El usuario está vinculado al business_id de la conversación
      SELECT user_id FROM business_users 
      WHERE business_id = conversations.business_id AND is_active = true
    ))
    OR
    (auth.role() IN ('service_role', 'supabase_admin')) -- O tiene rol privilegiado
  );

-- Permitir a usuarios autenticados eliminar mensajes de sus conversaciones
CREATE POLICY "Usuarios autenticados pueden eliminar mensajes de sus conversaciones"
  ON messages
  FOR DELETE 
  USING (
    -- Usuarios pueden eliminar mensajes donde:
    (
      auth.uid() IN ( -- El usuario está vinculado al business_id de la conversación del mensaje
        SELECT user_id FROM business_users 
        WHERE business_id = (
          SELECT business_id FROM conversations 
          WHERE id = messages.conversation_id
        )
        AND is_active = true
      )
    )
    OR
    (auth.role() IN ('service_role', 'supabase_admin')) -- O tiene rol privilegiado
  );

-- 4. Crear políticas para el servicio interno (para operaciones de backend)
-- Política para permitir al rol de servicio eliminar cualquier conversación
CREATE POLICY "Usuarios de servicio pueden eliminar cualquier conversación"
  ON conversations
  FOR DELETE 
  USING (auth.role() IN ('service_role', 'supabase_admin'));

-- Política para permitir al rol de servicio eliminar cualquier mensaje
CREATE POLICY "Usuarios de servicio pueden eliminar cualquier mensaje"
  ON messages
  FOR DELETE 
  USING (auth.role() IN ('service_role', 'supabase_admin'));

-- 5. Otorgar permisos al rol anónimo para hacer operaciones (para webhooks y servicios externos)
GRANT DELETE ON conversations TO anon;
GRANT DELETE ON messages TO anon;

-- 6. Otorgar permisos al rol autenticado
GRANT DELETE ON conversations TO authenticated;
GRANT DELETE ON messages TO authenticated;

-- 7. Comentarios explicativos
COMMENT ON POLICY "Usuarios autenticados pueden eliminar sus conversaciones" ON conversations
  IS 'Permite a los usuarios autenticados eliminar conversaciones que pertenecen a un negocio donde están vinculados como usuarios activos';

COMMENT ON POLICY "Usuarios autenticados pueden eliminar mensajes de sus conversaciones" ON messages
  IS 'Permite a los usuarios autenticados eliminar mensajes de las conversaciones que pertenecen a negocios donde están vinculados como usuarios activos';

COMMENT ON POLICY "Usuarios de servicio pueden eliminar cualquier conversación" ON conversations
  IS 'Permite a usuarios con rol de servicio eliminar cualquier conversación sin restricciones';

COMMENT ON POLICY "Usuarios de servicio pueden eliminar cualquier mensaje" ON messages
  IS 'Permite a usuarios con rol de servicio eliminar cualquier mensaje sin restricciones'; 