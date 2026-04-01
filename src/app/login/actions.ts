'use server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function loginAction(email: string, password: string): Promise<{ error?: string; redirectTo?: string }> {
  const cookieStore = cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) return { error: error.message }
  if (!data.user) return { error: 'Errore durante il login. Riprova.' }

  // Recupera il ruolo
  const { data: profile } = await supabase
    .from('users')
    .select('role, store_id')
    .eq('id', data.user.id)
    .single()

  if (!profile || !profile.store_id) return { redirectTo: '/onboarding' }

  if (profile.role === 'superadmin') return { redirectTo: '/superadmin/dashboard' }
  if (profile.role === 'owner') return { redirectTo: '/owner/dashboard' }
  return { redirectTo: '/employee/shift/open' }
}
