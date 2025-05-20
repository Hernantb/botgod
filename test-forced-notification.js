// Script para probar forzosamente el procesamiento de notificaciones con palabra clave PERRO
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { processMessageForNotification, checkForNotificationPhrases, clearKeywordsCache } = require('./notification-patch.cjs');

// Importar configuración de Supabase
const { SUPABASE_URL, SUPABASE_KEY, BUSINESS_ID } = require('./supabase-config.cjs');

// Inicializar cliente de Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ID de la conversación de Pedro Lopez
const CONVERSATION_ID = '9b795f15-265c-497d-9792-608361bb9af5';
// Número de teléfono de Pedro Lopez
const PHONE_NUMBER = '5212221192568';

async function forceNotificationTest() {
  console.log('🚀 INICIANDO PRUEBA FORZADA DE NOTIFICACIÓN');
  console.log(`🏢 Negocio: ${BUSINESS_ID}`);
  console.log(`💬 Conversación: ${CONVERSATION_ID}`);
  console.log(`📱 Teléfono: ${PHONE_NUMBER}`);
  
  try {
    // 1. Forzar la limpieza de caché para asegurar datos actualizados
    clearKeywordsCache(BUSINESS_ID);
    console.log('🧹 Caché de palabras clave limpiada');
    
    // 2. Asegurar que manuallyMovedToAll sea true para simular el problema
    console.log('⚙️ Configurando conversación para simular el problema...');
    const { error: updateError } = await supabase
      .from('conversations')
      .update({
        manuallyMovedToAll: true,
        is_important: false,
        notification_sent: false,
        tag: 'gray',
        colorLabel: 'gray',
        user_category: 'default'
      })
      .eq('id', CONVERSATION_ID);
    
    if (updateError) {
      console.error(`❌ Error preparando conversación: ${updateError.message}`);
      return;
    }
    
    console.log('✅ Conversación preparada correctamente');
    
    // 3. Verificar palabras clave en la base de datos
    const { data: keywords, error: keywordError } = await supabase
      .from('notification_keywords')
      .select('*')
      .eq('business_id', BUSINESS_ID)
      .eq('keyword', 'PERRO')
      .eq('enabled', true);
    
    if (keywordError) {
      console.error(`❌ Error verificando palabra clave PERRO: ${keywordError.message}`);
      return;
    }
    
    if (!keywords || keywords.length === 0) {
      console.log('⚠️ Palabra clave PERRO no encontrada, creándola...');
      
      const { error: insertError } = await supabase
        .from('notification_keywords')
        .insert({
          business_id: BUSINESS_ID,
          keyword: 'PERRO',
          enabled: true
        });
      
      if (insertError) {
        console.error(`❌ Error creando palabra clave PERRO: ${insertError.message}`);
        return;
      }
      
      console.log('✅ Palabra clave PERRO creada correctamente');
    } else {
      console.log('✅ Palabra clave PERRO ya existe');
    }
    
    // 4. Mensaje de prueba que contiene la palabra clave PERRO
    const testMessage = 'Mi perro se llama PERRO. ¿En qué puedo ayudarte?';
    
    // 5. Probar directamente la función checkForNotificationPhrases
    console.log('\n🧪 PRUEBA DIRECTA DE DETECCIÓN DE PALABRAS CLAVE');
    console.log(`💬 Mensaje de prueba: "${testMessage}"`);
    
    const requiresNotification = await checkForNotificationPhrases(testMessage, BUSINESS_ID);
    console.log(`🔔 ¿Requiere notificación? ${requiresNotification ? 'SÍ' : 'NO'}`);
    
    // 6. Probar el procesamiento completo de notificaciones
    console.log('\n🧪 PRUEBA DE PROCESAMIENTO COMPLETO');
    
    const result = await processMessageForNotification(
      testMessage,
      CONVERSATION_ID,
      PHONE_NUMBER,
      BUSINESS_ID
    );
    
    console.log('📊 RESULTADO DEL PROCESAMIENTO:');
    console.log(`- ¿Requiere notificación? ${result.requiresNotification ? 'SÍ' : 'NO'}`);
    console.log(`- ¿Notificación enviada? ${result.notificationSent ? 'SÍ' : 'NO'}`);
    
    if (result.error) {
      console.error(`❌ Error: ${result.error}`);
    }
    
    // 7. Verificar el estado de la conversación después del procesamiento
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', CONVERSATION_ID)
      .single();
    
    if (convError) {
      console.error(`❌ Error verificando estado de conversación: ${convError.message}`);
      return;
    }
    
    console.log('\n📊 ESTADO FINAL DE LA CONVERSACIÓN:');
    console.log(`- is_important: ${conversation.is_important}`);
    console.log(`- notification_sent: ${conversation.notification_sent}`);
    console.log(`- manuallyMovedToAll: ${conversation.manuallyMovedToAll}`);
    console.log(`- user_category: ${conversation.user_category}`);
    console.log(`- tag/colorLabel: ${conversation.tag}/${conversation.colorLabel}`);
    
    console.log('\n✅ PRUEBA COMPLETADA');
  } catch (error) {
    console.error(`❌ Error general: ${error.message}`);
    console.error(error.stack);
  }
}

// Ejecutar la prueba
forceNotificationTest(); 