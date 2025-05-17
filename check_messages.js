const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://wscijkxwevgxbgwhbqtm.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4MjI3NjgsImV4cCI6MjA1NzM5ODc2OH0._HSnvof7NUk6J__qqq3gJvbJRZnItCAmlI5HYAL8WVI'

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkMessages() {
  try {
    console.log('🔍 Iniciando diagnóstico de mensajes en Supabase...')
    
    // Verificar conexión a Supabase
    const { data: testData, error: testError } = await supabase
      .from('messages')
      .select('count')
      .limit(1)

    if (testError) {
      console.error('❌ Error conectando a Supabase:', testError)
      return
    }
    
    console.log('✅ Conexión a Supabase exitosa')
    
    // Obtener las últimas 5 conversaciones
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .order('last_message_time', { ascending: false })
      .limit(5)

    if (convError) {
      console.error('❌ Error obteniendo conversaciones:', convError)
      return
    }
    
    console.log(`\n📊 Encontradas ${conversations.length} conversaciones recientes:`)
    
    // Para cada conversación, obtener sus últimos mensajes
    for (const conv of conversations) {
      console.log(`\n🔍 Conversación ID: ${conv.id}`)
      console.log(`👤 User ID: ${conv.user_id}`)
      console.log(`🕒 Último mensaje: ${conv.last_message_time}`)
      
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
      
      console.log(`📝 Encontrados ${messages.length} mensajes:`)
      messages.forEach(msg => {
        console.log(`- ID: ${msg.id}`)
        console.log(`  Tipo: ${msg.sender_type}`)
        console.log(`  Contenido: ${msg.content}`)
        console.log(`  Fecha: ${msg.created_at}`)
      })
    }
    
  } catch (error) {
    console.error('❌ Error en el diagnóstico:', error)
  }
}

checkMessages()
  .then(() => {
    console.log('\n✅ Diagnóstico completado')
    process.exit(0)
  })
  .catch(err => {
    console.error('\n❌ Error durante el diagnóstico:', err)
    process.exit(1)
  }) 