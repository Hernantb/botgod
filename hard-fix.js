const fs = require('fs');
const path = require('path');

console.log('🔧 Iniciando corrección final definitiva de funciones duplicadas...');

// Ruta al archivo index.js
const indexPath = path.join(__dirname, 'whatsapp-bot-main', 'index.js');

// Crear copia de seguridad
const timestamp = Date.now();
const backupPath = `${indexPath}.backup-${timestamp}`;
fs.copyFileSync(indexPath, backupPath);
console.log(`✅ Copia de seguridad creada: ${backupPath}`);

// Leer el contenido del archivo línea por línea
const lines = fs.readFileSync(indexPath, 'utf8').split('\n');

// Búsqueda más precisa por línea
let checkFunctionStartLines = [];
let notificationFunctionStartLines = [];

// Buscar las líneas donde comienzan las funciones
lines.forEach((line, index) => {
  // Buscar declaraciones de checkForNotificationPhrases
  if (line.trim().startsWith('function checkForNotificationPhrases') || 
      line.trim().match(/^const\s+checkForNotificationPhrases/) ||
      line.trim() === 'function checkForNotificationPhrases(message) {') {
    console.log(`🔍 checkForNotificationPhrases - línea ${index + 1}: ${line.trim()}`);
    checkFunctionStartLines.push(index);
  }
  
  // Buscar declaraciones de sendBusinessNotification
  if (line.trim().startsWith('async function sendBusinessNotification') || 
      line.trim().match(/^const\s+sendBusinessNotification/) ||
      line.trim() === 'async function sendBusinessNotification(conversationId, botMessage, clientPhoneNumber) {') {
    console.log(`🔍 sendBusinessNotification - línea ${index + 1}: ${line.trim()}`);
    notificationFunctionStartLines.push(index);
  }
});

console.log(`📊 Encontradas ${checkFunctionStartLines.length} declaraciones de checkForNotificationPhrases`);
console.log(`📊 Encontradas ${notificationFunctionStartLines.length} declaraciones de sendBusinessNotification`);

// Solución directa: Si hay más de una ocurrencia, comentar la segunda (y siguientes)
let modified = false;

// Para checkForNotificationPhrases
if (checkFunctionStartLines.length > 1) {
  // Si hay múltiples declaraciones, mantener solo la primera
  for (let i = 1; i < checkFunctionStartLines.length; i++) {
    const lineIndex = checkFunctionStartLines[i];
    lines[lineIndex] = `// FUNCIÓN DUPLICADA COMENTADA: ${lines[lineIndex]}`;
    console.log(`✅ Comentada declaración de checkForNotificationPhrases en línea ${lineIndex + 1}`);
    modified = true;
    
    // Comentar también la línea que cierra la función
    // Buscar la línea de cierre (puede ser complicado determinar exactamente dónde termina)
    let closingBraceLine = -1;
    let openBraces = 1; // Ya estamos dentro de una llave
    
    for (let j = lineIndex + 1; j < lines.length; j++) {
      const currentLine = lines[j];
      
      // Contar llaves abiertas y cerradas
      const openCount = (currentLine.match(/\{/g) || []).length;
      const closeCount = (currentLine.match(/\}/g) || []).length;
      
      openBraces += openCount - closeCount;
      
      // Si llegamos a 0, encontramos el cierre de la función
      if (openBraces === 0) {
        closingBraceLine = j;
        break;
      }
    }
    
    if (closingBraceLine !== -1) {
      lines[closingBraceLine] = `// ${lines[closingBraceLine]} // Fin de función duplicada comentada`;
      console.log(`✅ Comentado cierre de función en línea ${closingBraceLine + 1}`);
    }
  }
}

// Para sendBusinessNotification
if (notificationFunctionStartLines.length > 1) {
  // Si hay múltiples declaraciones, mantener solo la primera
  for (let i = 1; i < notificationFunctionStartLines.length; i++) {
    const lineIndex = notificationFunctionStartLines[i];
    lines[lineIndex] = `// FUNCIÓN DUPLICADA COMENTADA: ${lines[lineIndex]}`;
    console.log(`✅ Comentada declaración de sendBusinessNotification en línea ${lineIndex + 1}`);
    modified = true;
    
    // Comentar también la línea que cierra la función
    // Buscar la línea de cierre (puede ser complicado determinar exactamente dónde termina)
    let closingBraceLine = -1;
    let openBraces = 1; // Ya estamos dentro de una llave
    
    for (let j = lineIndex + 1; j < lines.length; j++) {
      const currentLine = lines[j];
      
      // Contar llaves abiertas y cerradas
      const openCount = (currentLine.match(/\{/g) || []).length;
      const closeCount = (currentLine.match(/\}/g) || []).length;
      
      openBraces += openCount - closeCount;
      
      // Si llegamos a 0, encontramos el cierre de la función
      if (openBraces === 0) {
        closingBraceLine = j;
        break;
      }
    }
    
    if (closingBraceLine !== -1) {
      lines[closingBraceLine] = `// ${lines[closingBraceLine]} // Fin de función duplicada comentada`;
      console.log(`✅ Comentado cierre de función en línea ${closingBraceLine + 1}`);
    }
  }
}

// Si hubo modificaciones, guardar el archivo
if (modified) {
  const modifiedContent = lines.join('\n');
  fs.writeFileSync(indexPath, modifiedContent);
  console.log('✅ Archivo guardado con las correcciones aplicadas');
} else {
  console.log('ℹ️ No se realizaron modificaciones al archivo');
}

// Verificación final
const finalContent = fs.readFileSync(indexPath, 'utf8').split('\n');
let activeFunctions = {
  checkForNotificationPhrases: 0,
  sendBusinessNotification: 0
};

finalContent.forEach(line => {
  if (line.includes('function checkForNotificationPhrases') && !line.includes('//')) {
    activeFunctions.checkForNotificationPhrases++;
  }
  if (line.includes('async function sendBusinessNotification') && !line.includes('//')) {
    activeFunctions.sendBusinessNotification++;
  }
});

console.log(`📊 Funciones activas después de correcciones:`);
console.log(`- checkForNotificationPhrases: ${activeFunctions.checkForNotificationPhrases}`);
console.log(`- sendBusinessNotification: ${activeFunctions.sendBusinessNotification}`);

if (activeFunctions.checkForNotificationPhrases > 1 || activeFunctions.sendBusinessNotification > 1) {
  console.log('⚠️ ALERTA: Todavía quedan funciones duplicadas sin comentar');
} else {
  console.log('✅ ÉXITO: Solo hay una declaración activa de cada función');
}

// Solución manual en caso de que nada más funcione
if (activeFunctions.checkForNotificationPhrases > 1) {
  console.log('🔧 Aplicando solución manual para checkForNotificationPhrases...');
  
  // Líneas específicas a eliminar (basadas en análisis previo)
  // Estas son las líneas aproximadas donde se encuentra la segunda declaración
  const manualEditLines = [3731, 3732, 3733, 3734, 3735, 3736, 3737, 3738, 3739, 3740];
  
  // Leer el contenido nuevamente para estar seguros
  const finalLines = fs.readFileSync(indexPath, 'utf8').split('\n');
  
  // Comentar estas líneas manualmente
  manualEditLines.forEach(lineNum => {
    if (lineNum - 1 < finalLines.length) {
      finalLines[lineNum - 1] = `// ELIMINACIÓN MANUAL: ${finalLines[lineNum - 1]}`;
      console.log(`✅ Comentada manualmente línea ${lineNum}`);
    }
  });
  
  // Guardar los cambios manuales
  fs.writeFileSync(indexPath, finalLines.join('\n'));
  console.log('✅ Cambios manuales aplicados y guardados');
}

console.log('🔧 Proceso de corrección finalizado'); 