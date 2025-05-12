-- Script para añadir columnas necesarias para notificaciones
-- Fecha: 8 de abril de 2025

-- Añadir columna notification_timestamp a la tabla conversations
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS notification_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Añadir columna notification_sent a la tabla conversations
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN DEFAULT FALSE;

-- Añadir columna sent_to_whatsapp a la tabla messages
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS sent_to_whatsapp BOOLEAN DEFAULT FALSE;

-- Añadir columna needs_notification a la tabla messages
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS needs_notification BOOLEAN DEFAULT FALSE;

-- Añadir columna notification_sent a la tabla messages
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN DEFAULT FALSE;

-- Comentario explicativo
COMMENT ON COLUMN conversations.notification_timestamp IS 'Marca de tiempo de la última notificación enviada para esta conversación';
COMMENT ON COLUMN conversations.notification_sent IS 'Indica si se ha enviado una notificación para esta conversación';
COMMENT ON COLUMN messages.sent_to_whatsapp IS 'Indica si el mensaje ha sido enviado a WhatsApp';
COMMENT ON COLUMN messages.needs_notification IS 'Indica si este mensaje necesita generar una notificación';
COMMENT ON COLUMN messages.notification_sent IS 'Indica si se ha enviado una notificación para este mensaje'; 