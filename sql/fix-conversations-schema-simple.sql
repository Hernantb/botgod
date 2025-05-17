-- Asegurarse de que la extensión uuid-ossp esté habilitada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Verificar y añadir la columna last_message si no existe
DO $$
BEGIN
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
END $$;

-- Verificar y añadir la columna last_message_time si no existe
DO $$
BEGIN
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
END $$;

-- Verificar y añadir la columna unread_count si no existe
DO $$
BEGIN
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

