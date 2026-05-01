'use client'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

const DEMO_EMAIL = 'demo@brain-ware.ai'

export function DemoBanner() {
  const pathname = usePathname()
  const [isDemo, setIsDemo] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email === DEMO_EMAIL) setIsDemo(true)
    })
  }, [])

  if (!isDemo) return null

  const isOwner = pathname.startsWith('/owner')

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      background: 'linear-gradient(90deg, #6366F1, #8B5CF6, #6366F1)',
      backgroundSize: '200% 100%',
      animation: 'demoBannerShimmer 3s ease infinite',
      color: 'white', fontSize: 13, fontWeight: 600,
      padding: '8px 16px', textAlign: 'center',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
      boxShadow: '0 2px 12px rgba(99,102,241,0.3)',
    }}>
      <span>🔔 Stai usando la <strong>DEMO</strong> — I dati sono di esempio e si resettano periodicamente</span>
      <div style={{ display: 'flex', gap: 8 }}>
        {isOwner ? (
          <a href="/api/demo-login" onClick={async (e) => {
            e.preventDefault()
            const res = await fetch('/api/demo-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ view: 'employee' }) })
            const data = await res.json()
            if (data.redirect) {
              const supabase = createClient()
              await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token })
              window.location.href = data.redirect
            }
          }} style={{
            background: 'rgba(255,255,255,0.2)', color: 'white', padding: '3px 12px',
            borderRadius: 6, fontSize: 11, fontWeight: 600, textDecoration: 'none',
            border: '1px solid rgba(255,255,255,0.3)', cursor: 'pointer',
          }}>
            👤 Vedi vista Dipendente
          </a>
        ) : (
          <a href="/api/demo-login" onClick={async (e) => {
            e.preventDefault()
            const res = await fetch('/api/demo-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ view: 'owner' }) })
            const data = await res.json()
            if (data.redirect) {
              const supabase = createClient()
              await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token })
              window.location.href = data.redirect
            }
          }} style={{
            background: 'rgba(255,255,255,0.2)', color: 'white', padding: '3px 12px',
            borderRadius: 6, fontSize: 11, fontWeight: 600, textDecoration: 'none',
            border: '1px solid rgba(255,255,255,0.3)', cursor: 'pointer',
          }}>
            👑 Vedi vista Owner
          </a>
        )}
        <a href="/" style={{
          background: 'white', color: '#6366F1', padding: '3px 12px',
          borderRadius: 6, fontSize: 11, fontWeight: 700, textDecoration: 'none',
        }}>
          ✕ Esci dalla Demo
        </a>
      </div>

      <style>{`
        @keyframes demoBannerShimmer {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  )
}

// Hook to check if current user is demo
export function useIsDemo() {
  const [isDemo, setIsDemo] = useState(false)
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email === DEMO_EMAIL) setIsDemo(true)
    })
  }, [])
  return isDemo
}
