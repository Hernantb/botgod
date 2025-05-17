import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://wscijkxwevgxbgwhbqtm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4MjI3NjgsImV4cCI6MjA1NzM5ODc2OH0._HSnvof7NUk6J__qqq3gJvbJRZnItCAmlI5HYAL8WVI'
)

async function checkMessages() {
  console.log('📊 DIAGNÓSTICO DE MENSAJES EN SUPABASE')
  console.log('======================================\n')
  
  console.log('Comprobando conexión a Supabase...')
  try {
    const { data, error } = await supabase.from('conversations').select('count')
    if (error) throw error
    console.log('✅ Conexión a Supabase exitosa\n')
  } catch (err) {
    console.error('❌ Error conectando a Supabase:', err)
    return
  }

  console.log('1️⃣ Buscando conversaciones recientes...')
  const { data: conversations, error: convError } = await supabase
    .from('conversations')
    .select('*')
    .order('last_message_time', { ascending: false })
    .limit(5)

  if (convError) {
    console.error('❌ Error obteniendo conversaciones:', convError)
    return
  }

  console.log(`✅ Se encontraron ${conversations.length} conversaciones recientes\n`)
  
  if (conversations && conversations.length > 0) {
    // Mostrar detalles de las conversaciones
    console.log('📱 Conversaciones recientes:')
    conversations.forEach((conv, index) => {
      const date = new Date(conv.last_message_time).toLocaleString()
      console.log(`${index + 1}. ID: ${conv.id} | Usuario: ${conv.user_id} | Último mensaje: ${date}`)
    })
    
    console.log('\n2️⃣ Verificando mensajes para cada conversación...')
    
    // Para cada conversación, obtener sus mensajes
    for (const conv of conversations) {
      console.log(`\n📱 Mensajes para conversación ${conv.id} (usuario: ${conv.user_id}):`)
      
      const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (msgError) {
        console.error(`❌ Error obteniendo mensajes para conversación ${conv.id}:`, msgError)
        continue
      }

      if (messages.length === 0) {
        console.log('⚠️ No se encontraron mensajes para esta conversación')
        continue
      }

      console.log(`✅ Se encontraron ${messages.length} mensajes`)
      
      // Mostrar detalles de los mensajes
      messages.forEach((msg, index) => {
        const date = new Date(msg.created_at).toLocaleString()
        console.log(`${index + 1}. ID: ${msg.id.substring(0, 8)}... | Tipo: ${msg.sender_type} | Fecha: ${date}`)
        console.log(`   Contenido: "${msg.content?.substring(0, 50)}${msg.content?.length > 50 ? '...' : ''}"`)
      })
    }
  } else {
    console.log('⚠️ No se encontraron conversaciones')
  }
}

// Ejecutar la función principal
checkMessages()
  .then(() => {
    console.log('\n✅ Diagnóstico completado')
    process.exit(0)
  })
  .catch(err => {
    console.error('\n❌ Error durante el diagnóstico:', err)
    process.exit(1)
  }) 