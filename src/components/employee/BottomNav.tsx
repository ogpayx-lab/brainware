'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/employee/dashboard',  icon: '', label: 'Home' },
  { href: '/employee/pos',        icon: '', label: 'Vendita' },
  { href: '/employee/fidelity',   icon: '', label: 'Fidelity' },
  { href: '/employee/expenses',   icon: '', label: 'Spese' },
  { href: '/employee/inventory',  icon: '', label: 'Conteggio' },
  { href: '/employee/more',       icon: '',  label: 'Altro' },
]

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'var(--bg-primary)', borderTop: '1px solid var(--border-subtle)',
      display: 'flex', zIndex: 100, paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {TABS.map(tab => {
        const active = pathname === tab.href || pathname.startsWith(tab.href + '/')
        return (
          <Link key={tab.href} href={tab.href} style={{ flex: 1, textDecoration: 'none' }}>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              padding: '8px 4px 6px',
              color: active ? 'var(--brand-primary)' : 'var(--text-tertiary)',
            }}>
              <span style={{ fontSize: 20 }}>{tab.icon}</span>
              <span style={{ fontSize: 10, fontWeight: active ? 600 : 400 }}>{tab.label}</span>
            </div>
          </Link>
        )
      })}
    </nav>
  )
}
