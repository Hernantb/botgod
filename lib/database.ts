import { supabase } from './supabase'
import { cache } from './cache'

// Types for compatibility
export interface Conversation {
  id: string
  user_id: string
  business_id?: string
  last_message: string
  last_message_time: string
  is_bot_active: boolean
  sender_name: string
  created_at: string
  messages?: Message[]  // Agregamos la relación con mensajes
}

export interface Message {
  id: string
  conversation_id: string
  content: string
  created_at: string
  sender_type: "user" | "bot" | "agent"
  read: boolean
}

export interface Profile {
  id: string
  email: string
  name?: string
  avatar_url?: string
  whatsapp_number?: string
}

// Cache de business_id por userId para evitar consultas repetidas
const businessIdCache = new Map<string, string>()

// Función para obtener el business_id (con caché en memoria)
async function getBusinessId(userId: string): Promise<string | null> {
  console.log('Getting business_id for user:', userId)
  
  // Verificar caché en memoria
  if (businessIdCache.has(userId)) {
    console.log('Business ID found in cache:', businessIdCache.get(userId))
    return businessIdCache.get(userId)!
  }

  try {
    console.log('Fetching business_id from database...')
    const { data: businessUser, error } = await supabase
      .from('business_users')
      .select('business_id')
      .eq('user_id', userId)
      .single()

    if (error) {
      console.error('Error getting business_id:', error)
      return null
    }

    if (!businessUser) {
      console.log('No business user found for userId:', userId)
      return null
    }

    console.log('Found business_id:', businessUser.business_id)
    // Guardar en caché
    businessIdCache.set(userId, businessUser.business_id)
    return businessUser.business_id
  } catch (error) {
    console.error('Error in getBusinessId:', error)
    return null
  }
}

// Debug function to check all messages
async function debugAllMessages() {
  const { data: messages, error } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('Error fetching all messages:', error)
    return
  }

  console.log('Latest 10 messages in database:', messages)
}

// Function to get user conversations
export async function fetchUserConversations(userId: string): Promise<Conversation[]> {
  try {
    // Cachear el business_id para reducir consultas
    if (!_userBusinessCache[userId]) {
      console.log('Fetching conversations for user:', userId)
      
      // Obtenemos los business_id asociados al usuario
      const { data: userBusinesses, error: buError } = await supabase
        .from('business_users')
        .select('business_id')
        .eq('user_id', userId)
      
      if (buError) {
        console.error('Error getting business IDs:', buError)
        return []
      }
      
      const businessIds = userBusinesses?.map(ub => ub.business_id) || []
      
      // Cachear el resultado para futuras llamadas
      _userBusinessCache[userId] = businessIds;
    }
    
    const businessIds = _userBusinessCache[userId] || [];
    
    if (businessIds.length === 0) {
      // Intentar recuperación solo si no hay datos en caché
      const { data: allBusinesses, error: allBError } = await supabase
        .from('businesses')
        .select('id')
        .limit(10)
      
      if (!allBError && allBusinesses && allBusinesses.length > 0) {
        allBusinesses.forEach(b => businessIds.push(b.id))
        _userBusinessCache[userId] = businessIds; // Actualizar la caché
      }
    }
    
    // Inicializamos un arreglo para almacenar todas las conversaciones
    let allConversations: Conversation[] = []
    
    // Si tenemos business_ids, obtenemos todas las conversaciones relacionadas
    if (businessIds.length > 0) {
      for (const businessId of businessIds) {
        // Obtener conversaciones solo para este negocio
        const { data: businessConversations, error: convError } = await supabase
          .from('conversations')
          .select('*')
          .eq('business_id', businessId)
          .order('last_message_time', { ascending: false })
        
        if (convError) {
          console.error(`Error getting conversations for business ${businessId}:`, convError)
          continue
        }
        
        if (businessConversations && businessConversations.length > 0) {
          // Agregar conversaciones sin duplicados
          const newConvs = businessConversations.filter(bc => 
            !allConversations.some(ac => ac.id === bc.id)
          )
          
          if (newConvs.length > 0) {
            allConversations = [...allConversations, ...newConvs]
          }
        }
      }
    }
    
    // Si no encontramos ninguna conversación, buscamos como respaldo
    if (allConversations.length === 0) {
      const { data: allConversations_backup, error: allConvError } = await supabase
        .from('conversations')
        .select('*')
        .order('last_message_time', { ascending: false })
        .limit(50) // Limitamos a 50 en lugar de 100 para optimizar
      
      if (!allConvError && allConversations_backup && allConversations_backup.length > 0) {
        const relevantConversations = allConversations_backup.filter(conv => 
          businessIds.includes(conv.business_id || '') || conv.user_id === userId
        )
        
        if (relevantConversations.length > 0) {
          allConversations = relevantConversations
        } else {
          // Si no hay conversaciones relevantes, mostrar todas como último recurso
          allConversations = allConversations_backup
        }
      }
    }
    
    // Crear un mapa para guardar en caché los permisos verificados
    if (!_conversationPermissionCache[userId]) {
      _conversationPermissionCache[userId] = {};
    }
    
    // Pre-verificar permisos para todas las conversaciones de una sola vez
    allConversations.forEach(conv => {
      _conversationPermissionCache[userId][conv.id] = true;
    });
    
    // Evitar las consultas múltiples de mensajes aquí para mejorar rendimiento
    return allConversations;
    
  } catch (error) {
    console.error('Error in fetchUserConversations:', error)
    return []
  }
}

// Caché para reducir consultas repetidas
const _userBusinessCache: Record<string, string[]> = {};
const _conversationPermissionCache: Record<string, Record<string, boolean>> = {};

// Function to get conversation messages
export async function fetchConversationMessages(conversationId: string, userId: string): Promise<Message[]> {
  try {
    // Verificar primero si el usuario tiene permiso para ver esta conversación
    if (_conversationPermissionCache[userId] && 
        _conversationPermissionCache[userId][conversationId] === true) {
      // Permiso ya verificado, continuar
    } else {
      // Verificar permiso para la conversación
      const hasPermission = await userHasPermissionForConversation(userId, conversationId);
      
      // Guardar resultado en caché
      if (!_conversationPermissionCache[userId]) {
        _conversationPermissionCache[userId] = {};
      }
      _conversationPermissionCache[userId][conversationId] = hasPermission;
      
      if (!hasPermission) {
        console.error(`User ${userId} does not have permission for conversation ${conversationId}`);
        return [];
      }
    }
    
    // Buscar mensajes en caché
    const cacheKey = `messages_${conversationId}`;
    const cachedData = _messageCache[cacheKey];
    
    // Si tenemos datos en caché y no han pasado más de 5 segundos, usar caché
    if (cachedData && (Date.now() - cachedData.timestamp < 5000)) {
      return cachedData.messages;
    }
    
    // Obtener mensajes de la base de datos
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
    
    // Guardar en caché
    _messageCache[cacheKey] = {
      messages: messages || [],
      timestamp: Date.now()
    };
    
    return messages || [];
  } catch (error) {
    console.error('Error in fetchConversationMessages:', error);
    return [];
  }
}

// Caché para almacenar mensajes temporalmente y reducir consultas
const _messageCache: Record<string, {messages: Message[], timestamp: number}> = {};

// Verify user permission for conversation
async function userHasPermissionForConversation(userId: string, conversationId: string): Promise<boolean> {
  try {
    // Obtener información de la conversación
    const { data: conversation, error } = await supabase
      .from('conversations')
      .select('business_id, user_id')
      .eq('id', conversationId)
      .single();
    
    if (error || !conversation) {
      return false;
    }
    
    // Verificar si el usuario es el propietario directo
    if (conversation.user_id === userId) {
      return true;
    }
    
    // Verificar si el usuario está asociado con el negocio
    if (conversation.business_id) {
      const { data: businessUser, error: buError } = await supabase
        .from('business_users')
        .select('id')
        .eq('user_id', userId)
        .eq('business_id', conversation.business_id)
        .single();
      
      if (!buError && businessUser) {
        return true;
      }
    }
    
    // Si llegamos aquí, el usuario no tiene permiso
    return false;
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
}

// Function to send a new message
export async function sendMessage(
  conversationId: string,
  content: string,
  userId: string,
  senderType: "user" | "bot" | "agent" = "user",
): Promise<Message | null> {
  try {
    // Verificar duplicados en caché
    const currentMessages = await cache.get('messages', conversationId) || []
    const isDuplicate = currentMessages.some((msg: Message) => 
      msg.content === content && 
      new Date(msg.created_at).getTime() > Date.now() - 5000
    )
    
    if (isDuplicate) {
      console.log('Preventing duplicate message')
      return null
    }

    const now = new Date().toISOString()
    const newMessage = {
      conversation_id: conversationId,
      content,
      sender_type: senderType,
      created_at: now,
      read: senderType === "user"
    }

    // Actualizar caché optimistamente
    const tempId = 'temp-' + Date.now()
    const tempMessage = { ...newMessage, id: tempId }
    await cache.set('messages', conversationId, [...currentMessages, tempMessage])

    // Insertar mensaje en la base de datos
    const { data: savedMessage, error } = await supabase
      .from('messages')
      .insert([newMessage])
      .select()
      .single()

    if (error || !savedMessage) {
      console.error('Error sending message:', error)
      // Revertir caché si hay error
      await cache.set('messages', conversationId, currentMessages)
      return null
    }

    // Actualizar caché con el mensaje real
    const updatedMessages = currentMessages.map((msg: Message) => 
      msg.id === tempId ? savedMessage : msg
    )
    await cache.set('messages', conversationId, updatedMessages)

    // Actualizar la conversación con el último mensaje
    const { error: updateError } = await supabase
      .from('conversations')
      .update({
        last_message: content,
        last_message_time: now
      })
      .eq('id', conversationId)

    if (updateError) {
      console.error('Error updating conversation:', updateError)
    }

    return savedMessage
  } catch (error) {
    console.error('Error in sendMessage:', error)
    return null
  }
}

// Function to create a new conversation
export async function createConversation(
  initialMessage: string,
  userId: string,
  recipientNumber: string,
): Promise<Conversation> {
  try {
    // First get the business_id for this user
    const { data: businessUser, error: businessError } = await supabase
      .from('business_users')
      .select('business_id')
      .eq('user_id', userId)
      .single()

    if (businessError) {
      console.error('Error getting business_id:', businessError)
      throw businessError
    }

    const now = new Date().toISOString()
    
    // Create the conversation
    const newConversation = {
      user_id: recipientNumber,
      business_id: businessUser.business_id,
      last_message: initialMessage,
      last_message_time: now,
      is_bot_active: true,
      sender_name: recipientNumber,
      created_at: now
    }

    const { data: conversation, error } = await supabase
      .from('conversations')
      .insert([newConversation])
      .select()
      .single()

    if (error) {
      console.error('Error creating conversation:', error)
      throw error
    }

    // Create initial message
    const newMessage = {
      conversation_id: conversation.id,
      content: initialMessage,
      sender_type: 'user',
      created_at: now,
      read: false
    }

    const { error: messageError } = await supabase
      .from('messages')
      .insert([newMessage])

    if (messageError) {
      console.error('Error creating initial message:', messageError)
      // No lanzamos error aquí porque la conversación ya fue creada
    }

    return conversation
  } catch (error) {
    console.error('Error in createConversation:', error)
    throw error
  }
}

// Function to get user profile
export async function getUserProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('Error fetching profile:', error)
    throw error
  }

  return data
}

// Function to find conversation by phone number
export async function findConversationByPhone(phoneNumber: string, userId: string): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', phoneNumber)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No conversation found
      return null
    }
    console.error('Error finding conversation:', error)
    throw error
  }

  return data
}

// Function to toggle bot status
export async function toggleBot(conversationId: string, isActive: boolean): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('conversations')
      .update({ is_bot_active: isActive })
      .eq('id', conversationId)

    if (error) {
      console.error('Error toggling bot:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error in toggleBot:', error)
    return false
  }
}

// Función de debug para verificar mensajes
export async function debugMessages(conversationId: string): Promise<void> {
  try {
    console.log('Debugging messages for conversation:', conversationId)
    
    // Consulta directa sin joins
    const { data: directMessages, error: directError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (directError) {
      console.error('Error in direct messages query:', directError)
      return
    }

    console.log('Direct messages query result:', {
      count: directMessages?.length || 0,
      messages: directMessages
    })

    // Consulta con join
    const { data: joinedMessages, error: joinedError } = await supabase
      .from('messages')
      .select(`
        *,
        conversations!messages_conversation_id_fkey (
          id,
          business_id
        )
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (joinedError) {
      console.error('Error in joined messages query:', joinedError)
      return
    }

    console.log('Joined messages query result:', {
      count: joinedMessages?.length || 0,
      messages: joinedMessages
    })

  } catch (error) {
    console.error('Error in debugMessages:', error)
  }
}

