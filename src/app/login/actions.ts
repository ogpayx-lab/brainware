'use server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function loginAction(email: string, password: string): Promise<{ error: string } | never> {
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
          } catch {
            // Ignorato in Server Components read-only
          }
        },
      },
    }
  )

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: error.message }
  }

  if (!data.user) {
    return { error: 'Errore durante il login. Riprova.' }
  }

  // Recupera il ruolo dell'utente
  const { data: profile } = await supabase
    .from('users')
    .select('role, store_id')
    .eq('id', data.user.id)
    .single()

  if (!profile || !profile.store_id) {
    redirect('/onboarding')
  }

  if (profile.role === 'superadmin') redirect('/superadmin/dashboard')
  else if (profile.role === 'owner') redirect('/owner/dashboard')
  else redirect('/employee/shift/open')
}
