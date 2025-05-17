// Script para probar la implementación corregida de whatsapp-sender.js
require('dotenv').config();
const sendWhatsAppResponse = require('./whatsapp-sender');

// Credenciales hardcodeadas para la prueba (extraídas de SOLUCION_API_GUPSHUP.md)
const GUPSHUP_API_KEY = 'sk_58a31041fdeb4d98b9f0e073792a6e6b';
const GUPSHUP_NUMBER = '15557033313';
const GUPSHUP_USERID = 'crxty1qflktvwvm7sodtrfe9dpvoowm1';
const TEST_NUMBER = '5212221192568'; // Número al que enviaremos la prueba

async function testFixedSender() {
  console.log('🧪 Iniciando prueba del sender corregido...');
  console.log(`🔑 API Key: ${GUPSHUP_API_KEY.substring(0, 5)}...`);
  console.log(`📱 Número de origen: ${GUPSHUP_NUMBER}`);
  console.log(`👤 User ID: ${GUPSHUP_USERID.substring(0, 5)}...`);
  console.log(`📱 Número de destino: ${TEST_NUMBER}`);

  // Configuración simulada del negocio
  const mockBusinessConfig = {
    business_name: 'Test Business',
    gupshup_api_key: GUPSHUP_API_KEY,
    gupshup_number: GUPSHUP_NUMBER,
    gupshup_userid: GUPSHUP_USERID
  };

  console.log('📋 Configuración del negocio:');
  console.log(JSON.stringify({
    business_name: mockBusinessConfig.business_name,
    gupshup_api_key: `${mockBusinessConfig.gupshup_api_key.substring(0, 5)}...`,
    gupshup_number: mockBusinessConfig.gupshup_number,
    gupshup_userid: `${mockBusinessConfig.gupshup_userid.substring(0, 5)}...`
  }, null, 2));

  try {
    const result = await sendWhatsAppResponse(
      TEST_NUMBER,
      'Prueba de corrección de sendWhatsAppResponse con URL /wa/ y userid en headers',
      mockBusinessConfig
    );

    if (result.success) {
      console.log('✅ ÉXITO!');
      console.log('📡 Resultado:', JSON.stringify(result, null, 2));
      return true;
    } else {
      console.log('❌ ERROR!');
      console.log('📡 Error:', result.error);
      console.log('📡 Detalles:', JSON.stringify(result.details, null, 2));
      return false;
    }
  } catch (error) {
    console.log('❌ ERROR GENERAL!');
    console.log('📡 Error:', error.message);
    return false;
  }
}

// Ejecutar la prueba
testFixedSender()
  .then(result => {
    if (result) {
      console.log('🎉 La prueba fue exitosa. La solución funciona correctamente.');
    } else {
      console.log('⚠️ La prueba falló. Revisa los errores anteriores para más detalles.');
    }
    process.exit(result ? 0 : 1);
  })
  .catch(err => {
    console.error('❌ Error general:', err);
    process.exit(1);
  }); 