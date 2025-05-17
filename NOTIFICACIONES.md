# Sistema de Notificaciones por Correo

Este sistema permite enviar notificaciones por correo electrónico cuando el bot detecta frases específicas en sus respuestas, como confirmaciones de citas o asignación de asesores.

## Funcionamiento

Cuando el bot envía un mensaje que contiene ciertas frases predefinidas (confirmación de cita, asignación de asesor, etc.), se envía automáticamente un correo electrónico al negocio asociado con la conversación en la que se detectó la notificación.

### Flujo del proceso
1. El bot envía un mensaje al cliente
2. El mensaje se guarda en la base de datos
3. Se analiza el mensaje para detectar frases que requieren notificación
4. Si requiere notificación, se envía un correo al negocio
5. Se registra la notificación en la base de datos

## Configuración

### 1. Ejecutar el script de configuración

```bash
bash setup-notifications.sh
```

Este script te guiará para:
- Instalar las dependencias necesarias
- Configurar las variables de entorno para el correo electrónico
- Preparar el sistema para el envío de notificaciones

### 2. Configurar la base de datos

Ejecuta el siguiente script SQL en el panel de Supabase:

```bash
# Copiar el contenido de add_notification_columns.sql
# y pegarlo en el Editor SQL de Supabase
```

El script añade las columnas necesarias para el sistema de notificaciones:
- `notification_sent` y `notification_timestamp` en la tabla `conversations`
- `needs_notification` y `notification_sent` en la tabla `messages`
- Crea la tabla `notifications` si no existe

### 3. Probar las notificaciones

```bash
node test-notification-real.js
```

### 4. Configurar verificación periódica (opcional)

Para asegurarte de que ninguna notificación se quede sin enviar, puedes configurar una verificación periódica:

```bash
bash notification-scheduler.sh
```

Este script te permitirá programar la ejecución automática del verificador de notificaciones pendientes.

## Frases que activan notificaciones

El sistema detecta las siguientes categorías de frases:

### Confirmación de citas
- "tu cita ha sido confirmada"
- "hemos registrado tu cita"
- "perfecto, tu cita..."
- "cita confirmada para las..."

### Asignación de asesores
- "un asesor te llamará"
- "un representante se pondrá en contacto"
- "un agente te contactará"

### Otras frases relevantes
- Atención personalizada
- Solicitudes de espera
- Mensajes de seguimiento

## Solución de problemas

### El correo no se envía
1. Verifica las credenciales de correo en el archivo `.env`
2. Asegúrate de que estás usando una "contraseña de aplicación" de Gmail
3. Verifica los logs en `server.log` o mediante `console.log`

### Error de columnas en base de datos
1. Verifica que ejecutaste correctamente el script SQL
2. Ejecuta `/api/check-notification-columns` para verificar el estado de las columnas

### Notificaciones perdidas
1. Ejecuta manualmente el verificador de notificaciones:
```bash
node check-pending-notifications.js
```

## Archivos del sistema

- `server.js`: Contiene la lógica principal de notificaciones
- `setup-notifications.sh`: Script para configurar el sistema
- `add_notification_columns.sql`: Script SQL para preparar la base de datos
- `test-notification-real.js`: Script para probar el envío de notificaciones
- `check-pending-notifications.js`: Verificador de notificaciones pendientes
- `notification-scheduler.sh`: Configurador de tareas programadas 