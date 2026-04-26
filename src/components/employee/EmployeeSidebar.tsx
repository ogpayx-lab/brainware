'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const MENU_SECTIONS = [
  {
    title: '⚡ Azioni Rapide',
    items: [
      { href: '/employee/pos',       icon: '🛒', label: 'Nuova Vendita',        color: '#22C55E', desc: 'Registra vendita al POS' },
      { href: '/employee/sales-log', icon: '🧾', label: 'Registro Vendite',     color: '#10B981', desc: 'Storico vendite turno' },
      { href: '/employee/orders',    icon: '📦', label: 'Spedizioni Shopify',   color: '#3B82F6', desc: 'Evadi ordini online' },
      { href: '/employee/fidelity',  icon: '💳', label: 'Fidelity Card',        color: '#8B5CF6', desc: 'Nuovo cliente fedele' },
      { href: '/employee/inventory', icon: '📊', label: 'Conteggio Inventario', color: '#F59E0B', desc: 'Verifica giacenze' },
      { href: '/employee/stock',     icon: '📥', label: 'Ricarica Stock',       color: '#EF4444', desc: 'Aggiungi quantità' },
      { href: '/employee/reorder',   icon: '📢', label: 'Richiedi Ricarica',    color: '#EC4899', desc: 'Segnala prodotti mancanti' },
    ],
  },
  {
    title: '🏪 Gestione Negozio',
    items: [
      { href: '/employee/expenses',     icon: '💸', label: 'Aggiungi Spesa',   color: '#F97316', desc: 'Registra uscite' },
      { href: '/employee/maintenance',  icon: '🔧', label: 'Manutenzione',     color: '#6B7280', desc: 'Checklist giornaliera' },
      { href: '/employee/photos',       icon: '📷', label: 'Foto Registro',    color: '#06B6D4', desc: 'Carica foto del registro' },
      { href: '/employee/transfers',    icon: '🔄', label: 'Trasferimenti',    color: '#8B5CF6', desc: 'Sposta tra store' },
    ],
  },
  {
    title: '👤 Personale',
    items: [
      { href: '/employee/calendar',       icon: '📅', label: 'Giorni Liberi',    color: '#14B8A6', desc: 'Richiedi permessi' },
      { href: '/employee/notifications',  icon: '🔔', label: 'Notifiche',       color: '#F97316', desc: 'Messaggi e avvisi' },
      { href: '/employee/ai',            icon: '🤖', label: 'Assistente AI',    color: '#6366F1', desc: 'Aiuto e procedure' },
    ],
  },
  {
    title: '🔐 Turno',
    items: [
      { href: '/employee/shift/close', icon: '🔒', label: 'Chiudi Turno',  color: '#EF4444', desc: 'Fine turno e deposito' },
    ],
  },
]

export function EmployeeSidebar() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [storeName, setStoreName] = useState('')
  const pathname = usePathname()
  const router = useRouter()

  // Close sidebar on route change
  useEffect(() => { setOpen(false) }, [pathname])

  // Close on escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [])

  // Load user info
  useEffect(() => {
    async function loadUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('users').select('full_name, stores(name)').eq('id', user.id).single()
      if (profile) {
        const activeEmpName = localStorage.getItem('activeEmployeeName')
        setName(activeEmpName || profile.full_name || '')
        setStoreName((profile.stores as any)?.name ?? '')
      }
    }
    loadUser()
  }, [])

  // Prevent scroll when open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  async function handleCheckout() {
    const supabase = createClient()
    // Check-out from shift
    const activeEmpId = localStorage.getItem('activeEmployeeId')
    if (activeEmpId) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from('users').select('store_id').eq('id', user.id).single()
        if (profile?.store_id) {
          const { data: openShift } = await supabase.from('shifts').select('id').eq('store_id', profile.store_id).eq('status', 'open').order('created_at', { ascending: false }).limit(1).single()
          if (openShift) {
            await supabase.from('shift_checkins').update({ checked_out_at: new Date().toISOString() }).eq('shift_id', openShift.id).eq('user_id', activeEmpId).is('checked_out_at', null)
          }
        }
      }
    }
    localStorage.removeItem('activeEmployeeId')
    localStorage.removeItem('activeEmployeeName')
    router.push('/employee/shift/open')
    setOpen(false)
  }

  return (
    <>
      {/* Hamburger Trigger — fixed top-left */}
      <button
        id="sidebar-toggle"
        onClick={() => setOpen(true)}
        aria-label="Apri menu"
        style={{
          position: 'fixed', top: 12, left: 12, zIndex: 150,
          width: 40, height: 40, borderRadius: 12,
          background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 4, cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)' }}
      >
        <span style={{ width: 18, height: 2, background: 'var(--text-primary)', borderRadius: 2 }} />
        <span style={{ width: 14, height: 2, background: 'var(--text-secondary)', borderRadius: 2 }} />
        <span style={{ width: 18, height: 2, background: 'var(--text-primary)', borderRadius: 2 }} />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 998, transition: 'opacity 0.3s',
            animation: 'fadeIn 0.2s ease-out',
          }}
        />
      )}

      {/* Sidebar Panel */}
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0,
        width: 300, maxWidth: '85vw',
        background: 'var(--bg-primary)',
        borderRight: '1px solid var(--border-subtle)',
        zIndex: 999,
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        display: 'flex', flexDirection: 'column',
        boxShadow: open ? '4px 0 24px rgba(0,0,0,0.12)' : 'none',
      }}>
        {/* Sidebar Header */}
        <div style={{
          padding: '20px 18px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              {name ? `${name.split(' ')[0]} 👋` : 'Menu'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {storeName}
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Chiudi menu"
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--bg-surface)', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 16, color: 'var(--text-secondary)',
            }}
          >
            ✕
          </button>
        </div>

        {/* Dashboard quick link */}
        <Link href="/employee/dashboard" onClick={() => setOpen(false)} style={{ textDecoration: 'none' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 18px', margin: '8px 12px',
            background: pathname === '/employee/dashboard' ? 'var(--brand-primary-light)' : 'var(--bg-surface)',
            borderRadius: 12, transition: 'background 0.15s',
          }}>
            <span style={{ fontSize: 20 }}>🏠</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--brand-primary)' }}>Dashboard</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Riepilogo turno</div>
            </div>
          </div>
        </Link>

        {/* Scrollable Menu */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {MENU_SECTIONS.map((section) => (
            <div key={section.title} style={{ padding: '8px 12px' }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)',
                textTransform: 'uppercase', letterSpacing: '0.05em',
                padding: '4px 6px 8px',
              }}>
                {section.title}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {section.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                  return (
                    <Link key={item.href} href={item.href} onClick={() => setOpen(false)} style={{ textDecoration: 'none' }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 12px', borderRadius: 10,
                        background: isActive ? `${item.color}12` : 'transparent',
                        transition: 'background 0.15s',
                        cursor: 'pointer',
                      }}
                        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-surface)' }}
                        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                      >
                        <span style={{
                          width: 36, height: 36, borderRadius: 10,
                          background: `${item.color}15`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 18, flexShrink: 0,
                        }}>
                          {item.icon}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontWeight: 600, fontSize: 13,
                            color: isActive ? item.color : 'var(--text-primary)',
                          }}>
                            {item.label}
                          </div>
                          <div style={{
                            fontSize: 11, color: 'var(--text-tertiary)',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            {item.desc}
                          </div>
                        </div>
                        {isActive && (
                          <span style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: item.color, flexShrink: 0,
                          }} />
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar Footer — Check Out */}
        <div style={{
          borderTop: '1px solid var(--border-subtle)',
          padding: '12px',
        }}>
          <button
            onClick={handleCheckout}
            style={{
              width: '100%', padding: '12px',
              background: 'linear-gradient(135deg, #F59E0B, #D97706)',
              border: 'none', borderRadius: 12,
              color: 'white', fontWeight: 700, fontSize: 14,
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 8,
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(249,115,22,0.3)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none' }}
          >
            🚪 Check Out
          </button>
        </div>
      </div>

      {/* Global animation */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
      `}</style>
    </>
  )
}
