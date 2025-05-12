const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://wscijkxwevgxbgwhbqtm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4MjI3NjgsImV4cCI6MjA1NzM5ODc2OH0._HSnvof7NUk6J__qqq3gJvbJRZnItCAmlI5HYAL8WVI'
)

async function createTestConversation() {
  try {
    console.log('Iniciando configuración...')

    // Obtener el negocio existente
    console.log('Buscando negocio existente...')
    const { data: business, error: searchError } = await supabase
      .from('businesses')
      .select('*')
      .eq('whatsapp_number', '+15557033313')
      .single()

    if (searchError) {
      console.error('Error al buscar el negocio:', searchError.message)
      return
    }

    console.log('Negocio encontrado:', business)

    // Crear una conversación de prueba
    console.log('Creando conversación de prueba...')
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .insert({
        user_id: '+1234567890',
        message: '¡Hola! Este es un mensaje de prueba',
        business_id: business.id,
        last_message_time: new Date().toISOString(),
        is_bot_active: true,
        status: 'received'
      })
      .select()
      .single()

    if (convError) {
      console.error('Error al crear la conversación de prueba:', convError.message)
      return
    }

    console.log('Conversación de prueba creada exitosamente:', conversation)
    console.log('¡Configuración completada con éxito!')

  } catch (error) {
    console.error('Error durante la configuración:', error.message)
  }
}

console.log('Iniciando creación de conversación de prueba...')
createTestConversation() 