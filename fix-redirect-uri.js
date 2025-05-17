/**
 * Script para ayudar a configurar las URLs de redirección de Google OAuth
 * 
 * Este script muestra instrucciones para configurar correctamente
 * las URLs de redirección en la consola de Google Cloud.
 */

console.log('🔧 Configuración de URLs de redirección para Google OAuth');
console.log('-'.repeat(70));

console.log(`
Para que la autenticación con Google Calendar funcione correctamente,
es necesario configurar las URLs de redirección en la consola de Google Cloud.

Sigue estos pasos:

1. Inicia sesión en Google Cloud Console: https://console.cloud.google.com

2. Navega a "APIs y servicios" > "Credenciales"

3. Busca y selecciona tu aplicación OAuth cliente (ID: 536656318902-7mrvub5e8j7ncqtd2one6a3g239m291o.apps.googleusercontent.com)

4. En la sección "URIs de redirección autorizados", añade:
   - http://localhost:3095/google-auth-callback

5. Haz clic en "Guardar"

6. En la sección "Pantalla de consentimiento de OAuth", asegúrate de:
   - Tener configurado un nombre de aplicación
   - Tener añadido el ámbito: https://www.googleapis.com/auth/calendar

También asegúrate de que la API de Google Calendar esté habilitada:

1. Navega a "APIs y servicios" > "Biblioteca"
2. Busca "Google Calendar API"
3. Haz clic y asegúrate de que esté habilitada

Una vez completados estos pasos, podrás usar la autenticación de Google Calendar correctamente.
`);

console.log('-'.repeat(70));
console.log('✅ Recuerda reiniciar el servidor después de realizar estos cambios:');
console.log('PORT=3095 node index.js');

console.log(`
🔄 Verificación de credenciales:
- El archivo .env ya contiene las credenciales correctas
- El backend está configurado para usar la URL de redirección: http://localhost:3095/google-auth-callback
- El frontend redirige correctamente a través de la ruta proxy
`);

// Para entornos de producción
console.log(`
⚠️ Nota para entornos de producción:
Si planeas usar esta aplicación en producción, deberás:
1. Añadir también la URL de redirección de producción en la consola de Google Cloud
2. Actualizar GOOGLE_REDIRECT_URI en el archivo .env con la URL de producción
`); 