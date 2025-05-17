-- Verificar si la tabla conversations existe y recrearla si es necesario
DO $$
BEGIN
  -- Si la tabla existe, la eliminamos (¡CUIDADO! Esto borrará todos los datos)
  -- Comenta esta sección si quieres preservar los datos existentes
  DROP TABLE IF EXISTS messages;
  DROP TABLE IF EXISTS conversations;

  -- Crear la tabla conversations con la estructura correcta
  CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    title TEXT NOT NULL,
    user_id UUID NOT NULL,
    last_message TEXT DEFAULT 'Nueva conversación',
    last_message_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT CHECK (status IN ('active', 'pending', 'resolved')) DEFAULT 'active',
    unread_count INTEGER DEFAULT 0
  );

  -- Crear la tabla messages si no existe
  CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    conversation_id UUID REFERENCES conversations ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    sender_type TEXT CHECK (sender_type IN ('user', 'bot', 'agent')) NOT NULL,
    user_id UUID NOT NULL,
    read BOOLEAN DEFAULT FALSE
  );

  -- Configurar Row Level Security (RLS)
  -- Habilitar RLS en las tablas
  ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
  ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

  -- Políticas para conversaciones
  CREATE POLICY "Los usuarios pueden ver sus propias conversaciones" 
  ON conversations FOR SELECT 
  USING (auth.uid() = user_id);

  CREATE POLICY "Los usuarios pueden crear sus propias conversaciones" 
  ON conversations FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

  CREATE POLICY "Los usuarios pueden actualizar sus propias conversaciones" 
  ON conversations FOR UPDATE 
  USING (auth.uid() = user_id);

  -- Políticas para mensajes
  CREATE POLICY "Los usuarios pueden ver mensajes de sus conversaciones" 
  ON messages FOR SELECT 
  USING (
    auth.uid() = user_id OR 
    auth.uid() IN (
      SELECT user_id FROM conversations WHERE id = conversation_id
    )
  );

  CREATE POLICY "Los usuarios pueden crear mensajes en sus conversaciones" 
  ON messages FOR INSERT 
  WITH CHECK (
    auth.uid() = user_id OR 
    auth.uid() IN (
      SELECT user_id FROM conversations WHERE id = conversation_id
    )
  );
END $$;

