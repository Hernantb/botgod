-- Crear tabla de perfiles de usuario
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla de conversaciones
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  title TEXT NOT NULL,
  user_id UUID REFERENCES auth.users NOT NULL,
  last_message TEXT,
  last_message_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT CHECK (status IN ('active', 'pending', 'resolved')) DEFAULT 'active',
  unread_count INTEGER DEFAULT 0
);

-- Crear tabla de mensajes
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  conversation_id UUID REFERENCES conversations ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  sender_type TEXT CHECK (sender_type IN ('user', 'bot', 'agent')) NOT NULL,
  user_id UUID REFERENCES auth.users NOT NULL,
  read BOOLEAN DEFAULT FALSE
);

-- Configurar Row Level Security (RLS)
-- Habilitar RLS en todas las tablas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Políticas para perfiles
CREATE POLICY "Los usuarios pueden ver su propio perfil" 
  ON profiles FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Los usuarios pueden actualizar su propio perfil" 
  ON profiles FOR UPDATE 
  USING (auth.uid() = id);

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

-- Función para actualizar last_message y last_message_time en conversaciones
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET 
    last_message = NEW.content,
    last_message_time = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar conversaciones cuando se inserta un mensaje
CREATE TRIGGER update_conversation_last_message_trigger
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_last_message();

-- Función para incrementar unread_count cuando un bot o agente envía un mensaje
CREATE OR REPLACE FUNCTION increment_unread_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sender_type IN ('bot', 'agent') AND NEW.read = FALSE THEN
    UPDATE conversations
    SET unread_count = unread_count + 1
    WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para incrementar unread_count
CREATE TRIGGER increment_unread_count_trigger
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION increment_unread_count();

