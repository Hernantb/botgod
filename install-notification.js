/**
 * Script para aplicación automática del parche de notificaciones
 * 
 * Este script modifica el archivo index.js para integrar el sistema de notificaciones 
 * que detecta cuando un mensaje del bot requiere atención humana y envía un correo 
 * electrónico de notificación.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuración
const CONFIG = {
  indexFilePath: path.join(__dirname, 'index.js'),
  notificationPatchPath: path.join(__dirname, 'notification-patch.js'),
  backupDir: path.join(__dirname, 'backups'),
  logFile: path.join(__dirname, 'notification-install.log')
};

// Función para hacer un respaldo del archivo original
function backupFile(filePath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = path.basename(filePath);
  const backupPath = path.join(CONFIG.backupDir, `${fileName}.backup-${timestamp}`);
  
  // Crear directorio de respaldos si no existe
  if (!fs.existsSync(CONFIG.backupDir)) {
    fs.mkdirSync(CONFIG.backupDir, { recursive: true });
  }
  
  // Copiar archivo
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

// Función para agregar logs
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  
  console.log(logMessage);
  
  // Agregar al archivo de log
  fs.appendFileSync(CONFIG.logFile, logMessage + '\n');
}

// Función para verificar si una modificación ya está aplicada
function isModificationApplied(fileContent, modification) {
  return fileContent.includes(modification.checkString);
}

// Modificaciones a aplicar al archivo index.js
const MODIFICATIONS = [
  // Modificación 1: Importar el módulo de notificaciones
  {
    name: 'Importar módulo de notificaciones',
    checkString: 'require(\'./notification-patch\')',
    apply: (content) => {
      // Buscar el lugar adecuado para agregar la importación (después de otros requires)
      const lastRequireIndex = content.lastIndexOf('require(');
      if (lastRequireIndex === -1) {
        throw new Error('No se encontraron declaraciones require en el archivo');
      }
      
      // Encontrar el final de la línea del último require
      const endOfLastRequire = content.indexOf('\n', lastRequireIndex);
      if (endOfLastRequire === -1) {
        throw new Error('No se pudo determinar el final de la última importación');
      }
      
      // Insertar después del último require
      const importStatement = '\n// Importar sistema de notificaciones\nconst { checkForNotificationPhrases, sendBusinessNotification, processMessageForNotification, sendWhatsAppResponseWithNotification } = require(\'./notification-patch\');\n';
      
      return content.substring(0, endOfLastRequire + 1) + importStatement + content.substring(endOfLastRequire + 1);
    }
  },
  
  // Modificación 2: Modificar la función existente de envío de mensajes
  {
    name: 'Modificar función sendTextMessageGupShup',
    checkString: 'const requiresNotification = checkForNotificationPhrases(message);',
    apply: (content) => {
      // Buscar la función sendTextMessageGupShup
      const functionStart = content.indexOf('async function sendTextMessageGupShup');
      
      if (functionStart === -1) {
        log('ADVERTENCIA: No se encontró la función sendTextMessageGupShup. Se aplicará una modificación alternativa.');
        return content; // No modificar si no existe
      }
      
      // Encontrar la llave de cierre de la función
      let bracketCount = 0;
      let functionEnd = functionStart;
      let inString = false;
      let stringChar = '';
      
      for (let i = content.indexOf('{', functionStart); i < content.length; i++) {
        const char = content[i];
        
        // Manejar cadenas para evitar contar llaves dentro de cadenas
        if ((char === '"' || char === "'") && (i === 0 || content[i-1] !== '\\')) {
          if (!inString) {
            inString = true;
            stringChar = char;
          } else if (char === stringChar) {
            inString = false;
          }
        }
        
        if (!inString) {
          if (char === '{') bracketCount++;
          if (char === '}') {
            bracketCount--;
            if (bracketCount === 0) {
              functionEnd = i;
              break;
            }
          }
        }
      }
      
      if (functionEnd === functionStart) {
        throw new Error('No se pudo determinar el final de la función sendTextMessageGupShup');
      }
      
      // Extraer la función completa
      const originalFunction = content.substring(functionStart, functionEnd + 1);
      
      // Identificar el punto para insertar la verificación de notificación (justo después del return success)
      const returnSuccessIndex = originalFunction.indexOf('return {');
      
      if (returnSuccessIndex === -1) {
        log('ADVERTENCIA: No se pudo encontrar el punto de retorno en sendTextMessageGupShup');
        return content;
      }
      
      // Crear la versión modificada de la función
      let modifiedFunction = originalFunction.substring(0, returnSuccessIndex);
      
      // Agregar la verificación de notificación
      modifiedFunction += `
  // Verificar si el mensaje requiere notificación
  const requiresNotification = checkForNotificationPhrases(message);
  if (requiresNotification) {
    console.log('🔔 Mensaje enviado requiere notificación, procesando...');
    
    // Obtener el ID de conversación
    let conversationId = null;
    if (global.phoneToConversationMap && global.phoneToConversationMap[phoneNumber]) {
      conversationId = global.phoneToConversationMap[phoneNumber];
    }
    
    // Si tenemos el ID, enviar notificación
    if (conversationId) {
      try {
        sendBusinessNotification(conversationId, message, phoneNumber)
          .then(result => {
            console.log(\`✅ Notificación enviada: \${JSON.stringify(result)}\`);
          })
          .catch(error => {
            console.error(\`❌ Error enviando notificación: \${error.message}\`);
          });
      } catch (error) {
        console.error(\`❌ Error al iniciar envío de notificación: \${error.message}\`);
      }
    } else {
      console.log('⚠️ No se pudo encontrar el ID de conversación para enviar notificación');
    }
  }
  
  `;
      
      // Agregar el return original
      modifiedFunction += originalFunction.substring(returnSuccessIndex);
      
      // Reemplazar la función original en el contenido
      return content.substring(0, functionStart) + modifiedFunction + content.substring(functionEnd + 1);
    }
  },
  
  // Modificación 3: Agregar una nueva función sendWhatsAppWithNotification si no se encuentra la existente
  {
    name: 'Agregar función sendWhatsAppWithNotification',
    checkString: 'async function sendWhatsAppWithNotification',
    apply: (content) => {
      // Verificar si ya modificamos la función sendTextMessageGupShup
      if (content.includes('const requiresNotification = checkForNotificationPhrases(message);')) {
        log('INFO: Ya se aplicó la modificación a sendTextMessageGupShup, no es necesario agregar sendWhatsAppWithNotification');
        return content;
      }
      
      // Si no encontramos o modificamos la función original, agregar una nueva
      const newFunction = `
// Función auxiliar para enviar mensajes con verificación de notificación
async function sendWhatsAppWithNotification(phoneNumber, message, conversationId) {
  console.log(\`📱 Enviando mensaje a \${phoneNumber} con verificación de notificación\`);
  
  try {
    // Enviar el mensaje usando la función original
    const result = await sendTextMessageGupShup(phoneNumber, message);
    
    // Verificar si requiere notificación
    const requiresNotification = checkForNotificationPhrases(message);
    
    if (requiresNotification) {
      console.log('🔔 Mensaje enviado requiere notificación, procesando...');
      
      // Si no tenemos el ID de conversación, intentar obtenerlo
      if (!conversationId && global.phoneToConversationMap) {
        conversationId = global.phoneToConversationMap[phoneNumber];
      }
      
      // Enviar notificación si tenemos el ID
      if (conversationId) {
        try {
          const notificationResult = await sendBusinessNotification(
            conversationId, 
            message, 
            phoneNumber
          );
          console.log(\`✅ Notificación enviada: \${JSON.stringify(notificationResult)}\`);
        } catch (error) {
          console.error(\`❌ Error enviando notificación: \${error.message}\`);
        }
      } else {
        console.log('⚠️ No se pudo encontrar el ID de conversación para notificación');
      }
    }
    
    return result;
  } catch (error) {
    console.error(\`❌ Error enviando mensaje: \${error.message}\`);
    throw error;
  }
}
`;
      
      // Encontrar un buen lugar para insertar la función (después de sendTextMessageGupShup)
      const afterSendTextMessage = content.indexOf('async function sendTextMessageGupShup');
      
      if (afterSendTextMessage === -1) {
        // Si no encontramos la función original, agregar al final del archivo
        return content + '\n' + newFunction;
      }
      
      // Encontrar el final de la función sendTextMessageGupShup
      let bracketCount = 0;
      let functionEnd = afterSendTextMessage;
      let inString = false;
      let stringChar = '';
      
      for (let i = content.indexOf('{', afterSendTextMessage); i < content.length; i++) {
        const char = content[i];
        
        // Manejar cadenas
        if ((char === '"' || char === "'") && (i === 0 || content[i-1] !== '\\')) {
          if (!inString) {
            inString = true;
            stringChar = char;
          } else if (char === stringChar) {
            inString = false;
          }
        }
        
        if (!inString) {
          if (char === '{') bracketCount++;
          if (char === '}') {
            bracketCount--;
            if (bracketCount === 0) {
              functionEnd = i;
              break;
            }
          }
        }
      }
      
      // Insertar después de la función original
      return content.substring(0, functionEnd + 1) + '\n' + newFunction + content.substring(functionEnd + 1);
    }
  },
  
  // Modificación 4: Agregar variables globales para mapeo de conversaciones si no existen
  {
    name: 'Agregar mapeo global de conversaciones',
    checkString: 'global.conversationIdToPhoneMap',
    apply: (content) => {
      // Verificar si las variables ya están definidas
      if (content.includes('global.conversationIdToPhoneMap') || content.includes('global.phoneToConversationMap')) {
        return content;
      }
      
      // Encontrar un buen lugar para insertar las variables (después de otras declaraciones globales)
      // Buscar después de alguna inicialización global común
      let insertPoint = content.indexOf('const app = express();');
      
      if (insertPoint === -1) {
        insertPoint = content.indexOf('const port =');
      }
      
      if (insertPoint === -1) {
        // Si no encontramos puntos comunes, insertar después de los requires
        insertPoint = content.lastIndexOf('require(');
        if (insertPoint !== -1) {
          insertPoint = content.indexOf('\n', insertPoint);
        }
      }
      
      if (insertPoint === -1) {
        // Si aún no encontramos un buen lugar, poner al principio
        insertPoint = 0;
      } else {
        // Avanzar al final de la línea
        insertPoint = content.indexOf('\n', insertPoint);
        if (insertPoint === -1) insertPoint = content.length;
      }
      
      // Variables globales a agregar
      const globalVars = `
// Mapas para seguimiento de conversaciones (usados por el sistema de notificaciones)
global.conversationIdToPhoneMap = {};
global.phoneToConversationMap = {};

`;
      
      return content.substring(0, insertPoint) + globalVars + content.substring(insertPoint);
    }
  }
];

// Función principal para aplicar las modificaciones
async function applyPatch() {
  log('Iniciando proceso de instalación de sistema de notificaciones...');
  
  // Verificar que los archivos necesarios existen
  if (!fs.existsSync(CONFIG.indexFilePath)) {
    log(`ERROR: No se encontró el archivo principal en ${CONFIG.indexFilePath}`);
    return false;
  }
  
  if (!fs.existsSync(CONFIG.notificationPatchPath)) {
    log(`ERROR: No se encontró el archivo del parche en ${CONFIG.notificationPatchPath}`);
    return false;
  }
  
  // Crear respaldo
  try {
    const backupPath = backupFile(CONFIG.indexFilePath);
    log(`Respaldo creado en: ${backupPath}`);
  } catch (error) {
    log(`ERROR al crear respaldo: ${error.message}`);
    return false;
  }
  
  // Leer el contenido del archivo
  let fileContent;
  try {
    fileContent = fs.readFileSync(CONFIG.indexFilePath, 'utf8');
    log(`Archivo leído: ${CONFIG.indexFilePath} (${fileContent.length} bytes)`);
  } catch (error) {
    log(`ERROR al leer archivo: ${error.message}`);
    return false;
  }
  
  // Aplicar cada modificación
  let modified = false;
  for (const mod of MODIFICATIONS) {
    try {
      if (isModificationApplied(fileContent, mod)) {
        log(`La modificación "${mod.name}" ya está aplicada. Se omitirá.`);
        continue;
      }
      
      log(`Aplicando modificación: ${mod.name}...`);
      const newContent = mod.apply(fileContent);
      
      if (newContent === fileContent) {
        log(`ADVERTENCIA: La modificación "${mod.name}" no produjo cambios.`);
      } else {
        fileContent = newContent;
        modified = true;
        log(`✅ Modificación "${mod.name}" aplicada correctamente.`);
      }
    } catch (error) {
      log(`ERROR al aplicar modificación "${mod.name}": ${error.message}`);
      log(`Continuando con las siguientes modificaciones...`);
    }
  }
  
  if (!modified) {
    log('No se realizaron cambios. Es posible que el parche ya esté aplicado.');
    return true;
  }
  
  // Guardar el archivo modificado
  try {
    fs.writeFileSync(CONFIG.indexFilePath, fileContent);
    log(`✅ Cambios guardados en: ${CONFIG.indexFilePath}`);
  } catch (error) {
    log(`ERROR al guardar el archivo: ${error.message}`);
    return false;
  }
  
  return true;
}

// Ejecutar la función principal
function main() {
  console.log('===== INSTALADOR DEL SISTEMA DE NOTIFICACIONES =====');
  console.log('Este script modificará el archivo index.js para integrar');
  console.log('el sistema de notificaciones automáticas.');
  console.log('Se creará un respaldo del archivo original antes de modificarlo.');
  console.log('======================================================\n');
  
  // Verificar archivos necesarios
  if (!fs.existsSync(CONFIG.indexFilePath)) {
    console.error(`❌ ERROR: No se encontró el archivo index.js en ${CONFIG.indexFilePath}`);
    console.error('Asegúrate de ejecutar este script desde el directorio raíz del proyecto.');
    process.exit(1);
  }
  
  if (!fs.existsSync(CONFIG.notificationPatchPath)) {
    console.error(`❌ ERROR: No se encontró el archivo notification-patch.js en ${CONFIG.notificationPatchPath}`);
    console.error('Este archivo es necesario para la instalación.');
    process.exit(1);
  }
  
  // Ejecutar la aplicación del parche
  applyPatch()
    .then(success => {
      if (success) {
        console.log('\n✅ Sistema de notificaciones instalado correctamente.');
        console.log(`📝 El registro de la instalación está disponible en: ${CONFIG.logFile}`);
      } else {
        console.error('\n❌ Hubo errores durante la instalación.');
        console.error(`📝 Revisa el archivo de log para más detalles: ${CONFIG.logFile}`);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error(`\n❌ Error inesperado: ${error.message}`);
      console.error(error.stack);
      process.exit(1);
    });
}

// Iniciar el script
main(); 