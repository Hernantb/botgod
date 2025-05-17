# Solución para el Error de API GupShup

## Problema detectado

El bot de WhatsApp estaba experimentando problemas al enviar mensajes a través de la API de GupShup, mostrando el siguiente error:

```
❌ Error en la llamada a la API de GupShup: Request failed with status code 401
🔍 Detalles del error: 401 "Portal User Not Found With APIKey"
```

Después de una investigación exhaustiva, se detectaron dos problemas principales:

1. **URL incorrecta del endpoint**: Se estaba utilizando `/sm/api/v1/msg` en lugar de `/wa/api/v1/msg`
2. **Autenticación incompleta**: Solo se estaba enviando la API key, pero faltaba incluir el User ID en los headers

## Solución implementada

Para resolver estos problemas, se realizaron las siguientes correcciones:

1. **Cambio de la URL del endpoint**:
   - Se actualizó la URL de `https://api.gupshup.io/sm/api/v1/msg` a `https://api.gupshup.io/wa/api/v1/msg`
   - Esta URL es específica para la API de WhatsApp de GupShup

2. **Inclusión del User ID en los headers**:
   - Se añadió el header `userid` con el valor de `GUPSHUP_USERID` junto con el header `apikey`
   - Esta combinación de autenticación es necesaria para que GupShup valide correctamente la solicitud

3. **Formato correcto del mensaje**:
   - Se aseguró que el mensaje se enviara en formato JSON estructurado:
   ```js
   JSON.stringify({
     type: 'text',
     text: mensaje
   })
   ```

## Verificación de la solución

Se crearon scripts de prueba para validar las correcciones:

1. **test-gupshup.js**: Verifica la conexión con la URL correcta
2. **test-auth.js**: Prueba diferentes combinaciones de autenticación
3. **apply-fixes.js**: Script para aplicar automáticamente todas las correcciones necesarias

Todas las pruebas fueron exitosas, confirmando que las correcciones resuelven el problema.

## Cómo actualizar el servidor

Para aplicar estas correcciones en el servidor de producción (Render):

1. Ejecutar el script de correcciones en el servidor:
   ```
   node apply-fixes.js
   ```

2. Reiniciar el servidor para que los cambios surtan efecto:
   ```
   npm restart
   ```

3. Probar el envío de mensajes a través de la API:
   ```
   node send-message.js 5212221192568 "Prueba después de actualización"
   ```

## Credenciales correctas

Las credenciales para GupShup deben incluir:

```
GUPSHUP_API_KEY=sk_58a31041fdeb4d98b9f0e073792a6e6b
GUPSHUP_NUMBER=15557033313
GUPSHUP_USERID=crxty1qflktvwvm7sodtrfe9dpvoowm1
```

Asegúrese de que estas tres variables estén correctamente configuradas en su archivo `.env` y en las variables de entorno del servidor Render.

## Notas adicionales

- Si experimenta problemas, verifique la conexión con GupShup ejecutando el script `test-gupshup.js`
- Las pruebas detalladas demostraron que la combinación de `apikey` y `userid` en los headers es la que funciona consistentemente
- Este problema solo afectaba al envío de mensajes, no a la recepción ni al procesamiento con OpenAI 