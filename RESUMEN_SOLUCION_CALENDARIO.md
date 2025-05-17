# Solución de Integración de Google Calendar entre Frontend y Backend

## Problema identificado

Identificamos que el frontend estaba intentando comunicarse directamente con Supabase para obtener información y estados de Google Calendar, cuando en realidad esta comunicación debe hacerse a través del backend (nodo index.js en puerto 3095).

## Solución implementada

1. **Nuevos endpoints en el backend**: 
   - `/api/calendar/status` - Verificar el estado de integración con Google Calendar
   - `/api/calendar/availability` - Obtener disponibilidad de un día o mes
   - `/api/calendar/auth` - Iniciar el flujo de autenticación con Google

2. **Implementación de nuevos endpoints proxy en el frontend**:
   - Rutas API en Next.js que redirigen las peticiones al backend
   - Componentes que usan estas nuevas rutas en lugar de acceder directamente a Supabase

## Pasos para la implementación

### En el backend (ya implementado)

Se han añadido todos los endpoints necesarios:
- ✅ `/api/calendar/status` - GET - Verificar estado
- ✅ `/api/calendar/availability` - POST - Consultar disponibilidad
- ✅ `/api/calendar/auth` - POST - Configurar calendario

### En el frontend (pendiente de implementar)

1. **Crear rutas API de proxy**:
   - Copiar los archivos de `frontend-examples` a la estructura de carpetas correspondiente
   - Implementar las rutas API:
     - `app/api/calendar/status/route.ts`
     - `app/api/calendar/availability/route.ts`
     - `app/api/calendar/auth/route.ts`

2. **Configurar la URL del backend**:
   - Añadir `BACKEND_URL` al archivo `.env.local` del frontend:
     ```
     # Desarrollo
     BACKEND_URL=http://localhost:3095
     
     # Producción (con la URL actual de ngrok)
     # BACKEND_URL=https://98a4-2806-2f0-93a1-8882-a99d-baa-72f9-4d88.ngrok-free.app
     ```

3. **Actualizar componentes**:
   - Modificar los componentes que usan Google Calendar para que utilicen las nuevas rutas API
   - Eliminar cualquier acceso directo a Supabase para operaciones de calendario

## Verificación

1. Para comprobar que todo funcione:
   - El backend está correctamente configurado y funcionando en el puerto 3095
   - Los endpoints devuelven respuestas correctas (ya probados)
   - El frontend debe redirigir todas las peticiones de calendario al backend

2. Pruebas específicas:
   - La configuración de Google Calendar funciona correctamente
   - Se muestra el estado de integración correctamente
   - Se puede ver la disponibilidad del calendario

## Errores solucionados

1. ✅ Error 400 en la petición a Supabase
2. ✅ Error 500 en los endpoints de calendario del frontend
3. ✅ Problema de acceso a las tablas de configuración de calendario

## Arquitectura final

```
FRONTEND (Next.js - Puerto 3005)
  |
  ├── app/api/calendar/* (Rutas proxy)
  |     |
  |     └── Redirige solicitudes
  |           |
  V           V
BACKEND (Node.js - Puerto 3095)
  |
  ├── /api/calendar/* (Endpoints)
  |     |
  |     └── Accede a Supabase y Google
  |           |
  V           V
SUPABASE (Base de datos)
  |
  ├── business_config (Tabla)
  |     |
  |     └── Almacena tokens y configuración
  |
  V
GOOGLE CALENDAR API
```

## Observaciones finales

- La comunicación directa con Supabase desde el frontend solo debe usarse para otros propósitos (autenticación, etc.), no para operaciones de calendario.
- Los tokens de Google Calendar deben permanecer seguros en el backend.
- Las actualizaciones de configuración de Google Calendar deben hacerse siempre a través del backend. 