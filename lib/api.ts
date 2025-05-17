import { createClient } from '@supabase/supabase-js'

console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
console.log('Supabase Key available:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Verificar la conexión
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth state changed:', event, session?.user?.email)
})

// Tipos
export interface Message {
  id: string
  conversation_id: string
  content: string
  sender_type: 'user' | 'bot' | 'agent'
  read: boolean
  created_at: string
}

export interface Conversation {
  id: string
  user_id: string
  business_id: string
  last_message: string
  last_message_time: string
  is_bot_active: boolean
  sender_name: string
  created_at: string
  businesses?: {
    name: string
    whatsapp_number: string
  }
}

// API principal
export const api = {
  // Autenticación
  auth: {
    login: async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      if (error) throw error
      return data
    },

    logout: async () => {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },

    getSession: async () => {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) throw error
      return session
    }
  },

  // Mensajes y Conversaciones
  messages: {
    getConversations: async () => {
      console.log('Obteniendo conversaciones...')
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          businesses (
            name,
            whatsapp_number
          )
        `)
        .order('last_message_time', { ascending: false })

      if (error) {
        console.error('Error al obtener conversaciones:', error)
        throw error
      }
      console.log('Conversaciones obtenidas:', data)
      return data as Conversation[]
    },

    getMessages: async (conversationId: string) => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as Message[]
    },

    sendMessage: async (conversationId: string, content: string) => {
      // Primero obtenemos el business_id de la conversación
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .select('business_id')
        .eq('id', conversationId)
        .single()

      if (convError) throw convError

      // Insertamos el mensaje
      const { data: message, error: msgError } = await supabase
        .from('messages')
        .insert([{
          conversation_id: conversationId,
          content,
          sender_type: 'agent',
          read: true,
          created_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (msgError) throw msgError

      // Actualizamos el último mensaje de la conversación
      const { error: updateError } = await supabase
        .from('conversations')
        .update({
          last_message: content,
          last_message_time: new Date().toISOString()
        })
        .eq('id', conversationId)

      if (updateError) throw updateError

      return message
    },

    toggleBot: async (conversationId: string, isActive: boolean) => {
      const { data, error } = await supabase
        .from('conversations')
        .update({ is_bot_active: isActive })
        .eq('id', conversationId)
        .select()

      if (error) throw error
      return data[0] as Conversation
    }
  }
}

