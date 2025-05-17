/**
 * Script para actualizar las credenciales de Google OAuth en el archivo .env
 * Este script ayuda a corregir la configuración de Google Calendar
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Crear interfaz para interactuar con el usuario
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function updateGoogleOAuthCredentials() {
  console.log('🔄 Actualización de credenciales de Google OAuth');
  console.log('-'.repeat(70));
  
  // Leer el archivo .env actual
  let envPath = path.join(process.cwd(), '.env');
  
  if (!fs.existsSync(envPath)) {
    console.error('❌ No se encontró el archivo .env en el directorio actual');
    console.log('Creando un nuevo archivo .env...');
    
    try {
      fs.writeFileSync(envPath, '', 'utf8');
    } catch (err) {
      console.error('Error al crear el archivo .env:', err);
      process.exit(1);
    }
  }
  
  let envContent = fs.readFileSync(envPath, 'utf8');
  let envLines = envContent.split('\n');
  
  // Preguntar por las credenciales de Google OAuth
  try {
    // Google Client ID
    const clientId = await question('Ingresa el GOOGLE_CLIENT_ID: ');
    updateEnvVariable(envLines, 'GOOGLE_CLIENT_ID', clientId);
    
    // Google Client Secret
    const clientSecret = await question('Ingresa el GOOGLE_CLIENT_SECRET: ');
    updateEnvVariable(envLines, 'GOOGLE_CLIENT_SECRET', clientSecret);
    
    // Google Redirect URI
    const redirectUriDefault = 'http://localhost:3095/google-auth-callback';
    const redirectUri = await question(`Ingresa el GOOGLE_REDIRECT_URI (Enter para usar ${redirectUriDefault}): `);
    updateEnvVariable(envLines, 'GOOGLE_REDIRECT_URI', redirectUri.trim() || redirectUriDefault);
    
    // Guardar los cambios
    fs.writeFileSync(envPath, envLines.join('\n'), 'utf8');
    
    console.log('-'.repeat(70));
    console.log('✅ Credenciales actualizadas correctamente en el archivo .env');
    console.log('\nImportante: Asegúrate de que estas credenciales sean válidas y estén');
    console.log('correctamente configuradas en la consola de Google Cloud Platform:');
    console.log('https://console.cloud.google.com/apis/credentials');
    
    // Mostrar instrucciones adicionales
    console.log('\nPara completar la configuración:');
    console.log('1. Ve a Google Cloud Console');
    console.log('2. Configura Pantalla de consentimiento de OAuth');
    console.log('3. Añade ámbitos para Google Calendar API');
    console.log('4. Agrega la URI de redirección configurada:', redirectUri.trim() || redirectUriDefault);
  } catch (error) {
    console.error('❌ Error al actualizar credenciales:', error);
  } finally {
    rl.close();
  }
}

// Función para actualizar o añadir una variable de entorno
function updateEnvVariable(lines, key, value) {
  const regex = new RegExp(`^${key}=.*$`);
  const newLine = `${key}=${value}`;
  
  const index = lines.findIndex(line => regex.test(line));
  
  if (index !== -1) {
    // Actualizar la variable existente
    lines[index] = newLine;
  } else {
    // Añadir la variable si no existe
    lines.push(newLine);
  }
}

// Función para hacer preguntas al usuario
function question(query) {
  return new Promise(resolve => {
    rl.question(query, answer => {
      resolve(answer);
    });
  });
}

// Ejecutar el script
updateGoogleOAuthCredentials(); 