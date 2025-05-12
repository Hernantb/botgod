/**
 * Módulo para enviar mensajes a WhatsApp usando la API de Gupshup
 */

const axios = require('axios');

/**
 * Envía un mensaje a WhatsApp usando la API de Gupshup
 * @param {string} recipient Número de teléfono del destinatario
 * @param {string} message Mensaje a enviar
 * @param {Object} businessConfig Configuración del negocio
 * @returns {Promise<Object>} Resultado de la operación
 */
async function sendWhatsAppResponse(recipient, message, businessConfig) {
  try {
    console.log(`📤 Enviando mensaje a ${recipient} desde negocio: ${businessConfig.business_name}`);
    
    // Usar configuración específica del negocio
    const GUPSHUP_API_KEY = businessConfig.gupshup_api_key;
    const GUPSHUP_NUMBER = businessConfig.gupshup_number;
    const GUPSHUP_USERID = businessConfig.gupshup_userid;
    
    // Verificar si tenemos todas las credenciales necesarias
    if (!GUPSHUP_API_KEY) {
      throw new Error('Gupshup API Key no disponible en la configuración del negocio');
    }
    
    if (!GUPSHUP_NUMBER) {
      throw new Error('Gupshup Number no disponible en la configuración del negocio');
    }
    
    // Normalizar número de teléfono (eliminar espacios, guiones, etc.)
    const normalizedNumber = recipient.replace(/\D/g, '');
    
    // URL de la API de Gupshup
    const url = 'https://api.gupshup.io/sm/api/v1/msg';
    
    // Formatear mensaje según documentación de Gupshup
    const formData = new URLSearchParams();
    formData.append('channel', 'whatsapp');
    formData.append('source', GUPSHUP_NUMBER);
    formData.append('destination', normalizedNumber);
    formData.append('message', JSON.stringify({
      type: 'text',
      text: message
    }));
    formData.append('src.name', businessConfig.business_name || 'Bot');
    
    // Si tenemos userid, añadirlo
    if (GUPSHUP_USERID) {
      formData.append('userid', GUPSHUP_USERID);
    }
    
    // Configurar headers para la petición
    const headers = {
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/x-www-form-urlencoded',
      'apikey': GUPSHUP_API_KEY
    };
    
    // Enviar petición a Gupshup
    console.log(`🔄 Enviando petición a Gupshup (${GUPSHUP_NUMBER} → ${normalizedNumber})`);
    const response = await axios.post(url, formData, { headers });
    
    // Verificar si la petición fue exitosa
    if (response.status === 202 || response.status === 200) {
      console.log(`✅ Mensaje enviado correctamente a ${normalizedNumber}`);
      return {
        success: true,
        messageId: response.data?.messageId,
        data: response.data
      };
    } else {
      console.error(`❌ Error inesperado: ${response.status} ${response.statusText}`);
      throw new Error(`Respuesta inesperada: ${response.status} ${response.statusText}`);
    }
    
  } catch (error) {
    // Capturar errores de red o de la API
    console.error(`❌ Error enviando mensaje a WhatsApp: ${error.message}`);
    
    // Si hay detalles adicionales en la respuesta, registrarlos
    if (error.response) {
      console.error('Detalles:', error.response.data);
    }
    
    return {
      success: false,
      error: error.message,
      details: error.response?.data
    };
  }
}

module.exports = sendWhatsAppResponse; 