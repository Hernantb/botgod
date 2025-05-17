export interface Conversation {
  id: string
  user_id: string
  sender_name?: string
  last_message?: string
  last_message_time: string
  created_at: string
  business_id?: string
  is_bot_active: boolean
  name?: string
  timestamp: string
  botEnabled?: boolean
}

export interface Message {
  id: string
  conversation_id: string
  content: string
  created_at: string
  sender_type: "user" | "bot" | "agent"
  user_id: string
  read: boolean
}

export interface Profile {
  id: string
  email: string
  name?: string
  avatar_url?: string
}

// Interfaces for the UI components
export interface UIConversation {
  id: string
  name: string
  lastMessage: string
  timestamp: string
  unread: boolean
  status: string
  isBusinessAccount: boolean
  labels: string[]
  colorLabel: string
  userCategory: "default" | "important" | "urgent" | "completed"
  assignedTo: string
  tag?: string
  botActive: boolean
  user_id?: string  // Para compatibilidad
  business_id?: string  // Para compatibilidad
  is_bot_active?: boolean  // Para compatibilidad
  sender_name?: string  // Para compatibilidad
  created_at?: string  // Para compatibilidad
  messages?: UIMessage[]  // Para compatibilidad
  phone?: string  // Para compatibilidad con chat-interface.tsx
  manuallyMovedToAll?: boolean  // Indica si fue movida manualmente a "Todos"
  manuallyMovedToAllTimestamp?: string  // Timestamp de cuando fue movida a "Todos"
}

export interface UIMessage {
  id: string
  conversationId: string
  content: string
  timestamp: string
  status: "sent" | "delivered" | "read" | "received" | "pending"
  sender: "me" | "them"
  type: "text" | "image" | "file"
  fileName?: string
  fileSize?: string
  user_id: string
  // Propiedades adicionales para manejo de imágenes
  media_url?: string
  media_type?: string
  file_name?: string
  file_size?: string
  publicUrl?: string
  error?: string
}

export interface MinimalChatViewProps {
  conversation: Conversation
  messages: UIMessage[]
  isLoading: boolean
  onSendMessage: (message: string) => void
  onBack: () => void
  onToggleBot: (active: boolean) => void
  onDeleteConversation: (conversation: Conversation) => void
  onUpdateConversation: (conversation: Conversation) => void
  business?: boolean
} 