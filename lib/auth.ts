import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Type for user session
export interface UserSession {
  user: {
    id: string
    name?: string
    email: string
  }
}

// Get server-side session
export async function getServerSession(): Promise<UserSession | null> {
  const cookieStore = cookies()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // Ignore set cookie errors in middleware
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // Ignore set cookie errors in middleware
          }
        },
      },
    }
  )

  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error || !session?.user) {
      console.error('Error getting session:', error)
      return null
    }

    return {
      user: {
        id: session.user.id,
        name: session.user.user_metadata?.name,
        email: session.user.email || '',
      }
    }
  } catch (error) {
    console.error('Error in getServerSession:', error)
    return null
  }
}

