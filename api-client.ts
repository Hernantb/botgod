// Función para enviar mensaje a WhatsApp mediante el bot server
export const sendMessageToWhatsApp = async (
  phoneNumber: string,
  message: string
): Promise<any> => {
  try {
    console.log('📱 Teléfono a usar:', phoneNumber);
    
    // URL del servidor del bot de WhatsApp - usar SIEMPRE la URL local
    const whatsappBotUrl = 'http://localhost:3095';
    console.log('🔗 Usando URL del bot:', whatsappBotUrl);
    
    // Verificar si el bot está disponible
    try {
      const healthCheck = await fetch(`${whatsappBotUrl}/health`, { 
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors',
        cache: 'no-cache',
      });
      
      if (healthCheck.ok) {
        console.log('✅ Bot de WhatsApp disponible');
      } else {
        console.warn('⚠️ Bot de WhatsApp podría no estar disponible');
      }
    } catch (healthError) {
      console.warn('⚠️ Bot de WhatsApp no responde a health check, intentando de todos modos');
    }
    
    // Manejo de reintentos
    let success = false;
    let attempts = 0;
    const maxAttempts = 2;
    let lastError = null;
    
    while (!success && attempts < maxAttempts) {
      attempts++;
      
      try {
        console.log(`📤 Enviando mensaje manual a ${whatsappBotUrl}/api/send-manual-message (intento ${attempts}/${maxAttempts})`);
        
        const response = await fetch(`${whatsappBotUrl}/api/send-manual-message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            phoneNumber,
            message,
            content: message // Enviar el mensaje en ambos campos para compatibilidad
          })
        });
        
        // Verificar si la respuesta es JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const textResponse = await response.text();
          console.warn(`⚠️ La respuesta no es un JSON válido: ${textResponse}`);
          throw new Error(`Error del servidor: ${response.status} - {"success":false,"error":"Respuesta no es JSON válido"}`);
        }
        
        const data = await response.json();
        
        if (!response.ok) {
          console.error(`❌ Error en intento ${attempts}/${maxAttempts}:`, data);
          throw new Error(`Error del servidor: ${response.status} - ${JSON.stringify(data)}`);
        }
        
        console.log(`✅ Mensaje enviado correctamente en intento ${attempts}`);
        success = true;
        return data;
      } catch (error) {
        console.error(`❌ Error en intento ${attempts}/${maxAttempts}:`, error);
        lastError = error;
        
        if (attempts < maxAttempts) {
          console.log(`🔄 Reintentando envío en 1 segundo...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    // Si llegamos aquí, todos los intentos fallaron
    console.error('❌ Error en sendMessageToWhatsApp:', lastError);
    throw lastError || new Error('Error desconocido al enviar mensaje a WhatsApp');
  } catch (error) {
    console.error('❌ Error enviando mensaje a WhatsApp:', error);
    throw error;
  }
};

// Función mejorada para enviar mensajes
export const sendMessage = async (
  conversationId: string,
  content: string,
  businessId: string
): Promise<any> => {
  try {
    console.log('[api-client] sendMessage llamado con:', { conversationId, businessId });
    
    // 1. Almacenar mensaje en la base de datos
    const response = await fetch('/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        conversationId,
        content,
        businessId
      })
    });
    
    if (!response.ok) {
      throw new Error('Error al guardar mensaje en la base de datos');
    }
    
    const messageData = await response.json();
    console.log('[api-client] Mensaje guardado en BD:', messageData);
    
    // 2. Obtener información de la conversación para saber el número de teléfono
    try {
      const convoResponse = await fetch(`/api/conversations/${conversationId}`);
      if (!convoResponse.ok) {
        console.error('[api-client] Error obteniendo datos de conversación');
        return messageData; // Retornar para no bloquear la UI
      }
      
      const conversation = await convoResponse.json();
      const phoneNumber = conversation.user_id; // El user_id en la BD es el número de teléfono
      
      if (!phoneNumber) {
        console.error('[api-client] No se encontró número de teléfono para la conversación');
        return messageData;
      }
      
      // 3. Enviar mensaje a WhatsApp
      try {
        await sendMessageToWhatsApp(phoneNumber, content);
        console.log('[api-client] Mensaje enviado a WhatsApp exitosamente');
      } catch (whatsappError) {
        console.error('[api-client] Error al enviar mensaje a WhatsApp:', whatsappError);
        // No revertimos nada, el mensaje ya se guardó en BD
      }
    } catch (convoError) {
      console.error('[api-client] Error obteniendo detalles de conversación:', convoError);
    }
    
    return messageData;
  } catch (error) {
    console.error('[api-client] Error general en sendMessage:', error);
    throw error;
  }
}; 