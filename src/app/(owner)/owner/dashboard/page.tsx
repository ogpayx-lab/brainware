'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { fmt, formatTime } from '@/lib/utils'
import { playNotificationSound } from '@/lib/useNotificationSound'

const TYPE_ICON: Record<string, string> = {
  day_off_request: '📅', sale: '💰', task_completed: '✅', low_stock: '⚠️',
  shift_open: '🟢', shift_close: '🔴', maintenance: '🔧', checkout_alert: '⚠️', default: '🔔',
}

export default function OwnerDashboard() {
  const router = useRouter()
  const supabase = createClient()
  const [data, setData] = useState<any>(null)
  const [stores, setStores] = useState<any[]>([])
  const [selectedStore, setSelectedStore] = useState('all')
  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [storeName, setStoreName] = useState('')
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0])
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0])

  // Notifications
  const [notifications, setNotifications] = useState<any[]>([])
  const [showAllNotifs, setShowAllNotifs] = useState(false)
  const prevNotifCount = useRef<number | null>(null)

  // Live clock
  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])

  useEffect(() => {
    loadData()
    const t = setInterval(loadData, 60000)
    return () => clearInterval(t)
  }, [selectedStore, dateFrom, dateTo])

  const loadNotifications = useCallback(async (sid: string) => {
    const { data: notifs } = await supabase
      .from('notifications')
      .select('*, users(full_name)')
      .eq('store_id', sid)
      .order('created_at', { ascending: false })
      .limit(15)
    setNotifications(notifs ?? [])
    const unread = (notifs ?? []).filter((n: any) => !n.read).length
    if (prevNotifCount.current !== null && unread > prevNotifCount.current) {
      playNotificationSound()
    }
    prevNotifCount.current = unread
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('users').select('store_id, role, full_name').eq('id', user.id).single()
    if (!profile || profile.role !== 'owner') { router.push('/login'); return }
    setStoreId(profile.store_id)

    const { data: storeData } = await supabase.from('stores').select('name, organization_id').eq('id', profile.store_id).single()
    setStoreName(storeData?.name ?? '')
    const oid = storeData?.organization_id
    const { data: storesData } = await supabase.from('stores').select('id,name').eq('organization_id', oid)
    setStores(storesData ?? [])

    loadNotifications(profile.store_id)

    // Date range
    const dayStart = `${dateFrom}T00:00:00`
    const dayEnd = `${dateTo}T23:59:59`

    const isAll = selectedStore === 'all'
    const allStores = storesData ?? []
    const storeIds = isAll ? allStores.map(s => s.id) : [selectedStore || profile.store_id]

    // Sales (ALL movements including shopify)
    let salesQuery = supabase.from('sales').select('*').gte('created_at', dayStart).lte('created_at', dayEnd)
    if (!isAll) salesQuery = salesQuery.eq('store_id', storeIds[0])
    else salesQuery = salesQuery.in('store_id', storeIds)
    const { data: allSalesData } = await salesQuery

    // Shifts for this day (to find who worked)
    let shiftQuery = supabase.from('shifts').select('*,users(full_name),stores(name)').gte('created_at', dayStart).lte('created_at', dayEnd)
    if (!isAll) shiftQuery = shiftQuery.eq('store_id', storeIds[0])
    else shiftQuery = shiftQuery.in('store_id', storeIds)
    const { data: dayShifts } = await shiftQuery

    // Also check shifts that were open before this day and still active on this day
    let activeShiftQuery = supabase.from('shifts').select('*,users(full_name),stores(name)').lte('created_at', dayEnd).or(`closed_at.is.null,closed_at.gte.${dayStart}`)
    if (!isAll) activeShiftQuery = activeShiftQuery.eq('store_id', storeIds[0])
    else activeShiftQuery = activeShiftQuery.in('store_id', storeIds)
    const { data: activeShifts } = await activeShiftQuery

    // Merge unique shifts
    const allShiftsMap = new Map()
    for (const s of [...(dayShifts ?? []), ...(activeShifts ?? [])]) {
      allShiftsMap.set(s.id, s)
    }
    const mergedShifts = Array.from(allShiftsMap.values())

    const allSales = allSalesData ?? []
    const realSales = allSales.filter((s: any) => s.movement_type === 'sale')

    // Core metrics
    const totalCash = realSales.filter((s: any) => s.payment_method === 'cash').reduce((sum: number, x: any) => sum + x.total, 0)
    const totalPos = realSales.filter((s: any) => s.payment_method === 'pos').reduce((sum: number, x: any) => sum + x.total, 0)
    const totalRevenue = totalCash + totalPos
    const totalTxn = realSales.length
    const avgSale = totalTxn > 0 ? totalRevenue / totalTxn : 0
    const customerCount = totalTxn // Each transaction = 1 customer

    // Deposit from closed shifts
    const closedShifts = mergedShifts.filter((s: any) => s.deposit_actual != null)
    const totalDeposit = closedShifts.reduce((sum: number, s: any) => sum + (s.deposit_actual || 0), 0)

    // Online sales (Shopify) — count ALL shopify sales regardless of fulfillment
    const shopifySales = allSales.filter((s: any) => s.acquisition_channel === 'shopify')
    const shopifyRevenue = shopifySales.reduce((sum: number, x: any) => sum + Math.abs(x.total), 0)
    const shopifyCount = shopifySales.length

    // Acquisition channel breakdown
    const channelBreakdown: Record<string, { count: number; revenue: number }> = {}
    realSales.forEach((s: any) => {
      const ch = s.acquisition_channel || 'walk-in'
      if (!channelBreakdown[ch]) channelBreakdown[ch] = { count: 0, revenue: 0 }
      channelBreakdown[ch].count++
      channelBreakdown[ch].revenue += s.total
    })

    // Hourly distribution
    const hourlyCustomers: number[] = Array(24).fill(0)
    const hourlyRevenue: number[] = Array(24).fill(0)
    realSales.forEach((s: any) => {
      const h = new Date(s.created_at).getHours()
      hourlyCustomers[h]++
      hourlyRevenue[h] += s.total
    })

    // People who worked that day — deduplicate by user_id (keep latest shift per user)
    const workerMap = new Map<string, { name: string; store: string; period: string; hours: string }>()
    // Sort shifts by created_at descending so newest first
    const sortedShifts = [...mergedShifts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    for (const shift of sortedShifts) {
      const uid = shift.user_id
      if (workerMap.has(uid)) continue // already got the latest shift for this user
      const shiftStart = new Date(shift.opened_at || shift.created_at)
      const shiftEnd = shift.closed_at ? new Date(shift.closed_at) : now
      const hours = Math.max(0.5, (shiftEnd.getTime() - shiftStart.getTime()) / 3600000)
      workerMap.set(uid, {
        name: shift.users?.full_name ?? '?',
        store: shift.stores?.name ?? '',
        period: shift.period === 'morning' ? '☀️ Mattina' : '🌙 Sera',
        hours: hours.toFixed(1),
      })
    }
    const workers = Array.from(workerMap.values())

    // Per-store breakdown
    const storeBreakdown: any[] = []
    if (allStores.length > 1) {
      for (const store of allStores) {
        const storeSales = realSales.filter((s: any) => s.store_id === store.id)
        const storeRev = storeSales.reduce((sum: number, x: any) => sum + x.total, 0)
        const storeCash = storeSales.filter((s: any) => s.payment_method === 'cash').reduce((sum: number, x: any) => sum + x.total, 0)
        const storePos = storeSales.filter((s: any) => s.payment_method === 'pos').reduce((sum: number, x: any) => sum + x.total, 0)
        const storeTxn = storeSales.length
        const storeAvg = storeTxn > 0 ? storeRev / storeTxn : 0
        storeBreakdown.push({ name: store.name, revenue: storeRev, cash: storeCash, pos: storePos, txn: storeTxn, avg: storeAvg })
      }
    }

    setData({
      totalRevenue, totalCash, totalPos, totalTxn, avgSale, customerCount,
      totalDeposit, shopifyRevenue, shopifyCount,
      channelBreakdown, hourlyCustomers, hourlyRevenue,
      workers, storeBreakdown,
    })
    setLoading(false)
  }

  async function markNotifRead(id: string) {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }
  async function markAllRead() {
    if (!storeId) return
    await supabase.from('notifications').update({ read: true }).eq('store_id', storeId).eq('read', false)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}><div style={{ color:'var(--text-secondary)' }}>Caricamento...</div></div>
  if (!data) return null

  const unreadCount = notifications.filter(n => !n.read).length
  const maxHourly = Math.max(...data.hourlyCustomers, 1)
  const CHANNEL_LABELS: Record<string, string> = { 'walk-in': '🚶 Walk-in', social: '📱 Social', google: '🔍 Google', referral: '🤝 Referral', shopify: '🛍️ Shopify', other: '📋 Altro' }
  const isTodayRange = dateTo === new Date().toISOString().split('T')[0]
  const isSingleDay = dateFrom === dateTo

  return (
    <div>
      {/* ═══════ HEADER ═══════ */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'var(--space-lg)' }}>
        <div>
          <h2>📊 Dashboard</h2>
          <p style={{ color:'var(--text-secondary)', fontSize:14, marginTop:4 }}>
            {storeName} — {isSingleDay
              ? new Date(dateFrom + 'T12:00:00').toLocaleDateString('it-IT', { weekday:'long', day:'numeric', month:'long', year:'numeric' })
              : `${new Date(dateFrom + 'T12:00:00').toLocaleDateString('it-IT', { day:'numeric', month:'short' })} → ${new Date(dateTo + 'T12:00:00').toLocaleDateString('it-IT', { day:'numeric', month:'short', year:'numeric' })}`
            }
          </p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            <label style={{ fontSize:11, color:'var(--text-tertiary)', fontWeight:600 }}>Da</label>
            <input type="date" className="input" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              style={{ fontSize:13, fontWeight:600, padding:'5px 8px' }} />
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            <label style={{ fontSize:11, color:'var(--text-tertiary)', fontWeight:600 }}>A</label>
            <input type="date" className="input" value={dateTo} onChange={e => setDateTo(e.target.value)}
              style={{ fontSize:13, fontWeight:600, padding:'5px 8px' }} />
          </div>
          {isTodayRange && (
            <div style={{ textAlign:'right', marginLeft:8 }}>
              <div style={{ fontFamily:'var(--font-heading)', fontSize:22, fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em' }}>
                {now.toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit' })}
              </div>
              <div style={{ fontSize:10, color:'var(--text-tertiary)' }}>🟢 Live</div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════ STORE FILTER ═══════ */}
      <div style={{ display:'flex', gap:6, marginBottom:'var(--space-lg)', flexWrap:'wrap' }}>
        <button onClick={() => setSelectedStore('all')} className={`badge ${selectedStore==='all'?'badge-brand':'badge-gray'}`} style={{ cursor:'pointer', border:'none', padding:'6px 14px', fontSize:13 }}>
          Tutti gli Store
        </button>
        {stores.map(s => (
          <button key={s.id} onClick={() => setSelectedStore(s.id)} className={`badge ${selectedStore===s.id?'badge-brand':'badge-gray'}`} style={{ cursor:'pointer', border:'none', padding:'6px 14px', fontSize:13 }}>
            {s.name}
          </button>
        ))}
      </div>

      {/* ═══════ CENTRO NOTIFICHE (collassabile) ═══════ */}
      <div className="card" style={{ marginBottom:'var(--space-xl)', padding:0, overflow:'hidden' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 18px', borderBottom: showAllNotifs ? '1px solid var(--border-subtle)' : 'none' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:18 }}>🔔</span>
            <h4 style={{ margin:0, fontSize:14 }}>Notifiche</h4>
            {unreadCount > 0 && <span style={{ background:'var(--danger)', color:'white', borderRadius:20, padding:'1px 8px', fontSize:11, fontWeight:700 }}>{unreadCount}</span>}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            {unreadCount > 0 && <button onClick={markAllRead} style={{ background:'none', border:'none', color:'var(--text-secondary)', fontSize:11, cursor:'pointer' }}>✓ Letto tutto</button>}
            <button onClick={() => setShowAllNotifs(!showAllNotifs)} style={{ background:'none', border:'none', color:'var(--brand-primary)', fontSize:12, fontWeight:600, cursor:'pointer' }}>
              {showAllNotifs ? '▲ Chiudi' : `▼ (${notifications.length})`}
            </button>
          </div>
        </div>
        {showAllNotifs && (
          <div style={{ maxHeight:300, overflowY:'auto' }}>
            {notifications.length === 0 && <div style={{ padding:'var(--space-lg)', textAlign:'center', color:'var(--text-tertiary)', fontSize:13 }}>Nessuna notifica</div>}
            {notifications.map((n, i) => (
              <div key={n.id} onClick={() => markNotifRead(n.id)} style={{
                display:'flex', alignItems:'flex-start', gap:10, padding:'10px 18px',
                borderBottom: i < notifications.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                background: n.read ? 'transparent' : 'var(--brand-primary-light)', cursor:'pointer',
              }}>
                <span style={{ fontSize:16 }}>{TYPE_ICON[n.type] ?? '🔔'}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight: n.read ? 500 : 700, fontSize:13 }}>{n.title}</div>
                  {n.message && <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:1 }}>{n.message}</div>}
                </div>
                <span style={{ fontSize:10, color:'var(--text-tertiary)', flexShrink:0 }}>
                  {new Date(n.created_at).toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══════ KPI ═══════ */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'var(--space-md)', marginBottom:'var(--space-xl)' }}>
        {[
          { label:'Avg Sale / Customer', value: fmt(data.avgSale), color:'var(--brand-primary)' },
          { label:'Total Cash', value: fmt(data.totalCash), color:'var(--text-primary)' },
          { label:'Total POS', value: fmt(data.totalPos), color:'#7C3AED' },
          { label:'Deposit', value: fmt(data.totalDeposit), color:'var(--success)' },
          { label:'Clienti', value: data.customerCount.toString(), color:'var(--text-primary)' },
          { label:'Revenue Totale', value: fmt(data.totalRevenue), color:'var(--brand-primary)' },
          { label:'Online Sales (Shopify)', value: `${fmt(data.shopifyRevenue)} (${data.shopifyCount})`, color:'#7C3AED' },
          { label:'Scontrino Medio', value: fmt(data.avgSale), color:'var(--text-primary)' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* ═══════ CHI HA LAVORATO ═══════ */}
      <div className="card" style={{ marginBottom:'var(--space-xl)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'var(--space-md)' }}>
          <h4>👥 Personale in servizio</h4>
          <span className="badge badge-gray">{data.workers.length} persone</span>
        </div>
        {data.workers.length === 0 ? (
          <p style={{ color:'var(--text-tertiary)', fontSize:14 }}>Nessun turno registrato per questa giornata</p>
        ) : (
          data.workers.map((w: any, i: number) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 0', borderBottom: i < data.workers.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
              <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--brand-primary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'white', flexShrink:0 }}>
                {w.name?.split(' ').map((n: string) => n[0]).join('').slice(0,2)}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600 }}>{w.name}</div>
                <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>{w.store} · {w.period}</div>
              </div>
              <span style={{ fontSize:13, fontWeight:600 }}>{w.hours}h</span>
            </div>
          ))
        )}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--space-xl)', marginBottom:'var(--space-xl)' }}>
        {/* ═══════ CANALE ACQUISIZIONE ═══════ */}
        <div className="card">
          <h4 style={{ marginBottom:'var(--space-lg)' }}>📊 Canale Acquisizione</h4>
          {Object.keys(data.channelBreakdown).length === 0 ? (
            <p style={{ color:'var(--text-tertiary)', fontSize:14 }}>Nessuna vendita</p>
          ) : (
            Object.entries(data.channelBreakdown)
              .sort((a: any, b: any) => b[1].count - a[1].count)
              .map(([channel, stats]: any) => {
                const pct = data.customerCount > 0 ? (stats.count / data.customerCount * 100) : 0
                return (
                  <div key={channel} style={{ marginBottom:14 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontSize:13, fontWeight:600 }}>{CHANNEL_LABELS[channel] || channel}</span>
                      <span style={{ fontSize:13, fontWeight:700 }}>{stats.count} clienti · {fmt(stats.revenue)} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div style={{ height:6, background:'var(--bg-surface-alt)', borderRadius:3 }}>
                      <div style={{ height:'100%', width:`${pct}%`, background:'var(--brand-primary)', borderRadius:3, transition:'width 0.3s' }} />
                    </div>
                  </div>
                )
              })
          )}
        </div>

        {/* ═══════ DISTRIBUZIONE ORARIA ═══════ */}
        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'var(--space-lg)' }}>
            <h4>🕐 Distribuzione Oraria Clienti</h4>
            <span style={{ fontSize:12, color:'var(--text-tertiary)' }}>{data.customerCount} totale</span>
          </div>
          <div style={{ display:'flex', alignItems:'flex-end', gap:2, height:120 }}>
            {data.hourlyCustomers.map((count: number, i: number) => {
              if (i < 7 || i > 23) return null
              const h = maxHourly > 0 ? Math.max(2, (count / maxHourly) * 100) : 2
              return (
                <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                  {count > 0 && <div style={{ fontSize:9, color:'var(--text-tertiary)', fontWeight:600 }}>{count}</div>}
                  <div style={{
                    width:'100%', height:`${h}%`, minHeight:2,
                    background: count > 0 ? 'var(--brand-primary)' : 'var(--bg-surface-alt)',
                    borderRadius:'3px 3px 0 0', transition:'height 0.3s',
                  }} />
                  <span style={{ fontSize:9, color:'var(--text-tertiary)' }}>{i}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ═══════ CONFRONTO STORE ═══════ */}
      {data.storeBreakdown.length > 0 && (
        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'var(--space-lg)' }}>
            <h4>🏪 Breakdown per Store</h4>
            <span className="badge badge-brand">{stores.length} Store</span>
          </div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Store</th><th>Revenue</th><th>Cash</th><th>POS</th><th>Clienti</th><th>Avg Sale</th></tr></thead>
              <tbody>
                {data.storeBreakdown.map((s: any) => (
                  <tr key={s.name}>
                    <td style={{ fontWeight:600 }}>{s.name}</td>
                    <td style={{ fontWeight:700, color:'var(--brand-primary)' }}>{fmt(s.revenue)}</td>
                    <td>{fmt(s.cash)}</td>
                    <td>{fmt(s.pos)}</td>
                    <td>{s.txn}</td>
                    <td>{fmt(s.avg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
