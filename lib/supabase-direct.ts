import { createClient } from '@supabase/supabase-js'

// Claves de Supabase hardcodeadas para asegurar que funcionen
// Esto soluciona los problemas cuando las variables de entorno no se cargan correctamente
const SUPABASE_URL = 'https://wscijkxwevgxbgwhbqtm.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTY5OTY2ODEsImV4cCI6MjAzMjU3MjY4MX0.1dU5G04E5LFDM-RJVRCD3XlKB3Q7eTyHCrZwYpSaLMU'

// Crear cliente usando directamente las claves sin variables de entorno
export const supabaseDirect = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'supabase.auth.token.direct',
  },
  global: {
    headers: {
      'x-client-info': 'chat-control-panel/direct-client',
    },
  },
})

// Login directo sin depender de variables de entorno
export async function loginDirectly(email: string, password: string) {
  console.log('🔐 Iniciando sesión con cliente directo...')
  console.log('📡 URL:', SUPABASE_URL)
  console.log('🔑 Key (primeros 10 caracteres):', SUPABASE_KEY.substring(0, 10) + '...')
  
  try {
    // Validar que tenemos credenciales
    if (!email || !password) {
      console.error('❌ Email o contraseña no proporcionados')
      return { success: false, error: 'Credenciales incompletas' }
    }
    
    // Limpiar localStorage para evitar conflictos con sesiones previas
    if (typeof window !== 'undefined') {
      console.log('🧹 Limpiando localStorage...')
      localStorage.removeItem('supabase.auth.token')
      localStorage.removeItem('supabase.auth.token.direct')
    }
    
    // Intentar login con cliente directo
    console.log('⏳ Enviando solicitud de inicio de sesión...')
    const { data, error } = await supabaseDirect.auth.signInWithPassword({
      email,
      password,
    })
    
    if (error) {
      console.error('❌ Error durante signInWithPassword:', error)
      
      // Verificar si el error es de API Key inválida
      if (error.message.includes('Invalid API key')) {
        console.error('❌ Error de API key detectado - problema con las claves de Supabase')
        return { 
          success: false, 
          error: 'API key inválida - Por favor contacta al administrador',
          details: error
        }
      }
      
      return { success: false, error: error.message, details: error }
    }
    
    if (!data?.session) {
      console.error('⚠️ No se recibió sesión válida')
      return { success: false, error: 'No se pudo establecer la sesión' }
    }
    
    console.log('✅ Inicio de sesión exitoso')
    
    // Guardar business_id si está disponible
    try {
      if (data.user) {
        const { data: profileData, error: profileError } = await supabaseDirect
          .from('profiles')
          .select('business_id')
          .eq('id', data.user.id)
          .single()
          
        if (profileError) {
          console.warn('⚠️ Error al obtener business_id:', profileError)
        } else if (profileData?.business_id) {
          localStorage.setItem('businessId', profileData.business_id)
          console.log('💾 Business ID guardado:', profileData.business_id)
        }
      }
    } catch (profileLookupError) {
      console.error('❌ Error al buscar perfil:', profileLookupError)
    }
    
    return { success: true, data }
  } catch (unexpectedError) {
    console.error('❌ Error inesperado durante login:', unexpectedError)
    return { 
      success: false, 
      error: unexpectedError instanceof Error ? unexpectedError.message : 'Error desconocido',
      details: unexpectedError
    }
  }
}

// Función auxiliar para pruebas que muestra más información
export async function testDirectLogin(email: string, password: string) {
  console.log('🧪 Prueba completa de inicio de sesión directo')
  console.log('📡 URL:', SUPABASE_URL)
  console.log('🔑 Key (primeros 10 caracteres):', SUPABASE_KEY.substring(0, 10) + '...')
  
  try {
    // Limpiar localStorage
    if (typeof window !== 'undefined') {
      console.log('🧹 Limpiando localStorage...')
      localStorage.clear()
    }
    
    // 1. Probar conexión básica
    console.log('1️⃣ Probando conexión básica...')
    try {
      const { data: connectionTest, error: connectionError } = await supabaseDirect
        .from('businesses')
        .select('count')
        .limit(1)
      
      if (connectionError) {
        return {
          success: false,
          stage: 'connection',
          error: connectionError.message,
          details: connectionError
        }
      }
      
      console.log('✅ Conexión básica establecida')
    } catch (connError) {
      return {
        success: false,
        stage: 'connection',
        error: connError instanceof Error ? connError.message : 'Error de conexión desconocido',
        details: connError
      }
    }
    
    // 2. Probar autenticación
    console.log('2️⃣ Probando autenticación...')
    const { data, error } = await supabaseDirect.auth.signInWithPassword({
      email,
      password,
    })
    
    if (error) {
      return {
        success: false,
        stage: 'authentication',
        error: error.message,
        details: error
      }
    }
    
    if (!data?.session) {
      return {
        success: false,
        stage: 'session',
        error: 'No se pudo establecer la sesión'
      }
    }
    
    console.log('✅ Autenticación exitosa')
    
    // 3. Probar acceso a datos
    console.log('3️⃣ Verificando business_id...')
    let businessInfo = null
    try {
      // Obtener business_id del usuario
      const { data: userData, error: userError } = await supabaseDirect
        .from('business_users')
        .select('business_id, role')
        .eq('user_id', data.user.id)
        .eq('is_active', true)
        .maybeSingle()
      
      if (userError) {
        return {
          success: true,
          stage: 'complete_with_errors',
          error: 'Error al obtener business_id',
          session: {
            id: data.session.user.id,
            email: data.session.user.email,
            expires_at: data.session.expires_at
          },
          business: null,
          businessError: userError
        }
      }
      
      if (userData?.business_id) {
        // Guardar business_id en localStorage
        localStorage.setItem('businessId', userData.business_id)
        
        // Obtener detalles del negocio
        const { data: businessData, error: businessError } = await supabaseDirect
          .from('businesses')
          .select('id, name')
          .eq('id', userData.business_id)
          .single()
        
        businessInfo = {
          id: userData.business_id,
          role: userData.role,
          details: businessError ? null : businessData
        }
      }
    } catch (businessError) {
      console.error('❌ Error al verificar business_id:', businessError)
    }
    
    return {
      success: true,
      stage: 'complete',
      session: {
        id: data.session.user.id,
        email: data.session.user.email,
        expires_at: data.session.expires_at
      },
      business: businessInfo
    }
    
  } catch (unexpectedError) {
    return {
      success: false,
      stage: 'unexpected',
      error: unexpectedError instanceof Error ? unexpectedError.message : 'Error desconocido',
      details: unexpectedError
    }
  }
} 