# Integración con Google Calendar para Bot de WhatsApp

Este documento describe la integración del bot de WhatsApp con Google Calendar para permitir la consulta de disponibilidad y agendado de citas en tiempo real.

## Descripción General

El bot de WhatsApp ahora puede interactuar con Google Calendar para:

1. **Consultar disponibilidad**: Verificar horarios disponibles en una fecha específica.
2. **Agendar citas**: Crear eventos en el calendario asociado al negocio.
3. **Buscar citas**: Encontrar citas programadas para un cliente específico.
4. **Cancelar citas**: Eliminar eventos del calendario.

## Funciones Implementadas

### 1. Consulta de Disponibilidad

```javascript
check_calendar_availability(businessId, date)
```

- **Descripción**: Verifica qué horarios están disponibles en una fecha específica.
- **Parámetros**: 
  - `businessId`: ID del negocio asociado al calendario (string/UUID)
  - `date`: Fecha en formato YYYY-MM-DD (string)
- **Respuesta**: Objeto JSON con los horarios disponibles.

### 2. Creación de Citas

```javascript
create_calendar_event(businessId, eventDetails)
```

- **Descripción**: Crea un evento (cita) en el calendario del negocio.
- **Parámetros**:
  - `businessId`: ID del negocio (string/UUID)
  - `eventDetails`: Objeto con detalles del evento:
    - `date`: Fecha de la cita (YYYY-MM-DD)
    - `time`: Hora de la cita (HH:MM o simplemente la hora)
    - `phone`: Teléfono del cliente
    - `name`: Nombre del cliente (opcional)
    - `email`: Email del cliente (opcional)
    - `title`: Título de la cita (opcional)
    - `description`: Descripción adicional (opcional)
    - `location`: Ubicación de la cita (opcional)
- **Respuesta**: Objeto JSON con la información del evento creado, incluyendo su ID.

### 3. Búsqueda de Citas

```javascript
find_customer_appointments(businessId, phoneNumber)
```

- **Descripción**: Busca todas las citas programadas para un cliente por su número de teléfono.
- **Parámetros**:
  - `businessId`: ID del negocio (string/UUID)
  - `phoneNumber`: Número de teléfono del cliente (string)
- **Respuesta**: Array de objetos representando las citas encontradas.

### 4. Cancelación de Citas

```javascript
delete_calendar_event(businessId, eventId)
```

- **Descripción**: Elimina un evento del calendario (cancela una cita).
- **Parámetros**:
  - `businessId`: ID del negocio (string/UUID)
  - `eventId`: ID del evento a eliminar (string)
- **Respuesta**: Objeto JSON indicando el éxito de la operación.

## Configuración de Base de Datos

Se ha creado una tabla `calendar_events` para almacenar las referencias a los eventos de Google Calendar:

```sql
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  event_id TEXT NOT NULL, -- ID del evento en Google Calendar
  customer_phone TEXT NOT NULL, -- Número de teléfono del cliente
  customer_name TEXT, -- Nombre del cliente (opcional)
  event_date DATE NOT NULL, -- Fecha del evento
  event_time TEXT NOT NULL, -- Hora del evento (HH:MM)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  canceled BOOLEAN DEFAULT FALSE, -- Flag para marcar si la cita fue cancelada
  canceled_at TIMESTAMPTZ -- Cuándo se canceló la cita
);
```

## Ejemplo de Uso (Flujo Conversacional)

El bot está configurado para utilizar estas funciones automáticamente. Cuando un cliente hace preguntas sobre disponibilidad o quiere agendar una cita, el asistente de OpenAI llamará a las funciones correspondientes.

### Ejemplos de conversación:

**Cliente**: ¿Qué horarios tienen disponibles para mañana?

**Bot**: *[Llamada a check_calendar_availability]* Para mañana tenemos disponibilidad a las 10:00, 14:00 y 16:00. ¿Te gustaría agendar una cita en alguno de estos horarios?

**Cliente**: Sí, a las 2 de la tarde

**Bot**: *[Llamada a create_calendar_event]* ¡Perfecto! Tu cita ha sido confirmada para mañana a las 14:00. Te esperamos. Si necesitas cambiar o cancelar tu cita, por favor házmelo saber.

## Consideraciones Técnicas

1. **Autenticación**: La integración utiliza el refresh token almacenado en la tabla `business_config` para cada negocio.

2. **Manejo de errores**: Las funciones incluyen manejo completo de errores para evitar interrupciones en la conversación.

3. **Almacenamiento**: Se guarda una referencia de cada evento creado en la tabla `calendar_events` para facilitar búsquedas futuras.

4. **Verificación de disponibilidad**: Antes de crear un evento, siempre se verifica que el horario solicitado esté disponible.

## Instalación

1. Ejecutar el script SQL para crear la tabla `calendar_events`:
   ```bash
   psql -h <host> -d <database> -U <user> -f sql/add_calendar_events_table.sql
   ```

2. Asegurarse de que la tabla `business_config` tiene los campos necesarios para Google Calendar:
   ```bash
   psql -h <host> -d <database> -U <user> -f sql/add_google_calendar_fields.sql
   ```

3. Configurar las credenciales de OAuth para Google Calendar en el panel de administración.

## Solución de Problemas

Si el bot no puede conectarse a Google Calendar, verificar:

1. Que el negocio tenga `google_calendar_enabled` en `true` en la tabla `business_config`.
2. Que exista un `google_calendar_refresh_token` válido para el negocio.
3. Que las APIs estén respondiendo correctamente (verificar logs).
4. Que la variable de entorno `HOST_URL` esté configurada correctamente. 