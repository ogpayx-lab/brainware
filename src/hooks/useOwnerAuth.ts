'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Hook per auth check nelle pagine owner.
 * Usa getSession() (cache locale) per evitare race condition con getUser().
 * Ritorna { user, profile, storeId, loading }.
 */
export function useOwnerAuth() {
  const supabase = createClient()
  const router = useRouter()
  const [state, setState] = useState<{
    user: any
    profile: any
    storeId: string | null
    loading: boolean
  }>({ user: null, profile: null, storeId: null, loading: true })

  useEffect(() => {
    checkAuth()
  }, [])

  async function checkAuth() {
    // Prima prova getSession (cache locale, veloce)
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.user) {
      // Fallback: prova getUser (network call)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
    }

    const userId = session?.user?.id
    if (!userId) {
      router.push('/login')
      return
    }

    const { data: profile } = await supabase
      .from('users')
      .select('store_id, role, full_name, stores(organization_id)')
      .eq('id', userId)
      .single()

    if (!profile || (profile.role !== 'owner' && profile.role !== 'superadmin')) {
      router.push('/login')
      return
    }

    setState({
      user: session!.user,
      profile,
      storeId: profile.store_id,
      loading: false,
    })
  }

  return state
}
