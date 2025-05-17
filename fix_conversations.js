const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://wscijkxwevgxbgwhbqtm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4MjI3NjgsImV4cCI6MjA1NzM5ODc2OH0._HSnvof7NUk6J__qqq3gJvbJRZnItCAmlI5HYAL8WVI'
)

async function fixConversations() {
  try {
    console.log('Fixing conversations...')

    // First get the business
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('whatsapp_number', '+15557033313')
      .single()

    if (businessError) {
      console.error('Error getting business:', businessError)
      return
    }

    console.log('Found business:', business)

    // Get all conversations
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('business_id', business.id)

    if (convError) {
      console.error('Error getting conversations:', convError)
      return
    }

    console.log('Found conversations:', conversations)

    // Create messages for each conversation
    for (const conv of conversations) {
      if (!conv.message) continue

      const newMessage = {
        conversation_id: conv.id,
        content: conv.message,
        created_at: conv.last_message_time,
        sender_type: conv.status === 'sent' ? 'user' : 'bot',
        user_id: conv.user_id,
        read: false,
        business_id: business.id
      }

      const { data: message, error: messageError } = await supabase
        .from('messages')
        .insert([newMessage])
        .select()
        .single()

      if (messageError) {
        console.error('Error creating message for conversation:', conv.id, messageError)
        continue
      }

      console.log('Created message for conversation:', conv.id, message)
    }

    console.log('Done fixing conversations!')

  } catch (error) {
    console.error('Error in fixConversations:', error)
  }
}

fixConversations() 