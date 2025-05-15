# Instrucciones para la Integración de Google Calendar en el Frontend

Estas instrucciones describen cómo el frontend debe comunicarse con el backend para implementar la funcionalidad de Google Calendar.

## 1. Arquitectura General

La arquitectura correcta es la siguiente:

1. **Frontend (Next.js - Puerto 3005)**:
   - No debe comunicarse directamente con Supabase para las operaciones de calendario
   - Debe redirigir todas las solicitudes relacionadas con el calendario al backend
   - Puede seguir usando Supabase para otras funcionalidades (autenticación, etc.)

2. **Backend (Node.js - Puerto 3095)**:
   - Maneja todas las operaciones de Google Calendar
   - Almacena tokens y datos de configuración del calendario
   - Expone endpoints para que el frontend los consuma

## 2. Endpoints del Backend

### Estado del Calendario

**Endpoint**: `GET /api/calendar/status`

**Parámetros de consulta**:
- `id`: El ID del negocio (obligatorio)

**Ejemplo de uso**:
```javascript
const getCalendarStatus = async (businessId) => {
  try {
    console.log("[Calendar Status API] Consultando estado del calendario");
    
    const response = await fetch(`/api/calendar/status?id=${businessId}`);
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("[Calendar Status API] Error:", error);
    return { success: false, error: error.message };
  }
};
```

### Disponibilidad del Calendario

**Endpoint**: `POST /api/calendar/availability`

**Cuerpo de la solicitud**:
```json
{
  "businessId": "id-del-negocio",
  "month": "2025-05"  // Formato: YYYY-MM
}
```

o

```json
{
  "businessId": "id-del-negocio",
  "date": "2025-05-15"  // Formato: YYYY-MM-DD
}
```

**Ejemplo de uso**:
```javascript
const getMonthAvailability = async (businessId, month) => {
  try {
    console.log("[Calendar Availability API] Consultando disponibilidad del mes:", month);
    
    const response = await fetch(`/api/calendar/availability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId, month })
    });
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("[Calendar Availability API] Error:", error);
    return { success: false, error: error.message };
  }
};
```

### Autenticación de Google Calendar

**Endpoint**: `POST /api/calendar/auth`

**Cuerpo de la solicitud**:
```json
{
  "businessId": "id-del-negocio"
}
```

**Ejemplo de uso**:
```javascript
const configureGoogleCalendar = async (businessId) => {
  try {
    console.log("[Calendar Auth API] Iniciando configuración de Google Calendar");
    
    const response = await fetch(`/api/calendar/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId })
    });
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Redireccionar al usuario a la URL de autenticación de Google
    if (data.success && data.authUrl) {
      window.open(data.authUrl, '_blank', 'width=600,height=700');
    }
    
    return data;
  } catch (error) {
    console.error("[Calendar Auth API] Error:", error);
    return { success: false, error: error.message };
  }
};
```

## 3. Modificaciones necesarias en el frontend

1. **Eliminar cualquier acceso directo a Supabase** para operaciones relacionadas con el calendario

2. **Redirigir todas las solicitudes de calendario al backend** en lugar de a Supabase

3. **Actualizar los componentes de calendario** para usar los nuevos endpoints

4. **Verificar que la URL del backend es correcta**:
   - En desarrollo: `http://localhost:3095`
   - En producción: URL del backend (por ejemplo, la URL de ngrok)

## 4. Nota sobre los puertos

- **Frontend (Next.js)**: Puerto 3005
- **Backend (Node.js)**: Puerto 3095

Si estás usando un proxy, asegúrate de que esté configurado correctamente para redirigir las solicitudes al backend.

## 5. Ejemplo de implementación para el proxy

Si necesitas usar un proxy para redirigir las solicitudes, puedes usar el siguiente código en tus rutas API de Next.js:

```javascript
// app/api/calendar/status/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    console.log(`[Calendar Status API] Redirigiendo solicitud a backend: id=${id}`);
    
    // Redirigir al backend (ajusta la URL según corresponda)
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3095';
    const response = await fetch(`${backendUrl}/api/calendar/status?id=${id}`);
    
    if (!response.ok) {
      throw new Error(`Error en el backend: ${response.status}`);
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Calendar Status API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Error en la comunicación con el backend' }, 
      { status: 500 }
    );
  }
}
```

## 6. Solución de problemas

Si encuentras problemas:

1. **Verifica las consolas de errores** tanto en el frontend como en el backend
2. **Confirma que el servidor backend está ejecutándose** en el puerto 3095
3. **Asegúrate de que los CORS están configurados correctamente** en el backend
4. **Verifica que las URL en el frontend son correctas** y apuntan al backend
5. **Comprueba que los parámetros enviados son correctos** (especialmente el businessId)

## 7. Consideraciones finales

- Todas las operaciones que necesiten acceso a los tokens o datos de Google Calendar **deben realizarse en el backend**
- El frontend **no debe** acceder directamente a la tabla `business_config` para operaciones relacionadas con el calendario
- Las respuestas del backend siempre incluirán un campo `success` para indicar si la operación fue exitosa 