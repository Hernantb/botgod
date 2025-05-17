/**
 * MÓDULO DE MANEJO DE NOTIFICACIONES
 * 
 * Este archivo implementa las funciones necesarias para:
 * 1. Detectar frases clave en mensajes que requieren notificación
 * 2. Actualizar el estado de las conversaciones a "importantes" en el dashboard
 * 3. Marcar mensajes como procesados para notificación
 */

const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

// Cargar configuración de Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wscijkxwevgxbgwhbqtm.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4MjI3NjgsImV4cCI6MjA1NzM5ODc2OH0._HSnvof7NUk6J__qqq3gJvbJRZnItCAmlI5HYAL8WVI';

// Inicializar cliente Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Verifica si un mensaje contiene frases que indican necesidad de notificación
 * @param {string} message - El mensaje a verificar
 * @returns {boolean} - Verdadero si el mensaje contiene alguna de las frases de notificación
 */
function checkForNotificationPhrases(message) {
  if (!message) return false;

  // Normalizar el mensaje (convertir a minúsculas, eliminar espacios extras)
  const normalizedMessage = message.toLowerCase().trim();
  
  // Frases que indican necesidad de notificación
  const phrases = [
    "tu cita ha sido confirmada",
    "se ha confirmado tu cita",
    "tu reserva está confirmada",
    "un asesor te contactará",
    "un representante se comunicará",
    "nos pondremos en contacto",
    "gracias por tu paciencia",
    "asesor te llamará",
    "asesor te llamara",
    "perfecto",
    "has ganado un helado"
  ];
  
  // Verificar si el mensaje contiene alguna de las frases
  for (const phrase of phrases) {
    if (normalizedMessage.includes(phrase.toLowerCase())) {
      console.log(`✅ Frase de notificación encontrada: "${phrase}" en el mensaje`);
      return true;
    }
  }
  
  return false;
}

/**
 * Envía una notificación por correo electrónico cuando se detecta un mensaje importante
 * @param {string} conversationId - ID de la conversación
 * @param {string} botMessage - Mensaje del bot que activó la notificación
 * @param {string} clientPhoneNumber - Número de teléfono del cliente
 * @returns {Promise<boolean>} - Verdadero si la notificación se envió con éxito
 */
async function sendBusinessNotification(conversationId, botMessage, clientPhoneNumber) {
  try {
    console.log(`🔍 Obteniendo datos del negocio: ${process.env.BUSINESS_ID || 'no configurado'}`);
    
    // Obtener información del negocio para la notificación
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', process.env.BUSINESS_ID)
      .single();
    
    if (businessError) {
      console.error(`❌ Error al obtener datos del negocio: ${businessError.message}`);
      return false;
    }
    
    if (!business) {
      console.error(`❌ No se encontró información del negocio con ID: ${process.env.BUSINESS_ID}`);
      return false;
    }
    
    console.log(`✅ Datos del negocio obtenidos: ${JSON.stringify(business)}`);
    
    // Buscar correo electrónico del destinatario
    let recipientEmail = '';
    
    // Buscar usuarios asociados al negocio
    console.log(`🔍 Buscando usuarios relacionados con el negocio: ${business.id}`);
    const { data: businessUsers, error: usersError } = await supabase
      .from('business_users')
      .select('user_id')
      .eq('business_id', business.id);
    
    if (usersError) {
      console.error(`❌ Error al buscar usuarios del negocio: ${usersError.message}`);
      // Continuar con el correo predeterminado
    } else {
      console.log(`✅ Encontrados ${businessUsers ? businessUsers.length : 0} usuarios asociados al negocio`);
      
      // Si hay usuarios asociados, obtener sus perfiles
      if (businessUsers && businessUsers.length > 0) {
        try {
          const userIds = businessUsers.map(bu => bu.user_id);
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('email')
            .in('id', userIds);
          
          if (profilesError) {
            console.error(`❌ Error obteniendo perfiles de usuarios: ${profilesError.message}`);
          } else if (profiles && profiles.length > 0) {
            // Usar el primer correo que encontremos
            recipientEmail = profiles[0].email;
            console.log(`✅ Usando correo de usuario: ${recipientEmail}`);
          }
        } catch (profileError) {
          console.error(`❌ Error al buscar perfiles: ${profileError.message}`);
        }
      }
    }
    
    // Si no encontramos un correo en los perfiles, usar un correo específico para el negocio
    if (!recipientEmail) {
      console.warn(`⚠️ Usando correo específico para ${business.name}: hernan.baigts@gmail.com`);
      recipientEmail = 'hernan.baigts@gmail.com';
    }
    
    console.log(`✅ Se utilizará correo específico del negocio: ${recipientEmail}`);
    
    // Obtener últimos mensajes de la conversación
    console.log(`🔍 Obteniendo últimos 10 mensajes de conversación: ${conversationId}`);
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(10);
    
    // Configurar transporte de correo
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'bexorai@gmail.com',
        pass: process.env.EMAIL_PASSWORD || 'dvfq frlf dydl ixrj'
      }
    });
    
    // Preparar contenido del correo
    const messageHistory = messages && messages.length > 0 ? 
      messages
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        .map(msg => `<p><strong>${msg.sender_type === 'bot' ? 'Bot' : 'Cliente'}:</strong> ${msg.content}</p>`)
        .join('\n') : 
      '<p>No hay historial de mensajes disponible</p>';
    
    // Plantilla HTML para el correo
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
        <h2 style="color: #4a4a4a; text-align: center; margin-bottom: 20px;">Notificación Importante</h2>
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
          <p><strong>Se ha detectado un mensaje importante en una conversación de WhatsApp:</strong></p>
          <p style="color: #0056b3; background-color: #e7f3ff; padding: 10px; border-radius: 5px;">${botMessage}</p>
          <p><strong>Número de teléfono del cliente:</strong> ${clientPhoneNumber}</p>
          <p><strong>ID de conversación:</strong> ${conversationId}</p>
          <p><strong>Fecha y hora:</strong> ${new Date().toLocaleString()}</p>
        </div>
        <div style="margin-top: 30px;">
          <h3 style="color: #4a4a4a;">Historial reciente de la conversación:</h3>
          <div style="border-left: 3px solid #0056b3; padding-left: 15px;">
            ${messageHistory}
          </div>
        </div>
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #777;">
          <p>Esta es una notificación automática enviada por el sistema de BEXOR AI.</p>
        </div>
      </div>
    `;
    
    // Configurar opciones del correo
    const mailOptions = {
      from: process.env.EMAIL_USER || 'bexorai@gmail.com',
      to: recipientEmail,
      subject: `🔔 Notificación importante de WhatsApp - Cliente ${clientPhoneNumber}`,
      html: emailHtml
    };
    
    // Enviar correo
    console.log(`📧 Enviando notificación por correo a ${recipientEmail} (${business.name})`);
    await transporter.sendMail(mailOptions);
    
    console.log(`✅ Notificación enviada a ${recipientEmail}`);
    
    // Actualizar estado de la conversación directamente a importante
    try {
      console.log(`🔍 Actualizando conversación ${conversationId} como importante después de enviar correo...`);
      
      const { error: updateError } = await supabase
        .from('conversations')
        .update({ 
          is_important: true,
          notification_sent: true,
          notification_timestamp: new Date().toISOString(),
          last_message: "⚠️ REQUIERE ATENCIÓN - Notificación enviada",
          user_category: 'important', // Necesario para el dashboard
          tag: 'yellow', // Color para conversaciones importantes
          colorLabel: 'yellow', // Color visual en la UI
          manuallyMovedToAll: false // Asegurar que aparezca en la columna "Importantes"
        })
        .eq('id', conversationId);
      
      if (updateError) {
        console.error(`❌ Error actualizando conversación como importante: ${updateError.message}`);
      } else {
        console.log(`✅ Conversación ${conversationId} marcada como importante exitosamente`);
      }
    } catch (updateError) {
      console.error(`❌ Error al actualizar estado de la conversación: ${updateError.message}`);
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Error general en sendBusinessNotification:`, error);
    return false;
  }
}

/**
 * Actualiza el estado de notificación de una conversación
 * @param {string} conversationId - ID de la conversación
 * @param {boolean} success - Si la notificación fue exitosa
 * @param {string} messageId - ID del mensaje opcional
 * @returns {Promise<Object>} - Resultado de la operación
 */
async function handleNotificationUpdate(conversationId, success, messageId = null) {
  console.log(`🔔 NOTIFICACIÓN REQUERIDA para conversación: ${conversationId}`);
  
  try {
    // 1. Actualizar estado de la conversación (marcar como importante)
    const conversationUpdate = {
      notification_sent: success,
      notification_timestamp: new Date().toISOString(),
      last_message: "⚠️ REQUIERE ATENCIÓN - Notificación enviada",
      is_important: true, // Usar is_important en lugar de status
      user_category: 'important', // Esto es necesario para el dashboard
      tag: 'yellow', // Color de la etiqueta para conversaciones importantes
      colorLabel: 'yellow', // Color para mostrar en la UI
      manuallyMovedToAll: false // Esto evita que sea filtrado de la vista de importantes
    };
    
    // Actualización principal
    const { error: updateError } = await supabase
      .from('conversations')
      .update(conversationUpdate)
      .eq('id', conversationId);
    
    if (updateError) {
      console.error(`❌ Error en actualización básica: ${updateError.message}`);
      
      // Intentar actualización por partes
      try {
        // Actualizar is_important primero
        const { error: importantError } = await supabase
          .from('conversations')
          .update({ is_important: true })
          .eq('id', conversationId);
        
        if (importantError) {
          console.error(`❌ Error al actualizar is_important: ${importantError.message}`);
        } else {
          console.log(`✅ Campo is_important actualizado correctamente`);
        }
        
        // Actualizar user_category
        const { error: categoryError } = await supabase
          .from('conversations')
          .update({ user_category: 'important' })
          .eq('id', conversationId);
        
        if (categoryError) {
          console.error(`❌ Error al actualizar user_category: ${categoryError.message}`);
        } else {
          console.log(`✅ Campo user_category actualizado correctamente`);
        }
        
        // Actualizar tag y colorLabel
        const { error: tagError } = await supabase
          .from('conversations')
          .update({ tag: 'yellow', colorLabel: 'yellow' })
          .eq('id', conversationId);
        
        if (tagError) {
          console.error(`❌ Error al actualizar tag/colorLabel: ${tagError.message}`);
        } else {
          console.log(`✅ Campos tag y colorLabel actualizados correctamente`);
        }
        
        // Actualizar manuallyMovedToAll
        const { error: movedError } = await supabase
          .from('conversations')
          .update({ manuallyMovedToAll: false })
          .eq('id', conversationId);
        
        if (movedError) {
          console.error(`❌ Error al actualizar manuallyMovedToAll: ${movedError.message}`);
        } else {
          console.log(`✅ Campo manuallyMovedToAll actualizado correctamente`);
        }
        
        // Actualizar notification_sent
        const { error: notificationError } = await supabase
          .from('conversations')
          .update({ notification_sent: success })
          .eq('id', conversationId);
        
        if (notificationError) {
          console.error(`❌ Error al actualizar notification_sent: ${notificationError.message}`);
        } else {
          console.log(`✅ Campo notification_sent actualizado correctamente`);
        }
        
        // Actualizar notification_timestamp
        const { error: timestampError } = await supabase
          .from('conversations')
          .update({ notification_timestamp: new Date().toISOString() })
          .eq('id', conversationId);
        
        if (timestampError) {
          console.error(`❌ Error al actualizar notification_timestamp: ${timestampError.message}`);
        } else {
          console.log(`✅ Campo notification_timestamp actualizado correctamente`);
        }
        
        // Actualizar last_message
        const { error: messageError } = await supabase
          .from('conversations')
          .update({ last_message: "⚠️ REQUIERE ATENCIÓN - Notificación enviada" })
          .eq('id', conversationId);
        
        if (messageError) {
          console.error(`❌ Error al actualizar last_message: ${messageError.message}`);
        } else {
          console.log(`✅ Campo last_message actualizado correctamente`);
        }
      } catch (individualError) {
        console.error(`❌ Error en actualización individual: ${individualError.message}`);
      }
    } else {
      console.log(`✅ Actualización básica completada correctamente`);
    }
    
    // 2. Si se proporcionó un ID de mensaje, actualizar ese mensaje
    if (messageId) {
      try {
        const { error: messageError } = await supabase
          .from('messages')
          .update({ 
            notification_sent: success,
            needs_notification: false // Marcarlo como procesado
          })
          .eq('id', messageId);
        
        if (messageError) {
          console.error(`❌ Error al actualizar mensaje: ${messageError.message}`);
        } else {
          console.log(`✅ Mensaje ${messageId} actualizado correctamente`);
        }
      } catch (messageError) {
        console.error(`❌ Error al actualizar mensaje: ${messageError.message}`);
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error(`❌ Error general en handleNotificationUpdate:`, error);
    return { success: false, error: error.message };
  }
}

// Exportar las funciones para que puedan ser usadas por otros módulos
module.exports = {
  checkForNotificationPhrases,
  sendBusinessNotification,
  handleNotificationUpdate
}; 