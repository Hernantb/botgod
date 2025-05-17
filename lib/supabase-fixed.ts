import { createBrowserClient } from '@supabase/ssr'

// Claves de Supabase actualizadas para resolver el problema de 'Invalid API Key'
// Las claves anteriores parecen estar caducadas o ser incorrectas
// Estas son claves nuevas obtenidas de la consola de Supabase
export const supabaseFixed = createBrowserClient(
  'https://wscijkxwevgxbgwhbqtm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTY5OTY2ODEsImV4cCI6MjAzMjU3MjY4MX0.1dU5G04E5LFDM-RJVRCD3XlKB3Q7eTyHCrZwYpSaLMU',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'supabase.auth.token',
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
)

// Función para probar inicio de sesión directamente
export const testWithFixed = async (email: string, password: string) => {
  try {
    console.log('🔐 Probando inicio de sesión con cliente fijo...')
    
    const { data, error } = await supabaseFixed.auth.signInWithPassword({
      email,
      password,
    })
    
    if (error) {
      console.error('❌ Error con cliente fijo:', error)
      return { success: false, error }
    }
    
    console.log('✅ Inicio de sesión exitoso con cliente fijo')
    return { success: true, data }
  } catch (error) {
    console.error('❌ Error crítico con cliente fijo:', error)
    return { success: false, error }
  }
} 