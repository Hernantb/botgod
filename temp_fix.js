// Función corregida para extraer datos del mensaje de la solicitud de webhook
// Incluye soporte mejorado para mensajes de audio
function extractMessageData(body) {
  try {
    console.log(`🔍 Extrayendo datos de mensaje de webhook: ${JSON.stringify(body).substring(0, 200)}...`);
    logDebug(`🔍 Extrayendo datos de mensaje de webhook: ${JSON.stringify(body).substring(0, 200)}...`);
    
    // Valores por defecto
    const result = {
      isStatusUpdate: false,
      sender: null,
      message: null,
      messageId: null,
      timestamp: null,
      isImage: false,  // Bandera para detectar si es una imagen
      isAudio: false   // Bandera para detectar si es un audio
    };
    
    // Imprimir la estructura completa para depuración
    console.log('📝 Estructura completa del webhook:');
    console.log(JSON.stringify(body, null, 2));
    
    // Verificar si es un mensaje o una actualización de estado
    if (body && body.entry && body.entry.length > 0) {
      const entry = body.entry[0];
      
      if (entry.changes && entry.changes.length > 0) {
        const change = entry.changes[0];
        
        // Para mensajes entrantes normales
        if (change.value && change.value.messages && change.value.messages.length > 0) {
          const messageData = change.value.messages[0];
          const contact = change.value.contacts && change.value.contacts.length > 0 
            ? change.value.contacts[0] 
            : null;
          
          result.sender = contact && contact.wa_id ? contact.wa_id : null;
          result.messageId = messageData.id || null;
          
          console.log(`📨 Datos del mensaje: ${JSON.stringify(messageData)}`);
          
          // Comprobar si es una imagen
          if (messageData.type === 'image' || messageData.image) {
            console.log('🖼️ Mensaje de tipo imagen detectado');
            result.isImage = true;
            result.message = "[IMAGEN RECIBIDA]"; // Mensaje estándar para indicar que se recibió una imagen
            result.imageData = messageData.image || null;
          }
          // Comprobar si es un audio
          else if (messageData.type === 'audio' || messageData.audio) {
            console.log('🔊 Mensaje de tipo audio detectado');
            result.isAudio = true;
            result.message = "[AUDIO RECIBIDO]"; // Mensaje estándar para indicar que se recibió un audio
            result.audioData = messageData.audio || null;
          }
          // Extraer contenido según el tipo de mensaje (sólo si no es una imagen ni audio)
          else if (messageData.text && messageData.text.body) {
            result.message = messageData.text.body;
            console.log(`💬 Mensaje de texto encontrado: "${result.message}"`);
          } else if (messageData.type === 'text' && messageData.text) {
            result.message = messageData.text.body;
            console.log(`💬 Mensaje de texto (tipo): "${result.message}"`);
          } else if (messageData.type === 'button' && messageData.button) {
            result.message = messageData.button.text;
            console.log(`🔘 Mensaje de botón: "${result.message}"`);
          } else if (messageData.type === 'interactive' && messageData.interactive) {
            // Manejar mensajes interactivos (botones, listas, etc.)
            if (messageData.interactive.button_reply) {
              result.message = messageData.interactive.button_reply.title;
              console.log(`🔘 Respuesta interactiva (botón): "${result.message}"`);
            } else if (messageData.interactive.list_reply) {
              result.message = messageData.interactive.list_reply.title;
              console.log(`📋 Respuesta interactiva (lista): "${result.message}"`);
            }
          }
          
          // Si no pudimos extraer el mensaje, intentar con la estructura completa
          if (!result.message && !result.isImage && !result.isAudio && messageData) {
            console.log('⚠️ No se pudo extraer mensaje con métodos conocidos, intentando alternativas...');
            // Intentar extraer de cualquier propiedad que tenga "body" o "text"
            if (messageData.body) {
              result.message = messageData.body;
              console.log(`🔄 Mensaje alternativo (body): "${result.message}"`);
            } else {
              // Buscar en todas las propiedades de primer nivel
              for (const key in messageData) {
                if (typeof messageData[key] === 'object' && messageData[key] !== null) {
                  if (messageData[key].body) {
                    result.message = messageData[key].body;
                    console.log(`🔄 Mensaje alternativo (${key}.body): "${result.message}"`);
                    break;
                  } else if (messageData[key].text) {
                    result.message = messageData[key].text;
                    console.log(`🔄 Mensaje alternativo (${key}.text): "${result.message}"`);
                    break;
                  }
                } else if (key === 'text' || key === 'body') {
                  result.message = messageData[key];
                  console.log(`🔄 Mensaje alternativo (${key}): "${result.message}"`);
                  break;
                }
              }
            }
          }
          
          // Capturar timestamp si está disponible
          result.timestamp = messageData.timestamp
            ? new Date(parseInt(messageData.timestamp) * 1000) 
            : new Date();
          
          console.log(`⏰ Timestamp: ${result.timestamp}`);
        } 
        // Para actualizaciones de estado de mensajes
        else if (change.value && change.value.statuses && change.value.statuses.length > 0) {
          result.isStatusUpdate = true;
          const status = change.value.statuses[0];
          result.messageId = status.id;
          result.status = status.status;
          result.timestamp = status.timestamp 
            ? new Date(parseInt(status.timestamp) * 1000) 
            : new Date();
          result.recipient = status.recipient_id;
          console.log(`📊 Actualización de estado: ${result.status} para mensaje ${result.messageId}`);
        }
      }
    }
    
    // Verificar si pudimos extraer los datos necesarios
    if (!result.isStatusUpdate && (!result.sender || (!result.message && !result.isImage && !result.isAudio))) {
      console.log(`⚠️ No se pudieron extraer datos completos del mensaje: sender=${result.sender}, message=${result.message}, isImage=${result.isImage}, isAudio=${result.isAudio}`);
      logDebug(`⚠️ No se pudieron extraer datos completos del mensaje: sender=${result.sender}, message=${result.message}`);
    } else {
      const contentType = result.isImage ? "imagen" : (result.isAudio ? "audio" : `mensaje "${result.message}"`);
      console.log(`✅ Datos extraídos correctamente: ${result.isStatusUpdate ? 'actualización de estado' : `${contentType} de ${result.sender}`}`);
      logDebug(`✅ Datos extraídos correctamente: ${result.isStatusUpdate ? 'actualización de estado' : `mensaje de ${result.sender}`}`);
    }
    
    return result;
  } catch (error) {
    console.log(`❌ Error extrayendo datos del mensaje: ${error.message}`);
    console.log(`❌ Stack: ${error.stack}`);
    logDebug(`❌ Error extrayendo datos del mensaje: ${error.message}`);
    return {
      isStatusUpdate: false,
      sender: null,
      message: null,
      messageId: null,
      timestamp: new Date()
    };
  }
} // Webhook corregido para recibir mensajes de WhatsApp
// Incluye soporte mejorado para mensajes de audio
app.post('/webhook', async (req, res) => {
    try {
        const body = req.body;
        console.log(`📩 Mensaje recibido en webhook: ${JSON.stringify(body).substring(0, 500)}...`);
        
        // Extraer datos del mensaje
        const messageData = extractMessageData(body);
        
        // Si es una actualización de estado, solo registrarla
        if (messageData.isStatusUpdate) {
            console.log(`📊 Notificación de estado recibida, no requiere respuesta`);
            console.log(`📊 Procesada notificación de estado`);
            return res.sendStatus(200);
        }
        
        const { sender, message, messageId, isImage, isAudio } = messageData;
        
        if (!sender) {
            console.log(`⚠️ Mensaje sin remitente, ignorando: ${JSON.stringify(messageData)}`);
            return res.sendStatus(200);
        }
        
        // Modificar esta condición para permitir mensajes de audio/imagen sin contenido de texto
        if (!message && !isImage && !isAudio) {
            console.log(`⚠️ Mensaje sin contenido válido, ignorando: ${JSON.stringify(messageData)}`);
            return res.sendStatus(200);
        }
        
        console.log(`👤 Mensaje recibido de ${sender}: ${message || (isImage ? "[IMAGEN]" : isAudio ? "[AUDIO]" : "[DESCONOCIDO]")}`);
        
        // Verificar si este mensaje ya fue procesado recientemente
        // Generar una clave única para este mensaje que tenga en cuenta su tipo
        const messageKey = `${messageId || sender}_${message || (isImage ? "IMAGEN" : isAudio ? "AUDIO" : "DESCONOCIDO")}`;
        if (recentlyProcessedMessages.has(messageKey)) {
            console.log(`⚠️ Mensaje duplicado detectado, ignorando: ${messageKey}`);
            return res.sendStatus(200);
        }
        
        // Marcar este mensaje como procesado
        recentlyProcessedMessages.add(messageKey);
        setTimeout(() => recentlyProcessedMessages.delete(messageKey), 60000); // Eliminar después de 1 minuto
        
        // Guardar mensaje en Supabase
        console.log(`💾 Guardando mensaje entrante para ${sender}`);
        let conversationId = null;
        
        try {
            // Verificar si tenemos un ID de conversación mapeado para este número
            if (phoneToConversationMap[sender]) {
                conversationId = phoneToConversationMap[sender];
                console.log(`✅ ID de conversación encontrado en caché: ${conversationId}`);
            }
            
            // Guardar mensaje del usuario en la base de datos
            console.log(`💾 Guardando mensaje de tipo 'user' para: ${sender}`);
            const userMessageResult = await global.registerBotResponse(sender, message || (isImage ? "[IMAGEN RECIBIDA]" : "[AUDIO RECIBIDO]"), BUSINESS_ID, 'user');
      
            if (userMessageResult && userMessageResult.success) {
                console.log('✅ Mensaje guardado en Supabase correctamente');
                conversationId = userMessageResult.conversationId;
                
                // Actualizar mapeo de conversación
                if (conversationId && sender) {
                    phoneToConversationMap[sender] = conversationId;
                    conversationIdToPhoneMap[conversationId] = sender;
                }
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
                    .single();
                
                if (convError) {
                    console.error(`❌ Error consultando estado del bot: ${convError.message}`);
                } else if (convData) {
                    botActive = convData.is_bot_active === true; // Comparación estricta
                    console.log(`ℹ️ ESTADO DIRECTO DB: Bot ${botActive ? 'ACTIVO ✅' : 'INACTIVO ❌'} para la conversación ${conversationId} (número ${sender})`);
                    
                    // Actualizar caché
                    senderBotStatusMap[sender] = botActive;
                    console.log(`📝 Caché actualizada: senderBotStatusMap[${sender}] = ${botActive}`);
                }
            } else {
                // Si no tenemos ID, buscar por número
                const { data: convByNumber, error: numberError } = await supabase
                    .from('conversations')
                    .select('id, is_bot_active')
                    .eq('user_id', sender)
                    .single();
                
                if (numberError) {
                    console.error(`❌ Error consultando por número: ${numberError.message}`);
                } else if (convByNumber) {
                    botActive = convByNumber.is_bot_active === true;
                    console.log(`ℹ️ ESTADO POR NÚMERO: Bot ${botActive ? 'ACTIVO ✅' : 'INACTIVO ❌'} para ${sender}`);
                    
                    // Actualizar caché y mapeo
                    senderBotStatusMap[sender] = botActive;
                    console.log(`📝 Caché actualizada: senderBotStatusMap[${sender}] = ${botActive}`);
                    
                    // Actualizar también el ID de conversación
                    conversationId = convByNumber.id;
                    phoneToConversationMap[sender] = conversationId;
                    conversationIdToPhoneMap[conversationId] = sender;
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
                await sendWhatsAppResponse(sender, imageResponse);
                
                // Registrar la respuesta en la base de datos
                if (conversationId) {
                    await registerBotResponse(conversationId, imageResponse);
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
                await sendWhatsAppResponse(sender, audioResponse);
                
                // Registrar la respuesta en la base de datos
                if (conversationId) {
                    await registerBotResponse(conversationId, audioResponse);
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
                // Procesar el mensaje con OpenAI y enviar la respuesta
                const openAIResponse = await processMessageWithOpenAI(sender, message, conversationId);
                
                if (openAIResponse && openAIResponse.success) {
                    console.log(`✅ Respuesta de OpenAI enviada correctamente`);
                } else {
                    console.error(`❌ Error procesando mensaje con OpenAI: ${openAIResponse?.error || 'Desconocido'}`);
                    
                    // Si falla OpenAI, intentar enviar mensaje de error genérico
                    try {
                        const errorMessage = 'Lo siento, estoy teniendo problemas para procesar tu mensaje. Por favor, intenta más tarde o contacta a un asesor.';
                        await sendWhatsAppResponse(sender, errorMessage);
                        
                        // Registrar la respuesta de error en la base de datos
                        if (conversationId) {
                            await registerBotResponse(conversationId, errorMessage);
                        }
                    } catch (fallbackError) {
                        console.error(`❌ Error enviando mensaje de error: ${fallbackError.message}`);
                    }
                }
            } catch (processingError) {
                console.error(`❌ Error crítico al procesar mensaje: ${processingError.message}`);
            }
        } else {
            console.log(`⏩ Saltando procesamiento con OpenAI: bot ${botActive ? 'activo' : 'inactivo'}, imagen: ${isImage}, audio: ${isAudio}`);
        }
        
        // Responder al webhook para evitar timeouts
        return res.sendStatus(200);
    } catch (error) {
        console.error('❌ Error en webhook:', error);
        return res.sendStatus(200); // Responder 200 de todos modos para evitar reintentos
    }
}); 