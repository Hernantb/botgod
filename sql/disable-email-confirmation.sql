-- Función para actualizar el estado de confirmación de correo de los usuarios existentes
CREATE OR REPLACE FUNCTION confirm_all_users() RETURNS void AS $$
BEGIN
  -- Actualizar todos los usuarios para marcarlos como confirmados
  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
  WHERE email_confirmed_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ejecutar la función para confirmar a todos los usuarios existentes
SELECT confirm_all_users();

-- Trigger para confirmar automáticamente a los nuevos usuarios
CREATE OR REPLACE FUNCTION auto_confirm_email() 
RETURNS TRIGGER AS $$
BEGIN
  -- Establecer email_confirmed_at para nuevos usuarios
  NEW.email_confirmed_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar el trigger si ya existe
DROP TRIGGER IF EXISTS on_auth_user_created_confirm ON auth.users;

-- Crear el trigger para confirmar automáticamente los correos
CREATE TRIGGER on_auth_user_created_confirm
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE auto_confirm_email();

