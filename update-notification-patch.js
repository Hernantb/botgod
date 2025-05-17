/**
 * Script de actualización del sistema de notificaciones
 * 
 * Este script verifica si el módulo notification-patch.js está actualizado
 * con todas las funciones necesarias y lo actualiza si es necesario.
 */

const fs = require('fs');
const path = require('path');

// Configuración
const CONFIG = {
  notificationPatchPath: './notification-patch.js',
  backupDir: './backups'
};

// Función para registrar mensajes
function log(message) {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  console.log(`[${timestamp}] ${message}`);
}

// Función para crear una copia de seguridad
function backupOriginalFile(filePath) {
  // Crear directorio de respaldos si no existe
  if (!fs.existsSync(CONFIG.backupDir)) {
    fs.mkdirSync(CONFIG.backupDir, { recursive: true });
  }
  
  // Generar nombre de archivo de respaldo con timestamp
  const fileName = path.basename(filePath);
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace('T', '_').split('.')[0];
  const backupFileName = `${fileName}.${timestamp}.bak`;
  const backupPath = path.join(CONFIG.backupDir, backupFileName);
  
  // Crear copia de seguridad
  fs.copyFileSync(filePath, backupPath);
  
  return backupPath;
}

// Verificar si se necesita actualizar el parche
function checkIfUpdateNeeded(content) {
  // Verificar si la función sendWhatsAppResponseWithNotification existe
  const hasSendWhatsAppResponseWithNotification = content.includes('function sendWhatsAppResponseWithNotification');
  
  // Verificar si la función está exportada
  const isExported = content.includes('sendWhatsAppResponseWithNotification');
  
  return {
    needsUpdate: !hasSendWhatsAppResponseWithNotification || !isExported,
    hasSendWhatsAppResponseWithNotification,
    isExported
  };
}

// Agregar la función sendWhatsAppResponseWithNotification al archivo
function addSendWhatsAppResponseWithNotification(content) {
  // Código de la función que se va a agregar
  const functionCode = `
/**
 * Envía un mensaje de WhatsApp y verifica si requiere notificación
 * @param {string} phoneNumber - Número de teléfono del destinatario
 * @param {string} message - Mensaje a enviar
 * @param {Object} options - Opciones adicionales
 * @param {Function} options.sendFunction - Función para enviar el mensaje
 * @param {string} options.conversationId - ID de la conversación
 * @returns {Promise<Object>} Resultado del envío con información de notificación
 */
async function sendWhatsAppResponseWithNotification(phoneNumber, message, options = {}) {
  try {
    console.log(\`📱 Enviando mensaje a \${phoneNumber} con verificación de notificación\`);
    
    // Extraer opciones
    const {
      sendFunction,
      conversationId,
      skipNotificationCheck = false
    } = options;
    
    // Validar parámetros
    if (!phoneNumber) {
      throw new Error('Número de teléfono no proporcionado');
    }
    
    if (!message) {
      throw new Error('Mensaje no proporcionado');
    }
    
    if (!sendFunction || typeof sendFunction !== 'function') {
      throw new Error('Función de envío no proporcionada o inválida');
    }
    
    // Enviar el mensaje
    console.log(\`📤 Enviando mensaje a WhatsApp\`);
    let whatsappResult;
    try {
      whatsappResult = await sendFunction(phoneNumber, message);
      console.log(\`✅ Mensaje enviado correctamente a WhatsApp\`);
    } catch (sendError) {
      console.error(\`❌ Error al enviar mensaje a WhatsApp: \${sendError.message}\`);
      throw sendError;
    }
    
    // Verificar si el mensaje requiere notificación (a menos que se indique lo contrario)
    let notificationResult = { 
      requiresNotification: false, 
      notificationSent: false
    };
    
    if (!skipNotificationCheck) {
      console.log(\`🔍 Verificando si el mensaje requiere notificación\`);
      
      try {
        // Analizar el mensaje del bot para ver si requiere atención humana
        notificationResult = await processMessageForNotification(
          message, 
          'bot', 
          conversationId,
          phoneNumber
        );
        
        if (notificationResult.requiresNotification) {
          console.log(\`⚠️ El mensaje requirió notificación: \${notificationResult.notificationSent ? 'Enviada ✅' : 'Falló ❌'}\`);
        } else {
          console.log(\`ℹ️ El mensaje no requiere notificación\`);
        }
      } catch (notificationError) {
        console.error(\`❌ Error al procesar notificación: \${notificationError.message}\`);
        notificationResult.error = notificationError.message;
      }
    } else {
      console.log(\`ℹ️ Verificación de notificación omitida por configuración\`);
    }
    
    // Retornar resultado combinado
    return {
      ...whatsappResult,
      notification: notificationResult
    };
  } catch (error) {
    console.error(\`❌ Error en sendWhatsAppResponseWithNotification: \${error.message}\`);
    throw error;
  }
}`;

  // Buscar el punto de exportación para insertar antes
  const exportRegex = /module\.exports\s*=\s*\{/;
  const exportMatch = exportRegex.exec(content);
  
  if (!exportMatch) {
    log('⚠️ No se encontró el punto de exportación. Agregando la función al final del archivo.');
    return content + '\n' + functionCode + '\n';
  }
  
  // Insertar la función antes de la exportación
  const insertPos = exportMatch.index;
  return content.slice(0, insertPos) + functionCode + '\n\n' + content.slice(insertPos);
}

// Actualizar las exportaciones
function updateExports(content) {
  // Buscar el cierre de las exportaciones
  const exportEnd = /};(\s*)$/;
  const exportMatch = exportEnd.exec(content);
  
  if (!exportMatch) {
    log('⚠️ No se encontró el cierre de las exportaciones. No se puede actualizar.');
    return content;
  }
  
  // Verificar si ya incluye sendWhatsAppResponseWithNotification
  const exportsRegex = /module\.exports\s*=\s*\{([^}]*)\}/;
  const exportsContent = exportsRegex.exec(content);
  
  if (!exportsContent || !exportsContent[1]) {
    log('⚠️ No se pudo analizar las exportaciones. No se puede actualizar.');
    return content;
  }
  
  // Si ya está incluida, no hacer nada
  if (exportsContent[1].includes('sendWhatsAppResponseWithNotification')) {
    log('✅ La función ya está incluida en las exportaciones.');
    return content;
  }
  
  // Agregar la función a las exportaciones
  const newExports = content.replace(
    exportsRegex,
    (match, p1) => {
      // Verificar si el último elemento tiene coma
      const needsComma = !p1.trim().endsWith(',');
      return `module.exports = {${p1}${needsComma ? ',' : ''} sendWhatsAppResponseWithNotification}`;
    }
  );
  
  return newExports;
}

// Función principal para actualizar el archivo
async function updateNotificationPatch() {
  log('🚀 Iniciando actualización del sistema de notificaciones');
  
  try {
    // Verificar que exista el archivo
    if (!fs.existsSync(CONFIG.notificationPatchPath)) {
      log(`❌ Error: No se encontró el archivo notification-patch.js en ${CONFIG.notificationPatchPath}`);
      return false;
    }
    
    // Leer el contenido del archivo
    let patchContent = fs.readFileSync(CONFIG.notificationPatchPath, 'utf8');
    
    // Verificar si se necesita actualizar
    const updateStatus = checkIfUpdateNeeded(patchContent);
    
    if (!updateStatus.needsUpdate) {
      log('✅ El sistema de notificaciones ya está actualizado');
      return true;
    }
    
    // Crear copia de seguridad antes de modificar
    const backupPath = backupOriginalFile(CONFIG.notificationPatchPath);
    log(`📦 Copia de seguridad creada en: ${backupPath}`);
    
    // Actualizar el archivo
    if (!updateStatus.hasSendWhatsAppResponseWithNotification) {
      log('🔄 Agregando función sendWhatsAppResponseWithNotification');
      patchContent = addSendWhatsAppResponseWithNotification(patchContent);
    }
    
    if (!updateStatus.isExported) {
      log('🔄 Actualizando exportaciones');
      patchContent = updateExports(patchContent);
    }
    
    // Guardar el archivo modificado
    fs.writeFileSync(CONFIG.notificationPatchPath, patchContent, 'utf8');
    log(`💾 Cambios guardados en ${CONFIG.notificationPatchPath}`);
    
    // Verificar la sintaxis del archivo modificado
    try {
      require('vm').runInNewContext(patchContent, {
        require: () => ({}),
        console: console,
        process: { env: process.env },
        global: {}
      });
      log('✅ Verificación de sintaxis exitosa');
    } catch (syntaxError) {
      log(`⚠️ Advertencia: El archivo modificado puede tener errores de sintaxis: ${syntaxError.message}`);
      log('⚠️ Se restaurará la copia de seguridad para evitar problemas');
      
      // Restaurar la copia de seguridad
      fs.copyFileSync(backupPath, CONFIG.notificationPatchPath);
      log('✅ Copia de seguridad restaurada');
      
      return false;
    }
    
    log('🎉 Actualización del sistema de notificaciones completada con éxito');
    log('📝 El sistema ahora incluye la función sendWhatsAppResponseWithNotification');
    
    return true;
  } catch (error) {
    log(`❌ Error durante la actualización: ${error.message}`);
    log(`📋 Stack: ${error.stack}`);
    return false;
  }
}

// Ejecutar la función principal
updateNotificationPatch()
  .then(success => {
    if (success) {
      log('✅ Proceso de actualización finalizado correctamente');
      process.exit(0);
    } else {
      log('❌ Proceso de actualización finalizado con errores');
      process.exit(1);
    }
  })
  .catch(error => {
    log(`❌ Error fatal durante la actualización: ${error.message}`);
    log(`📋 Stack: ${error.stack}`);
    process.exit(1);
  }); 