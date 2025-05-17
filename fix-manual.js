const fs = require('fs');
const path = require('path');

console.log('🔧 Iniciando corrección manual agresiva de funciones duplicadas...');

// Ruta al archivo index.js
const indexPath = path.join(__dirname, 'whatsapp-bot-main', 'index.js');

// Crear copia de seguridad
const timestamp = Date.now();
const backupPath = `${indexPath}.backup-${timestamp}`;
fs.copyFileSync(indexPath, backupPath);
console.log(`✅ Copia de seguridad creada: ${backupPath}`);

// Leer el contenido del archivo
const lines = fs.readFileSync(indexPath, 'utf8').split('\n');

// Líneas a comentar directamente (segunda declaración de cada función)
console.log('🔧 Comentando segunda declaración de checkForNotificationPhrases (línea 3732)...');
if (lines[3731].includes('function checkForNotificationPhrases')) {
  lines[3731] = '// ELIMINACIÓN MANUAL: ' + lines[3731];
  console.log('✅ Función checkForNotificationPhrases comentada');
}

console.log('🔧 Comentando segunda declaración de sendBusinessNotification (línea 3806)...');
if (lines[3805].includes('function sendBusinessNotification')) {
  lines[3805] = '// ELIMINACIÓN MANUAL: ' + lines[3805];
  console.log('✅ Función sendBusinessNotification comentada');
}

// Guardar los cambios
fs.writeFileSync(indexPath, lines.join('\n'));
console.log('✅ Cambios guardados correctamente');

// Verificación final
console.log('🔍 Verificando que solo quede una declaración activa de cada función...');

// Revisar cuántas quedaron
const checkDeclCount = lines.filter(line => 
  line.includes('function checkForNotificationPhrases') && !line.includes('//')
).length;

const notifDeclCount = lines.filter(line => 
  line.includes('async function sendBusinessNotification') && !line.includes('//')
).length;

console.log(`📊 Declaraciones activas de checkForNotificationPhrases: ${checkDeclCount}`);
console.log(`📊 Declaraciones activas de sendBusinessNotification: ${notifDeclCount}`);

if (checkDeclCount <= 1 && notifDeclCount <= 1) {
  console.log('✅ ÉXITO: Las duplicaciones fueron corregidas correctamente');
} else {
  console.log('⚠️ ADVERTENCIA: Todavía pueden quedar duplicaciones');
}

console.log('🔧 Proceso finalizado'); 