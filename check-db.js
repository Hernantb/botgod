const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://wscijkxwevgxbgwhbqtm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4MjI3NjgsImV4cCI6MjA1NzM5ODc2OH0._HSnvof7NUk6J__qqq3gJvbJRZnItCAmlI5HYAL8WVI'
)

async function checkConversations() {
  console.log('Checking conversations table...')
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
  
  if (error) {
    console.error('Error:', error)
    return
  }
  
  console.log('Total conversations:', data.length)
  if (data.length > 0) {
    console.log('Sample conversation:', data[0])
  }

  // Check conversations for specific business_id
  const businessId = '2d385aa5-40e0-4ec9-9360-19281bc605e4'
  const { data: businessConversations, error: businessError } = await supabase
    .from('conversations')
    .select('*')
    .eq('business_id', businessId)

  if (businessError) {
    console.error('Error getting business conversations:', businessError)
    return
  }

  console.log(`Conversations for business ${businessId}:`, businessConversations.length)
  if (businessConversations.length > 0) {
    console.log('Sample business conversation:', businessConversations[0])
  }
}

checkConversations() 