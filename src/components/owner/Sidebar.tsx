'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const NAV_MAIN = [
  { href: '/owner/dashboard',             icon: '📊',  label: 'Dashboard' },
  { href: '/owner/reports',               icon: '📋', label: 'Live Report' },
  { href: '/owner/products',              icon: '📦', label: 'Prodotti' },
  { href: '/owner/analytics/products',    icon: '📈', label: 'Prodotti Analytics' },
  { href: '/owner/analytics/team',        icon: '👥', label: 'Team Performance' },
]
const NAV_MAGAZZINO = [
  { href: '/owner/warehouse/central',     icon: '🏭', label: 'Centrale' },
  { href: '/owner/warehouse/secondary',   icon: '📦', label: 'Secondari' },
  { href: '/owner/warehouse/stores',      icon: '🏪', label: 'Stock Store' },
  { href: '/owner/warehouse/transfers',   icon: '🔄', label: 'Trasferimenti' },
]
const NAV_GESTIONE = [
  { href: '/owner/notifications',      icon: '🔔', label: 'Notifiche' },
  { href: '/owner/tasks',              icon: '📋', label: 'Task' },
  { href: '/owner/promo',             icon: '🎟️', label: 'Codici Promo' },
  { href: '/owner/employees',         icon: '👥', label: 'Dipendenti' },
  { href: '/owner/shopify',           icon: '🛍️', label: 'Shopify' },
  { href: '/owner/ecommerce',         icon: '🌐', label: 'E-commerce' },
  { href: '/owner/vending',           icon: '🏧', label: 'H24 Vending' },
  { href: '/owner/maintenance',       icon: '🔧', label: 'Manutenzione' },
  { href: '/owner/intelligence',      icon: '🧠', label: 'Intelligence AI' },
  { href: '/owner/ai-management',     icon: '🤖', label: 'Gestione AI' },
  { href: '/owner/settings',          icon: '⚙️', label: 'Impostazioni' },
]

export function OwnerSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [brand, setBrand] = useState({ name: 'BrainWare', letter: 'B', color: '#22C55E' })

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('users').select('store_id').eq('id', user.id).single().then(({ data: p }) => {
        if (!p?.store_id) return
        supabase.from('brand_config').select('brand_name,logo_letter,primary_color').eq('store_id', p.store_id).single()
          .then(({ data: b }) => { if (b) setBrand({ name: b.brand_name, letter: b.logo_letter, color: b.primary_color }) })
      })
    })
  }, [])

  const NavItem = ({ href, icon, label }: { href: string; icon: string; label: string }) => {
    const active = pathname === href || pathname.startsWith(href + '/')
    return (
      <Link href={href} style={{ textDecoration: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', borderRadius: 8, margin: '1px 8px', fontSize: 13, fontWeight: active ? 600 : 400, color: active ? brand.color : 'var(--text-secondary)', background: active ? brand.color + '18' : 'transparent', cursor: 'pointer', transition: 'all 0.15s' }}>
          <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>{icon}</span>
          {label}
        </div>
      </Link>
    )
  }

  return (
    <aside style={{ width: 210, minHeight: '100vh', background: 'var(--bg-primary)', borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', position: 'fixed', left: 0, top: 0, zIndex: 100 }}>
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: brand.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16, color: 'white', flexShrink: 0 }}>{brand.letter}</div>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{brand.name}</span>
        </div>
      </div>
      <nav style={{ flex: 1, paddingTop: 8, overflowY: 'auto' }}>
        {NAV_MAIN.map(item => <NavItem key={item.href} {...item} />)}
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '12px 24px 4px' }}>MAGAZZINO</div>
        {NAV_MAGAZZINO.map(item => <NavItem key={item.href} {...item} />)}
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '12px 24px 4px' }}>GESTIONE</div>
        {NAV_GESTIONE.map(item => <NavItem key={item.href} {...item} />)}
      </nav>
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle)' }}>
        <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} style={{ width: '100%', padding: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Logout</button>
      </div>
    </aside>
  )
}
