'use server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

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

  // Usa admin client (service role) per bypassare RLS
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('users')
    .select('role, store_id')
    .eq('id', data.user.id)
    .single()

  if (!profile || !profile.store_id) return { redirectTo: '/onboarding' }

  if (profile.role === 'superadmin') return { redirectTo: '/superadmin/dashboard' }
  if (profile.role === 'owner') return { redirectTo: '/owner/dashboard' }
  return { redirectTo: '/employee/shift/open' }
}

// Server action per ottenere il redirect dal profilo utente (bypassa RLS)
export async function getProfileRedirect(userId: string): Promise<{
  redirectTo: string;
  storeId?: string;
  role?: string;
  organizationId?: string;
  debug?: string;
}> {
  try {
    const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY
    console.log('[getProfileRedirect] userId:', userId, 'hasServiceKey:', hasServiceKey)

    if (!hasServiceKey) {
      console.error('[getProfileRedirect] SUPABASE_SERVICE_ROLE_KEY is NOT set!')
      return { redirectTo: '/onboarding', debug: 'NO_SERVICE_KEY' }
    }

    const admin = createAdminClient()
    const { data: profile, error } = await admin
      .from('users')
      .select('role, store_id, stores(organization_id)')
      .eq('id', userId)
      .single()

    console.log('[getProfileRedirect] profile:', JSON.stringify(profile), 'error:', error?.message)

    if (error) {
      console.error('[getProfileRedirect] Query error:', error.message)
      return { redirectTo: '/onboarding', debug: 'QUERY_ERROR: ' + error.message }
    }

    if (!profile || !profile.store_id) {
      console.log('[getProfileRedirect] No profile or no store_id')
      return { redirectTo: '/onboarding', debug: 'NO_PROFILE_OR_STORE' }
    }

    const orgId = (profile?.stores as any)?.organization_id

    if (profile.role === 'superadmin') return { redirectTo: '/superadmin/dashboard', storeId: profile.store_id, role: profile.role }
    if (profile.role === 'owner') return { redirectTo: '/owner/dashboard', storeId: profile.store_id, role: profile.role }
    return { redirectTo: '/employee/shift/open', storeId: profile.store_id, role: profile.role, organizationId: orgId }
  } catch (err: any) {
    console.error('[getProfileRedirect] Exception:', err?.message || err)
    return { redirectTo: '/onboarding', debug: 'EXCEPTION: ' + (err?.message || 'unknown') }
  }
}
