// Script para probar caso específico de notificación
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_URL, SUPABASE_KEY } = require('./supabase-config.cjs');

// Inicializar cliente de Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testSpecificCase() {
  try {
    console.log('🔍 Verificando caso específico de notificación');
    
    // 1. Buscar la conversación del usuario
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', '5212221192568')
      .order('created_at', { ascending: false })
      .limit(1);
      
    if (convError) {
      console.error('❌ Error buscando conversación:', convError.message);
      return;
    }
    
    if (!conversation || conversation.length === 0) {
      console.log('❌ No se encontró conversación para el número 5212221192568');
      return;
    }
    
    console.log('✅ Conversación encontrada:', conversation[0]);
    const businessId = conversation[0].business_id;
    
    // 2. Verificar palabras clave configuradas para el negocio
    const { data: keywords, error: kwError } = await supabase
      .from('notification_keywords')
      .select('*')
      .eq('business_id', businessId)
      .eq('enabled', true);
      
    if (kwError) {
      console.error('❌ Error buscando palabras clave:', kwError.message);
      return;
    }
    
    console.log('📝 Palabras clave configuradas:', keywords);
    
    // 3. Verificar si "PERRO" está entre las palabras clave
    const hasPerroKeyword = keywords?.some(kw => 
      kw.keyword.toLowerCase() === 'perro' || 
      kw.keyword.toLowerCase().includes('perro')
    );
    
    console.log(`🔍 ¿"PERRO" está configurado como palabra clave? ${hasPerroKeyword ? 'SÍ' : 'NO'}`);
    
    // 4. Buscar mensajes recientes que contengan "PERRO"
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation[0].id)
      .ilike('content', '%perro%')
      .order('created_at', { ascending: false });
      
    if (msgError) {
      console.error('❌ Error buscando mensajes:', msgError.message);
      return;
    }
    
    console.log('📨 Mensajes encontrados con "PERRO":', messages);
    
    // 5. Verificar estado de notificación de la conversación
    console.log('📊 Estado de notificación de la conversación:');
    console.log('- is_important:', conversation[0].is_important);
    console.log('- notification_sent:', conversation[0].notification_sent);
    console.log('- notification_timestamp:', conversation[0].notification_timestamp);
  } catch (error) {
    console.error('❌ Error general:', error.message);
  }
}

// Ejecutar prueba
console.log('🚀 Iniciando prueba de caso específico...');
testSpecificCase().then(() => {
  console.log('✅ Prueba completada');
}); 