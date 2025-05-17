import { supabase } from '../lib/supabase'
import { cache } from '../lib/cache'
import type { Message } from '../lib/database'
import { fetchMessages } from '@/lib/api-client'

// Definición de UIMessage para el uso interno en este archivo
interface UIMessage {
  id: string;
  conversationId: string;
  content: string;
  timestamp: string;
  sender: 'me' | 'them';
  status: string;
  type: string;
  user_id?: string;
  error?: boolean;
  sender_type?: string;
}

// Variables para almacenamiento en memoria
const inMemoryMessageStore = new Map<string, UIMessage[]>();
const requestsInProgress = new Map<string, Promise<UIMessage[]>>();
const lastRequestTime = new Map<string, number>();
const requestDebounceTime = 1000; // 1 segundo entre solicitudes
const recentMessages = new Map<string, { content: string, timestamp: number }>();

/**
 * Almacena mensajes en todos los sistemas disponibles: memoria, caché y localStorage
 * Esto garantiza que los mensajes persistan entre recargas de página
 */
export function storeMessages(conversationId: string, messages: UIMessage[]): void {
  try {
    if (!conversationId || !messages || !Array.isArray(messages)) {
      console.warn('❌ Intentando guardar mensajes con datos inválidos');
      return;
    }

    // Paso 1: Eliminar duplicados por ID
    const uniqueByIdMap = new Map<string, UIMessage>();
    messages.forEach(msg => {
      // Si ya existe un mensaje con el mismo ID, mantener el más reciente
      // (basado en el timestamp del mensaje)
      const existingMsg = uniqueByIdMap.get(msg.id);
      if (!existingMsg || new Date(msg.timestamp) > new Date(existingMsg.timestamp)) {
        uniqueByIdMap.set(msg.id, msg);
      }
    });
    
    // Paso 2: Eliminar duplicados por contenido y timestamp cercano
    const uniqueMessages: UIMessage[] = [];
    const seen = new Set<string>();
    
    Array.from(uniqueByIdMap.values()).forEach(msg => {
      // Crear una clave única basada en el contenido y remitente
      const contentKey = `${msg.sender}-${msg.content}`;
      
      // Verificar si ya existe un mensaje similar
      const isDuplicate = uniqueMessages.some(existingMsg => {
        // Mismo contenido y remitente
        if (existingMsg.content === msg.content && existingMsg.sender === msg.sender) {
          // Timestamp cercano (menos de 5 segundos de diferencia)
          const timeDiff = Math.abs(
            new Date(existingMsg.timestamp).getTime() - 
            new Date(msg.timestamp).getTime()
          );
          return timeDiff < 5000; // 5 segundos
        }
        return false;
      });
      
      // Si no es un duplicado o no lo hemos visto antes, lo agregamos
      if (!isDuplicate && !seen.has(contentKey)) {
        uniqueMessages.push(msg);
        seen.add(contentKey);
      } else if (isDuplicate) {
        // Opcional: registrar información sobre los duplicados encontrados
        console.log(`🔍 Mensaje duplicado detectado y filtrado: ${msg.content.substring(0, 20)}...`);
      }
    });

    // Ordenar mensajes por timestamp para mantener el orden cronológico
    uniqueMessages.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // 1. Guardar en memoria (más rápido para acceso repetido)
    inMemoryMessageStore.set(conversationId, [...uniqueMessages]);
    
    // 2. Guardar en caché (persistencia entre componentes)
    cache.set('messages', conversationId, uniqueMessages);
    
    // 3. Guardar en localStorage (persistencia entre recargas) usando setTimeout para no bloquear la UI
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        try {
          // Limitar la cantidad de mensajes guardados para evitar problemas de rendimiento
          const messagesToStore = uniqueMessages.length > 100 
            ? uniqueMessages.slice(uniqueMessages.length - 100) 
            : uniqueMessages;
          
          // Convertir a formato optimizado para localStorage
          const compactMessages = messagesToStore.map(msg => ({
            id: msg.id,
            content: msg.content,
            timestamp: msg.timestamp,
            sender: msg.sender,
            type: msg.type || 'text',
            status: msg.status || 'sent'
          }));
          
          localStorage.setItem(`messages_${conversationId}`, JSON.stringify(compactMessages));
          console.log(`🔒 Mensajes guardados en localStorage y memoria para conversación ${conversationId}`);
        } catch (e) {
          console.warn('Error al guardar mensajes en localStorage:', e);
        }
      }, 0);
    }
  } catch (error) {
    console.error('Error al almacenar mensajes:', error);
  }
}

/**
 * Obtiene los mensajes para una conversación específica
 * Esta función se asegura de filtrar adecuadamente por ID de conversación
 * e implementa debounce para evitar llamadas API excesivas
 */
export async function getMessagesForConversation(conversationId: string) {
  try {
    if (!conversationId) {
      console.error('❌ Error: se requiere un ID de conversación válido');
      return [];
    }
    
    console.log(`🔄 Obteniendo mensajes para conversación: ${conversationId}`);
    
    // Obtener mensajes directamente desde Supabase en lugar de usar la API
    const { data: messagesData, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
    
    if (error) {
      console.error('❌ Error al obtener mensajes de Supabase:', error);
      return [];
    }
    
    console.log(`✅ Supabase devolvió ${messagesData?.length || 0} mensajes para conversación ${conversationId}`);
    
    // Deduplicar mensajes por ID y contenido/timestamp
    const uniqueMessages = new Map<string, Message>();
    messagesData.forEach((msg: Message) => {
      const existingMsg = uniqueMessages.get(msg.id);
      if (!existingMsg) {
        // Si no existe mensaje con ese ID, verificar duplicados por contenido/timestamp
        const isDuplicate = Array.from(uniqueMessages.values()).some(existing => 
          existing.content === msg.content && 
          Math.abs(new Date(existing.created_at).getTime() - 
                  new Date(msg.created_at).getTime()) < 5000
        );
        
        if (!isDuplicate) {
          uniqueMessages.set(msg.id, msg);
        }
      }
    });
    
    // Convertir a array y ordenar
    const allMessages = Array.from(uniqueMessages.values());
    allMessages.sort((a, b) => {
      const getTimestamp = (msg: Message): number => {
        return new Date(msg.created_at).getTime();
      };
      return getTimestamp(a) - getTimestamp(b);
    });
    
    // Transformar mensajes al formato UI
    const uiMessages: UIMessage[] = allMessages.map(msg => ({
      id: msg.id,
      conversationId: msg.conversation_id,
      content: msg.content,
      timestamp: msg.created_at,
      sender: (msg.sender_type === 'bot' || msg.sender_type === 'agent') ? 'me' : 'them' as const,
      status: 'sent',
      type: 'text',
      sender_type: msg.sender_type
    }));
    
    // Guardar los mensajes en todos los sistemas
    storeMessages(conversationId, uiMessages);
    
    return uiMessages;
  } catch (error) {
    console.error('❌ Error general obteniendo mensajes:', error);
    return [];
  }
}

export async function fetchConversationMessages(conversationId: string, userId: string): Promise<Message[]> {
  // Intentar obtener del caché primero
  const cachedMessages = await cache.get('messages', conversationId)
  if (cachedMessages) {
    return cachedMessages as Message[]
  }

  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error fetching messages:', error)
      return []
    }

    // Invertir para mantener el orden cronológico
    const chronologicalMessages = [...data].reverse()
    
    // Guardar en caché con expiración de 30 segundos
    await cache.set('messages', conversationId, chronologicalMessages)
    return chronologicalMessages as Message[]
  } catch (error) {
    console.error('Error in fetchConversationMessages:', error)
    return []
  }
}

export async function sendMessage(message: Partial<Message>): Promise<Message | null> {
  try {
    // Verificar si es un mensaje duplicado reciente (dentro de 5 segundos)
    const key = `${message.conversation_id}-${message.content}`
    const recentMessage = recentMessages.get(key)
    if (recentMessage && Date.now() - recentMessage.timestamp < 5000) {
      console.log('Preventing duplicate message')
      return null
    }

    // Registrar el mensaje como reciente
    recentMessages.set(key, {
      content: message.content!,
      timestamp: Date.now()
    })

    // Limpiar mensajes antiguos (más de 10 segundos)
    for (const [key, value] of recentMessages.entries()) {
      if (Date.now() - value.timestamp > 10000) {
        recentMessages.delete(key)
      }
    }

    // Verificar si el mensaje ya existe en la base de datos
    // Intentar conseguir mensajes recientes para esta conversación
    try {
      const { data: existingMessages, error: queryError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', message.conversation_id)
        .eq('content', message.content)
        .order('created_at', { ascending: false })
        .limit(5)
      
      if (existingMessages && existingMessages.length > 0) {
        // Verificar si hay mensajes idénticos recientes (dentro de 5 segundos)
        const isDuplicate = existingMessages.some(msg => {
          const msgTime = new Date(msg.created_at).getTime();
          const now = Date.now();
          return now - msgTime < 5000;
        });
        
        if (isDuplicate) {
          console.log('Mensaje duplicado detectado en la base de datos');
          return existingMessages[0];
        }
      }
    } catch (err) {
      console.error('Error al verificar duplicados:', err);
    }

    const { data, error } = await supabase
      .from('messages')
      .insert([message])
      .select()
      .single()

    if (error) {
      console.error('Error sending message:', error)
      return null
    }

    if (data) {
      // Obtener mensajes actuales de la conversación para asegurar consistencia
      const existingMessages = await getMessagesForConversation(data.conversation_id) || [];
      
      // Asegurar que el mensaje no esté duplicado
      const messageExists = existingMessages.some((m: any) => 
        m.id === data.id || 
        (m.content === data.content && 
         Math.abs(new Date(m.timestamp || m.created_at).getTime() - new Date(data.created_at).getTime()) < 5000)
      );
      
      if (!messageExists) {
        // Convertir el mensaje al formato UIMessage
        const uiMessage: UIMessage = {
          id: data.id,
          conversationId: data.conversation_id,
          content: data.content || '',
          timestamp: data.created_at,
          sender: data.sender_type === 'agent' ? 'me' : 'them',
          status: 'sent',
          type: 'text',
          sender_type: data.sender_type
        };
        
        // Agregar el mensaje a la colección existente y guardar en todos los sistemas
        const updatedMessages = [...existingMessages, uiMessage];
        storeMessages(data.conversation_id, updatedMessages);
        
        console.log(`✅ Mensaje agregado y guardado correctamente en la conversación real: ${data.conversation_id}`);
      }
    }

    return data
  } catch (error) {
    console.error('Error in sendMessage:', error)
    return null
  }
}

export async function updateMessageRead(messageId: string, read: boolean): Promise<void> {
  try {
    const { error } = await supabase
      .from('messages')
      .update({ read })
      .eq('id', messageId)

    if (error) {
      console.error('Error updating message read status:', error)
    }
  } catch (error) {
    console.error('Error in updateMessageRead:', error)
  }
}

export function invalidateMessagesCache(conversationId: string): void {
  cache.invalidate('messages', conversationId)
}

export async function handleOptimisticMessageUpdate(
  conversationId: string,
  tempMessage: Message,
  finalMessage: Message
): Promise<void> {
  try {
    // Verificar si el mensaje temporal existe antes de actualizarlo
    const cachedMessages = await cache.get('messages', conversationId) as Message[] || []
    const tempExists = cachedMessages.some((m: Message) => m.id === tempMessage.id)
    
    if (tempExists) {
      await cache.handleOptimisticUpdate('messages', conversationId, tempMessage, finalMessage)
    }
  } catch (error) {
    console.error('Error in handleOptimisticMessageUpdate:', error)
  }
}

/**
 * Servicio para manejo de mensajes y conversaciones
 * Este archivo contiene funciones relacionadas con la transformación, carga y
 * procesamiento de mensajes para el sistema de chat.
 */

/**
 * Transforma un mensaje de la base de datos al formato UI
 */
export function transformMessage(message: any): UIMessage {
  // Verificar si el mensaje ya tiene el formato UIMessage
  if (message.sender === 'me' || message.sender === 'them') {
    // Asegurar que tiene sender_type si ya tiene sender
    if (!message.sender_type) {
      message.sender_type = message.sender === 'me' ? 'agent' : 'user';
    }
    return message as UIMessage;
  }
  
  // Asegurarse de que siempre hay un timestamp válido
  let timestamp = message.timestamp || message.created_at || new Date().toISOString();
  
  // Verificar y corregir formato de timestamp si es necesario
  if (typeof timestamp === 'string') {
    const parsedDate = new Date(timestamp);
    if (!isNaN(parsedDate.getTime())) {
      // Si es válido, normalizar al formato ISO estándar
      timestamp = parsedDate.toISOString();
    } else {
      // Si no es válido, usar la hora actual
      console.warn(`Timestamp inválido detectado: ${timestamp}, usando hora actual`);
      timestamp = new Date().toISOString();
    }
  } else if (timestamp instanceof Date) {
    timestamp = timestamp.toISOString();
  } else {
    // Para cualquier otro tipo, usar la hora actual
    timestamp = new Date().toISOString();
  }
  
  // Determinar si el mensaje es enviado por el sistema (me) o por el usuario (them)
  let isSentByMe = false;
  
  // La regla más importante: los mensajes con sender_type 'agent' o 'bot' se muestran a la derecha (me)
  if (message.sender_type === 'agent' || message.sender_type === 'bot' || message.sender_type === 'system') {
    isSentByMe = true;
  }
  
  // Si es una conversación específica del dashboard, hacer verificación adicional
  const conversationId = message.conversation_id || message.conversationId;
  if (conversationId === '4a42aa05-2ffd-418b-aa52-29e7c571eee8') {
    // Si no tiene sender_type pero viene de esta conversación específica, 
    // asumir que es mensaje del dashboard
    if (!message.sender_type) {
      isSentByMe = true;
      message.sender_type = 'agent';
    }
  }
  
  // Contenido del mensaje
  const content = message.content || message.message || "";
  
  // Log para depuración
  console.log(`Mensaje ${message.id?.substring(0, 8) || 'nuevo'}: sender_type=${message.sender_type}, visualización=${isSentByMe ? 'derecha (me)' : 'izquierda (them)'}`);
  
  // Crear y devolver el mensaje en formato UI
  return {
    id: message.id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    conversationId: message.conversationId || message.conversation_id,
    content: content,
    timestamp: timestamp,
    sender: isSentByMe ? 'me' : 'them',
    status: message.status || "sent",
    type: message.type || "text",
    user_id: message.user_id || "",
    sender_type: message.sender_type || (isSentByMe ? 'agent' : 'user'),
    error: message.error || false
  };
}

/**
 * Transforma un array de mensajes del formato API al formato UI
 */
export function transformMessages(messages: any[]): UIMessage[] {
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    console.log('No hay mensajes para transformar o el formato es inválido');
    return [];
  }
  
  try {
    // Asegurar que el array esté ordenado cronológicamente
    const sortedMessages = [...messages].sort((a, b) => {
      const dateA = new Date(a.created_at || a.timestamp).getTime();
      const dateB = new Date(b.created_at || b.timestamp).getTime();
      return dateA - dateB;
    });
    
    // Mapear los mensajes al formato de la UI
    return sortedMessages.map(msg => {
      if (!msg) return null;
      
      // Usar la función transformMessage para mantener la misma lógica
      return transformMessage(msg);
    }).filter(Boolean) as UIMessage[]; // Filtrar valores nulos
  } catch (error) {
    console.error('Error al transformar mensajes:', error);
    return [];
  }
}

/**
 * Maneja la llegada de un nuevo mensaje
 */
export const handleNewMessage = (
  message: any,
  currentMessages: UIMessage[],
  setMessages: React.Dispatch<React.SetStateAction<UIMessage[]>> | ((updater: (messages: UIMessage[]) => UIMessage[]) => void),
  updateConversation?: (id: string, lastMessage: string, timestamp: string) => void,
  scrollToBottom?: () => void
) => {
  if (!message) {
    console.warn('Mensaje nulo o indefinido recibido');
    return;
  }

  try {
    // Transformar el mensaje al formato de UI
    const transformedMessage = transformMessage(message);
    
    if (!transformedMessage) {
      console.warn('No se pudo transformar el mensaje', message);
      return;
    }
    
    // Verificar si el mensaje ya existe para evitar duplicados
    // Usar una función de actualización compatible con ambos tipos de setMessages
    const updateMessagesFunction = (prevMessages: UIMessage[]) => {
      // Verificación primaria: si el ID ya existe, no hacer nada
      const exactDuplicate = prevMessages.find(msg => msg.id === transformedMessage.id);
      if (exactDuplicate) {
        console.log(`🔍 Mensaje con ID duplicado detectado y filtrado: ${transformedMessage.id}`);
        return prevMessages;
      }
      
      // Verificación secundaria: buscar mensajes con el mismo contenido, remitente y timestamp cercano
      const similarDuplicate = prevMessages.find(msg => {
        // Mismo contenido y remitente
        if (msg.content === transformedMessage.content && 
            msg.sender === transformedMessage.sender) {
          // Timestamp cercano (menos de 5 segundos)
          const timeDiff = Math.abs(
            new Date(msg.timestamp).getTime() - 
            new Date(transformedMessage.timestamp).getTime()
          );
          return timeDiff < 5000; // 5 segundos
        }
        return false;
      });
      
      if (similarDuplicate) {
        console.log(`🔍 Mensaje similar detectado y filtrado. Contenido: ${transformedMessage.content.substring(0, 20)}...`);
        return prevMessages;
      }
      
      // Si no es duplicado, añadir a la lista y ordenar por timestamp
      const sortedMessages = [...prevMessages, transformedMessage].sort((a, b) => {
        const dateA = new Date(a.timestamp).getTime();
        const dateB = new Date(b.timestamp).getTime();
        return dateA - dateB;
      });
      
      // Hacer scroll después de que se actualice el estado
      if (scrollToBottom) {
        setTimeout(() => scrollToBottom(), 100);
      }
      
      // Actualizar mensajes en almacenamiento persistente
      if (transformedMessage.conversationId) {
        storeMessages(transformedMessage.conversationId, sortedMessages);
      }
      
      return sortedMessages;
    };
    
    // Llamar a setMessages con la función de actualización
    setMessages(updateMessagesFunction);
    
    // Actualizar la conversación en la lista para reflejar el último mensaje
    if (updateConversation && transformedMessage.conversationId) {
      updateConversation(
        transformedMessage.conversationId,
        transformedMessage.content,
        transformedMessage.timestamp
      );
    }
  } catch (error) {
    console.error('❌ Error al manejar mensaje nuevo:', error);
  }
}; 