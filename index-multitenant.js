/**
 * WhatsApp Bot con OpenAI y Gupshup - Versión Multi-tenant
 * 
 * Esta versión soporta múltiples negocios, cada uno con su propia 
 * configuración de OpenAI, Gupshup y otros parámetros.
 */

// Primero, cargar las variables de entorno
require('dotenv').config();

// Cargar el parche global
require('./global-patch');

// Importaciones principales
const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

// Importar módulos para arquitectura multi-tenant
const businessConfigLoader = require('./business-config-loader');
const setupMultitenantWebhook = require('./webhook-handler-multitenant');
const processMessageWithOpenAI = require('./openai-processor');
const sendWhatsAppResponse = require('./whatsapp-sender');

// Importar Supabase
const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_URL, SUPABASE_KEY } = require('./supabase-config');
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Variables globales para el servidor
const PORT = process.env.PORT || 3010;

// Definir caches y estado global
global.recentlyProcessedMessages = new Set();
global.userThreads = {};

// Crear aplicación Express
const app = express();

// Configurar middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

// Ruta de inicio
app.get('/', (req, res) => {
  const businessCount = businessConfigLoader.businessConfigCache.size;
  
  res.send(`
    <html>
      <head>
        <title>WhatsApp Bot Multi-tenant</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { color: #4CAF50; }
          .card { border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 20px; }
          .status { display: inline-block; padding: 5px 10px; border-radius: 4px; margin-left: 10px; }
          .active { background-color: #4CAF50; color: white; }
          .inactive { background-color: #f44336; color: white; }
          .info { color: #666; }
        </style>
      </head>
      <body>
        <h1>WhatsApp Bot Multi-tenant</h1>
        <div class="card">
          <h2>Estado del Servidor</h2>
          <p>✅ Servidor activo y funcionando en puerto ${PORT}</p>
          <p>🏢 Negocios configurados: ${businessCount}</p>
          <p>🗄️ Conectado a Supabase: ${SUPABASE_URL}</p>
        </div>
        
        <div class="card">
          <h2>Negocios Activos</h2>
          ${Array.from(businessConfigLoader.businessConfigCache.values()).map(config => `
            <div>
              <h3>${config.business_name}
                <span class="status ${config.is_active ? 'active' : 'inactive'}">
                  ${config.is_active ? 'Activo' : 'Inactivo'}
                </span>
              </h3>
              <p>Número: ${config.gupshup_number}</p>
              <p>ID: ${config.id}</p>
            </div>
          `).join('')}
        </div>
      </body>
    </html>
  `);
});

// Configurar ruta para verificar webhook de WhatsApp
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const challenge = req.query['hub.challenge'];
  const token = req.query['hub.verify_token'];
  
  console.log(`📥 Solicitud de verificación recibida: mode=${mode}, token=${token}`);
  
  // Verificar token (opcional, depende de tu configuración en Gupshup)
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'verify_token_whatsapp_webhook';
  
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Verificación exitosa');
    res.status(200).send(challenge);
  } else {
    console.error('❌ Verificación fallida');
    res.sendStatus(403);
  }
});

// Configurar el webhook multi-tenant
setupMultitenantWebhook(
  app, 
  extractMessageData,
  async (sender, message, conversationId, businessConfig) => {
    return await processMessageWithOpenAI(
      sender, 
      message, 
      conversationId, 
      businessConfig, 
      sendWhatsAppResponse, 
      registerBotResponse
    );
  },
  sendWhatsAppResponse, 
  registerBotResponse, 
  supabase
);

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
  console.log(`📄 Para información del servidor, visita http://localhost:${PORT}/`);
});

/**
 * Función para extraer datos relevantes del mensaje de Gupshup
 * @param {Object} body Cuerpo de la solicitud webhook
 * @returns {Object} Datos del mensaje extraídos
 */
function extractMessageData(body) {
  try {
    // Si no hay cuerpo, devolver datos vacíos
    if (!body) {
      return { isStatusUpdate: true };
    }
    
    // Para notificaciones de estado (entrega, leído, etc.)
    if (body.type === 'message-event') {
      return { isStatusUpdate: true, eventType: body.payload?.type };
    }
    
    // Para mensajes de WhatsApp a través de Gupshup
    if (body.app === 'WhatsApp' && body.payload && body.payload.type === 'text') {
      return {
        isStatusUpdate: false,
        sender: body.payload.sender?.phone || body.sender?.phone,
        recipient: body.payload.recipient?.phone || body.payload.destination,
        message: body.payload.payload?.text || body.payload.text,
        messageId: body.payload.messageId || body.messageId,
        timestamp: body.timestamp || new Date().toISOString(),
        isImage: false,
        isAudio: false
      };
    }
    
    // Para mensajes de imagen
    if (body.app === 'WhatsApp' && body.payload && body.payload.type === 'image') {
      return {
        isStatusUpdate: false,
        sender: body.payload.sender?.phone || body.sender?.phone,
        recipient: body.payload.recipient?.phone || body.payload.destination,
        message: body.payload.payload?.caption || "",
        messageId: body.payload.messageId || body.messageId,
        timestamp: body.timestamp || new Date().toISOString(),
        isImage: true,
        isAudio: false,
        imageUrl: body.payload.payload?.url
      };
    }
    
    // Para mensajes de audio
    if (body.app === 'WhatsApp' && body.payload && body.payload.type === 'audio') {
      return {
        isStatusUpdate: false,
        sender: body.payload.sender?.phone || body.sender?.phone,
        recipient: body.payload.recipient?.phone || body.payload.destination,
        message: "",
        messageId: body.payload.messageId || body.messageId,
        timestamp: body.timestamp || new Date().toISOString(),
        isImage: false,
        isAudio: true,
        audioUrl: body.payload.payload?.url
      };
    }
    
    // Datos incompletos, no hay suficiente información para procesar
    return { isStatusUpdate: true };
    
  } catch (error) {
    console.error(`❌ Error extrayendo datos del mensaje: ${error.message}`);
    return { isStatusUpdate: true, error: error.message };
  }
}

/**
 * Registra la respuesta del bot en la base de datos
 * @param {string|Object} conversationIdOrSender ID de conversación o número de teléfono
 * @param {string} message Mensaje a registrar
 * @param {string} business_id ID del negocio
 * @param {string} sender_type Tipo de remitente ('bot' o 'user')
 * @returns {Promise<Object>} Resultado de la operación
 */
async function registerBotResponse(conversationIdOrSender, message, business_id, sender_type = 'bot') {
  try {
    console.log(`🔄 Registrando mensaje de ${sender_type} para negocio ${business_id}`);
    
    let conversationId = conversationIdOrSender;
    let isNewConversation = false;
    
    // Si se proporcionó un número de teléfono en lugar de ID de conversación
    if (typeof conversationIdOrSender === 'string' && conversationIdOrSender.includes('+')) {
      const phone = conversationIdOrSender;
      
      // Buscar conversación existente
      const { data: existingConv, error: searchError } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', phone)
        .eq('business_id', business_id)
        .single();
      
      if (searchError || !existingConv) {
        // Crear nueva conversación
        const { data: newConv, error: createError } = await supabase
          .from('conversations')
          .insert([{
            user_id: phone,
            business_id: business_id,
            last_message: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
            last_message_time: new Date().toISOString()
          }])
          .select()
          .single();
        
        if (createError) {
          throw new Error(`Error creando conversación: ${createError.message}`);
        }
        
        conversationId = newConv.id;
        isNewConversation = true;
        console.log(`✅ Nueva conversación creada: ${conversationId}`);
      } else {
        conversationId = existingConv.id;
        console.log(`✅ Usando conversación existente: ${conversationId}`);
      }
    }
    
    // Guardar mensaje en la base de datos
    const { data: message_data, error: message_error } = await supabase
      .from('messages')
      .insert([{
        conversation_id: conversationId,
        content: message,
        sender_type: sender_type
      }])
      .select()
      .single();
    
    if (message_error) {
      throw new Error(`Error guardando mensaje: ${message_error.message}`);
    }
    
    // Actualizar last_message y last_message_time en la conversación
    if (!isNewConversation) {
      const { error: updateError } = await supabase
        .from('conversations')
        .update({
          last_message: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
          last_message_time: new Date().toISOString()
        })
        .eq('id', conversationId);
      
      if (updateError) {
        console.warn(`⚠️ Error actualizando conversación: ${updateError.message}`);
      }
    }
    
    return {
      success: true,
      conversationId,
      messageId: message_data.id
    };
    
  } catch (error) {
    console.error(`❌ Error registrando respuesta: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
} 