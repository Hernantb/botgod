const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://wscijkxwevgxbgwhbqtm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4MjI3NjgsImV4cCI6MjA1NzM5ODc2OH0._HSnvof7NUk6J__qqq3gJvbJRZnItCAmlI5HYAL8WVI'
)

async function checkConversations() {
  const businessId = '2d385aa5-40e0-4ec9-9360-19281bc605e4'
  
  console.log('Checking conversations table...')
  console.log('Business ID:', businessId)
  
  const { data: conversations, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('business_id', businessId)
  
  if (error) {
    console.error('Error:', error)
    return
  }
  
  console.log('Total conversations:', conversations?.length || 0)
  if (conversations && conversations.length > 0) {
    console.log('Sample conversation:', conversations[0])
  }

  // Check messages if there are conversations
  if (conversations && conversations.length > 0) {
    const firstConversationId = conversations[0].id
    console.log('\nChecking messages for first conversation:', firstConversationId)
    
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', firstConversationId)
    
    if (messagesError) {
      console.error('Error getting messages:', messagesError)
      return
    }
    
    console.log('Total messages:', messages?.length || 0)
    if (messages && messages.length > 0) {
      console.log('Sample message:', messages[0])
    }
  }
}

checkConversations() 