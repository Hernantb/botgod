/**
 * Script para probar la detección de notificaciones
 * Envía una solicitud al webhook de WhatsApp simulando un mensaje del bot
 */

const axios = require('axios');

// Configuraciones
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:7777';
const WHATSAPP_BOT_URL = process.env.WHATSAPP_BOT_URL || 'http://localhost:3095';
const CONVERSATION_ID = '4a42aa05-2ffd-418b-aa52-29e7c571eee8'; // ID de la conversación que se usó en los logs

// Mensajes de prueba - Lista de mensajes comunes que debería activar notificaciones
const testMessages = [
  "¡Perfecto! Tu cita ha sido confirmada para las 9.",
  "¡Perfecto! Tu cita ha sido confirmada para mañana a las 3:30 pm.",
  "Perfecto! Un asesor te llamará mañana a las 2 pm.",
  "Tu cita ha sido registrada para el lunes 15 de mayo.",
  "Hemos confirmado tu cita para el jueves a las 10 am."
];

// Función para probar la detección directamente
async function testDetection() {
  try {
    console.log('🧪 PRUEBA DE DETECCIÓN DE FRASES DE NOTIFICACIÓN');
    console.log('-------------------------------------------');
    
    for (const message of testMessages) {
      console.log(`\n📝 Probando mensaje: "${message}"`);
      
      try {
        // Probar con el endpoint específico de prueba
        const detectionResponse = await axios.post(`${WHATSAPP_BOT_URL}/api/test-notification-detection`, {
          message
        });
        
        const requiresNotification = detectionResponse.data.requiresNotification;
        console.log(`📊 Resultado: ${requiresNotification ? '✅ DEBE NOTIFICAR' : '❌ NO DEBE NOTIFICAR'}`);
      } catch (error) {
        console.error(`❌ Error al probar detección: ${error.message}`);
      }
    }
  } catch (error) {
    console.error(`❌ Error general: ${error.message}`);
  }
}

// Función para probar el webhook de WhatsApp
async function testWebhook() {
  try {
    console.log('\n🧪 PRUEBA DE WEBHOOK DE WHATSAPP');
    console.log('-------------------------------------------');
    
    // Usar el primer mensaje como prueba para el webhook
    const message = testMessages[0];
    console.log(`\n📝 Enviando mensaje al webhook: "${message}"`);
    
    try {
      // Simular una solicitud al webhook como si fuera un mensaje del bot
      const webhookResponse = await axios.post(`${SERVER_URL}/api/whatsapp-webhook`, {
        message,
        conversationId: CONVERSATION_ID,
        from_bot: true
      });
      
      console.log(`📊 Respuesta del webhook: ${JSON.stringify(webhookResponse.data)}`);
    } catch (error) {
      console.error(`❌ Error al probar webhook: ${error.message}`);
    }
  } catch (error) {
    console.error(`❌ Error general: ${error.message}`);
  }
}

// Función para simular una notificación manual
async function testManualNotification() {
  try {
    console.log('\n🧪 PRUEBA DE NOTIFICACIÓN MANUAL');
    console.log('-------------------------------------------');
    
    // Usar el primer mensaje como prueba
    const message = testMessages[0];
    console.log(`\n📝 Enviando solicitud de notificación manual: "${message}"`);
    
    try {
      // Simular una solicitud de notificación manual
      const notificationResponse = await axios.post(`${WHATSAPP_BOT_URL}/api/send-notification`, {
        conversationId: CONVERSATION_ID,
        botMessage: message,
        clientPhoneNumber: '5212221192568'
      });
      
      console.log(`📊 Respuesta: ${JSON.stringify(notificationResponse.data)}`);
    } catch (error) {
      console.error(`❌ Error al probar notificación manual: ${error.message}`);
    }
  } catch (error) {
    console.error(`❌ Error general: ${error.message}`);
  }
}

// Ejecutar las pruebas
async function runTests() {
  console.log('🚀 INICIANDO PRUEBAS DE NOTIFICACIÓN');
  console.log('===================================');
  
  // 1. Probar la detección de frases
  await testDetection();
  
  // 2. Probar el webhook
  await testWebhook();
  
  // 3. Probar la notificación manual
  await testManualNotification();
  
  console.log('\n✅ PRUEBAS COMPLETADAS');
}

// Ejecutar todo el proceso
runTests().catch(err => {
  console.error('Error fatal:', err);
}); 