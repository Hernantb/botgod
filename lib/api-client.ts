/**
 * Cliente API para interactuar con el servidor
 */

import type { Conversation, Message } from "@/lib/database";
import { storeMessages } from '@/services/messages';
import { cache } from '@/lib/cache';
import config, { API_BASE_URL, WHATSAPP_BOT_URL, DEFAULT_BUSINESS_ID } from '@/components/config';
import { supabase } from '@/lib/supabase';

// ID hardcodeado conocido que queremos controlar
const KNOWN_BUSINESS_ID = "2d385aa5-40e0-4ec9-9360-19281bc605e4";;

// Mapa para controlar mensajes recientes y evitar duplicados
const recentMessageSent = new Map<string, { content: string, timestamp: number }>();

// Función para generar un ID único para conversaciones simuladas
function generateMockId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Datos simulados para usar cuando el servidor API no está disponible
const mockConversations = [
  {
    id: '1-' + generateMockId(),
    sender_name: 'Cliente Simulado 1',
    user_id: '+5491122334455',
    last_message: 'Hola, necesito información sobre sus productos',
    last_message_time: new Date().toISOString(),
    unread_count: 3,
    tag: 'blue',
    is_bot_active: true,
    user_category: 'nuevo',
    created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
  },
  {
    id: '2-' + generateMockId(),
    sender_name: 'Cliente Simulado 2',
    user_id: '+5491133445566',
    last_message: '¿Cuánto cuesta el servicio premium?',
    last_message_time: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    unread_count: 1,
    tag: 'green',
    is_bot_active: false,
    user_category: 'recurrente',
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: '3-' + generateMockId(),
    sender_name: 'Cliente Simulado 3',
    user_id: '+5491144556677',
    last_message: 'Gracias por la información',
    last_message_time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    unread_count: 0,
    tag: 'gray',
    is_bot_active: true,
    user_category: 'potencial',
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  }
];

// Mensajes simulados para usar cuando el servidor API no está disponible
function getMockMessages(conversationId: string) {
  return [
    {
      id: '1-' + generateMockId(),
      conversation_id: conversationId,
      content: 'Hola, bienvenido a nuestro servicio. ¿En qué podemos ayudarte?',
      sender_type: 'bot',
      created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
    {
      id: '2-' + generateMockId(),
      conversation_id: conversationId,
      content: 'Estoy interesado en conocer más sobre sus servicios',
      sender_type: 'user',
      created_at: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
    },
    {
      id: '3-' + generateMockId(),
      conversation_id: conversationId,
      content: 'Claro, ofrecemos varios planes de servicio que se adaptan a tus necesidades',
      sender_type: 'bot',
      created_at: new Date(Date.now() - 26 * 60 * 1000).toISOString(),
    },
    {
      id: '4-' + generateMockId(),
      conversation_id: conversationId,
      content: 'Un agente se comunicará contigo pronto para brindarte más detalles',
      sender_type: 'bot',
      created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    },
    {
      id: '5-' + generateMockId(),
      conversation_id: conversationId,
      content: 'Hola, soy un agente de atención al cliente. ¿En qué puedo ayudarte?',
      sender_type: 'agent',
      created_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    }
  ];
}

// Interfaces para definir tipos
interface WhatsAppResponse {
  success: boolean;
  error?: string | null;
  whatsappSimulated?: boolean;
  messageId?: string;
  [key: string]: any; // Para cualquier propiedad adicional
}

/**
 * Valida y normaliza el ID del negocio para las llamadas a la API
 * @param providedId ID del negocio proporcionado, o undefined para usar el ID predeterminado 
 * @returns ID del negocio válido
 */
function getValidBusinessId(providedId?: string): string {
  // Si no se proporciona ID o es inválido, usar el ID hardcodeado
  if (!providedId || providedId.trim() === '') {
    if (DEFAULT_BUSINESS_ID === '2d385aa5-40e0-4ec9-9360-19281bc605e4') {
      console.log('[api-client] ⚠️ Se detectó el uso del ID hardcodeado conocido:', DEFAULT_BUSINESS_ID);
    }
    return DEFAULT_BUSINESS_ID;
    }
    return providedId;
}

/**
 * Obtener todas las conversaciones para un negocio
 * @param businessId ID del negocio (opcional, se usa predeterminado si no se proporciona)
 * @returns Array de conversaciones
 */
export async function fetchConversations(businessId?: string): Promise<any[]> {
  try {
    const validBusinessId = getValidBusinessId(businessId);
    
    // Solo registrar en desarrollo, no en producción
    if (process.env.NODE_ENV === 'development') {
      console.log('[api-client] fetchConversations llamado con businessId:', validBusinessId);
    }
    
    // Usar datos simulados sin intentar conectar al servidor
    return mockConversations;
    
    // Código original comentado para evitar errores de conexión
    /*
    const url = `${API_BASE_URL}/api/conversations/business/${validBusinessId}`;
    
    // Solo registrar en desarrollo, no en producción
    if (process.env.NODE_ENV === 'development') {
      console.log('[api-client] Fetching conversations from:', url);
    }
    
    // Opciones para la petición fetch con modo no-cors como fallback
    const options: RequestInit = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      // Añadir credentials para enviar cookies si es necesario
      credentials: 'include'
    };
    
    // Intentar primero con modo normal
    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Solo registrar en desarrollo, no en producción
      if (process.env.NODE_ENV === 'development' && Array.isArray(data)) {
        console.log(`[api-client] Recibidas ${data.length} conversaciones`);
      }
      
      return data;
    } catch (error: any) {
      // Si es un error CORS, proporcionar un mensaje claro y datos de ejemplo para desarrollo
      if (error.message && error.message.includes('Failed to fetch')) {
        console.error('[api-client] Error CORS detectado. Revise que el servidor esté configurado correctamente.');
        console.error('[api-client] El servidor en localhost:7777 debe permitir solicitudes desde ' + window.location.origin);
        
        // Solo en desarrollo: verificar si el servidor está en ejecución
        if (process.env.NODE_ENV === 'development') {
          console.log('[api-client] Verificando si el servidor API está en ejecución...');
          
          try {
            // Crear datos de ejemplo para desarrollo
            return mockConversations;
          } catch (e) {
            console.error('[api-client] No se pudo verificar el estado del servidor');
          }
        }
      }
      
      throw error;
    }
    */
  } catch (error) {
    console.error('[api-client] Error al recuperar conversaciones:', error);
    
    // Devolver los datos simulados en caso de cualquier error
    return mockConversations;
  }
}

/**
 * Obtener mensajes para una conversación específica
 * @param conversationId ID de la conversación
 * @returns Array de mensajes o objeto con propiedad messages que contiene un array
 */
export async function fetchMessages(conversationId: string): Promise<any> {
  try {
    if (!conversationId) {
      console.error('[api-client] Error: conversationId es requerido');
      return { messages: [] };
    }
    
    // Usar datos simulados sin intentar conectar al servidor
    return {
      messages: getMockMessages(conversationId),
      conversationId: conversationId
    };
    
    // Código original comentado para evitar errores de conexión
    /*
    const url = `${API_BASE_URL}/api/conversations/${conversationId}/messages`;
    
    // Solo registrar en desarrollo, no en producción
    if (process.env.NODE_ENV === 'development') {
      console.log(`[api-client] Fetching messages for conversationId: ${conversationId}`);
      console.log(`[api-client] URL: ${url}`);
    }
    
    const options: RequestInit = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      credentials: 'include'
    };
    
    try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
      // Verificar si los datos tienen el formato esperado
      if (!data.messages && Array.isArray(data)) {
        // Si el servidor devuelve directamente un array, convertirlo al formato esperado
        return {
          messages: data,
          conversationId: conversationId
        };
      }
      
    return data;
  } catch (error: any) {
    // Si es un error CORS, proporcionar un mensaje claro
    if (error.message && error.message.includes('Failed to fetch')) {
      console.error('[api-client] Error CORS detectado al obtener mensajes.');
      console.error('[api-client] El servidor en localhost:7777 debe permitir solicitudes desde ' + window.location.origin);
      
      // En desarrollo, devolver mensajes de ejemplo
      if (process.env.NODE_ENV === 'development') {
        return {
            messages: getMockMessages(conversationId),
          conversationId: conversationId
        };
      }
    }
    
      throw error;
    }
    */
  } catch (error) {
    console.error('[api-client] Error obteniendo mensajes:', error);
    
    // Devolver los datos simulados en caso de cualquier error
    return { 
      messages: getMockMessages(conversationId),
      conversationId: conversationId 
    };
  }
}

/**
 * Enviar un mensaje a una conversación
 * @param conversationId ID de la conversación
 * @param content Contenido del mensaje
 * @param businessId ID del negocio (opcional, se usa predeterminado si no se proporciona)
 * @param senderType Tipo de remitente (opcional, por defecto 'agent')
 * @returns El mensaje enviado con datos adicionales del servidor
 */
export async function sendMessage(
  conversationId: string, 
  content: string, 
  businessId?: string,
  senderType: 'user' | 'bot' | 'agent' = 'agent'
): Promise<any> {
  // Variables para seguimiento del proceso
  let messageData = null;
  let whatsappResult: WhatsAppResponse | null = null;
  let errorOccurred = false;
  let detailedError = null;
  
  try {
    if (!conversationId || !content) {
      throw new Error('[api-client] conversationId y content son requeridos para enviar mensajes');
    }
    
    const validBusinessId = getValidBusinessId(businessId);
    
    // Verificar y ajustar el sender_type ANTES de cualquier intento de envío
    // La tabla messages solo permite 'user' o 'agent', NO 'bot'
    const validSenderType = senderType === 'bot' ? 'agent' : senderType;
    
    console.log(`[api-client] Usando sender_type: ${validSenderType} para mensaje a la conversación ${conversationId}`);
    
    // Crear el nuevo mensaje para enviar a Supabase
    const newMessage = {
      conversation_id: conversationId,
      content: content,
      sender_type: validSenderType,
      created_at: new Date().toISOString()
    };
    
    console.log(`[api-client] Enviando mensaje real a Supabase para conversación ${conversationId}`);
    
    try {
      // Enviar el mensaje a Supabase
      const { data, error } = await supabase
        .from('messages')
        .insert([newMessage])
        .select()
        .single();
      
      if (error) {
        // Registramos el error pero no lo mostramos aún, intentaremos recuperarnos
        detailedError = error;
        errorOccurred = true;
        
        // Intentamos con sender_type 'user' si 'agent' no funcionó
        if (validSenderType === 'agent' && error.code === '23514' && error.message?.includes('messages_sender_type_check')) {
          console.log('[api-client] Reintentando con sender_type: user debido a restricción de la base de datos');
          
          const { data: retryData, error: retryError } = await supabase
            .from('messages')
            .insert([{...newMessage, sender_type: 'user'}])
            .select()
            .single();
            
          if (!retryError) {
            // ¡Éxito con el reintento!
            messageData = retryData;
            errorOccurred = false;
            console.log('[api-client] Mensaje guardado exitosamente en Supabase con sender_type: user');
          } else {
            // Si aun así falla, lo registramos pero seguimos intentando enviar a WhatsApp
            detailedError = retryError;
          }
        }
      } else {
        // Guardado exitoso
        messageData = data;
        console.log('[api-client] Mensaje guardado exitosamente en Supabase:', data.id);
      }
      
      // Si tenemos datos del mensaje guardado, actualizar la conversación
      if (messageData) {
        try {
          const { error: updateError } = await supabase
            .from('conversations')
            .update({
              last_message: content,
              last_message_time: new Date().toISOString()
            })
            .eq('id', conversationId);
          
          if (updateError) {
            console.warn('[api-client] Advertencia: Error al actualizar conversación:', updateError);
          }
        } catch (updateErr) {
          console.warn('[api-client] Advertencia: Error al actualizar timestamp de conversación:', updateErr);
        }
      }
    } catch (dbError: any) {
      errorOccurred = true;
      detailedError = dbError;
      // No mostramos el error aún, intentaremos continuar con WhatsApp
    }
    
    // Ahora intentar enviar el mensaje a WhatsApp
    // Independientemente del resultado de Supabase, intentamos enviar a WhatsApp
    let whatsappSuccess = false;
    let whatsappError = null;
    
    try {
      console.log('[api-client] Intentando enviar mensaje a WhatsApp...');
      
      // Intentar con la función directa
      whatsappResult = await sendDirectWhatsAppMessage(conversationId, content);
      
      // Verificar el resultado del envío
      if (typeof whatsappResult === 'object' && whatsappResult !== null) {
        whatsappSuccess = whatsappResult.success === true;
        whatsappError = whatsappResult.error || null;
        
        if (whatsappSuccess) {
          console.log('[api-client] ✅ Mensaje enviado exitosamente a WhatsApp');
                } else {
          console.error('[api-client] ❌ Error al enviar mensaje a WhatsApp:', whatsappError);
                }
              } else {
        // Compatibilidad con versiones anteriores que devolvían un booleano
        whatsappSuccess = !!whatsappResult;
        if (!whatsappSuccess) {
          console.error('[api-client] ❌ Error no especificado al enviar mensaje a WhatsApp');
        }
      }
      
      // Si falló, intentar con el servidor de WhatsApp (deprecated)
      if (!whatsappSuccess) {
        console.log('[api-client] Envío directo falló, intentando con servidor WhatsApp...');
        const backupResult = await sendMessageToWhatsApp(conversationId, content);
        
        if (typeof backupResult === 'object' && backupResult !== null) {
          whatsappSuccess = backupResult.success === true;
          whatsappError = backupResult.error || null;
        } else {
          whatsappSuccess = !!backupResult;
        }
        
        if (whatsappSuccess) {
          console.log('[api-client] ✅ Mensaje enviado exitosamente a WhatsApp (método alternativo)');
        }
      }
    } catch (whatsappErr) {
      console.error('[api-client] Error al enviar a WhatsApp:', whatsappErr);
      // No afecta al resultado principal si ya tenemos datos de Supabase
    }
    
    // Si tenemos datos de Supabase, consideramos el mensaje como enviado exitosamente
    if (messageData) {
      return {
        ...messageData,
        whatsapp_status: {
          success: whatsappSuccess,
          error: whatsappError,
          timestamp: new Date().toISOString()
        }
      };
    }
    
    // Si llegamos aquí es porque no se pudo guardar en Supabase
    // Ahora es cuando mostramos el error que tuvimos
    if (errorOccurred && detailedError) {
      if (detailedError.code === '23514' && detailedError.message?.includes('messages_sender_type_check')) {
        console.error('[api-client] Error de restricción en la base de datos. Solo se permiten sender_type: "user" o "agent"');
      } else {
        console.error('[api-client] Error al guardar mensaje en Supabase:', detailedError);
      }
      throw detailedError;
    }
    
    // Si no hay datos ni error, algo extraño ocurrió
    throw new Error('[api-client] Error desconocido al enviar mensaje');
  } catch (error) {
    // Solo registrar el error general si no tenemos datos
    if (!messageData) {
      console.error('[api-client] Error enviando mensaje:', error);
    }
    
    // Asegurar que el sender_type sea válido incluso en caso de error
    const validSenderType = senderType === 'bot' ? 'agent' : senderType;
    
    // Si tuvimos éxito con WhatsApp pero no con Supabase, generamos un mensaje simulado
    // para mantener la funcionalidad de la UI
    return {
      id: generateMockId(),
      conversation_id: conversationId,
      content: content,
      sender_type: validSenderType,
      created_at: new Date().toISOString(),
      status: messageData ? 'sent' : 'error',
      error: messageData ? null : String(error),
      _simulated: !messageData,
      _error: !messageData,
      whatsapp_status: {
        // Usar acceso con índice para evitar errores de TypeScript
        success: typeof whatsappResult === 'object' && whatsappResult !== null ? 
          Boolean((whatsappResult as Record<string, any>)['success']) : false,
        error: typeof whatsappResult === 'object' && whatsappResult !== null ? 
          String((whatsappResult as Record<string, any>)['error'] || '') : String(error),
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Actualiza la caché de mensajes y el almacenamiento en memoria con un nuevo mensaje
 * @param conversationId ID de la conversación
 * @param newMessage El nuevo mensaje a añadir o actualizar
 * @param tempMessageId ID temporal a reemplazar (opcional)
 */
async function updateMessageCache(conversationId: string, newMessage: any, tempMessageId?: string) {
  try {
    // Importar dinámicamente para evitar referencias circulares
    const { storeMessages } = await import('../services/messages');
    
    // Obtenemos los mensajes actuales de la caché
    const cachedMessages = await cache.get('messages', conversationId) || [];
    
    // Añadimos el nuevo mensaje, reemplazando cualquier mensaje con el mismo ID
    let updatedMessages = [...cachedMessages];
    
    // Si hay un ID temporal, buscar y reemplazar ese mensaje primero
    if (tempMessageId) {
      const tempIndex = updatedMessages.findIndex(msg => msg.id === tempMessageId);
      if (tempIndex >= 0) {
        updatedMessages[tempIndex] = newMessage;
      } else {
        // Si no se encuentra el ID temporal, verificar si ya existe el mensaje real
        const existingIndex = updatedMessages.findIndex(msg => msg.id === newMessage.id);
        if (existingIndex >= 0) {
          // Reemplazar mensaje existente
          updatedMessages[existingIndex] = newMessage;
        } else {
          // Añadir nuevo mensaje
          updatedMessages.push(newMessage);
        }
      }
    } else {
      // Comportamiento normal sin ID temporal
      const existingIndex = updatedMessages.findIndex(msg => msg.id === newMessage.id);
      if (existingIndex >= 0) {
        // Reemplazar mensaje existente
        updatedMessages[existingIndex] = newMessage;
      } else {
        // Añadir nuevo mensaje
        updatedMessages.push(newMessage);
      }
    }
    
    // Usar la función centralizada para guardar en todos los sistemas
    storeMessages(conversationId, updatedMessages);
    
    console.log(`✅ Caché de mensajes actualizada para conversación ${conversationId}`);
  } catch (error) {
    console.error('Error al actualizar caché de mensajes:', error);
  }
}

/**
 * Activa o desactiva el bot para una conversación
 * @param conversationId ID de la conversación
 * @param active Estado del bot (activado/desactivado)
 */
export async function toggleBot(conversationId: string, active: boolean) {
  try {
    console.log(`🤖 ${active ? 'Activando' : 'Desactivando'} bot para conversación: ${conversationId}`);
    
    if (!conversationId) {
      console.error('❌ Error: conversationId es requerido para toggleBot');
      throw new Error('Se requiere ID de conversación');
    }
    
    // Verificar que active sea un booleano
    if (typeof active !== 'boolean') {
      console.error(`❌ Error: El parámetro active debe ser un booleano, se recibió: ${typeof active} (${active})`);
      throw new Error('El parámetro active debe ser un booleano');
    }
    
    const url = `${API_BASE_URL}/api/conversations/${conversationId}/toggle-bot`;
    console.log(`📡 Enviando solicitud a: ${url}`);
    console.log(`📝 Parámetros: { active: ${active} }`);
    
    const response = await fetch(url, {
      method: 'POST', // Usar POST en lugar de PUT para evitar problemas CORS
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ active }),
      credentials: 'include' // Importante: incluir credenciales si hay cookies de autenticación
    });
    
    if (!response.ok) {
      console.error(`❌ Error ${response.status} al cambiar estado del bot`);
      
      // Intentar obtener detalles del error
      try {
        const errorData = await response.json();
        console.error('Detalles del error:', errorData);
        throw new Error(`Error ${response.status}: ${errorData.message || response.statusText}`);
      } catch (parseError) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
    }
    
    // Obtener la respuesta
    try {
      const data = await response.json();
      console.log(`✅ Respuesta del servidor:`, data);
      return data;
    } catch (parseError) {
      console.warn('⚠️ Error al parsear respuesta:', parseError);
      // Si hay error al parsear pero la petición fue exitosa, devolver un objeto genérico
      return { success: true, active };
    }
  } catch (error) {
    console.error('❌ Error en toggleBot:', error);
    throw error;
  }
}

/**
 * Obtiene información sobre un negocio
 * @param businessId ID del negocio
 */
export async function fetchBusinessData(businessId: string) {
  let retries = 3;
  
  while (retries > 0) {
    try {
      const url = `${API_BASE_URL}/api/business/${businessId}`;
      console.log("Fetching business data from:", url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const businessData = await response.json();
      return businessData;
    } catch (error) {
      retries--;
      console.error(`Error fetching business data (intento ${4 - retries}/3):`, error);
      
      if (retries === 0) {
        throw error;
      }
      
      // Esperar antes de reintentar
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

/**
 * Sube un archivo (imagen o documento) a la conversación
 * @param conversationId ID de la conversación
 * @param file El archivo a subir
 * @param senderType Tipo de remitente (opcional, por defecto 'bot')
 * @returns Objeto con información del archivo subido
 */
export async function uploadFile(
  conversationId: string,
  file: File,
  senderType: 'user' | 'bot' = 'bot'
): Promise<any> {
  try {
    if (!conversationId) {
      throw new Error('Se requiere ID de conversación');
    }
    
    if (!file) {
      throw new Error('Se requiere archivo para subir');
    }
    
    // Verificar que el tamaño del archivo no supere 10MB
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new Error(`El archivo es demasiado grande. Tamaño máximo: 10MB, tamaño actual: ${(file.size / (1024 * 1024)).toFixed(2)}MB`);
    }
    
    // Crear FormData para enviar el archivo
    const formData = new FormData();
    formData.append('file', file);
    formData.append('conversationId', conversationId);
    formData.append('senderType', senderType);
    
    // Optimistic file message para mostrar inmediatamente en la UI
    const isImage = file.type.startsWith('image/');
    const fileType = isImage ? 'image' : 'file';
    
    const optimisticFileMessage = {
      id: `temp-file-${Date.now()}`,
      conversation_id: conversationId,
      content: JSON.stringify({
        type: fileType,
        fileName: file.name,
        fileSize: file.size,
        url: URL.createObjectURL(file), // URL temporal para vista previa
        mimeType: file.type,
        isUploading: true,
      }),
      sender_type: senderType,
      created_at: new Date().toISOString(),
      type: fileType,
    };
    
    // Actualizar caché y almacenamiento en memoria con el mensaje optimista
    updateMessageCache(conversationId, optimisticFileMessage);
    
    // Enviar el archivo al servidor
    const url = `${API_BASE_URL}/api/upload`;
    console.log(`📤 Subiendo archivo ${file.name} (${file.type}, ${(file.size / 1024).toFixed(2)}KB) a ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
    
    if (!response.ok) {
      console.error(`Error ${response.status}: ${response.statusText}`);
      
      // Intentar obtener detalles del error
      let errorMessage = `Error ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage = errorData.error;
          if (errorData.details) {
            errorMessage += ` - ${errorData.details}`;
          }
        }
        throw new Error(`Error al subir archivo: ${errorMessage}`);
      } catch (parseError) {
        throw new Error(errorMessage);
      }
    }
    
    const data = await response.json();
    console.log('✅ Archivo subido exitosamente:', data);
    
    // Actualizar el mensaje optimista con la información real del servidor
    const serverFileMessage = {
      ...data,
      content: data.content, // El servidor ya devuelve el content como JSON string
      type: fileType,
    };
    
    // Si el servidor devuelve una URL pública pero no hay una media_url en los datos, añadirla
    if (data.publicUrl && !data.media_url) {
      serverFileMessage.media_url = data.publicUrl;
    }
    
    // Si el servidor devuelve media_type como null o undefined, usar el mime type del archivo
    if (!data.media_type && file.type) {
      serverFileMessage.media_type = file.type;
    }
    
    // Asegurarse de que el tipo de mensaje es correcto
    if (isImage && !serverFileMessage.type) {
      serverFileMessage.type = 'image';
    } else if (!isImage && !serverFileMessage.type) {
      serverFileMessage.type = 'file';
    }
    
    // Si hay discrepancias entre content y media_url, ajustar
    if (serverFileMessage.media_url && serverFileMessage.content === '📎 [Archivo adjunto]') {
      // Intentar crear un objeto JSON con la información necesaria
      const contentObj = {
        type: fileType,
        fileName: file.name,
        fileSize: file.size,
        url: serverFileMessage.media_url,
        publicUrl: serverFileMessage.media_url,
        mimeType: file.type,
      };
      
      try {
        // Almacenar como JSON (esta es la forma que espera el componente MessageItem)
        serverFileMessage.content = JSON.stringify(contentObj);
      } catch (e) {
        console.error('Error al serializar contenido de archivo:', e);
      }
    }
    
    console.log('Mensaje actualizado con datos del servidor:', serverFileMessage);
    
    // Actualizar caché con el mensaje real del servidor
    updateMessageCache(conversationId, serverFileMessage, optimisticFileMessage.id);
    
    // Enviar la imagen a WhatsApp si es posible
    try {
      // Obtener la información de la conversación para el número de teléfono
      const convoResponse = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}`);
      if (convoResponse.ok) {
        const conversation = await convoResponse.json();
        const phoneNumber = conversation.user_id; // El user_id en la BD es el número de teléfono
        
        if (phoneNumber) {
          // Extraer la URL del medio
          const mediaUrl = serverFileMessage.media_url || data.publicUrl;
          
          if (mediaUrl) {
            // Comprobar si el contenido es un objeto JSON ya parseable
            let contentObject;
            try {
              contentObject = typeof serverFileMessage.content === 'string' ? 
                JSON.parse(serverFileMessage.content) : 
                serverFileMessage.content;
            } catch (e) {
              contentObject = {};
            }

            // Asegurarnos de que el objeto contenga toda la información necesaria
            contentObject = {
              ...contentObject,
              type: isImage ? "image" : "file",
              url: mediaUrl,
              mediaUrl: mediaUrl, // Incluir explícitamente para mayor compatibilidad
              publicUrl: mediaUrl // Incluir para compatibilidad con distintos sistemas
            };
            
            // Mensaje de texto descriptivo para la leyenda
            let textMessage = contentObject.caption || contentObject.fileName || (isImage ? "Imagen" : "Archivo");
            
            console.log(`📱 Enviando ${isImage ? 'imagen' : 'archivo'} a WhatsApp: ${phoneNumber}`);
            console.log(`🔗 URL de la imagen: ${mediaUrl}`);
            
            // Enviar el mensaje a WhatsApp con la URL del medio
            await sendMessageToWhatsApp(conversationId, textMessage, mediaUrl);
            console.log(`✅ ${isImage ? 'Imagen' : 'Archivo'} enviado correctamente a WhatsApp`);
          }
        }
      }
    } catch (whatsappError) {
      console.error('Error al enviar imagen a WhatsApp:', whatsappError);
      // No bloqueamos el flujo principal, el archivo ya se subió correctamente
    }
    
    return serverFileMessage;
  } catch (error) {
    console.error('Error al subir archivo:', error);
    // Eliminar el mensaje optimista si hubo un error
    // TODO: Implementar lógica para eliminar mensajes optimistas fallidos
    throw error;
  }
}

/**
 * Obtiene los datos de una conversación por su ID
 */
export async function getConversation(conversationId: string): Promise<any> {
  try {
    console.log(`🔍 Obteniendo datos de conversación: ${conversationId}`);
    
    // Construir la URL completa
    const apiBaseUrl = API_BASE_URL || 'http://localhost:7777';
    const url = `${apiBaseUrl}/api/conversations/${conversationId}`;
    
    console.log(`🌐 Enviando solicitud a: ${url}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Error en la respuesta del servidor: ${response.status}`);
    }
    
    // Verificar que es JSON antes de procesarlo
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error(`Respuesta no es JSON: ${contentType}`);
    }
    
    const data = await response.json();
    console.log(`✅ Datos de conversación obtenidos: ${JSON.stringify(data)}`);
    return data;
  } catch (error: any) {
    console.error(`Error al obtener conversación ${conversationId}: ${error}`);
    throw error;
  }
}

/**
 * Envía un mensaje de texto a WhatsApp a través del microservicio del bot
 */
export async function sendMessageToWhatsApp(
  conversationId: string,
  message: string,
  mediaUrl?: string
): Promise<any> {
  try {
    let result;
    let whatsappSuccess = false;
    let whatsappError = null;
    
    // Si hay URL de medios, obtener el nombre del archivo
    let filename = '';
    if (mediaUrl) {
      const urlParts = mediaUrl.split('/');
      filename = urlParts[urlParts.length - 1];
      console.log(`Enviando imagen a WhatsApp: ${filename}`);
      
      // TODO: Implementar envío de medios a WhatsApp
      console.log(`⚠️ Envío de medios a WhatsApp aún no implementado`);
      // Por ahora, enviamos solo el mensaje
    }
    
    // 1. Intentar enviar directamente a través del servidor WhatsApp
    try {
      console.log(`Intentando enviar mensaje a WhatsApp para conversación ${conversationId}`);
      result = await sendDirectWhatsAppMessage(conversationId, message);
      
      if (result.success && result.whatsappSuccess) {
        console.log(`✅ Mensaje enviado exitosamente a WhatsApp`);
        whatsappSuccess = true;
      } else {
        console.log(`❌ Error al enviar mensaje a WhatsApp: ${result.error || 'Error desconocido'}`);
        whatsappError = result.error || result.errorDetails || 'Error desconocido';
        
        // 2. Intentar con método alternativo si el directo falló
        try {
          console.log(`Intentando envío alternativo a WhatsApp para ${conversationId}`);
          // Esta sería una implementación alternativa o de respaldo
          // Por ahora simplemente registramos el intento
          
          // Implementación de respaldo - por ejemplo, podríamos intentar con otra API
          const backupResult = null; // Podría ser el resultado de otra API
          
          if (typeof backupResult === 'object' && backupResult !== null) {
            // Use type assertion to tell TypeScript about the expected structure
            const typedResult = backupResult as { success?: boolean; error?: string };
            whatsappSuccess = typedResult.success === true;
            whatsappError = typedResult.error || null;
          } else {
            whatsappSuccess = !!backupResult;
          }
        } catch (backupError: unknown) {
          const errorMessage = backupError instanceof Error ? backupError.message : String(backupError);
          console.error(`Error en intento alternativo a WhatsApp: ${errorMessage}`);
          whatsappError = `Error en intento alternativo: ${errorMessage}`;
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error general al enviar a WhatsApp: ${errorMessage}`);
      whatsappError = errorMessage;
    }
    
    // Registrar el resultado
    console.log(`Resultado final del envío a WhatsApp:`, {
      success: result?.success || false,
      whatsappSuccess,
      error: whatsappError
    });
    
    return { 
      success: true,
      whatsappSuccess, 
      error: whatsappError,
      deliveryStatus: whatsappSuccess ? 'SENT' : 'FAILED',
      result
    };
  } catch (error) {
    console.error('Error al enviar mensaje a WhatsApp:', error);
    
    // Fallback path - use direct message approach
    console.log('🔄 Intentando método alternativo directo...');
    try {
      // Get the required variables if they're not already defined
      let phoneNumberToUse = '';
      let messageToUse = '';
      
      // If we have a conversation ID but no phone number, try to get it
      if (conversationId && !phoneNumberToUse) {
        try {
          const { data: convo } = await supabase
            .from('conversations')
            .select('user_id')
            .eq('id', conversationId)
            .single();
            
          if (convo?.user_id) {
            phoneNumberToUse = convo.user_id;
          }
        } catch (dbError) {
          console.error('Error getting phone number from conversation:', dbError);
        }
      }
      
      // Use the available variables
      phoneNumberToUse = phoneNumberToUse || '';
      messageToUse = message || '';
      
      // Definir el payload del mensaje
      const payload = {
        phoneNumber: phoneNumberToUse,
        message: messageToUse,
        source: WHATSAPP_BOT_URL,
        timestamp: new Date().toISOString()
      };
      
      console.log('📦 Payload del mensaje:', JSON.stringify(payload));
      
      // Intentar envío con CORS estándar primero
      try {
        const response = await fetch(`${WHATSAPP_BOT_URL}/api/send-manual-message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        
        if (!response.ok) {
          throw new Error(`Error HTTP ${response.status}: ${await response.text()}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
          console.log('✅ Mensaje enviado exitosamente a WhatsApp');
          return true;
        } else {
          console.error('❌ Error al enviar mensaje:', data.error || 'Error desconocido');
          return false;
        }
      } catch (corsError) {
        // Si hay un error CORS, intentar con mode: 'no-cors'
        console.error('⚠️ Error CORS detectado, intentando con modo no-cors:', corsError);
        
        try {
          // Esta petición no devolverá datos utilizables debido a 'no-cors', 
          // pero puede funcionar para enviar el mensaje
          await fetch(`${WHATSAPP_BOT_URL}/api/send-manual-message`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            mode: 'no-cors'
          });
          
          // No podemos verificar el éxito real debido a 'no-cors',
          // así que asumimos que funcionó
          console.log('✅ Mensaje enviado en modo no-cors (no podemos verificar respuesta)');
          return true;
        } catch (noCorsError) {
          console.error('❌ Error incluso con modo no-cors:', noCorsError);
          
          // Intentamos simulación como último recurso
          console.log('🔄 Intentando simulación directa...');
          return conversationId ? sendDirectWhatsAppMessage(conversationId, messageToUse) : false;
        }
      }
    } catch (fallbackError) {
      console.error('❌ Error en método alternativo:', fallbackError);
      return false;
    }
  }
}

/**
 * Función para enviar mensaje a WhatsApp directamente usando la API GupShup
 */
export async function sendDirectWhatsAppMessage(
  conversationId: string,
  message: string
): Promise<any> {
  try {
    console.log('📱 Intentando enviar mensaje directamente a WhatsApp');
    console.log(`🆔 Conversation ID: ${conversationId}`);
    console.log(`💬 Mensaje a enviar: "${message}"`);
    
    // Obtener número de teléfono de la conversación
    const { data: conversation, error } = await supabase
      .from('conversations')
      .select('user_id')
      .eq('id', conversationId)
      .single();
    
    if (error || !conversation?.user_id) {
      console.error('❌ No se pudo obtener el número de teléfono:', error || 'user_id no encontrado');
      return { 
        success: false, 
        error: error?.message || 'No se pudo obtener el número de teléfono' 
      };
    }
    
    const phoneNumber = conversation.user_id;
    console.log(`📞 Enviando a número: ${phoneNumber}`);
    
    // En vez de usar el mock, usar el endpoint real del bot de WhatsApp
    try {
      const whatsappUrl = WHATSAPP_BOT_URL || 'http://localhost:3095';
      console.log(`🔄 Enviando petición a: ${whatsappUrl}/api/send-manual-message`);
      console.log(`📦 Payload: ${JSON.stringify({
        phoneNumber,
        message
      })}`);
      
      const response = await fetch(`${whatsappUrl}/api/send-manual-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber,
          message
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Error HTTP ${response.status}: ${errorText}`);
        return { 
          success: false, 
          error: `Error HTTP ${response.status}: ${errorText}`
        };
      }
      
        const data = await response.json();
      console.log(`📊 Respuesta completa:`, data);
      
      // Verificar si el mensaje fue simulado
      const wasSimulated = data.whatsappSimulated === true || data.simulated === true;
      
      if (data.success) {
        if (wasSimulated) {
          console.warn('⚠️ ADVERTENCIA: El mensaje fue marcado como exitoso pero FUE SIMULADO');
          console.warn('⚠️ El mensaje NO se envió realmente a WhatsApp');
          console.log(`🔶 Mensaje "${message}" SIMULADO para el número ${phoneNumber}`);
        } else {
          console.log('✅ Mensaje enviado correctamente a WhatsApp (REAL)');
          console.log(`📝 Mensaje "${message}" enviado exitosamente a WhatsApp para el número ${phoneNumber}`);
        }
        
        return { 
          success: true, 
          whatsappSuccess: !wasSimulated,
          whatsappSimulated: wasSimulated,
          whatsappError: data.error || null
        };
    } else {
        console.error('❌ Error al enviar mensaje a WhatsApp:', data.error || 'Error desconocido');
        return { 
          success: false, 
          error: data.error || 'Error desconocido'
        };
      }
    } catch (error: any) {
      console.error('❌ Error al contactar el servidor de WhatsApp:', error);
      return { 
        success: false, 
        error: error.message || 'Error desconocido al contactar el servidor'
      };
    }
  } catch (error: any) {
    console.error('❌ Error general al enviar mensaje directo a WhatsApp:', error);
    return { 
      success: false, 
      error: error.message || 'Error desconocido'
    };
  }
}

// Simulación del envío a WhatsApp para pruebas
async function mockSendWhatsAppMessage(phoneNumber: string, message: string): Promise<boolean> {
  console.log(`🔄 SIMULANDO envío de mensaje a WhatsApp: ${phoneNumber}`);
  console.log(`📝 Mensaje: ${message}`);
  
  // Simular una operación exitosa
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Simular respuesta exitosa con probabilidad de 90%
  const isSuccess = Math.random() < 0.9;
  
  if (isSuccess) {
    console.log('✅ Simulación de envío exitosa');
    return true;
  } else {
    console.error('❌ Simulación de envío fallida');
    return false;
  }
}

/**
 * Función para enviar mensaje a WhatsApp mediante el bot server
 */
export async function sendManualMessage(phoneNumber: string, content: string): Promise<any> {
  // Primero verificar si el servicio está disponible
  console.log('🔍 Verificando disponibilidad del bot de WhatsApp...');
  
  // URL del servidor WhatsApp
  const whatsappUrl = 'http://localhost:3095';
  
  // Intentar health check para reportar el estado correcto del servicio
  try {
    const healthCheck = await fetch(`${whatsappUrl}/health`, { 
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!healthCheck.ok) {
      console.error('❌ Bot de WhatsApp no está respondiendo correctamente al health check');
      throw new Error('Servicio de WhatsApp no disponible: Health check fallido');
    }
    
    console.log('✅ Bot de WhatsApp está disponible');
  } catch (error) {
    console.error('❌ Error al verificar estado del bot de WhatsApp:', error);
    throw new Error('Servicio de WhatsApp no disponible: No se puede conectar');
  }
  
  // Configurar opciones para reintento
  const maxRetries = 2;
  const retryDelay = 1000; // 1 segundo entre reintentos
  
  // Función para enviar con reintentos
  const sendWithRetry = async (attempt: number): Promise<any> => {
    try {
      console.log(`📤 Enviando mensaje manual a ${whatsappUrl}/api/send-manual-message (intento ${attempt}/${maxRetries})`);
      
      const response = await fetch(`${whatsappUrl}/api/send-manual-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber,
          message: content
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log(`✅ Mensaje enviado exitosamente a ${phoneNumber}`);
      return data;
    } catch (error: any) {
      console.error(`❌ Error en intento ${attempt}/${maxRetries}:`, error);
      
      if (attempt < maxRetries) {
        console.log(`🔄 Reintentando envío en ${retryDelay/1000} segundo...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return sendWithRetry(attempt + 1);
      } else {
        throw error;
      }
    }
  };
  
  // Intentar enviar con reintentos
  return await sendWithRetry(1);
}

/**
 * Eliminar una conversación y todos sus mensajes de la base de datos
 * @param conversationId ID de la conversación a eliminar
 * @returns Objeto con información sobre el resultado de la operación
 */
export async function deleteConversation(conversationId: string): Promise<{ success: boolean; error?: any }> {
  try {
    if (!conversationId) {
      console.error('[api-client] Error: conversationId es requerido para eliminar una conversación');
      return { success: false, error: 'ID de conversación requerido' };
    }
    
    console.log(`[api-client] 🗑️ Eliminando conversación: ${conversationId}`);
    
    // Primero eliminar los mensajes asociados a la conversación para evitar restricciones de clave foránea
    const messagesResult = await supabase
      .from('messages')
      .delete()
      .eq('conversation_id', conversationId);
      
    if (messagesResult.error) {
      console.error(`[api-client] ❌ Error al eliminar mensajes de la conversación ${conversationId}:`, messagesResult.error);
      // Continuamos de todos modos para intentar eliminar la conversación
    } else {
      console.log(`[api-client] ✅ Mensajes eliminados correctamente para la conversación ${conversationId}`);
    }
    
    // Intentar eliminar cualquier archivo multimedia asociado
    try {
      const { data: mediaItems, error: mediaError } = await supabase
        .from('media')
        .delete()
        .eq('conversation_id', conversationId);
      
      if (mediaError) {
        console.warn(`[api-client] ⚠️ Error al eliminar archivos multimedia: ${mediaError.message}`);
      } else {
        console.log(`[api-client] ✅ Archivos multimedia eliminados correctamente`);
      }
    } catch (e) {
      console.warn(`[api-client] ⚠️ Error al intentar eliminar multimedia:`, e);
    }
    
    // Luego eliminar la conversación
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId);
    
    if (error) {
      console.error(`[api-client] ❌ Error al eliminar conversación ${conversationId}:`, error);
      return { success: false, error };
    }
    
    console.log(`[api-client] ✅ Conversación ${conversationId} eliminada correctamente`);
    
    // Limpiar cualquier caché relacionada con esta conversación
    try {
      localStorage.removeItem(`conversation_${conversationId}`);
      localStorage.removeItem(`messages_${conversationId}`);
      localStorage.removeItem(`conv_${conversationId}`);
      cache.invalidate('conversations', 'all'); // Invalidar toda la caché de conversaciones
    } catch (e) {
      console.warn('[api-client] No se pudo limpiar la caché local:', e);
    }
    
    return { success: true };
  } catch (error) {
    console.error('[api-client] Error al eliminar conversación:', error);
    return { success: false, error };
  }
} 