'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/lib/i18n'
import { useIsDemo } from '@/components/DemoBanner'

export function EmployeeSidebar() {
  const [open, setOpen] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [checks, setChecks] = useState({ cassa: false, pulizia: false, prodotti: false })
  const [now, setNow] = useState(new Date())
  const [name, setName] = useState('')
  const [storeName, setStoreName] = useState('')
  const pathname = usePathname()
  const router = useRouter()
  const t = useT()
  const isDemo = useIsDemo()
  const topOffset = isDemo ? 46 : 12

  // Draggable menu button
  const [menuPos, setMenuPos] = useState<{ x: number; y: number }>({ x: 12, y: topOffset })
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 })
  const hasMoved = useRef(false)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('menuBtnPos')
      if (saved) {
        const pos = JSON.parse(saved)
        setMenuPos({ x: pos.x ?? 12, y: pos.y ?? topOffset })
      }
    } catch {}
  }, [topOffset])

  const handleDragStart = useCallback((clientX: number, clientY: number) => {
    isDragging.current = true
    hasMoved.current = false
    dragStart.current = { x: clientX, y: clientY, posX: menuPos.x, posY: menuPos.y }
  }, [menuPos])

  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging.current) return
    const dx = clientX - dragStart.current.x
    const dy = clientY - dragStart.current.y
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) hasMoved.current = true
    const newX = Math.max(0, Math.min(window.innerWidth - 56, dragStart.current.posX + dx))
    const newY = Math.max(0, Math.min(window.innerHeight - 56, dragStart.current.posY + dy))
    setMenuPos({ x: newX, y: newY })
  }, [])

  const handleDragEnd = useCallback(() => {
    if (!isDragging.current) return
    isDragging.current = false
    if (hasMoved.current) {
      localStorage.setItem('menuBtnPos', JSON.stringify(menuPos))
    }
  }, [menuPos])

  useEffect(() => {
    const onTouchMove = (e: TouchEvent) => { if (isDragging.current) { e.preventDefault(); handleDragMove(e.touches[0].clientX, e.touches[0].clientY) } }
    const onTouchEnd = () => handleDragEnd()
    const onMouseMove = (e: MouseEvent) => handleDragMove(e.clientX, e.clientY)
    const onMouseUp = () => handleDragEnd()
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [handleDragMove, handleDragEnd])

  const MENU_SECTIONS = [
    {
      title: `⚡ ${t('empSidebar.quickActions')}`,
      items: [
        { href: '/employee/pos',       icon: '🛒', label: t('empSidebar.newSale'),        color: '#22C55E', desc: t('empSidebar.newSaleDesc') },
        { href: '/employee/sales-log', icon: '🧾', label: t('empSidebar.salesLog'),       color: '#10B981', desc: t('empSidebar.salesLogDesc') },
        { href: '/employee/orders',    icon: '📦', label: t('empSidebar.shopifyOrders'),   color: '#3B82F6', desc: t('empSidebar.shopifyOrdersDesc') },
        { href: '/employee/fidelity',  icon: '💳', label: t('empSidebar.fidelityCard'),    color: '#8B5CF6', desc: t('empSidebar.fidelityCardDesc') },
        { href: '/employee/inventory', icon: '📊', label: t('empSidebar.inventoryCount'),  color: '#F59E0B', desc: t('empSidebar.inventoryCountDesc') },
        { href: '/employee/stock',     icon: '📥', label: t('empSidebar.restockLabel'),    color: '#EF4444', desc: t('empSidebar.restockDesc') },
        { href: '/employee/reorder',   icon: '📢', label: t('empSidebar.requestRestock'),  color: '#EC4899', desc: t('empSidebar.requestRestockDesc') },
      ],
    },
    {
      title: `🏪 ${t('empSidebar.storeManagement')}`,
      items: [
        { href: '/employee/expenses',     icon: '💸', label: t('empSidebar.addExpense'),   color: '#F97316', desc: t('empSidebar.addExpenseDesc') },
        { href: '/employee/maintenance',  icon: '🔧', label: t('empSidebar.maintenance'),  color: '#6B7280', desc: t('empSidebar.maintenanceDesc') },
        { href: '/employee/photos',       icon: '📷', label: t('empSidebar.photoLog'),     color: '#06B6D4', desc: t('empSidebar.photoLogDesc') },
        { href: '/employee/transfers',    icon: '🔄', label: t('empSidebar.transfers'),    color: '#8B5CF6', desc: t('empSidebar.transfersDesc') },
      ],
    },
    {
      title: `👤 ${t('empSidebar.staff')}`,
      items: [
        { href: '/employee/calendar',       icon: '📅', label: t('empSidebar.daysOff'),     color: '#14B8A6', desc: t('empSidebar.daysOffDesc') },
        { href: '/employee/notifications',  icon: '🔔', label: t('empSidebar.notifications'), color: '#F97316', desc: t('empSidebar.notificationsDesc') },
        { href: '/employee/ai',            icon: '🤖', label: t('empSidebar.aiAssistant'),  color: '#6366F1', desc: t('empSidebar.aiAssistantDesc') },
      ],
    },
    {
      title: `🔐 ${t('empSidebar.shiftSection')}`,
      items: [
        { href: '/employee/shift/close', icon: '🔒', label: t('empSidebar.closeShift'), color: '#EF4444', desc: t('empSidebar.closeShiftDesc') },
      ],
    },
  ]

  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); setShowCheckout(false) } }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [])
  useEffect(() => {
    if (!showCheckout) return
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [showCheckout])
  useEffect(() => {
    async function loadUser() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
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
  useEffect(() => {
    if (open || showCheckout) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open, showCheckout])

  function openCheckoutModal() {
    setNow(new Date())
    setChecks({ cassa: false, pulizia: false, prodotti: false })
    setShowCheckout(true)
    setOpen(false)
  }

  const allChecked = checks.cassa && checks.pulizia && checks.prodotti

  async function handleCheckout() {
    if (!allChecked) return
    setCheckingOut(true)
    const supabase = createClient()
    const activeEmpId = localStorage.getItem('activeEmployeeId')
    if (activeEmpId) {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
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
    setShowCheckout(false)
    setCheckingOut(false)
    router.push('/employee/shift/open')
  }

  return (
    <>
      <button ref={btnRef} id="sidebar-toggle"
        onClick={() => { if (!hasMoved.current) setOpen(true) }}
        onTouchStart={e => handleDragStart(e.touches[0].clientX, e.touches[0].clientY)}
        onMouseDown={e => { e.preventDefault(); handleDragStart(e.clientX, e.clientY) }}
        aria-label={t('empSidebar.openMenu')} style={{
        position: 'fixed', top: menuPos.y, left: menuPos.x, zIndex: 10000, width: 56, height: 56, borderRadius: 16,
        background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 5, cursor: isDragging.current ? 'grabbing' : 'grab', boxShadow: '0 6px 24px rgba(99,102,241,0.5)',
        transition: isDragging.current ? 'none' : 'box-shadow 0.2s', touchAction: 'none', userSelect: 'none',
      }}>
        <span style={{ width: 22, height: 2.5, background: 'white', borderRadius: 2 }} />
        <span style={{ width: 16, height: 2.5, background: 'rgba(255,255,255,0.8)', borderRadius: 2 }} />
        <span style={{ width: 22, height: 2.5, background: 'white', borderRadius: 2 }} />
        <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.9)', fontWeight: 700, letterSpacing: '0.05em', marginTop: -1 }}>MENU</span>
      </button>

      {open && <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 998, animation: 'fadeIn 0.2s ease-out' }} />}

      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, width: 300, maxWidth: '85vw',
        background: 'var(--bg-primary)', borderRight: '1px solid var(--border-subtle)', zIndex: 999,
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        display: 'flex', flexDirection: 'column', boxShadow: open ? '4px 0 24px rgba(0,0,0,0.12)' : 'none',
      }}>
        <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{name ? `${name.split(' ')[0]} 👋` : 'Menu'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{storeName}</div>
          </div>
          <button onClick={() => setOpen(false)} aria-label={t('close')} style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-surface)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16, color: 'var(--text-secondary)' }}>✕</button>
        </div>

        <Link href="/employee/dashboard" onClick={() => setOpen(false)} style={{ textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', margin: '8px 12px', background: pathname === '/employee/dashboard' ? 'var(--brand-primary-light)' : 'var(--bg-surface)', borderRadius: 12 }}>
            <span style={{ fontSize: 20 }}>🏠</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--brand-primary)' }}>Dashboard</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{t('empSidebar.shiftSummary')}</div>
            </div>
          </div>
        </Link>

        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {MENU_SECTIONS.map((section) => (
            <div key={section.title} style={{ padding: '8px 12px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 6px 8px' }}>{section.title}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {section.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                  return (
                    <Link key={item.href} href={item.href} onClick={() => setOpen(false)} style={{ textDecoration: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, background: isActive ? `${item.color}12` : 'transparent', transition: 'background 0.15s', cursor: 'pointer' }}
                        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-surface)' }}
                        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                      >
                        <span style={{ width: 36, height: 36, borderRadius: 10, background: `${item.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: isActive ? item.color : 'var(--text-primary)' }}>{item.label}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.desc}</div>
                        </div>
                        {isActive && <span style={{ width: 6, height: 6, borderRadius: '50%', background: item.color, flexShrink: 0 }} />}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '12px' }}>
          <button onClick={openCheckoutModal} style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg, #F59E0B, #D97706)', border: 'none', borderRadius: 12, color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>🚪 Check Out</button>
        </div>
      </div>

      {showCheckout && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1100, padding:20 }}>
          <div style={{ background:'var(--bg-primary)', borderRadius:24, padding:0, width:'100%', maxWidth:400, overflow:'hidden', boxShadow:'0 24px 48px rgba(0,0,0,0.2)' }}>
            <div style={{ background:'linear-gradient(135deg, #F59E0B, #D97706)', padding:'24px 24px 20px', textAlign:'center' }}>
              <div style={{ fontSize:40, marginBottom:8 }}>🚪</div>
              <div style={{ color:'white', fontWeight:800, fontSize:20 }}>Check Out</div>
              <div style={{ color:'rgba(255,255,255,0.85)', fontSize:13, marginTop:4 }}>{t('empSidebar.confirmExit')}</div>
            </div>
            <div style={{ padding:'20px 24px' }}>
              <div style={{ background:'var(--bg-surface)', borderRadius:14, padding:'14px 16px', marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:11, color:'var(--text-tertiary)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{t('empSidebar.employee')}</div>
                  <div style={{ fontSize:16, fontWeight:700, marginTop:2 }}>{name}</div>
                  <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:1 }}>{storeName}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:11, color:'var(--text-tertiary)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{t('empSidebar.exitTime')}</div>
                  <div style={{ fontSize:22, fontWeight:800, fontFamily:'monospace', color:'var(--brand-primary)', marginTop:2 }}>{now.toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit', second:'2-digit' })}</div>
                  <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:1 }}>{now.toLocaleDateString('it-IT', { day:'numeric', month:'long', year:'numeric' })}</div>
                </div>
              </div>
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:10, color:'var(--text-primary)' }}>✅ {t('empSidebar.confirmCompleted')}</div>
                {[
                  { key: 'cassa' as const, label: t('empSidebar.checkCash'), icon: '💰' },
                  { key: 'pulizia' as const, label: t('empSidebar.checkClean'), icon: '🧹' },
                  { key: 'prodotti' as const, label: t('empSidebar.checkProducts'), icon: '📦' },
                ].map(item => (
                  <div key={item.key} onClick={() => setChecks(prev => ({ ...prev, [item.key]: !prev[item.key] }))} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', marginBottom:6, borderRadius:12, background: checks[item.key] ? '#F0FDF4' : 'var(--bg-surface)', border: checks[item.key] ? '2px solid #22C55E' : '1.5px solid var(--border-subtle)', cursor:'pointer', transition:'all 0.15s' }}>
                    <div style={{ width:24, height:24, borderRadius:8, flexShrink:0, border: checks[item.key] ? 'none' : '2px solid var(--border-default)', background: checks[item.key] ? '#22C55E' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:14, fontWeight:700 }}>{checks[item.key] && '✓'}</div>
                    <div style={{ flex:1, fontSize:13, fontWeight: checks[item.key] ? 600 : 400, color: checks[item.key] ? '#15803D' : 'var(--text-primary)' }}>{item.icon} {item.label}</div>
                  </div>
                ))}
              </div>
              {!allChecked && (
                <div style={{ background:'#FFFBEB', border:'1px solid #FCD34D', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:12, color:'#92400E' }}>⚠️ {t('empSidebar.checkoutWarning')}</div>
              )}
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={() => setShowCheckout(false)} style={{ flex:1, padding:'13px', background:'var(--bg-surface)', border:'1px solid var(--border-default)', borderRadius:12, fontWeight:600, fontSize:14, cursor:'pointer', color:'var(--text-primary)' }}>{t('cancel')}</button>
                <button onClick={handleCheckout} disabled={!allChecked || checkingOut} style={{ flex:1.5, padding:'13px', background: allChecked ? 'linear-gradient(135deg, #F59E0B, #D97706)' : '#E5E7EB', border:'none', borderRadius:12, fontWeight:700, fontSize:14, cursor: allChecked ? 'pointer' : 'not-allowed', color: allChecked ? 'white' : '#9CA3AF' }}>
                  {checkingOut ? `⏳ ${t('empApp.exitMsg')}` : `🚪 ${t('empSidebar.confirmCheckout')}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }`}</style>
    </>
  )
}
