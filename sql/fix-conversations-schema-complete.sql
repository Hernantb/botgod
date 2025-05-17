-- Asegurarse de que la extensión uuid-ossp esté habilitada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Función para verificar si una columna existe
CREATE OR REPLACE FUNCTION column_exists(tbl text, col text) RETURNS boolean AS $$
DECLARE
  exists boolean;
BEGIN
  SELECT COUNT(*) > 0 INTO exists
  FROM pg_attribute
  WHERE attrelid = (SELECT oid FROM pg_class WHERE relname = tbl)
    AND attname = col
    AND NOT attisdropped;
  RETURN exists;
END;
$$ LANGUAGE plpgsql;

-- Verificar y agregar columnas si no existen
DO $$
BEGIN
  -- Add last_message_time if it doesn't exist
  IF NOT column_exists('conversations', 'last_message_time') THEN
    ALTER TABLE conversations ADD COLUMN last_message_time TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    UPDATE conversations SET last_message_time = created_at WHERE last_message_time IS NULL;
  END IF;

  -- Add last_message if it doesn't exist
  IF NOT column_exists('conversations', 'last_message') THEN
    ALTER TABLE conversations ADD COLUMN last_message TEXT;
  END IF;

  -- Add unread_count if it doesn't exist
  IF NOT column_exists('conversations', 'unread_count') THEN
    ALTER TABLE conversations ADD COLUMN unread_count INTEGER DEFAULT 0;
    UPDATE conversations SET unread_count = 0 WHERE unread_count IS NULL;
  END IF;

  -- Add requires_notification column if it doesn't exist
  IF NOT column_exists('conversations', 'requires_notification') THEN
    ALTER TABLE conversations ADD COLUMN requires_notification BOOLEAN DEFAULT FALSE;
    UPDATE conversations SET requires_notification = FALSE WHERE requires_notification IS NULL;
  END IF;

  -- Add notification_sent column if it doesn't exist
  IF NOT column_exists('conversations', 'notification_sent') THEN
    ALTER TABLE conversations ADD COLUMN notification_sent BOOLEAN DEFAULT FALSE;
    UPDATE conversations SET notification_sent = FALSE WHERE notification_sent IS NULL;
  END IF;

  -- Add last_notification_time column if it doesn't exist
  IF NOT column_exists('conversations', 'last_notification_time') THEN
    ALTER TABLE conversations ADD COLUMN last_notification_time TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Eliminar la función column_exists si ya no es necesaria
DROP FUNCTION IF EXISTS column_exists(text, text);

