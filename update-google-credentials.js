/**
 * Script para actualizar las credenciales de Google OAuth en el .env
 * usando los valores del archivo client_secret
 */

const fs = require('fs');
const path = require('path');

async function main() {
  console.log('🔑 Actualizando credenciales de Google OAuth en .env');
  console.log('-'.repeat(70));
  
  try {
    // 1. Leer el archivo de credenciales
    const clientSecretPath = path.join(process.cwd(), 'client_secret_536656318902-7mrvub5e8j7ncqtd2one6a3g239m291o.apps.googleusercontent.com copy.json');
    
    if (!fs.existsSync(clientSecretPath)) {
      console.error('❌ No se encontró el archivo de credenciales de Google');
      process.exit(1);
    }
    
    const clientSecretContent = fs.readFileSync(clientSecretPath, 'utf8');
    const clientSecret = JSON.parse(clientSecretContent);
    
    if (!clientSecret.installed) {
      console.error('❌ Formato de archivo de credenciales incorrecto');
      process.exit(1);
    }
    
    const googleClientId = clientSecret.installed.client_id;
    const googleClientSecret = clientSecret.installed.client_secret;
    
    console.log('✅ Credenciales de Google OAuth leídas correctamente:');
    console.log(`- Client ID: ${googleClientId.substring(0, 20)}...`);
    console.log(`- Client Secret: ${googleClientSecret.substring(0, 10)}...`);
    
    // 2. Actualizar el archivo .env
    const envPath = path.join(process.cwd(), '.env');
    
    if (!fs.existsSync(envPath)) {
      console.log('❌ No se encontró el archivo .env');
      console.log('Creando archivo .env con las credenciales...');
      const envContent = `***REMOVED***=${googleClientId}\n***REMOVED***=${googleClientSecret}\nGOOGLE_REDIRECT_URI=http://localhost:3095/google-auth-callback\n`;
      fs.writeFileSync(envPath, envContent, 'utf8');
      console.log('✅ Archivo .env creado correctamente');
    } else {
      console.log('✅ Archivo .env encontrado, actualizando credenciales...');
      
      let envContent = fs.readFileSync(envPath, 'utf8');
      const lines = envContent.split('\n');
      let updatedLines = [];
      let clientIdUpdated = false;
      let clientSecretUpdated = false;
      let redirectUriExists = false;
      
      // Actualizar líneas existentes
      for (const line of lines) {
        if (line.startsWith('***REMOVED***=')) {
          updatedLines.push(`***REMOVED***=${googleClientId}`);
          clientIdUpdated = true;
        } else if (line.startsWith('***REMOVED***=')) {
          updatedLines.push(`***REMOVED***=${googleClientSecret}`);
          clientSecretUpdated = true;
        } else if (line.startsWith('GOOGLE_REDIRECT_URI=')) {
          updatedLines.push('GOOGLE_REDIRECT_URI=http://localhost:3095/google-auth-callback');
          redirectUriExists = true;
        } else {
          updatedLines.push(line);
        }
      }
      
      // Añadir variables si no existen
      if (!clientIdUpdated) {
        updatedLines.push(`***REMOVED***=${googleClientId}`);
      }
      
      if (!clientSecretUpdated) {
        updatedLines.push(`***REMOVED***=${googleClientSecret}`);
      }
      
      if (!redirectUriExists) {
        updatedLines.push('GOOGLE_REDIRECT_URI=http://localhost:3095/google-auth-callback');
      }
      
      // Guardar cambios
      fs.writeFileSync(envPath, updatedLines.join('\n'), 'utf8');
      console.log('✅ Archivo .env actualizado correctamente');
    }
    
    // 3. Verificar si es necesario reiniciar el servidor
    console.log('\n🔍 Verificando si el servidor está en ejecución...');
    
    try {
      const response = await fetch('http://localhost:3095/health', { timeout: 3000 });
      if (response.ok) {
        console.log('⚠️ El servidor backend está en ejecución. Es necesario reiniciarlo para aplicar los cambios.');
        console.log('Ejecuta: PORT=3095 node index.js');
      } else {
        console.log('❌ El servidor backend no está respondiendo o no está en ejecución.');
        console.log('Puedes iniciar el servidor con: PORT=3095 node index.js');
      }
    } catch (error) {
      console.log('❌ El servidor backend no está en ejecución.');
      console.log('Puedes iniciar el servidor con: PORT=3095 node index.js');
    }
    
    // 4. Instrucciones finales
    console.log('\n✅ Credenciales actualizadas correctamente.');
    console.log('🔍 Nota importante sobre GOOGLE_REDIRECT_URI:');
    console.log('- Asegúrate que este URI esté configurado en la consola de Google Cloud');
    console.log('- URL configurada: http://localhost:3095/google-auth-callback');
    console.log('\nPara aplicar los cambios:');
    console.log('1. Detén el servidor backend si está en ejecución');
    console.log('2. Inicia el servidor con: PORT=3095 node index.js');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Función para simular un timeout en fetch
async function fetchWithTimeout(url, options = {}) {
  const { timeout = 3000 } = options;
  
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

// Ejecutar el script
main().catch(err => {
  console.error('Error general:', err);
}); 