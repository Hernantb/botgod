import { createClient } from '@supabase/supabase-js'

// Claves de Supabase directas actualizadas con las proporcionadas por el usuario
const DIRECT_URL = 'https://wscijkxwevgxbgwhbqtm.supabase.co'
const DIRECT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4MjI3NjgsImV4cCI6MjA1NzM5ODc2OH0._HSnvof7NUk6J__qqq3gJvbJRZnItCAmlI5HYAL8WVI'

// Habilitar logs siempre para facilitar diagnóstico
const DEBUG = true;

console.log('🔄 Inicializando Supabase Realtime');

// Crear UNA SOLA instancia del cliente Supabase para toda la aplicación
// Esto evita la advertencia "Multiple GoTrueClient instances"
export const supabase = createClient(DIRECT_URL, DIRECT_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'supabase.auth.token',
  },
  global: {
    headers: {
      'x-client-info': 'chat-control-panel/1.0.0',
    },
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

// Habilitar realtime explícitamente
supabase.realtime.setAuth(DIRECT_KEY);
console.log('🔑 Autenticación Realtime configurada');

// Crear canal principal para mensajes
const mainChannel = supabase.channel('main-channel');
mainChannel.subscribe((status) => {
  console.log(`Estado del canal principal: ${status}`);
});

// Registrar canales activos para evitar duplicados
const activeChannels = new Map();

// Mantener un conjunto de mensajes recibidos recientemente para evitar duplicados
const recentlyReceivedMessages = new Set<string>();

// Configuración global para el canal de realtime
export const setupRealtimeChannels = () => {
  // Canal de mensajes global que podemos reutilizar
  const messagesChannel = supabase.channel('public:messages');
  
  // Conectar el canal pero sin suscripciones específicas todavía
  messagesChannel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      if (DEBUG) {
        console.log('✅ Canal global de mensajes conectado correctamente');
      }
    } else if (status === 'CHANNEL_ERROR') {
      if (DEBUG) {
        console.error('❌ Error en el canal de mensajes');
      }
    }
  });
  
  // Devolver el canal para uso posterior
  return messagesChannel;
}

/**
 * Suscribirse a mensajes en tiempo real para una conversación específica
 * @param conversationId ID de la conversación para escuchar
 * @param callback Función a llamar cuando se recibe un mensaje
 * @returns Objeto con método para cancelar la suscripción
 */
export function subscribeToConversationMessages(
  conversationId: string, 
  callback: (payload: any) => void
) {
  if (!conversationId) {
    console.error('❌ No se puede suscribir: conversationId es requerido');
    return { unsubscribe: () => {} };
  }

  // Activar logs siempre para diagnosticar problemas de tiempo real
  const log = (message: string) => console.log(message);

  log(`🔔 [${new Date().toISOString()}] Creando suscripción para conversación: ${conversationId}`);
  
  try {
    // Crear un canal con un nombre único basado en la conversación
    const channelName = `messages-${conversationId}-${Date.now()}`;
    log(`📡 Creando canal: ${channelName}`);
    
    // Crear el canal con opciones de realtime
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*', // Escuchar todos los eventos (INSERT, UPDATE, DELETE)
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        // Si no hay datos o no hay mensaje nuevo, ignorar
        if (!payload || !payload.new) {
          return;
        }

        const messageId = (payload.new as any).id || 'desconocido';
        const messageContent = (payload.new as any).content || '';
        
        // Crear una clave única para el mensaje (ID + primeros caracteres del contenido)
        const messageKey = `${messageId}:${messageContent.substring(0, 20)}`;
        
        // Verificar si ya hemos procesado este mensaje recientemente (dentro de 10 segundos)
        if (recentlyReceivedMessages.has(messageKey)) {
          log(`🔄 [${new Date().toISOString()}] Mensaje ya recibido, ignorando duplicado: ${messageKey}`);
          return;
        }
        
        // Registrar este mensaje como recibido
        recentlyReceivedMessages.add(messageKey);
        
        // Configurar un timeout para remover este mensaje del conjunto después de 10 segundos
        setTimeout(() => {
          recentlyReceivedMessages.delete(messageKey);
        }, 10000); // 10 segundos
        
        log(`📨 [${new Date().toISOString()}] Evento recibido: ${payload.eventType} para mensaje ${messageId}`);
        log(`📨 Datos: ${JSON.stringify(payload.new)}`);
        
        // Llamar al callback con la carga útil
        callback(payload);
      })
      .subscribe((status) => {
        log(`🔄 [${new Date().toISOString()}] Estado de la suscripción para ${conversationId}: ${status}`);
        if (status === 'SUBSCRIBED') {
          log(`✅ Suscripción activa para conversación ${conversationId}`);
          
          // Enviar un mensaje de test al suscribirse para verificar que la conexión funciona
          try {
            mainChannel.send({
              type: 'broadcast',
              event: 'test',
              payload: { message: `Suscripción activa para ${conversationId}` },
            });
          } catch (e) {
            log(`⚠️ No se pudo enviar mensaje de test: ${e}`);
          }
        } else if (status === 'CHANNEL_ERROR') {
          log(`❌ Error en la suscripción para conversación ${conversationId}`);
        }
      });

    // Devolver un objeto con método unsubscribe
    return {
      unsubscribe: () => {
        log(`🔕 [${new Date().toISOString()}] Cancelando suscripción para ${conversationId}`);
        try {
          channel.unsubscribe();
          log(`✅ Suscripción cancelada para ${conversationId}`);
        } catch (err) {
          log(`❌ Error al cancelar suscripción: ${err}`);
        }
      }
    };
  } catch (error) {
    log(`❌ Error al crear suscripción: ${error}`);
    return { unsubscribe: () => {} };
  }
}

// Función de utilidad para obtener la sesión actual con manejo de errores mejorado
export const getCurrentSession = async () => {
  try {
    // Intentar obtener la sesión del cliente
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error) {
      if (DEBUG) {
        console.error('Error al obtener la sesión:', error)
      }
      return null
    }
    
    // Si no hay sesión pero hay token en localStorage, intentar recuperarla
    if (!session && typeof window !== 'undefined') {
      const token = localStorage.getItem('supabase.auth.token')
      if (token) {
        if (DEBUG) {
          console.log('Intentando recuperar sesión desde token almacenado')
        }
        try {
          // Refrescar la sesión
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
          
          if (refreshError) {
            if (DEBUG) {
              console.error('Error al refrescar la sesión:', refreshError)
            }
            return null
          }
          
          return refreshData.session
        } catch (refreshError) {
          if (DEBUG) {
            console.error('Error inesperado al refrescar sesión:', refreshError)
          }
          return null
        }
      }
    }
    
    return session
  } catch (error) {
    if (DEBUG) {
      console.error('Error inesperado al obtener la sesión:', error)
    }
    return null
  }
}

// Function to get business_id for a user
export const getBusinessId = async (userId: string) => {
  if (!userId) {
    if (DEBUG) {
      console.error('[supabase] userId es undefined o null en getBusinessId')
    }
    return null
  }

  try {
    if (DEBUG) {
      console.log(`[supabase] Buscando business_id para usuario: ${userId}`)
    }
    
    // Verificar si ya tenemos el business_id en localStorage para este usuario
    if (typeof window !== 'undefined') {
      const storedId = localStorage.getItem('businessId');
      if (storedId) {
        if (DEBUG) {
          console.log(`[supabase] Business ID encontrado en localStorage: ${storedId}. Verificando si es válido...`);
        }
        
        // Verificar que el ID almacenado es válido para este usuario
        const { data: validCheck, error: validError } = await supabase
          .from('business_users')
          .select('business_id')
          .eq('user_id', userId)
          .eq('business_id', storedId)
          .eq('is_active', true)
          .maybeSingle();
          
        if (!validError && validCheck?.business_id) {
          if (DEBUG) {
            console.log(`[supabase] Business ID en localStorage verificado como válido: ${validCheck.business_id}`);
          }
          return {
            businessId: validCheck.business_id,
            role: 'verified'
          };
        } else {
          if (DEBUG) {
            console.warn(`[supabase] Business ID en localStorage no es válido para este usuario o hay un error:`, validError);
          }
          // Continuar con la consulta normal
        }
      }
    }
    
    // Obtener el business_id de la base de datos
    const { data, error } = await supabase
      .from('business_users')
      .select('business_id, role')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle()

    if (error) {
      if (DEBUG) {
        console.error('[supabase] Error al obtener business_id:', error);
      }
      
      // Depuración: buscar business_users disponibles
      const { data: allUsers, error: allUsersError } = await supabase
        .from('business_users')
        .select('user_id, business_id')
        .limit(5);
        
      if (!allUsersError && allUsers?.length > 0) {
        if (DEBUG) {
          console.log('[supabase] Algunos business_users disponibles:', 
            JSON.stringify(allUsers.map(u => ({ user: u.user_id, business: u.business_id })))
          );
        }
      }
      
      return null;
    }

    if (!data?.business_id) {
      if (DEBUG) {
        console.error(`[supabase] Usuario ${userId} no tiene acceso a ningún negocio (o no está activo)`);
      }
      
      // Depuración: buscar si hay negocios disponibles
      const { data: businesses, error: bizError } = await supabase
        .from('businesses')
        .select('id, name')
        .limit(5);
        
      if (!bizError && businesses?.length > 0) {
        if (DEBUG) {
          console.log('[supabase] Algunos negocios disponibles:', 
            JSON.stringify(businesses.map(b => ({ id: b.id, name: b.name })))
          );
        }
      }
      
      return null;
    }

    if (DEBUG) {
      console.log(`[supabase] Business ID encontrado para usuario ${userId}: ${data.business_id}`);
    }
    
    // Guardar en localStorage para futuros usos
    if (typeof window !== 'undefined') {
      localStorage.setItem('businessId', data.business_id);
      localStorage.setItem('userRole', data.role || 'viewer');
    }
    
    return {
      businessId: data.business_id,
      role: data.role
    };
  } catch (error) {
    if (DEBUG) {
      console.error('[supabase] Error inesperado al obtener business_id:', error);
    }
    return null;
  }
}

// Types
export interface Message {
  id: string
  created_at: string
  content: string
  role: string
  conversation_id: string
  metadata?: any
}

export interface Conversation {
  id: string
  created_at: string
  title: string
  business_id: string
  metadata?: any
}

export interface Profile {
  id: string
  created_at: string
  email: string
  full_name: string
  avatar_url?: string
  metadata?: any
}

export interface Business {
  id: string
  created_at: string
  name: string
  owner_id: string
  metadata?: any
}

// Limpiar todas las suscripciones al desmontar la aplicación
export const cleanupAllSubscriptions = () => {
  // Iterar sobre todas las suscripciones activas
  for (const [channelName, subscription] of activeChannels.entries()) {
    try {
      if (subscription && subscription.unsubscribe) {
        subscription.unsubscribe();
      }
    } catch (error) {
      console.error(`Error al limpiar suscripción ${channelName}:`, error);
    }
  }
  
  // Limpiar el mapa
  activeChannels.clear();
  console.log('🧹 Todas las suscripciones han sido limpiadas');
}

// Función de diagnóstico para probar las credenciales de Supabase
export const testSupabaseConnection = async () => {
  try {
    if (DEBUG) {
      console.log('🧪 Probando conexión a Supabase...');
      console.log('🔑 URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
      console.log('🔑 Key:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 10) + '...' + process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length - 5));
    }
    
    // Probar con una consulta simple a una tabla pública
    const { data, error } = await supabase
      .from('businesses')
      .select('count')
      .limit(1);
    
    if (error) {
      if (DEBUG) {
        console.error('❌ Error al conectar con Supabase:', error);
      }
      return {
        success: false,
        error: error.message,
        details: error
      };
    }
    
    if (DEBUG) {
      console.log('✅ Conexión a Supabase establecida con éxito');
    }
    
    // Probar autenticación anónima
    const { data: authData, error: authError } = await supabase.auth.getSession();
    
    if (authError) {
      if (DEBUG) {
        console.error('⚠️ Error al verificar sesión:', authError);
      }
    } else {
      if (DEBUG) {
        console.log('✅ Cliente de autenticación funcionando correctamente');
      }
    }
    
    return {
      success: true,
      data: data,
      authStatus: authData ? 'session-ready' : 'no-active-session'
    };
    
  } catch (error) {
    if (DEBUG) {
      console.error('❌ Error crítico al probar Supabase:', error);
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      details: error
    };
  }
}; 