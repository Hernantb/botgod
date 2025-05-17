/**
 * Script para probar el mensaje específico que falló
 */
const axios = require('axios');
const { checkForNotificationPhrases } = require('./server.js');

// Configuración
const CONVERSATION_ID = '4a42aa05-2ffd-418b-aa52-29e7c571eee8';
const PHONE_NUMBER = '5212221192568';
const SERVER_URL = 'http://localhost:7777';

// El mensaje exacto que falló
const message = "¡Perfecto! tu cita ha sido confirmada para las 9.";

// Test local de detección
function testLocal() {
  console.log('🧪 PRUEBA LOCAL DE DETECCIÓN:');
  console.log(`📝 Mensaje: "${message}"`);
  
  try {
    const result = checkForNotificationPhrases(message);
    console.log(`📊 Resultado: ${result ? '✅ DETECTADO (requiere notificación)' : '❌ NO DETECTADO (no requiere notificación)'}`);
    return result;
  } catch (error) {
    console.error(`❌ Error en test local: ${error.message}`);
    return false;
  }
}

// Test de webhook
async function testWebhook() {
  console.log('\n🧪 PRUEBA DE WEBHOOK:');
  console.log(`📝 Enviando mensaje al webhook: "${message}"`);
  
  try {
    const response = await axios.post(`${SERVER_URL}/api/whatsapp-webhook`, {
      message,
      conversationId: CONVERSATION_ID,
      from_bot: true
    });
    
    console.log(`📊 Respuesta: ${JSON.stringify(response.data)}`);
    console.log(`📊 ¿Requiere notificación?: ${response.data.needsNotification ? '✅ SÍ' : '❌ NO'}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Error en test webhook: ${error.message}`);
    return null;
  }
}

// Test manual de notificación
async function testNotification() {
  console.log('\n🧪 PRUEBA MANUAL DE NOTIFICACIÓN:');
  console.log(`📝 Enviando solicitud de notificación manual para mensaje: "${message}"`);
  
  try {
    const response = await axios.post(`${SERVER_URL}/api/messages`, {
      message,
      conversationId: CONVERSATION_ID,
      from_bot: true,
      needs_notification: true,
      phone_number: PHONE_NUMBER
    });
    
    console.log(`📊 Respuesta: ${JSON.stringify(response.data)}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Error en test manual: ${error.message}`);
    return null;
  }
}

// Ejecutar pruebas
async function runTests() {
  console.log('🚀 INICIANDO PRUEBAS PARA MENSAJE PROBLEMÁTICO');
  console.log('=============================================');
  
  // 1. Probar detección local
  const localResult = testLocal();
  
  // Solo continuar si la detección local fue exitosa
  if (localResult) {
    // 2. Probar webhook
    await testWebhook();
    
    // 3. Forzar notificación manual
    await testNotification();
  } else {
    console.log('❌ La detección local falló, no se ejecutarán las pruebas restantes');
  }
  
  console.log('\n✅ PRUEBAS COMPLETADAS');
}

// Ejecutar
runTests().catch(error => {
  console.error('Error general:', error);
}); 