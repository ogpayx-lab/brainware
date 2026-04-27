'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { playNotificationSound } from '@/lib/useNotificationSound'

const TABS = [
  { href: '/employee/dashboard',       icon: '🏠', label: 'Home' },
  { href: '/employee/pos',             icon: '🛒', label: 'Vendita' },
  { href: '/employee/inventory',       icon: '📊', label: 'Inventario' },
  { href: '/employee/maintenance',     icon: '🔧', label: 'Manutenz.' },
  { href: '/employee/reorder',         icon: '📢', label: 'Ricarica' },
]

export function BottomNav() {
  const pathname = usePathname()
  const supabase = createClient()
  const [unreadCount, setUnreadCount] = useState(0)
  const prevCount = useRef<number | null>(null)

  useEffect(() => {
    checkUnread()
    const interval = setInterval(checkUnread, 15000)
    return () => clearInterval(interval)
  }, [])

  async function checkUnread() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('users').select('store_id').eq('id', user.id).single()
      if (!profile?.store_id) return

      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', profile.store_id)
        .eq('read', false)

      const unread = count ?? 0
      setUnreadCount(unread)

      if (prevCount.current !== null && unread > prevCount.current) {
        playNotificationSound()
      }
      prevCount.current = unread
    } catch {}
  }

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
              padding: '8px 4px 6px', position: 'relative',
              color: active ? 'var(--brand-primary)' : 'var(--text-tertiary)',
            }}>
              <span style={{ fontSize: 20, position: 'relative' }}>
                {tab.icon}
              </span>
              <span style={{ fontSize: 9, fontWeight: active ? 600 : 400 }}>{tab.label}</span>
            </div>
          </Link>
        )
      })}
    </nav>
  )
}
