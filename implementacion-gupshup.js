/**
 * IMPLEMENTACIÓN DE SOLUCIÓN PARA API GUPSHUP
 * 
 * Este script aplica la configuración correcta a todos los archivos relevantes
 * en el sistema basado en los resultados del diagnóstico o especificaciones manuales.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

// ================ CONFIGURACIÓN ================
// La configuración se puede especificar manualmente o cargar desde un archivo generado por el diagnóstico

// Intenta cargar configuración del diagnóstico si existe
let config = null;
const diagnosticFile = path.join(process.cwd(), 'gupshup-diagnosis', 'successful-config.json');

if (fs.existsSync(diagnosticFile)) {
  try {
    config = JSON.parse(fs.readFileSync(diagnosticFile, 'utf8'));
    console.log('✅ Configuración cargada del diagnóstico previo.');
  } catch (error) {
    console.error('❌ Error al cargar configuración del diagnóstico:', error.message);
  }
}

// Configuración manual en caso de que no exista un diagnóstico previo o se quiera sobrescribir
const manualConfig = {
  url: 'https://api.gupshup.io/wa/api/v1/msg',
  headers: {
    'Cache-Control': 'no-cache',
    'Content-Type': 'application/x-www-form-urlencoded',
    'apikey': process.env.GUPSHUP_API_KEY || 'sk_58a31041fdeb4d98b9f0e073792a6e6b',
    'userid': process.env.GUPSHUP_USERID || 'crxty1qflktvwvm7sodtrfe9dpvoowm1'
  },
  credentials: {
    GUPSHUP_API_KEY: process.env.GUPSHUP_API_KEY || 'sk_58a31041fdeb4d98b9f0e073792a6e6b',
    GUPSHUP_NUMBER: process.env.GUPSHUP_NUMBER || '15557033313',
    GUPSHUP_USERID: process.env.GUPSHUP_USERID || 'crxty1qflktvwvm7sodtrfe9dpvoowm1'
  }
};

// Usar configuración del diagnóstico o la manual
const finalConfig = config || manualConfig;

// Archivos que necesitan ser modificados
const FILES_TO_PATCH = [
  'whatsapp-sender.js',
  'send-message.js'
];

// ================ FUNCIONES PRINCIPALES ================

/**
 * Crea un archivo .env con las credenciales correctas
 */
function createEnvFile() {
  console.log('📝 Creando/actualizando archivo .env...');
  
  const envPath = path.join(process.cwd(), '.env');
  let envContent = '';
  
  // Si ya existe un archivo .env, leerlo primero
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
    console.log('   📄 Archivo .env existente encontrado, actualizando...');
  } else {
    console.log('   📄 Creando nuevo archivo .env...');
  }
  
  // Para cada credencial, actualizar o añadir al archivo .env
  for (const [key, value] of Object.entries(finalConfig.credentials)) {
    const regex = new RegExp(`${key}=.*(\n|$)`, 'g');
    
    if (regex.test(envContent)) {
      // Actualizar valor existente
      envContent = envContent.replace(regex, `${key}=${value}\n`);
    } else {
      // Añadir nueva variable
      envContent += `${key}=${value}\n`;
    }
  }
  
  // Guardar el archivo .env actualizado
  fs.writeFileSync(envPath, envContent);
  console.log('   ✅ Archivo .env actualizado correctamente.');
}

/**
 * Actualiza el archivo whatsapp-sender.js con la configuración correcta
 */
function updateWhatsAppSender() {
  console.log('\n📝 Actualizando whatsapp-sender.js...');
  
  const filePath = path.join(process.cwd(), 'whatsapp-sender.js');
  
  if (!fs.existsSync(filePath)) {
    console.log('   ❌ El archivo whatsapp-sender.js no existe!');
    return false;
  }
  
  // Leer el archivo actual
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Crear una copia de respaldo
  const backupPath = path.join(process.cwd(), `whatsapp-sender.js.backup-${Date.now()}`);
  fs.writeFileSync(backupPath, content);
  console.log(`   📦 Backup creado en ${backupPath}`);
  
  // Reemplazar la URL de la API si es necesaria
  const urlRegex = /https:\/\/api\.gupshup\.io\/(sm|wa)\/api\/v\d+\/msg/g;
  if (urlRegex.test(content)) {
    content = content.replace(urlRegex, finalConfig.url);
    console.log('   ✅ URL de API actualizada.');
  } else {
    console.log('   ⚠️ No se encontró URL de API para reemplazar.');
  }
  
  // Asegurarse de que los headers incluyan userid
  if (content.includes('apikey') && !content.includes('userid')) {
    // Buscar el lugar donde se definen los headers
    const headersRegex = /(const|let|var)\s+headers\s*=\s*{[^}]*}/gs;
    const headersMatch = content.match(headersRegex);
    
    if (headersMatch) {
      // Encontrar el final de la declaración de headers
      const originalHeaders = headersMatch[0];
      const updatedHeaders = originalHeaders.replace(/}$/, `,\n    'userid': process.env.GUPSHUP_USERID || '${finalConfig.credentials.GUPSHUP_USERID}'\n  }`);
      
      content = content.replace(originalHeaders, updatedHeaders);
      console.log('   ✅ Header userid agregado.');
    } else {
      console.log('   ⚠️ No se pudo encontrar la definición de headers para agregar userid.');
    }
  } else if (content.includes('userid')) {
    console.log('   ✅ Header userid ya está presente.');
  }
  
  // Guardar el archivo actualizado
  fs.writeFileSync(filePath, content);
  console.log('   ✅ whatsapp-sender.js actualizado correctamente.');
  
  return true;
}

/**
 * Actualiza el archivo send-message.js con la configuración correcta
 */
function updateSendMessage() {
  console.log('\n📝 Actualizando send-message.js...');
  
  const filePath = path.join(process.cwd(), 'send-message.js');
  
  if (!fs.existsSync(filePath)) {
    console.log('   ⚠️ El archivo send-message.js no existe! Omitiendo...');
    return false;
  }
  
  // Leer el archivo actual
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Crear una copia de respaldo
  const backupPath = path.join(process.cwd(), `send-message.js.backup-${Date.now()}`);
  fs.writeFileSync(backupPath, content);
  console.log(`   📦 Backup creado en ${backupPath}`);
  
  // Reemplazar la URL de la API si es necesaria
  const urlRegex = /https:\/\/api\.gupshup\.io\/(sm|wa)\/api\/v\d+\/msg/g;
  if (urlRegex.test(content)) {
    content = content.replace(urlRegex, finalConfig.url);
    console.log('   ✅ URL de API actualizada.');
  } else {
    console.log('   ⚠️ No se encontró URL de API para reemplazar.');
  }
  
  // Asegurarse de que los headers incluyan userid
  if (content.includes('apikey') && !content.includes('userid')) {
    // Buscar el lugar donde se definen los headers
    const headersRegex = /(const|let|var)\s+headers\s*=\s*{[^}]*}/gs;
    const headersMatch = content.match(headersRegex);
    
    if (headersMatch) {
      // Encontrar el final de la declaración de headers
      const originalHeaders = headersMatch[0];
      const updatedHeaders = originalHeaders.replace(/}$/, `,\n    'userid': process.env.GUPSHUP_USERID || '${finalConfig.credentials.GUPSHUP_USERID}'\n  }`);
      
      content = content.replace(originalHeaders, updatedHeaders);
      console.log('   ✅ Header userid agregado.');
    } else {
      console.log('   ⚠️ No se pudo encontrar la definición de headers para agregar userid.');
    }
  } else if (content.includes('userid')) {
    console.log('   ✅ Header userid ya está presente.');
  }
  
  // Guardar el archivo actualizado
  fs.writeFileSync(filePath, content);
  console.log('   ✅ send-message.js actualizado correctamente.');
  
  return true;
}

/**
 * Busca el método sendWhatsAppResponse en index.js y lo actualiza
 */
function updateIndexJs() {
  console.log('\n📝 Actualizando index.js...');
  
  const filePath = path.join(process.cwd(), 'index.js');
  
  if (!fs.existsSync(filePath)) {
    console.log('   ⚠️ El archivo index.js no existe! Omitiendo...');
    return false;
  }
  
  // Leer el archivo actual
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Crear una copia de respaldo
  const backupPath = path.join(process.cwd(), `index.js.backup-${Date.now()}`);
  fs.writeFileSync(backupPath, content);
  console.log(`   📦 Backup creado en ${backupPath}`);
  
  // Buscar la función sendWhatsAppResponse
  const functionRegex = /async\s+function\s+sendWhatsAppResponse\s*\([^)]*\)\s*{[\s\S]*?}/g;
  const functionMatch = content.match(functionRegex);
  
  if (functionMatch) {
    const originalFunction = functionMatch[0];
    
    // Verificar si la función ya contiene la URL correcta
    if (originalFunction.includes(finalConfig.url)) {
      console.log('   ✅ La función sendWhatsAppResponse ya usa la URL correcta.');
    } else {
      // Reemplazar URL en la función
      const updatedFunction = originalFunction.replace(/https:\/\/api\.gupshup\.io\/(sm|wa)\/api\/v\d+\/msg/g, finalConfig.url);
      content = content.replace(originalFunction, updatedFunction);
      console.log('   ✅ URL en sendWhatsAppResponse actualizada.');
    }
    
    // Verificar si la función incluye el header userid
    if (originalFunction.includes('apikey') && !originalFunction.includes('userid')) {
      // Buscar la definición de headers en la función
      const headersRegex = /(const|let|var)\s+headers\s*=\s*{[^}]*}/gs;
      const headersMatch = originalFunction.match(headersRegex);
      
      if (headersMatch) {
        const originalHeaders = headersMatch[0];
        const updatedHeaders = originalHeaders.replace(/}$/, `,\n      'userid': process.env.GUPSHUP_USERID || '${finalConfig.credentials.GUPSHUP_USERID}'\n    }`);
        
        const updatedFunction = originalFunction.replace(originalHeaders, updatedHeaders);
        content = content.replace(originalFunction, updatedFunction);
        console.log('   ✅ Header userid agregado a sendWhatsAppResponse.');
      } else {
        console.log('   ⚠️ No se encontró la definición de headers en sendWhatsAppResponse.');
      }
    } else if (originalFunction.includes('userid')) {
      console.log('   ✅ Header userid ya está presente en sendWhatsAppResponse.');
    }
  } else {
    console.log('   ⚠️ No se encontró la función sendWhatsAppResponse en index.js.');
  }
  
  // Guardar el archivo actualizado
  fs.writeFileSync(filePath, content);
  console.log('   ✅ index.js actualizado correctamente.');
  
  return true;
}

/**
 * Crea un script de test para verificar la implementación
 */
function createTestScript() {
  console.log('\n📝 Creando script de prueba...');
  
  const testScript = `/**
 * Script de prueba para verificar la implementación de la API GupShup
 */

require('dotenv').config();
const axios = require('axios');

// Credenciales
const GUPSHUP_API_KEY = process.env.GUPSHUP_API_KEY || '${finalConfig.credentials.GUPSHUP_API_KEY}';
const GUPSHUP_NUMBER = process.env.GUPSHUP_NUMBER || '${finalConfig.credentials.GUPSHUP_NUMBER}';
const GUPSHUP_USERID = process.env.GUPSHUP_USERID || '${finalConfig.credentials.GUPSHUP_USERID}';

// Número de teléfono para prueba
const TEST_NUMBER = process.argv[2] || '5212221192568';
const TEST_MESSAGE = process.argv[3] || 'Mensaje de prueba desde implementación GupShup - ' + new Date().toISOString();

// URL de la API
const API_URL = '${finalConfig.url}';

async function testApi() {
  console.log('🧪 Probando implementación de GupShup API...');
  console.log('============================================');
  console.log(\`🔑 API Key: \${GUPSHUP_API_KEY.substring(0, 5)}...\`);
  console.log(\`👤 User ID: \${GUPSHUP_USERID.substring(0, 5)}...\`);
  console.log(\`📱 Número de origen: \${GUPSHUP_NUMBER}\`);
  console.log(\`📱 Número de destino: \${TEST_NUMBER}\`);
  console.log(\`💬 Mensaje: \${TEST_MESSAGE}\`);
  console.log(\`🌐 URL: \${API_URL}\`);
  console.log('============================================');

  try {
    // Preparar datos
    const formData = new URLSearchParams();
    formData.append('channel', 'whatsapp');
    formData.append('source', GUPSHUP_NUMBER);
    formData.append('destination', TEST_NUMBER);
    formData.append('src.name', GUPSHUP_NUMBER);
    formData.append('message', JSON.stringify({
      type: 'text',
      text: TEST_MESSAGE
    }));
    
    // Configurar headers
    const headers = {
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/x-www-form-urlencoded',
      'apikey': GUPSHUP_API_KEY,
      'userid': GUPSHUP_USERID
    };
    
    console.log('🚀 Enviando solicitud...');
    const response = await axios.post(API_URL, formData, { headers });
    
    console.log('✅ ¡Solicitud exitosa!');
    console.log(\`📊 Estado: \${response.status}\`);
    console.log(\`📄 Respuesta: \${JSON.stringify(response.data)}\`);
    
    return true;
  } catch (error) {
    console.error('❌ Error al enviar mensaje:');
    
    if (error.response) {
      console.error(\`📊 Estado: \${error.response.status}\`);
      console.error(\`📄 Respuesta: \${JSON.stringify(error.response.data)}\`);
    } else {
      console.error(\`📄 Error: \${error.message}\`);
    }
    
    return false;
  }
}

// Ejecutar prueba
testApi().then(success => {
  if (success) {
    console.log('\\n🎉 ¡La implementación fue exitosa!');
    console.log('El mensaje debería haber sido enviado al número de destino.');
  } else {
    console.log('\\n⚠️ La implementación falló.');
    console.log('Verifica las credenciales y la configuración.');
  }
});
`;

  const testScriptPath = path.join(process.cwd(), 'test-implementacion.js');
  fs.writeFileSync(testScriptPath, testScript);
  console.log(`   ✅ Script de prueba creado en: ${testScriptPath}`);
  
  // Instrucciones de uso
  console.log('   📌 Para probar la implementación, ejecuta:');
  console.log('       node test-implementacion.js');
  console.log('   📌 Para probar con un número diferente:');
  console.log('       node test-implementacion.js NUMERO_DESTINO "Mensaje de prueba"');
}

/**
 * Crea un archivo de resumen con la implementación aplicada
 */
function createSummary() {
  console.log('\n📝 Creando resumen de implementación...');
  
  const summary = `# Implementación de Solución GupShup

Fecha: ${new Date().toLocaleString()}

## Configuración aplicada

\`\`\`
URL de API: ${finalConfig.url}
\`\`\`

### Headers:
\`\`\`
${Object.entries(finalConfig.headers).map(([key, value]) => {
  if (key === 'apikey' || key === 'userid') {
    return `${key}: ${value.substring(0, 5)}...`;
  }
  return `${key}: ${value}`;
}).join('\n')}
\`\`\`

### Credenciales:
\`\`\`
${Object.entries(finalConfig.credentials).map(([key, value]) => {
  if (key === 'GUPSHUP_API_KEY' || key === 'GUPSHUP_USERID') {
    return `${key}: ${value.substring(0, 5)}...`;
  }
  return `${key}: ${value}`;
}).join('\n')}
\`\`\`

## Archivos modificados

${FILES_TO_PATCH.map(file => {
  return `- ${file}`;
}).join('\n')}
- .env (creado/actualizado)
- index.js (si está presente)

## Próximos pasos

1. Ejecuta el script de prueba:
   \`\`\`
   node test-implementacion.js
   \`\`\`

2. Si la prueba es exitosa, reinicia el servidor:
   \`\`\`
   npm restart
   \`\`\`

3. Verifica en la aplicación que los mensajes se envíen correctamente.

## Soluciones de respaldo

Si la implementación no funciona correctamente, intenta:

1. Verificar que las credenciales sean correctas comunicándote con GupShup.
2. Crear una nueva aplicación en la plataforma de GupShup.
3. Actualizar las variables de entorno en el servidor.

## Referencia

Para más información, consulta la documentación oficial de GupShup:
https://docs.gupshup.io/
`;

  const summaryPath = path.join(process.cwd(), 'IMPLEMENTACION_GUPSHUP.md');
  fs.writeFileSync(summaryPath, summary);
  console.log(`   ✅ Resumen creado en: ${summaryPath}`);
}

/**
 * Implementación principal
 */
function implement() {
  console.log('🚀 INICIANDO IMPLEMENTACIÓN DE SOLUCIÓN GUPSHUP');
  console.log('======================================================');
  console.log('Aplicando configuración:');
  console.log(`URL: ${finalConfig.url}`);
  console.log(`Headers: ${JSON.stringify(finalConfig.headers)}`);
  console.log(`Credenciales: ${JSON.stringify({
    GUPSHUP_API_KEY: finalConfig.credentials.GUPSHUP_API_KEY.substring(0, 5) + '...',
    GUPSHUP_NUMBER: finalConfig.credentials.GUPSHUP_NUMBER,
    GUPSHUP_USERID: finalConfig.credentials.GUPSHUP_USERID.substring(0, 5) + '...'
  })}`);
  console.log('======================================================\n');
  
  // Crear archivo .env
  createEnvFile();
  
  // Actualizar archivos
  updateWhatsAppSender();
  updateSendMessage();
  updateIndexJs();
  
  // Crear script de prueba
  createTestScript();
  
  // Crear resumen
  createSummary();
  
  console.log('\n🎉 IMPLEMENTACIÓN COMPLETADA');
  console.log('======================================================');
  console.log('📌 Para probar la implementación, ejecuta:');
  console.log('   node test-implementacion.js');
  console.log('📌 Revisa el archivo IMPLEMENTACION_GUPSHUP.md para más detalles.');
  console.log('======================================================');
}

// Ejecutar implementación
implement(); 