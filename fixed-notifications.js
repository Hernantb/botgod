const fs = require('fs');
const path = require('path');

console.log('🔧 Iniciando corrección de funciones duplicadas de notificación en index.js...');

// Ruta al archivo index.js
const indexPath = path.join(__dirname, 'whatsapp-bot-main', 'index.js');

// Crear copia de seguridad
const timestamp = Date.now();
const backupPath = `${indexPath}.backup-${timestamp}`;
fs.copyFileSync(indexPath, backupPath);
console.log(`✅ Copia de seguridad creada: ${backupPath}`);

// Leer el contenido del archivo
let content = fs.readFileSync(indexPath, 'utf8');

// Identificar las funciones duplicadas
const checkNotificationPattern1 = /function checkForNotificationPhrases\(message\) \{[\s\S]+?(?=function|module\.exports|\/\/ Endpoint|$)/g;
const businessNotificationPattern1 = /async function sendBusinessNotification\(conversationId, botMessage, clientPhoneNumber\) \{[\s\S]+?(?=function|module\.exports|\/\/ Endpoint|$)/g;

// Encontrar todas las ocurrencias
const checkMatches = [...content.matchAll(checkNotificationPattern1)];
const notificationMatches = [...content.matchAll(businessNotificationPattern1)];

console.log(`🔍 Encontradas ${checkMatches.length} declaraciones de checkForNotificationPhrases`);
console.log(`🔍 Encontradas ${notificationMatches.length} declaraciones de sendBusinessNotification`);

// Si hay más de una ocurrencia, conservar solo la primera de cada una
if (checkMatches.length > 1 || notificationMatches.length > 1) {
  console.log('⚠️ Encontradas funciones duplicadas. Procediendo a corregir...');
  
  // Para checkForNotificationPhrases
  if (checkMatches.length > 1) {
    for (let i = 1; i < checkMatches.length; i++) {
      const match = checkMatches[i][0];
      // Comentar la función duplicada
      const commentedFunction = `// FUNCIÓN DUPLICADA COMENTADA AUTOMÁTICAMENTE\n/*\n${match}*/\n`;
      content = content.replace(match, commentedFunction);
      console.log(`✅ Comentada una declaración duplicada de checkForNotificationPhrases`);
    }
  }
  
  // Para sendBusinessNotification
  if (notificationMatches.length > 1) {
    for (let i = 1; i < notificationMatches.length; i++) {
      const match = notificationMatches[i][0];
      // Comentar la función duplicada
      const commentedFunction = `// FUNCIÓN DUPLICADA COMENTADA AUTOMÁTICAMENTE\n/*\n${match}*/\n`;
      content = content.replace(match, commentedFunction);
      console.log(`✅ Comentada una declaración duplicada de sendBusinessNotification`);
    }
  }
  
  // Guardar los cambios
  fs.writeFileSync(indexPath, content);
  console.log('✅ Archivo guardado con las correcciones aplicadas');
  
  // Verificar que no queden duplicados después de las correcciones
  content = fs.readFileSync(indexPath, 'utf8');
  const remainingCheckMatches = [...content.matchAll(/function checkForNotificationPhrases\(message\) \{/g)];
  const remainingNotificationMatches = [...content.matchAll(/async function sendBusinessNotification\(conversationId/g)];
  
  console.log(`📊 Después de la corrección quedan ${remainingCheckMatches.length} declaraciones activas de checkForNotificationPhrases`);
  console.log(`📊 Después de la corrección quedan ${remainingNotificationMatches.length} declaraciones activas de sendBusinessNotification`);
  
  if (remainingCheckMatches.length > 1 || remainingNotificationMatches.length > 1) {
    console.log('⚠️ ALERTA: Todavía quedan declaraciones duplicadas. Puede ser necesaria una revisión manual.');
  } else {
    console.log('✅ ÉXITO: Se han corregido todas las duplicaciones detectadas.');
  }
} else {
  console.log('✅ No se encontraron declaraciones duplicadas para corregir.');
}

console.log('🔧 Proceso de corrección finalizado'); 