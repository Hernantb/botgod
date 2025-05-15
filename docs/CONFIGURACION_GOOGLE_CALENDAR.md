# Configuración de la Integración con Google Calendar

Este documento proporciona instrucciones detalladas para configurar correctamente la integración con Google Calendar en el sistema.

## Requisitos previos

1. Una cuenta de Google
2. Acceso al [Google Cloud Console](https://console.cloud.google.com/)
3. Acceso al panel de administración del sistema
4. Permisos de configuración en la base de datos

## Paso 1: Crear un proyecto en Google Cloud

1. Ve a la [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Anota el ID del proyecto para referencia futura

## Paso 2: Configurar la API de Google Calendar

1. En el panel lateral, selecciona "APIs y servicios" > "Biblioteca"
2. Busca "Google Calendar API" y selecciónala
3. Haz clic en "Habilitar"

## Paso 3: Configurar las credenciales de OAuth

1. En el panel lateral, selecciona "APIs y servicios" > "Credenciales"
2. Haz clic en "Crear credenciales" y selecciona "ID de cliente de OAuth"
3. Configura la pantalla de consentimiento:
   - Tipo de usuario: Externo (o Interno si tienes Google Workspace)
   - Nombre de la aplicación: "Bot WhatsApp Calendar"
   - Correo electrónico de soporte: Tu correo electrónico
   - Dominios autorizados: Deja en blanco
   - Información de contacto para el desarrollador: Tu correo electrónico
4. Configura el ID de cliente OAuth:
   - Tipo de aplicación: Web
   - Nombre: "Bot WhatsApp Calendar"
   - Orígenes de JavaScript autorizados: `http://localhost:3095` (y tu URL de producción)
   - URIs de redirección autorizados: `http://localhost:3095/google-auth-callback` (y tu URL de producción + "/google-auth-callback")
5. Haz clic en "Crear"
6. Anota el ID de cliente y el Secreto del cliente

## Paso 4: Configurar las variables de entorno

1. Abre el archivo `.env` en la raíz del proyecto
2. Actualiza o añade las siguientes variables:

```
***REMOVED***=tu_id_de_cliente
***REMOVED***=tu_secreto_de_cliente
GOOGLE_REDIRECT_URI=http://localhost:3095/google-auth-callback
```

3. En producción, asegúrate de usar la URL correcta (con HTTPS) para el GOOGLE_REDIRECT_URI

## Paso 5: Preparar la base de datos

Asegúrate de que la tabla `business_config` tenga los siguientes campos:

```sql
ALTER TABLE business_config ADD COLUMN IF NOT EXISTS google_calendar_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE business_config ADD COLUMN IF NOT EXISTS google_calendar_refresh_token TEXT;
ALTER TABLE business_config ADD COLUMN IF NOT EXISTS google_calendar_access_token TEXT;
ALTER TABLE business_config ADD COLUMN IF NOT EXISTS google_calendar_token_expiry TIMESTAMPTZ;
ALTER TABLE business_config ADD COLUMN IF NOT EXISTS google_calendar_id TEXT;
ALTER TABLE business_config ADD COLUMN IF NOT EXISTS google_calendar_updated_at TIMESTAMPTZ;
```

Y que exista la tabla `calendar_events`:

```sql
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  event_id TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_name TEXT,
  event_date DATE NOT NULL,
  event_time TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  canceled BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_business_id ON calendar_events(business_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_customer_phone ON calendar_events(customer_phone);
```

## Paso 6: Conectar una cuenta de Google

1. Inicia sesión en el panel de administración
2. Ve a la sección "Configuración" > "Integraciones"
3. Encuentra la sección "Google Calendar" y haz clic en "Conectar"
4. Se abrirá una ventana emergente con la solicitud de autorización de Google
5. Inicia sesión con la cuenta de Google que contiene el calendario deseado
6. Acepta los permisos solicitados
7. Una vez completado, la ventana mostrará "Cuenta conectada exitosamente" y se cerrará automáticamente
8. Verifica que en el panel aparezca "Conectado" en la sección de Google Calendar

## Paso 7: Verificar la integración

1. Ve a la sección "Calendario" o "Citas" en el panel
2. Intenta ver la disponibilidad para una fecha futura
3. Prueba la creación de una cita de prueba
4. Verifica que la cita aparezca en tu Google Calendar

## Solución de problemas

Si encuentras algún problema durante la configuración:

1. **Error "invalid_client"**: Verifica que el ID de cliente y el secreto estén correctamente configurados en el archivo `.env`
2. **Error de redirección**: Asegúrate de que el URI de redirección en Google Cloud coincida exactamente con GOOGLE_REDIRECT_URI en tu archivo `.env`
3. **No se guarda el refresh_token**: Asegúrate de configurar `prompt: 'consent'` en la URL de autorización y `access_type: 'offline'`
4. **No se encuentra el ID de negocio**: Verifica que la tabla `business_config` tenga una entrada para el negocio correspondiente con un `business_id` válido

## Notas adicionales

- La autorización de Google Calendar requiere renovación después de un tiempo (generalmente entre 3-6 meses, dependiendo de la configuración). Si expira, el sistema usará datos simulados hasta que se renueve la autorización.
- Puedes cambiarte a otro calendario específico editando el campo `google_calendar_id` en la tabla `business_config`. Por defecto, se usa el calendario primario de la cuenta. 