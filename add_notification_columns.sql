-- Script para agregar columnas relacionadas con notificaciones en Supabase
-- Ejecutar este script desde el panel SQL de Supabase

-- 1. Agregar columnas para notificaciones a la tabla conversations
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notification_timestamp TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS notification_error TEXT;

-- 2. Confirmar que la tabla notifications tenga todas las columnas necesarias
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  client_phone TEXT NOT NULL,
  type TEXT DEFAULT 'general',
  status TEXT DEFAULT 'pending',
  message TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Crear índices para mejorar el rendimiento de las consultas
CREATE INDEX IF NOT EXISTS idx_notifications_conversation_id ON notifications(conversation_id);
CREATE INDEX IF NOT EXISTS idx_notifications_business_id ON notifications(business_id);
CREATE INDEX IF NOT EXISTS idx_notifications_client_phone ON notifications(client_phone);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_conversations_notification_sent ON conversations(notification_sent);

-- 4. Actualizar fila notification_sent para conversaciones existentes
UPDATE conversations
SET notification_sent = FALSE
WHERE notification_sent IS NULL;

-- 5. Función para enviar notificaciones automáticamente
CREATE OR REPLACE FUNCTION process_notification_on_message_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar si el mensaje es del bot y posiblemente requiere notificación
  IF NEW.sender_type = 'bot' THEN
    -- Marcar para verificación posterior de notificación
    NEW.needs_notification = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger para procesar mensajes nuevos
DROP TRIGGER IF EXISTS trig_process_notification_on_message_insert ON messages;

CREATE TRIGGER trig_process_notification_on_message_insert
BEFORE INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION process_notification_on_message_insert();

-- 7. Asegurarse de que la tabla messages tenga las columnas necesarias
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS needs_notification BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notification_timestamp TIMESTAMPTZ;

-- Confirmar que todo se ha ejecutado correctamente
SELECT 'Columnas y configuración de notificaciones agregadas correctamente.' as result; 