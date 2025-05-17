/**
 * Script para probar el envío real de notificaciones por correo
 * Envía una solicitud al servidor para procesar un mensaje del bot que requiere notificación
 */

const axios = require('axios');
require('dotenv').config(); // Cargar variables de entorno

// Configuraciones
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:7777';
const CONVERSATION_ID = process.env.TEST_CONVERSATION_ID || '4a42aa05-2ffd-418b-aa52-29e7c571eee8';
const CLIENT_PHONE = process.env.TEST_CLIENT_PHONE || '5212221192568';

// Mensajes de prueba - Lista de mensajes que deberían activar notificaciones
const testMessages = [
  "¡Perfecto! Tu cita ha sido confirmada para las 9.",
  "¡Perfecto! Un asesor te llamará mañana a las 2 pm.",
  "Tu cita ha sido registrada para el lunes 15 de mayo.",
  "Hemos confirmado tu cita para el jueves a las 10 am."
];

// Función principal para probar la notificación
async function testRealNotification() {
  try {
    console.log('🚀 INICIANDO PRUEBA DE NOTIFICACIÓN REAL');
    console.log('===================================');
    console.log(`🔗 Servidor: ${SERVER_URL}`);
    console.log(`🆔 ID de conversación: ${CONVERSATION_ID}`);
    console.log(`📱 Teléfono: ${CLIENT_PHONE}`);
    
    // Seleccionar un mensaje aleatorio
    const randomIndex = Math.floor(Math.random() * testMessages.length);
    const message = testMessages[randomIndex];
    
    console.log(`\n📝 Mensaje de prueba: "${message}"`);
    
    // 1. Verificar que el mensaje requiere notificación
    console.log('\n🔍 Verificando si el mensaje requiere notificación...');
    try {
      const verifyResponse = await axios.post(`${SERVER_URL}/api/process-whatsapp-message`, {
        message,
        isFromBot: true,
        phoneNumber: CLIENT_PHONE,
        conversationId: CONVERSATION_ID
      });
      
      console.log(`ℹ️ Respuesta del servidor: ${JSON.stringify(verifyResponse.data)}`);
      
      if (verifyResponse.data.notificationSent) {
        console.log('✅ Notificación enviada correctamente');
      } else {
        console.log('❌ La notificación no fue enviada');
      }
      
    } catch (error) {
      console.error(`❌ Error al verificar notificación: ${error.message}`);
      if (error.response) {
        console.error(`ℹ️ Respuesta del servidor: ${JSON.stringify(error.response.data)}`);
      }
    }
    
    // 2. Llamar directamente a la función de notificación
    console.log('\n📧 Enviando notificación directamente...');
    try {
      const directResponse = await axios.post(`${SERVER_URL}/api/send-notification`, {
        conversationId: CONVERSATION_ID,
        botMessage: message,
        clientPhoneNumber: CLIENT_PHONE
      });
      
      console.log(`ℹ️ Respuesta del servidor: ${JSON.stringify(directResponse.data)}`);
      
      if (directResponse.data.success) {
        console.log('✅ Notificación enviada correctamente (método directo)');
      } else {
        console.log('❌ La notificación no fue enviada (método directo)');
      }
    } catch (error) {
      console.error(`❌ Error al enviar notificación directa: ${error.message}`);
      if (error.response) {
        console.error(`ℹ️ Respuesta del servidor: ${JSON.stringify(error.response.data)}`);
      }
    }
    
    console.log('\n✅ PRUEBA COMPLETADA');
    
  } catch (error) {
    console.error(`❌ Error general: ${error.message}`);
  }
}

// Función para verificar la configuración de correo
async function checkEmailConfig() {
  console.log('\n📋 VERIFICANDO CONFIGURACIÓN DE CORREO');
  console.log('===================================');
  
  // Verificar variables de entorno
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASSWORD;
  
  if (!emailUser) {
    console.error('❌ Variable EMAIL_USER no configurada');
  } else {
    console.log(`✅ EMAIL_USER: ${emailUser}`);
  }
  
  if (!emailPass) {
    console.error('❌ Variable EMAIL_PASSWORD no configurada');
  } else {
    console.log(`✅ EMAIL_PASSWORD: Configurada (${emailPass.length} caracteres)`);
  }
}

// Función para verificar el estado de las columnas de notificación
async function checkNotificationColumns() {
  try {
    console.log('\n📊 VERIFICANDO COLUMNAS DE NOTIFICACIÓN');
    console.log('===================================');
    
    // Verificar si existe la ruta para comprobar las columnas
    const response = await axios.get(`${SERVER_URL}/api/check-notification-columns`);
    
    if (response.data.success) {
      console.log('✅ Las columnas necesarias están presentes');
      console.log(response.data.columns);
    } else {
      console.error('❌ Faltan algunas columnas necesarias');
      console.error(response.data.message);
    }
  } catch (error) {
    console.log('ℹ️ El endpoint para verificar columnas no está disponible.');
    console.log('Para verificar, ejecuta el script SQL en el panel de Supabase y revisa si hay errores.');
  }
}

// Ejecutar las pruebas
async function runAllChecks() {
  // 1. Verificar configuración de correo
  await checkEmailConfig();
  
  // 2. Verificar columnas de notificación
  await checkNotificationColumns();
  
  // 3. Probar notificación real
  await testRealNotification();
}

// Ejecutar todas las pruebas
runAllChecks().catch(error => {
  console.error('Error fatal:', error);
}); 