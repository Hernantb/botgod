const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://wscijkxwevgxbgwhbqtm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4MjI3NjgsImV4cCI6MjA1NzM5ODc2OH0._HSnvof7NUk6J__qqq3gJvbJRZnItCAmlI5HYAL8WVI'
)

async function setupTestMessages() {
  try {
    console.log('Setting up test messages...')

    // First get the business
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id')
      .eq('whatsapp_number', '+15557033313')
      .single()

    if (businessError) {
      console.error('Error finding business:', businessError)
      return
    }

    console.log('Found business:', business)

    // Get all conversations for this business
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('id, user_id')
      .eq('business_id', business.id)

    if (convError) {
      console.error('Error finding conversations:', convError)
      return
    }

    console.log('Found conversations:', conversations)

    // For each conversation, create some test messages
    for (const conv of conversations) {
      const messages = [
        {
          conversation_id: conv.id,
          content: '¡Hola! ¿En qué puedo ayudarte?',
          sender_type: 'agent',
          user_id: conv.user_id,
          business_id: business.id,
          created_at: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
        },
        {
          conversation_id: conv.id,
          content: 'Necesito información sobre sus servicios',
          sender_type: 'user',
          user_id: conv.user_id,
          business_id: business.id,
          created_at: new Date(Date.now() - 3300000).toISOString() // 55 minutes ago
        },
        {
          conversation_id: conv.id,
          content: 'Con gusto te ayudo. ¿Qué tipo de servicio te interesa?',
          sender_type: 'agent',
          user_id: conv.user_id,
          business_id: business.id,
          created_at: new Date(Date.now() - 3000000).toISOString() // 50 minutes ago
        }
      ]

      console.log('Inserting messages for conversation:', conv.id)
      const { data, error } = await supabase
        .from('messages')
        .insert(messages)
        .select()

      if (error) {
        console.error('Error inserting messages:', error)
      } else {
        console.log('Messages inserted successfully:', data)
      }
    }

    console.log('Test messages setup completed!')
  } catch (error) {
    console.error('Error in setupTestMessages:', error)
  }
}

console.log('Starting test messages setup...')
setupTestMessages() 