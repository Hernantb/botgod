# Solución al Error 404 en Conexión de Google Calendar

## Problema identificado
Cuando se hace clic en el botón "Conectar Google Calendar", la aplicación redirige a una página 404 debido a rutas incorrectas entre el frontend y el backend.

## Cambios implementados

### 1. Creación de ruta proxy en el frontend:
- Hemos creado una ruta proxy en el frontend (`app/api/google-auth/route.js`) que redirige correctamente al backend.
- Este proxy recibe la solicitud en el frontend y la reenvía al backend, evitando el error 404.

### 2. Corrección de URL en el backend:
- Hemos modificado el endpoint `/api/calendar/auth` en el backend para que devuelva URLs completas en lugar de relativas.
- Ahora el backend utiliza la URL del host actual para construir la URL de redirección.

### 3. Configuración de variables de entorno:
- Se han actualizado las variables de entorno para asegurar que las URL utilizadas sean correctas.
- Se ha añadido `BACKEND_URL=http://localhost:3095` a los archivos de configuración.

## Cómo verificar que la solución funciona

1. Asegúrate de que el servidor backend esté en ejecución:
   ```
   PORT=3095 node index.js
   ```

2. Inicia el servidor frontend (Next.js).

3. Navega a la sección de Gestión de Google Calendar.

4. Haz clic en el botón "Conectar Google Calendar" - ahora deberías ser redirigido correctamente al proceso de autenticación de Google sin ver un error 404.

## Estructura de archivos creados/modificados

- `app/api/google-auth/route.js` (NUEVO) - Maneja la redirección en el frontend
- `fix-frontend-route.js` - Script usado para crear la ruta proxy
- `fix-env-url.js` - Script para configurar las variables de entorno
- `fix-calendar-redirect.js` - Script que corrigió el problema de redirección en el backend

## Notas adicionales

- Para entornos de producción, asegúrate de configurar correctamente `BACKEND_URL` con la URL pública de tu backend.
- La solución permite que el frontend rediriga correctamente al backend, y luego el backend redirige a Google para la autenticación.
- Después de completar la autenticación, Google redirige de vuelta al backend en la ruta `/google-auth-callback`.

## Troubleshooting

Si aún encuentras problemas:

1. Verifica los logs del servidor backend para asegurarte de que las solicitudes lleguen correctamente.
2. Comprueba que las variables de entorno `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` estén configuradas con valores válidos.
3. Asegúrate de que la variable `GOOGLE_REDIRECT_URI` coincida exactamente con la URL configurada en la consola de Google Cloud.
4. Si el problema persiste, reinicia tanto el servidor frontend como el backend.

## Diagrama de flujo de autenticación corregido

```
Frontend (Next.js)
    |
    v
app/api/google-auth [proxy] ---> Backend /api/google-auth
                                     |
                                     v
                                 Google OAuth
                                     |
                                     v
                              /google-auth-callback [backend]
                                     |
                                     v
                                 Frontend [exito]
```

Con esta estructura, evitamos el error 404 que aparecía cuando el frontend intentaba acceder directamente a `/api/google-auth`. 