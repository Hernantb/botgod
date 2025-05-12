// Inicializar caché global de mensajes
global.whatsappMessageCache = global.whatsappMessageCache || {};

// Endpoint para obtener mensajes de una conversación por número de teléfono
app.get('/api/get-conversation-messages', async (req, res) => {
  try {
    const { phoneNumber } = req.query;
    
    if (!phoneNumber) {
      return res.status(400).json({ 
        success: false, 
        error: 'Se requiere phoneNumber' 
      });
    }
    
    console.log(`📱 Solicitud para obtener mensajes de WhatsApp para ${phoneNumber}`);
    
    // Limpiar formato del número
    let formattedPhone = phoneNumber.replace(/\D/g, '');
    
    // Buscar en la memoria local de mensajes (implementación simulada)
    const messages = [];
    
    // Buscar conversaciones en localStorage (versión adaptada para ambiente node)
    try {
      // Obtener de la caché de mensajes
      const cachedMessages = global.whatsappMessageCache || {};
      const userMessages = cachedMessages[formattedPhone] || [];
      
      if (userMessages.length > 0) {
        console.log(`📚 Encontrados ${userMessages.length} mensajes en caché para ${formattedPhone}`);
        messages.push(...userMessages);
      }
      
      // Intentar obtener de la base de datos si está disponible
      if (global.supabase) {
        console.log('🔍 Buscando mensajes en Supabase...');
        try {
          // Buscar conversación primero
          const { data: conversation, error: convError } = await global.supabase
            .from('conversations')
            .select('id')
            .eq('user_id', formattedPhone)
            .single();
            
          if (convError && convError.code !== 'PGRST116') {
            console.error(`❌ Error buscando conversación: ${convError.message}`);
          } else if (conversation) {
            console.log(`🔎 Encontrada conversación: ${conversation.id}`);
            
            // Obtener mensajes de esta conversación
            const { data: dbMessages, error: msgError } = await global.supabase
              .from('messages')
              .select('*')
              .eq('conversation_id', conversation.id)
              .order('created_at', { ascending: true });
              
            if (msgError) {
              console.error(`❌ Error buscando mensajes: ${msgError.message}`);
            } else if (dbMessages && dbMessages.length > 0) {
              console.log(`📚 Encontrados ${dbMessages.length} mensajes en Supabase`);
              messages.push(...dbMessages);
            }
          }
        } catch (dbError) {
          console.error('❌ Error consultando Supabase:', dbError);
        }
      }
    } catch (cacheError) {
      console.error('❌ Error accediendo a la caché de mensajes:', cacheError);
    }
    
    // Si no hay mensajes, intentar simular algunos para pruebas
    if (messages.length === 0) {
      console.log('⚠️ No se encontraron mensajes, generando datos simulados para pruebas');
      
      // Crear algunos mensajes simulados para pruebas
      const sampleMessages = [
        {
          id: `sim-${Date.now()}-1`,
          content: "Mensaje de prueba 1 (simulado)",
          timestamp: new Date(Date.now() - 60000).toISOString(),
          direction: "inbound",
          sender_type: "user"
        },
        {
          id: `sim-${Date.now()}-2`,
          content: "Respuesta de prueba (simulado)",
          timestamp: new Date(Date.now() - 30000).toISOString(),
          direction: "outbound",
          sender_type: "agent"
        },
        {
          id: `sim-${Date.now()}-3`,
          content: "Último mensaje (simulado)",
          timestamp: new Date().toISOString(),
          direction: "outbound",
          sender_type: "agent"
        }
      ];
      
      messages.push(...sampleMessages);
    }
    
    // Ordenar mensajes por timestamp
    const sortedMessages = messages.sort((a, b) => {
      const timeA = new Date(a.timestamp || a.created_at).getTime();
      const timeB = new Date(b.timestamp || b.created_at).getTime();
      return timeA - timeB;
    });
    
    return res.status(200).json({ 
      success: true, 
      phoneNumber: formattedPhone,
      messages: sortedMessages
    });
    
  } catch (error) {
    console.error('❌ Error al obtener mensajes de la conversación:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error al obtener mensajes'
    });
  }
});

// Endpoint para enviar mensajes manualmente
app.post('/api/send-manual-message', async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ 
        success: false, 
        error: 'Se requiere phoneNumber' 
      });
    }
    
    if (!message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Se requiere message' 
      });
    }
    
    console.log(`📨 Solicitud para enviar mensaje manual a ${phoneNumber}: "${message.substring(0, 30)}${message.length > 30 ? '...' : ''}"`);
    
    // Formatear el número de teléfono para consistencia
    const formattedPhone = phoneNumber.replace(/\D/g, '');
    
    // Guardar el mensaje en la caché global
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const messageData = {
      id: messageId,
      content: message,
      timestamp: new Date().toISOString(),
      direction: 'outbound',
      sender_type: 'agent',
      conversation_id: formattedPhone,
      phone: formattedPhone
    };
    
    // Inicializar arreglo para este número si no existe
    if (!global.whatsappMessageCache[formattedPhone]) {
      global.whatsappMessageCache[formattedPhone] = [];
    }
    
    // Agregar mensaje a la caché
    global.whatsappMessageCache[formattedPhone].push(messageData);
    
    console.log(`💾 Mensaje guardado en caché local: ${messageId} para ${formattedPhone}`);
    
    // Enviar el mensaje usando la función de GupShup
    const response = await sendTextMessageGupShup(formattedPhone, message);
    
    // Agregar datos de respuesta al objeto del mensaje
    messageData.apiResponse = response;
    
    return res.status(200).json({ 
      success: true, 
      message: 'Mensaje enviado correctamente',
      data: messageData
    });
  } catch (error) {
    console.error('❌ Error al enviar mensaje manual:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Error al enviar mensaje'
    });
  }
}); 