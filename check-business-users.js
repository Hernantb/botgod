const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://wscijkxwevgxbgwhbqtm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4MjI3NjgsImV4cCI6MjA1NzM5ODc2OH0._HSnvof7NUk6J__qqq3gJvbJRZnItCAmlI5HYAL8WVI'
)

async function checkBusinessUsers() {
  console.log('Checking business_users table...')
  const { data, error } = await supabase
    .from('business_users')
    .select('*')
  
  if (error) {
    console.error('Error:', error)
    return
  }
  
  console.log('Total business_users:', data.length)
  if (data.length > 0) {
    console.log('Sample business_user:', data[0])
  }

  // Check specific user
  const userId = 'e32f90b4-6528-48ea-b4de-d47b53e7acef'
  const { data: userBusinesses, error: userError } = await supabase
    .from('business_users')
    .select('*')
    .eq('user_id', userId)

  if (userError) {
    console.error('Error getting user businesses:', userError)
    return
  }

  console.log(`Business associations for user ${userId}:`, userBusinesses)
}

checkBusinessUsers() 