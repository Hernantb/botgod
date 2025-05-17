// Script para inyectar manualmente una sesión con un businessId
const { createClient } = require('@supabase/supabase-js');

const BUSINESS_ID = '2d385aa5-40e0-4ec9-9360-19281bc605e4';

const supabase = createClient(
  'https://wscijkxwevgxbgwhbqtm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4MjI3NjgsImV4cCI6MjA1NzM5ODc2OH0._HSnvof7NUk6J__qqq3gJvbJRZnItCAmlI5HYAL8WVI'
);

async function getConversations() {
  try {
    console.log(`🔍 Consultando conversaciones para businessId: ${BUSINESS_ID}`);
    
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('business_id', BUSINESS_ID)
      .order('last_message_time', { ascending: false });
    
    if (error) {
      console.error('❌ Error al consultar conversaciones:', error);
      return;
    }
    
    console.log(`✅ Encontradas ${data.length} conversaciones:`);
    data.forEach((conv, i) => {
      console.log(`${i+1}. ID: ${conv.id}, Usuario: ${conv.user_id}, Último mensaje: ${conv.last_message?.substring(0, 30)}...`);
    });
    
    // Ahora buscar mensajes de la primera conversación si existe
    if (data.length > 0) {
      const firstConvId = data[0].id;
      console.log(`\n📩 Cargando mensajes para la conversación ${firstConvId}...`);
      
      const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', firstConvId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (msgError) {
        console.error('❌ Error al consultar mensajes:', msgError);
        return;
      }
      
      console.log(`✅ Encontrados ${messages.length} mensajes:`);
      messages.forEach((msg, i) => {
        console.log(`${i+1}. [${msg.sender_type}]: ${msg.content?.substring(0, 50)}...`);
      });
    }
  } catch (err) {
    console.error('❌ Error general:', err);
  }
}

getConversations(); 