export interface UIMessage {
  id: string
  conversationId: string
  content: string
  timestamp: string
  status: 'sent' | 'delivered' | 'read' | 'pending'
  sender: 'me' | 'them'
  type: 'text' | 'image' | 'file'
  fileName?: string
  fileSize?: number
  fileUrl?: string
  sender_type?: 'user' | 'bot' | 'agent'
  created_at?: string
  read?: boolean
}

export interface UIConversation {
  id: string
  name: string
  lastMessage: string
  timestamp: string
  unread: boolean
  status: string
  labels: string[]
  isBusinessAccount: boolean
  botActive: boolean
  userCategory: string
  colorLabel?: string
  assignedTo?: string
  tag?: string
  user_id?: string
  manuallyMovedToAll?: boolean
  manuallyMovedToAllTimestamp?: string
}

export interface DatabaseMessage {
  id: string
  conversation_id: string
  message?: string
  content?: string
  message_type?: string
  status?: 'received' | 'sent' | 'delivered' | 'enqueued' | 'read' | 'pending'
  created_at: string
  sender_type?: 'user' | 'bot' | 'agent'
  business_id?: string
  phone_number?: string
  file_name?: string
  file_size?: number
  file_url?: string
  file_type?: 'image' | 'document' | 'video' | 'audio'
  read?: boolean
}

export interface DatabaseConversation {
  id: string
  user_id: string
  message?: string
  message_type?: string
  status?: 'received' | 'sent' | 'delivered' | 'enqueued' | 'read' | 'pending'
  last_message_time: string
  created_at: string
  business_id?: string
  is_bot_active: boolean
  last_message?: string
  unread_count?: number
  title?: string
  sender_name?: string
} 