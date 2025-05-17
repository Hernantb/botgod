import { supabase } from '../lib/supabase'
import { cache } from '../lib/cache'
import type { Conversation } from '../lib/database'

export async function fetchUserConversations(userId: string): Promise<Conversation[]> {
  // Intentar obtener del caché primero
  const cachedConversations = cache.get('conversations', userId)
  if (cachedConversations) {
    return cachedConversations
  }

  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Error fetching conversations:', error)
      return []
    }

    // Guardar en caché con expiración de 30 segundos
    cache.set('conversations', userId, data)
    return data
  } catch (error) {
    console.error('Error in fetchUserConversations:', error)
    return []
  }
}

export async function updateConversation(id: string, updates: Partial<Conversation>): Promise<void> {
  try {
    const { error } = await supabase
      .from('conversations')
      .update(updates)
      .eq('id', id)

    if (error) {
      console.error('Error updating conversation:', error)
    }

    // Invalidar caché para forzar recarga
    cache.invalidate('conversations', updates.user_id!)
  } catch (error) {
    console.error('Error in updateConversation:', error)
  }
}

export function invalidateConversationsCache(userId: string): void {
  cache.invalidate('conversations', userId)
}

/**
 * Elimina una conversación y todos sus mensajes del servidor
 * @param conversationId ID de la conversación a eliminar
 * @returns Objeto indicando éxito o error
 */
export async function deleteConversation(conversationId: string): Promise<{ success: boolean; error?: any }> {
  if (!conversationId) {
    console.error('Error: Se requiere ID de conversación para eliminar');
    return { success: false, error: 'ID de conversación requerido' };
  }

  console.log(`🗑️ Iniciando eliminación de conversación: ${conversationId}`);
  
  // Primero limpiar inmediatamente el caché local para mejorar la experiencia del usuario
  // Aunque la operación en el servidor falle, la UI ya no mostrará la conversación
  try {
    if (typeof window !== 'undefined') {
      console.log(`🧹 Limpiando caché local para conversación ${conversationId}...`);
      localStorage.removeItem(`conversation_${conversationId}`);
      localStorage.removeItem(`messages_${conversationId}`);
      localStorage.removeItem(`conv_${conversationId}`);
      
      // Limpiar cualquier otra referencia a esta conversación en el localStorage
      Object.keys(localStorage).forEach(key => {
        if (key.includes(conversationId)) {
          localStorage.removeItem(key);
        }
      });
    }
    
    // Invalidar caché en memoria antes de iniciar la eliminación
    console.log(`🔄 Invalidando caché en memoria...`);
    cache.invalidate('conversations', 'all');
  } catch (e) {
    console.warn('⚠️ No se pudo limpiar la caché local:', e);
    // Continuar con la eliminación aunque falle la limpieza de caché
  }
  
  // Variable para controlar si necesitamos una transacción
  const enableTransaction = false;
  
  try {
    // Enfoque más optimizado y rápido para evitar bloqueos
    console.log(`🚀 Iniciando eliminación rápida para conversación ${conversationId}`);
    
    // Realizar operaciones de eliminación en paralelo para reducir tiempo
    const deletePromises = [
      // 1. Eliminar mensajes (esto es lo que más tiempo toma normalmente)
      (async () => {
        try {
          const { error } = await supabase
            .from('messages')
            .delete()
            .eq('conversation_id', conversationId);
          
          if (error) {
            console.warn(`⚠️ Error al eliminar mensajes para conversación ${conversationId}:`, error);
            return { type: 'messages', success: false, error };
          }
          console.log(`✅ Mensajes eliminados para conversación ${conversationId}`);
          return { type: 'messages', success: true };
        } catch (e) {
          console.error(`❌ Error al eliminar mensajes:`, e);
          return { type: 'messages', success: false, error: e };
        }
      })(),
      
      // Nota: Se eliminó el código para borrar multimedia ya que la tabla 'media' no existe
    ];
    
    // Esperar a que terminen las operaciones en paralelo
    const results = await Promise.allSettled(deletePromises);
    console.log(`📊 Resultados de operaciones paralelas:`, 
      results.map(r => r.status === 'fulfilled' ? r.value : 'rejected'));
    
    // 3. Finalmente eliminar la conversación
    console.log(`🗑️ Eliminando registro principal de conversación ${conversationId}...`);
    const { error: deleteError } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId);
    
    if (deleteError) {
      console.error(`❌ Error al eliminar conversación ${conversationId}:`, deleteError);
      
      if (deleteError.code === 'PGRST301' || deleteError.message?.includes('permission denied')) {
        return { 
          success: false, 
          error: { 
            code: 'PERMISSION_DENIED', 
            message: 'No tienes permisos para eliminar conversaciones', 
            details: deleteError 
          }
        };
      }
      
      return { success: false, error: deleteError };
    }
    
    console.log(`✅ Conversación ${conversationId} eliminada exitosamente`);
    return { success: true };
    
  } catch (error) {
    console.error('❌ Error en deleteConversation:', error);
    return { success: false, error };
  }
} 