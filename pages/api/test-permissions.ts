import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '../../lib/supabase'
import { PostgrestError } from '@supabase/supabase-js'

interface TestResults {
  auth: 'OK' | 'ERROR'
  authDetails: {
    userId: string
    role?: string
    email?: string
  } | null
  authError: PostgrestError | null
  conversationExists: boolean | null
  conversationData: Record<string, any> | null
  conversationReadError: PostgrestError | null
  messagesReadable: boolean | null
  messagesError: PostgrestError | null
  deleteConversationPermission: {
    success: boolean
    error?: PostgrestError | null
    data?: any
    fallbackTest?: string
    errorObj?: any
  } | null
  deleteMessagesPermission: {
    success: boolean
    error?: PostgrestError | null
    data?: any
    fallbackTest?: string
    errorObj?: any
  } | null
  testError: any
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Solo permitir peticiones POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const { conversationId } = req.body

  if (!conversationId) {
    return res.status(400).json({ error: 'Se requiere ID de conversación' })
  }

  try {
    console.log(`🔍 Test de permisos para conversación ${conversationId}`)
    
    // Verificar sesión de autenticación
    const { data: authData, error: authError } = await supabase.auth.getSession()
    
    const results: TestResults = {
      auth: authData && !authError ? 'OK' : 'ERROR',
      authDetails: authData?.session ? {
        userId: authData.session.user.id,
        role: authData.session.user.role,
        email: authData.session.user.email
      } : null,
      authError: authError as PostgrestError | null,
      conversationExists: null,
      conversationData: null,
      conversationReadError: null,
      messagesReadable: null,
      messagesError: null,
      deleteConversationPermission: null,
      deleteMessagesPermission: null,
      testError: null
    }
    
    // 1. Verificar si la conversación existe
    const { data: conversation, error: getError } = await supabase
      .from('conversations')
      .select('id, user_id, business_id, is_bot_active, sender_name, created_at')
      .eq('id', conversationId)
      .single()
    
    results.conversationExists = !getError
    results.conversationData = conversation
    results.conversationReadError = getError
    
    // 2. Verificar si podemos leer mensajes
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('id, created_at')
      .eq('conversation_id', conversationId)
      .limit(2)
    
    results.messagesReadable = !messagesError && messages ? true : false
    results.messagesError = messagesError
    
    // 3. Probar permiso de eliminación de mensajes (sin eliminar realmente)
    try {
      const deleteMessagesResult = await supabase.rpc('check_delete_permission', { 
        table_name: 'messages',
        record_id: conversationId,
        condition_column: 'conversation_id'
      })
      
      results.deleteMessagesPermission = {
        success: !deleteMessagesResult.error,
        error: deleteMessagesResult.error,
        data: deleteMessagesResult.data
      }
    } catch (error) {
      results.deleteMessagesPermission = { 
        success: false,
        fallbackTest: 'La función RPC check_delete_permission no existe',
        errorObj: error
      }
    }
    
    // 4. Probar permiso de eliminación de conversación (sin eliminar realmente)
    try {
      const deleteConvResult = await supabase.rpc('check_delete_permission', { 
        table_name: 'conversations',
        record_id: conversationId,
        condition_column: 'id'
      })
      
      results.deleteConversationPermission = {
        success: !deleteConvResult.error,
        error: deleteConvResult.error,
        data: deleteConvResult.data
      }
    } catch (error) {
      results.deleteConversationPermission = { 
        success: false,
        fallbackTest: 'La función RPC check_delete_permission no existe',
        errorObj: error
      }
    }
    
    res.status(200).json({ results })
  } catch (error) {
    console.error('Error en test de permisos:', error)
    res.status(500).json({ 
      error: 'Error al verificar permisos', 
      details: error 
    })
  }
} 