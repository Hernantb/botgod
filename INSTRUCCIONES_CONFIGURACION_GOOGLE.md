# Configuración de la Integración con Google Calendar

## Solución implementada

Hemos realizado los siguientes cambios para solucionar los problemas de conexión con Google Calendar:

1. **Actualización de Credenciales de Google OAuth:**
   - Extraídas del archivo JSON de cliente de Google
   - Configuradas en el archivo `.env` del proyecto backend

2. **Corrección de rutas de redirección:**
   - Creada una ruta proxy en el frontend (`app/api/google-auth/route.js`)
   - El backend ahora envía URLs completas al frontend

3. **Actualización de variables de entorno:**
   - `GOOGLE_CLIENT_ID=<YOUR_CLIENT_ID>`
   - `GOOGLE_CLIENT_SECRET=<YOUR_CLIENT_SECRET>`
   - `GOOGLE_REDIRECT_URI=http://localhost:3095/google-auth-callback`

## Configuración en Google Cloud Console

Para completar la configuración, debes realizar estos pasos en la consola de Google Cloud:

1. **Accede a Google Cloud Console**: 
   - [https://console.cloud.google.com](https://console.cloud.google.com)

2. **Configura las credenciales de OAuth:**
   - Navega a "APIs y servicios" > "Credenciales"
   - Selecciona tu aplicación OAuth cliente
   - En la sección "URIs de redirección autorizados", añade:
     - `http://localhost:3095/google-auth-callback`
   - Guarda los cambios

3. **Configura la pantalla de consentimiento:**
   - Navega a "APIs y servicios" > "Pantalla de consentimiento de OAuth"
   - Asegúrate de tener configurado un nombre de aplicación
   - Añade el ámbito: `https://www.googleapis.com/auth/calendar`

4. **Habilita la API de Google Calendar:**
   - Navega a "APIs y servicios" > "Biblioteca"
   - Busca "Google Calendar API"
   - Asegúrate de que esté habilitada

## Verificación del funcionamiento

Después de realizar estos cambios:

1. **Reinicia el servidor backend:**
   ```bash
   PORT=3095 node index.js
   ```

2. **Prueba la conexión con Google Calendar:**
   - Accede a la sección de Gestión de Google Calendar
   - Haz clic en "Conectar Google Calendar"
   - Deberías ser redirigido a Google para autorizar la aplicación
   - Después de autorizar, volverás a la aplicación y verás el estado "Conectado"

## Solución de problemas

Si continúas viendo errores:

1. **Verifica los logs del servidor backend:**
   - Busca errores relacionados con Google OAuth o Calendar

2. **Asegúrate de que las URIs de redirección coincidan exactamente:**
   - La URI en Google Cloud Console debe ser `http://localhost:3095/google-auth-callback`
   - La variable `GOOGLE_REDIRECT_URI` en `.env` debe tener el mismo valor

3. **Verifica los ámbitos de la API:**
   - Asegúrate de que el ámbito `https://www.googleapis.com/auth/calendar` esté configurado

4. **Flujo de autenticación:**
   - Frontend (`/api/google-auth`) → Backend (`/api/google-auth`) → Google OAuth → Backend (`/google-auth-callback`) → Frontend (éxito)

## Para entornos de producción

En un entorno de producción, deberás:

1. Añadir también la URL de redirección de producción en la consola de Google Cloud
2. Actualizar `GOOGLE_REDIRECT_URI` en el archivo `.env` con la URL de producción

## Archivos relevantes creados/modificados

- `update-google-credentials.js` - Script para actualizar credenciales
- `fix-frontend-route.js` - Script para crear ruta proxy
- `fix-calendar-redirect.js` - Script para corregir redirección
- `app/api/google-auth/route.js` - Ruta proxy en frontend 