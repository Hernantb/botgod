/**
 * PARCHE GLOBAL PARA EL BOT DE WHATSAPP
 * 
 * Este archivo define la función registerBotResponse globalmente
 * para garantizar que esté disponible en cualquier parte del código.
 */

// Mostrar información de variables antes de importar fix-real-bot
console.log('📢 GLOBAL-PATCH: Verificando variables al inicio:');
console.log('- CONTROL_PANEL_URL:', process.env.CONTROL_PANEL_URL || 'no definida');
console.log('- NODE_ENV:', process.env.NODE_ENV || 'no definido');
console.log('- RENDER:', process.env.RENDER || 'no definido');

// Importar las funciones de fix-real-bot.js
const { registerBotResponse: supabaseRegister, SUPABASE_URL } = require('./fix-real-bot');

// Conservar la URL original si existe (no sobrescribir)
const isProd = process.env.NODE_ENV === 'production';
if (isProd && process.env.CONTROL_PANEL_URL && !process.env.CONTROL_PANEL_URL.includes('localhost')) {
  console.log(`🔒 GLOBAL-PATCH: Manteniendo URL de producción configurada: ${process.env.CONTROL_PANEL_URL}`);
} else {
  // Configurar solo si no está ya establecida
  const defaultUrl = isProd 
    ? 'https://whatsapp-bot-if6z.onrender.com/api/register-bot-response'
    : 'http://localhost:3000/api/register-bot-response';
  
  if (!process.env.CONTROL_PANEL_URL) {
    process.env.CONTROL_PANEL_URL = defaultUrl;
    console.log(`🔧 GLOBAL-PATCH: Estableciendo URL predeterminada: ${defaultUrl}`);
  }
}

const PANEL_URL = process.env.CONTROL_PANEL_URL;
console.log(`📌 GLOBAL-PATCH: URL final: ${PANEL_URL}`);

// Definir la función global registerBotResponse que guardará en Supabase
global.registerBotResponse = async function(conversationId, message, business_id, sender_type = 'bot', metadata = null) {
  console.log('🔄 Llamada a global.registerBotResponse interceptada');
  console.log(`📤 Guardando mensaje de tipo '${sender_type}' para: ${conversationId}`);
  
  try {
    // Verificar si se proporcionaron metadatos
    if (metadata) {
      console.log(`📝 Metadatos adicionales incluidos: ${JSON.stringify(metadata)}`);
    }
    
    // Guardar mensaje en Supabase con metadatos si existen
    await supabaseRegister(conversationId, message, business_id, sender_type, metadata);
    console.log('✅ Mensaje guardado en Supabase correctamente');
    return { success: true, message: "Mensaje guardado en Supabase" };
  } catch (error) {
    console.error('❌ Error al guardar mensaje en Supabase:', error.message);
    return { success: false, error: error.message };
  }
};

// Mostrar confirmación
console.log('🔧 PARCHE GLOBAL APLICADO');
console.log('✅ Función global.registerBotResponse definida');
console.log(`ℹ️ Guardando mensajes en Supabase: ${SUPABASE_URL}`);

// También exportamos la función por si se quiere usar como módulo
module.exports = {
  registerBotResponse: global.registerBotResponse
}; 