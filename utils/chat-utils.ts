import type { Conversation, Message, Business } from "../types/chat"
import { mockBusinesses, getConversationsByBusinessId, initializeConversations } from "../mock/conversations"
import { getMessagesForConversation } from "../mock/messages"
import { v4 as uuidv4 } from "uuid"

// Inicializar datos
const initializedConversations = initializeConversations()

// Función para obtener todas las conversaciones
export const getAllConversations = (): Conversation[] => {
  return [...initializedConversations].sort((a, b) => {
    // Ordenar por mensajes no leídos primero, luego por timestamp
    if (a.unread_count !== b.unread_count) {
      return b.unread_count - a.unread_count
    }
    return new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime()
  })
}

// Función para obtener conversaciones filtradas por business_id
export const getFilteredConversations = (
  businessId: string,
  query = "",
  filter: "all" | "unread" | "read" = "all",
): Conversation[] => {
  let filtered = getConversationsByBusinessId(businessId)

  // Aplicar filtro de búsqueda
  if (query) {
    const lowerQuery = query.toLowerCase()
    filtered = filtered.filter(
      (conv) =>
        conv.contact_name.toLowerCase().includes(lowerQuery) ||
        conv.contact_number.includes(query) ||
        conv.last_message.toLowerCase().includes(lowerQuery),
    )
  }

  // Aplicar filtro de estado
  if (filter === "unread") {
    filtered = filtered.filter((conv) => conv.unread_count > 0)
  } else if (filter === "read") {
    filtered = filtered.filter((conv) => conv.unread_count === 0)
  }

  // Ordenar por mensajes no leídos primero, luego por timestamp
  return filtered.sort((a, b) => {
    if (a.unread_count !== b.unread_count) {
      return b.unread_count - a.unread_count
    }
    return new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime()
  })
}

// Función para obtener una conversación por número de contacto
export const getConversationByContactNumber = (contactNumber: string, businessId: string): Conversation | undefined => {
  return initializedConversations.find(
    (conv) => conv.contact_number === contactNumber && conv.business_id === businessId,
  )
}

// Función para obtener mensajes de una conversación
export const getConversationMessages = (contactNumber: string, businessId: string): Message[] => {
  return getMessagesForConversation(contactNumber, businessId)
}

// Función para obtener un negocio por ID
export const getBusinessById = (businessId: string): Business | undefined => {
  return mockBusinesses.find((business) => business.id === businessId)
}

// Función para marcar una conversación como leída
export const markConversationAsRead = (contactNumber: string, businessId: string): Conversation | undefined => {
  const conversation = initializedConversations.find(
    (conv) => conv.contact_number === contactNumber && conv.business_id === businessId,
  )

  if (conversation) {
    conversation.unread_count = 0
    // También marcar todos los mensajes como leídos
    conversation.messages.forEach((msg) => {
      if (msg.status === "received") {
        msg.is_read = true
      }
    })
  }

  return conversation
}

// Función para formatear la fecha de un mensaje para mostrar
export const formatMessageTime = (timestamp: string): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    // Hoy - mostrar hora
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  } else if (diffDays === 1) {
    // Ayer
    return "Ayer"
  } else if (diffDays < 7) {
    // Esta semana - mostrar día
    const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
    return days[date.getDay()]
  } else {
    // Más de una semana - mostrar fecha
    return date.toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "2-digit" })
  }
}

// Función para formatear la fecha de la última actividad
export const formatLastActive = (timestamp: string): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))

  if (diffMinutes < 1) {
    return "ahora mismo"
  } else if (diffMinutes < 60) {
    return `hace ${diffMinutes} min`
  } else if (diffMinutes < 24 * 60) {
    const hours = Math.floor(diffMinutes / 60)
    return `hace ${hours} hora${hours > 1 ? "s" : ""}`
  } else {
    const days = Math.floor(diffMinutes / (24 * 60))
    if (days === 1) {
      return "ayer"
    } else if (days < 7) {
      return `hace ${days} días`
    } else {
      return date.toLocaleDateString([], { day: "2-digit", month: "2-digit" })
    }
  }
}

// Función para simular el envío de un nuevo mensaje
export const sendMessage = (
  contactNumber: string,
  businessId: string,
  message: string,
  messageType: Message["message_type"] = "text",
  mediaUrl?: string,
): Message => {
  const newMessage: Message = {
    id: uuidv4(),
    user_id: "business-user-id",
    message,
    message_type: messageType,
    status: "sent",
    last_message_time: new Date().toISOString(),
    created_at: new Date().toISOString(),
    business_id: businessId,
    is_bot_active: false,
    is_read: true,
    media_url: mediaUrl,
    contact_name: "Business",
  }

  // Actualizar la conversación con el último mensaje
  const conversation = initializedConversations.find(
    (conv) => conv.contact_number === contactNumber && conv.business_id === businessId,
  )

  if (conversation) {
    conversation.last_message = message
    conversation.last_message_time = newMessage.created_at
    conversation.messages.push(newMessage)
  }

  return newMessage
}

// Función para simular la recepción de un nuevo mensaje
export const receiveMessage = (
  contactNumber: string,
  businessId: string,
  message: string,
  messageType: Message["message_type"] = "text",
  mediaUrl?: string,
): Message => {
  const conversation = initializedConversations.find(
    (conv) => conv.contact_number === contactNumber && conv.business_id === businessId,
  )

  if (!conversation) {
    throw new Error(`Conversation not found for contact ${contactNumber}`)
  }

  const newMessage: Message = {
    id: uuidv4(),
    user_id: contactNumber,
    message,
    message_type: messageType,
    status: "received",
    last_message_time: new Date().toISOString(),
    created_at: new Date().toISOString(),
    business_id: null,
    is_bot_active: false,
    is_read: false,
    media_url: mediaUrl,
    contact_name: conversation.contact_name,
  }

  // Actualizar la conversación
  conversation.last_message = message
  conversation.last_message_time = newMessage.created_at
  conversation.unread_count += 1
  conversation.messages.push(newMessage)

  return newMessage
}

// Función para activar/desactivar el bot para un negocio
export const toggleBotStatus = async (businessId: string, active: boolean): Promise<boolean> => {
  try {
    // 1. Primero actualizar localmente para UI inmediata
    const conversations = getConversationsByBusinessId(businessId)
    conversations.forEach((conv) => {
      // Actualizar los mensajes enviados por el negocio
      conv.messages.forEach((msg) => {
        if (msg.business_id === businessId) {
          msg.is_bot_active = active
        }
      })
      
      // También actualizar el estado del bot en la base de datos para esta conversación
      if (conv.contact_number) {
        // Hacer la llamada a la API para actualizar el estado en la base de datos
        // Usamos el número de contacto como identificador para la API
        fetch(`/api/conversations/${conv.contact_number}/toggle-bot`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            active,
            businessId: businessId  // Incluir el business_id para asegurar la actualización correcta
          }),
        })
        .then(response => {
          if (!response.ok) {
            console.error(`Error al actualizar estado del bot para contacto ${conv.contact_number}:`, response.statusText)
          }
        })
        .catch(error => {
          console.error(`Error en la solicitud para actualizar el bot para contacto ${conv.contact_number}:`, error)
        })
      }
    })
    
    return true
  } catch (error) {
    console.error('Error al activar/desactivar el bot:', error)
    return false
  }
}

// Función para obtener estadísticas de mensajes
export const getMessageStats = (businessId: string) => {
  const conversations = getConversationsByBusinessId(businessId)
  let totalReceived = 0
  let totalSent = 0
  let totalUnread = 0

  conversations.forEach((conv) => {
    totalUnread += conv.unread_count

    conv.messages.forEach((msg) => {
      if (msg.status === "received") {
        totalReceived++
      } else {
        totalSent++
      }
    })
  })

  return {
    totalConversations: conversations.length,
    totalMessages: totalReceived + totalSent,
    totalReceived,
    totalSent,
    totalUnread,
    responseRate: totalSent > 0 ? (totalSent / (totalReceived + totalSent)) * 100 : 0,
  }
}

