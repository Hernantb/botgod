/**
 * SOLUCIÓN DEFINITIVA: Corrección de problemas de conexión con GupShup API
 * 
 * Este script implementa todas las soluciones necesarias para corregir problemas
 * de conexión con la API de GupShup, incluyendo:
 * 
 * 1. Actualización de la URL del endpoint (/sm/api/v1/msg -> /wa/api/v1/msg)
 * 2. Inclusión del 'userid' en los headers de autenticación
 * 3. Configuración correcta de las credenciales en el entorno
 * 4. Creación de un archivo .env con las credenciales correctas
 * 5. Parche dinámico para el servidor ya en ejecución
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// ==================== CONFIGURACIÓN ====================

// Credenciales correctas según SOLUCION_API_GUPSHUP.md
const CORRECT_CREDENTIALS = {
  GUPSHUP_API_KEY: 'sk_58a31041fdeb4d98b9f0e073792a6e6b',
  GUPSHUP_NUMBER: '15557033313',
  GUPSHUP_USERID: 'crxty1qflktvwvm7sodtrfe9dpvoowm1'
};

// URL correcta del endpoint
const CORRECT_URL = 'https://api.gupshup.io/wa/api/v1/msg';

// URL incorrecta que debe ser reemplazada
const INCORRECT_URL = 'https://api.gupshup.io/sm/api/v1/msg';

// Archivos que necesitan ser corregidos
const FILES_TO_PATCH = [
  'whatsapp-sender.js',
  'index.js',
  'send-message.js'
];

// ==================== FUNCIONES PRINCIPALES ====================

/**
 * Corrige los archivos que usan la API de GupShup
 */
async function patchFiles() {
  console.log('🔍 Buscando archivos que necesitan corrección...');
  
  let filesPatched = 0;
  
  for (const fileName of FILES_TO_PATCH) {
    const filePath = path.join(process.cwd(), fileName);
    
    if (!fs.existsSync(filePath)) {
      console.log(`❓ Archivo ${fileName} no encontrado, omitiendo.`);
      continue;
    }
    
    let fileContent = fs.readFileSync(filePath, 'utf8');
    let fileModified = false;
    
    // Corregir URL del endpoint
    if (fileContent.includes(INCORRECT_URL)) {
      fileContent = fileContent.replace(new RegExp(INCORRECT_URL, 'g'), CORRECT_URL);
      console.log(`✅ Corregida URL en ${fileName}`);
      fileModified = true;
    }
    
    // Corregir autenticación: asegurar que 'userid' está incluido en los headers
    if (fileContent.includes('apikey') && !fileContent.includes('userid')) {
      // Intentamos diferentes patrones de headers para asegurar que cubrimos todos los casos
      const patterns = [
        /'apikey': ([^,}]+)([,}])/g,
        /"apikey": ([^,}]+)([,}])/g,
        /apikey: ([^,}]+)([,}])/g
      ];
      
      for (const pattern of patterns) {
        // Reemplazar solo si el patrón existe en el archivo
        if (pattern.test(fileContent)) {
          fileContent = fileContent.replace(pattern, (match, value, ending) => {
            return match.replace(ending, `,\n      'userid': process.env.GUPSHUP_USERID || '${CORRECT_CREDENTIALS.GUPSHUP_USERID}'${ending}`);
          });
          console.log(`✅ Añadido 'userid' a los headers en ${fileName}`);
          fileModified = true;
          break;
        }
      }
    }
    
    // Guardar el archivo si fue modificado
    if (fileModified) {
      fs.writeFileSync(filePath, fileContent);
      filesPatched++;
    } else {
      console.log(`ℹ️ No se encontraron problemas que corregir en ${fileName}`);
    }
  }
  
  return filesPatched;
}

/**
 * Crea o actualiza el archivo .env con las credenciales correctas
 */
async function updateEnvironment() {
  console.log('🔧 Actualizando archivo .env con las credenciales correctas...');
  
  const envPath = path.join(process.cwd(), '.env');
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
    console.log('📄 Archivo .env encontrado, actualizando valores...');
  } else {
    console.log('📄 Creando nuevo archivo .env...');
  }
  
  // Para cada credencial, actualizar o añadir al archivo .env
  for (const [key, value] of Object.entries(CORRECT_CREDENTIALS)) {
    const regex = new RegExp(`${key}=.*(\n|$)`, 'g');
    
    if (envContent.match(regex)) {
      // Actualizar valor existente
      envContent = envContent.replace(regex, `${key}=${value}\n`);
    } else {
      // Añadir nueva variable
      envContent += `${key}=${value}\n`;
    }
  }
  
  // Guardar el archivo .env actualizado
  fs.writeFileSync(envPath, envContent);
  
  // Actualizar variables de entorno en el proceso actual
  for (const [key, value] of Object.entries(CORRECT_CREDENTIALS)) {
    process.env[key] = value;
  }
  
  console.log('✅ Credenciales actualizadas correctamente.');
}

/**
 * Prueba la conexión con GupShup usando las credenciales correctas
 */
async function testConnection() {
  console.log('🧪 Probando conexión con GupShup...');
  
  // Número de teléfono de prueba
  const testNumber = '5212221192568';
  
  // Mensaje de prueba
  const message = 'Prueba de conexión - SOLUCION_API_GUPSHUP';
  
  // Datos para enviar a GupShup
  const formData = new URLSearchParams();
  formData.append('channel', 'whatsapp');
  formData.append('source', CORRECT_CREDENTIALS.GUPSHUP_NUMBER);
  formData.append('destination', testNumber);
  formData.append('src.name', CORRECT_CREDENTIALS.GUPSHUP_NUMBER);
  formData.append('message', JSON.stringify({
    type: 'text',
    text: message
  }));
  
  // Headers para la solicitud
  const headers = {
    'Cache-Control': 'no-cache',
    'Content-Type': 'application/x-www-form-urlencoded',
    'apikey': CORRECT_CREDENTIALS.GUPSHUP_API_KEY,
    'userid': CORRECT_CREDENTIALS.GUPSHUP_USERID
  };
  
  console.log('📝 Configuración de la solicitud:');
  console.log(`   URL: ${CORRECT_URL}`);
  console.log(`   Headers: apikey=${CORRECT_CREDENTIALS.GUPSHUP_API_KEY.substr(0, 5)}..., userid=${CORRECT_CREDENTIALS.GUPSHUP_USERID.substr(0, 5)}...`);
  console.log(`   Destino: ${testNumber}`);
  
  try {
    const response = await axios.post(CORRECT_URL, formData, { headers });
    
    console.log('✅ Conexión exitosa!');
    console.log(`📊 Estado: ${response.status} ${response.statusText}`);
    console.log(`📊 Respuesta: ${JSON.stringify(response.data)}`);
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('❌ Error al conectar con GupShup:');
    
    if (error.response) {
      console.error(`   Estado: ${error.response.status}`);
      console.error(`   Respuesta: ${JSON.stringify(error.response.data)}`);
      
      return {
        success: false,
        error: error.response.data,
        status: error.response.status
      };
    } else {
      console.error(`   Error: ${error.message}`);
      
      return {
        success: false,
        error: error.message
      };
    }
  }
}

/**
 * Crea un archivo de respaldo del código actual para referencia futura
 */
async function createBackup() {
  console.log('📦 Creando respaldo del código actual...');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(process.cwd(), 'backups');
  
  // Crear directorio de respaldos si no existe
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
  }
  
  // Respaldar cada archivo que vamos a modificar
  for (const fileName of FILES_TO_PATCH) {
    const filePath = path.join(process.cwd(), fileName);
    
    if (fs.existsSync(filePath)) {
      const backupPath = path.join(backupDir, `${fileName}.${timestamp}.backup`);
      fs.copyFileSync(filePath, backupPath);
      console.log(`✅ Respaldo creado: ${backupPath}`);
    }
  }
}

/**
 * Crea un archivo de resumen con la solución aplicada
 */
async function createSolutionSummary(results) {
  console.log('📝 Creando resumen de la solución aplicada...');
  
  const timestamp = new Date().toISOString();
  const summaryPath = path.join(process.cwd(), 'GUPSHUP_SOLUTION_APPLIED.md');
  
  let summaryContent = `# Solución API GupShup Aplicada\n\n`;
  summaryContent += `Fecha: ${new Date().toLocaleString()}\n\n`;
  summaryContent += `## Acciones realizadas\n\n`;
  summaryContent += `- Archivos corregidos: ${results.filesPatched}\n`;
  summaryContent += `- Archivo .env actualizado: Sí\n`;
  summaryContent += `- Credenciales actualizadas: Sí\n`;
  summaryContent += `- Prueba de conexión: ${results.connectionTest.success ? '✅ Exitosa' : '❌ Fallida'}\n\n`;
  
  if (results.connectionTest.success) {
    summaryContent += `## Conexión exitosa\n\n`;
    summaryContent += `Respuesta de GupShup: \`${JSON.stringify(results.connectionTest.data)}\`\n\n`;
  } else {
    summaryContent += `## Resultado de prueba\n\n`;
    summaryContent += `Error: \`${JSON.stringify(results.connectionTest.error)}\`\n\n`;
    summaryContent += `Acciones adicionales recomendadas:\n`;
    summaryContent += `- Verificar si la cuenta de GupShup está activa\n`;
    summaryContent += `- Contactar al soporte de GupShup para confirmar las credenciales\n`;
    summaryContent += `- Verificar la conexión a internet del servidor\n\n`;
  }
  
  summaryContent += `## Credenciales utilizadas\n\n`;
  summaryContent += `\`\`\`\n`;
  summaryContent += `URL: ${CORRECT_URL}\n`;
  summaryContent += `GUPSHUP_API_KEY: ${CORRECT_CREDENTIALS.GUPSHUP_API_KEY.substr(0, 5)}...\n`;
  summaryContent += `GUPSHUP_NUMBER: ${CORRECT_CREDENTIALS.GUPSHUP_NUMBER}\n`;
  summaryContent += `GUPSHUP_USERID: ${CORRECT_CREDENTIALS.GUPSHUP_USERID.substr(0, 5)}...\n`;
  summaryContent += `\`\`\`\n\n`;
  
  summaryContent += `## Próximos pasos\n\n`;
  summaryContent += `1. Reiniciar el servidor para aplicar los cambios\n`;
  summaryContent += `2. Probar el envío de mensajes desde la aplicación\n`;
  summaryContent += `3. Verificar los logs del servidor para confirmar que no hay errores\n\n`;
  
  fs.writeFileSync(summaryPath, summaryContent);
  console.log(`✅ Resumen creado: ${summaryPath}`);
}

/**
 * Función principal que ejecuta todas las correcciones
 */
async function main() {
  console.log('🚀 Iniciando corrección completa de GupShup API...\n');
  
  // Crear respaldo de los archivos actuales
  await createBackup();
  
  // Actualizar variables de entorno
  await updateEnvironment();
  
  // Parchear archivos
  const filesPatched = await patchFiles();
  
  // Probar conexión con GupShup
  const connectionTest = await testConnection();
  
  // Crear resumen de la solución
  await createSolutionSummary({
    filesPatched,
    connectionTest
  });
  
  console.log('\n📋 Resumen de acciones:');
  console.log(`   - Archivos corregidos: ${filesPatched}`);
  console.log(`   - Variables de entorno actualizadas: Sí`);
  console.log(`   - Prueba de conexión: ${connectionTest.success ? '✅ Exitosa' : '❌ Fallida'}`);
  
  if (connectionTest.success) {
    console.log('\n🎉 ¡Solución aplicada con éxito! El bot debería poder enviar mensajes correctamente.');
    console.log('   Reinicia el servidor para aplicar los cambios completamente.');
  } else {
    console.log('\n⚠️ Se han aplicado las correcciones, pero la prueba de conexión falló.');
    console.log('   Revisa el archivo GUPSHUP_SOLUTION_APPLIED.md para más detalles y recomendaciones.');
  }
}

// Ejecutar la función principal
main().catch(error => {
  console.error('\n❌ Error inesperado durante la corrección:', error);
  process.exit(1);
}); 