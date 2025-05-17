/**
 * Script para corregir problemas de autenticación de GupShup
 * Basado en las soluciones encontradas en SOLUCION_API_GUPSHUP.md
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Credenciales correctas de GupShup según el archivo SOLUCION_API_GUPSHUP.md
const CORRECT_API_KEY = 'sk_58a31041fdeb4d98b9f0e073792a6e6b';
const CORRECT_NUMBER = '15557033313';
const CORRECT_USERID = 'crxty1qflktvwvm7sodtrfe9dpvoowm1';

// URL correcta
const CORRECT_API_URL = 'https://api.gupshup.io/wa/api/v1/msg';

// Función para verificar las credenciales actuales
async function checkCurrentCredentials() {
  console.log('🔍 Verificando credenciales actuales...');
  
  // Verificar variables de entorno
  const envApiKey = process.env.GUPSHUP_API_KEY;
  const envNumber = process.env.GUPSHUP_NUMBER;
  const envUserId = process.env.GUPSHUP_USERID;
  
  console.log(`📊 Variables de entorno encontradas:`);
  console.log(`   - GUPSHUP_API_KEY: ${envApiKey ? `${envApiKey.substring(0, 5)}...` : 'No encontrada'}`);
  console.log(`   - GUPSHUP_NUMBER: ${envNumber || 'No encontrada'}`);
  console.log(`   - GUPSHUP_USERID: ${envUserId ? `${envUserId.substring(0, 5)}...` : 'No encontrada'}`);
  
  return {
    apiKeyCorrect: envApiKey === CORRECT_API_KEY,
    numberCorrect: envNumber === CORRECT_NUMBER,
    userIdCorrect: envUserId === CORRECT_USERID,
    envApiKey,
    envNumber,
    envUserId
  };
}

// Función para probar la conexión con las credenciales actualizadas
async function testConnection() {
  console.log('🧪 Probando conexión con GupShup...');
  
  const testNumber = '5212221192568'; // Número de prueba
  const message = 'Prueba de conexión con GupShup - Script de corrección';
  
  const formData = new URLSearchParams();
  formData.append('channel', 'whatsapp');
  formData.append('source', CORRECT_NUMBER);
  formData.append('destination', testNumber);
  formData.append('src.name', CORRECT_NUMBER);
  formData.append('message', JSON.stringify({
    type: 'text',
    text: message
  }));
  
  const headers = {
    'Cache-Control': 'no-cache',
    'Content-Type': 'application/x-www-form-urlencoded',
    'apikey': CORRECT_API_KEY,
    'userid': CORRECT_USERID
  };
  
  console.log('📝 Configuración de la solicitud:');
  console.log(`   - URL: ${CORRECT_API_URL}`);
  console.log(`   - Headers: ${JSON.stringify({
    'Cache-Control': 'no-cache',
    'Content-Type': 'application/x-www-form-urlencoded',
    'apikey': `${CORRECT_API_KEY.substring(0, 5)}...`,
    'userid': `${CORRECT_USERID.substring(0, 5)}...`
  })}`);
  
  try {
    const response = await axios.post(CORRECT_API_URL, formData, { headers });
    console.log('✅ Conexión exitosa!');
    console.log(`📡 Respuesta: ${JSON.stringify(response.data)}`);
    return true;
  } catch (error) {
    console.error('❌ Error al conectar con GupShup:');
    if (error.response) {
      console.error(`   - Código: ${error.response.status}`);
      console.error(`   - Mensaje: ${JSON.stringify(error.response.data)}`);
    } else {
      console.error(`   - ${error.message}`);
    }
    return false;
  }
}

// Función para buscar y corregir archivos que contienen la URL antigua de GupShup
async function fixGupshupUrls() {
  console.log('🔧 Buscando y corrigiendo URLs antiguas de GupShup...');
  
  const filesToCheck = [
    'whatsapp-sender.js',
    'send-message.js',
    'index.js',
    'server.js'
  ];
  
  const oldUrl = 'https://api.gupshup.io/sm/api/v1/msg';
  const newUrl = 'https://api.gupshup.io/wa/api/v1/msg';
  
  let filesFixed = 0;
  
  for (const fileName of filesToCheck) {
    const filePath = path.join(process.cwd(), fileName);
    
    if (!fs.existsSync(filePath)) {
      console.log(`   - 📄 ${fileName}: No encontrado`);
      continue;
    }
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    if (content.includes(oldUrl)) {
      content = content.replace(new RegExp(oldUrl, 'g'), newUrl);
      fs.writeFileSync(filePath, content);
      console.log(`   - 📄 ${fileName}: URL corregida ✅`);
      filesFixed++;
    } else {
      console.log(`   - 📄 ${fileName}: URL ya es correcta o no encontrada`);
    }
  }
  
  console.log(`🔄 URLs corregidas en ${filesFixed} archivos.`);
  return filesFixed;
}

// Función para buscar y corregir la falta de userid en los headers
async function fixMissingUserid() {
  console.log('🔧 Verificando que el userid esté incluido en los headers...');
  
  const filesToCheck = [
    'whatsapp-sender.js',
    'send-message.js',
    'index.js'
  ];
  
  let filesFixed = 0;
  
  for (const fileName of filesToCheck) {
    const filePath = path.join(process.cwd(), fileName);
    
    if (!fs.existsSync(filePath)) {
      console.log(`   - 📄 ${fileName}: No encontrado`);
      continue;
    }
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Buscar headers que tengan apikey pero no userid
    if (content.includes('apikey') && !content.includes('userid')) {
      // Esta es una solución simplificada. En un caso real, se necesitaría un análisis más detallado
      // del código para asegurarse de que estamos modificando correctamente el objeto de headers.
      content = content.replace(
        /'apikey': (.*?)(\s*?)(}|,)/g, 
        `'apikey': $1,\n    'userid': process.env.GUPSHUP_USERID || '${CORRECT_USERID}'$3`
      );
      
      fs.writeFileSync(filePath, content);
      console.log(`   - 📄 ${fileName}: userid añadido a los headers ✅`);
      filesFixed++;
    } else {
      console.log(`   - 📄 ${fileName}: userid ya está incluido o no aplicable`);
    }
  }
  
  console.log(`🔄 Headers corregidos en ${filesFixed} archivos.`);
  return filesFixed;
}

// Función para escribir o actualizar el archivo .env con las credenciales correctas
async function updateEnvFile() {
  console.log('🔧 Actualizando archivo .env con las credenciales correctas...');
  
  const envPath = path.join(process.cwd(), '.env');
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  
  // Actualizar o añadir GUPSHUP_API_KEY
  if (envContent.includes('GUPSHUP_API_KEY=')) {
    envContent = envContent.replace(/GUPSHUP_API_KEY=.*\n/, `GUPSHUP_API_KEY=${CORRECT_API_KEY}\n`);
  } else {
    envContent += `\nGUPSHUP_API_KEY=${CORRECT_API_KEY}`;
  }
  
  // Actualizar o añadir GUPSHUP_NUMBER
  if (envContent.includes('GUPSHUP_NUMBER=')) {
    envContent = envContent.replace(/GUPSHUP_NUMBER=.*\n/, `GUPSHUP_NUMBER=${CORRECT_NUMBER}\n`);
  } else {
    envContent += `\nGUPSHUP_NUMBER=${CORRECT_NUMBER}`;
  }
  
  // Actualizar o añadir GUPSHUP_USERID
  if (envContent.includes('GUPSHUP_USERID=')) {
    envContent = envContent.replace(/GUPSHUP_USERID=.*\n/, `GUPSHUP_USERID=${CORRECT_USERID}\n`);
  } else {
    envContent += `\nGUPSHUP_USERID=${CORRECT_USERID}`;
  }
  
  // Guardar el archivo .env actualizado
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Archivo .env actualizado correctamente.');
}

// Función principal que ejecuta todas las correcciones
async function main() {
  console.log('🚀 Iniciando corrección de problemas de autenticación de GupShup...');
  
  // Verificar credenciales actuales
  const credentialStatus = await checkCurrentCredentials();
  
  // Corregir URLs de GupShup
  const urlsFixed = await fixGupshupUrls();
  
  // Corregir falta de userid en los headers
  const headersFixed = await fixMissingUserid();
  
  // Actualizar archivo .env si es necesario
  if (!credentialStatus.apiKeyCorrect || !credentialStatus.numberCorrect || !credentialStatus.userIdCorrect) {
    await updateEnvFile();
  } else {
    console.log('✅ Las credenciales en el archivo .env son correctas.');
  }
  
  // Probar la conexión con las credenciales actualizadas
  const connectionSuccess = await testConnection();
  
  console.log('\n📋 Resumen de acciones:');
  console.log(`   - URLs corregidas: ${urlsFixed}`);
  console.log(`   - Headers corregidos: ${headersFixed}`);
  console.log(`   - Credenciales actualizadas: ${!credentialStatus.apiKeyCorrect || !credentialStatus.numberCorrect || !credentialStatus.userIdCorrect ? 'Sí' : 'No fue necesario'}`);
  console.log(`   - Prueba de conexión: ${connectionSuccess ? '✅ Exitosa' : '❌ Fallida'}`);
  
  if (connectionSuccess) {
    console.log('\n🎉 Corrección completada con éxito! Ahora puedes enviar mensajes a través de GupShup.');
  } else {
    console.log('\n⚠️ Se realizaron las correcciones, pero la prueba de conexión falló.');
    console.log('   Verifica manualmente los archivos y las credenciales, o contacta al soporte de GupShup.');
  }
}

// Ejecutar la función principal
main().catch(error => {
  console.error('❌ Error inesperado:', error);
  process.exit(1);
}); 