// Primero, cargar las variables de entorno (para que surtan efecto desde el inicio)
require('dotenv').config();

// SOLUCIÓN DEFINITIVA: Forzar URL en Render
// Detectar ambiente Render
const RENDER_ENV = process.env.RENDER === 'true' || process.env.RENDER_EXTERNAL_URL !== undefined;
const PROD_ENV = process.env.NODE_ENV === 'production';

// En Render, siempre usar la URL correcta (antes de cualquier otro código)
if (RENDER_ENV || PROD_ENV) {
  const correctUrl = 'https://whatsapp-bot-if6z.onrender.com/api/register-bot-response';
  process.env.CONTROL_PANEL_URL = correctUrl;
  console.log(`🛠️ CONFIGURACIÓN TEMPRANA: URL forzada a ${correctUrl}`);
  
  // Guardar también variables para Supabase para asegurar que estén disponibles
  if (!process.env.SUPABASE_KEY && process.env.SUPABASE_ANON_KEY) {
    process.env.SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
    console.log('🔑 CONFIGURACIÓN TEMPRANA: Copiando SUPABASE_ANON_KEY a SUPABASE_KEY');
  }
}

// Cargar el parche global que define registerBotResponse
require('./global-patch');

// Importaciones principales
const axios = require('axios');
const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const OpenAI = require('openai');
const fileUpload = require('express-fileupload');

// Importar módulo de notificaciones
const notificationModule = require('./notification-patch.cjs');

// Importar Supabase
const { createClient } = require('@supabase/supabase-js');

// Importar módulos de notificación
const { 
  checkForNotificationPhrases, 
  handleNotificationUpdate 
} = require('./notification-handler');

// Importar el procesador de OpenAI con soporte para calendario
const { processMessageWithOpenAI } = require('./openai-processor');

// Variables globales para el servidor
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wscijkxwevgxbgwhbqtm.supabase.co';
// const SUPABASE_API_KEY = process.env.SUPABASE_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTgwOTkxNzYsImV4cCI6MjAxMzY3NTE3Nn0.B_LQ2_2jUIZ1PvR1_ObQ-8fmVOaOY0jXkYa9KGbU9N0';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ASSISTANT_ID = process.env.ASSISTANT_ID || 'asst_bdJlX30wF1qQH3Lf8ZoiptVx';
const PORT = process.env.PORT || 3095;
let CONTROL_PANEL_URL = process.env.CONTROL_PANEL_URL || 'https://whatsapp-bot-if6z.onrender.com/api/register-bot-response';
const BUSINESS_ID = process.env.BUSINESS_ID || '2d385aa5-40e0-4ec9-9360-19281bc605e4';
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'verify_token_whatsapp_webhook';

// Credenciales de GupShup - cambiadas a 'let' para permitir actualización en tiempo de ejecución
let GUPSHUP_API_KEY = process.env.GUPSHUP_API_KEY;
let GUPSHUP_NUMBER = process.env.GUPSHUP_NUMBER;
let GUPSHUP_USERID = process.env.GUPSHUP_USERID;

// Inicializar OpenAI
const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
});

// Verificar el formato de la API Key
if (OPENAI_API_KEY && !OPENAI_API_KEY.startsWith('sk-')) {
    console.warn('⚠️ ADVERTENCIA: El formato de la API Key de OpenAI parece incorrecto. Debería comenzar con "sk-"');
    console.warn('⚠️ Por favor, verifica tu API Key en https://platform.openai.com/account/api-keys');
}

const SYSTEM_PROMPT = `Eres un asistente de ventas amigable y profesional para concesionarios SEAT y CUPRA. Tu objetivo es ayudar a los clientes a encontrar el vehículo que mejor se adapte a sus necesidades, responder preguntas sobre modelos específicos, características, financiamiento y promociones.

Reglas importantes:
1. Sé respetuoso y profesional en todo momento.
2. Proporciona información precisa sobre vehículos SEAT y CUPRA.
3. Si no conoces la respuesta, sugiérele al cliente que visite el concesionario o hable con un asesor humano.
4. No inventes información sobre precios exactos, promociones o disponibilidad.
5. Mantén tus respuestas concisas y directas.
6. No uses emojis.
7. Cuando sugieras un modelo, menciona brevemente sus características principales.`;

// Mapeo bidireccional para mantener relación entre números telefónicos e IDs de conversación
const phoneToConversationMap = {};
// Mapeo de IDs de conversación a números telefónicos
const conversationIdToPhoneMap = {};

// Caché del estado del bot por remitente
const senderBotStatusMap = {};

// Cache para evitar procesar mensajes duplicados (por ID + contenido)
const processedMessages = {};

// Set para almacenar mensajes procesados recientemente (evitar duplicados)
const recentlyProcessedMessages = new Set();

// 🗂 Almacena el historial de threads de usuarios
const userThreads = {};

// Caché de contactos para almacenar nombres asociados a números
const contactCache = {};

// Función para actualizar/mantener los mapeos entre conversaciones y números telefónicos
// Debe llamarse cada vez que se crea o accede a una conversación
async function updateConversationMappings() {
  console.log('🔄 Actualizando mapeos de conversaciones y números...');
  
  try {
    // Obtener todas las conversaciones activas para el negocio
    const { data, error } = await supabase
      .from('conversations')
      .select('id, user_id')
      .eq('business_id', BUSINESS_ID);
    
    if (error) {
      console.error('❌ Error al cargar mapeos:', error.message);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log('ℹ️ No hay conversaciones para mapear');
      return;
    }
    
    console.log(`🔍 Encontradas ${data.length} conversaciones para mapeo`);
    
    // Actualizar mapeos en memoria
    data.forEach(conv => {
      if (conv.id && conv.user_id) {
        // Solo actualizar si ambos valores existen
        phoneToConversationMap[conv.user_id] = conv.id;
        conversationIdToPhoneMap[conv.id] = conv.user_id;
      }
    });
    
    console.log(`✅ Mapeos actualizados: ${Object.keys(phoneToConversationMap).length} números mapeados`);
  } catch (e) {
    console.error('❌ Error crítico en actualización de mapeos:', e.message);
  }
}

// 🔧 Parche de URL: Corregir CONTROL_PANEL_URL si es necesario
console.log("🔧 APLICANDO PARCHE PARA CORREGIR URLs DEL BOT WHATSAPP");

// Usar constantes definidas al inicio
console.log("Ambiente:", PROD_ENV ? "Producción" : "Desarrollo");
console.log("Render detectado:", RENDER_ENV ? "SÍ" : "NO");

// En Render, siempre usar la URL correcta
if (RENDER_ENV && PROD_ENV) {
  const renderUrl = 'https://whatsapp-bot-if6z.onrender.com/api/register-bot-response';
  console.log(`🏗️ Ambiente Render detectado, forzando URL correcta: ${renderUrl}`);
  process.env.CONTROL_PANEL_URL = renderUrl;
  CONTROL_PANEL_URL = renderUrl;
  console.log(`✅ URL configurada para Render: ${CONTROL_PANEL_URL}`);
} else {
  // Procesar la URL para otros entornos
  let originalUrl = process.env.CONTROL_PANEL_URL || (PROD_ENV ? 'https://whatsapp-bot-if6z.onrender.com/api/register-bot-response' : 'http://localhost:3000');
console.log("CONTROL_PANEL_URL actual:", originalUrl);

  // Si estamos en producción y la URL contiene localhost, corregirla
  if (PROD_ENV && originalUrl.includes('localhost')) {
    console.log("⚠️ Detectada URL de localhost en ambiente de producción. Corrigiendo...");
    originalUrl = 'https://whatsapp-bot-if6z.onrender.com/api/register-bot-response';
    console.log("✅ URL corregida para producción:", originalUrl);
  }

// Corregir URL duplicada
if (originalUrl.includes('/register-bot-response/register-bot-response')) {
    originalUrl = originalUrl.replace('/register-bot-response/register-bot-response', '/register-bot-response');
}

// Verificar dominios antiguos y corregirlos
  if (PROD_ENV && originalUrl.includes('panel-control-whatsapp.onrender.com')) {
    originalUrl = originalUrl.replace('panel-control-whatsapp.onrender.com', 'whatsapp-bot-if6z.onrender.com');
}

// Si la URL contiene el dominio antiguo, actualizarlo
if (originalUrl.includes('render-wa.onrender.com')) {
    originalUrl = originalUrl.replace('render-wa.onrender.com', 'whatsapp-bot-if6z.onrender.com');
    console.log("URL actualizada a dominio correcto:", originalUrl);
}

// Corregir estructura
if (originalUrl.endsWith('/register-bot-response')) {
    // URL ya tiene el endpoint, no necesita cambios
    process.env.CONTROL_PANEL_URL = originalUrl.trim();
    CONTROL_PANEL_URL = originalUrl.trim();
} else if (originalUrl.includes('/register-bot-response/')) {
    // URL tiene endpoint duplicado
    process.env.CONTROL_PANEL_URL = originalUrl.split('/register-bot-response/')[0] + '/register-bot-response';
    CONTROL_PANEL_URL = process.env.CONTROL_PANEL_URL;
} else {
    // URL no tiene endpoint, agregar si no termina en /
    const formattedUrl = originalUrl.endsWith('/') 
        ? originalUrl.slice(0, -1) + '/register-bot-response'
        : originalUrl + '/register-bot-response';
    process.env.CONTROL_PANEL_URL = formattedUrl;
    CONTROL_PANEL_URL = formattedUrl;
  }
}

console.log("URL final que se usará:", CONTROL_PANEL_URL);
console.log("✅ Parche aplicado correctamente");
console.log("📝 De ahora en adelante, las URLs duplicadas serán corregidas automáticamente");
console.log("🌐 En ambiente de producción, se usará:", PROD_ENV ? CONTROL_PANEL_URL : "URL de desarrollo");
console.log("🔍 También puedes usar la función global registerBotResponse() para enviar mensajes");

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Configuración express
const app = express();
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  abortOnLimit: true,
  createParentPath: true
}));

// Configurar CORS
const corsOptions = {
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3005', 'https://whatsapp-mern-front.vercel.app'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
  exposedHeaders: ['Access-Control-Allow-Origin', 'Access-Control-Allow-Credentials']
};
app.use(cors(corsOptions));

// Variable global para activar modo debug
const DEBUG_MODE = process.env.DEBUG_MODE === 'true' || process.env.NODE_ENV === 'development';

// Middleware para registro de solicitudes CORS
app.use((req, res, next) => {
  if (DEBUG_MODE) {
    console.log(`🔄 ${req.method} ${req.url} - Origin: ${req.headers.origin || 'Unknown'}`);
  }
  // Establecer headers CORS adicionales para todas las respuestas
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

// Middleware para opciones preflight
app.options('*', cors(corsOptions));

// Middleware para logs detallados
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.url}`);
  next();
});

// 🔃 Control de mensajes procesados para evitar duplicados
const MESSAGE_EXPIRE_TIME = 60000; // 60 segundos para expirar mensajes procesados

// Función para verificar si un mensaje ya fue procesado
function isMessageProcessed(messageId, sender, text) {
  // Si tenemos un ID específico del mensaje
  if (messageId) {
    return processedMessages.has(messageId);
  }
  
  // Si no tenemos ID, usamos una combinación de remitente + texto + timestamp aproximado
  const messageKey = `${sender}:${text}`;
  const now = Date.now();
  
  // Verificar si ya existe una entrada reciente con esta combinación
  for (const [key, timestamp] of processedMessages.entries()) {
    if (key.startsWith(messageKey) && (now - timestamp) < MESSAGE_EXPIRE_TIME) {
      return true;
    }
  }
  
  return false;
}

// Función para marcar un mensaje como procesado
function markMessageAsProcessed(messageId, sender, text) {
  const key = messageId || `${sender}:${text}:${Date.now()}`;
  processedMessages.set(key, Date.now());
  
  // Limpieza de mensajes expirados (cada 100 mensajes)
  if (processedMessages.size > 100) {
    const now = Date.now();
    for (const [key, timestamp] of processedMessages.entries()) {
      if (now - timestamp > MESSAGE_EXPIRE_TIME) {
        processedMessages.delete(key);
      }
    }
  }
}

// 🚀 Verificar API Keys
console.log("🔑 API Keys cargadas:");
console.log("OPENAI_API_KEY:", OPENAI_API_KEY ? "✅ OK" : "❌ FALTA");
console.log("GUPSHUP_API_KEY:", GUPSHUP_API_KEY ? "✅ OK" : "❌ FALTA");
console.log("GUPSHUP_NUMBER:", GUPSHUP_NUMBER ? "✅ OK" : "❌ FALTA");
console.log("GUPSHUP_USERID:", GUPSHUP_USERID ? "✅ OK" : "❌ FALTA");
console.log("CONTROL_PANEL_URL:", CONTROL_PANEL_URL);

// Verificar si CONTROL_PANEL_URL es válido
if (CONTROL_PANEL_URL.includes('api.openai.com')) {
    console.error("🚨 ERROR GRAVE: CONTROL_PANEL_URL está configurado incorrectamente a api.openai.com");
    console.error("🛑 Esta configuración causará problemas con la API. Por favor corrige el valor.");
} else if (CONTROL_PANEL_URL.includes('localhost') && PROD_ENV) {
    console.warn("⚠️ Advertencia: CONTROL_PANEL_URL está configurado a localhost en entorno de producción");
    // Actualizar una última vez para asegurar que está correcto
    if (PROD_ENV) {
        const correctProdUrl = 'https://whatsapp-bot-if6z.onrender.com/api/register-bot-response';
        console.log(`⚙️ Actualizando automáticamente CONTROL_PANEL_URL a: ${correctProdUrl}`);
        process.env.CONTROL_PANEL_URL = correctProdUrl;
        CONTROL_PANEL_URL = correctProdUrl;
    }
    console.warn("⚠️ Esto podría causar problemas al registrar respuestas");
}

// ❌ Si faltan claves, detener el servidor
if (!OPENAI_API_KEY || !GUPSHUP_API_KEY || !GUPSHUP_NUMBER) {
    console.error("⚠️ ERROR: Faltan claves de API. Verifica las variables de entorno.");
    process.exit(1);
}

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://wscijkxwevgxbgwhbqtm.supabase.co';
// Intentar obtener la clave de Supabase de diferentes variables de entorno posibles
// Verificamos todas las posibles variables donde podría estar la clave de Supabase
const supabaseKey = process.env.SUPABASE_ANON_KEY || 
                   process.env.SUPABASE_KEY || 
                   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                   'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4MjI3NjgsImV4cCI6MjA1NzM5ODc2OH0._HSnvof7NUk6J__qqq3gJvbJRZnItCAmlI5HYAL8WVI';

console.log('🔑 DEBUG - Variables de entorno para Supabase:');
console.log('- SUPABASE_URL:', process.env.SUPABASE_URL || 'no definido');
console.log('- SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? process.env.SUPABASE_ANON_KEY.substring(0, 10) + '...' : 'no definido');
console.log('- SUPABASE_KEY:', process.env.SUPABASE_KEY ? process.env.SUPABASE_KEY.substring(0, 10) + '...' : 'no definido');
console.log('- NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 10) + '...' : 'no definido');

if (!supabaseUrl) {
    console.error('❌ ERROR: Falta la URL de Supabase');
    process.exit(1);
}

if (!supabaseKey) {
    console.error('❌ ERROR: Faltan credenciales de Supabase (ninguna variable de clave está definida)');
    process.exit(1);
}

console.log('✅ Credenciales de Supabase encontradas correctamente');
console.log(`🔑 Usando clave de Supabase (primeros 10 caracteres): ${supabaseKey.substring(0, 10)}...`);

const supabase = createClient(supabaseUrl, supabaseKey);

// Función auxiliar para verificar la estructura de la tabla messages
async function getMessagesTableStructure() {
    try {
        // Intentamos usar el procedimiento RPC, pero puede no existir
        const { data: tableInfo, error: tableError } = await supabase
            .rpc('get_table_metadata', { table_name: 'messages' });
        
        if (tableError) {
            console.warn('⚠️ No se pudo obtener metadata de la tabla mediante RPC:', tableError.message);
            
            // Alternativa: obtener una fila para ver estructura
            const { data: sampleRow, error: sampleError } = await supabase
                .from('messages')
                .select('*')
                .limit(1);
            
            if (sampleError) {
                console.warn('⚠️ No se pudo obtener muestra de la tabla:', sampleError.message);
                return null;
            }
            
            // Si tenemos una fila, podemos ver sus propiedades
            if (sampleRow && sampleRow.length > 0) {
                return Object.keys(sampleRow[0]);
            }
            
            // Si no hay datos, asumimos estructura básica
            return ['conversation_id', 'content', 'sender_type', 'created_at'];
        }
        
        // Si obtuvimos datos del RPC, extraer nombres de columnas
        if (tableInfo && Array.isArray(tableInfo)) {
            return tableInfo.map(col => col.column_name);
        }
        
        return null;
    } catch (error) {
        console.error('❌ Error verificando estructura de tabla:', error);
        return null;
    }
}

// Formato de fecha seguro para cualquier tipo de entrada
function safeISODate(timestamp) {
  if (!timestamp) {
    return new Date().toISOString();
  }
  
  try {
    // Si es número directo (segundos desde epoch)
    if (typeof timestamp === 'number') {
      return new Date(timestamp * 1000).toISOString();
    }
    
    // Si es string que parece número
    if (typeof timestamp === 'string' && /^\d+$/.test(timestamp)) {
      return new Date(parseInt(timestamp) * 1000).toISOString();
    }
    
    // Si ya es un objeto Date
    if (timestamp instanceof Date) {
      return timestamp.toISOString();
    }
    
    // Si es un string de fecha ISO
    if (typeof timestamp === 'string' && /^\d{4}-\d{2}-\d{2}/.test(timestamp)) {
      return new Date(timestamp).toISOString();
    }
    
    // Caso por defecto
    return new Date().toISOString();
    } catch (error) {
    console.warn(`⚠️ Error al formatear fecha ${timestamp}:`, error);
    return new Date().toISOString();
  }
}

// Agregar la función getContactName al principio del archivo
/**
 * Obtiene el nombre de un contacto a partir de su número de teléfono
 * Si no se encuentra, devuelve el número como valor predeterminado
 * @param {string} phoneNumber - Número de teléfono del contacto
 * @returns {string} - Nombre del contacto o número de teléfono
 */
function getContactName(phoneNumber) {
  try {
    console.log(`🔍 Buscando nombre para el contacto: ${phoneNumber}`);
    
    // Si no hay número, devolver un valor predeterminado
    if (!phoneNumber) return 'Usuario';
    
    // Si tenemos el contacto en caché local, usarlo
    if (contactCache[phoneNumber]) {
      return contactCache[phoneNumber];
    }
    
    // Si no tenemos información, usar el número como nombre predeterminado
    return phoneNumber;
  } catch (error) {
    console.error(`❌ Error al obtener nombre de contacto: ${error.message}`);
    return phoneNumber; // Valor seguro por defecto
  }
}

// Función para verificar si una conversación existe
async function verifyConversationExists(conversationId) {
  try {
    if (!conversationId) {
      console.error('❌ verifyConversationExists: Se requiere un ID de conversación');
      return false;
    }
    
    console.log(`🔍 Verificando existencia de conversación: ${conversationId}`);
    
    const { data, error } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .maybeSingle();
    
    if (error) {
      console.error(`❌ Error verificando conversación: ${error.message}`);
      return false;
    }
    
    const exists = !!data;
    console.log(`${exists ? '✅' : '❌'} Conversación ${conversationId} ${exists ? 'existe' : 'no existe'}`);
    return exists;
  } catch (error) {
    console.error(`❌ Error en verifyConversationExists: ${error.message}`);
    return false;
  }
}

// Modificar la función saveMessageToSupabase para manejar el caso donde getContactName no está disponible
async function saveMessageToSupabase({ sender, message, messageId, timestamp, conversationId, isBotActive }) {
  try {
    // Verificar parámetros mínimos necesarios
    if (!sender && !conversationId) {
      console.error('❌ saveMessageToSupabase: Se requiere sender o conversationId');
      return { success: false, error: 'Se requiere sender o conversationId' };
    }

    if (!message) {
      console.error('❌ saveMessageToSupabase: Se requiere un mensaje');
      return { success: false, error: 'Se requiere un mensaje' };
    }

    // Variables para resultado
    let actualConversationId = conversationId;
    let botActive = isBotActive !== undefined ? isBotActive : true; // Por defecto activo si no se especifica

    // Paso 1: Verificar si tenemos un ID de conversación mapeado para este número
    if (!actualConversationId && phoneToConversationMap[sender]) {
      actualConversationId = phoneToConversationMap[sender];
      console.log(`✅ ID de conversación encontrado en caché: ${actualConversationId}`);
      
      // Verificar que la conversación siga existiendo en la base de datos
      const conversationExists = await verifyConversationExists(actualConversationId);
      if (!conversationExists) {
        console.log(`⚠️ La conversación ${actualConversationId} encontrada en caché no existe en la base de datos`);
        actualConversationId = null; // Forzar creación de una nueva conversación
      }
    }

    // Paso 2: Si no tenemos ID, buscar o crear la conversación
    if (!actualConversationId) {
      try {
        console.log(`🔍 Buscando conversación para: ${sender}`);
        
        const { data: existingConv, error: convError } = await supabase
          .from('conversations')
          .select('*')
          .eq('user_id', sender)
          .eq('business_id', BUSINESS_ID)
          .single();
        
        if (convError && convError.code !== 'PGRST116') {
          console.error(`❌ Error buscando conversación: ${convError.message}`);
          return { success: false, error: convError.message };
        }
        
        if (existingConv) {
          // Usar conversación existente
          actualConversationId = existingConv.id;
          botActive = existingConv.is_bot_active === true;
          console.log(`ℹ️ Usando conversación existente con ID: ${actualConversationId} (bot activo: ${botActive ? 'SÍ' : 'NO'})`);
          
          // Actualizar mapeo
          phoneToConversationMap[sender] = actualConversationId;
          conversationIdToPhoneMap[actualConversationId] = sender;
        } else {
          // Crear nueva conversación
          console.log(`➕ Creando nueva conversación para: ${sender}`);
          
          // Usar un nombre seguro para el remitente
          let senderName = sender;
          try {
            // Intentar obtener el nombre del contacto si la función está disponible
            if (typeof getContactName === 'function') {
              senderName = getContactName(sender) || sender;
            }
          } catch (nameError) {
            console.log(`⚠️ No se pudo obtener nombre del contacto, usando número: ${sender}`);
          }
          
          const { data: newConv, error: createError } = await supabase
            .from('conversations')
            .insert([{
              user_id: sender,
              business_id: BUSINESS_ID,
              is_bot_active: true,
              sender_name: senderName,
              last_message: message.substring(0, 100),
              last_message_time: new Date().toISOString()
            }])
            .select();
          
          if (createError) {
            console.error(`❌ Error creando conversación: ${createError.message}`);
            return { success: false, error: createError.message };
          }
          
          if (newConv && newConv.length > 0) {
            actualConversationId = newConv[0].id;
            botActive = newConv[0].is_bot_active === true;
            console.log(`✅ Nueva conversación creada con ID: ${actualConversationId}`);
            
            // Actualizar mapeo
            phoneToConversationMap[sender] = actualConversationId;
            conversationIdToPhoneMap[actualConversationId] = sender;
          } else {
            console.error('❌ Error: No se pudo crear la conversación');
            return { success: false, error: 'No se pudo crear la conversación' };
          }
        }
      } catch (convError) {
        console.error(`❌ Error crítico con la conversación: ${convError.message}`);
        return { success: false, error: convError.message };
      }
    }

    // Paso 3: Guardar el mensaje
    let messageRecord;
    try {
      console.log(`⚠️ No se pudo obtener metadata de la tabla mediante RPC: Could not find the function public.get_table_metadata(table_name) in the schema cache`);
      
      // Format timestamp if provided
      let messageTime = new Date().toISOString();
      if (timestamp) {
        messageTime = safeISODate(timestamp);
        console.log(`📅 Timestamp formateado: ${messageTime}`);
      }
      
      // Guardar mensaje en la base de datos
      const { data: newMessage, error: msgError } = await supabase
        .from('messages')
        .insert([{
          conversation_id: actualConversationId,
          content: message,
          sender_type: 'user',
          created_at: messageTime
        }])
        .select();
      
      if (msgError) {
        console.error(`❌ Error guardando mensaje: ${msgError.message}`);
        return { success: false, error: msgError.message };
      }
      
      messageRecord = newMessage && newMessage.length > 0 ? newMessage[0] : null;
      console.log(`✅ Mensaje guardado en Supabase correctamente`);
    } catch (messageError) {
      console.error(`❌ Error guardando mensaje: ${messageError.message}`);
      return { success: false, error: messageError.message };
    }

    // Añadir validación adicional para asegurar que tenemos un ID de conversación antes de retornar
    if (!actualConversationId) {
      console.error('❌ Error: No se pudo obtener un ID de conversación válido después de todo el proceso');
      return { success: false, error: 'No se pudo obtener ID de conversación válido' };
    }

    // Devolver información completa
    return {
      success: true,
      conversationId: actualConversationId,
      messageId: messageRecord?.id,
      isBotActive: botActive,
      message: 'Mensaje guardado correctamente'
    };
  } catch (error) {
    console.error(`❌ Error general en saveMessageToSupabase: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Función para actualizar última actividad de conversación
async function updateConversationLastActivity(conversationId, lastMessage) {
    try {
        console.log('🔄 Actualizando última actividad de conversación:', conversationId);
        
        const { data, error } = await supabase
            .from('conversations')
            .update({
                last_message: lastMessage,
                last_message_time: new Date().toISOString()
            })
            .eq('id', conversationId)
            .select();
            
        if (error) {
            console.error('❌ Error al actualizar conversación:', error);
            throw error;
        }
        
        console.log('✅ Conversación actualizada:', data);
        return data;
    } catch (error) {
        console.error('❌ Error en updateConversationLastActivity:', error);
        throw error;
    }
}

/**
 * Registra una respuesta del bot (o agente) en Supabase y actualiza la actividad de la conversación
 * @param {string} conversationId - ID de la conversación (puede ser un número telefónico o un UUID)
 * @param {string} message - Contenido del mensaje
 * @param {string} business_id - ID del negocio
 * @param {string} sender_type - Tipo de remitente ('bot', 'user', 'agent')
 * @returns {Promise<object>} - Resultado de la operación
 */
async function registerBotResponse(conversationId, message, business_id = BUSINESS_ID, sender_type = 'bot', metadata = {}) {
    try {
        if (!conversationId || !message) {
      console.error('❌ Faltan parámetros para registrar respuesta');
      return { success: false, error: 'Faltan parámetros' };
    }
    
    // Logs detallados para depurar
    console.log('🔄 Llamada a global.registerBotResponse interceptada');
    console.log(`📤 Guardando mensaje de tipo '${sender_type}' para: ${conversationId}`);
    
    // Si se proporcionaron metadatos adicionales, mostrarlos en los logs
    if (metadata && Object.keys(metadata).length > 0) {
      console.log(`📝 Metadatos adicionales incluidos: ${JSON.stringify(metadata)}`);
    }
    
    console.log(`🚀 Procesando mensaje para: ${conversationId}`);
    console.log(`📝 Mensaje: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
    
    // Si hay metadatos, mostrarlos
    if (metadata && Object.keys(metadata).length > 0) {
      console.log(`📝 Metadatos: ${JSON.stringify(metadata)}`);
    }
    
    // 1. Buscar la conversación en la base de datos
    console.log(`🔍 Buscando conversación para: ${conversationId}`);
    let conversationRecord;
    
    // Este ID es a menudo un número telefónico, verificar formato
    const isPhoneNumber = /^\+?\d+$/.test(conversationId.toString().trim());
    
    try {
      // Primero buscar por ID exacto (UUID)
      const { data: convById } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();
      
      if (convById) {
        console.log(`✅ Conversación encontrada directamente por ID`);
        conversationRecord = convById;
      } 
      // Si no se encuentra por ID exacto y parece ser un número telefónico
      else if (isPhoneNumber) {
        // Normalizar para búsqueda (sin el + inicial)
        const normalizedPhone = conversationId.toString().replace(/^\+/, '');
        
        // Buscar por usuario (número de teléfono)
        const { data: convByPhone } = await supabase
          .from('conversations')
          .select('*')
          .eq('user_id', normalizedPhone)
          .eq('business_id', business_id)
          .single();
        
        if (convByPhone) {
          console.log(`✅ Conversación encontrada por teléfono: ${normalizedPhone}`);
          conversationRecord = convByPhone;
        }
      }
    } catch (err) {
      console.log(`⚠️ Error o no encontrada en búsqueda exacta: ${err.message}`);
    }
    
    // Si no se encuentra la conversación, crear un nuevo registro
    if (!conversationRecord) {
      // Determinar si el ID parece un UUID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId);
      
      if (isUUID) {
        console.log(`⚠️ No se encontró la conversación con ID: ${conversationId}`);
        return { success: false, error: 'Conversación no encontrada' };
      }
      
      // Si parece un número telefónico, crear la conversación
      if (isPhoneNumber) {
        const normalizedPhone = conversationId.toString().replace(/^\+/, '');
        console.log(`🆕 Creando nueva conversación para ${normalizedPhone}`);
        
        try {
          const { data: newConversation, error } = await supabase
            .from('conversations')
            .insert({
              user_id: normalizedPhone,
              business_id: business_id,
              last_message: message.substring(0, 100),
              is_bot_active: true // Por defecto activado
            })
            .select()
            .single();
            
          if (error) {
            console.error(`❌ Error al crear conversación: ${error.message}`);
        return { success: false, error: error.message };
          }
          
          console.log(`✅ Nueva conversación creada con ID: ${newConversation.id}`);
          conversationRecord = newConversation;
        } catch (err) {
          console.error(`❌ Error al crear la conversación: ${err.message}`);
          return { success: false, error: err.message };
        }
      }
    }
    
    // Si aún no tenemos conversación, salir con error
    if (!conversationRecord) {
      console.error('❌ No se pudo encontrar ni crear la conversación');
      return { success: false, error: 'No se pudo encontrar ni crear la conversación' };
    }
    
    console.log(`ℹ️ Usando conversación existente con ID: ${conversationRecord.id}`);
    
    // Verificar si el bot está activo, para mensajes de tipo 'bot'
    if (sender_type === 'bot' && conversationRecord.is_bot_active === false) {
      console.log(`🤖 Bot desactivado para conversación ${conversationRecord.id}, no se enviará respuesta automática`);
      return { 
        success: true, 
        id: null, 
        message: 'Bot desactivado, no se procesó respuesta automática',
        conversationId: conversationRecord.id
      };
    }
    
    // 2. Guardar el mensaje en Supabase
    console.log(`🔄 Guardando mensaje en Supabase...`);
    console.log(`📤 Tipo de mensaje: ${sender_type}`);
    
    let messageRecord;
    try {
      // Crear el objeto base para insertar el mensaje
      // Solo incluimos campos que sabemos que existen en la tabla
      const messageData = {
        conversation_id: conversationRecord.id,
        content: message,
        sender_type: sender_type
        // No incluimos otros campos de metadata que no son columnas en la tabla
      };
      
      // Intentar usando el cliente Supabase primero
      const { data, error } = await supabase
        .from('messages')
        .insert(messageData)
        .select()
        .single();
        
      if (error) {
        console.warn(`⚠️ Error guardando mensaje con cliente, usando API REST: ${error.message}`);
        throw error; // Para caer en el catch y usar la alternativa
      }
      
      messageRecord = data;
      console.log(`✅ Mensaje guardado en Supabase con ID: ${messageRecord.id}`);
    } catch (saveError) {
      // Alternativa: Usar API REST
      console.log(`🔄 Intentando alternativa: API REST`);
      
      try {
        // Intentar con API REST
        const payload = {
          conversationId: conversationRecord.id,
          message,
          sender_type
        };
        
        const response = await axios.post(CONTROL_PANEL_URL, payload);
        console.log(`✅ Mensaje guardado vía API REST: ${response.status}`);
        
        messageRecord = {
          id: response.data?.id || 'unknown',
          conversation_id: conversationRecord.id,
          content: message,
          sender_type: sender_type
        };
      } catch (restError) {
        console.error(`❌ Error también con API REST: ${restError.message}`);
        // No detenemos la ejecución, seguimos con el flujo aunque no se haya podido guardar
      }
    }
    
    // 3. Actualizar timestamp de última actividad
    try {
      const { error: updateError } = await supabase
        .from('conversations')
        .update({
          last_message: message.substring(0, 100),
          last_message_time: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationRecord.id);
      
      if (updateError) {
        console.warn(`⚠️ Error actualizando timestamp: ${updateError.message}`);
      } else {
        console.log(`✅ Timestamp de conversación actualizado`);
      }
    } catch (timeError) {
      console.warn(`⚠️ Error en actualización de timestamp: ${timeError.message}`);
    }
    
    // 4. Si es un mensaje de bot, verificar si contiene frases que requieren notificación
    if (sender_type === 'bot' && notificationModule) {
      try {
        console.log(`🔔 Verificando si el mensaje del bot requiere notificación...`);
        const phoneNumber = conversationRecord.user_id || conversationIdToPhoneMap[conversationRecord.id];
        
        const notificationResult = await notificationModule.processMessageForNotification(
          message,
          conversationRecord.id,
          phoneNumber
        );
        
        if (notificationResult.requiresNotification) {
          console.log(`✅ Se requiere notificación - Enviada: ${notificationResult.notificationSent}`);
    } else {
          console.log(`ℹ️ No se requiere enviar notificación para este mensaje`);
        }
      } catch (notifError) {
        console.error(`❌ Error procesando notificación: ${notifError.message}`);
      }
    }
    
    return {
      success: true,
      id: messageRecord?.id || 'unknown',
      message: 'Mensaje guardado correctamente',
      conversationId: conversationRecord.id
    };
  } catch (error) {
    console.error(`❌ Error general en registerBotResponse: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Función para enviar mensajes de WhatsApp usando GupShup
async function sendWhatsAppResponse(recipient, message) {
    try {
        if (!recipient || !message) {
            console.error('❌ Faltan parámetros para enviar mensaje');
            return false;
        }
        
        if (!GUPSHUP_API_KEY || !GUPSHUP_NUMBER || !GUPSHUP_USERID) {
            console.error('❌ Error: Faltan credenciales GupShup (API_KEY, NUMBER o USERID). No se puede enviar el mensaje.');
            return false;
        }
        
        // Corregir números de teléfono que empiezan con 52 o +52 (México) y no tienen el formato correcto
        let formattedNumber = recipient.toString();
        if (!formattedNumber.startsWith('52') && !formattedNumber.startsWith('+52')) {
            // Validar que es número de México (10 dígitos que empiezan con 5)
            if (/^[1-9]\d{9}$/.test(formattedNumber) || 
                formattedNumber.length === 10 && formattedNumber.startsWith('5')) {
                formattedNumber = '52' + formattedNumber;
                console.log(`📱 Número corregido a formato México: ${formattedNumber}`);
            }
        } else if (formattedNumber.startsWith('+')) {
            // Quitar el + para compatibilidad con GupShup
            formattedNumber = formattedNumber.substring(1);
            console.log(`📱 Formato corregido sin +: ${formattedNumber}`);
        }
        
        // Asegurar valores obligatorios para GupShup
        const apiKey = GUPSHUP_API_KEY;
        const apiUrl = 'https://api.gupshup.io/wa/api/v1/msg';
        const source = GUPSHUP_NUMBER;
        
        console.log('📤 Enviando mensaje a GupShup:');
        console.log(`📞 Destino: ${formattedNumber}`);
        console.log(`💬 Mensaje: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);
        
        // Formato del cuerpo de la solicitud (similar a FormData pero como URLSearchParams)
        const formData = new URLSearchParams();
        formData.append('channel', 'whatsapp');
        formData.append('source', source);
        formData.append('destination', formattedNumber);
        formData.append('src.name', source);
        formData.append('message', JSON.stringify({
            type: 'text',
            text: message
        }));
        
        // Formato simple de headers, como funcionaba antes
        const headers = {
            'Cache-Control': 'no-cache',
            'Content-Type': 'application/x-www-form-urlencoded',
            'apikey': apiKey,
            'userid': GUPSHUP_USERID  // Añadimos el userid para mejorar la autenticación
        };
        
        console.log('🔄 Enviando mensaje a WhatsApp...');
        
        try {
            const response = await axios.post(apiUrl, formData, { headers });
            
            console.log('📡 Respuesta de GupShup:', JSON.stringify(response.data));
            
            if (response.status >= 200 && response.status < 300) {
                console.log('✅ Mensaje enviado exitosamente a WhatsApp');
                
                // Obtener el ID de la conversación correspondiente al número de teléfono
                let conversationId = phoneToConversationMap[recipient];
                
                // Guardar mensaje en la base de datos
                try {
                    const saveResult = await global.registerBotResponse(
                        recipient,
                        message,
                        BUSINESS_ID, 
                        'bot'
                    );
                    
                    if (saveResult && saveResult.success) {
                        console.log('✅ Mensaje del bot guardado en Supabase');
                        conversationId = saveResult.conversationId || conversationId;
                    } else {
                        console.warn(`⚠️ No se pudo guardar el mensaje en Supabase: ${saveResult?.error || 'Error desconocido'}`);
                    }
                } catch (dbError) {
                    console.log(`⚠️ Error guardando mensaje en Supabase: ${dbError.message}`);
                }
                
                // Verificar si el mensaje del bot requiere enviar notificación
                if (notificationModule && conversationId) {
                    console.log(`🔍 Verificando si el mensaje requiere notificación...`);
                    try {
                        const notificationResult = await notificationModule.processMessageForNotification(
                            message,
                            conversationId,
                            recipient
                        );
                        
                        if (notificationResult.requiresNotification) {
                            console.log(`✅ Se ha enviado una notificación por correo: ${notificationResult.notificationSent}`);
                        } else {
                            console.log(`ℹ️ El mensaje no requiere envío de notificación`);
                        }
                    } catch (notificationError) {
                        console.error(`❌ Error al procesar notificación: ${notificationError.message}`);
                    }
                }
                
                return true;
            } else {
                console.error(`❌ Error: Código de respuesta ${response.status}`);
                return false;
            }
        } catch (apiError) {
            console.error('❌ Error en la llamada a la API de GupShup:', apiError.message);
            
            if (apiError.response) {
                console.error('🔍 Detalles del error:', 
                    apiError.response.status, 
                    JSON.stringify(apiError.response.data));
                
                // Intentar con una estructura ligeramente diferente si recibimos un error
                if (apiError.response.status === 401 && 
                    apiError.response.data === "Portal User Not Found With APIKey") {
                    
                    console.log('⚠️ Error "Portal User Not Found With APIKey" - Este error ocurre en local pero puede funcionar en producción');
                    console.log('📝 Este mensaje probablemente SÍ será enviado cuando se ejecute en el servidor de producción');
                }
            } else if (apiError.request) {
                console.error('🔍 No se recibió respuesta del servidor');
            } else {
                console.error('🔍 Error en la configuración de la solicitud:', apiError.message);
            }
            
            return false;
        }
    } catch (error) {
        console.error('❌ Error enviando mensaje:', error.message);
        
        if (error.response) {
            console.error('🔍 Detalles del error:', 
                error.response.status, 
                JSON.stringify(error.response.data));
        } else if (error.request) {
            console.error('🔍 No se recibió respuesta del servidor');
        } else {
            console.error('🔍 Error en la configuración de la solicitud:', error.message);
        }
        
        return false;
    }
}

// Función para extraer datos del mensaje de la solicitud de webhook
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
      timestamp: null
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
          
          // Extraer contenido según el tipo de mensaje
          if (messageData.text && messageData.text.body) {
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
          if (!result.message && messageData) {
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
    if (!result.isStatusUpdate && (!result.sender || !result.message)) {
      console.log(`⚠️ No se pudieron extraer datos completos del mensaje: sender=${result.sender}, message=${result.message}`);
      logDebug(`⚠️ No se pudieron extraer datos completos del mensaje: sender=${result.sender}, message=${result.message}`);
    } else {
      console.log(`✅ Datos extraídos correctamente: ${result.isStatusUpdate ? 'actualización de estado' : `mensaje de ${result.sender}: "${result.message}"`}`);
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
}

// Exportar funciones para testing
module.exports = {
  app,
  extractMessageData,
  processMessageWithOpenAI,
  sendWhatsAppResponse
};

// Iniciar el servidor en el puerto especificado
app.listen(PORT, async () => {
  console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
  console.log(`🤖 Bot conectado al panel: ${CONTROL_PANEL_URL}`);
  
  // Verificar credenciales de GupShup
  console.log('🔍 Verificando credenciales de integración...');
  if (!GUPSHUP_API_KEY || !GUPSHUP_NUMBER || !GUPSHUP_USERID) {
    console.warn('⚠️ ADVERTENCIA: Falta alguna credencial de GupShup:');
    console.warn(`  - API Key: ${GUPSHUP_API_KEY ? '✅ Configurada' : '❌ Falta'}`);
    console.warn(`  - Número: ${GUPSHUP_NUMBER ? '✅ Configurado' : '❌ Falta'}`);
    console.warn(`  - User ID: ${GUPSHUP_USERID ? '✅ Configurado' : '❌ Falta'}`);
    console.warn('⚠️ La integración con WhatsApp no funcionará sin estas credenciales.');
  } else {
    console.log('✅ Credenciales de GupShup presentes:');
    console.log(`  - API Key: ${GUPSHUP_API_KEY.substring(0, 8)}...`);
    console.log(`  - Número de origen: ${GUPSHUP_NUMBER}`);
    console.log(`  - User ID: ${GUPSHUP_USERID.substring(0, 8)}...`);
  }
  
  // Verificar credenciales de OpenAI
  if (!OPENAI_API_KEY) {
    console.warn('⚠️ ADVERTENCIA: Falta la clave API de OpenAI. El bot no podrá responder.');
  } else {
    console.log(`✅ Clave API de OpenAI configurada: ${OPENAI_API_KEY.substring(0, 8)}...`);
    if (OPENAI_API_KEY.startsWith('sk-proj-') && process.env.NODE_ENV === 'production') {
      console.warn('⚠️ ADVERTENCIA: Parece que estás usando una clave de API de prueba en producción.');
    }
  }
  
  // Verificar conexión con Supabase
  try {
    console.log('🔄 Verificando conexión con Supabase...');
    const { data, error } = await supabase.from('conversations').select('id').limit(1);
    
    if (error) {
      console.error('❌ Error de conexión a Supabase:', error.message);
      console.warn('⚠️ Asegúrate de que las credenciales de Supabase son correctas');
    } else {
      console.log('✅ Conexión a Supabase verificada correctamente');
  
  // Cargar mapeos iniciales
  console.log('🔄 Inicializando mapeos y estados...');
    await updateConversationMappings();
    }
  } catch (error) {
    console.error('❌ Error crítico al verificar conexión con Supabase:', error.message);
  }
  
  // Verificar módulo de notificaciones
  if (notificationModule) {
    console.log('📧 Verificando módulo de notificaciones...');
    
    if (typeof notificationModule.processMessageForNotification === 'function') {
      console.log('✅ Módulo de notificaciones cargado correctamente');
      
      // Verificar las frases de notificación
      if (notificationModule.checkForNotificationPhrases) {
        console.log('📝 Frases que generan notificaciones:');
        const testPhrases = [
          "¡Perfecto! tu cita ha sido confirmada para mañana",
          "Te llamará un asesor",
          "Una persona te contactará"
        ];
        
        for (const phrase of testPhrases) {
          const requiresNotification = notificationModule.checkForNotificationPhrases(phrase);
          console.log(`  - "${phrase}": ${requiresNotification ? '✅ Notifica' : '❌ No notifica'}`);
        }
      } else {
        console.warn('⚠️ El módulo no expone la función checkForNotificationPhrases');
      }
    } else {
      console.warn('⚠️ El módulo de notificaciones no expone la función processMessageForNotification');
    }
  } else {
    console.warn('⚠️ Módulo de notificaciones no disponible');
  }
  
  console.log('🤖 Bot WhatsApp listo y funcionando');
});

// Webhook para recibir mensajes de WhatsApp
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
        
        const { sender, message, messageId, timestamp } = messageData;
        
        if (!sender || !message) {
            console.log(`⚠️ Mensaje incompleto recibido, ignorando: ${JSON.stringify(messageData)}`);
            return res.sendStatus(200);
        }
        
        console.log(`👤 Mensaje recibido de ${sender}: ${message}`);
        
        // Verificar si este mensaje ya fue procesado recientemente (evita duplicados)
        const messageKey = `${messageId || sender}_${message}`;
        if (recentlyProcessedMessages.has(messageKey)) {
            console.log(`⚠️ Mensaje duplicado detectado, ignorando: ${messageKey}`);
            return res.sendStatus(200);
        }
        
        // Marcar este mensaje como procesado
        recentlyProcessedMessages.add(messageKey);
        setTimeout(() => recentlyProcessedMessages.delete(messageKey), 120000); // Eliminar después de 2 minutos para mayor seguridad
        
        // Responder inmediatamente al webhook para evitar timeouts de WhatsApp
        res.sendStatus(200);
        
        // Guardar mensaje en Supabase
        console.log(`💾 Guardando mensaje entrante para ${sender}`);
        let conversationId = null;
        let botActive = true;
        
        try {
            // Obtener o crear conversación
            const saveResult = await saveMessageToSupabase({
                sender,
                message,
                messageId,
                timestamp
            });
            
            // Registrar el resultado completo para diagnóstico
            console.log(`📋 Resultado de guardar mensaje:`, JSON.stringify(saveResult, null, 2));
            
            if (!saveResult || !saveResult.success) {
                console.error('❌ Error al guardar mensaje:', saveResult?.error || 'Error desconocido');
                // Si no pudimos guardar el mensaje, no continuamos
                return;
            }
            
            conversationId = saveResult.conversationId;
            botActive = saveResult.isBotActive === true;
            
            console.log(`✅ Mensaje guardado en conversación ${conversationId} (Bot activo: ${botActive ? 'SÍ' : 'NO'})`);
            
            // Solo actualizar la última actividad si tenemos un ID válido
            if (conversationId) {
                // Actualizar última actividad de la conversación
                await updateConversationLastActivity(conversationId, message);
            }
        } catch (dbError) {
            console.error(`❌ Error guardando mensaje: ${dbError.message}`);
            // Por seguridad, desactivamos el bot si hay errores
            botActive = false;
        }
        
        // Verificar si hay alguna promesa esperando respuesta para esta conversación
        // Solo verificar si tenemos un ID de conversación válido
        if (conversationId && resolveWaitingPromise(conversationId, {
            sender,
            message,
            messageId,
            conversationId,
            timestamp
        })) {
            console.log(`🔄 Mensaje procesado como respuesta a una espera previa`);
            return;
        }
        
        // Solo si el bot está activo y tenemos ID válido
        if (botActive && conversationId) {
            // IMPORTANTE: SIEMPRE intentar agrupar mensajes, independientemente de su contenido
            console.log(`🔍 Intentando agrupar mensaje en conversación ${conversationId}`);
            
            // Verificar si hay mensajes recientes para determinar si podría ser una ráfaga
            const now = Date.now();
            const messageTimestamp = timestamp ? new Date(timestamp).getTime() : now;
            
            // Agregar el mensaje al grupo de mensajes pendientes
            const shouldWait = addToPendingMessageGroup(conversationId, {
                sender,
                message,
                messageId,
                conversationId,
                timestamp: messageTimestamp,
                receivedAt: now // Añadir tiempo exacto de recepción para análisis
            });
            
            // Si debe esperar, detenemos aquí. El grupo será procesado por el timeout
            if (shouldWait) {
                const group = pendingMessageGroups.get(conversationId);
                const messageCount = group ? group.messages.length : 0;
                console.log(`⏳ Mensaje en espera para agrupación (${conversationId}) - Total acumulado: ${messageCount}`);
                return;
            }
            
            // Si por alguna razón no debe esperar, procesar normalmente (caso raro)
            console.log(`⚙️ Procesando mensaje de ${sender} con OpenAI: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
            
            try {
                // Procesar con OpenAI y obtener respuesta
                const botResponse = await processMessageWithOpenAI(sender, message, conversationId, BUSINESS_ID);
                
                if (botResponse) {
                    console.log(`✅ Respuesta generada por OpenAI: "${botResponse.substring(0, 50)}${botResponse.length > 50 ? '...' : ''}"`);
                    
                    // Asegurar que el mensaje se envía correctamente
                    let sendAttempts = 0;
                    let sendSuccess = false;
                    
                    while (!sendSuccess && sendAttempts < 3) {
                        sendAttempts++;
                        console.log(`📤 Intento #${sendAttempts} de envío de respuesta a WhatsApp`);
                        sendSuccess = await sendWhatsAppResponse(sender, botResponse);
                        
                        if (sendSuccess) {
                            console.log(`✅ Respuesta enviada exitosamente a WhatsApp para ${sender} en intento #${sendAttempts}`);
                        } else if (sendAttempts < 3) {
                            console.log(`⚠️ Reintentando envío en 1 segundo...`);
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    }
                    
                    if (!sendSuccess) {
                        console.error(`❌ No se pudo enviar la respuesta después de ${sendAttempts} intentos`);
                    }
                } else {
                    console.log(`⚠️ OpenAI no generó respuesta para el mensaje de ${sender}`);
                }
            } catch (aiError) {
                console.error(`❌ Error procesando con OpenAI: ${aiError.message}`);
            }
        } else {
            console.log(`🛑 Bot ${!botActive ? 'INACTIVO' : 'sin ID de conversación válido'}: NO se procesa mensaje de ${sender} con OpenAI ni se envía respuesta automática`);
        }
    } catch (error) {
        console.error('❌ Error en webhook:', error);
        // Ya enviamos la respuesta 200 antes, no necesitamos responder aquí
    }
});

// Endpoint para enviar un mensaje a WhatsApp
app.post('/api/messages', async (req, res) => {
  console.log('📩 Mensaje manual recibido del dashboard:', JSON.stringify(req.body));
  
  try {
    const { conversationId, message, senderType = 'agent', businessId } = req.body;
    
    // Validar parámetros requeridos
    if (!conversationId) {
      return res.json({ error: 'Se requiere conversationId' });
    }
    
    if (!message) {
      return res.json({ error: 'Se requiere message (contenido del mensaje)' });
    }
    
    if (!businessId) {
      return res.json({ error: 'Se requiere businessId' });
    }
    
    // Normalizar el ID de conversación para manejar números de teléfono
    const normalizedId = /^\d+$/.test(conversationId.trim()) 
      ? conversationId.trim().replace(/^\+/, '') // Quitar el + si existe
      : conversationId;
    
    console.log(`📤 Enviando mensaje a conversación ${normalizedId}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);
    
    // IMPORTANTE: Primero desactivar el bot ANTES de enviar el mensaje
    // para evitar que responda automáticamente - GARANTIZAR QUE ESTO FUNCIONE
    console.log('🔄 PASO 1: Desactivando el bot antes de enviar mensaje desde panel...');
    let botWasDeactivated = false;
    
    try {
      // IMPORTANTE: Intentar MÚLTIPLES estrategias para desactivar el bot
      // Estrategia 1: Actualizar directamente en la base de datos
      const { data: botData, error: botError } = await supabase
        .from('conversations')
        .update({ is_bot_active: false })
        .eq('id', normalizedId)
        .select();
      
      if (botError) {
        console.warn('⚠️ Estrategia 1 falló: No se pudo desactivar bot por ID directo:', botError.message);
        
        // Estrategia 2: Buscar por user_id si el ID parece ser un número de teléfono
        if (/^\d+$/.test(normalizedId)) {
          console.log('🔄 Intentando Estrategia 2: Desactivar por user_id (número telefónico)');
          const { data: phoneUpdate, error: phoneError } = await supabase
            .from('conversations')
            .update({ is_bot_active: false })
            .eq('user_id', normalizedId)
            .eq('business_id', businessId)
            .select();
          
          if (phoneError) {
            console.warn('⚠️ Estrategia 2 falló:', phoneError.message);
          } else if (phoneUpdate && phoneUpdate.length > 0) {
            console.log('✅ Bot desactivado exitosamente con Estrategia 2 (actualización por user_id)');
            botWasDeactivated = true;
          }
        }
      } else if (botData && botData.length > 0) {
        console.log('✅ Bot desactivado exitosamente con Estrategia 1 (actualización directa por ID)');
        botWasDeactivated = true;
      }
      
      // Estrategia 3: Usar SQL directo si las anteriores fallan
      if (!botWasDeactivated) {
        console.log('🔄 Intentando Estrategia 3: Desactivar con SQL directo');
        // Crear consulta SQL que maneje ambos casos (por ID o por user_id)
        let sqlQuery = '';
        let params = {};
        
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalizedId)) {
          // Es un UUID
          sqlQuery = 'UPDATE conversations SET is_bot_active = false WHERE id = $1 RETURNING *';
          params = [normalizedId];
      } else {
          // Es un número telefónico
          sqlQuery = 'UPDATE conversations SET is_bot_active = false WHERE user_id = $1 AND business_id = $2 RETURNING *';
          params = [normalizedId, businessId];
        }
        
        const { data: sqlUpdate, error: sqlError } = await supabase.rpc('execute_sql', { 
          query_text: sqlQuery, 
          params_array: params 
        });
        
        if (sqlError) {
          console.warn('⚠️ Estrategia 3 falló:', sqlError.message);
        } else if (sqlUpdate && sqlUpdate.length > 0) {
          console.log('✅ Bot desactivado exitosamente con Estrategia 3 (SQL directo)');
          botWasDeactivated = true;
        }
      }
    } catch (botToggleError) {
      console.error('❌ Error al intentar desactivar el bot:', botToggleError.message);
      // No interrumpir el flujo si falla la desactivación
    }
    
    // PASO 2: Enviar el mensaje (asegurándonos que sender_type es 'bot' para cumplir con restricciones de DB)
    console.log('🔄 PASO 2: Enviando mensaje...');
    const validSenderType = senderType === 'agent' ? 'bot' : senderType;
    
    let messageResult;
    try {
      // Usar registerBotResponse que ya tiene toda la lógica para manejo de mensajes
      messageResult = await global.registerBotResponse(
        normalizedId,
        message,
        businessId,
        validSenderType
      );
      
      if (!messageResult || !messageResult.success) {
        throw new Error(messageResult?.error || 'Error desconocido al registrar mensaje');
      }
      
      console.log('✅ Mensaje registrado exitosamente:', messageResult.id);
    } catch (registerError) {
      console.error('❌ Error al registrar mensaje:', registerError.message);
      return res.json({ 
        error: 'Error al registrar mensaje', 
        details: registerError.message 
      });
    }
    
    // PASO 3: VERIFICAR nuevamente que el bot sigue desactivado
    console.log('🔄 PASO 3: Verificando que el bot permanece desactivado...');
    try {
      const { data: verifyData, error: verifyError } = await supabase
        .from('conversations')
        .select('id, is_bot_active')
        .or(`id.eq.${normalizedId},user_id.eq.${normalizedId}`)
        .eq('business_id', businessId)
        .single();
      
      if (verifyError) {
        console.warn('⚠️ No se pudo verificar estado del bot:', verifyError.message);
      } else if (verifyData && verifyData.is_bot_active === true) {
        console.warn('⚠️ Bot sigue activo después del mensaje, intentando desactivar nuevamente...');
        
        // Forzar desactivación una vez más
        const { error: updateError } = await supabase
          .from('conversations')
          .update({ is_bot_active: false })
          .eq('id', verifyData.id);
        
        if (updateError) {
          console.error('❌ No se pudo desactivar el bot después de verificación:', updateError.message);
        } else {
          console.log('✅ Bot desactivado nuevamente con éxito');
        }
      } else {
        console.log('✅ Verificado: El bot está correctamente desactivado');
      }
    } catch (verifyError) {
      console.warn('⚠️ Error al verificar estado final del bot:', verifyError.message);
    }
    
    // PASO 4: Enviar mensaje a WhatsApp si es necesario
    let whatsappSuccess = false;
    let whatsappError = null;
    
    try {
      console.log('📲 PASO 4: Enviando mensaje a WhatsApp...');
      
      // Obtener número telefónico si es un conversationId
      let phoneNumber = normalizedId;
      
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalizedId)) {
        // Es un UUID, buscar el número de teléfono asociado
        console.log(`🔍 Buscando número de teléfono para conversación ${normalizedId}`);
        
        // Verificar primero en caché
        if (conversationIdToPhoneMap[normalizedId]) {
          phoneNumber = conversationIdToPhoneMap[normalizedId];
          console.log(`✅ Número encontrado en caché para conversación: ${phoneNumber}`);
        } else {
          // Buscar en base de datos
          try {
            const { data, error } = await supabase
              .from('conversations')
              .select('user_id')
              .eq('id', normalizedId)
              .single();
            
            if (error) {
              console.error(`❌ Error buscando número para conversación: ${error.message}`);
              throw new Error(`No se pudo obtener el número de teléfono: ${error.message}`);
            }
            
            if (data && data.user_id) {
              phoneNumber = data.user_id;
              console.log(`✅ Número encontrado en DB para conversación: ${phoneNumber}`);
              
              // Actualizar caché
              conversationIdToPhoneMap[normalizedId] = phoneNumber;
              phoneToConversationMap[phoneNumber] = normalizedId;
            } else {
              console.error(`❌ No se encontró un número de teléfono para la conversación ${normalizedId}`);
              throw new Error('No se encontró un número de teléfono asociado a esta conversación');
            }
          } catch (dbError) {
            console.error(`❌ Error al buscar número en DB: ${dbError.message}`);
            throw dbError;
          }
        }
      }
      
      // Verificar que tenemos un número válido
      if (!phoneNumber || !/^\d+$/.test(phoneNumber.toString().replace(/^\+/, ''))) {
        console.error(`❌ Número de teléfono inválido: ${phoneNumber}`);
        throw new Error(`Formato de número inválido: ${phoneNumber}`);
      }
      
      // Asegurar formato correcto del número
      const formattedNumber = phoneNumber.toString().replace(/^\+/, '');
      console.log(`📱 Número final para envío: ${formattedNumber}`);
      
      // Enviar mensaje a WhatsApp directamente
      const apiUrl = 'https://api.gupshup.io/wa/api/v1/msg';
      
      const formData = new URLSearchParams();
      formData.append('channel', 'whatsapp');
      formData.append('source', GUPSHUP_NUMBER);
      formData.append('destination', formattedNumber);
      formData.append('src.name', GUPSHUP_NUMBER);
      formData.append('message', JSON.stringify({
          type: 'text',
          text: message
      }));
      
      const headers = {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/x-www-form-urlencoded',
        'apikey': GUPSHUP_API_KEY,
        'userid': GUPSHUP_USERID  // Añadimos el userid para mejorar la autenticación
      };
      
      console.log('🔄 Enviando mensaje directamente a la API de GupShup...');
      console.log(`📊 Parámetros de envío: destination=${formattedNumber}, text="${message.substring(0, 30)}${message.length > 30 ? '...' : ''}"`);
      
      try {
        const response = await axios.post(apiUrl, formData, { headers });
        
        if (response.status >= 200 && response.status < 300) {
          console.log('✅ Mensaje enviado exitosamente a WhatsApp');
          console.log('📊 Respuesta de GupShup:', JSON.stringify(response.data));
          whatsappSuccess = true;
        } else {
          console.error(`❌ Error en la respuesta de GupShup: ${response.status}`);
          whatsappError = `Error HTTP: ${response.status}`;
        }
      } catch (apiError) {
        console.error('❌ Error en la llamada a la API de GupShup:', apiError.message);
        
        if (apiError.response) {
          console.error('📊 Detalles del error:', apiError.response.status, JSON.stringify(apiError.response.data || {}));
          whatsappError = `Error HTTP ${apiError.response.status}: ${JSON.stringify(apiError.response.data || {})}`;
        } else if (apiError.request) {
          console.error('📊 No se recibió respuesta:', apiError.request);
          whatsappError = 'No se recibió respuesta del servidor de GupShup';
        } else {
          console.error('📊 Error en la configuración:', apiError.message);
          whatsappError = apiError.message;
        }
      }
  } catch (error) {
      console.error('❌ Error general al enviar mensaje a WhatsApp:', error.message);
      whatsappError = error.message;
      // No fallamos la petición principal por un error en el envío a WhatsApp
    }
    
    return res.status(200).json({
      success: true,
      id: messageResult.id,
      message: 'Mensaje enviado y bot desactivado correctamente',
      bot_status: 'deactivated',
      sent_to_whatsapp: whatsappSuccess,
      whatsapp_error: whatsappError
    });
  } catch (error) {
    console.error('❌ Error general al procesar mensaje:', error);
    return res.json({ error: error.message });
  }
});

// Endpoint para verificar que el servidor está activo y configurado
app.get('/api/status', (req, res) => {
  res.status(200).json({
    status: 'online',
    version: '1.0',
    gupshupConfigured: !!GUPSHUP_API_KEY && !!GUPSHUP_NUMBER,
    openaiConfigured: !!OPENAI_API_KEY && !!ASSISTANT_ID
  });
});

// Endpoint para verificar que el servidor está funcionando
app.get('/', (req, res) => {
    res.status(200).json({
        status: "ok", 
        message: "WhatsApp API server is running",
        config: {
            control_panel: CONTROL_PANEL_URL
        }
    });
});

// Endpoint para enviar manualmente mensajes (usado por el dashboard)
app.post('/api/send-manual-message', async (req, res) => {
  try {
    console.log('📩 Mensaje manual recibido del dashboard (send-manual-message):', JSON.stringify(req.body));
    console.log('🔑 Credenciales disponibles:',
      `GUPSHUP_NUMBER=${GUPSHUP_NUMBER ? 'CONFIGURADO' : 'NO CONFIGURADO'}`,
      `GUPSHUP_API_KEY=${GUPSHUP_API_KEY ? 'CONFIGURADO' : 'NO CONFIGURADO'}`,
      `GUPSHUP_USERID=${GUPSHUP_USERID ? 'CONFIGURADO' : 'NO CONFIGURADO'}`);
    
    const { phoneNumber, message, conversationId, businessId = BUSINESS_ID } = req.body;
    
    if (!message) {
      return res.json({ error: 'Se requiere el contenido del mensaje' });
    }
    
    if (!phoneNumber && !conversationId) {
      return res.json({ error: 'Se requiere phoneNumber o conversationId' });
    }
    
    // Determinar el ID a usar
    let targetId;
    let targetPhone;
    
    if (phoneNumber) {
      // Usar el número de teléfono directamente
      targetPhone = phoneNumber.toString().replace(/^\+/, '');
      targetId = targetPhone;
      
      // Intentar obtener el conversationId si está disponible
      if (phoneToConversationMap[targetPhone]) {
        console.log(`🔄 Encontrado conversationId en caché para ${targetPhone}: ${phoneToConversationMap[targetPhone]}`);
      }
    } else {
      // Usar el conversationId y buscar el número de teléfono
      targetId = conversationId;
      
      // Buscar el número de teléfono si tenemos un UUID
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId)) {
        if (conversationIdToPhoneMap[conversationId]) {
          targetPhone = conversationIdToPhoneMap[conversationId];
          console.log(`🔄 Encontrado número de teléfono en caché para ${conversationId}: ${targetPhone}`);
        } else {
          // Buscar en base de datos
          try {
            const { data, error } = await supabase
              .from('conversations')
              .select('user_id')
              .eq('id', conversationId)
              .single();
            
            if (error) {
              console.error(`❌ Error buscando número para conversación: ${error.message}`);
            } else if (data && data.user_id) {
              targetPhone = data.user_id;
              console.log(`🔄 Encontrado número de teléfono en DB para ${conversationId}: ${targetPhone}`);
              
              // Actualizar caché
              conversationIdToPhoneMap[conversationId] = targetPhone;
              phoneToConversationMap[targetPhone] = conversationId;
            }
          } catch (dbError) {
            console.error(`❌ Error consultando DB: ${dbError.message}`);
          }
        }
      } else {
        // El conversationId parece ser un número de teléfono
        targetPhone = conversationId.toString().replace(/^\+/, '');
      }
    }
    
    console.log(`📱 Enviando mensaje a: ${targetPhone || 'No disponible'}`);
    console.log(`🆔 ID de conversación: ${targetId}`);
    console.log(`💬 Mensaje: ${message}`);
    
    let whatsappSuccess = false;
    let whatsappError = null;
    
    // Enviar mensaje a WhatsApp
    if (targetPhone) {
      try {
        // Verificar que todas las credenciales están disponibles
        if (!GUPSHUP_API_KEY || !GUPSHUP_NUMBER || !GUPSHUP_USERID) {
          const missingCreds = [];
          if (!GUPSHUP_API_KEY) missingCreds.push('GUPSHUP_API_KEY');
          if (!GUPSHUP_NUMBER) missingCreds.push('GUPSHUP_NUMBER');
          if (!GUPSHUP_USERID) missingCreds.push('GUPSHUP_USERID');
          
          console.error(`⚠️ ADVERTENCIA: Faltan credenciales para GupShup: ${missingCreds.join(', ')}`);
          whatsappError = `Faltan credenciales para GupShup: ${missingCreds.join(', ')}`;
          
          // Simular éxito para debug
          console.log('⚠️ Simulando mensaje exitoso debido a falta de credenciales');
          whatsappSuccess = true;
          
        } else {
          // Enviar mensaje a WhatsApp directamente
          const apiUrl = 'https://api.gupshup.io/wa/api/v1/msg';
          const formattedNumber = targetPhone.toString().replace(/^\+/, '');
          
          const formData = new URLSearchParams();
          formData.append('channel', 'whatsapp');
          formData.append('source', GUPSHUP_NUMBER);
          formData.append('destination', formattedNumber);
          formData.append('src.name', GUPSHUP_NUMBER);
          formData.append('message', JSON.stringify({
              type: 'text',
              text: message
          }));
          
          const headers = {
            'Cache-Control': 'no-cache',
            'Content-Type': 'application/x-www-form-urlencoded',
            'apikey': GUPSHUP_API_KEY,
            'userid': GUPSHUP_USERID
          };
          
          console.log('🔄 Enviando mensaje directamente a la API de GupShup...');
          console.log('📊 URL:', apiUrl);
          console.log('📊 Headers:', JSON.stringify(headers, (key, value) => 
            key === 'apikey' ? `${value.substring(0, 5)}...` : value));
          console.log('📊 FormData:', formData.toString());
          
          const response = await axios.post(apiUrl, formData, { headers });
          
          if (response.status >= 200 && response.status < 300) {
            console.log('✅ Mensaje enviado exitosamente a WhatsApp');
            console.log('📊 Respuesta de GupShup:', JSON.stringify(response.data));
            whatsappSuccess = true;
          } else {
            console.error(`❌ Error en la respuesta de GupShup: ${response.status}`);
            whatsappError = `Error HTTP: ${response.status}`;
          }
        }
      } catch (apiError) {
        console.error('❌ Error en la llamada a la API de GupShup:', apiError.message);
        
        if (apiError.response) {
          console.error('📊 Detalles del error:', apiError.response.status, JSON.stringify(apiError.response.data || {}));
          whatsappError = `Error HTTP ${apiError.response.status}: ${JSON.stringify(apiError.response.data || {})}`;
        } else if (apiError.request) {
          console.error('📊 No se recibió respuesta:', apiError.request);
          whatsappError = 'No se recibió respuesta del servidor de GupShup';
        } else {
          console.error('📊 Error en la configuración:', apiError.message);
          whatsappError = apiError.message;
        }
        
        // Para fines de desarrollo/prueba, simular éxito
        if (process.env.NODE_ENV === 'development') {
          console.log('⚠️ Simulando mensaje exitoso en modo desarrollo a pesar del error');
          whatsappSuccess = true;
        }
      }
    } else {
      whatsappError = "No se pudo determinar el número de teléfono para enviar el mensaje";
      console.error(`❌ ${whatsappError}`);
    }
    
    // Guardar el mensaje en la base de datos si se proporciona un ID de conversación
    let messageId = null;
    let dbSuccess = false;
    let dbError = null;
    
    if (targetId) {
      try {
        // Añadir metadatos para indicar que este mensaje fue enviado desde el dashboard
        const metadata = {
          sender_type: 'agent'
          // Removido: source: 'dashboard'
          // Removido: from_api_send_manual: true
        };
        
        // Usar registerBotResponse para guardar el mensaje con metadatos
        const result = await global.registerBotResponse(
          targetId,
          message,
          businessId,
          'agent', // Cambiar de 'bot' a 'agent' para indicar que es un mensaje del dashboard
          metadata  // Añadir metadatos para ayudar con la clasificación en la UI
        );
        
        if (result && result.success) {
          messageId = result.id;
          dbSuccess = true;
          console.log(`✅ Mensaje guardado en base de datos con ID: ${messageId}`);
        } else {
          dbError = result?.error || "Error desconocido al guardar mensaje";
          console.error(`❌ Error al guardar mensaje: ${dbError}`);
        }
      } catch (saveError) {
        dbError = saveError.message;
        console.error(`❌ Error al guardar mensaje: ${dbError}`);
      }
    }
    
    return res.status(200).json({
      success: whatsappSuccess || dbSuccess,
      whatsapp: {
        success: whatsappSuccess,
        error: whatsappError
      },
      database: {
        success: dbSuccess,
        error: dbError,
        messageId: messageId
      },
      sent_from_dashboard: true
    });
  } catch (error) {
    console.error('❌ Error general al procesar solicitud:', error.message);
    return res.json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Endpoint de prueba para simular un mensaje
app.post('/test-message', async (req, res) => {
  try {
    console.log('📩 Mensaje de prueba recibido:', JSON.stringify(req.body));
    
    const { message, sender } = req.body;
    
    if (!message || !sender) {
      return res.json({ error: 'Mensaje o remitente faltante' });
    }
    
    // Normalizar el ID del remitente
    const normalizedSender = String(sender).trim().replace(/_TEST.*$/i, '');
    console.log(`👤 Mensaje de prueba recibido de ${normalizedSender}: ${message}`);
    
    // Guardar el mensaje del usuario en Supabase
    try {
      console.log(`💾 Guardando mensaje del usuario en Supabase: ${message}`);
      const userMessageResult = await global.registerBotResponse(normalizedSender, message, BUSINESS_ID, 'user');
      
      if (userMessageResult && userMessageResult.success) {
        console.log('✅ Mensaje del usuario guardado correctamente en Supabase');
      } else {
        console.error('❌ Error al guardar mensaje del usuario en Supabase');
      }
    } catch (supabaseUserError) {
      console.error('❌ Error al guardar mensaje del usuario:', supabaseUserError.message);
      // No interrumpimos el flujo principal por un error en el registro
    }
    
    // Enviar mensaje a OpenAI
    const response = await processMessageWithOpenAI(normalizedSender, message);
    
    // Guardar la respuesta del bot en Supabase
    try {
      console.log(`🔄 Intentando registrar respuesta del bot con business_id: ${BUSINESS_ID}`);
      
      // Usar la función global registerBotResponse para guardar en Supabase
      const result = await global.registerBotResponse(normalizedSender, response, BUSINESS_ID, 'bot');
      
      // Verificar resultado
      if (result && result.success === true) {
        console.log(`✅ Respuesta del bot guardada correctamente en Supabase`);
      } else {
        console.error(`❌ Error al guardar respuesta del bot en Supabase: ${result?.error || 'Error desconocido'}`);
      }
    } catch (controlPanelError) {
      console.error(`❌ Error al registrar respuesta del bot en Supabase:`, controlPanelError.message);
    }
    
    // Solo devolver la respuesta, no enviar a WhatsApp
    return res.status(200).json({ 
      success: true,
      message: response,
      sender: sender
    });
  } catch (error) {
    console.error('❌ Error procesando mensaje de prueba:', error.message);
    return res.json({ error: error.message });
  }
});

// Endpoint para obtener conversaciones por ID de negocio
app.get('/api/conversations/business/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    console.log(`🔍 Buscando conversaciones para el negocio: ${businessId}`);
    
    // Cargar directamente la configuración de Supabase para asegurar que siempre use valores correctos
    const supabaseConfig = require('./supabase-config');
    const supabaseUrl = process.env.SUPABASE_URL || supabaseConfig.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY || supabaseConfig.SUPABASE_KEY;
    
    // Construir la URL para consultar las conversaciones
    const url = `${supabaseUrl}/rest/v1/conversations?business_id=eq.${businessId}&order=last_message_time.desc`;
    
    // Realizar la consulta a Supabase
    const response = await axios.get(url, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    const conversations = response.data;
    console.log(`✅ Se encontraron ${conversations.length} conversaciones para el negocio ${businessId}`);
    
    return res.status(200).json(conversations);
  } catch (error) {
    console.error('❌ Error al obtener conversaciones:', error.message);
    if (error.response) {
      console.error('  Status:', error.response.status);
      console.error('  Data:', error.response.data);
    }
    return res.json({ error: 'Error al obtener conversaciones' });
  }
});

// Endpoint para obtener mensajes de una conversación específica
app.get('/api/messages/:conversationId', async (req, res) => {
    try {
    const conversationId = req.params.conversationId;
    console.log(`🔍 Solicitando mensajes para conversación/número: ${conversationId}`);
    
    if (!conversationId) {
      return res.json({ error: 'Se requiere ID de conversación o número de teléfono' });
    }
    
    // Determinar si es un UUID (ID de conversación) o un número de teléfono
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId);
    const isPhoneNumber = /^\+?\d+$/.test(conversationId);
    
    console.log(`🔍 Tipo de ID proporcionado: ${isUUID ? 'UUID' : isPhoneNumber ? 'Número de teléfono' : 'Desconocido'}`);
    
    // Cargar directamente la configuración de Supabase para asegurar que siempre use valores correctos
    const supabaseConfig = require('./supabase-config');
    const supabaseUrl = process.env.SUPABASE_URL || supabaseConfig.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY || supabaseConfig.SUPABASE_KEY;
    
    // Variable para almacenar el ID real de la conversación
    let actualConversationId = conversationId;
    
    // Si es un número de teléfono, necesitamos encontrar el ID de conversación
    if (isPhoneNumber) {
      console.log(`🔍 Buscando ID de conversación para el número de teléfono: ${conversationId}`);
      
      // Normalizar el número (eliminar el símbolo + si existe)
      const normalizedPhone = conversationId.replace(/^\+/, '');
      
      // Primero verificar en la caché
      if (phoneToConversationMap[normalizedPhone]) {
        actualConversationId = phoneToConversationMap[normalizedPhone];
        console.log(`✅ ID de conversación encontrado en caché: ${actualConversationId}`);
      } else {
        // Buscar en la base de datos
        try {
          // Consultar Supabase para encontrar la conversación asociada al número
          const conversationUrl = `${supabaseUrl}/rest/v1/conversations?user_id=eq.${normalizedPhone}&business_id=eq.${BUSINESS_ID}&order=created_at.desc&limit=1`;
          
          const conversationResponse = await axios.get(conversationUrl, {
          headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (conversationResponse.data && conversationResponse.data.length > 0) {
            actualConversationId = conversationResponse.data[0].id;
            console.log(`✅ ID de conversación encontrado en DB: ${actualConversationId}`);
            
            // Actualizar caché para futuras referencias
            phoneToConversationMap[normalizedPhone] = actualConversationId;
            conversationIdToPhoneMap[actualConversationId] = normalizedPhone;
            console.log(`📝 Caché actualizada para futuras referencias`);
          } else {
            console.log(`⚠️ No se encontró ninguna conversación para el número: ${normalizedPhone}`);
            return res.json({
              error: `No se encontró ninguna conversación asociada al número ${conversationId}`,
              conversationId: conversationId,
              isPhoneNumber: true
            });
          }
        } catch (dbError) {
          console.error('❌ Error buscando conversación:', dbError.message);
          return res.json({ error: 'Error buscando conversación' });
        }
      }
    }
    
    // Ahora tenemos el ID real de la conversación, podemos obtener los mensajes
    console.log(`🔍 Obteniendo mensajes para ID de conversación: ${actualConversationId}`);
    
    // Construir la URL para consultar los mensajes
    const url = `${supabaseUrl}/rest/v1/messages?conversation_id=eq.${actualConversationId}&order=created_at.asc`;
    
    // Realizar la consulta a Supabase
    const response = await axios.get(url, {
        headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    const messages = response.data;
    console.log(`✅ Encontrados ${messages.length} mensajes para la conversación ${actualConversationId}`);
    
    // Añadir información adicional para ayudar en la depuración
    return res.status(200).json({
      messages: messages,
      conversationId: conversationId,
      actualConversationId: actualConversationId,
      isPhoneNumber: isPhoneNumber,
      isUUID: isUUID
        });
    } catch (error) {
    console.error('❌ Error al obtener mensajes:', error.message);
    if (error.response) {
      console.error('  Status:', error.response.status);
      console.error('  Data:', error.response.data);
    }
    return res.json({ error: 'Error al obtener mensajes' });
    }
});

// Nueva ruta para buscar conversación por número de teléfono
app.get('/api/conversation/phone/:phoneNumber', async (req, res) => {
    try {
        console.log(`🔍 Buscando conversación para número: ${req.params.phoneNumber}`);
        
        const { data, error } = await supabase
            .from('conversations')
            .select('*')
            .eq('user_id', req.params.phoneNumber)
            .single();
        
        if (error) {
            console.log(`❌ Error buscando conversación: ${error.message}`);
            return res.json({
                error: 'Error buscando conversación',
                details: error.message
            });
        }
        
        if (!data) {
            return res.json({
                error: 'Conversación no encontrada',
                details: `No se encontró conversación para el número ${req.params.phoneNumber}`
            });
        }
        
        console.log(`✅ Conversación encontrada: ${data.id}`);
        return res.json({
            success: true,
            conversation: data
        });
    } catch (error) {
        console.log(`❌ Error general: ${error.message}`);
        return res.json({
            error: 'Error del servidor',
            details: error.message
        });
    }
});

// Endpoint para activar/desactivar el bot para una conversación específica (acepta PUT y POST)
app.put('/api/conversations/:id/toggle-bot', handleToggleBot);
app.post('/api/conversations/:id/toggle-bot', handleToggleBot);

// Función de manejo para toggle-bot
async function handleToggleBot(req, res) {
    try {
        logDebug(`🤖 TOGGLE BOT - Iniciando cambio de estado para conversación ${req.params.id}`);
        
        const { id } = req.params;
        const { active } = req.body;
        
        if (!id) {
            logDebug(`❌ TOGGLE BOT - ID de conversación faltante`);
            return res.json({ error: 'Se requiere ID de conversación' });
        }
        
        logDebug(`🔄 TOGGLE BOT - Solicitando cambio a: ${active ? 'ACTIVO' : 'INACTIVO'} para conversación ${id}`);
        
        // Obtener datos de la conversación para verificar que existe
        const { data: convData, error: convError } = await supabase
            .from('conversations')
            .select('id, user_id, business_id')
            .eq('id', id)
            .single();
            
        if (convError) {
            logDebug(`❌ TOGGLE BOT - Error obteniendo datos de conversación: ${convError.message}`);
            return res.json({ error: 'Conversación no encontrada', details: convError.message });
        }
        
        if (!convData) {
            logDebug(`❌ TOGGLE BOT - Conversación ${id} no existe en la base de datos`);
            return res.json({ error: 'Conversación no encontrada' });
        }
        
        // Actualizar estado del bot en la base de datos
        const { data, error } = await supabase
            .from('conversations')
            .update({ is_bot_active: active })
            .eq('id', id)
            .select('id, user_id, is_bot_active')
            .single();
            
        if (error) {
            logDebug(`❌ TOGGLE BOT - Error actualizando estado: ${error.message}`);
            return res.json({ 
                error: 'Error al actualizar estado del bot', 
                details: error.message 
            });
        }
        
        logDebug(`✅ TOGGLE BOT - Estado actualizado en DB: is_bot_active=${active} para conversación ${id}`);
        
        // Actualizar caché
        if (data && data.user_id) {
            senderBotStatusMap[data.user_id] = active;
            logDebug(`📝 TOGGLE BOT - Caché actualizada: senderBotStatusMap[${data.user_id}] = ${active}`);
        }
        
        // En desarrollo, mostrar todos los mapeos actualizados
        if (process.env.NODE_ENV !== 'production') {
            logDebug('📊 TOGGLE BOT - Estado actual de cache:');
            Object.keys(senderBotStatusMap).forEach(key => {
                logDebug(`   - ${key}: ${senderBotStatusMap[key] ? 'ACTIVO' : 'INACTIVO'}`);
            });
        }
        
        return res.status(200).json({ 
            success: true, 
            is_bot_active: active, 
            message: `Bot ${active ? 'activado' : 'desactivado'} exitosamente`,
            conversation_id: id,
            user_id: data.user_id
        });
    } catch (error) {
        logDebug(`❌ TOGGLE BOT - Error general: ${error.message}`);
        return res.json({ 
            error: 'Error al procesar la solicitud', 
            message: error.message 
        });
    }
}

// Endpoint para verificar el estado actual del bot
app.get('/api/bot-status/:id', handleBotStatus);

// Función para manejar la verificación del estado del bot
async function handleBotStatus(req, res) {
    try {
        const { id } = req.params;
        
        if (!id) {
            return res.json({ error: 'Se requiere ID de conversación o número de teléfono' });
        }
        
        logDebug(`🔍 Verificando estado del bot para: ${id}`);
        
        // Verificar si es un UUID o un número de teléfono
        const isUUID = id.includes('-');
        
        let query;
        if (isUUID) {
            // Es un ID de conversación
            query = supabase
                .from('conversations')
                .select('id, user_id, is_bot_active, last_message_time')
                .eq('id', id);
        } else {
            // Es un número de teléfono
            query = supabase
                .from('conversations')
                .select('id, user_id, is_bot_active, last_message_time')
                .eq('user_id', id);
        }
        
        const { data, error } = await query;
        
        if (error) {
            logDebug(`❌ Error consultando estado del bot: ${error.message}`);
            return res.json({ 
                error: 'Error al consultar estado', 
                details: error.message 
            });
        }
        
        if (!data || data.length === 0) {
            logDebug(`⚠️ No se encontró conversación para: ${id}`);
            return res.json({ 
                error: 'Conversación no encontrada', 
                id 
            });
        }
        
        // Obtener el estado del cache también
        const cacheStatus = isUUID 
            ? (data[0].user_id ? senderBotStatusMap[data[0].user_id] : undefined)
            : senderBotStatusMap[id];
        
        logDebug(`✅ Estado encontrado para ${id}:`);
        logDebug(`   - DB: ${data.map(c => `${c.id}=${c.is_bot_active}`).join(', ')}`);
        logDebug(`   - Cache: ${cacheStatus !== undefined ? cacheStatus : 'no en caché'}`);
        
        return res.status(200).json({
            success: true,
            conversations: data.map(conv => ({
                id: conv.id,
                user_id: conv.user_id,
                is_bot_active: conv.is_bot_active,
                last_message_time: conv.last_message_time,
                cache_status: conv.user_id ? senderBotStatusMap[conv.user_id] : undefined
            })),
            cache_status: cacheStatus
        });
  } catch (error) {
        logDebug(`❌ Error general en bot-status: ${error.message}`);
        return res.json({ 
            error: 'Error al procesar la solicitud', 
            message: error.message 
        });
    }
}

// Endpoint para simular el procesamiento con OpenAI sin enviar a WhatsApp
app.post('/api/simulate-openai/:id', handleSimulateOpenAI);

// Función para manejar la simulación
async function handleSimulateOpenAI(req, res) {
    try {
        const { id } = req.params;
        const { message } = req.body;
        
        if (!id) {
            return res.json({ error: 'Se requiere ID de conversación o número de teléfono' });
        }
        
        if (!message) {
            return res.json({ error: 'Se requiere un mensaje para procesar' });
        }
        
        logDebug(`🔬 SIMULACIÓN - Procesando mensaje para ${id}: "${message}"`);
        
        // Sobreescribir temporalmente sendWhatsAppResponse para capturar respuesta
        const originalSendWhatsApp = sendWhatsAppResponse;
        let capturedResponse = null;
        
        sendWhatsAppResponse = async (recipient, response) => {
            logDebug(`📝 SIMULACIÓN - Capturando respuesta: "${response.substring(0, 100)}${response.length > 100 ? '...' : ''}"`);
            capturedResponse = response;
            return true; // Simular éxito
        };
        
        try {
            // Si es un UUID (ID de conversación)
            const isUUID = id.includes('-');
            let userId = id;
            let conversationId = isUUID ? id : null;
            
            // Si es un ID de conversación, obtener el user_id
            if (isUUID) {
                const { data, error } = await supabase
                    .from('conversations')
                    .select('user_id')
                    .eq('id', id)
                    .single();
                    
                if (error || !data) {
                    return res.json({ error: 'Conversación no encontrada' });
                }
                
                userId = data.user_id;
            } 
            // Si es un número de teléfono, buscar la conversación correspondiente
            else {
                const { data, error } = await supabase
                    .from('conversations')
                    .select('id')
                    .eq('user_id', id)
                    .order('created_at', { ascending: false })
                    .limit(1);
                    
                if (!error && data && data.length > 0) {
                    conversationId = data[0].id;
                }
            }
            
            // Guardar estado original del bot para este usuario
            const originalBotStatus = senderBotStatusMap[userId];
            
            // Forzar estado activo para la simulación
            senderBotStatusMap[userId] = true;
            logDebug(`🤖 SIMULACIÓN - Forzando bot ACTIVO temporalmente para ${userId}`);
            
            // Procesar con OpenAI
            const response = await processMessageWithOpenAI(userId, message, conversationId, BUSINESS_ID);
            
            // Restaurar estado original
            senderBotStatusMap[userId] = originalBotStatus;
            logDebug(`🔄 SIMULACIÓN - Restaurando estado original del bot: ${originalBotStatus ? 'ACTIVO' : 'INACTIVO'}`);
            
            // Restaurar función original
            sendWhatsAppResponse = originalSendWhatsApp;
            
            if (capturedResponse) {
                return res.status(200).json({
                    success: true,
                    message: 'Simulación exitosa',
                    response: capturedResponse,
                    user_id: userId,
                    conversation_id: conversationId
                });
    } else {
                return res.json({
                    success: false,
                    message: 'No se pudo generar una respuesta'
                });
            }
        } finally {
            // Asegurar que la función original se restaure incluso si hay error
            sendWhatsAppResponse = originalSendWhatsApp;
    }
  } catch (error) {
        logDebug(`❌ SIMULACIÓN - Error: ${error.message}`);
        return res.json({
            error: 'Error al procesar la simulación',
            message: error.message
        });
    }
}

// Configurar el registro en archivo de depuración
const debugLogFile = path.join(__dirname, 'debug.log');
const logDebug = (message) => {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - ${message}\n`;
  fs.appendFileSync(debugLogFile, logMessage);
  console.log(message); // También mantener los logs en la consola
};

// También reemplazar algunas instancias clave de console.log con logDebug
// ... existing code ...

// Endpoint para pruebas de GupShup API
app.get('/api/test-gupshup', async (req, res) => {
  try {
    console.log('🔍 Probando credenciales de GupShup...');
    
    // Mostrar información de configuración
    console.log(`🔑 API Key: ${GUPSHUP_API_KEY ? 'Configurada (primeros 10 caracteres: ' + GUPSHUP_API_KEY.substring(0, 10) + '...)' : 'No configurada'}`);
    console.log(`📱 Número: ${GUPSHUP_NUMBER || 'No configurado'}`);
    console.log(`👤 User ID: ${GUPSHUP_USERID ? 'Configurado (primeros 10 caracteres: ' + GUPSHUP_USERID.substring(0, 10) + '...)' : 'No configurado'}`);
    
    // Probar conexión a GupShup - Verificar estado de la cuenta
    const apiUrl = 'https://api.gupshup.io/wa/api/v1/users/info';
    
    const headers = {
      'apikey': GUPSHUP_API_KEY,
      'Content-Type': 'application/json'
    };
    
    console.log('🔄 Realizando solicitud a GupShup...');
    
    try {
      const response = await axios.get(apiUrl, { headers });
      
      console.log(`✅ Conexión exitosa a GupShup: ${response.status}`);
      console.log(`📊 Datos recibidos: ${JSON.stringify(response.data)}`);
      
      return res.json({
        success: true,
        status: 'Conexión exitosa',
        message: 'Las credenciales de GupShup son válidas',
        apiResponse: response.data
      });
    } catch (apiError) {
      console.log(`❌ Error al conectar con GupShup: ${apiError.message}`);
      
      let errorDetails = {
        message: apiError.message
      };
      
      if (apiError.response) {
        errorDetails.status = apiError.response.status;
        errorDetails.data = apiError.response.data;
        console.log(`❌ Respuesta de error: ${apiError.response.status} - ${JSON.stringify(apiError.response.data)}`);
      }
      
      return res.json({
        success: false,
        status: 'Error de conexión',
        message: 'Falló la conexión con GupShup',
        error: errorDetails
      });
    }
  } catch (error) {
    console.error(`❌ Error general: ${error.message}`);
    return res.json({
      success: false,
      status: 'Error',
      message: error.message
    });
  }
});

// ... existing code ...

// Endpoint para actualizar credenciales de GupShup
app.post('/api/update-gupshup-credentials', async (req, res) => {
  try {
    const { apiKey, number, userId } = req.body;
    
    console.log('🔄 Actualizando credenciales de GupShup...');
    
    // Comprobar que se proporcionaron los datos necesarios
    if (!apiKey && !number && !userId) {
      return res.json({
        success: false,
        message: 'Debe proporcionar al menos una credencial para actualizar (apiKey, number o userId)'
      });
    }
    
    // Guardar valores anteriores para poder restaurarlos en caso de error
    const previousApiKey = GUPSHUP_API_KEY;
    const previousNumber = GUPSHUP_NUMBER;
    const previousUserId = GUPSHUP_USERID;
    
    // Actualizar las variables globales con los nuevos valores
    if (apiKey) {
      console.log(`🔑 Actualizando API Key: ${apiKey.substring(0, 8)}...`);
      GUPSHUP_API_KEY = apiKey;
    }
    
    if (number) {
      console.log(`📱 Actualizando número: ${number}`);
      GUPSHUP_NUMBER = number;
    }
    
    if (userId) {
      console.log(`👤 Actualizando User ID: ${userId.substring(0, 8)}...`);
      GUPSHUP_USERID = userId;
    }
    
    // Probar conexión a GupShup con las nuevas credenciales
    const apiUrl = 'https://api.gupshup.io/wa/api/v1/users/info';
    
    const headers = {
      'apikey': GUPSHUP_API_KEY,
      'Content-Type': 'application/json'
    };
    
    console.log('🔄 Probando conexión con nuevas credenciales...');
    
    try {
      const response = await axios.get(apiUrl, { headers });
      
      console.log(`✅ Conexión exitosa con nuevas credenciales: ${response.status}`);
      console.log(`📊 Datos recibidos: ${JSON.stringify(response.data)}`);
      
      return res.json({
        success: true,
        message: 'Credenciales actualizadas correctamente',
        updatedCredentials: {
          apiKey: apiKey ? `${apiKey.substring(0, 8)}...` : 'No actualizada',
          number: number || 'No actualizado',
          userId: userId ? `${userId.substring(0, 8)}...` : 'No actualizado'
        },
        apiResponse: response.data
      });
    } catch (apiError) {
      // Restaurar valores anteriores en caso de error
      console.log(`❌ Error al conectar con nuevas credenciales: ${apiError.message}`);
      console.log('🔄 Restaurando credenciales anteriores...');
      
      GUPSHUP_API_KEY = previousApiKey;
      GUPSHUP_NUMBER = previousNumber;
      GUPSHUP_USERID = previousUserId;
      
      let errorDetails = {
        message: apiError.message
      };
      
      if (apiError.response) {
        errorDetails.status = apiError.response.status;
        errorDetails.data = apiError.response.data;
        console.log(`❌ Respuesta de error: ${apiError.response.status} - ${JSON.stringify(apiError.response.data)}`);
      }
      
      return res.json({
        success: false,
        message: 'Error al conectar con GupShup usando las nuevas credenciales',
        error: errorDetails
      });
    }
  } catch (error) {
    console.error(`❌ Error general: ${error.message}`);
    return res.json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// ... existing code ...

// Sistema para manejar mensajes pendientes de respuesta
// Mapa para almacenar las conversaciones esperando respuesta: { conversationId: { resolver, timeout } }
const pendingResponses = new Map();

// Tiempo máximo de espera para una respuesta (en ms)
const MAX_WAIT_TIME = 60000; // 60 segundos

/**
 * Espera un mensaje de respuesta para una conversación específica
 * @param {string} conversationId - ID de la conversación 
 * @param {number} timeoutMs - Tiempo máximo de espera en ms
 * @returns {Promise<object>} - Mensaje recibido o timeout
 */
function waitForUserResponse(conversationId, timeoutMs = MAX_WAIT_TIME) {
  return new Promise((resolve, reject) => {
    if (!conversationId) {
      return reject(new Error('Se requiere un ID de conversación válido'));
    }
    
    // Crear un timeout para rechazar la promesa si no se recibe respuesta
    const timeout = setTimeout(() => {
      // Limpiar la entrada en el mapa
      if (pendingResponses.has(conversationId)) {
        pendingResponses.delete(conversationId);
      }
      reject(new Error('Tiempo de espera agotado sin recibir respuesta'));
    }, timeoutMs);
    
    // Almacenar la función resolve y el timeout para usarlos cuando llegue el mensaje
    pendingResponses.set(conversationId, {
      resolver: resolve,
      timeout: timeout
    });
    
    console.log(`⏳ Esperando respuesta para conversación ${conversationId}...`);
  });
}

/**
 * Resuelve una promesa pendiente cuando llega un mensaje
 * @param {string} conversationId - ID de la conversación
 * @param {object} messageData - Datos del mensaje recibido
 * @returns {boolean} - true si había una promesa pendiente, false si no
 */
function resolveWaitingPromise(conversationId, messageData) {
  if (pendingResponses.has(conversationId)) {
    const { resolver, timeout } = pendingResponses.get(conversationId);
    
    // Limpiar el timeout para evitar el rechazo automático
    clearTimeout(timeout);
    
    // Resolver la promesa con los datos del mensaje
    resolver(messageData);
    
    // Eliminar la entrada del mapa
    pendingResponses.delete(conversationId);
    
    console.log(`✅ Respuesta recibida para conversación ${conversationId}`);
    return true;
  }
  
  return false;
}

// Añadir una nueva ruta para enviar un mensaje y esperar respuesta
app.post('/api/send-and-wait', async (req, res) => {
    try {
        const { conversationId, recipient, message, waitTimeout } = req.body;
        
        if (!conversationId || !recipient || !message) {
            return res.json({ 
                success: false, 
                error: 'Se requieren los campos conversationId, recipient y message' 
            });
        }
        
        // Enviar el mensaje
        console.log(`📤 Enviando mensaje y esperando respuesta para ${recipient}`);
        const sendResult = await sendWhatsAppResponse(recipient, message);
        
        if (!sendResult) {
            return res.json({
                success: false,
                error: 'No se pudo enviar el mensaje'
            });
        }
        
        try {
            // Esperar la respuesta del usuario
            const timeout = waitTimeout || MAX_WAIT_TIME;
            console.log(`⏳ Esperando respuesta del usuario por ${timeout}ms...`);
            
            const userResponse = await waitForUserResponse(conversationId, timeout);
            
            // Si llegamos aquí, obtuvimos una respuesta
            return res.status(200).json({
                success: true,
                message: 'Respuesta recibida',
                response: userResponse
            });
            
        } catch (waitError) {
            // Timeout o error esperando respuesta
            return res.status(408).json({
                success: false,
                error: waitError.message
            });
        }
    } catch (error) {
        console.error(`❌ Error en send-and-wait: ${error.message}`);
        return res.json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

// Exportar funciones para testing
module.exports = {
  app,
  extractMessageData,
  processMessageWithOpenAI,
  sendWhatsAppResponse,
  waitForUserResponse,    // Exportar la nueva función
  resolveWaitingPromise   // Exportar la nueva función
};

// ... existing code ...

/**
 * Procesa un grupo de mensajes acumulados
 * @param {string} conversationId - ID de la conversación
 */
async function processMessageGroup(conversationId) {
  // Verificar que el grupo todavía existe
  if (!pendingMessageGroups.has(conversationId)) {
    console.log(`⚠️ No se encontró grupo de mensajes para ${conversationId}`);
    return;
  }
  
  const group = pendingMessageGroups.get(conversationId);
  const messages = group.messages;
  
  // Eliminar el grupo para que nuevos mensajes comiencen uno nuevo
  pendingMessageGroups.delete(conversationId);
  
  console.log(`🔄 Procesando grupo de ${messages.length} mensajes para ${conversationId}`);
  
  // Si no hay mensajes, no hay nada que hacer
  if (messages.length === 0) {
    console.log(`⚠️ Grupo vacío para ${conversationId}, ignorando`);
    return;
  }
  
  // REGLA IMPORTANTE: Si hay más de un mensaje, SIEMPRE combinarlos sin importar el tiempo
  if (messages.length > 1) {
    console.log(`🔗 Múltiples mensajes detectados (${messages.length}), combinando automáticamente`);
    
    // Concatenar todos los mensajes con saltos de línea para mejor comprensión
    const combinedMessage = messages.map(m => m.message).join("\n");
    const sender = messages[0].sender; // Todos los mensajes son del mismo remitente
    
    console.log(`📦 Combinando ${messages.length} mensajes en uno solo: "${combinedMessage.substring(0, 100)}${combinedMessage.length > 100 ? '...' : ''}"`);
    
    // Construir un mensaje enriquecido que explique a OpenAI la situación
    const enrichedMessage = `[El usuario ha enviado ${messages.length} mensajes consecutivos que deben tratarse como una sola consulta]\n\n${combinedMessage}`;
    
    // Procesar el mensaje combinado
    try {
      console.log(`🤖 Enviando a OpenAI mensaje combinado con ${messages.length} partes`);
      const botResponse = await processMessageWithOpenAI(sender, enrichedMessage, conversationId, BUSINESS_ID);
      
      if (botResponse) {
        console.log(`✅ Respuesta generada para mensaje combinado: "${botResponse.substring(0, 50)}${botResponse.length > 50 ? '...' : ''}"`);
        
        // Asegurar que el mensaje se envía correctamente
        let sendAttempts = 0;
        let sendSuccess = false;
        
        while (!sendSuccess && sendAttempts < 3) {
          sendAttempts++;
          console.log(`📤 Intento #${sendAttempts} de envío de respuesta a WhatsApp`);
          sendSuccess = await sendWhatsAppResponse(sender, botResponse);
          
          if (sendSuccess) {
            console.log(`✅ Respuesta enviada exitosamente a WhatsApp para ${sender} en intento #${sendAttempts}`);
          } else if (sendAttempts < 3) {
            console.log(`⚠️ Reintentando envío en 1 segundo...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        if (!sendSuccess) {
          console.error(`❌ No se pudo enviar la respuesta después de ${sendAttempts} intentos`);
          
          // Guardar el mensaje en Supabase aunque no se pudiera enviar a WhatsApp
          try {
            console.log(`💾 Guardando respuesta en Supabase aunque no se pudo enviar a WhatsApp`);
            const saveResult = await registerBotResponse(
              conversationId,
              botResponse,
              BUSINESS_ID, 
              'bot'
            );
            
            if (saveResult && saveResult.success) {
              console.log(`✅ Respuesta guardada en base de datos, ID: ${saveResult.messageId || 'desconocido'}`);
            } else {
              console.error(`❌ No se pudo guardar la respuesta en la base de datos: ${saveResult?.error || 'Error desconocido'}`);
            }
          } catch (dbError) {
            console.error(`❌ Error guardando respuesta en la base de datos: ${dbError.message}`);
          }
        }
      } else {
        console.log(`⚠️ OpenAI no generó respuesta para el mensaje combinado`);
      }
    } catch (aiError) {
      console.error(`❌ Error procesando mensaje combinado con OpenAI: ${aiError.message}`);
    }
    return;
  }
  
  // Si solo hay un mensaje, procesarlo normalmente
  console.log(`ℹ️ Solo un mensaje en el grupo, procesando normalmente`);
  const sender = messages[0].sender;
  const message = messages[0].message;
  
  try {
    const botResponse = await processMessageWithOpenAI(sender, message, conversationId, BUSINESS_ID);
    
    if (botResponse) {
      console.log(`✅ Respuesta generada para mensaje: "${botResponse.substring(0, 50)}${botResponse.length > 50 ? '...' : ''}"`);
      
      // Asegurar que el mensaje se envía correctamente
      let sendAttempts = 0;
      let sendSuccess = false;
      
      while (!sendSuccess && sendAttempts < 3) {
        sendAttempts++;
        console.log(`📤 Intento #${sendAttempts} de envío de respuesta a WhatsApp`);
        sendSuccess = await sendWhatsAppResponse(sender, botResponse);
        
        if (sendSuccess) {
          console.log(`✅ Respuesta enviada exitosamente a WhatsApp para ${sender} en intento #${sendAttempts}`);
        } else if (sendAttempts < 3) {
          console.log(`⚠️ Reintentando envío en 1 segundo...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      if (!sendSuccess) {
        console.error(`❌ No se pudo enviar la respuesta después de ${sendAttempts} intentos`);
      }
    } else {
      console.log(`⚠️ OpenAI no generó respuesta para el mensaje`);
    }
  } catch (aiError) {
    console.error(`❌ Error procesando mensaje con OpenAI: ${aiError.message}`);
  }
}

// Variables para agrupamiento de mensajes
const pendingMessageGroups = new Map(); // Almacena los mensajes pendientes por conversación
const MESSAGE_GROUP_WAIT_TIME = 4500; // 4.5 segundos de espera para agrupar mensajes (antes 8000)
const MAX_MESSAGE_GROUP_WAIT = 15000; // Máximo 15 segundos de espera (sin cambios)

/**
 * Añade un mensaje al grupo pendiente de una conversación
 * @param {string} conversationId ID de la conversación
 * @param {Object} messageData Datos del mensaje
 * @returns {boolean} true si el mensaje debe esperar, false en caso contrario
 */
function addToPendingMessageGroup(conversationId, messageData) {
  if (!conversationId) return false;
  
  // Obtener o crear el grupo para esta conversación
  if (!pendingMessageGroups.has(conversationId)) {
    pendingMessageGroups.set(conversationId, {
      messages: [],
      timeoutId: null,
      firstMessageTime: Date.now()
    });
  }
  
  const group = pendingMessageGroups.get(conversationId);
  
  // Agregar el mensaje al grupo
  group.messages.push(messageData);
  console.log(`📎 Mensaje añadido al grupo de ${conversationId}. Total: ${group.messages.length}`);
  
  // Limpiar el timeout anterior si existe
  if (group.timeoutId) {
    clearTimeout(group.timeoutId);
  }
  
  // Calcular cuánto tiempo debe esperar para ver si llegan más mensajes
  const elapsedTime = Date.now() - group.firstMessageTime;
  let remainingWaitTime = MESSAGE_GROUP_WAIT_TIME;
  
  // Tiempo mínimo que siempre se esperará después de recibir cualquier mensaje, incluso si ya se superó el tiempo máximo
  const MIN_WAIT_TIME = 3000; // 3 segundos mínimo de espera después de cada mensaje
  
  // Si ya ha pasado mucho tiempo desde el primer mensaje, pero garantizar un tiempo mínimo de espera
  if (elapsedTime > MAX_MESSAGE_GROUP_WAIT) {
    remainingWaitTime = MIN_WAIT_TIME; // Espera mínima después de cada mensaje
  } else {
    remainingWaitTime = Math.min(MESSAGE_GROUP_WAIT_TIME, MAX_MESSAGE_GROUP_WAIT - elapsedTime);
    remainingWaitTime = Math.max(remainingWaitTime, MIN_WAIT_TIME); // Asegurar tiempo mínimo
  }
  
  // Establecer un nuevo timeout para procesar este grupo
  group.timeoutId = setTimeout(() => {
    processMessageGroup(conversationId);
  }, remainingWaitTime);
  
  console.log(`⏳ Mensaje añadido al grupo. Esperando ${(remainingWaitTime/1000).toFixed(1)} segundos para más mensajes antes de procesar`);
  
  return true; // Indicar que debe esperar y no procesar inmediatamente
}

// ... existing code ...

// Endpoint para probar la API de calendario
app.post('/api/test-calendar', async (req, res) => {
  try {
    const calendarApi = require('./lib/calendar-api');
    const { date, phoneNumber, action } = req.body;
    const businessId = process.env.BUSINESS_ID || '2d385aa5-40e0-4ec9-9360-19281bc605e4';
    
    console.log(`🔍 Probando API de calendario con acción: ${action || 'check_availability'}`);
    
    // Verificar disponibilidad (acción por defecto)
    if (!action || action === 'check_availability') {
      const result = await calendarApi.check_calendar_availability(businessId, date || '2025-05-15');
      return res.json(result);
    }
    
    // Crear evento
    if (action === 'create_event') {
      if (!date || !phoneNumber) {
        return res.json({ error: 'Se requieren fecha y número de teléfono' });
      }
      
      const eventDetails = {
        date: date,
        time: req.body.time || '10:00',
        phone: phoneNumber,
        name: req.body.name || 'Cliente de prueba',
        description: req.body.description || 'Cita de prueba creada por API'
      };
      
      const result = await calendarApi.create_calendar_event(businessId, eventDetails);
      return res.json(result);
    }
    
    // Buscar citas
    if (action === 'find_appointments') {
      if (!phoneNumber) {
        return res.json({ error: 'Se requiere número de teléfono' });
      }
      
      const result = await calendarApi.find_customer_appointments(businessId, phoneNumber);
      return res.json(result);
    }
    
    // Cancelar cita
    if (action === 'delete_event') {
      if (!req.body.eventId) {
        return res.json({ error: 'Se requiere ID del evento' });
      }
      
      const result = await calendarApi.delete_calendar_event(businessId, req.body.eventId);
      return res.json(result);
    }
    
    // Acción no reconocida
    return res.json({ error: 'Acción no válida' });
    
  } catch (error) {
    console.error('❌ Error en endpoint de prueba de calendario:', error);
    return res.json({ error: error.message });
  }
});

// ... existing code ...

// Ruta para iniciar el flujo de autorización de Google Calendar
app.get('/api/google-auth', async (req, res) => {
  try {
    const { google } = require('googleapis');
    const { businessId } = req.query;
    
    if (!businessId) {
      return res.json({ error: 'Se requiere ID de negocio' });
    }
    
    // Guardar el businessId en la sesión si existe
    if (req.session) {
      req.session.businessId = businessId;
    } else {
      console.warn('⚠️ Advertencia: Sesión no disponible para guardar el businessId');
    }
    
    // Verificar credenciales
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    
    if (!clientId || clientId === 'YOUR_CLIENT_ID' || 
        !clientSecret || clientSecret === 'YOUR_CLIENT_SECRET') {
      return res.json({ 
        error: 'Credenciales de Google OAuth no configuradas correctamente'
      });
    }
    
    // Crear cliente OAuth
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );
    
    // Definir scopes para acceso a Calendar
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ];
    
    // Generar URL de autorización
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline', // Para obtener refresh token
      scope: scopes,
      prompt: 'consent', // Forzar consentimiento para obtener refresh token
      state: businessId // Pasar el businessId como estado
    });
    
    // Redireccionar al usuario a la página de autorización de Google
    console.log(`🔄 Redirigiendo a la página de autorización de Google para businessId: ${businessId}`);
    res.redirect(authUrl);
  } catch (error) {
    console.error('❌ Error en endpoint google-auth:', error);
    res.json({ error: `Error iniciando autenticación: ${error.message}` });
  }
});

// Ruta de callback para la autorización de Google
app.get('/google-auth-callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code) {
      return res.status(400).send(`
        <html>
          <body style="text-align: center; font-family: Arial; padding: 50px;">
            <h2>❌ Error en la autorización</h2>
            <p>No se recibió código de autorización. Por favor, intenta nuevamente.</p>
            <script>setTimeout(() => window.close(), 10000);</script>
          </body>
        </html>
      `);
    }
    
    // Recuperar businessId de state o de la sesión
    let businessId = state;
    if (!businessId && req.session && req.session.businessId) {
      businessId = req.session.businessId;
    }
    
    if (!businessId) {
      return res.status(400).send(`
        <html>
          <body style="text-align: center; font-family: Arial; padding: 50px;">
            <h2>❌ Error en la autorización</h2>
            <p>No se pudo identificar el negocio asociado. Por favor, intenta nuevamente.</p>
            <script>setTimeout(() => window.close(), 10000);</script>
          </body>
        </html>
      `);
    }
    
    // Inicializar cliente OAuth
    const { google } = require('googleapis');
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    // Obtener tokens con el código de autorización
    const { tokens } = await oauth2Client.getToken(code);
    console.log(`✅ Tokens de autorización obtenidos para negocio: ${businessId}`);
    
    // Inicializar Supabase si no está disponible globalmente
    const { createClient } = require('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL || 'https://wscijkxwevgxbgwhbqtm.supabase.co';
    const supabaseKey = process.env.SUPABASE_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Actualizar los tokens en la tabla business_config
    const { error } = await supabase
      .from('business_config')
      .update({
        google_calendar_enabled: true,
        google_calendar_refresh_token: tokens.refresh_token || null,
        google_calendar_access_token: tokens.access_token || null,
        google_calendar_token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        google_calendar_enabled: true,
        google_calendar_needs_reauth: false,
        google_calendar_updated_at: new Date().toISOString()
      })
      .eq('id', businessId);
      
    if (error) {
      console.error(`❌ Error guardando tokens en base de datos: ${error.message}`);
      return res.status(500).send(`
        <html>
          <body style="text-align: center; font-family: Arial; padding: 50px;">
            <h2>❌ Error guardando autorización</h2>
            <p>Ocurrió un error al guardar la autorización en el sistema</p>
            <p>${error.message}</p>
            <script>setTimeout(() => window.close(), 5000);</script>
          </body>
        </html>
      `);
    }
    
    // Enviar respuesta de éxito
    return res.status(200).send(`
      <html>
        <body style="text-align: center; font-family: Arial; padding: 50px;">
          <h2>✅ ¡Autorización exitosa!</h2>
          <p>Google Calendar ha sido conectado correctamente.</p>
          <p>Ya puedes cerrar esta ventana y continuar en la aplicación.</p>
          <script>
            setTimeout(() => {
              window.opener && window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS', businessId: '${businessId}' }, '*');
              window.close();
            }, 3000);
          </script>
        </body>
      </html>
    `);
    
  } catch (error) {
    console.error(`❌ Error en callback de OAuth: ${error.message}`);
    return res.status(500).send(`
      <html>
        <body style="text-align: center; font-family: Arial; padding: 50px;">
          <h2>❌ Error en la autorización</h2>
          <p>${error.message}</p>
          <script>setTimeout(() => window.close(), 5000);</script>
        </body>
      </html>
    `);
  }
});

// Endpoint para iniciar la autenticación con Google Calendar
app.get('/api/google-auth', (req, res) => {
  try {
    const { businessId } = req.query;
    
    if (!businessId) {
      return res.json({
        success: false,
        error: 'ID de negocio no proporcionado'
      });
    }
    
    // Obtener credenciales OAuth
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/google-auth/redirect`;
    
    if (!clientId || !clientSecret) {
      return res.json({
        success: false,
        error: 'Faltan credenciales de Google OAuth en el servidor'
      });
    }
    
    // Crear cliente OAuth
    const { google } = require('googleapis');
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    
    // Configurar URL de autorización
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ];
    
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent', // Forzar pantalla de consentimiento para obtener refresh_token
      state: businessId // Pasar el ID de negocio como estado
    });
    
    // Redireccionar a la URL de autorización
    res.redirect(authUrl);
    
  } catch (error) {
    console.error(`❌ Error iniciando autenticación de Google Calendar: ${error.message}`);
    res.json({
      success: false,
      error: `Error interno: ${error.message}`
    });
  }
});

// ... existing code ...

/**
 * Endpoint para obtener la configuración de un negocio
 * @route GET /api/business/config
 * @param {string} business_id - ID del negocio en la consulta (opcional, usa el predeterminado si no se proporciona)
 * @returns {object} Configuración del negocio
 */
app.get('/api/business/config', async (req, res) => {
  try {
    const businessIdFromQuery = req.query.business_id;
    const businessIdFromHeaders = req.headers['x-business-id'];
    const businessIdFromBody = req.body?.business_id;
    const businessIdFromAuth = req.headers['authorization']?.replace('Bearer ', '');
    const defaultBusinessId = process.env.BUSINESS_ID;
    
    // Log de todas las fuentes de business_id para diagnóstico
    console.log('🔍 GET business/config - Fuentes de business_id:');
    console.log(`  - Query param: ${businessIdFromQuery || 'no disponible'}`);
    console.log(`  - Headers: ${businessIdFromHeaders || 'no disponible'}`);
    console.log(`  - Body: ${businessIdFromBody || 'no disponible'}`);
    console.log(`  - Auth Header: ${businessIdFromAuth || 'no disponible'}`);
    console.log(`  - Default: ${defaultBusinessId || 'no disponible'}`);
    
    // Usar business_id en este orden de prioridad
    const businessId = businessIdFromQuery || businessIdFromHeaders || businessIdFromBody || businessIdFromAuth || defaultBusinessId;
    console.log(`  - ID final usado: ${businessId}`);
    
    if (!businessId) {
      return res.status(400).json({ 
        error: 'No se proporcionó un ID de negocio válido',
        message: 'El business_id es obligatorio' 
      });
    }
    
    console.log(`🔍 Obteniendo configuración para negocio: ${businessId}`);
    
    const { data, error } = await supabase
      .from('business_config')
      .select('*')
      .eq('id', businessId)
      .single();
    
    if (error) {
      console.error(`❌ Error al obtener configuración del negocio: ${JSON.stringify(error)}`);
      return res.status(500).json({ 
        error: error,
        message: 'Error al obtener la configuración del negocio' 
      });
    }
    
    if (!data) {
      return res.status(404).json({ 
        error: 'Configuración no encontrada',
        message: `No se encontró configuración para el negocio con ID: ${businessId}` 
      });
    }
    
    console.log(`✅ Configuración obtenida correctamente para negocio: ${businessId}`);
    
    // Enviamos la configuración completa (incluyendo assistant_instructions)
    res.json(data);
    
  } catch (error) {
    console.error(`❌ Error general en /api/business/config: ${error.message}`);
    res.status(500).json({ 
      error: error.message,
      message: 'Error interno del servidor al obtener la configuración' 
    });
  }
});

// ... existing code ...

/**
 * Endpoint para obtener detalles del asistente de OpenAI
 * @route GET /api/openai/assistant-details
 * @param {string} business_id - ID del negocio en la consulta
 * @returns {object} Detalles del asistente
 */
app.get('/api/openai/assistant-details', async (req, res) => {
  try {
    const businessId = req.query.business_id;
    
    if (!businessId) {
      return res.status(400).json({
        error: 'business_id es obligatorio',
        message: 'No se proporcionó un ID de negocio'
      });
    }
    
    console.log(`🔍 Obteniendo detalles del asistente OpenAI para negocio: ${businessId}`);
    
    // Obtener configuración del negocio
    const { data: config, error: configError } = await supabase
      .from('business_config')
      .select('*')
      .eq('id', businessId)
      .single();
    
    if (configError) {
      console.error(`❌ Error al obtener configuración del negocio: ${JSON.stringify(configError)}`);
      return res.status(500).json({
        error: configError,
        message: 'Error al obtener configuración del negocio'
      });
    }
    
    if (!config) {
      return res.status(404).json({
        error: 'Configuración no encontrada',
        message: 'No se encontró configuración para el negocio'
      });
    }
    
    // Verificar si existe assistant_id
    if (!config.openai_assistant_id) {
      return res.status(404).json({
        error: 'Asistente no configurado',
        message: 'No hay un asistente configurado para este negocio'
      });
    }
    
    // Obtener detalles del asistente desde OpenAI
    try {
      console.log(`🔄 Consultando API de OpenAI para el asistente: ${config.openai_assistant_id}`);
      
      const openai = new OpenAI({
        apiKey: config.openai_api_key || process.env.OPENAI_API_KEY
      });
      
      const assistant = await openai.beta.assistants.retrieve(config.openai_assistant_id);
      
      console.log(`✅ Datos obtenidos desde OpenAI para asistente: ${config.openai_assistant_id}`);
      
      // Sincronizar información del asistente con la base de datos
      const { error: updateError } = await supabase
        .from('business_config')
        .update({
          assistant_name: assistant.name,
          assistant_instructions: assistant.instructions
        })
        .eq('id', businessId);
      
      if (updateError) {
        console.error(`❌ Error al actualizar datos del asistente en DB: ${JSON.stringify(updateError)}`);
      } else {
        console.log(`✅ Datos del asistente sincronizados con la base de datos para negocio: ${businessId}`);
      }
      
      return res.json({
        id: assistant.id,
        name: assistant.name,
        instructions: assistant.instructions,
        description: assistant.description || '',
        model: assistant.model
      });
      
    } catch (openaiError) {
      console.error(`❌ Error al obtener detalles desde OpenAI: ${openaiError}`);
      
      // Si hay un error de autenticación, devolver datos locales
      if (openaiError.status === 401) {
        console.log(`⚠️ Error de autenticación con OpenAI. Usando datos locales.`);
        return res.json({
          id: config.openai_assistant_id,
          name: config.assistant_name || 'Asistente sin nombre',
          instructions: config.assistant_instructions || '',
          description: '',
          model: 'gpt-4-turbo',
          error: 'Error de autenticación con OpenAI'
        });
      }
      
      return res.status(500).json({
        error: openaiError.message,
        message: 'Error al obtener detalles del asistente desde OpenAI'
      });
    }
    
  } catch (error) {
    console.error(`❌ Error general en /api/openai/assistant-details: ${error.message}`);
    res.status(500).json({
      error: error.message,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * Endpoint para actualizar el asistente de OpenAI
 * @route POST /api/openai/update-assistant
 * @param {string} business_id - ID del negocio en la consulta
 * @param {object} body - Datos para actualizar el asistente
 * @returns {object} Resultado de la actualización
 */
app.post('/api/openai/update-assistant', async (req, res) => {
  try {
    const businessId = req.query.business_id || req.body.business_id;
    
    if (!businessId) {
      return res.status(400).json({
        error: 'business_id es obligatorio',
        message: 'No se proporcionó un ID de negocio'
      });
    }
    
    console.log(`🔍 Actualizando asistente OpenAI para negocio: ${businessId}`);
    console.log(`📝 Datos recibidos para actualización: ${JSON.stringify(req.body)}`);
    
    // Obtener configuración del negocio
    const { data: config, error: configError } = await supabase
      .from('business_config')
      .select('*')
      .eq('id', businessId)
      .single();
    
    if (configError) {
      console.error(`❌ Error al obtener configuración del negocio: ${JSON.stringify(configError)}`);
      return res.status(500).json({
        error: configError,
        message: 'Error al obtener configuración del negocio'
      });
    }
    
    if (!config.openai_assistant_id) {
      return res.status(404).json({
        error: 'Asistente no configurado',
        message: 'No hay un asistente configurado para este negocio'
      });
    }
    
    // CORRECCIÓN: Obtener datos del objeto assistant_data si existe
    const assistantData = req.body.assistant_data || req.body;
    
    // Preparar datos para enviar a OpenAI
    const updateData = {
      name: assistantData.name,
      instructions: assistantData.instructions
    };
    
    if (assistantData.description) {
      updateData.description = assistantData.description;
    }
    
    console.log(`🔄 Actualizando asistente en OpenAI: ${config.openai_assistant_id}`);
    console.log(`📝 Datos a enviar a OpenAI: ${JSON.stringify(updateData)}`);
    
    try {
      const openai = new OpenAI({
        apiKey: config.openai_api_key || process.env.OPENAI_API_KEY
      });
      
      const assistant = await openai.beta.assistants.update(
        config.openai_assistant_id,
        updateData
      );
      
      console.log(`✅ Asistente actualizado correctamente en OpenAI: ${assistant.id}`);
      
      // Actualizar información en la base de datos
      const dbUpdateData = {
        assistant_name: updateData.name,
        assistant_instructions: updateData.instructions
      };
      
      if (assistantData.vector_store_id) {
        dbUpdateData.vector_store_id = assistantData.vector_store_id;
      }
      
      const { error: updateError } = await supabase
        .from('business_config')
        .update(dbUpdateData)
        .eq('id', businessId);
      
      if (updateError) {
        console.error(`❌ Error al actualizar datos en la base de datos: ${JSON.stringify(updateError)}`);
        return res.status(500).json({
          error: updateError,
          message: 'Error al actualizar datos en la base de datos'
        });
      }
      
      return res.json({
        success: true,
        message: 'Asistente actualizado correctamente',
        assistant: assistant
      });
      
    } catch (openaiError) {
      console.error(`❌ Error al actualizar asistente en OpenAI: ${openaiError}`);
      return res.status(500).json({
        error: openaiError.message,
        message: 'Error al actualizar asistente en OpenAI'
      });
    }
    
  } catch (error) {
    console.error(`❌ Error general en /api/openai/update-assistant: ${error.message}`);
    res.status(500).json({
      error: error.message,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * Endpoint para obtener las palabras clave de notificación
 * @route GET /api/notifications/keywords
 * @param {string} business_id - ID del negocio en la consulta
 * @returns {object} Lista de palabras clave
 */
app.get('/api/notifications/keywords', async (req, res) => {
  try {
    const businessId = req.query.business_id;
    
    if (!businessId) {
      return res.status(400).json({
        error: 'business_id es obligatorio',
        message: 'No se proporcionó un ID de negocio'
      });
    }
    
    // Consultar palabras clave para el negocio (versión simplificada)
    // En una implementación completa, estas palabras clave vendrían de la base de datos
    const keywords = [
      '¡Perfecto! tu cita ha sido confirmada para',
      '¡Perfecto! un asesor te llamará',
      '¡Perfecto! un asesor te contactará',
      '¡Perfecto! una persona te contactará'
    ];
    
    res.json({
      business_id: businessId,
      keywords: keywords
    });
    
  } catch (error) {
    console.error(`❌ Error en /api/notifications/keywords: ${error.message}`);
    res.status(500).json({
      error: error.message,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * Endpoint para obtener el ID del asistente de OpenAI
 * @route GET /api/assistant/id
 * @param {string} business_id - ID del negocio en la consulta (opcional, usa el predeterminado si no se proporciona)
 * @returns {object} ID del asistente
 */
app.get('/api/assistant/id', async (req, res) => {
  try {
    const businessId = req.query.business_id || process.env.BUSINESS_ID;
    
    if (!businessId) {
      return res.status(400).json({
        error: 'No se proporcionó un ID de negocio válido',
        message: 'El business_id es obligatorio'
      });
    }
    
    console.log(`🔍 Obteniendo ID de asistente para negocio: ${businessId}`);
    
    const { data, error } = await supabase
      .from('business_config')
      .select('openai_assistant_id')
      .eq('id', businessId)
      .single();
    
    if (error) {
      console.error(`❌ Error al obtener ID de asistente: ${JSON.stringify(error)}`);
      return res.status(500).json({
        error: error,
        message: 'Error al obtener ID de asistente'
      });
    }
    
    if (!data || !data.openai_assistant_id) {
      return res.status(404).json({
        error: 'Asistente no configurado',
        message: 'No hay un asistente configurado para este negocio'
      });
    }
    
    console.log(`✅ ID de asistente obtenido: ${data.openai_assistant_id}`);
    
    res.json({
      business_id: businessId,
      assistant_id: data.openai_assistant_id
    });
    
  } catch (error) {
    console.error(`❌ Error general en /api/assistant/id: ${error.message}`);
    res.status(500).json({
      error: error.message,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * Endpoint para actualizar la configuración del asistente
 * @route POST /api/assistant
 * @param {string} business_id - ID del negocio (opcional, usa el predeterminado si no se proporciona)
 * @param {object} body - Datos para actualizar la configuración
 * @returns {object} Resultado de la actualización
 */
app.post('/api/assistant', async (req, res) => {
  try {
    const businessId = req.query.business_id || req.body.business_id || process.env.BUSINESS_ID;
    
    if (!businessId) {
      return res.status(400).json({
        error: 'No se proporcionó un ID de negocio válido',
        message: 'El business_id es obligatorio'
      });
    }
    
    console.log(`🔄 Actualizando configuración del asistente para negocio: ${businessId}`);
    
    const updateData = {};
    
    // Verificar qué campos actualizar
    if (req.body.name) updateData.assistant_name = req.body.name;
    if (req.body.instructions) updateData.assistant_instructions = req.body.instructions;
    if (req.body.knowledge) updateData.assistant_knowledge = req.body.knowledge;
    
    // Si no hay datos para actualizar, devolver error
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        error: 'No se proporcionaron datos para actualizar',
        message: 'Debe proporcionar al menos un campo para actualizar'
      });
    }
    
    // Actualizar en la base de datos
    const { data, error } = await supabase
      .from('business_config')
      .update(updateData)
      .eq('id', businessId)
      .select();
    
    if (error) {
      console.error(`❌ Error al actualizar configuración del asistente: ${JSON.stringify(error)}`);
      return res.status(500).json({
        error: error,
        message: 'Error al actualizar configuración del asistente'
      });
    }
    
    console.log(`✅ Configuración del asistente actualizada correctamente`);
    
    // Intentar actualizar en OpenAI
    try {
      // Obtener información del asistente
      const { data: config } = await supabase
        .from('business_config')
        .select('openai_api_key, openai_assistant_id')
        .eq('id', businessId)
        .single();
      
      if (config && config.openai_assistant_id) {
        // Preparar datos para OpenAI
        const openaiUpdateData = {};
        if (updateData.assistant_name) openaiUpdateData.name = updateData.assistant_name;
        if (updateData.assistant_instructions) openaiUpdateData.instructions = updateData.assistant_instructions;
        
        // Actualizar en OpenAI
        const openai = new OpenAI({
          apiKey: config.openai_api_key || process.env.OPENAI_API_KEY
        });
        
        await openai.beta.assistants.update(
          config.openai_assistant_id,
          openaiUpdateData
        );
        
        console.log(`✅ Asistente actualizado en OpenAI: ${config.openai_assistant_id}`);
      }
    } catch (openaiError) {
      console.error(`❌ Error al actualizar asistente en OpenAI: ${openaiError.message}`);
      // No interrumpimos el flujo, solo registramos el error
    }
    
    res.json({
      success: true,
      message: 'Configuración del asistente actualizada correctamente',
      data: data[0]
    });
    
  } catch (error) {
    console.error(`❌ Error general en /api/assistant: ${error.message}`);
    res.status(500).json({
      error: error.message,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * Endpoint para listar archivos de un Vector Store
 * @route GET /api/openai/list-files
 * @param {string} vector_store_id - ID del Vector Store en la consulta
 * @param {string} business_id - ID del negocio
 * @returns {object} Lista de archivos en el Vector Store
 */
app.get('/api/openai/list-files', async (req, res) => {
  try {
    const vectorStoreId = req.query.vector_store_id;
    const businessId = req.query.business_id;
    
    console.log(`🔍 Obteniendo archivos del Vector Store: ${vectorStoreId} para negocio: ${businessId}`);
    
    if (!vectorStoreId) {
      return res.status(400).json({
        success: false,
        error: 'vector_store_id es obligatorio',
        message: 'No se proporcionó un ID de Vector Store',
        vector_store_id: "",
        files: []
      });
    }
    
    if (!businessId) {
      return res.status(400).json({
        success: false,
        error: 'business_id es obligatorio',
        message: 'No se proporcionó un ID de negocio',
        vector_store_id: vectorStoreId,
        files: []
      });
    }
    
    // Obtener configuración del negocio para usar la API key correcta
    const { data: config, error: configError } = await supabase
      .from('business_config')
      .select('*')
      .eq('id', businessId)
      .single();
    
    if (configError) {
      console.error(`❌ Error al obtener configuración del negocio: ${JSON.stringify(configError)}`);
      return res.status(500).json({
        success: false,
        error: configError,
        message: 'Error al obtener configuración del negocio',
        vector_store_id: vectorStoreId,
        files: []
      });
    }
    
    // Usar la API key del negocio o la predeterminada
    const apiKey = config?.openai_api_key || process.env.OPENAI_API_KEY;
    const assistantId = config?.openai_assistant_id;
    
    const openai = new OpenAI({
      apiKey: apiKey
    });
    
    try {
      // Primero obtenemos todos los archivos disponibles
      console.log(`🔍 Obteniendo lista completa de archivos de OpenAI`);
      const fileList = await openai.files.list();
      
      let assistantFiles = [];
      let filesResult = [];
      
      // Si hay un ID de asistente configurado, intentamos obtener sus archivos específicos
      if (assistantId) {
        try {
          console.log(`🔍 Buscando archivos asociados al asistente: ${assistantId}`);
          const assistant = await openai.beta.assistants.retrieve(assistantId);
          
          if (assistant.file_ids && assistant.file_ids.length > 0) {
            console.log(`✅ El asistente tiene ${assistant.file_ids.length} archivos asociados`);
            assistantFiles = assistant.file_ids;
            
            // Obtener detalles de cada archivo asociado al asistente
            const filesPromises = assistant.file_ids.map(fileId => 
              openai.files.retrieve(fileId).catch(err => {
                console.log(`⚠️ Error al obtener detalles del archivo ${fileId}: ${err.message}`);
                return null;
              })
            );
            
            const fetchedFiles = await Promise.all(filesPromises);
            filesResult = fetchedFiles.filter(file => file !== null);
            
            console.log(`✅ Recuperados ${filesResult.length} archivos del asistente`);
          } else {
            console.log(`⚠️ El asistente no tiene archivos asociados`);
          }
        } catch (assistantError) {
          console.error(`❌ Error al obtener asistente: ${assistantError.message}`);
          
          // Si falla la recuperación del asistente, probamos obtener archivos por vector_store_id
          console.log(`🔍 Intentando buscar archivos por otros medios después del error del asistente`);
        }
      }
      
      // Si no encontramos archivos a través del asistente, o no hay asistente,
      // buscamos archivos que puedan estar relacionados con el vector_store_id
      if (filesResult.length === 0) {
        console.log(`🔍 Buscando archivos por propósito 'assistants' o por coincidencia de nombre`);
        
        // Filtramos archivos por propósito 'assistants' y por posible coincidencia en metadata
        filesResult = fileList.data.filter(file => {
          // Primero verificamos el propósito correcto
          if (file.purpose !== "assistants") return false;
          
          // Luego buscamos posibles coincidencias por nombre o algún otro criterio
          // Esta es una aproximación simple, ya que OpenAI no expone metadata que permita
          // vincular directamente archivos con vector stores específicos
          return true;
        });
        
        console.log(`✅ Encontrados ${filesResult.length} archivos con propósito 'assistants'`);
      }
      
      // Retornamos la lista de archivos encontrados
      return res.json({
        success: true,
        vector_store_id: vectorStoreId,
        files: filesResult.map(file => ({
          id: file.id,
          filename: file.filename,
          bytes: file.bytes,
          created_at: file.created_at,
          purpose: file.purpose
        }))
      });
      
    } catch (openaiError) {
      console.error(`❌ Error al obtener archivos desde OpenAI: ${openaiError}`);
      return res.status(500).json({
        success: false,
        error: openaiError.message,
        message: 'Error al obtener la lista de archivos desde OpenAI',
        vector_store_id: vectorStoreId,
        files: []
      });
    }
    
  } catch (error) {
    console.error(`❌ Error general en /api/openai/list-files: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Error interno del servidor',
      vector_store_id: req.query.vector_store_id || "",
      files: []
    });
  }
});

// Función handler compartida para manejar la subida de archivos
const uploadFileHandler = async (req, res) => {
  try {
    // Buscar business_id en query params (URL) o en el body (FormData)
    const businessId = req.query.business_id || req.body.business_id;
    
    console.log(`📤 Intento de subida de archivo - business_id en query: ${req.query.business_id}, business_id en body: ${req.body.business_id}`);
    console.log(`📤 business_id final utilizado: ${businessId}`);
    
    // Inspeccionar la petición para debugging
    console.log(`📤 DEBUG - Contenido de req.files:`, req.files ? Object.keys(req.files) : 'undefined');
    console.log(`📤 DEBUG - Contenido de req.body:`, req.body);
    if (req.files) {
      console.log(`📤 DEBUG - Nombres de archivos disponibles:`, Object.keys(req.files));
    }
    
    if (!businessId) {
      return res.status(400).json({
        success: false,
        error: 'business_id es obligatorio',
        message: 'No se proporcionó un ID de negocio'
      });
    }

    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No se encontró archivo para subir',
        message: 'Debe proporcionar un archivo para subir'
      });
    }
    
    // Obtener el archivo del request
    let uploadedFile;
    if (req.files.file) {
      uploadedFile = req.files.file;
    } else if (req.files.files) { // Comprobar si el campo se llama 'files' (plural)
      uploadedFile = req.files.files;
      console.log(`📤 DEBUG - Se encontró archivo con clave 'files' (plural): ${uploadedFile.name}`);
    } else {
      // Buscar el archivo en cualquier otra clave
      console.log(`📤 DEBUG - No se encontró archivo con clave 'file' ni 'files', revisando otras claves...`);
      const fileKeys = Object.keys(req.files);
      if (fileKeys.length > 0) {
        uploadedFile = req.files[fileKeys[0]];
        console.log(`📤 DEBUG - Se encontró archivo con clave '${fileKeys[0]}': ${uploadedFile.name}`);
      }
    }
    
    if (!uploadedFile) {
      return res.status(400).json({
        success: false,
        error: 'No se encontró archivo válido para subir',
        message: 'Debe proporcionar un archivo válido para subir'
      });
    }
    
    // Obtener Vector Store ID del request
    const vectorStoreId = req.query.vector_store_id || req.body.vector_store_id;
    if (!vectorStoreId) {
      return res.status(400).json({
        success: false,
        error: 'vector_store_id es obligatorio',
        message: 'No se proporcionó un ID de Vector Store'
      });
    }
    
    console.log(`📤 Subiendo archivo "${uploadedFile.name}" para el negocio: ${businessId} al vector store: ${vectorStoreId}`);
    
    // Crear ruta temporal para el archivo
    const tempFilePath = path.join(__dirname, 'temp', uploadedFile.name);
    
    // Asegurar que el directorio temp existe
    try {
      await fs.promises.mkdir(path.dirname(tempFilePath), { recursive: true });
    } catch (mkdirError) {
      console.error(`❌ Error al crear directorio temporal: ${mkdirError.message}`);
    }
    
    // Guardar archivo temporalmente
    try {
      await uploadedFile.mv(tempFilePath);
    } catch (moveError) {
      console.error(`❌ Error al mover archivo a directorio temporal: ${moveError.message}`);
      return res.status(500).json({
        success: false,
        error: 'Error al guardar archivo temporalmente',
        message: moveError.message
      });
    }
    
    // Buscar la configuración del negocio para obtener el ID del asistente
    const { data: config, error: configError } = await supabase
      .from('business_config')
      .select('*')
      .eq('id', businessId)
      .single();
    
    if (configError) {
      console.error(`❌ Error al buscar configuración: ${configError.message}`);
      return res.status(500).json({
        success: false,
        error: 'Error al buscar configuración',
        message: configError.message
      });
    }
    
    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'No se encontró configuración para el negocio',
        message: 'No se encontró configuración para el negocio'
      });
    }
    
    // Inicializar cliente de OpenAI
    let openai;
    try {
      // Asegurar que tenemos una API key válida (preferentemente la del negocio)
      const apiKey = config.openai_api_key || process.env.OPENAI_API_KEY;
      
      if (!apiKey) {
        throw new Error('No se encontró API key de OpenAI ni en la configuración del negocio ni en las variables de entorno');
      }
      
      // Log para depuración de API Key (mostrar primeros y últimos 3 caracteres)
      const apiKeyPreview = `${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 3)}`;
      console.log(`🔑 DEBUG - Inicializando cliente OpenAI con API key: ${apiKeyPreview}`);
      
      // La API key ya incluye la organización (sk-org o sk-proj), no necesitamos especificar organización
      console.log(`ℹ️ La API key de OpenAI (${apiKey.substring(0, 8)}...) ya está asociada a una organización específica`);
      
      // Importar OpenAI si no está disponible globalmente
      const { OpenAI } = require('openai');
      
      // Configurar OpenAI con la API key del negocio
      openai = new OpenAI({ 
        apiKey: apiKey
      });
      
      if (!openai) {
        throw new Error('No se pudo crear la instancia del cliente OpenAI');
      }
      
      console.log(`✅ Cliente OpenAI inicializado correctamente con la API key ${config.openai_api_key ? 'del negocio' : 'global'}`);
    } catch (openaiInitError) {
      console.error(`❌ Error al inicializar cliente OpenAI: ${openaiInitError.message}`);
      return res.status(500).json({
        success: false,
        error: 'Error al inicializar el cliente de OpenAI',
        message: openaiInitError.message
      });
    }
    
    // FLUJO SIMPLIFICADO: Solo nos preocupamos por la subida al vector store
    let fileId;
    try {
      // 1. Subir el archivo a OpenAI
      console.log(`🔄 PASO 1: Subiendo archivo a OpenAI...`);
      
      if (!fs.existsSync(tempFilePath)) {
        throw new Error(`El archivo temporal no existe en la ruta: ${tempFilePath}`);
      }
      
      // Verificar que el cliente OpenAI tiene el método files.create
      if (!openai.files || typeof openai.files.create !== 'function') {
        throw new Error('El método openai.files.create no está disponible en el cliente OpenAI. Verificar importación OpenAI.');
      }
      
      const fileStream = fs.createReadStream(tempFilePath);
      
      const fileUpload = await openai.files.create({
        file: fileStream,
        purpose: "assistants"
      });
      
      fileId = fileUpload.id;
      console.log(`✅ PASO 1 completado: Archivo subido a OpenAI con ID: ${fileId}`);
      
      // 2. Verificar el Vector Store actual o crear uno nuevo si no existe
      console.log(`🔄 PASO 2: Verificando Vector Store ${vectorStoreId}...`);
      let finalVectorStoreId = vectorStoreId;
      let vectorStoreCreated = false;
      
      try {
        // Verificar si existe el vector store con la API disponible
        if (openai.vectorStores && typeof openai.vectorStores.retrieve === 'function') {
          // Usar API directa
          const vectorStore = await openai.vectorStores.retrieve(vectorStoreId);
          console.log(`✅ PASO 2 completado: Vector Store encontrado: ${vectorStoreId}`);
        } else if (openai.beta && openai.beta.vectorStores && typeof openai.beta.vectorStores.retrieve === 'function') {
          // Usar beta API
          const vectorStore = await openai.beta.vectorStores.retrieve(vectorStoreId);
          console.log(`✅ PASO 2 completado: Vector Store encontrado: ${vectorStoreId}`);
        } else {
          console.log(`⚠️ No se encontró método para verificar Vector Store, asumiendo que existe`);
        }
      } catch (e) {
        if (e.status === 404) {
          // Si no existe, crear nuevo vector store
          console.log(`⚠️ Vector Store no encontrado. Creando nuevo Vector Store...`);
          
          try {
            // Intentar crear el vector store con la API disponible
            if (openai.vectorStores && typeof openai.vectorStores.create === 'function') {
              const newVectorStore = await openai.vectorStores.create({
                name: `Vector Store para ${businessId}`,
                expires_after: null // No expira
              });
              finalVectorStoreId = newVectorStore.id;
              vectorStoreCreated = true;
            } else if (openai.beta && openai.beta.vectorStores && typeof openai.beta.vectorStores.create === 'function') {
              const newVectorStore = await openai.beta.vectorStores.create({
                name: `Vector Store para ${businessId}`,
                expires_after: null // No expira
              });
              finalVectorStoreId = newVectorStore.id;
              vectorStoreCreated = true;
            } else {
              throw new Error('No se encontró método para crear Vector Store');
            }
            
            console.log(`✅ Vector Store creado con ID: ${finalVectorStoreId}`);
            
            // Actualizar configuración con el nuevo vector store
            if (finalVectorStoreId !== vectorStoreId) {
              const { error: updateError } = await supabase
                .from('business_config')
                .update({ vector_store_id: finalVectorStoreId })
                .eq('id', businessId);
              
              if (updateError) {
                console.error(`⚠️ Error al actualizar vector_store_id en la configuración: ${updateError.message}`);
              } else {
                console.log(`✅ Vector Store ID actualizado en la configuración: ${finalVectorStoreId}`);
              }
            }
          } catch (createError) {
            console.error(`❌ Error al crear Vector Store: ${createError.message}`);
            throw createError; // Propagar el error
          }
        } else {
          // Otro tipo de error
          console.error(`❌ Error al verificar Vector Store: ${e.message}`);
          throw e; // Propagar el error
        }
      }
      
      // 3. Asociar el archivo al Vector Store
      console.log(`🔄 PASO 3: Vinculando archivo al Vector Store ${finalVectorStoreId}...`);
      
      // Intentar primero con el método directo disponible
      try {
        // Intentar con la API directa primero
        if (openai.vectorStores && openai.vectorStores.files && typeof openai.vectorStores.files.create === 'function') {
          await openai.vectorStores.files.create(
            finalVectorStoreId,
            { file_id: fileId }
          );
          console.log(`✅ PASO 3 completado: Archivo vinculado al Vector Store: ${finalVectorStoreId}`);
        } 
        // Si no está disponible, intentar con la API beta
        else if (openai.beta && openai.beta.vectorStores && openai.beta.vectorStores.files && 
            typeof openai.beta.vectorStores.files.create === 'function') {
          await openai.beta.vectorStores.files.create(
            finalVectorStoreId,
            { file_id: fileId }
          );
          console.log(`✅ PASO 3 completado: Archivo vinculado al Vector Store: ${finalVectorStoreId}`);
        }
        // Método alternativo con fileBatches si lo anterior no está disponible
        else if (openai.vectorStores && openai.vectorStores.fileBatches && 
                typeof openai.vectorStores.fileBatches.create === 'function') {
          const fileVectorBatch = await openai.vectorStores.fileBatches.create(
            finalVectorStoreId,
            { file_ids: [fileId] }
          );
          console.log(`✅ PASO 3 completado (usando batch): Batch creado para el Vector Store`);
        }
        // Último intento con la API beta para fileBatches
        else if (openai.beta && openai.beta.vectorStores && openai.beta.vectorStores.fileBatches && 
                typeof openai.beta.vectorStores.fileBatches.create === 'function') {
          const fileVectorBatch = await openai.beta.vectorStores.fileBatches.create(
            finalVectorStoreId,
            { file_ids: [fileId] }
          );
          console.log(`✅ PASO 3 completado (usando batch beta): Batch creado para el Vector Store`);
        }
        else {
          throw new Error('No se encontró ningún método para vincular el archivo al Vector Store');
        }
      } catch (linkError) {
        console.error(`❌ Error al vincular archivo al Vector Store: ${linkError.message}`);
        throw linkError; // Propagar el error
      }
      
      // 4. Intentar asociar el archivo al Asistente solo si está configurado
      let assistantResponse = null;
      if (config.openai_assistant_id) {
        try {
          console.log(`🔄 PASO OPCIONAL: Intentando asociar archivo al asistente ${config.openai_assistant_id}...`);
          
          // Verificar si existe el asistente primero
          let assistant;
          let assistantExists = false;
          
          try {
            if (openai.assistants && typeof openai.assistants.retrieve === 'function') {
              assistant = await openai.assistants.retrieve(config.openai_assistant_id);
              assistantExists = true;
            } else if (openai.beta && openai.beta.assistants && typeof openai.beta.assistants.retrieve === 'function') {
              assistant = await openai.beta.assistants.retrieve(config.openai_assistant_id);
              assistantExists = true;
            }
          } catch (assistantCheckError) {
            if (assistantCheckError.status === 404) {
              console.log(`⚠️ Asistente no encontrado: ${config.openai_assistant_id}`);
              assistantExists = false;
              assistantResponse = {
                success: false, 
                message: `El asistente con ID ${config.openai_assistant_id} no existe en esta cuenta de OpenAI`
              };
            } else {
              console.error(`❌ Error al verificar asistente: ${assistantCheckError.message}`);
              assistantExists = false;
              assistantResponse = {
                success: false,
                message: `Error al verificar asistente: ${assistantCheckError.message}`
              };
            }
          }
          
          // Solo intentar asociar si el asistente existe
          if (assistantExists) {
            try {
              if (openai.assistants && openai.assistants.files && typeof openai.assistants.files.create === 'function') {
                await openai.assistants.files.create(
                  config.openai_assistant_id,
                  { file_id: fileId }
                );
                console.log(`✅ PASO OPCIONAL completado: Archivo asociado al asistente: ${config.openai_assistant_id}`);
                assistantResponse = {
                  success: true,
                  message: `Archivo asociado al asistente ${config.openai_assistant_id}`
                };
              } else if (openai.beta && openai.beta.assistants && openai.beta.assistants.files && 
                        typeof openai.beta.assistants.files.create === 'function') {
                await openai.beta.assistants.files.create(
                  config.openai_assistant_id,
                  { file_id: fileId }
                );
                console.log(`✅ PASO OPCIONAL completado: Archivo asociado al asistente: ${config.openai_assistant_id}`);
                assistantResponse = {
                  success: true,
                  message: `Archivo asociado al asistente ${config.openai_assistant_id}`
                };
              } else {
                console.log(`⚠️ No se encontró método para asociar archivo al asistente`);
                assistantResponse = {
                  success: false,
                  message: "No se encontró método para asociar archivo al asistente"
                };
              }
            } catch (associateError) {
              console.error(`❌ Error al asociar archivo al asistente: ${associateError.message}`);
              assistantResponse = {
                success: false,
                message: `Error al asociar archivo al asistente: ${associateError.message}`
              };
            }
          }
        } catch (e) {
          console.error(`❌ Error en el paso opcional: ${e.message}`);
          assistantResponse = {
            success: false,
            message: `Error en el paso opcional: ${e.message}`
          };
        }
      } else {
        console.log(`ℹ️ No hay asistente configurado para este negocio, omitiendo paso de asociación`);
        assistantResponse = {
          success: false,
          message: "No hay asistente configurado para este negocio"
        };
      }
      
      // Limpiar archivo temporal
      try {
        fs.unlinkSync(tempFilePath);
        console.log(`🧹 Archivo temporal eliminado: ${tempFilePath}`);
      } catch (deleteError) {
        console.error(`⚠️ No se pudo eliminar el archivo temporal: ${deleteError.message}`);
      }
      
      // Responder exitosamente
      return res.status(200).json({
        success: true,
        message: vectorStoreCreated 
          ? `Archivo subido y vector store creado exitosamente` 
          : `Archivo subido exitosamente al vector store`,
        file_id: fileId,
        vector_store_id: finalVectorStoreId,
        vector_store_created: vectorStoreCreated,
        filename: uploadedFile.name,
        assistant_operation: assistantResponse || { 
          success: false, 
          message: "No se intentó asociar con asistente" 
        }
      });
      
    } catch (error) {
      console.error(`❌ Error en proceso de subida: ${error.message}`);
      
      // Limpiar archivo temporal en caso de error
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
          console.log(`🧹 Archivo temporal eliminado después de error: ${tempFilePath}`);
        }
      } catch (cleanupError) {
        console.error(`⚠️ Error al limpiar archivo temporal: ${cleanupError.message}`);
      }
      
      // Si llegamos a subir el archivo pero falló otro paso, responder con un error pero incluir el ID del archivo
      if (fileId) {
        return res.status(500).json({
          success: false,
          partial_success: true,
          message: `El archivo fue subido a OpenAI (ID: ${fileId}) pero ocurrió un error en otro paso`,
          error: error.message,
          file_id: fileId
        });
      }
      
      return res.status(500).json({
        success: false,
        error: error.message,
        message: 'Error en el proceso de subida de archivo'
      });
    }
  } catch (generalError) {
    console.error(`❌ Error general en endpoint de subida: ${generalError.message}`);
    return res.status(500).json({
      success: false,
      error: generalError.message,
      message: 'Error general en endpoint de subida'
    });
  }
};

/**
 * Endpoint para subir archivos al Vector Store de OpenAI
 * @route POST /api/openai/upload-file
 * @param {string} business_id - ID del negocio
 * @param {file} file - Archivo a subir
 * @returns {object} Resultado de la subida
 */
app.post('/api/openai/upload-file', uploadFileHandler);

/**
 * Endpoint para subir archivos al Vector Store de OpenAI (alias para compatibilidad)
 * @route POST /api/openai/upload-files
 * @param {string} business_id - ID del negocio
 * @param {file} file - Archivo a subir
 * @returns {object} Resultado de la subida
 */
app.post('/api/openai/upload-files', uploadFileHandler);

// Eliminar la redirección anterior
// app.post('/api/openai/upload-files', async (req, res) => {
//   console.log('📥 Redirigiendo de /api/openai/upload-files a /api/openai/upload-file');
//   // Simplemente redirigimos al endpoint singular
//   app.handle(req, res, () => {
//     req.url = '/api/openai/upload-file';
//     app.handle(req, res);
//   });
// });

// ... existing code ...

/**
 * Endpoint para eliminar un archivo del Vector Store de OpenAI
 * @route DELETE /api/openai/delete-file
 * @param {string} business_id - ID del negocio
 * @param {string} file_id - ID del archivo a eliminar
 * @returns {object} Resultado de la eliminación
 */
app.delete('/api/openai/delete-file', async (req, res) => {
  try {
    // Buscar business_id y file_id tanto en query params como en body
    const businessId = req.query.business_id || req.body.business_id;
    const fileId = req.query.file_id || req.body.file_id;
    
    console.log(`🗑️ Intento de eliminación de archivo - business_id: ${businessId}, file_id: ${fileId}`);
    console.log(`🗑️ DEBUG - Business ID en query: ${req.query.business_id}, Business ID en body: ${req.body.business_id}`);
    console.log(`🗑️ DEBUG - File ID en query: ${req.query.file_id}, File ID en body: ${req.body.file_id}`);
    
    if (!businessId) {
      return res.status(400).json({
        success: false,
        error: 'business_id es obligatorio',
        message: 'No se proporcionó un ID de negocio'
      });
    }
    
    if (!fileId) {
      return res.status(400).json({
        success: false,
        error: 'file_id es obligatorio',
        message: 'No se proporcionó un ID de archivo'
      });
    }
    
    console.log(`🗑️ Eliminando archivo ${fileId} para el negocio: ${businessId}`);
    
    // Obtener configuración del negocio
    const { data: config, error: configError } = await supabase
      .from('business_config')
      .select('openai_api_key, openai_assistant_id')
      .eq('id', businessId)
      .single();
    
    if (configError) {
      console.error(`❌ Error al obtener configuración del negocio: ${JSON.stringify(configError)}`);
      return res.status(500).json({
        success: false,
        error: configError,
        message: 'Error al obtener configuración del negocio'
      });
    }
    
    const apiKey = config?.openai_api_key || process.env.OPENAI_API_KEY;
    const assistantId = config?.openai_assistant_id;
    
    const openai = new OpenAI({
      apiKey: apiKey
    });
    
    try {
      // Si hay un asistente configurado, primero desasociamos el archivo
      if (assistantId) {
        try {
          const assistant = await openai.beta.assistants.retrieve(assistantId);
          
          if (assistant.file_ids && assistant.file_ids.includes(fileId)) {
            // Filtrar el file_id a eliminar
            const updatedFileIds = assistant.file_ids.filter(id => id !== fileId);
            
            // Actualizar el asistente
            await openai.beta.assistants.update(assistantId, {
              file_ids: updatedFileIds
            });
            
            console.log(`✅ Archivo desasociado del asistente: ${assistantId}`);
          }
        } catch (assistantError) {
          console.error(`❌ Error al desasociar archivo del asistente: ${assistantError}`);
          // Continuamos aunque falle la desasociación
        }
      }
      
      // Eliminar el archivo de OpenAI
      await openai.files.del(fileId);
      
      console.log(`✅ Archivo eliminado correctamente: ${fileId}`);
      
      // Responder con éxito
      return res.json({
        success: true,
        message: 'Archivo eliminado exitosamente',
        file_id: fileId
      });
      
    } catch (openaiError) {
      console.error(`❌ Error al eliminar archivo de OpenAI: ${openaiError}`);
      return res.status(500).json({
        success: false,
        error: openaiError.message,
        message: 'Error al eliminar archivo de OpenAI'
      });
    }
    
  } catch (error) {
    console.error(`❌ Error general en /api/openai/delete-file: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Error interno del servidor'
    });
  }
});

// ... existing code ...

/**
 * Endpoint de diagnóstico para mostrar la estructura del cliente OpenAI
 * @route GET /api/openai/diagnose
 */
app.get('/api/openai/diagnose', async (req, res) => {
  try {
    console.log('🔍 Realizando diagnóstico del cliente OpenAI');
    const businessId = req.query.business_id;
    
    if (businessId) {
      console.log(`🏢 Realizando diagnóstico para negocio específico: ${businessId}`);
    }
    
    // Verificar la versión de OpenAI instalada
    let openaiPackageVersion = 'desconocida';
    try {
      // Intentar cargar el package.json directamente desde node_modules
      const fs = require('fs');
      const path = require('path');
      const packagePath = path.join(__dirname, 'node_modules', 'openai', 'package.json');
      
      if (fs.existsSync(packagePath)) {
        const packageContent = fs.readFileSync(packagePath, 'utf8');
        const packageJson = JSON.parse(packageContent);
        openaiPackageVersion = packageJson.version;
      } else {
        throw new Error('No se encontró el archivo package.json de OpenAI');
      }
      
      console.log(`📦 Versión del paquete OpenAI: ${openaiPackageVersion}`);
    } catch (pkgError) {
      console.error(`⚠️ No se pudo determinar la versión del paquete OpenAI: ${pkgError.message}`);
    }
    
    // Obtener información del negocio si se proporciona un business_id
    let assistantId = null;
    let vectorStoreId = null;
    
    if (businessId) {
      try {
        const { data: config, error } = await supabase
          .from('business_config')
          .select('openai_assistant_id, vector_store_id')
          .eq('id', businessId)
          .single();
        
        if (error) {
          console.error(`❌ Error al obtener configuración: ${error.message}`);
        } else if (config) {
          assistantId = config.openai_assistant_id;
          vectorStoreId = config.vector_store_id;
          
          console.log(`🤖 ID de asistente configurado: ${assistantId || 'no configurado'}`);
          console.log(`📚 ID de Vector Store configurado: ${vectorStoreId || 'no configurado'}`);
        }
      } catch (err) {
        console.error(`❌ Error al consultar configuración: ${err.message}`);
      }
    }
    
    // Verificar la variable de entorno OPENAI_API_KEY
    const envApiKey = process.env.OPENAI_API_KEY;
    
    // Validar el formato de la API key
    let apiKeyFormatMessage = 'No configurada';
    if (envApiKey) {
      if (envApiKey.startsWith('sk-')) {
        apiKeyFormatMessage = '✅ Formato correcto';
        
        if (envApiKey.startsWith('sk-org-')) {
          apiKeyFormatMessage += ' (API key específica de organización)';
        } else if (envApiKey.startsWith('sk-proj-')) {
          apiKeyFormatMessage += ' (API key de proyecto)';
        } else if (envApiKey.startsWith('sk-ant-')) {
          apiKeyFormatMessage += ' (API key de anotación)';
        }
      } else {
        apiKeyFormatMessage = '❌ Formato incorrecto (debería comenzar con "sk-")';
      }
    }
    
    // Variables para tests de conexión
    let apiConnectionTest = { success: false, message: 'No se realizó prueba de conexión' };
    let assistantCheck = { success: false, message: 'No se realizó prueba de asistente' };
    let vectorStoreCheck = { success: false, message: 'No se realizó prueba de vector store' };
    let clientStructure = { object_keys: 'No inicializado' };
    let functionCheck = {};
    
    // Verificar si hay un cliente OpenAI existente
    let openai;
    try {
      // Crear un cliente OpenAI para pruebas
      const { OpenAI } = require('openai');
      openai = new OpenAI({
        apiKey: envApiKey
      });
      
      clientStructure.object_keys = Object.keys(openai).join(', ');
      
      // Si hay cliente, probar conectividad
      try {
        const models = await openai.models.list();
        apiConnectionTest = {
          success: true,
          models_count: models.data.length,
          message: `Conexión exitosa. Se encontraron ${models.data.length} modelos disponibles.`
        };
        
        // Probar si podemos obtener el asistente para validar la API key
        if (assistantId) {
          try {
            // Determinar la función correcta para recuperar el asistente
            let assistant;
            if (openai.beta && openai.beta.assistants && typeof openai.beta.assistants.retrieve === 'function') {
              assistant = await openai.beta.assistants.retrieve(assistantId);
              assistantCheck = { success: true, method: 'beta' };
            } else if (openai.assistants && typeof openai.assistants.retrieve === 'function') {
              assistant = await openai.assistants.retrieve(assistantId);
              assistantCheck = { success: true, method: 'direct' };
            } else {
              assistantCheck = { 
                success: false, 
                message: 'No se encontró el método para acceder a los asistentes' 
              };
            }
          } catch (assistantErr) {
            assistantCheck = { 
              success: false, 
              message: assistantErr.message,
              status: assistantErr.status
            };
          }
        }
        
        // Verificar el vector store si está configurado
        if (vectorStoreId) {
          try {
            if (openai.beta && openai.beta.vectorStores && typeof openai.beta.vectorStores.retrieve === 'function') {
              const vectorStore = await openai.beta.vectorStores.retrieve(vectorStoreId);
              vectorStoreCheck = { success: true, method: 'beta' };
            } else if (openai.vectorStores && typeof openai.vectorStores.retrieve === 'function') {
              const vectorStore = await openai.vectorStores.retrieve(vectorStoreId);
              vectorStoreCheck = { success: true, method: 'direct' };
            } else {
              vectorStoreCheck = { 
                success: false, 
                message: 'No se encontró el método para acceder a los vector stores' 
              };
            }
          } catch (vectorStoreErr) {
            vectorStoreCheck = { 
              success: false, 
              message: vectorStoreErr.message,
              status: vectorStoreErr.status
            };
          }
        }
        
      } catch (openaiError) {
        console.error(`❌ Error al obtener detalles desde OpenAI: ${openaiError}`);
        apiConnectionTest = {
          success: false,
          message: `Error al obtener detalles desde OpenAI: ${openaiError.message}`
        };
      }
      
      // Verificar la presencia de funciones importantes
      functionCheck = {
        beta_assistants: !!openai.beta?.assistants,
        direct_assistants: !!openai.assistants,
        beta_vector_stores: !!openai.beta?.vectorStores,
        direct_vector_stores: !!openai.vectorStores,
        files_api: !!openai.files
      };
      
    } catch (initError) {
      console.error(`❌ Error al inicializar cliente OpenAI de prueba: ${initError}`);
      clientStructure = { error: initError.message };
    }
    
    // Responder con diagnóstico
    res.status(200).json({
      success: true,
      openai_version: openaiPackageVersion,
      api_key_configured: !!envApiKey,
      api_key_prefix: envApiKey ? envApiKey.substring(0, 7) : null,
      api_key_format: apiKeyFormatMessage,
      api_connection_test: apiConnectionTest,
      business_id: businessId || null,
      assistant: assistantId ? {
        id: assistantId,
        check: assistantCheck
      } : null,
      vector_store: vectorStoreId ? {
        id: vectorStoreId,
        check: vectorStoreCheck
      } : null,
      client_structure: clientStructure,
      function_check: functionCheck,
      message: 'Diagnóstico completado'
    });
  } catch (error) {
    console.error(`❌ Error general en diagnóstico: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Error al realizar diagnóstico'
    });
  }
});

/**
 * Endpoint para obtener palabras clave de notificaciones de un negocio
 * @route GET /api/notifications/keywords
 */
app.get('/api/notifications/keywords', async (req, res) => {
  try {
    // Obtener business_id del query param
    const businessId = req.query.business_id;
    
    if (!businessId) {
      return res.status(400).json({
        success: false,
        error: 'business_id es requerido',
        message: 'Debe proporcionar un ID de negocio'
      });
    }
    
    console.log(`📥 GET /api/notifications/keywords - Consultando palabras clave para negocio: ${businessId}`);
    
    // Consultar palabras clave para este negocio
    const { data, error } = await supabase
      .from('notification_keywords')
      .select('*')
      .eq('business_id', businessId);
    
    if (error) {
      console.error(`❌ Error consultando palabras clave: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: error.message,
        message: 'Error al consultar palabras clave de notificaciones'
      });
    }
    
    // Devolver las palabras clave
    return res.status(200).json({
      success: true,
      data: data || [],
      message: `Se encontraron ${data ? data.length : 0} palabras clave`
    });
  } catch (error) {
    console.error(`❌ Error en GET /api/notifications/keywords: ${error.message}`);
    // Asegurar que siempre devolvemos JSON, incluso en caso de error inesperado
    return res.status(500).json({
      success: false,
      error: error.message || 'Error interno del servidor',
      message: 'Error interno del servidor al procesar la solicitud'
    });
  }
});

/**
 * Endpoint para agregar una palabra clave de notificación
 * @route POST /api/notifications/keywords
 */
app.post('/api/notifications/keywords', async (req, res) => {
  try {
    // Obtener datos de la solicitud
    const { business_id, keyword, enabled = true } = req.body;
    
    // Validar campos requeridos
    if (!business_id) {
      return res.status(400).json({
        success: false,
        error: 'business_id es requerido',
        message: 'Debe proporcionar un ID de negocio'
      });
    }
    
    if (!keyword) {
      return res.status(400).json({
        success: false,
        error: 'keyword es requerido',
        message: 'Debe proporcionar una palabra clave'
      });
    }
    
    console.log(`📥 POST /api/notifications/keywords - Agregando palabra clave "${keyword}" para negocio: ${business_id}`);
    
    // Verificar si la palabra clave ya existe para evitar duplicados
    const { data: existingKeywords, error: checkError } = await supabase
      .from('notification_keywords')
      .select('*')
      .eq('business_id', business_id)
      .eq('keyword', keyword);
    
    if (checkError) {
      console.error(`❌ Error verificando palabra clave existente: ${checkError.message}`);
      return res.status(500).json({
        success: false,
        error: checkError.message,
        message: 'Error al verificar si la palabra clave ya existe'
      });
    }
    
    // Si la palabra clave ya existe, informar al cliente
    if (existingKeywords && existingKeywords.length > 0) {
      return res.status(409).json({
        success: false,
        error: "La palabra clave ya existe"
      });
    }
    
    // Insertar la nueva palabra clave
    const { data, error } = await supabase
      .from('notification_keywords')
      .insert({
        business_id,
        keyword,
        enabled
      })
      .select();
    
    if (error) {
      console.error(`❌ Error insertando palabra clave: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: error.message,
        message: 'Error al agregar la palabra clave'
      });
    }
    
    // Limpiar caché de palabras clave si existe la función
    if (typeof notificationModule.clearKeywordsCache === 'function') {
      notificationModule.clearKeywordsCache(business_id);
    }
    
    // Devolver la palabra clave agregada con la propiedad 'keyword'
    return res.status(201).json({
      success: true,
      keyword: data[0]
    });
  } catch (error) {
    console.error(`❌ Error en POST /api/notifications/keywords: ${error.message}`);
    // Asegurar que siempre devolvemos JSON, incluso en caso de error inesperado
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Error interno del servidor',
      message: 'Error interno del servidor al procesar la solicitud'
    });
  }
});

/**
 * Endpoint para obtener TODAS las palabras clave de notificaciones de un negocio (activas e inactivas)
 * @route GET /api/notifications/keywords-all
 */
app.get('/api/notifications/keywords-all', async (req, res) => {
  try {
    // Obtener business_id del query param
    const businessId = req.query.business_id;
    
    if (!businessId) {
      return res.status(400).json({
        success: false,
        error: 'business_id es requerido',
        message: 'Debe proporcionar un ID de negocio'
      });
    }
    
    console.log(`📥 GET /api/notifications/keywords-all - Consultando TODAS las palabras clave para negocio: ${businessId}`);
    
    // Consultar todas las palabras clave para este negocio (sin filtrar por enabled)
    const { data, error } = await supabase
      .from('notification_keywords')
      .select('*')
      .eq('business_id', businessId);
    
    if (error) {
      console.error(`❌ Error consultando palabras clave: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: error.message,
        message: 'Error al consultar palabras clave de notificaciones'
      });
    }
    
    // Devolver todas las palabras clave
    return res.status(200).json({
      success: true,
      keywords: data || [],
      message: `Se encontraron ${data ? data.length : 0} palabras clave (todas)`
    });
  } catch (error) {
    console.error(`❌ Error en GET /api/notifications/keywords-all: ${error.message}`);
    // Asegurar que siempre devolvemos JSON, incluso en caso de error inesperado
    return res.status(500).json({
      success: false,
      error: error.message || 'Error interno del servidor',
      message: 'Error interno del servidor al procesar la solicitud'
    });
  }
});

// ... existing code ...

// Endpoint PATCH para actualizar el estado de una palabra clave
app.patch('/api/notifications/keywords', async (req, res) => {
  try {
    const { id } = req.query;
    const { enabled } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, error: 'id es requerido' });
    }
    // Actualizar el estado de enabled en la base de datos
    const { data, error } = await supabase
      .from('notification_keywords')
      .update({ enabled })
      .eq('id', id)
      .select();
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    return res.json({ success: true, keyword: data[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ... existing code ...

// Endpoint DELETE para eliminar una palabra clave
app.delete('/api/notifications/keywords', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ success: false, error: 'id es requerido' });
    }
    const { error } = await supabase
      .from('notification_keywords')
      .delete()
      .eq('id', id);
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    return res.json({ success: true, id });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ... existing code ...