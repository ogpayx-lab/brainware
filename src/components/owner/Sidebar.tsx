'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useT, useLanguage, LANGUAGES } from '@/lib/i18n'

const NAV_MAIN = [
  { href: '/owner/dashboard',             icon: '📊',  key: 'sidebar.dashboard' },
  { href: '/owner/sales-log',             icon: '🧾', key: 'sidebar.salesLog' },
  { href: '/owner/photos',                icon: '📸', key: 'sidebar.photoLog' },
  { href: '/owner/products',              icon: '📦', key: 'sidebar.products' },
  { href: '/owner/analytics/products',    icon: '📈', key: 'sidebar.productAnalytics' },
  { href: '/owner/analytics/team',        icon: '👥', key: 'sidebar.teamPerformance' },
  { href: '/owner/members',               icon: '💳', key: 'sidebar.members' },
]
const NAV_MAGAZZINO = [
  { href: '/owner/warehouse/central',          icon: '🏭', key: 'sidebar.central' },
  { href: '/owner/warehouse/secondary',        icon: '📦', key: 'sidebar.secondary' },
  { href: '/owner/warehouse/stores',           icon: '🏪', key: 'sidebar.storeStock' },
  { href: '/owner/warehouse/stock-movements',  icon: '📋', key: 'sidebar.stockMovements' },
  { href: '/owner/bulk-load',                  icon: '📤', key: 'sidebar.bulkUpload' },
  { href: '/owner/inventory-setup',            icon: '📥', key: 'sidebar.initialInventory' },
  { href: '/owner/inventory-audit',            icon: '🔍', key: 'sidebar.inventoryAudit' },
]
const NAV_GESTIONE = [
  { href: '/owner/multistore',        icon: '🏪', key: 'sidebar.multistore' },
  { href: '/owner/tasks',             icon: '📋', key: 'sidebar.tasks' },
  { href: '/owner/promo',             icon: '🎟️', key: 'sidebar.promoCodes' },
  { href: '/owner/employees',         icon: '👤', key: 'sidebar.employees' },
  { href: '/owner/shopify',           icon: '🛍️', key: 'sidebar.shopify' },
  { href: '/owner/ecommerce',         icon: '🌐', key: 'sidebar.ecommerce' },
  { href: '/owner/vending',           icon: '🏧', key: 'sidebar.vending' },
  { href: '/owner/maintenance',       icon: '🔧', key: 'sidebar.maintenance' },
  { href: '/owner/intelligence',      icon: '🧠', key: 'sidebar.intelligenceAI' },
  { href: '/owner/ai-management',     icon: '🤖', key: 'sidebar.aiManagement' },
  { href: '/owner/system-log',        icon: '📊', key: 'sidebar.database' },
  { href: '/owner/help',              icon: '📖', key: 'sidebar.helpCenter' },
  { href: '/owner/settings',          icon: '⚙️', key: 'sidebar.settings' },
]

export function OwnerSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const t = useT()
  const [brand, setBrand] = useState({ name: 'BrainWare', letter: 'B', color: '#22C55E' })
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const { lang, setLang } = useLanguage()

  useEffect(() => {
    loadBrand()
    loadUnread()
    const interval = setInterval(loadUnread, 15000)
    return () => clearInterval(interval)
  }, [])

  async function loadBrand() {
    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
    if (!user) return
    const { data: p } = await supabase.from('users').select('store_id').eq('id', user.id).single()
    if (!p?.store_id) return
    const { data: b } = await supabase.from('brand_config').select('brand_name,logo_letter,primary_color').eq('store_id', p.store_id).single()
    if (b) setBrand({ name: b.brand_name, letter: b.logo_letter, color: b.primary_color })
  }

  async function loadUnread() {
    try {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
      if (!user) return
      const { data: profile } = await supabase.from('users').select('store_id, stores(organization_id)').eq('id', user.id).single()
      if (!profile?.store_id) return
      const oid = (profile.stores as any)?.organization_id
      if (!oid) return
      const { data: stores } = await supabase.from('stores').select('id').eq('organization_id', oid)
      const storeIds = (stores ?? []).map(s => s.id)
      if (storeIds.length === 0) return
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .in('store_id', storeIds)
        .eq('read', false)
      setUnreadCount(count ?? 0)
    } catch {}
  }

  // Close on route change (mobile)
  useEffect(() => { setOpen(false) }, [pathname])

  const NavItem = ({ href, icon, label, badge }: { href: string; icon: string; label: string; badge?: number }) => {
    const active = pathname === href || pathname.startsWith(href + '/')
    return (
      <Link href={href} style={{ textDecoration: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', borderRadius: 8, margin: '1px 8px', fontSize: 13, fontWeight: active ? 600 : 400, color: active ? brand.color : 'var(--text-secondary)', background: active ? brand.color + '18' : 'transparent', cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap', position: 'relative' }}>
          <span style={{ fontSize: 15, width: 20, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
          <span className="sidebar-label">{label}</span>
          {badge != null && badge > 0 && (
            <span style={{
              background: '#EF4444', color: 'white', borderRadius: 10,
              padding: '1px 6px', fontSize: 10, fontWeight: 700,
              marginLeft: 'auto', minWidth: 18, textAlign: 'center',
              lineHeight: '16px',
            }}>{badge > 99 ? '99+' : badge}</span>
          )}
        </div>
      </Link>
    )
  }

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="sidebar-toggle"
        onClick={() => setOpen(!open)}
        aria-label="Menu"
      >
        <span style={{ fontSize: 22 }}>{open ? '✕' : '☰'}</span>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 6, right: 6,
            width: 8, height: 8, borderRadius: '50%',
            background: '#EF4444',
          }} />
        )}
      </button>

      {/* Backdrop on mobile */}
      {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)} />}

      <aside className={`owner-sidebar ${open ? 'open' : ''}`}>
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: brand.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16, color: 'white', flexShrink: 0 }}>{brand.letter}</div>
            <span className="sidebar-label" style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{brand.name}</span>
          </div>
        </div>
        <nav>
          {/* Notifications first — always on top */}
          <NavItem href="/owner/notifications" icon="🔔" label={t('sidebar.notifications')} badge={unreadCount} />
          <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 16px' }} />
          {NAV_MAIN.map(item => <NavItem key={item.href} href={item.href} icon={item.icon} label={t(item.key)} />)}
          <div className="sidebar-section-label">{t('sidebar.warehouse')}</div>
          {NAV_MAGAZZINO.map(item => <NavItem key={item.href} href={item.href} icon={item.icon} label={t(item.key)} />)}
          <div className="sidebar-section-label">{t('sidebar.management')}</div>
          {NAV_GESTIONE.map(item => <NavItem key={item.href} href={item.href} icon={item.icon} label={t(item.key)} />)}
        </nav>
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} style={{ width: '100%', padding: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>{t('logout')}</button>
        </div>
      </aside>
    </>
  )
}

