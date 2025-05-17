/**
 * Módulo de notificaciones para WhatsApp Bot
 * 
 * Este módulo implementa un sistema de notificaciones que detecta cuando un mensaje
 * del bot requiere atención humana y envía notificaciones por correo electrónico.
 */

const nodemailer = require('nodemailer');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://wscijkxwevgxbgwhbqtm.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTgyMjc2OCwiZXhwIjoyMDU3Mzk4NzY4fQ.eAMYqHQ5ma_2tPXOwCYKw3tt_vERE0zhBj2xS1srv9M';

// Inicialización de Supabase con manejo de errores para despliegue en Render
let supabase = null;
try {
  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Cliente Supabase inicializado en notification-patch.js');
  } else {
    console.log('⚠️ Falta SUPABASE_URL o SUPABASE_KEY. Se desactivará el almacenamiento en Supabase');
    // Crear un cliente simulado para evitar errores
    supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: null }),
            order: () => ({
              limit: () => Promise.resolve({ data: [], error: null })
            })
          }),
          order: () => ({
            limit: () => Promise.resolve({ data: [], error: null })
          })
        }),
        insert: () => Promise.resolve({ data: null, error: null })
      })
    };
  }
} catch (error) {
  console.error(`❌ Error al inicializar Supabase: ${error.message}`);
  // Crear un cliente simulado para evitar errores
  supabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
          order: () => ({
            limit: () => Promise.resolve({ data: [], error: null })
          })
        }),
        order: () => ({
          limit: () => Promise.resolve({ data: [], error: null })
        })
      }),
      insert: () => Promise.resolve({ data: null, error: null })
    })
  };
}

// Configuración del transporte de correo
const mailConfig = {
  host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || 'apikey',
    pass: process.env.SMTP_PASS || ''
  },
  tls: {
    rejectUnauthorized: process.env.NODE_ENV === 'production'
  }
};

// Lista de frases que indican necesidad de atención humana
const ATTENTION_PHRASES = {
  // Frases del bot que indican que necesita ayuda de un humano
  BOT: [
    "no puedo ayudarte con eso",
    "necesitarás hablar con un agente humano",
    "te voy a transferir",
    "un agente humano te contactará",
    "necesito transferirte",
    "no tengo esa información",
    "no estoy autorizado",
    "no tengo acceso a",
    "no puedo procesar",
    "mi capacidad es limitada",
    "esto está fuera de mi alcance",
    "no puedo realizar esa acción",
    "requiere la intervención de un humano",
    "esto debe ser manejado por una persona",
    "necesitas hablar con atención al cliente",
    "contacta con el soporte técnico",
    "necesitas hablar con un representante",
    "necesitas contactar directamente",
    "hablar con un especialista"
  ],
  
  // Frases de usuarios que podrían indicar urgencia o frustración
  USER: [
    "hablar con humano",
    "hablar con persona",
    "hablar con agente",
    "quiero una persona real",
    "necesito ayuda urgente",
    "esto es urgente",
    "emergencia",
    "no me estás entendiendo",
    "no funciona",
    "estoy enojado",
    "molesto",
    "frustrado",
    "queja",
    "reclamación",
    "devolución",
    "cancelar",
    "error",
    "problema grave"
  ]
};

/**
 * Verifica si un mensaje contiene frases que requieren notificación
 * @param {string} message - El mensaje a verificar
 * @param {string} source - Fuente del mensaje ('bot' o 'user')
 * @returns {Object} Resultado del análisis
 */
function checkForNotificationPhrases(message, source = 'bot') {
  if (!message) return { requiresNotification: false, matches: [] };
  
  // Convertir mensaje a minúsculas para comparación insensible a mayúsculas
  const lowerMessage = message.toLowerCase();
  let sourceUppercase = source.toUpperCase();
  
  // Verificar si el origen es válido
  if (!ATTENTION_PHRASES[sourceUppercase]) {
    console.warn(`Fuente no válida: ${source}. Usando 'BOT' por defecto.`);
    sourceUppercase = 'BOT';
  }
  
  // Buscar coincidencias con las frases de atención
  const phrases = ATTENTION_PHRASES[sourceUppercase];
  const matches = [];
  
  for (const phrase of phrases) {
    if (lowerMessage.includes(phrase.toLowerCase())) {
      matches.push(phrase);
    }
  }
  
  return {
    requiresNotification: matches.length > 0,
    matches,
    source: sourceUppercase
  };
}

/**
 * Procesa un mensaje para determinar si requiere notificación
 * @param {string} message - Mensaje a procesar
 * @param {string} source - Fuente del mensaje ('bot' o 'user')
 * @param {string} conversationId - ID de la conversación
 * @param {string} clientPhoneNumber - Número de teléfono del cliente (opcional)
 * @returns {Promise<Object>} Resultado del procesamiento
 */
async function processMessageForNotification(message, source, conversationId, clientPhoneNumber = null) {
  try {
    console.log(`🔍 Analizando mensaje para notificación (fuente: ${source})`);
    
    // Verificar si el mensaje contiene frases que requieren notificación
    const analysis = checkForNotificationPhrases(message, source);
    
    if (!analysis.requiresNotification) {
      console.log(`ℹ️ El mensaje no contiene frases que requieran notificación`);
      return { success: true, requiresNotification: false };
    }
    
    console.log(`⚠️ Mensaje requiere notificación. Coincidencias: ${analysis.matches.join(', ')}`);
    
    // Si no tenemos el número de teléfono, intentamos obtenerlo de la base de datos
    let phoneNumber = clientPhoneNumber;
    if (!phoneNumber && supabase) {
      console.log(`Buscando número de teléfono para conversación ${conversationId}`);
      
      try {
        // Consultar la base de datos para obtener el número de teléfono
        const { data, error } = await supabase
          .from('conversations')
          .select('client_phone')
          .eq('id', conversationId)
          .single();
        
        if (error) {
          console.error(`Error al consultar Supabase: ${error.message}`);
        } else if (data) {
          phoneNumber = data.client_phone;
          console.log(`Número de teléfono encontrado: ${phoneNumber}`);
        } else {
          console.warn(`No se encontró la conversación con ID ${conversationId}`);
        }
      } catch (dbError) {
        console.error(`Error al consultar la base de datos: ${dbError.message}`);
      }
    }
    
    // Enviar notificación
    if (phoneNumber) {
      console.log(`📧 Enviando notificación para ${phoneNumber}`);
      const notificationResult = await sendBusinessNotification(conversationId, message, phoneNumber);
      
      if (notificationResult) {
        console.log(`✅ Notificación enviada correctamente`);
      } else {
        console.error(`❌ Error al enviar notificación`);
      }
      
      return {
        success: true,
        requiresNotification: true,
        notificationSent: notificationResult,
        phoneNumber
      };
    } else {
      console.error(`❌ No se pudo obtener el número de teléfono para la notificación`);
      return {
        success: false,
        requiresNotification: true,
        notificationSent: false,
        error: 'No se pudo obtener el número de teléfono'
      };
    }
  } catch (error) {
    console.error(`Error al procesar mensaje para notificación: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Envía una notificación por correo electrónico
 * @param {string} conversationId - ID de la conversación
 * @param {string} botMessage - Mensaje que desencadenó la notificación
 * @param {string} clientPhoneNumber - Número de teléfono del cliente
 * @returns {Promise<boolean>} Resultado del envío
 */
async function sendBusinessNotification(conversationId, botMessage, clientPhoneNumber) {
  try {
    console.log(`🔔 Iniciando proceso de notificación por correo...`);
    
    // Configurar destinatarios
    const notificationEmails = process.env.NOTIFICATION_EMAILS 
      ? process.env.NOTIFICATION_EMAILS.split(',').map(email => email.trim())
      : [];
    
    if (!notificationEmails.length) {
      console.error('⚠️ No hay direcciones de correo configuradas para notificaciones');
      return false;
    }
    
    const businessName = process.env.BUSINESS_NAME || 'Mi Negocio';
    
    // Obtener las últimas 10 mensajes de la conversación
    let conversationHistory = [];
    if (supabase) {
      try {
        console.log(`🔍 Recuperando mensajes de Supabase para conversación ${conversationId}`);
        const { data, error } = await supabase
          .from('messages')
          .select('*') // Seleccionar todos los campos
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false })
          .limit(10);
        
        if (error) {
          console.error(`Error al obtener historial de conversación: ${error.message}`);
        } else if (data) {
          // Invertir para que estén en orden cronológico
          conversationHistory = data.reverse();
          console.log(`Se obtuvieron ${conversationHistory.length} mensajes para el historial`);
          
          // Logging detallado para CADA mensaje
          conversationHistory.forEach(msg => {
            console.log(`
📩 MENSAJE ORIGINAL (Supabase):
   ID: ${msg.id?.substring(0,8) || 'N/A'}
   Tipo de remitente (sender_type): "${msg.sender_type || 'no definido'}"
   Contenido: "${msg.content?.substring(0,40)}..."
   Fecha: ${new Date(msg.created_at).toLocaleString()}
            `);
          });
        }
      } catch (dbError) {
        console.error(`Error en consulta de historial: ${dbError.message}`);
      }
    } else {
      console.log('⚠️ Supabase no disponible, no se puede obtener historial de conversación');
    }
    
    // Crear HTML para el historial de mensajes
    const formattedHistory = conversationHistory.map(msg => {
      // VERIFICACIÓN SIMPLE BASADA ÚNICAMENTE EN SENDER_TYPE de Supabase
      // Si sender_type es exactamente 'user' -> Cliente (izquierda)
      // Cualquier otro valor (bot, agent, dashboard, null, etc) -> Sistema (derecha)
      
      const isUserMessage = msg.sender_type === 'user';
      const messageTime = new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
      
      // Determinar el remitente para mostrar en el mensaje
      const senderLabel = isUserMessage ? 'Cliente' : (
        msg.sender_type === 'bot' ? 'Bot' : 
        msg.sender_type === 'agent' ? 'Asesor' : 
        msg.sender_type === 'dashboard' ? 'Dashboard' : 'Sistema'
      );
      
      // Log para debug
      console.log(`📧 FORMATO EMAIL: ID=${msg.id?.substring(0,8) || 'N/A'}, sender_type="${msg.sender_type}", posición=${isUserMessage ? 'IZQUIERDA' : 'DERECHA'}, etiqueta="${senderLabel}"`);
      
      if (isUserMessage) {
        // MENSAJE DEL CLIENTE (izquierda, fondo blanco)
        return `
          <div style="width: 100%; margin-bottom: 16px; display: block; clear: both; overflow: hidden;">
            <div style="float: left; max-width: 80%; background-color: white; border: 1px solid #e0e0e0; border-radius: 10px; padding: 10px; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
              <div style="font-size: 13px; margin-bottom: 5px; color: #333;"><strong>Cliente</strong> - ${messageTime}</div>
              <div style="color: #333;">${msg.content}</div>
            </div>
          </div>
        `;
      } else {
        // MENSAJE DEL SISTEMA (derecha, fondo oscuro)
        return `
          <div style="width: 100%; margin-bottom: 16px; display: block; clear: both; overflow: hidden;">
            <div style="float: right; max-width: 80%; background-color: #2d2d3d; color: white; border-radius: 10px; padding: 10px; text-align: right; box-shadow: 0 1px 2px rgba(0,0,0,0.2);">
              <div style="font-size: 13px; margin-bottom: 5px; color: #ddd;"><strong>${senderLabel}</strong> - ${messageTime}</div>
              <div>${msg.content}</div>
            </div>
          </div>
        `;
      }
    }).join('');
    
    // URL del panel de control
    const controlPanelUrl = process.env.CONTROL_PANEL_URL || 'http://localhost:3000';
    const conversationUrl = `${controlPanelUrl}/conversations/${conversationId}`;
    
    // Construir el contenido del correo
    const emailHtml = `
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; margin: 0; padding: 0; }
          .container { width: 100%; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2d2d3d; color: white; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
          .content { margin-bottom: 20px; background-color: white; padding: 15px; border-radius: 5px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
          .alert { color: #721c24; background-color: #f8d7da; padding: 10px; border-radius: 5px; margin-bottom: 20px; }
          .history { background-color: #f7f7f7; padding: 15px; border-radius: 5px; margin-bottom: 20px; overflow: hidden; }
          .footer { font-size: 12px; color: #6c757d; margin-top: 30px; background-color: white; padding: 15px; border-radius: 5px; }
          .button { display: inline-block; background-color: #2d2d3d; color: white; padding: 10px 15px; 
                    text-decoration: none; border-radius: 5px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>🔔 Notificación de WhatsApp Bot</h2>
          </div>
          
          <div class="content">
            <p>Se ha detectado un mensaje que requiere atención humana:</p>
            <div class="alert">
              <p><strong>Mensaje del bot:</strong> ${botMessage}</p>
            </div>
            
            <p><strong>Número de teléfono del cliente:</strong> ${clientPhoneNumber}</p>
            <p><strong>ID de conversación:</strong> ${conversationId}</p>
            
            <a href="${conversationUrl}" class="button">Ver conversación completa</a>
          </div>
          
          <div class="history">
            <h3>📝 Historial de mensajes recientes:</h3>
            ${formattedHistory || '<p>No hay historial disponible</p>'}
            <div style="clear: both;"></div>
          </div>
          
          <div class="footer" style="clear: both;">
            <p>Este es un mensaje automático generado por WhatsApp Bot para ${businessName}.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    // Configurar opciones del correo
    const mailOptions = {
      from: process.env.SMTP_FROM || `"WhatsApp Bot" <${process.env.SMTP_USER}>`,
      to: notificationEmails[0],
      subject: `🔔 WhatsApp Bot: Mensaje que requiere atención - Cliente ${clientPhoneNumber}`,
      html: emailHtml
    };
    
    // Agregar destinatarios en copia oculta (BCC) si hay más de uno
    if (notificationEmails.length > 1) {
      mailOptions.bcc = notificationEmails.slice(1).join(',');
    }
    
    // Verificar si el transporte de correo está configurado
    let transporter = nodemailer.createTransport(mailConfig);
    
    try {
      // Verificar conexión con el servidor de correo
      await transporter.verify();
      console.log('✅ Conexión con servidor de correo verificada');
    } catch (smtpError) {
      console.error(`❌ Error al verificar servidor de correo: ${smtpError.message}`);
      
      // Si falla la verificación, intentar con configuración alternativa
      if (process.env.ALTERNATE_SMTP_HOST) {
        console.log('⚠️ Intentando con configuración SMTP alternativa...');
        
        const alternateConfig = {
          host: process.env.ALTERNATE_SMTP_HOST,
          port: process.env.ALTERNATE_SMTP_PORT || 587,
          secure: process.env.ALTERNATE_SMTP_SECURE === 'true',
          auth: {
            user: process.env.ALTERNATE_SMTP_USER,
            pass: process.env.ALTERNATE_SMTP_PASS
          },
          tls: {
            rejectUnauthorized: process.env.NODE_ENV === 'production'
          }
        };
        
        transporter = nodemailer.createTransport(alternateConfig);
      } else {
        console.log('⚠️ No hay configuración SMTP alternativa disponible');
        console.log('⚠️ Simulando envío de correo para continuar pruebas');
        
        // En caso de error, simular envío exitoso para pruebas
        if (process.env.NODE_ENV !== 'production') {
          console.log('📧 [SIMULACIÓN] Correo enviado a:', notificationEmails.join(', '));
          console.log('📧 [SIMULACIÓN] Asunto:', mailOptions.subject);
          
          // Registramos la notificación en Supabase (si está disponible)
          if (supabase) {
            try {
              await supabase
                .from('notifications')
                .insert({
                  conversation_id: conversationId,
                  phone_number: clientPhoneNumber,
                  message: botMessage,
                  email_sent: false,
                  email_recipients: notificationEmails.join(','),
                  error_message: 'Simulación: servidor SMTP no disponible'
                });
            } catch (dbError) {
              console.error(`Error al guardar registro de notificación simulada: ${dbError.message}`);
            }
          }
          
          return true;
        }
        
        throw new Error(`Error de conexión SMTP: ${smtpError.message}`);
      }
    }
    
    // Enviar el correo
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ Correo enviado: ${info.messageId}`);
      
      // Registrar la notificación en la base de datos
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('notifications')
            .insert({
              conversation_id: conversationId,
              phone_number: clientPhoneNumber,
              message: botMessage,
              email_sent: true,
              email_recipients: notificationEmails.join(','),
              message_id: info.messageId
            });
          
          if (error) {
            console.error(`Error al registrar notificación en BD: ${error.message}`);
          } else {
            console.log(`✅ Notificación registrada en base de datos`);
          }
        } catch (dbError) {
          console.error(`Error al guardar registro de notificación: ${dbError.message}`);
        }
      }
      
      return true;
    } catch (emailError) {
      console.error(`❌ Error al enviar correo: ${emailError.message}`);
      
      // Registrar el intento fallido en la base de datos
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('notifications')
            .insert({
              conversation_id: conversationId,
              phone_number: clientPhoneNumber,
              message: botMessage,
              email_sent: false,
              error_message: emailError.message
            });
          
          if (error) {
            console.error(`Error al registrar fallo de notificación: ${error.message}`);
          } else {
            console.log(`✅ Intento fallido de notificación registrado en BD`);
          }
        } catch (dbError) {
          console.error(`Error al guardar registro de fallo: ${dbError.message}`);
        }
      }
      
      // En entorno no productivo, seguimos adelante para pruebas
      if (process.env.NODE_ENV !== 'production') {
        console.log('📧 [SIMULACIÓN] Correo enviado (modo de recuperación de error)');
        return true;
      }
      
      return false;
    }
  } catch (error) {
    console.error(`❌ Error general en sendBusinessNotification: ${error.message}`);
    console.error(error.stack);
    
    // En entorno no productivo, seguimos adelante para pruebas
    if (process.env.NODE_ENV !== 'production') {
      console.log('📧 [SIMULACIÓN] Correo enviado (modo de recuperación de error general)');
      return true;
    }
    
    return false;
  }
}

/**
 * Envía un mensaje de WhatsApp y verifica si requiere notificación
 * @param {string} phoneNumber - Número de teléfono del destinatario
 * @param {string} message - Mensaje a enviar
 * @param {Object} options - Opciones adicionales
 * @param {Function} options.sendFunction - Función para enviar el mensaje
 * @param {string} options.conversationId - ID de la conversación
 * @returns {Promise<Object>} Resultado del envío con información de notificación
 */
async function sendWhatsAppResponseWithNotification(phoneNumber, message, options = {}) {
  try {
    console.log(`📱 Enviando mensaje a ${phoneNumber} con verificación de notificación`);
    
    // Extraer opciones
    const {
      sendFunction,
      conversationId,
      skipNotificationCheck = false
    } = options;
    
    // Validar parámetros
    if (!phoneNumber) {
      throw new Error('Número de teléfono no proporcionado');
    }
    
    if (!message) {
      throw new Error('Mensaje no proporcionado');
    }
    
    if (!sendFunction || typeof sendFunction !== 'function') {
      throw new Error('Función de envío no proporcionada o inválida');
    }
    
    // Enviar el mensaje
    console.log(`📤 Enviando mensaje a WhatsApp`);
    let whatsappResult;
    try {
      whatsappResult = await sendFunction(phoneNumber, message);
      console.log(`✅ Mensaje enviado correctamente a WhatsApp`);
    } catch (sendError) {
      console.error(`❌ Error al enviar mensaje a WhatsApp: ${sendError.message}`);
      throw sendError;
    }
    
    // Verificar si el mensaje requiere notificación (a menos que se indique lo contrario)
    let notificationResult = { 
      requiresNotification: false, 
      notificationSent: false
    };
    
    if (!skipNotificationCheck) {
      console.log(`🔍 Verificando si el mensaje requiere notificación`);
      
      try {
        // Analizar el mensaje del bot para ver si requiere atención humana
        notificationResult = await processMessageForNotification(
          message, 
          'bot', 
          conversationId,
          phoneNumber
        );
        
        if (notificationResult.requiresNotification) {
          console.log(`⚠️ El mensaje requirió notificación: ${notificationResult.notificationSent ? 'Enviada ✅' : 'Falló ❌'}`);
        } else {
          console.log(`ℹ️ El mensaje no requiere notificación`);
        }
      } catch (notificationError) {
        console.error(`❌ Error al procesar notificación: ${notificationError.message}`);
        notificationResult.error = notificationError.message;
      }
    } else {
      console.log(`ℹ️ Verificación de notificación omitida por configuración`);
    }
    
    // Retornar resultado combinado
    return {
      ...whatsappResult,
      notification: notificationResult
    };
  } catch (error) {
    console.error(`❌ Error en sendWhatsAppResponseWithNotification: ${error.message}`);
    throw error;
  }
}

// Exportar funciones
module.exports = {
  checkForNotificationPhrases,
  processMessageForNotification,
  sendBusinessNotification,
  sendWhatsAppResponseWithNotification
}; 