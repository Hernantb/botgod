# WhatsApp Bot Notification System

Este documento proporciona una guía completa del sistema de notificaciones implementado en el bot de WhatsApp. El sistema detecta automáticamente cuando un mensaje del bot requiere atención humana y envía notificaciones por correo electrónico al equipo de negocio.

## Descripción general

El sistema de notificaciones monitorea los mensajes intercambiados entre los usuarios y el bot, buscando frases específicas que indiquen una necesidad de intervención humana. Cuando se detectan tales frases, el sistema envía automáticamente una notificación por correo electrónico con detalles sobre la conversación.

## Características

- **Detección de frases**: Identifica automáticamente mensajes que indican necesidad de atención humana
- **Notificaciones por correo**: Envía correos HTML formateados a los destinatarios especificados
- **Integración con base de datos**: Registra todos los intentos de notificación en la base de datos
- **Mecanismos de respaldo**: Incluye configuración SMTP alternativa para mayor confiabilidad
- **Frases personalizables**: Lista de frases activadoras fácil de actualizar

## Configuración de claves de Supabase

El sistema requiere credenciales de Supabase para funcionar completamente. Estas son las claves disponibles:

```
# Clave anónima de Supabase
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4MjI3NjgsImV4cCI6MjA1NzM5ODc2OH0._HSnvof7NUk6J__qqq3gJvbJRZnItCAmlI5HYAL8WVI

# Clave de rol de servicio de Supabase
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTgyMjc2OCwiZXhwIjoyMDU3Mzk4NzY4fQ.eAMYqHQ5ma_2tPXOwCYKw3tt_vERE0zhBj2xS1srv9M

# URL de Supabase
SUPABASE_URL=https://wscijkxwevgxbgwhbqtm.supabase.co
```

Puedes agregar estas claves al archivo `.env` en la raíz del proyecto para que el sistema funcione correctamente.

## Instalación

El sistema de notificaciones se instala utilizando el script `install-notification.js`:

```bash
node install-notification.js
```

Este script:
1. Crea una copia de seguridad de los archivos originales
2. Integra el módulo de notificaciones en el bot principal de WhatsApp
3. Agrega las llamadas de función necesarias en puntos clave del flujo de mensajes

## Configuración

Configura el sistema de notificaciones estableciendo las siguientes variables de entorno:

```
# Configuración de notificaciones
NOTIFICATION_EMAILS=email1@example.com,email2@example.com
BUSINESS_NAME=Nombre de tu Negocio

# Configuración SMTP principal
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=usuario@example.com
SMTP_PASS=tu-contraseña
SMTP_FROM=notificaciones@example.com
SMTP_SECURE=false

# Configuración SMTP alternativa (opcional)
ALTERNATE_SMTP_HOST=alt-smtp.example.com
ALTERNATE_SMTP_PORT=587
ALTERNATE_SMTP_USER=alt-usuario@example.com
ALTERNATE_SMTP_PASS=alt-contraseña
ALTERNATE_SMTP_SECURE=false
```

## Probando el sistema de notificaciones

### Usando el servidor de pruebas independiente

El servidor de pruebas incluye varios endpoints para probar diferentes aspectos del sistema de notificaciones, **sin requerir acceso a Supabase**:

1. Inicia el servidor de pruebas:
   ```bash
   node test-server.js
   ```

2. Accede a los endpoints disponibles:
   - `GET /status` - Verificar el estado del servidor
   - `GET /test-notification` - Probar la detección y envío de notificaciones
   - `GET /test-process-message` - Probar el procesamiento de mensajes con verificación de notificación
   - `POST /test-complete-flow` - Probar flujo completo de mensajes con simulación de integración con base de datos

### Usando el servidor de pruebas con Supabase

Si necesitas probar con conexión real a Supabase, puedes usar estas variables de entorno:

```bash
SUPABASE_URL=https://wscijkxwevgxbgwhbqtm.supabase.co \
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTgyMjc2OCwiZXhwIjoyMDU3Mzk4NzY4fQ.eAMYqHQ5ma_2tPXOwCYKw3tt_vERE0zhBj2xS1srv9M \
node test-server-with-supabase.js
```

### Usando la interfaz web

Una interfaz de prueba basada en web está disponible:

1. Abre `test-notifications.html` en tu navegador
2. La interfaz proporciona tres modos de prueba:
   - **Prueba simple**: Probar la detección de notificaciones para un mensaje específico
   - **Flujo completo**: Probar el flujo completo de mensajes con simulación de base de datos
   - **Reporte de métricas**: Generar informes de rendimiento para el sistema de notificaciones

### Usando la línea de comandos

El script `test-notification-metrics.js` realiza pruebas completas:

```bash
node test-notification-metrics.js --count=20 --notify-ratio=0.5 --detailed=true
```

Opciones:
- `--count`: Número de mensajes de prueba a procesar (por defecto: 10)
- `--notify-ratio`: Proporción de mensajes que deberían activar notificaciones (0-1, por defecto: 0.5)
- `--detailed`: Generar registros detallados para cada prueba (por defecto: false)
- `--report`: Guardar un archivo de informe con resultados (por defecto: true)

## Personalizando las frases activadoras

Para personalizar las frases que activan notificaciones, edita el objeto `ATTENTION_PHRASES` en `notification-patch.js`:

```javascript
const ATTENTION_PHRASES = {
  // Frases del bot que indican necesidad de atención humana
  BOT: [
    "no puedo ayudarte con eso",
    "necesitarás hablar con un agente humano",
    // Añade más frases aquí
  ],
  
  // Frases de usuarios que pueden indicar urgencia o frustración
  USER: [
    "hablar con humano",
    "hablar con persona",
    // Añade más frases aquí
  ]
};
```

## Solución de problemas

### Problemas con el envío de correos

Si las notificaciones no se están enviando:

1. Verifica la configuración SMTP en el archivo `.env`
2. Comprueba que los correos de destinatarios estén configurados correctamente
3. Busca mensajes de error en los registros del servidor
4. Prueba la configuración de correo usando el endpoint `/test-notification`

### Problemas con la detección de notificaciones

Si las notificaciones no se están detectando correctamente:

1. Revisa las frases activadoras en `notification-patch.js`
2. Usa la interfaz de prueba para verificar la detección de frases
3. Verifica los registros del servidor para cualquier error en el proceso de notificación

### Errores de Supabase

Si enfrentas problemas con la conexión a Supabase:

1. Verifica que las claves de Supabase estén correctamente configuradas en el archivo `.env`
2. Utiliza el servidor de pruebas sin Supabase (`test-server.js`) para probar la funcionalidad básica
3. Asegúrate de que la estructura de la base de datos incluya las tablas necesarias para las notificaciones

## Personalización avanzada

### Plantillas de correo personalizadas

Para personalizar la plantilla de correo, modifica la variable `emailHtml` en la función `sendBusinessNotification` de `notification-patch.js`:

```javascript
const emailHtml = `
  <html>
  <head>
    <style>
      /* Tu CSS personalizado aquí */
    </style>
  </head>
  <body>
    <!-- Tu plantilla HTML personalizada aquí -->
  </body>
  </html>
`;
```

### Integración con base de datos

El sistema de notificaciones registra todos los intentos de notificación en la base de datos Supabase. Asegúrate de que la tabla `notifications` tenga las siguientes columnas:

- `conversation_id` (texto): El ID de la conversación
- `phone_number` (texto): El número de teléfono del cliente
- `message` (texto): El mensaje que activó la notificación
- `email_sent` (booleano): Si el correo se envió correctamente
- `email_recipients` (texto): Lista de destinatarios del correo
- `message_id` (texto): ID del mensaje de correo para envíos exitosos
- `error_message` (texto): Mensaje de error para intentos fallidos
- `created_at` (timestamp): Cuándo se creó la notificación

## Licencia

Este sistema de notificaciones es propiedad y parte de la aplicación de bot de WhatsApp.

---

Para obtener más ayuda, ponte en contacto con el equipo de desarrollo. 