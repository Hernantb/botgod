-- Crear una función para verificar si una columna existe en una tabla
CREATE OR REPLACE FUNCTION column_exists(p_table_name TEXT, p_column_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  column_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = p_table_name
      AND column_name = p_column_name
  ) INTO column_exists;
  
  RETURN column_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Asegurarse de que las columnas necesarias existen en la tabla conversations
DO $$
BEGIN
  -- Verificar y añadir la columna last_message si no existe
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'conversations' 
      AND column_name = 'last_message'
  ) THEN
    ALTER TABLE conversations 
    ADD COLUMN last_message TEXT DEFAULT 'Nueva conversación';
  END IF;

  -- Verificar y añadir la columna last_message_time si no existe
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'conversations' 
      AND column_name = 'last_message_time'
  ) THEN
    ALTER TABLE conversations 
    ADD COLUMN last_message_time TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;

  -- Verificar y añadir la columna unread_count si no existe
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'conversations' 
      AND column_name = 'unread_count'
  ) THEN
    ALTER TABLE conversations 
    ADD COLUMN unread_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- Actualizar los registros existentes para establecer valores predeterminados
UPDATE conversations
SET last_message = 'Nueva conversación'
WHERE last_message IS NULL;

UPDATE conversations
SET last_message_time = created_at
WHERE last_message_time IS NULL;

UPDATE conversations
SET unread_count = 0
WHERE unread_count IS NULL;

