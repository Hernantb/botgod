/**
 * Webhook handler con soporte multi-tenant
 * 
 * Este módulo contiene el manejador de webhook que usa la configuración dinámica
 * para procesar mensajes de WhatsApp de diferentes negocios.
 */

// Importar el módulo de configuración de negocios
const { getBusinessConfigByNumber } = require('./business-config-loader');

/**
 * Manejador de webhook para mensajes de WhatsApp con soporte multi-tenant
 * @param {Object} app Aplicación Express
 * @param {Function} extractMessageData Función para extraer datos del mensaje
 * @param {Function} processMessageWithOpenAI Función para procesar mensajes con OpenAI
 * @param {Function} sendWhatsAppResponse Función para enviar respuestas de WhatsApp
 * @param {Function} registerBotResponse Función para registrar respuestas del bot
 * @param {Object} supabase Cliente Supabase
 */
function setupMultitenantWebhook(
  app,
  extractMessageData,
  processMessageWithOpenAI,
  sendWhatsAppResponse,
  registerBotResponse,
  supabase
) {
  app.post('/webhook', async (req, res) => {
    try {
      const body = req.body;
      console.log(`📩 Mensaje recibido en webhook: ${JSON.stringify(body).substring(0, 500)}...`);
      
      // Extraer datos del mensaje
      const messageData = extractMessageData(body);
      
      // Si es una actualización de estado, solo registrarla
      if (messageData.isStatusUpdate) {
        console.log(`📊 Notificación de estado recibida, no requiere respuesta`);
        return res.sendStatus(200);
      }
      
      const { sender, recipient, message, messageId, isImage, isAudio } = messageData;
      
      if (!sender) {
        console.log(`⚠️ Mensaje sin remitente, ignorando: ${JSON.stringify(messageData)}`);
        return res.sendStatus(200);
      }
      
      // Modificar esta condición para permitir mensajes de audio/imagen sin contenido de texto
      if (!message && !isImage && !isAudio) {
        console.log(`⚠️ Mensaje sin contenido válido, ignorando: ${JSON.stringify(messageData)}`);
        return res.sendStatus(200);
      }
      
      // NUEVO: Buscar configuración del negocio según el número RECEPTOR
      const businessConfig = getBusinessConfigByNumber(recipient);
      
      if (!businessConfig) {
        console.log(`⚠️ No se encontró configuración para el número receptor: ${recipient}`);
        return res.sendStatus(200); // Responder OK para evitar reintentos
      }
      
      // Configurar variables dinámicas para este negocio
      const BUSINESS_ID = businessConfig.id;
      const GUPSHUP_API_KEY = businessConfig.gupshup_api_key;
      const GUPSHUP_NUMBER = businessConfig.gupshup_number;
      const ASSISTANT_ID = businessConfig.openai_assistant_id;
      
      console.log(`🏢 Procesando mensaje para negocio: ${businessConfig.business_name}`);
      console.log(`👤 Mensaje recibido de ${sender}: ${message || (isImage ? "[IMAGEN]" : isAudio ? "[AUDIO]" : "[DESCONOCIDO]")}`);
      
      // Verificar si este mensaje ya fue procesado recientemente
      // Generar una clave única para este mensaje que tenga en cuenta su tipo
      const messageKey = `${messageId || sender}_${message || (isImage ? "IMAGEN" : isAudio ? "AUDIO" : "DESCONOCIDO")}`;
      if (global.recentlyProcessedMessages && global.recentlyProcessedMessages.has(messageKey)) {
        console.log(`⚠️ Mensaje duplicado detectado, ignorando: ${messageKey}`);
        return res.sendStatus(200);
      }
      
      // Marcar este mensaje como procesado
      if (global.recentlyProcessedMessages) {
        global.recentlyProcessedMessages.add(messageKey);
        setTimeout(() => global.recentlyProcessedMessages.delete(messageKey), 60000); // Eliminar después de 1 minuto
      }
      
      // Guardar mensaje en Supabase
      console.log(`💾 Guardando mensaje entrante para ${sender}`);
      let conversationId = null;
      
      try {
        // Guardar mensaje del usuario en la base de datos
        console.log(`💾 Guardando mensaje de tipo 'user' para: ${sender}`);
        
        // NUEVO: Pasar businessId específico
        const userMessageResult = await registerBotResponse(
          sender, 
          message || (isImage ? "[IMAGEN RECIBIDA]" : "[AUDIO RECIBIDA]"), 
          BUSINESS_ID, 
          'user'
        );
  
        if (userMessageResult && userMessageResult.success) {
          console.log('✅ Mensaje guardado en Supabase correctamente');
          conversationId = userMessageResult.conversationId;
        } else {
          console.error(`❌ Error al guardar mensaje en Supabase: ${userMessageResult?.error || 'Error desconocido'}`);
        }
      } catch (supabaseError) {
        console.error(`❌ Error al guardar mensaje en Supabase: ${supabaseError.message}`);
      }
      
      // 🔒 VERIFICACIÓN CRÍTICA: Verificar estado del bot para este remitente
      console.log(`🔒 FORZANDO CONSULTA A BASE DE DATOS para verificar estado actual del bot`);
      let botActive = true;
      
      try {
        // Primero intentar con el ID de conversación si lo tenemos
        if (conversationId) {
          const { data: convData, error: convError } = await supabase
            .from('conversations')
            .select('is_bot_active')
            .eq('id', conversationId)
            .eq('business_id', BUSINESS_ID) // NUEVO: Filtrar por business_id
            .single();
          
          if (convError) {
            console.error(`❌ Error consultando estado del bot: ${convError.message}`);
          } else if (convData) {
            botActive = convData.is_bot_active === true; // Comparación estricta
            console.log(`ℹ️ ESTADO DIRECTO DB: Bot ${botActive ? 'ACTIVO ✅' : 'INACTIVO ❌'} para la conversación ${conversationId} (número ${sender})`);
          }
        } else {
          // Si no tenemos ID, buscar por número
          const { data: convByNumber, error: numberError } = await supabase
            .from('conversations')
            .select('id, is_bot_active')
            .eq('user_id', sender)
            .eq('business_id', BUSINESS_ID) // NUEVO: Filtrar por business_id
            .single();
          
          if (numberError) {
            console.error(`❌ Error consultando por número: ${numberError.message}`);
          } else if (convByNumber) {
            botActive = convByNumber.is_bot_active === true;
            console.log(`ℹ️ ESTADO POR NÚMERO: Bot ${botActive ? 'ACTIVO ✅' : 'INACTIVO ❌'} para ${sender}`);
            
            // Actualizar también el ID de conversación
            conversationId = convByNumber.id;
          }
        }
      } catch (dbError) {
        console.error(`❌ Error crítico consultando estado del bot: ${dbError.message}`);
      }
      
      // Verificación final antes de procesar
      console.log(`🔐 VERIFICACIÓN FINAL antes de procesar: Bot para ${sender} está ${botActive ? 'ACTIVO ✅' : 'INACTIVO ❌'}`);
    
      // Si es una imagen, enviar una respuesta estándar inmediatamente
      if (isImage && botActive) {
        console.log('🖼️ Respondiendo a mensaje de imagen con respuesta estándar');
        
        const imageResponse = "Lo siento, actualmente no puedo procesar imágenes. Por favor, envía tu consulta como mensaje de texto o, si necesitas asistencia con esta imagen, puedo transferirte con un asesor.";
        
        try {
          // NUEVO: Pasar businessConfig completo
          await sendWhatsAppResponse(sender, imageResponse, businessConfig);
          
          // Registrar la respuesta en la base de datos
          if (conversationId) {
            await registerBotResponse(conversationId, imageResponse, BUSINESS_ID);
            console.log('✅ Respuesta a imagen registrada en la base de datos');
          }
        } catch (responseError) {
          console.error(`❌ Error enviando respuesta a imagen: ${responseError.message}`);
        }
        
        // Terminar aquí, no pasamos la imagen al procesamiento normal
        return res.sendStatus(200);
      }
      
      // Si es un audio, enviar una respuesta estándar inmediatamente
      if (isAudio && botActive) {
        console.log('🔊 Respondiendo a mensaje de audio con respuesta estándar');
        
        // Respuesta personalizada para mensajes de audio
        const audioResponse = "Lo siento, actualmente no puedo procesar mensajes de audio. Por favor, envía tu consulta como mensaje de texto o, si necesitas ayuda con lo que mencionaste en el audio, puedo transferirte con un asesor.";
        
        try {
          // NUEVO: Pasar businessConfig completo
          await sendWhatsAppResponse(sender, audioResponse, businessConfig);
          
          // Registrar la respuesta en la base de datos
          if (conversationId) {
            await registerBotResponse(conversationId, audioResponse, BUSINESS_ID);
            console.log('✅ Respuesta a audio registrada en la base de datos');
          }
        } catch (responseError) {
          console.error(`❌ Error enviando respuesta a audio: ${responseError.message}`);
        }
        
        // Terminar aquí, no pasamos el audio al procesamiento normal
        return res.sendStatus(200);
      }
    
      // Procesar mensaje con OpenAI SOLO si el bot está ACTIVO y no es una imagen ni un audio
      if (botActive && !isImage && !isAudio) {
        console.log(`🔍 Intentando procesar mensaje de texto con OpenAI`);
        
        try {
          // NUEVO: Pasar businessConfig completo
          const openAIResponse = await processMessageWithOpenAI(
            sender, 
            message, 
            conversationId, 
            businessConfig
          );
          
          if (openAIResponse && openAIResponse.success) {
            console.log(`✅ Respuesta de OpenAI enviada correctamente`);
          } else {
            console.error(`❌ Error procesando mensaje con OpenAI: ${openAIResponse?.error || 'Desconocido'}`);
            
            // Si falla OpenAI, intentar enviar mensaje de error genérico
            try {
              const errorMessage = 'Lo siento, estoy teniendo problemas para procesar tu mensaje. Por favor, intenta más tarde o contacta a un asesor.';
              
              // NUEVO: Pasar businessConfig completo
              await sendWhatsAppResponse(sender, errorMessage, businessConfig);
              
              // Registrar la respuesta de error en la base de datos
              if (conversationId) {
                await registerBotResponse(conversationId, errorMessage, BUSINESS_ID);
              }
            } catch (fallbackError) {
              console.error(`❌ Error enviando mensaje de error: ${fallbackError.message}`);
            }
          }
        } catch (openaiError) {
          console.error(`❌ Error procesando mensaje con OpenAI: ${openaiError.message}`);
        }
      } else if (!botActive) {
        console.log(`🤖 Bot inactivo para ${sender}, no se procesa el mensaje`);
      }
      
      return res.sendStatus(200);
    } catch (error) {
      console.error(`❌ Error procesando webhook: ${error.message}`);
      return res.sendStatus(200); // Siempre responder 200 para evitar reintentos
    }
  });
}

module.exports = setupMultitenantWebhook; 