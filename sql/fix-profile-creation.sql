-- Asegurarse de que la extensión uuid-ossp esté habilitada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Modificar la tabla de perfiles si es necesario
ALTER TABLE IF EXISTS profiles 
  ALTER COLUMN email DROP NOT NULL;

-- Crear una función RPC para crear perfiles de usuario
-- Esta función se ejecutará con privilegios de administrador
CREATE OR REPLACE FUNCTION create_user_profile(
  user_id UUID,
  user_email TEXT,
  user_name TEXT
) RETURNS VOID AS $$
BEGIN
  -- Verificar si el perfil ya existe
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = user_id) THEN
    -- Insertar el perfil
    INSERT INTO profiles (id, email, name, created_at)
    VALUES (user_id, user_email, user_name, NOW());
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear un trigger para crear automáticamente perfiles cuando se registra un usuario
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar el trigger si ya existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Crear el trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Actualizar las políticas RLS para la tabla profiles
DROP POLICY IF EXISTS "Los usuarios pueden ver su propio perfil" ON profiles;
DROP POLICY IF EXISTS "Los usuarios pueden actualizar su propio perfil" ON profiles;
DROP POLICY IF EXISTS "Los usuarios pueden insertar su propio perfil" ON profiles;

-- Políticas más permisivas para perfiles
CREATE POLICY "Los usuarios pueden ver cualquier perfil" 
  ON profiles FOR SELECT 
  USING (true);

CREATE POLICY "Los usuarios pueden actualizar su propio perfil" 
  ON profiles FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "Los usuarios pueden insertar su propio perfil" 
  ON profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Asegurarse de que las tablas tengan RLS habilitado
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

