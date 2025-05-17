// Tipos de mensajes de WhatsApp
export type MessageType = "text" | "image" | "document" | "audio" | "location" | "contact" | "template"

// Interfaces principales
export interface Message {
  id: string
  user_id: string
  message: string
  message_type: MessageType | null
  status: "received" | "sent"
  last_message_time: string
  created_at: string
  business_id: string | null
  is_bot_active: boolean
  is_read?: boolean // Campo adicional para UI
  media_url?: string // URL para medios adjuntos
  contact_name?: string // Nombre del contacto (para UI)
}

export interface Business {
  id: string
  name: string
  whatsapp_number: string
  profile_image?: string
  description?: string
  industry?: string
  created_at?: string
}

// Interfaz para conversaciones (agrupación de mensajes por contacto)
export interface Conversation {
  contact_name: string
  contact_number: string
  last_message: string
  last_message_time: string
  unread_count: number
  business_id: string
  messages: Message[]
  profile_picture?: string
}

