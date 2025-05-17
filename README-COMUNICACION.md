# Guía de Comunicación entre Frontend y Backend

Este documento explica la arquitectura de comunicación entre los diferentes componentes del sistema WhatsApp Bot.

## Diagrama de Comunicación (ACTUALIZADO)

```
+----------------+                  +------------------+       +-----------------+
|                |                  |                  |       |                 |
|   FRONTEND     | <--------------> |  BACKEND LOCAL   | <---> |   API GUPSHUP   |
|  localhost:    |                  | localhost:3095   |       |                 |
|  3000/3005     |                  |                  |       |                 |
+----------------+                  +------------------+       +-----------------+
                                           |
                                           v
                                    +-----------------+
                                    |                 |
                                    |    SUPABASE     |
                                    |                 |
                                    +-----------------+
```

## URLs y Puertos

### Desarrollo Local

- **Frontend**: 
  - URL: `http://localhost:3000` o `http://localhost:3005` (dependiendo del framework)
  - Puerto: 3000 o 3005

- **Backend Local**: 
  - URL: `http://localhost:3095`
  - Puerto: 3095
  - Script: `npm run start:dev`

### Producción

- **Frontend**:
  - URL: `https://whatsapp-bot-ifz.vercel.app` (o el dominio final)

- **Backend**:
  - URL: `https://whatsapp-bot-ifz.onrender.com` (o el dominio final)
  - También accesible vía ngrok durante desarrollo para pruebas con Gupshup

## Flujo de Comunicación

### 1. Conexión Frontend-Backend

El frontend se conecta directamente al backend local (puerto 3095). Esto permite:

- Simplicidad en la arquitectura
- Comunicación directa sin intermediarios
- Reducción de la complejidad del sistema

### 2. API de WhatsApp

- **Enviar mensajes**: El frontend envía solicitudes a `/api/send-manual-message` directamente al backend
- **Recibir mensajes**: Gupshup envía solicitudes a `/webhook` del backend (a través de ngrok en desarrollo)
- **Ver historial**: El frontend consulta a `/api/conversations` directamente al backend

### 3. API de Calendario

Las rutas de calendario están implementadas en el backend (Express.js) y se acceden directamente:

- **Verificar estado**: `GET /api/calendar/status?id=BUSINESS_ID`
- **Consultar disponibilidad**: `POST /api/calendar/availability` (con `businessId` y `month` o `date`)
- **Autenticación**: `POST /api/calendar/auth` (con `businessId`)

## Rutas de Calendario (Implementación)

El backend implementa las siguientes rutas para la gestión del calendario:

### 1. Verificar Estado del Calendario
- **Método**: GET
- **Ruta**: `/api/calendar/status`
- **Parámetros**: `id` o `business_id` (query)
- **Respuesta**:
```json
{
  "success": true,
  "status": {
    "enabled": true,
    "hasToken": true,
    "lastUpdated": "2023-05-15T10:30:00Z"
  }
}
```

### 2. Consultar Disponibilidad
- **Método**: POST
- **Ruta**: `/api/calendar/availability`
- **Cuerpo**:
```json
{
  "businessId": "2d385aa5-40e0-4ec9-9360-19281bc605e4",
  "month": "2023-05"  // O "date": "2023-05-15" para un día específico
}
```
- **Respuesta**:
```json
{
  "success": true,
  "available_slots": [
    "09:00", "10:00", "11:00"
  ],
  "busy_slots": [
    "12:00", "13:00"
  ]
}
```

### 3. Autenticación con Google Calendar
- **Método**: POST
- **Ruta**: `/api/calendar/auth`
- **Cuerpo**:
```json
{
  "businessId": "2d385aa5-40e0-4ec9-9360-19281bc605e4"
}
```
- **Respuesta**:
```json
{
  "success": true,
  "authUrl": "https://accounts.google.com/o/oauth2/auth?...",
  "message": "Por favor autoriza el acceso al calendario usando esta URL"
}
```

## Solución de Problemas

### Errores comunes:

1. **Error 404 en rutas de calendario**:
   - Asegúrate de que el backend esté corriendo en el puerto 3095
   - Comprueba que las rutas de calendario estén correctamente implementadas en el backend

2. **Error CORS**:
   - Verifica que el origen del frontend (puerto 3000 o 3005) esté permitido en la configuración CORS del backend
   - Los errores de CORS aparecerán en la consola del navegador

## Recomendaciones

1. Siempre inicia los servicios en este orden:
   - Backend: `npm run start:dev`
   - Frontend: `npm run dev` (en directorio frontend)

2. Para pruebas con WhatsApp:
   - Inicia ngrok: `ngrok http 3095`
   - Actualiza la URL webhook en Gupshup con la URL de ngrok

## Comandos para Iniciar Servicios

### Iniciar Backend Local

```bash
PORT=3095 node index.js
```

### Exponer Backend a Internet (para pruebas con GupShup)

```bash
ngrok http 3095
```

## Ejemplo de Configuración Frontend

Si estás usando Axios:

```javascript
// Para desarrollo local
const API_URL = 'http://localhost:3095';

// Para producción 
// const API_URL = 'https://whatsapp-bot-ifz.onrender.com';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Ejemplo de uso
const sendMessage = async (phone, message) => {
  try {
    const response = await api.post('/api/send-manual-message', {
      phone,
      message
    });
    return response.data;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};
```

## Paquetes Necesarios

Para la gestión de CORS y logs, asegúrate de instalar estos paquetes:

```bash
npm install cors express morgan
``` 