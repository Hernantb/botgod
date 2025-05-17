// Script para probar las notificaciones con palabras clave cargadas desde la base de datos
require('dotenv').config();
const { processMessageForNotification, checkForNotificationPhrases, clearKeywordsCache } = require('./notification-patch.cjs');
const { supabase } = require('./supabase-config.cjs');

// ID de negocio para pruebas (Hernán Tenorio)
const businessId = '2d385aa5-40e0-4ec9-9360-19281bc605e4';

// Palabras clave para agregar a la base de datos para pruebas
const testKeywords = [
  "tu cita ha sido confirmada",
  "se ha confirmado tu cita",
  "tu reserva está confirmada",
  "un asesor te contactará",
  "un representante se comunicará",
  "nos pondremos en contacto",
  "gracias por tu paciencia"
];

// Mensajes de prueba
const testMessages = [
  "Tu cita ha sido confirmada para mañana a las 3 PM",
  "Se ha confirmado tu cita con el Dr. González", 
  "Un asesor te contactará en breve",
  "Nos pondremos en contacto para finalizar tu pedido",
  "Gracias por tu paciencia durante este proceso",
  "¡Perfecto! tu cita ha sido confirmada para mañana", // Formato actual que debería detectarse
  "Este mensaje no debería generar notificación"
];

/**
 * Limpia palabras clave existentes y agrega nuevas para pruebas
 */
async function setupTestKeywords() {
  console.log('🧹 Limpiando palabras clave existentes...');
  
  try {
    // Eliminar palabras clave existentes para este negocio
    const { error: deleteError } = await supabase
      .from('notification_keywords')
      .delete()
      .eq('business_id', businessId);
    
    if (deleteError) {
      console.error(`❌ Error eliminando palabras clave: ${deleteError.message}`);
      return false;
    }
    
    console.log('✅ Palabras clave existentes eliminadas');
    
    // Insertar nuevas palabras clave para pruebas
    const keywordsToInsert = testKeywords.map(keyword => ({
      business_id: businessId,
      keyword,
      enabled: true
    }));
    
    console.log(`📝 Insertando ${keywordsToInsert.length} palabras clave para pruebas...`);
    
    const { data, error } = await supabase
      .from('notification_keywords')
      .insert(keywordsToInsert)
      .select();
    
    if (error) {
      console.error(`❌ Error insertando palabras clave: ${error.message}`);
      return false;
    }
    
    console.log(`✅ ${data.length} palabras clave insertadas correctamente`);
    
    // Limpiar caché para asegurar que se carguen las nuevas palabras
    clearKeywordsCache();
    
    return true;
  } catch (error) {
    console.error(`❌ Error en setupTestKeywords: ${error.message}`);
    return false;
  }
}

/**
 * Consulta las palabras clave actuales para el negocio
 */
async function checkCurrentKeywords() {
  console.log(`🔍 Consultando palabras clave actuales para negocio ${businessId}...`);
  
  try {
    const { data, error } = await supabase
      .from('notification_keywords')
      .select('*')
      .eq('business_id', businessId)
      .eq('enabled', true);
    
    if (error) {
      console.error(`❌ Error consultando palabras clave: ${error.message}`);
      return [];
    }
    
    console.log(`✅ Encontradas ${data.length} palabras clave activas:`);
    data.forEach((kw, index) => {
      console.log(`   ${index + 1}. "${kw.keyword}" (ID: ${kw.id})`);
    });
    
    return data.map(kw => kw.keyword);
  } catch (error) {
    console.error(`❌ Error en checkCurrentKeywords: ${error.message}`);
    return [];
  }
}

/**
 * Prueba directamente si un mensaje contiene palabras clave, saltando la infraestructura de base de datos
 */
async function testDirectCheckNotificationPhrases() {
  console.log('\n🧪 PROBANDO DIRECTAMENTE DETECCIÓN DE PALABRAS CLAVE');
  
  for (const [index, message] of testMessages.entries()) {
    console.log(`\n----- MENSAJE ${index + 1} -----`);
    console.log(`📱 Mensaje: "${message}"`);
    
    try {
      // Verificar directamente usando la función checkForNotificationPhrases
      const requiresNotification = await checkForNotificationPhrases(message, businessId);
      
      if (requiresNotification) {
        console.log('✅ COINCIDENCIA ENCONTRADA DIRECTAMENTE');
      } else {
        console.log('❌ NO SE ENCONTRARON COINCIDENCIAS DIRECTAMENTE');
      }
    } catch (error) {
      console.error(`❌ Error en verificación directa: ${error.message}`);
    }
  }
}

/**
 * Prueba cada mensaje para ver si genera notificación
 */
async function runMessageTests() {
  console.log('\n🧪 INICIANDO PRUEBAS DE MENSAJES');
  
  const results = {
    total: testMessages.length,
    detectedCount: 0,
    notDetectedCount: 0,
    detected: [],
    notDetected: []
  };
  
  // Generar ID de conversación y teléfono de prueba
  const conversationId = `test-${Date.now()}`;
  const phoneNumber = `+5215512345${Math.floor(Math.random() * 1000)}`;
  
  // No intentaremos crear la conversación ya que tuvimos problemas anteriormente
  // Usaremos directamente el businessId como parámetro
  
  for (const [index, message] of testMessages.entries()) {
    console.log(`\n----- MENSAJE ${index + 1} -----`);
    console.log(`📱 Mensaje: "${message}"`);
    
    try {
      // Primera comprobación: Verificar directamente con checkForNotificationPhrases
      console.log('🔍 Comprobación directa:');
      const directCheck = await checkForNotificationPhrases(message, businessId);
      
      if (directCheck) {
        console.log('✅ COINCIDENCIA ENCONTRADA EN COMPROBACIÓN DIRECTA');
      } else {
        console.log('❌ NO SE ENCONTRARON COINCIDENCIAS EN COMPROBACIÓN DIRECTA');
      }
      
      // Procesar el mensaje usando la función completa, pasando el businessId directamente
      console.log('🔍 Procesando con processMessageForNotification:');
      const result = await processMessageForNotification(
        message,
        conversationId,
        phoneNumber,
        businessId  // Pasamos el businessId directamente
      );
      
      if (result.requiresNotification) {
        console.log('✅ NOTIFICACIÓN REQUERIDA');
        results.detectedCount++;
        results.detected.push(message);
      } else {
        console.log('❌ NO SE REQUIERE NOTIFICACIÓN');
        results.notDetectedCount++;
        results.notDetected.push(message);
      }
    } catch (error) {
      console.error(`❌ Error procesando mensaje: ${error.message}`);
    }
    
    // Esperar un segundo entre pruebas
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results;
}

/**
 * Función principal
 */
async function main() {
  console.log('🚀 INICIANDO PRUEBA DE NOTIFICACIONES CON PALABRAS CLAVE DESDE BASE DE DATOS');
  console.log(`🏢 Negocio: ${businessId}`);
  
  // Configurar palabras clave de prueba
  const setupSuccess = await setupTestKeywords();
  if (!setupSuccess) {
    console.error('❌ No se pudo configurar las palabras clave para la prueba');
    return;
  }
  
  // Verificar palabras clave actuales
  const currentKeywords = await checkCurrentKeywords();
  if (currentKeywords.length === 0) {
    console.error('❌ No hay palabras clave configuradas');
    return;
  }
  
  // Probar verificación directa
  await testDirectCheckNotificationPhrases();
  
  // Probar mensajes
  const results = await runMessageTests();
  
  // Mostrar resumen
  console.log('\n\n📊 RESUMEN DE RESULTADOS');
  console.log('==============================');
  console.log(`Total de mensajes probados: ${results.total}`);
  console.log(`Mensajes que requieren notificación: ${results.detectedCount} (${Math.round(results.detectedCount/results.total*100)}%)`);
  console.log(`Mensajes que NO requieren notificación: ${results.notDetectedCount} (${Math.round(results.notDetectedCount/results.total*100)}%)`);
  
  console.log('\n✅ Mensajes que generaron notificación:');
  results.detected.forEach((msg, i) => console.log(`   ${i + 1}. "${msg}"`));
  
  console.log('\n❌ Mensajes que NO generaron notificación:');
  results.notDetected.forEach((msg, i) => console.log(`   ${i + 1}. "${msg}"`));
  
  console.log('\n🏁 PRUEBAS FINALIZADAS');
}

// Ejecutar pruebas
main()
  .then(() => {
    console.log('✅ Proceso de prueba completado');
  })
  .catch(error => {
    console.error(`❌ Error en proceso de prueba: ${error.message}`);
    console.error(error.stack);
  })
  .finally(() => {
    // Esperar 5 segundos antes de terminar para permitir que los logs se completen
    setTimeout(() => process.exit(0), 5000);
  }); 