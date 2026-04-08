'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { fmt, formatTime } from '@/lib/utils'

export default function OwnerDashboard() {
  const router = useRouter()
  const supabase = createClient()
  const [data, setData] = useState<any>(null)
  const [stores, setStores] = useState<any[]>([])
  const [selectedStore, setSelectedStore] = useState('all')
  const [dateFilter, setDateFilter] = useState<'oggi'|'settimana'|'mese'>('oggi')
  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string|null>(null)
  const [storeName, setStoreName] = useState('')
  const [tasks, setTasks] = useState<any[]>([])
  const [newTask, setNewTask] = useState('')
  const [taskPriority, setTaskPriority] = useState<'alta'|'media'|'bassa'>('media')
  const [savingTask, setSavingTask] = useState(false)

  useEffect(() => { loadData() }, [dateFilter, selectedStore])
  useEffect(() => { if (storeId) loadTasks() }, [storeId])

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

    const now = new Date()
    let fromDate: string
    if (dateFilter === 'oggi') { const d = new Date(now); d.setHours(0,0,0,0); fromDate = d.toISOString() }
    else if (dateFilter === 'settimana') { const d = new Date(); d.setDate(d.getDate()-7); fromDate = d.toISOString() }
    else { const d = new Date(); d.setMonth(d.getMonth()-1); fromDate = d.toISOString() }

    // If "all", load per-store data for comparison
    const isAll = selectedStore === 'all'
    const allStores = storesData ?? []

    // Load data for target store or aggregated
    const storeIds = isAll ? allStores.map(s => s.id) : [selectedStore || profile.store_id]

    // Fetch sales for all relevant stores
    let salesQuery = supabase.from('sales').select('*').gte('created_at', fromDate)
    if (!isAll) salesQuery = salesQuery.eq('store_id', storeIds[0])
    else salesQuery = salesQuery.in('store_id', storeIds)
    const { data: sales } = await salesQuery

    // Expenses
    let expQuery = supabase.from('expenses').select('amount').gte('created_at', fromDate)
    if (!isAll) expQuery = expQuery.eq('store_id', storeIds[0])
    else expQuery = expQuery.in('store_id', storeIds)
    const { data: expenses } = await expQuery

    // Open shifts
    let shiftQuery = supabase.from('shifts').select('*,users(full_name),stores(name)').eq('status','open')
    if (!isAll) shiftQuery = shiftQuery.eq('store_id', storeIds[0])
    else shiftQuery = shiftQuery.in('store_id', storeIds)
    const { data: openShifts } = await shiftQuery

    // Low stock
    const { data: lowStock } = isAll 
      ? await supabase.from('low_stock_products').select('*').in('store_id', storeIds).limit(5)
      : await supabase.from('low_stock_products').select('*').eq('store_id', storeIds[0]).limit(5)

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
    const resoRate = totalTxn > 0 ? (resoCount / totalTxn * 100) : 0
    const shopifyRevenue = realSales.filter((s: any) => s.acquisition_channel === 'shopify').reduce((s: number, x: any) => s + x.total, 0)
    const shopifyTxn = realSales.filter((s: any) => s.acquisition_channel === 'shopify').length
    const instoreRevenue = totalRevenue - shopifyRevenue
    const pendingDiscounts = realSales.filter((s: any) => s.discount_amount > 0 && !s.discount_approved)

    // Weekly revenue chart
    const weekDays = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom']
    const weekRevenue = weekDays.map((_, i) => {
      const d = new Date(); d.setDate(d.getDate() - d.getDay() + i + 1)
      return realSales.filter((s: any) => new Date(s.created_at).toDateString() === d.toDateString()).reduce((s: number, x: any) => s + x.total, 0)
    })

    // Per-store comparison data
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

    setData({
      totalRevenue, totalCash, totalPos, totalTxn, avgSale, totalExpenses, marginPct,
      resoCount, resoRate, shopifyRevenue, shopifyTxn, instoreRevenue, 
      openShifts: openShifts ?? [], recentSales: realSales.slice(0,5),
      lowStock: lowStock ?? [], pendingDiscounts, resi,
      weekRevenue, storeComparison, storeName: storeData?.name ?? ''
    })
    setLoading(false)
  }

  async function approveDiscount(saleId: string) {
    await supabase.from('sales').update({ discount_approved: true }).eq('id', saleId)
    loadData()
  }

  async function loadTasks() {
    if (!storeId) return
    const { data: t } = await supabase.from('tasks').select('*,users!tasks_assigned_to_fkey(full_name)').eq('store_id', storeId).order('created_at', { ascending: false })
    setTasks(t ?? [])
  }
  async function addTask() {
    if (!newTask.trim() || !storeId) return
    setSavingTask(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('tasks').insert({ store_id: storeId, title: newTask.trim(), priority: taskPriority, created_by: user?.id })
    setNewTask(''); setSavingTask(false); loadTasks()
  }
  async function toggleTask(id: string, done: boolean) {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('tasks').update({ completed: !done, completed_at: !done ? new Date().toISOString() : null, completed_by: !done ? user?.id : null }).eq('id', id)
    loadTasks()
  }
  async function deleteTask(id: string) { await supabase.from('tasks').delete().eq('id', id); loadTasks() }

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}><div style={{ color:'var(--text-secondary)' }}>Caricamento...</div></div>
  if (!data) return null
  const maxRev = Math.max(...data.weekRevenue, 1)

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'var(--space-xl)' }}>
        <div>
          <h2>📊 Performance Aziendale</h2>
          <p style={{ color:'var(--text-secondary)', fontSize:14, marginTop:4 }}>
            {storeName} — {new Date().toLocaleDateString('it-IT', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
          </p>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <div style={{ display:'flex', background:'var(--bg-surface)', borderRadius:10, padding:3, gap:3 }}>
            {(['oggi','settimana','mese'] as const).map(f => (
              <button key={f} onClick={() => setDateFilter(f)} style={{ padding:'7px 14px', borderRadius:8, border:'none', background:dateFilter===f?'var(--bg-primary)':'transparent', fontWeight:dateFilter===f?600:400, color:dateFilter===f?'var(--text-primary)':'var(--text-secondary)', cursor:'pointer', fontSize:13 }}>
                {f === 'oggi' ? 'Oggi' : f === 'settimana' ? 'Settimana' : 'Mese'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Store tabs */}
      <div style={{ display:'flex', gap:6, marginBottom:'var(--space-xl)', flexWrap:'wrap' }}>
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

      {/* 8 KPI principali */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'var(--space-md)', marginBottom:'var(--space-xl)' }}>
        {[
          { label:'Revenue Totale', value:fmt(data.totalRevenue), sub:`💵 ${fmt(data.totalCash)}  💳 ${fmt(data.totalPos)}`, color:'var(--text-primary)' },
          { label:'Transazioni', value:data.totalTxn.toString(), sub:`${data.totalTxn} vendite registrate`, color:'var(--text-primary)' },
          { label:'Scontrino Medio', value:fmt(data.avgSale), sub:'per cliente', color:'var(--brand-primary)' },
          { label:'Margine Netto', value:data.marginPct > 0 ? `${data.marginPct.toFixed(1)}%` : '—', sub:`Spese: ${fmt(data.totalExpenses)}`, color: data.marginPct >= 50 ? 'var(--success)' : data.marginPct >= 30 ? 'var(--warning)' : 'var(--danger)' },
          { label:'Revenue Shopify', value:fmt(data.shopifyRevenue), sub:`${data.shopifyTxn} ordini online`, color:'#7C3AED' },
          { label:'Revenue In-Store', value:fmt(data.instoreRevenue), sub:'vendite in negozio', color:'var(--success)' },
          { label:'Tasso di Reso', value:`${data.resoRate.toFixed(1)}%`, sub:`${data.resoCount} resi nel periodo`, color: data.resoRate > 5 ? 'var(--danger)' : 'var(--success)' },
          { label:'Spese Totali', value:fmt(data.totalExpenses), sub:'nel periodo selezionato', color:'var(--danger)' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
            <div className="kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Grafico revenue settimanale */}
      <div className="card" style={{ marginBottom:'var(--space-xl)' }}>
        <h4 style={{ marginBottom:'var(--space-lg)' }}>📈 Revenue Settimanale</h4>
        <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:140 }}>
          {['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map((day, i) => {
            const rev = data.weekRevenue[i]
            const h = maxRev > 0 ? Math.max(4, (rev / maxRev) * 100) : 4
            const isToday = new Date().getDay() === (i + 1) % 7
            return (
              <div key={day} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                <div style={{ fontSize:11, color:'var(--text-tertiary)', fontWeight:600 }}>{rev > 0 ? fmt(rev) : ''}</div>
                <div style={{ width:'100%', height:`${h}%`, background: isToday ? 'var(--brand-primary)' : 'var(--brand-primary-light)', borderRadius:'4px 4px 0 0', minHeight:4, transition:'height 0.3s' }} />
                <span style={{ fontSize:11, color: isToday ? 'var(--brand-primary)' : 'var(--text-tertiary)', fontWeight: isToday ? 700 : 400 }}>{day}</span>
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
            <h4>🏪 Confronto Store</h4>
            <span className="badge badge-brand">{stores.length} Store</span>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Store</th><th>Revenue</th><th>Transazioni</th><th>Avg Sale</th><th>Attivi</th></tr>
              </thead>
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
                <button onClick={() => approveDiscount(s.id)} className="btn btn-primary" style={{ padding:'4px 10px', fontSize:11 }}>✅ Approva</button>
              </div>
            ))}
          </div>
        )}

        {/* Movimenti anomali */}
        {data.resi.length > 0 && (
          <div className="card" style={{ border:'1.5px solid var(--warning)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'var(--space-md)' }}>
              <h4>↩️ Resi</h4>
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
      <div className="card" style={{ marginBottom:'var(--space-xl)' }}>
        <h4 style={{ marginBottom:'var(--space-md)' }}>🧾 Ultime Vendite</h4>
        {data.recentSales.length === 0
          ? <p style={{ color:'var(--text-tertiary)', fontSize:14 }}>Nessuna vendita nel periodo</p>
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

      {/* Tasks */}
      <div className="card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'var(--space-md)' }}>
          <h4>✅ Task del Negozio</h4>
          <span className="badge badge-gray">{tasks.filter(t=>!t.completed).length} da fare</span>
        </div>
        <div style={{ display:'flex', gap:8, marginBottom:'var(--space-md)' }}>
          <input className="input" style={{ flex:1, height:36 }} placeholder="Nuovo task..." value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTask()} />
          <select className="input" style={{ width:90, height:36, fontSize:12 }} value={taskPriority} onChange={e => setTaskPriority(e.target.value as any)}>
            <option value="alta">🔴 Alta</option>
            <option value="media">🟡 Media</option>
            <option value="bassa">🟢 Bassa</option>
          </select>
          <button className="btn btn-primary" style={{ height:36, padding:'0 14px', fontSize:13 }} onClick={addTask} disabled={savingTask||!newTask.trim()}>+ Aggiungi</button>
        </div>
        {tasks.length === 0 && <p style={{ color:'var(--text-tertiary)', fontSize:13, textAlign:'center', padding:'var(--space-lg)' }}>Nessun task. Aggiungine uno!</p>}
        {tasks.map(task => (
          <div key={task.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:'1px solid var(--border-subtle)' }}>
            <div onClick={() => toggleTask(task.id, task.completed)} style={{ width:22, height:22, borderRadius:6, border:`2px solid ${task.completed ? 'var(--success)' : 'var(--border-default)'}`, background: task.completed ? 'var(--success)' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
              {task.completed && <span style={{ color:'white', fontSize:13, fontWeight:700 }}>✓</span>}
            </div>
            <span style={{ flex:1, fontSize:13, fontWeight:500, textDecoration:task.completed?'line-through':'none', color:task.completed?'var(--text-tertiary)':'var(--text-primary)' }}>{task.title}</span>
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
