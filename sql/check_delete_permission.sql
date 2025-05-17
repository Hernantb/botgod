-- Función que verifica si el usuario actual tiene permisos para eliminar un registro
-- Esta función es útil para diagnosticar problemas de permisos RLS
CREATE OR REPLACE FUNCTION check_delete_permission(
  table_name text,
  record_id uuid,
  condition_column text DEFAULT 'id'
) RETURNS json AS $$
DECLARE
  query text;
  result json;
  can_delete boolean;
  user_id uuid;
  role_name text;
  error_message text;
BEGIN
  -- Obtener información del usuario actual
  user_id := auth.uid();
  IF user_id IS NULL THEN
    RETURN json_build_object(
      'status', 'error',
      'message', 'No user is authenticated',
      'user_id', NULL,
      'can_delete', false
    );
  END IF;
  
  -- Obtener rol del usuario
  SELECT auth.role() INTO role_name;
  
  -- Crear query dinámico para verificar permisos
  query := format('
    WITH deletion_test AS (
      DELETE FROM %I 
      WHERE %I = %L
      RETURNING *
    ) 
    SELECT COUNT(*) > 0 as can_delete, 
           (SELECT EXISTS(SELECT 1 FROM %I WHERE %I = %L)) as record_exists
    FROM deletion_test;',
    table_name, condition_column, record_id,
    table_name, condition_column, record_id
  );
  
  BEGIN
    -- Ejecutar en un bloque de transacción para poder hacer rollback
    BEGIN
      -- Intentar la eliminación en una transacción (que será revertida)
      EXECUTE query INTO result;
      -- Si llegamos aquí, la operación fue exitosa
      RETURN json_build_object(
        'status', 'success',
        'message', 'User has delete permission',
        'user_id', user_id,
        'role', role_name,
        'table', table_name,
        'record_id', record_id,
        'result', result
      );
    EXCEPTION WHEN OTHERS THEN
      -- Capturar error si la operación falla
      GET STACKED DIAGNOSTICS error_message = MESSAGE_TEXT;
      RETURN json_build_object(
        'status', 'error',
        'message', error_message,
        'user_id', user_id,
        'role', role_name,
        'table', table_name,
        'record_id', record_id,
        'can_delete', false,
        'error_code', SQLSTATE
      );
    END;
  ROLLBACK;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentarios sobre cómo usar la función
COMMENT ON FUNCTION check_delete_permission(text, uuid, text) IS 
'Verifica si el usuario actual tiene permisos para eliminar un registro específico.
Ejemplo de uso: SELECT check_delete_permission(''conversations'', ''550e8400-e29b-41d4-a716-446655440000'', ''id'');
Para verificar permisos en mensajes: SELECT check_delete_permission(''messages'', ''550e8400-e29b-41d4-a716-446655440000'', ''conversation_id'');';

-- Otorgar permisos para utilizar la función
GRANT EXECUTE ON FUNCTION check_delete_permission TO authenticated;
GRANT EXECUTE ON FUNCTION check_delete_permission TO service_role;
GRANT EXECUTE ON FUNCTION check_delete_permission TO anon; 