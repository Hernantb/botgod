// Script para probar la conexión con GupShup usando una implementación alternativa
require('dotenv').config();
const axios = require('axios');

// Credenciales hardcodeadas para la prueba (extraídas de SOLUCION_API_GUPSHUP.md)
const GUPSHUP_API_KEY = 'sk_58a31041fdeb4d98b9f0e073792a6e6b';
const GUPSHUP_NUMBER = '15557033313';
const GUPSHUP_USERID = 'crxty1qflktvwvm7sodtrfe9dpvoowm1';

async function testGupShupAlternative() {
  console.log('🧪 Iniciando prueba alternativa de conexión con GupShup...');
  
  // Datos de prueba
  const targetPhone = '5212221192568';
  const message = 'Prueba alternativa de envío a WhatsApp';
  
  console.log(`🔑 API Key: ${GUPSHUP_API_KEY.substring(0, 5)}...`);
  console.log(`📱 Número de origen: ${GUPSHUP_NUMBER}`);
  console.log(`👤 User ID: ${GUPSHUP_USERID.substring(0, 5)}...`);
  console.log(`📱 Número de destino: ${targetPhone}`);
  console.log(`💬 Mensaje: ${message}`);
  
  try {
    // Enviar mensaje a WhatsApp directamente (copia del código en index.js)
    const apiUrl = 'https://api.gupshup.io/wa/api/v1/msg';
    const formattedNumber = targetPhone.toString().replace(/^\+/, '');
    
    const formData = new URLSearchParams();
    formData.append('channel', 'whatsapp');
    formData.append('source', GUPSHUP_NUMBER);
    formData.append('destination', formattedNumber);
    formData.append('src.name', GUPSHUP_NUMBER);
    formData.append('message', JSON.stringify({
      type: 'text',
      text: message
    }));
    
    const headers = {
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/x-www-form-urlencoded',
      'apikey': GUPSHUP_API_KEY,
      'userid': GUPSHUP_USERID
    };
    
    console.log('🔄 Enviando mensaje directamente a la API de GupShup...');
    console.log('📊 URL:', apiUrl);
    console.log('📊 Headers:', JSON.stringify({
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/x-www-form-urlencoded',
      'apikey': `${GUPSHUP_API_KEY.substring(0, 5)}...`,
      'userid': `${GUPSHUP_USERID.substring(0, 5)}...`
    }));
    console.log('📊 FormData:', formData.toString());
    
    const response = await axios.post(apiUrl, formData, { headers });
    
    if (response.status >= 200 && response.status < 300) {
      console.log('✅ Mensaje enviado exitosamente a WhatsApp');
      console.log('📊 Respuesta de GupShup:', JSON.stringify(response.data, null, 2));
      return true;
    } else {
      console.error(`❌ Error en la respuesta de GupShup: ${response.status}`);
      console.error('Detalles:', JSON.stringify(response.data, null, 2));
      return false;
    }
  } catch (error) {
    console.error('❌ Error enviando el mensaje:');
    if (error.response) {
      console.error(`Código de estado: ${error.response.status}`);
      console.error('Datos de la respuesta:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('No se recibió respuesta del servidor');
    } else {
      console.error(`Error en la configuración de la solicitud: ${error.message}`);
    }
    return false;
  }
}

// Ejecutar prueba
testGupShupAlternative()
  .then(success => {
    if (success) {
      console.log('🎉 La prueba alternativa fue exitosa');
      process.exit(0);
    } else {
      console.log('⚠️ La prueba alternativa falló');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('❌ Error general:', err);
    process.exit(1);
  }); 