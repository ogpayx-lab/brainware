'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { fmt, formatTime } from '@/lib/utils'
import { playCashSound, playNotificationSound } from '@/lib/useNotificationSound'

const TYPE_ICON: Record<string, string> = {
  day_off_request: '📅', sale: '💰', task_completed: '✅', low_stock: '⚠️',
  shift_open: '🟢', shift_close: '🔴', maintenance: '🔧', default: '🔔',
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

  // Tasks
  const [tasks, setTasks] = useState<any[]>([])
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskAssignee, setNewTaskAssignee] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState<'alta'|'media'|'bassa'>('media')
  const [savingTask, setSavingTask] = useState(false)

  // Notifications
  const [notifications, setNotifications] = useState<any[]>([])
  const [showAllNotifs, setShowAllNotifs] = useState(false)
  const prevNotifCount = useRef<number | null>(null)
  const prevSalesCount = useRef<number | null>(null)

  // Live clock
  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])

  // Auto-refresh every 30s
  useEffect(() => {
    loadData()
    const t = setInterval(loadData, 30000)
    return () => clearInterval(t)
  }, [selectedStore])

  const loadNotifications = useCallback(async (sid: string) => {
    const { data: notifs } = await supabase
      .from('notifications')
      .select('*, users(full_name)')
      .eq('store_id', sid)
      .order('created_at', { ascending: false })
      .limit(20)
    const newNotifs = notifs ?? []
    setNotifications(newNotifs)

    // Play sound if new unread notifications arrived
    const unread = newNotifs.filter((n: any) => !n.read).length
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

    // Notifications
    loadNotifications(profile.store_id)

    // Today only for dashboard live view
    const todayStart = new Date(); todayStart.setHours(0,0,0,0)
    const fromDate = todayStart.toISOString()

    const isAll = selectedStore === 'all'
    const allStores = storesData ?? []
    const storeIds = isAll ? allStores.map(s => s.id) : [selectedStore || profile.store_id]

    let salesQuery = supabase.from('sales').select('*').gte('created_at', fromDate)
    if (!isAll) salesQuery = salesQuery.eq('store_id', storeIds[0])
    else salesQuery = salesQuery.in('store_id', storeIds)
    const { data: sales } = await salesQuery

    let expQuery = supabase.from('expenses').select('amount').gte('created_at', fromDate)
    if (!isAll) expQuery = expQuery.eq('store_id', storeIds[0])
    else expQuery = expQuery.in('store_id', storeIds)
    const { data: expenses } = await expQuery

    let shiftQuery = supabase.from('shifts').select('*,users(full_name),stores(name)').eq('status','open')
    if (!isAll) shiftQuery = shiftQuery.eq('store_id', storeIds[0])
    else shiftQuery = shiftQuery.in('store_id', storeIds)
    const { data: openShifts } = await shiftQuery

    const { data: lowStock } = isAll
      ? await supabase.from('low_stock_products').select('*').in('store_id', storeIds).limit(5)
      : await supabase.from('low_stock_products').select('*').eq('store_id', storeIds[0]).limit(5)

    // Fidelity counts today
    let fidQuery = supabase.from('fidelity_cards').select('id', { count: 'exact', head: true }).gte('created_at', fromDate)
    if (!isAll) fidQuery = fidQuery.eq('store_id', storeIds[0])
    else fidQuery = fidQuery.in('store_id', storeIds)
    const { count: fidCount } = await fidQuery

    const allSales = sales ?? []
    const realSales = allSales.filter((s: any) => s.movement_type === 'sale')
    const resi = allSales.filter((s: any) => s.movement_type === 'reso')
    const totalRevenue = realSales.reduce((s: number, x: any) => s + x.total, 0)
    const totalCash = realSales.filter((s: any) => s.payment_method === 'cash').reduce((s: number, x: any) => s + x.total, 0)
    const totalPos = realSales.filter((s: any) => s.payment_method === 'pos').reduce((s: number, x: any) => s + x.total, 0)
    const totalTxn = realSales.length
    const avgSale = totalTxn > 0 ? totalRevenue / totalTxn : 0
    const totalExpenses = (expenses ?? []).reduce((s: number, e: any) => s + e.amount, 0)
    const marginPct = totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue * 100) : 0
    const resoCount = resi.length
    const shopifyRevenue = realSales.filter((s: any) => s.acquisition_channel === 'shopify').reduce((s: number, x: any) => s + x.total, 0)
    const shopifyTxn = realSales.filter((s: any) => s.acquisition_channel === 'shopify').length
    const instoreRevenue = totalRevenue - shopifyRevenue
    const pendingDiscounts = realSales.filter((s: any) => s.discount_amount > 0 && !s.discount_approved)

    // Hourly chart (today)
    const hourlyRev: number[] = Array(24).fill(0)
    realSales.forEach((s: any) => { const h = new Date(s.created_at).getHours(); hourlyRev[h] += s.total })

    // Per-store comparison
    const storeComparison: any[] = []
    if (allStores.length > 1) {
      for (const store of allStores) {
        const storeSales = realSales.filter((s: any) => s.store_id === store.id)
        const storeRev = storeSales.reduce((s: number, x: any) => s + x.total, 0)
        const storeTxn = storeSales.length
        const storeAvg = storeTxn > 0 ? storeRev / storeTxn : 0
        const activeShifts = (openShifts ?? []).filter((sh: any) => sh.store_id === store.id).length
        storeComparison.push({ name: store.name, revenue: storeRev, txn: storeTxn, avg: storeAvg, active: activeShifts })
      }
    }

    // 💰 Cash register sound when new sale detected
    if (prevSalesCount.current !== null && totalTxn > prevSalesCount.current) {
      playCashSound()
    }
    prevSalesCount.current = totalTxn

    // Per-employee performance (for on-shift workers)
    const empPerformance: any[] = []
    for (const shift of (openShifts ?? [])) {
      const empSales = realSales.filter((s: any) => s.created_by === shift.user_id)
      const empRev = empSales.reduce((s: number, x: any) => s + x.total, 0)
      const empTxn = empSales.length
      const empAvg = empTxn > 0 ? empRev / empTxn : 0
      const shiftStart = new Date(shift.created_at)
      const hoursWorked = Math.max(0.5, (now.getTime() - shiftStart.getTime()) / 3600000)
      empPerformance.push({
        id: shift.user_id,
        name: shift.users?.full_name ?? '?',
        store: shift.stores?.name ?? '',
        period: shift.period,
        revenue: empRev, txn: empTxn, avg: empAvg,
        hoursWorked: hoursWorked.toFixed(1),
        revenuePerHour: empRev / hoursWorked,
      })
    }

    // Load tasks
    let tasksQuery = supabase.from('tasks').select('*,users!tasks_assigned_to_fkey(full_name)').eq('completed', false).order('created_at', { ascending: false }).limit(10)
    if (!isAll) tasksQuery = tasksQuery.eq('store_id', storeIds[0])
    else tasksQuery = tasksQuery.in('store_id', storeIds)
    const { data: tasksData } = await tasksQuery

    setData({
      totalRevenue, totalCash, totalPos, totalTxn, avgSale, totalExpenses, marginPct,
      resoCount, shopifyRevenue, shopifyTxn, instoreRevenue,
      openShifts: openShifts ?? [], recentSales: realSales.slice(0, 5), resi,
      lowStock: lowStock ?? [], pendingDiscounts, fidCount: fidCount ?? 0,
      hourlyRev, storeComparison, storeName: storeData?.name ?? '',
      empPerformance,
    })
    setTasks(tasksData ?? [])
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

  async function addQuickTask() {
    if (!newTaskTitle.trim() || !storeId) return
    setSavingTask(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('tasks').insert({
      store_id: storeId,
      title: newTaskTitle.trim(),
      priority: newTaskPriority,
      created_by: user?.id,
      assigned_to: newTaskAssignee || null,
    })
    setNewTaskTitle('')
    setNewTaskAssignee('')
    setSavingTask(false)
    loadData()
  }
  async function completeTask(id: string) {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('tasks').update({ completed: true, completed_at: new Date().toISOString(), completed_by: user?.id }).eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }
  async function deleteTask(id: string) {
    await supabase.from('tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}><div style={{ color:'var(--text-secondary)' }}>Caricamento...</div></div>
  if (!data) return null

  const unreadCount = notifications.filter(n => !n.read).length
  const maxHourly = Math.max(...data.hourlyRev, 1)
  const currentHour = now.getHours()

  return (
    <div>
      {/* ═══════════════ HEADER + LIVE CLOCK ═══════════════ */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'var(--space-lg)' }}>
        <div>
          <h2>📊 Dashboard Live</h2>
          <p style={{ color:'var(--text-secondary)', fontSize:14, marginTop:4 }}>
            {storeName} — {now.toLocaleDateString('it-IT', { weekday:'long', day:'numeric', month:'long' })}
          </p>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontFamily:'var(--font-heading)', fontSize:28, fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em' }}>
            {now.toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit', second:'2-digit' })}
          </div>
          <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>
            Aggiornamento: ogni 30s · 🟢 Live
          </div>
        </div>
      </div>

      {/* ═══════════════ CENTRO NOTIFICHE ═══════════════ */}
      <div className="card" style={{ marginBottom:'var(--space-xl)', padding:0, overflow:'hidden' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 18px', borderBottom: (showAllNotifs && notifications.length > 0) ? '1px solid var(--border-subtle)' : 'none' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:20 }}>🔔</span>
            <h4 style={{ margin:0 }}>Centro Notifiche</h4>
            {unreadCount > 0 && (
              <span style={{ background:'var(--danger)', color:'white', borderRadius:20, padding:'2px 10px', fontSize:12, fontWeight:700 }}>
                {unreadCount}
              </span>
            )}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            {unreadCount > 0 && <button onClick={markAllRead} style={{ background:'none', border:'none', color:'var(--text-secondary)', fontSize:12, cursor:'pointer' }}>✓ Letto tutto</button>}
            <button onClick={() => setShowAllNotifs(!showAllNotifs)} style={{ background:'none', border:'none', color:'var(--brand-primary)', fontSize:13, fontWeight:600, cursor:'pointer' }}>
              {showAllNotifs ? '▲ Chiudi' : `▼ Espandi (${notifications.length})`}
            </button>
          </div>
        </div>

        {/* Compact: show latest 3 unread inline */}
        {!showAllNotifs && unreadCount > 0 && (
          <div style={{ padding:'0 18px 14px' }}>
            {notifications.filter(n => !n.read).slice(0, 3).map((n, i) => (
              <div key={n.id} onClick={() => markNotifRead(n.id)} style={{
                display:'flex', alignItems:'center', gap:10, padding:'8px 0',
                borderBottom: i < 2 ? '1px solid var(--border-subtle)' : 'none',
                cursor:'pointer',
              }}>
                <span style={{ fontSize:16 }}>{TYPE_ICON[n.type] ?? '🔔'}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{n.title}</div>
                  {n.message && <div style={{ fontSize:12, color:'var(--text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{n.message}</div>}
                </div>
                <span style={{ fontSize:11, color:'var(--text-tertiary)', flexShrink:0 }}>
                  {new Date(n.created_at).toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit' })}
                </span>
                <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--brand-primary)', flexShrink:0 }} />
              </div>
            ))}
          </div>
        )}

        {!showAllNotifs && unreadCount === 0 && (
          <div style={{ padding:'8px 18px 14px', fontSize:13, color:'var(--text-tertiary)' }}>
            ✅ Nessuna notifica da leggere
          </div>
        )}

        {/* Expanded: full list */}
        {showAllNotifs && (
          <div style={{ maxHeight:400, overflowY:'auto' }}>
            {notifications.length === 0 && <div style={{ padding:'var(--space-xl)', textAlign:'center', color:'var(--text-tertiary)', fontSize:14 }}>Nessuna notifica</div>}
            {notifications.map((n, i) => (
              <div key={n.id} onClick={() => markNotifRead(n.id)} style={{
                display:'flex', alignItems:'flex-start', gap:12, padding:'12px 18px',
                borderBottom: i < notifications.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                background: n.read ? 'transparent' : 'var(--brand-primary-light)',
                cursor:'pointer',
              }}>
                <span style={{ fontSize:18, marginTop:2 }}>{TYPE_ICON[n.type] ?? '🔔'}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight: n.read ? 500 : 700, fontSize:14 }}>{n.title}</div>
                  {n.message && <div style={{ fontSize:13, color:'var(--text-secondary)', marginTop:2 }}>{n.message}</div>}
                  <div style={{ fontSize:11, color:'var(--text-tertiary)', marginTop:3 }}>
                    {new Date(n.created_at).toLocaleDateString('it-IT', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                    {n.users?.full_name && ` · ${n.users.full_name}`}
                  </div>
                </div>
                {!n.read && <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--brand-primary)', flexShrink:0, marginTop:6 }} />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Store tabs */}
      <div style={{ display:'flex', gap:6, marginBottom:'var(--space-lg)', flexWrap:'wrap' }}>
        <button onClick={() => setSelectedStore('all')} className={`badge ${selectedStore==='all'?'badge-brand':'badge-gray'}`} style={{ cursor:'pointer', border:'none', padding:'6px 14px', fontSize:13 }}>
          Tutti gli Store
        </button>
        {stores.map(s => (
          <button key={s.id} onClick={() => setSelectedStore(s.id)} className={`badge ${selectedStore===s.id?'badge-brand':'badge-gray'}`} style={{ cursor:'pointer', border:'none', padding:'6px 14px', fontSize:13 }}>
            {s.name}
          </button>
        ))}
        {data.openShifts.length > 0 && <span className="badge badge-success">🟢 {data.openShifts.length} Live</span>}
      </div>

      {/* ═══════════════ METRICHE GIORNATA ═══════════════ */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'var(--space-md)', marginBottom:'var(--space-xl)' }}>
        {[
          { label:'Revenue Oggi', value:fmt(data.totalRevenue), sub:`💵 ${fmt(data.totalCash)}  💳 ${fmt(data.totalPos)}`, color:'var(--text-primary)' },
          { label:'Transazioni', value:data.totalTxn.toString(), sub:`${data.totalTxn} vendite oggi`, color:'var(--text-primary)' },
          { label:'Scontrino Medio', value:fmt(data.avgSale), sub:'per cliente', color:'var(--brand-primary)' },
          { label:'Margine Netto', value:data.marginPct > 0 ? `${data.marginPct.toFixed(1)}%` : '—', sub:`Spese: ${fmt(data.totalExpenses)}`, color: data.marginPct >= 50 ? 'var(--success)' : data.marginPct >= 30 ? 'var(--warning)' : 'var(--danger)' },
          { label:'Revenue Shopify', value:fmt(data.shopifyRevenue), sub:`${data.shopifyTxn} ordini online`, color:'#7C3AED' },
          { label:'Revenue In-Store', value:fmt(data.instoreRevenue), sub:'vendite in negozio', color:'var(--success)' },
          { label:'Resi Oggi', value:data.resoCount.toString(), sub:'resi registrati', color: data.resoCount > 0 ? 'var(--danger)' : 'var(--success)' },
          { label:'Fidelity Card', value:data.fidCount.toString(), sub:'create oggi', color:'#8B5CF6' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
            <div className="kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ═══════════════ ANDAMENTO ORARIO ═══════════════ */}
      <div className="card" style={{ marginBottom:'var(--space-xl)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'var(--space-lg)' }}>
          <h4>📈 Andamento Orario — Oggi</h4>
          <span style={{ fontSize:12, color:'var(--text-tertiary)' }}>Revenue per fascia oraria</span>
        </div>
        <div style={{ display:'flex', alignItems:'flex-end', gap:2, height:120 }}>
          {data.hourlyRev.map((rev: number, i: number) => {
            if (i < 7 || i > 23) return null // skip night hours
            const h = maxHourly > 0 ? Math.max(2, (rev / maxHourly) * 100) : 2
            const isCurrent = i === currentHour
            return (
              <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                {rev > 0 && <div style={{ fontSize:9, color:'var(--text-tertiary)', fontWeight:600 }}>{fmt(rev)}</div>}
                <div style={{
                  width:'100%', height:`${h}%`, minHeight:2,
                  background: isCurrent ? 'var(--brand-primary)' : rev > 0 ? 'var(--brand-primary-light)' : 'var(--bg-surface-alt)',
                  borderRadius:'3px 3px 0 0', transition:'height 0.3s',
                }} />
                <span style={{ fontSize:9, color: isCurrent ? 'var(--brand-primary)' : 'var(--text-tertiary)', fontWeight: isCurrent ? 700 : 400 }}>{i}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--space-xl)', marginBottom:'var(--space-xl)' }}>
        {/* Breakdown Canali */}
        <div className="card">
          <h4 style={{ marginBottom:'var(--space-lg)' }}>🔀 Breakdown per Canale</h4>
          {[
            { name:'🏪 In-Store', value: data.instoreRevenue, pct: data.totalRevenue > 0 ? (data.instoreRevenue/data.totalRevenue*100) : 0 },
            { name:'🛍️ Shopify', value: data.shopifyRevenue, pct: data.totalRevenue > 0 ? (data.shopifyRevenue/data.totalRevenue*100) : 0 },
          ].map(ch => (
            <div key={ch.name} style={{ marginBottom:14 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontSize:14, fontWeight:600 }}>{ch.name}</span>
                <span style={{ fontSize:14, fontWeight:700 }}>{fmt(ch.value)} ({ch.pct.toFixed(1)}%)</span>
              </div>
              <div style={{ height:8, background:'var(--bg-surface-alt)', borderRadius:4 }}>
                <div style={{ height:'100%', width:`${ch.pct}%`, background: ch.name.includes('Shopify') ? '#7C3AED' : 'var(--success)', borderRadius:4, transition:'width 0.3s' }} />
              </div>
            </div>
          ))}
          <div style={{ fontSize:12, color:'var(--text-tertiary)', marginTop:8, paddingTop:8, borderTop:'1px solid var(--border-subtle)' }}>
            Cash: {fmt(data.totalCash)} ({data.totalRevenue > 0 ? (data.totalCash/data.totalRevenue*100).toFixed(1) : 0}%) · POS: {fmt(data.totalPos)} ({data.totalRevenue > 0 ? (data.totalPos/data.totalRevenue*100).toFixed(1) : 0}%)
          </div>
        </div>

        {/* Dipendenti in turno */}
        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'var(--space-md)' }}>
            <h4>👥 Dipendenti in Turno</h4>
            <span className="badge badge-gray">{data.openShifts.length} attivi</span>
          </div>
          {data.openShifts.length === 0
            ? <p style={{ color:'var(--text-tertiary)', fontSize:14 }}>Nessun turno attivo</p>
            : data.openShifts.map((s: any) => (
              <div key={s.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid var(--border-subtle)' }}>
                <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--brand-primary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'white', flexShrink:0 }}>
                  {s.users?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0,2) || '?'}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600 }}>{s.users?.full_name}</div>
                  <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>{s.stores?.name} · {s.period === 'morning' ? '☀️ Mattina' : '🌙 Sera'}</div>
                </div>
              </div>
            ))
          }
        </div>
      </div>

      {/* Confronto Store */}
      {data.storeComparison.length > 0 && (
        <div className="card" style={{ marginBottom:'var(--space-xl)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'var(--space-lg)' }}>
            <h4>🏪 Confronto Store — Oggi</h4>
            <span className="badge badge-brand">{stores.length} Store</span>
          </div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Store</th><th>Revenue</th><th>Txn</th><th>Avg Sale</th><th>Attivi</th></tr></thead>
              <tbody>
                {data.storeComparison.map((s: any) => (
                  <tr key={s.name}>
                    <td style={{ fontWeight:600 }}>{s.name}</td>
                    <td style={{ fontWeight:700, color:'var(--brand-primary)' }}>{fmt(s.revenue)}</td>
                    <td>{s.txn}</td>
                    <td>{fmt(s.avg)}</td>
                    <td>{s.active > 0 ? <span className="badge badge-success" style={{ fontSize:10 }}>🟢 {s.active}</span> : <span className="badge badge-gray" style={{ fontSize:10 }}>—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--space-xl)', marginBottom:'var(--space-xl)' }}>
        {/* Alert Inventario */}
        {data.lowStock.length > 0 && (
          <div className="card" style={{ border:'1.5px solid var(--danger)' }}>
            <h4 style={{ marginBottom:'var(--space-md)', color:'var(--danger)' }}>⚠️ Alert Inventario</h4>
            {data.lowStock.map((p: any) => (
              <div key={p.id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border-subtle)' }}>
                <span style={{ fontSize:14, fontWeight:600 }}>{p.name}</span>
                <span className="badge badge-danger">{p.stock} rimasti</span>
              </div>
            ))}
            <Link href="/owner/products" style={{ display:'block', textAlign:'center', marginTop:12, fontSize:13, color:'var(--brand-primary)', textDecoration:'none' }}>Gestisci prodotti →</Link>
          </div>
        )}

        {/* Sconti da verificare */}
        {data.pendingDiscounts.length > 0 && (
          <div className="card">
            <h4 style={{ marginBottom:'var(--space-md)' }}>🏷️ Sconti da Verificare</h4>
            {data.pendingDiscounts.slice(0,3).map((s: any) => (
              <div key={s.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:600 }}>{s.customer_name || 'Cliente'} — {fmt(s.discount_amount)}</div>
                  <div style={{ fontSize:12, color:'var(--text-tertiary)' }}>{s.discount_reason || 'Nessun motivo'}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Resi */}
        {data.resi.length > 0 && (
          <div className="card" style={{ border:'1.5px solid var(--warning)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'var(--space-md)' }}>
              <h4>↩️ Resi Oggi</h4>
              <span className="badge badge-warning">{data.resi.length} resi</span>
            </div>
            {data.resi.slice(0,3).map((s: any) => (
              <div key={s.id} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--border-subtle)', fontSize:13 }}>
                <span>{s.customer_name || 'Anonimo'}</span>
                <span style={{ color:'var(--danger)', fontWeight:600 }}>{fmt(Math.abs(s.total))}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ultime vendite */}
      <div className="card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'var(--space-md)' }}>
          <h4>🧾 Ultime Vendite — Oggi</h4>
          <span className="badge badge-gray">{data.recentSales.length} recenti</span>
        </div>
        {data.recentSales.length === 0
          ? <p style={{ color:'var(--text-tertiary)', fontSize:14 }}>Nessuna vendita oggi</p>
          : data.recentSales.map((sale: any, i: number) => (
            <div key={sale.id} style={{ display:'flex', alignItems:'center', gap:'var(--space-md)', padding:'10px 0', borderBottom: i < data.recentSales.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:600 }}>{sale.customer_name || 'Anonimo'}</div>
                <div style={{ fontSize:12, color:'var(--text-tertiary)' }}>
                  {formatTime(sale.created_at)}
                  {sale.acquisition_channel === 'shopify' && <span className="badge badge-brand" style={{ marginLeft:6, fontSize:9 }}>Shopify</span>}
                </div>
              </div>
              <span className={`badge ${sale.payment_method === 'cash' ? 'badge-success' : 'badge-indigo'}`} style={{ fontSize:10 }}>
                {sale.payment_method === 'cash' ? '💵 Cash' : '💳 POS'}
              </span>
              <span style={{ fontWeight:700, minWidth:70, textAlign:'right' }}>{fmt(sale.total)}</span>
            </div>
          ))
        }
      </div>

      {/* ═══════ EMPLOYEE PERFORMANCE ═══════ */}
      {data.empPerformance.length > 0 && (
        <div className="card" style={{ marginBottom:'var(--space-xl)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'var(--space-lg)' }}>
            <h4>🏆 Performance Dipendenti — Oggi</h4>
            <span className="badge badge-success">{data.empPerformance.length} in turno</span>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Dipendente</th>
                  <th>Store</th>
                  <th>Revenue</th>
                  <th>Txn</th>
                  <th>Avg Sale</th>
                  <th>Ore</th>
                  <th>€/Ora</th>
                </tr>
              </thead>
              <tbody>
                {data.empPerformance.sort((a: any, b: any) => b.revenue - a.revenue).map((emp: any) => (
                  <tr key={emp.id}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--brand-primary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'white', flexShrink:0 }}>
                          {emp.name?.split(' ').map((n: string) => n[0]).join('').slice(0,2)}
                        </div>
                        <div>
                          <div style={{ fontWeight:600, fontSize:13 }}>{emp.name}</div>
                          <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>{emp.period === 'morning' ? '☀️ Mattina' : '🌙 Sera'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize:13 }}>{emp.store}</td>
                    <td style={{ fontWeight:700, color:'var(--brand-primary)' }}>{fmt(emp.revenue)}</td>
                    <td>{emp.txn}</td>
                    <td>{fmt(emp.avg)}</td>
                    <td style={{ fontSize:13 }}>{emp.hoursWorked}h</td>
                    <td style={{ fontWeight:600, color: emp.revenuePerHour >= 50 ? 'var(--success)' : emp.revenuePerHour >= 25 ? 'var(--warning)' : 'var(--danger)' }}>
                      {fmt(emp.revenuePerHour)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════ QUICK TASK ASSIGNMENT ═══════ */}
      <div className="card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'var(--space-lg)' }}>
          <h4>✅ Task Rapidi</h4>
          <span className="badge badge-gray">{tasks.filter((t: any) => !t.completed).length} da fare</span>
        </div>

        {/* Quick add form */}
        <div style={{ display:'flex', gap:8, marginBottom:'var(--space-lg)', flexWrap:'wrap' }}>
          <input className="input" style={{ flex:2, minWidth:180, height:38 }} placeholder="Nuovo task..." value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && addQuickTask()} />
          <select className="input" style={{ width:160, height:38, fontSize:12 }} value={newTaskAssignee} onChange={e => setNewTaskAssignee(e.target.value)}>
            <option value="">Assegna a...</option>
            {data.openShifts.map((s: any) => (
              <option key={s.user_id} value={s.user_id}>{s.users?.full_name} ({s.stores?.name})</option>
            ))}
          </select>
          <select className="input" style={{ width:90, height:38, fontSize:12 }} value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value as any)}>
            <option value="alta">🔴 Alta</option>
            <option value="media">🟡 Media</option>
            <option value="bassa">🟢 Bassa</option>
          </select>
          <button className="btn btn-primary" style={{ height:38, padding:'0 16px', fontSize:13 }} onClick={addQuickTask} disabled={savingTask || !newTaskTitle.trim()}>
            + Assegna
          </button>
        </div>

        {/* Active tasks */}
        {tasks.length === 0 && <p style={{ color:'var(--text-tertiary)', fontSize:13, textAlign:'center', padding:'var(--space-lg)' }}>Nessun task attivo 🎉</p>}
        {tasks.map((task: any) => (
          <div key={task.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:'1px solid var(--border-subtle)' }}>
            <div onClick={() => completeTask(task.id)} style={{ width:22, height:22, borderRadius:6, border:'2px solid var(--border-default)', background:'transparent', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }} />
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:500 }}>{task.title}</div>
              {task.users?.full_name && <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>👤 {task.users.full_name}</div>}
            </div>
            <span className={`badge ${task.priority==='alta'?'badge-danger':task.priority==='bassa'?'badge-success':'badge-warning'}`} style={{ fontSize:10 }}>
              {task.priority}
            </span>
            <button onClick={() => deleteTask(task.id)} style={{ background:'none', border:'none', color:'var(--text-tertiary)', cursor:'pointer', fontSize:16, padding:'0 4px' }}>✕</button>
          </div>
        ))}
      </div>
    </div>
  )
}
