/**
 * Script de prueba para el sistema de notificaciones
 * 
 * Este script prueba todas las funciones del módulo notification-patch.js
 * para verificar su correcto funcionamiento.
 */

require('dotenv').config();
const { 
  checkForNotificationPhrases,
  processMessageForNotification,
  sendBusinessNotification,
  sendWhatsAppResponseWithNotification
} = require('./notification-patch');

// Mock de la función de envío de mensajes para pruebas
const mockSendFunction = async (phoneNumber, message) => {
  console.log(`🔄 [SIMULACIÓN] Enviando mensaje a ${phoneNumber}: ${message}`);
  return {
    success: true,
    messageId: `mock-${Date.now()}`,
    timestamp: new Date().toISOString()
  };
};

// Función para ejecutar las pruebas
async function runTests() {
  console.log('🧪 Iniciando pruebas del sistema de notificaciones');
  
  // Test 1: Verificar frases que requieren notificación
  console.log('\n📋 TEST 1: Detección de frases que requieren notificación');
  
  const testMessages = [
    { text: 'Hola, ¿cómo estás?', shouldRequire: false },
    { text: 'No puedo ayudarte con eso, necesitarás hablar con un agente humano', shouldRequire: true },
    { text: 'Esto está fuera de mi alcance', shouldRequire: true },
    { text: 'Necesito transferirte a un especialista', shouldRequire: true }
  ];
  
  for (const test of testMessages) {
    const result = checkForNotificationPhrases(test.text, 'BOT');
    const match = result.requiresNotification === test.shouldRequire;
    
    console.log(`- Mensaje: "${test.text.substring(0, 40)}${test.text.length > 40 ? '...' : ''}"`);
    console.log(`  ¿Requiere notificación?: ${result.requiresNotification ? 'SÍ ✅' : 'NO ❌'}`);
    
    if (result.requiresNotification) {
      console.log(`  Coincidencias: ${result.matches.join(', ')}`);
    }
    
    console.log(`  Resultado: ${match ? 'CORRECTO ✅' : 'INCORRECTO ❌'}`);
  }
  
  // Test 2: Procesar mensaje para notificación
  console.log('\n📋 TEST 2: Procesamiento de mensajes para notificación');
  
  try {
    const conversationId = 'test-conversation-' + Date.now();
    const phoneNumber = '5215512345678';
    const message = 'Lo siento, esto está fuera de mi alcance. Necesitas hablar con un agente humano.';
    
    console.log(`- Procesando mensaje para notificación:`);
    console.log(`  Mensaje: "${message}"`);
    console.log(`  Conversación: ${conversationId}`);
    console.log(`  Teléfono: ${phoneNumber}`);
    
    const result = await processMessageForNotification(message, 'bot', conversationId, phoneNumber);
    
    console.log(`  Resultado: ${JSON.stringify(result, null, 2)}`);
  } catch (error) {
    console.error(`❌ Error en Test 2: ${error.message}`);
  }
  
  // Test 3: Envío de notificación
  console.log('\n📋 TEST 3: Envío de notificación');
  
  try {
    const conversationId = 'test-notification-' + Date.now();
    const phoneNumber = '5215512345678';
    const message = 'Necesitas hablar con un representante. Este es un mensaje de prueba.';
    
    console.log(`- Enviando notificación de prueba:`);
    console.log(`  Conversación: ${conversationId}`);
    console.log(`  Teléfono: ${phoneNumber}`);
    
    const result = await sendBusinessNotification(conversationId, message, phoneNumber);
    
    console.log(`  Notificación enviada: ${result ? 'SÍ ✅' : 'NO ❌'}`);
  } catch (error) {
    console.error(`❌ Error en Test 3: ${error.message}`);
  }
  
  // Test 4: Prueba de sendWhatsAppResponseWithNotification
  console.log('\n📋 TEST 4: Envío de mensaje con verificación de notificación');
  
  try {
    const phoneNumber = '5215512345678';
    const conversationId = 'test-whatsapp-' + Date.now();
    
    // Caso 1: Mensaje que no requiere notificación
    const normalMessage = 'Hola, soy el asistente virtual. ¿En qué puedo ayudarte?';
    
    console.log(`- Enviando mensaje normal (no debería notificar):`);
    console.log(`  Mensaje: "${normalMessage}"`);
    
    const normalResult = await sendWhatsAppResponseWithNotification(phoneNumber, normalMessage, {
      sendFunction: mockSendFunction,
      conversationId
    });
    
    console.log(`  Resultado: ${JSON.stringify(normalResult, null, 2)}`);
    
    // Caso 2: Mensaje que requiere notificación
    const notifyMessage = 'No puedo procesar tu solicitud. Necesitas hablar con un agente humano.';
    
    console.log(`\n- Enviando mensaje que requiere notificación:`);
    console.log(`  Mensaje: "${notifyMessage}"`);
    
    const notifyResult = await sendWhatsAppResponseWithNotification(phoneNumber, notifyMessage, {
      sendFunction: mockSendFunction,
      conversationId
    });
    
    console.log(`  Resultado: ${JSON.stringify(notifyResult, null, 2)}`);
    
    // Caso 3: Omitir verificación de notificación
    console.log(`\n- Omitiendo verificación de notificación:`);
    
    const skipResult = await sendWhatsAppResponseWithNotification(phoneNumber, notifyMessage, {
      sendFunction: mockSendFunction,
      conversationId,
      skipNotificationCheck: true
    });
    
    console.log(`  Resultado: ${JSON.stringify(skipResult, null, 2)}`);
  } catch (error) {
    console.error(`❌ Error en Test 4: ${error.message}`);
  }
  
  console.log('\n✅ Pruebas completadas');
}

// Ejecutar las pruebas
console.log('🚀 Iniciando script de prueba de notificaciones');
runTests()
  .then(() => console.log('🎉 Script finalizado'))
  .catch(error => {
    console.error(`❌ Error en la ejecución del script: ${error.message}`);
    console.error(error.stack);
  }); 