'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { href: '/superadmin/dashboard',    icon: '',  label: 'Dashboard' },
  { href: '/superadmin/owners',       icon: '', label: 'Gestione Owners' },
  { href: '/superadmin/stores',       icon: '', label: 'Gestione Negozi' },
  { href: '/superadmin/analytics',    icon: '', label: 'Analytics Globale' },
  { href: '/superadmin/intelligence', icon: '', label: 'Intelligence' },
  { href: '/superadmin/billing',      icon: '', label: 'Fatturazione' },
  { href: '/superadmin/settings',     icon: '', label: 'Impostazioni' },
]

export function SuperAdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function logout() {
    await supabase.auth.signOut()
    router.push('/superadmin/login')
  }

  return (
    <aside style={{ width: 220, minHeight: '100vh', background: '#0F172A', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', position: 'fixed', left: 0, top: 0 }}>
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: '#22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, color: 'white' }}>B</div>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, color: 'white' }}>BrainWare</span>
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#22C55E', letterSpacing: '0.1em', textTransform: 'uppercase' }}>SUPER ADMIN</div>
      </div>

      <nav style={{ flex: 1, padding: '8px 0' }}>
        {NAV.map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', margin: '1px 8px', borderRadius: 8, fontSize: 13, fontWeight: active ? 600 : 400, color: active ? 'white' : 'rgba(255,255,255,0.45)', background: active ? 'rgba(34,197,94,0.12)' : 'transparent', borderLeft: `2px solid ${active ? '#22C55E' : 'transparent'}`, cursor: 'pointer' }}>
                <span style={{ fontSize: 15 }}>{item.icon}</span>
                {item.label}
              </div>
            </Link>
          )
        })}
      </nav>

      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white' }}>SA</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'white' }}>Super Admin</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>brainware.io</div>
          </div>
        </div>
        <button onClick={logout} style={{ width: '100%', padding: '7px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Logout</button>
      </div>
    </aside>
  )
}
