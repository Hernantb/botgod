/**
 * DIAGNÓSTICO EXHAUSTIVO DE GUPSHUP API
 * 
 * Este script prueba múltiples configuraciones de autenticación y formatos de solicitud
 * para determinar la causa exacta del problema con la API de GupShup.
 */

require('dotenv').config();
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Credenciales de GupShup desde SOLUCION_API_GUPSHUP.md
const GUPSHUP_CREDENTIALS = {
  apiKey: 'sk_58a31041fdeb4d98b9f0e073792a6e6b',
  number: '15557033313',
  userid: 'crxty1qflktvwvm7sodtrfe9dpvoowm1'
};

// Número de teléfono de destino para pruebas
const TEST_NUMBER = '5212221192568';

// Mensaje de prueba
const TEST_MESSAGE = 'Prueba de diagnóstico GupShup - ' + new Date().toISOString();

// URLs a probar
const URLS_TO_TEST = [
  'https://api.gupshup.io/wa/api/v1/msg',
  'https://api.gupshup.io/sm/api/v1/msg',
  'https://api.gupshup.io/wa/api/v2/msg',
  'https://api.gupshup.io/sm/api/v2/msg',
  'https://api.gupshup.io/wa/api/v1/template/msg',
  'https://partner.gupshup.io/partner/app/APPID/v3/message'
];

// Diferentes formatos de encabezados a probar
const HEADER_FORMATS = [
  {
    name: 'Solo apikey',
    headers: {
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/x-www-form-urlencoded',
      'apikey': GUPSHUP_CREDENTIALS.apiKey
    }
  },
  {
    name: 'apikey y userid',
    headers: {
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/x-www-form-urlencoded',
      'apikey': GUPSHUP_CREDENTIALS.apiKey,
      'userid': GUPSHUP_CREDENTIALS.userid
    }
  },
  {
    name: 'Authorization header',
    headers: {
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Bearer ${GUPSHUP_CREDENTIALS.apiKey}`
    }
  },
  {
    name: 'apikey y userid con x-',
    headers: {
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/x-www-form-urlencoded',
      'x-apikey': GUPSHUP_CREDENTIALS.apiKey,
      'x-userid': GUPSHUP_CREDENTIALS.userid
    }
  },
  {
    name: 'apikey y userid como parámetros',
    headers: {
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    params: {
      'apikey': GUPSHUP_CREDENTIALS.apiKey,
      'userid': GUPSHUP_CREDENTIALS.userid
    }
  }
];

// Diferentes formatos de datos del cuerpo a probar
const BODY_FORMATS = [
  {
    name: 'FormData estándar',
    getData: () => {
      const formData = new URLSearchParams();
      formData.append('channel', 'whatsapp');
      formData.append('source', GUPSHUP_CREDENTIALS.number);
      formData.append('destination', TEST_NUMBER);
      formData.append('src.name', GUPSHUP_CREDENTIALS.number);
      formData.append('message', JSON.stringify({
        type: 'text',
        text: TEST_MESSAGE
      }));
      return formData;
    }
  },
  {
    name: 'message como texto plano',
    getData: () => {
      const formData = new URLSearchParams();
      formData.append('channel', 'whatsapp');
      formData.append('source', GUPSHUP_CREDENTIALS.number);
      formData.append('destination', TEST_NUMBER);
      formData.append('src.name', GUPSHUP_CREDENTIALS.number);
      formData.append('message', TEST_MESSAGE);
      return formData;
    }
  },
  {
    name: 'JSON en el cuerpo',
    getData: () => {
      return {
        channel: 'whatsapp',
        source: GUPSHUP_CREDENTIALS.number,
        destination: TEST_NUMBER,
        'src.name': GUPSHUP_CREDENTIALS.number,
        message: {
          type: 'text',
          text: TEST_MESSAGE
        }
      };
    },
    contentType: 'application/json'
  },
  {
    name: 'Formato de template',
    getData: () => {
      const formData = new URLSearchParams();
      formData.append('channel', 'whatsapp');
      formData.append('source', GUPSHUP_CREDENTIALS.number);
      formData.append('destination', TEST_NUMBER);
      formData.append('src.name', GUPSHUP_CREDENTIALS.number);
      formData.append('template', JSON.stringify({
        id: 'test_template',
        params: [TEST_MESSAGE]
      }));
      return formData;
    }
  },
  {
    name: 'Formato v3',
    getData: () => {
      return {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: TEST_NUMBER,
        type: 'text',
        text: {
          body: TEST_MESSAGE
        }
      };
    },
    contentType: 'application/json'
  }
];

// Función principal de diagnóstico
async function runDiagnostic() {
  console.log('🔍 INICIANDO DIAGNÓSTICO EXHAUSTIVO DE GUPSHUP API');
  console.log('======================================================');
  console.log(`📱 Número de destino para pruebas: ${TEST_NUMBER}`);
  console.log(`💬 Mensaje de prueba: ${TEST_MESSAGE}`);
  console.log('======================================================\n');

  // Verificar credenciales
  console.log('👤 CREDENCIALES A UTILIZAR:');
  console.log(`   API Key: ${GUPSHUP_CREDENTIALS.apiKey.substring(0, 5)}...`);
  console.log(`   Número: ${GUPSHUP_CREDENTIALS.number}`);
  console.log(`   UserID: ${GUPSHUP_CREDENTIALS.userid.substring(0, 5)}...\n`);

  // Crear directorio para resultados
  const resultDir = path.join(process.cwd(), 'gupshup-diagnosis');
  if (!fs.existsSync(resultDir)) {
    fs.mkdirSync(resultDir);
  }

  // Archivo para guardar resultados
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultFile = path.join(resultDir, `diagnosis-${timestamp}.json`);
  const results = [];

  // Ejecutar pruebas para cada combinación
  let testCount = 0;
  const totalTests = URLS_TO_TEST.length * HEADER_FORMATS.length * BODY_FORMATS.length;

  console.log(`🧪 Se ejecutarán ${totalTests} combinaciones diferentes de pruebas...\n`);

  for (const url of URLS_TO_TEST) {
    console.log(`\n🌐 PROBANDO URL: ${url}`);

    for (const headerFormat of HEADER_FORMATS) {
      console.log(`\n   🔑 Formato de encabezados: ${headerFormat.name}`);

      for (const bodyFormat of BODY_FORMATS) {
        testCount++;
        console.log(`      📦 Formato de datos: ${bodyFormat.name} (Prueba ${testCount}/${totalTests})`);

        try {
          // Preparar configuración de solicitud
          const requestConfig = {
            headers: { ...headerFormat.headers }
          };

          // Ajustar contentType si es necesario
          if (bodyFormat.contentType) {
            requestConfig.headers['Content-Type'] = bodyFormat.contentType;
          }

          // Añadir parámetros a la URL si están presentes
          if (headerFormat.params) {
            requestConfig.params = headerFormat.params;
          }

          // Obtener los datos del cuerpo según el formato
          const data = bodyFormat.getData();

          // Registrar la configuración de solicitud
          console.log(`         📝 Configuración: ${JSON.stringify({
            url,
            headers: requestConfig.headers,
            params: requestConfig.params || {},
            data: typeof data === 'string' ? data.substring(0, 50) + '...' : data
          }, null, 2)}`);

          // Ejecutar solicitud
          console.log('         🚀 Enviando solicitud...');
          const response = await axios.post(url, data, requestConfig);

          // Registrar respuesta exitosa
          console.log(`         ✅ Respuesta exitosa: ${JSON.stringify(response.data)}`);
          
          results.push({
            success: true,
            url,
            headerFormat: headerFormat.name,
            bodyFormat: bodyFormat.name,
            response: response.data,
            status: response.status
          });

          // Si la solicitud fue exitosa, guardar inmediatamente esta configuración
          saveSuccessfulConfig({
            url,
            headers: requestConfig.headers,
            data: data,
            bodyFormat: bodyFormat.name,
            headerFormat: headerFormat.name
          });

        } catch (error) {
          // Registrar error
          console.log(`         ❌ Error: ${error.message}`);
          
          if (error.response) {
            console.log(`         📊 Estado: ${error.response.status}`);
            console.log(`         📄 Respuesta: ${JSON.stringify(error.response.data)}`);
            
            results.push({
              success: false,
              url,
              headerFormat: headerFormat.name,
              bodyFormat: bodyFormat.name,
              error: error.message,
              status: error.response.status,
              response: error.response.data
            });
          } else {
            results.push({
              success: false,
              url,
              headerFormat: headerFormat.name,
              bodyFormat: bodyFormat.name,
              error: error.message
            });
          }
        }
        
        // Pequeña pausa entre solicitudes para evitar limitaciones de tasa
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  // Guardar todos los resultados
  fs.writeFileSync(resultFile, JSON.stringify(results, null, 2));
  console.log(`\n✅ Diagnóstico completado. Resultados guardados en: ${resultFile}`);

  // Análisis de resultados
  analyzeResults(results);
}

// Guarda la configuración exitosa para su uso futuro
function saveSuccessfulConfig(config) {
  const successFile = path.join(process.cwd(), 'gupshup-diagnosis', 'successful-config.json');
  fs.writeFileSync(successFile, JSON.stringify(config, null, 2));
  
  console.log('\n🎉 ¡CONFIGURACIÓN EXITOSA ENCONTRADA!');
  console.log('============================================');
  console.log(`URL: ${config.url}`);
  console.log(`Formato de encabezados: ${config.headerFormat}`);
  console.log(`Formato de datos: ${config.bodyFormat}`);
  console.log('============================================');
  console.log('Esta configuración ha sido guardada en: successful-config.json');
  console.log('Puedes usarla inmediatamente para tus aplicaciones.');
}

// Analiza los resultados para proporcionar recomendaciones
function analyzeResults(results) {
  console.log('\n📊 ANÁLISIS DE RESULTADOS');
  console.log('======================================================');
  
  // Contar solicitudes exitosas y fallidas
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`Total de pruebas: ${results.length}`);
  console.log(`Solicitudes exitosas: ${successful.length}`);
  console.log(`Solicitudes fallidas: ${failed.length}`);
  
  if (successful.length > 0) {
    console.log('\n✅ CONFIGURACIONES EXITOSAS:');
    successful.forEach((result, index) => {
      console.log(`\n${index + 1}. URL: ${result.url}`);
      console.log(`   Headers: ${result.headerFormat}`);
      console.log(`   Datos: ${result.bodyFormat}`);
      console.log(`   Respuesta: ${JSON.stringify(result.response)}`);
    });
    
    console.log('\n🔰 RECOMENDACIÓN:');
    console.log('Usa alguna de las configuraciones exitosas mostradas arriba.');
  } else {
    console.log('\n❌ No se encontraron configuraciones exitosas.');
    
    // Analizar patrones de error
    const authErrors = failed.filter(r => r.status === 401);
    const notFoundErrors = failed.filter(r => r.status === 404);
    const otherErrors = failed.filter(r => r.status && r.status !== 401 && r.status !== 404);
    
    console.log('\n🔍 ANÁLISIS DE ERRORES:');
    console.log(`Errores de autenticación (401): ${authErrors.length}`);
    console.log(`Errores de recurso no encontrado (404): ${notFoundErrors.length}`);
    console.log(`Otros errores: ${otherErrors.length}`);
    
    console.log('\n🔰 RECOMENDACIONES:');
    
    if (authErrors.length > 0) {
      console.log('1. Verifica que las credenciales sean correctas.');
      console.log('2. Contacta a GupShup para confirmar que tu cuenta está activa.');
      console.log('3. Verifica si necesitas crear una nueva aplicación en GupShup.');
    }
    
    if (notFoundErrors.length > 0) {
      console.log('1. Verifica que las URLs de la API sean correctas.');
      console.log('2. Verifica que tu cuenta tenga acceso a la API de WhatsApp.');
    }
  }
  
  console.log('\n📋 PRÓXIMOS PASOS:');
  console.log('1. Revisa la documentación más reciente de GupShup en https://docs.gupshup.io');
  console.log('2. Contacta al soporte de GupShup con los resultados del diagnóstico.');
  console.log('3. Implementa la configuración exitosa en tu aplicación, si encontraste alguna.');
}

// Ejecutar el diagnóstico
runDiagnostic().catch(error => {
  console.error('❌ Error durante el diagnóstico:', error);
}); 