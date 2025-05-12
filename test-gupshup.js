// Script para probar la conexión con GupShup
require('dotenv').config();
const axios = require('axios');

// Obtener variables de entorno
const GUPSHUP_API_KEY = process.env.GUPSHUP_API_KEY;
const GUPSHUP_NUMBER = process.env.GUPSHUP_NUMBER;
const TEST_NUMBER = '5212221192568'; // Número al que enviaremos la prueba

async function testGupshupConnection() {
  console.log('🧪 Iniciando prueba de conexión con GupShup...');
  console.log(`🔑 API Key: ${GUPSHUP_API_KEY}`);
  console.log(`📱 Número de origen: ${GUPSHUP_NUMBER}`);
  console.log(`📱 Número de destino: ${TEST_NUMBER}`);
  
  // URL correcta según el diagnóstico
  const apiUrl = 'https://api.gupshup.io/wa/api/v1/msg';
  
  // Formato del mensaje según el diagnóstico
  const formData = new URLSearchParams();
  formData.append('channel', 'whatsapp');
  formData.append('source', GUPSHUP_NUMBER);
  formData.append('destination', TEST_NUMBER);
  formData.append('src.name', GUPSHUP_NUMBER);
  formData.append('message', JSON.stringify({
    type: 'text',
    text: 'Prueba de conexión con GupShup - Formato corregido'
  }));
  
  // Headers según el diagnóstico
  const headers = {
    'Cache-Control': 'no-cache',
    'Content-Type': 'application/x-www-form-urlencoded',
    'apikey': GUPSHUP_API_KEY
  };
  
  console.log('🔄 Enviando mensaje de prueba a WhatsApp...');
  console.log('📝 URL del endpoint:', apiUrl);
  console.log('📝 Headers:', JSON.stringify(headers, null, 2));
  console.log('📝 Datos:', formData.toString());
  
  try {
    const response = await axios.post(apiUrl, formData, { headers });
    
    console.log('✅ ÉXITO!');
    console.log('📡 Respuesta:', JSON.stringify(response.data, null, 2));
    console.log('📊 Código de estado:', response.status);
    return true;
  } catch (error) {
    console.log('❌ ERROR!');
    if (error.response) {
      console.log('📡 Código de estado:', error.response.status);
      console.log('📡 Datos de respuesta:', JSON.stringify(error.response.data, null, 2));
      console.log('📡 Headers de respuesta:', JSON.stringify(error.response.headers, null, 2));
    } else if (error.request) {
      console.log('📡 No se recibió respuesta del servidor');
      console.log('📡 Request:', error.request);
    } else {
      console.log('📡 Error en la configuración de la solicitud:', error.message);
    }
    return false;
  }
}

// Ejecutar la prueba
testGupshupConnection()
  .then(result => {
    if (result) {
      console.log('🎉 La prueba fue exitosa. La conexión con GupShup funciona correctamente.');
    } else {
      console.log('⚠️ La prueba falló. Revisa los errores anteriores para más detalles.');
    }
    process.exit(result ? 0 : 1);
  })
  .catch(err => {
    console.error('❌ Error general:', err);
    process.exit(1);
  }); 