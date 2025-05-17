/**
 * Script para verificar y procesar mensajes pendientes de notificación
 * 
 * Este script puede ejecutarse manualmente con: node check-pending-notifications.js
 * También puede programarse para ejecución periódica con cron
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Configurar cliente de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Importar función de notificación del servidor principal
const { checkForNotificationPhrases, sendBusinessNotification, handleNotificationUpdate } = require('./server');

/**
 * Verifica y procesa mensajes que requieren notificación pero que no han sido procesados aún
 */
async function checkPendingNotifications() {
  try {
    console.log(`\n🔍 === VERIFICANDO NOTIFICACIONES PENDIENTES ===`);
    
    // Buscar mensajes que requieren notificación pero no han sido enviados todavía
    const { data: pendingMessages, error: messagesError } = await supabase
      .from('messages')
      .select('id, content, conversation_id, created_at')
      .eq('sender_type', 'bot')
      .eq('needs_notification', true)
      .eq('notification_sent', false)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (messagesError) {
      console.error(`❌ Error al buscar mensajes pendientes: ${messagesError.message}`);
      return;
    }
    
    console.log(`📊 Se encontraron ${pendingMessages ? pendingMessages.length : 0} mensajes pendientes de notificación`);
    
    if (!pendingMessages || pendingMessages.length === 0) {
      console.log(`✅ No hay mensajes pendientes de notificación`);
      return;
    }
    
    // Procesar cada mensaje pendiente
    for (const message of pendingMessages) {
      console.log(`\n📝 Procesando mensaje pendiente: ${message.id}`);
      console.log(`📄 Contenido: "${message.content}"`);
      
      try {
        // Obtener información de la conversación
        const { data: conversation, error: convError } = await supabase
          .from('conversations')
          .select('user_id')
          .eq('id', message.conversation_id)
          .single();
        
        if (convError || !conversation) {
          console.error(`❌ Error al obtener conversación para mensaje ${message.id}: ${convError?.message || 'No encontrada'}`);
          continue;
        }
        
        const clientPhoneNumber = conversation.user_id;
        console.log(`📱 Número de teléfono del cliente: ${clientPhoneNumber}`);
        
        // Verificar si el mensaje requiere notificación
        const requiresNotification = checkForNotificationPhrases(message.content);
        
        if (requiresNotification) {
          console.log(`🔔 El mensaje requiere notificación. Enviando...`);
          
          // Enviar notificación
          const emailSent = await sendBusinessNotification(
            message.conversation_id,
            message.content,
            clientPhoneNumber
          );
          
          console.log(`📧 Resultado de notificación: ${emailSent ? '✅ Enviada' : '❌ Fallida'}`);
          
          // Actualizar estado de notificación
          await handleNotificationUpdate(message.conversation_id, emailSent, message.id);
        } else {
          console.log(`ℹ️ El mensaje ya no requiere notificación según las reglas actuales`);
          
          // Marcar como procesado aunque no requiera notificación
          const { error: updateError } = await supabase
            .from('messages')
            .update({ needs_notification: false })
            .eq('id', message.id);
            
          if (updateError) {
            console.error(`❌ Error al actualizar estado del mensaje: ${updateError.message}`);
          } else {
            console.log(`✅ Mensaje marcado como procesado`);
          }
        }
      } catch (error) {
        console.error(`❌ Error procesando mensaje pendiente ${message.id}: ${error.message}`);
      }
    }
    
    console.log(`\n✅ Verificación de notificaciones pendientes completada`);
  } catch (error) {
    console.error(`❌ Error general al verificar notificaciones pendientes: ${error.message}`);
  }
}

// Ejecutar la función si se ejecuta directamente
if (require.main === module) {
  console.log('🚀 Iniciando verificación de notificaciones pendientes...');
  checkPendingNotifications()
    .then(() => console.log('✅ Proceso completado'))
    .catch(err => console.error('❌ Error:', err))
    .finally(() => process.exit(0));
}

module.exports = { checkPendingNotifications }; 