-- Función para eliminar conversaciones y todos sus mensajes asociados de forma atómica
-- Esta función se ejecuta como una transacción completa, lo que significa que
-- o se elimina todo o no se elimina nada, evitando estados inconsistentes

CREATE OR REPLACE FUNCTION delete_conversation_complete(conversation_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conversation_exists boolean;
  v_messages_count int;
  v_media_count int;
BEGIN
  -- Verificar si la conversación existe
  SELECT EXISTS(
    SELECT 1 FROM conversations WHERE id = conversation_id
  ) INTO v_conversation_exists;
  
  IF NOT v_conversation_exists THEN
    RAISE NOTICE 'La conversación % no existe. Nada que eliminar.', conversation_id;
    RETURN false;
  END IF;
  
  -- Iniciar eliminación de todos los registros asociados
  
  -- 1. Eliminar todos los mensajes asociados a esta conversación
  DELETE FROM messages WHERE conversation_id = delete_conversation_complete.conversation_id;
  GET DIAGNOSTICS v_messages_count = ROW_COUNT;
  RAISE NOTICE 'Eliminados % mensajes', v_messages_count;
  
  -- 2. Eliminar multimedia relacionada (si existe la tabla)
  BEGIN
    DELETE FROM media WHERE conversation_id = delete_conversation_complete.conversation_id;
    GET DIAGNOSTICS v_media_count = ROW_COUNT;
    RAISE NOTICE 'Eliminados % archivos multimedia', v_media_count;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'La tabla media no existe. Continuando...';
  END;
  
  -- 3. Eliminar la conversación
  DELETE FROM conversations WHERE id = delete_conversation_complete.conversation_id;
  
  -- 4. Verificar que se haya eliminado correctamente
  SELECT NOT EXISTS(
    SELECT 1 FROM conversations WHERE id = conversation_id
  ) INTO v_conversation_exists;
  
  IF v_conversation_exists THEN
    RAISE NOTICE 'Conversación % eliminada correctamente', conversation_id;
    RETURN true;
  ELSE
    RAISE WARNING 'Error al eliminar la conversación %', conversation_id;
    RETURN false;
  END IF;
END;
$$;

-- Comentario sobre cómo usar la función:
COMMENT ON FUNCTION delete_conversation_complete(uuid) IS 
'Elimina una conversación y todos sus datos relacionados (mensajes, multimedia) en una sola transacción atómica. 
Ejemplo de uso: SELECT delete_conversation_complete(''550e8400-e29b-41d4-a716-446655440000'')';

-- Asegurar que esta función puede ser ejecutada por roles autenticados
GRANT EXECUTE ON FUNCTION delete_conversation_complete(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_conversation_complete(uuid) TO anon;
GRANT EXECUTE ON FUNCTION delete_conversation_complete(uuid) TO service_role; 