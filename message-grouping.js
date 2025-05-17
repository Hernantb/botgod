/**
 * Módulo para agrupar mensajes que llegan en intervalos cortos de tiempo
 * y procesarlos como un solo mensaje para evitar respuestas múltiples.
 */

// Exportar funciones y variables para usar en index.js
module.exports = {
  setupMessageGrouping,
  addToPendingMessageGroup,
  processMessageGroup,
  processSingleMessage
};

// Configuración para agrupamiento de mensajes
const MESSAGE_GROUP_WAIT_TIME = 3000; // 3 segundos de espera para agrupar mensajes
const MAX_MESSAGE_GROUP_WAIT = 5000; // Máximo 5 segundos de espera
const pendingMessageGroups = new Map(); // Almacena los mensajes pendientes por conversación

// Referencias a las funciones que necesitamos del archivo principal
let processMessageWithOpenAI;
let sendWhatsAppResponse;

/**
 * Configura el módulo con las funciones necesarias del archivo principal
 * @param {Object} config Objeto con las funciones necesarias
 */
function setupMessageGrouping(config) {
  processMessageWithOpenAI = config.processMessageWithOpenAI;
  sendWhatsAppResponse = config.sendWhatsAppResponse;
  
  console.log('✅ Módulo de agrupamiento de mensajes inicializado correctamente');
  return true;
}

/**
 * Añade un mensaje al grupo pendiente de una conversación
 * @param {string} conversationId ID de la conversación
 * @param {Object} messageData Datos del mensaje
 * @returns {boolean} true si el mensaje debe esperar, false en caso contrario
 */
function addToPendingMessageGroup(conversationId, messageData) {
  if (!conversationId) return false;
  
  // Verificar que las funciones necesarias estén configuradas
  if (!processMessageWithOpenAI || !sendWhatsAppResponse) {
    console.error('❌ Módulo de agrupamiento no inicializado correctamente');
    return false;
  }
  
  // Obtener o crear el grupo para esta conversación
  if (!pendingMessageGroups.has(conversationId)) {
    pendingMessageGroups.set(conversationId, {
      messages: [],
      timeoutId: null,
      firstMessageTime: Date.now()
    });
  }
  
  const group = pendingMessageGroups.get(conversationId);
  
  // Agregar el mensaje al grupo
  group.messages.push(messageData);
  console.log(`📎 Mensaje añadido al grupo de ${conversationId}. Total: ${group.messages.length}`);
  
  // Limpiar el timeout anterior si existe
  if (group.timeoutId) {
    clearTimeout(group.timeoutId);
  }
  
  // Calcular cuánto tiempo debe esperar para ver si llegan más mensajes
  const elapsedTime = Date.now() - group.firstMessageTime;
  let remainingWaitTime = MESSAGE_GROUP_WAIT_TIME;
  
  // Si ya ha pasado mucho tiempo desde el primer mensaje, reducir el tiempo de espera
  if (elapsedTime > MAX_MESSAGE_GROUP_WAIT) {
    remainingWaitTime = 500; // Espera mínima de 500ms
  } else {
    remainingWaitTime = Math.min(MESSAGE_GROUP_WAIT_TIME, MAX_MESSAGE_GROUP_WAIT - elapsedTime);
  }
  
  // Establecer un nuevo timeout para procesar este grupo
  group.timeoutId = setTimeout(() => {
    processMessageGroup(conversationId);
  }, remainingWaitTime);
  
  return true; // Indicar que debe esperar y no procesar inmediatamente
}

/**
 * Procesa un grupo de mensajes como uno solo
 * @param {string} conversationId ID de la conversación
 */
async function processMessageGroup(conversationId) {
  if (!pendingMessageGroups.has(conversationId)) {
    console.log(`⚠️ No hay grupo de mensajes pendientes para ${conversationId}`);
    return;
  }
  
  const group = pendingMessageGroups.get(conversationId);
  const messages = group.messages;
  
  // Eliminar el grupo para evitar reprocesamiento
  pendingMessageGroups.delete(conversationId);
  
  if (!messages || messages.length === 0) {
    console.log(`⚠️ Grupo de mensajes vacío para ${conversationId}`);
    return;
  }
  
  console.log(`🔄 Procesando grupo de ${messages.length} mensajes para conversación ${conversationId}`);
  
  // Si solo hay un mensaje, procesarlo normalmente
  if (messages.length === 1) {
    const singleMessage = messages[0];
    console.log(`🔹 Procesando mensaje único: "${singleMessage.message.substring(0, 50)}${singleMessage.message.length > 50 ? '...' : ''}"`);
    await processSingleMessage(singleMessage);
    return;
  }
  
  // Ordenar mensajes por timestamp para mantener el orden correcto
  messages.sort((a, b) => {
    const timeA = a.timestamp || a.receivedAt;
    const timeB = b.timestamp || b.receivedAt;
    return timeA - timeB;
  });
  
  // Combinar todos los mensajes en uno solo para procesamiento
  const combinedMessage = messages.map(m => m.message).join('\n');
  const firstMessage = messages[0];
  
  console.log(`🔀 Combinando ${messages.length} mensajes:`);
  messages.forEach((m, i) => {
    console.log(`  ${i+1}: "${m.message.substring(0, 30)}${m.message.length > 30 ? '...' : ''}"`);
  });
  
  console.log(`📝 Mensaje combinado: "${combinedMessage.substring(0, 50)}${combinedMessage.length > 50 ? '...' : ''}"`);
  
  // Procesar el mensaje combinado
  try {
    // Procesar con OpenAI y obtener respuesta
    const botResponse = await processMessageWithOpenAI(firstMessage.sender, combinedMessage, conversationId, process.env.BUSINESS_ID);
    
    if (botResponse) {
      console.log(`✅ Respuesta generada por OpenAI para mensaje combinado: "${botResponse.substring(0, 50)}${botResponse.length > 50 ? '...' : ''}"`);
      
      // Asegurar que el mensaje se envía correctamente
      let sendAttempts = 0;
      let sendSuccess = false;
      
      while (!sendSuccess && sendAttempts < 3) {
        sendAttempts++;
        console.log(`📤 Intento #${sendAttempts} de envío de respuesta a WhatsApp`);
        sendSuccess = await sendWhatsAppResponse(firstMessage.sender, botResponse);
        
        if (sendSuccess) {
          console.log(`✅ Respuesta enviada exitosamente a WhatsApp para ${firstMessage.sender} en intento #${sendAttempts}`);
        } else if (sendAttempts < 3) {
          console.log(`⚠️ Reintentando envío en 1 segundo...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      if (!sendSuccess) {
        console.error(`❌ No se pudo enviar la respuesta después de ${sendAttempts} intentos`);
      }
    } else {
      console.log(`⚠️ OpenAI no generó respuesta para el mensaje combinado de ${firstMessage.sender}`);
    }
  } catch (aiError) {
    console.error(`❌ Error procesando mensaje combinado con OpenAI: ${aiError.message}`);
  }
}

/**
 * Procesa un mensaje individual
 * @param {Object} messageData Datos del mensaje
 */
async function processSingleMessage(messageData) {
  const { sender, message, conversationId } = messageData;
  
  try {
    // Procesar con OpenAI y obtener respuesta
    const botResponse = await processMessageWithOpenAI(sender, message, conversationId, process.env.BUSINESS_ID);
    
    if (botResponse) {
      console.log(`✅ Respuesta generada por OpenAI: "${botResponse.substring(0, 50)}${botResponse.length > 50 ? '...' : ''}"`);
      
      // Asegurar que el mensaje se envía correctamente
      let sendAttempts = 0;
      let sendSuccess = false;
      
      while (!sendSuccess && sendAttempts < 3) {
        sendAttempts++;
        console.log(`📤 Intento #${sendAttempts} de envío de respuesta a WhatsApp`);
        sendSuccess = await sendWhatsAppResponse(sender, botResponse);
        
        if (sendSuccess) {
          console.log(`✅ Respuesta enviada exitosamente a WhatsApp para ${sender} en intento #${sendAttempts}`);
        } else if (sendAttempts < 3) {
          console.log(`⚠️ Reintentando envío en 1 segundo...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      if (!sendSuccess) {
        console.error(`❌ No se pudo enviar la respuesta después de ${sendAttempts} intentos`);
      }
    } else {
      console.log(`⚠️ OpenAI no generó respuesta para el mensaje de ${sender}`);
    }
  } catch (aiError) {
    console.error(`❌ Error procesando con OpenAI: ${aiError.message}`);
  }
} 