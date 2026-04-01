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

    // Prima query: solo profilo utente (senza join stores)
    const { data: profile, error: profileError } = await supabase
      .from('users').select('store_id, role, full_name').eq('id', user.id).single()

    if (profileError || !profile) { router.push('/login'); return }
    if (profile.role !== 'owner') { router.push('/login'); return }

    setStoreId(profile.store_id)

    // Seconda query: dati store separati
    const { data: storeData } = await supabase
      .from('stores').select('name, organization_id').eq('id', profile.store_id).single()
    setStoreName(storeData?.name ?? '')

    const oid = storeData?.organization_id
    const { data: storesData } = await supabase.from('stores').select('id,name').eq('organization_id', oid)
    setStores(storesData ?? [])

    const now = new Date()
    let fromDate: string
    if (dateFilter === 'oggi') { const d = new Date(now); d.setHours(0,0,0,0); fromDate = d.toISOString() }
    else if (dateFilter === 'settimana') { const d = new Date(); d.setDate(d.getDate()-7); fromDate = d.toISOString() }
    else { const d = new Date(); d.setMonth(d.getMonth()-1); fromDate = d.toISOString() }

    const targetStore = selectedStore === 'all' ? profile.store_id : selectedStore
    const [{ data: sales }, { data: lowStock }, { data: openShifts }, { data: expenses }, { data: ecomOrders }] = await Promise.all([
      supabase.from('sales').select('*').eq('store_id', targetStore || profile.store_id).gte('created_at', fromDate),
      supabase.from('low_stock_products').select('*').eq('store_id', targetStore || profile.store_id).limit(3),
      supabase.from('shifts').select('*,users(full_name),stores(name)').eq('store_id', targetStore || profile.store_id).eq('status','open'),
      supabase.from('expenses').select('amount').eq('store_id', targetStore || profile.store_id).gte('created_at', fromDate),
      supabase.from('online_orders').select('*').eq('store_id', targetStore || profile.store_id).eq('status','pending').limit(5),
    ])

    const realSales = (sales ?? []).filter((s: any) => s.movement_type === 'sale')
    const totalRevenue = realSales.reduce((s: number, x: any) => s + x.total, 0)
    const totalCash = realSales.filter((s: any) => s.payment_method === 'cash').reduce((s: number, x: any) => s + x.total, 0)
    const totalPos = realSales.filter((s: any) => s.payment_method === 'pos').reduce((s: number, x: any) => s + x.total, 0)
    const totalTxn = realSales.length
    const avgSale = totalTxn > 0 ? totalRevenue / totalTxn : 0
    const totalExpenses = (expenses ?? []).reduce((s: number, e: any) => s + e.amount, 0)
    const pendingDiscounts = realSales.filter((s: any) => s.discount_amount > 0 && !s.discount_approved)
    const resi = (sales ?? []).filter((s: any) => s.movement_type === 'reso')

    const weekDays = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom']
    const weekRevenue = weekDays.map((_, i) => {
      const d = new Date(); d.setDate(d.getDate() - d.getDay() + i + 1)
      return (sales ?? []).filter((s: any) => s.movement_type === 'sale' && new Date(s.created_at).toDateString() === d.toDateString()).reduce((s: number, x: any) => s + x.total, 0)
    })

    const { data: saleItems } = await supabase
      .from('sale_items')
      .select('product_name, qty, line_total')
      .in('sale_id', (realSales ?? []).map((s: any) => s.id))

    const productMap: Record<string, {qty:number, revenue:number}> = {}
    ;(saleItems ?? []).forEach((item: any) => {
      if (!productMap[item.product_name]) productMap[item.product_name] = { qty:0, revenue:0 }
      productMap[item.product_name].qty += item.qty
      productMap[item.product_name].revenue += item.line_total
    })
    const topProducts = Object.entries(productMap)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a,b) => b.revenue - a.revenue)
      .slice(0, 6)

    setData({ totalRevenue, totalCash, totalPos, totalTxn, avgSale, totalExpenses, openShifts: openShifts ?? [], recentSales: realSales.slice(0,5), lowStock: lowStock ?? [], pendingDiscounts, resi, ecomOrders: ecomOrders ?? [], weekRevenue, storeName: storeData?.name ?? '', topProducts })
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
    setNewTask(''); setSavingTask(false)
    loadTasks()
  }

  async function toggleTask(id: string, done: boolean) {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('tasks').update({ completed: !done, completed_at: !done ? new Date().toISOString() : null, completed_by: !done ? user?.id : null }).eq('id', id)
    loadTasks()
  }

  async function deleteTask(id: string) {
    await supabase.from('tasks').delete().eq('id', id)
    loadTasks()
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
      <div style={{ color:'var(--text-secondary)' }}>Caricamento...</div>
    </div>
  )
  if (!data) return null

  const maxRev = Math.max(...data.weekRevenue, 1)

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'var(--space-xl)' }}>
        <div>
          <h2>Owner Dashboard</h2>
          <p style={{ color:'var(--text-secondary)', fontSize:14, marginTop:4 }}>
            {storeName}  {new Date().toLocaleDateString('it-IT', { weekday:'long', day:'numeric', month:'long' })}
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
          <button className="btn btn-secondary" style={{ fontSize:12 }}>Export PDF</button>
          <button className="btn btn-secondary" style={{ fontSize:12 }}>Export Excel</button>
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
        {data.openShifts.length > 0 && <span className="badge badge-success">Live</span>}
      </div>

      {/* KPI principali */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'var(--space-md)', marginBottom:'var(--space-xl)' }}>
        {[
          { label:'Revenue Totale', value:fmt(data.totalRevenue), sub:`Cash ${fmt(data.totalCash)}  POS ${fmt(data.totalPos)}`, trend:'+18% vs ieri' },
          { label:'Transazioni', value:data.totalTxn.toString(), sub:'+12% vs ieri' },
          { label:'Avg per Cliente', value:fmt(data.avgSale), sub:'-3% vs ieri' },
          { label:'Margine Lordo', value:'68%', sub:'Target: 65%' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">{k.value}</div>
            <div className="kpi-sub">{k.sub}</div>
            {k.trend && <div style={{ fontSize:12, color:'var(--success)', marginTop:4 }}>{k.trend}</div>}
          </div>
        ))}
      </div>

      {/* KPI secondari */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'var(--space-md)', marginBottom:'var(--space-xl)' }}>
        {[
          { label:'Vendite Online', value:fmt(0), change:'+22%', note:'vs settimana scorsa' },
          { label:'Vendite H24', value:fmt(0), change:'+8%', note:'vs settimana scorsa' },
          { label:'Clienti Oggi', value:data.totalTxn.toString(), change:'+5', note:'rispetto a ieri' },
          { label:'Ordini E-commerce', value:data.ecomOrders.length.toString(), badge:data.ecomOrders.length > 0 ? `${data.ecomOrders.length} da evadere` : undefined },
        ].map(k => (
          <div key={k.label} className="card card-sm">
            <div style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:4 }}>{k.label}</div>
            <div style={{ fontSize:22, fontWeight:700, fontFamily:'var(--font-heading)' }}>{k.value}</div>
            {(k as any).badge && <span className="badge badge-warning" style={{ fontSize:10, marginTop:4 }}>{(k as any).badge}</span>}
            {k.change && <div style={{ fontSize:12, color:'var(--success)', marginTop:4 }}>{k.change} <span style={{ color:'var(--text-tertiary)' }}>{k.note}</span></div>}
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--space-xl)', marginBottom:'var(--space-xl)' }}>
        {/* Alert Inventario */}
        {data.lowStock.length > 0 && (
          <div className="card">
            <h4 style={{ marginBottom:'var(--space-md)', color:'var(--danger)' }}>Alert Inventario</h4>
            {data.lowStock.map((p: any) => (
              <div key={p.id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border-subtle)' }}>
                <span style={{ fontSize:14, fontWeight:600 }}>{p.name}</span>
                <span className="badge badge-danger">{p.stock} rimasti</span>
              </div>
            ))}
            <Link href="/owner/products" style={{ display:'block', textAlign:'center', marginTop:12, fontSize:13, color:'var(--brand-primary)', textDecoration:'none' }}>
              Gestisci prodotti
            </Link>
          </div>
        )}

        {/* Sconti da verificare */}
        {data.pendingDiscounts.length > 0 && (
          <div className="card">
            <h4 style={{ marginBottom:'var(--space-md)' }}>Sconti da Verificare</h4>
            {data.pendingDiscounts.slice(0,3).map((s: any) => (
              <div key={s.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:600 }}>{s.customer_name || 'Cliente'}  {fmt(s.discount_amount)}</div>
                  <div style={{ fontSize:12, color:'var(--text-tertiary)' }}>{s.discount_reason || 'Nessun motivo'}</div>
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <span className="badge badge-warning" style={{ fontSize:10 }}>Da verificare</span>
                  <button onClick={() => approveDiscount(s.id)} className="btn btn-primary" style={{ padding:'4px 10px', fontSize:11 }}>Approva</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Movimenti anomali */}
        {data.resi.length > 0 && (
          <div className="card" style={{ border:'1.5px solid var(--warning)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'var(--space-md)' }}>
              <h4>Movimenti Anomali</h4>
              <span className="badge badge-warning">{data.resi.length} resi oggi</span>
            </div>
            {data.resi.slice(0,3).map((s: any) => (
              <div key={s.id} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--border-subtle)', fontSize:13 }}>
                <span>{s.customer_name || 'Anonimo'}</span>
                <span style={{ color:'var(--danger)', fontWeight:600 }}>{fmt(Math.abs(s.total))}</span>
              </div>
            ))}
          </div>
        )}

        {/* Dipendenti in turno */}
        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'var(--space-md)' }}>
            <h4>Dipendenti in Turno</h4>
            <span style={{ fontSize:12, color:'var(--text-tertiary)' }}>Basato su login attivi</span>
          </div>
          {data.openShifts.length === 0
            ? <p style={{ color:'var(--text-tertiary)', fontSize:14 }}>Nessun turno attivo</p>
            : data.openShifts.map((s: any) => (
              <div key={s.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid var(--border-subtle)' }}>
                <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--brand-primary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'white', flexShrink:0 }}>
                  {s.users?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0,2) || '?'}
                </div>
                <div>
                  <div style={{ fontSize:13, fontWeight:600 }}>{s.users?.full_name}  {s.period === 'morning' ? 'Morning' : 'Evening'}</div>
                  <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>{s.stores?.name}</div>
                </div>
              </div>
            ))
          }
        </div>
      </div>

      {/* Grafico revenue settimanale */}
      <div className="card" style={{ marginBottom:'var(--space-xl)' }}>
        <h4 style={{ marginBottom:'var(--space-lg)' }}>Revenue Cash vs POS</h4>
        <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:120 }}>
          {['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map((day, i) => {
            const rev = data.weekRevenue[i]
            const h = maxRev > 0 ? Math.max(4, (rev / maxRev) * 100) : 4
            return (
              <div key={day} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                <div style={{ fontSize:11, color:'var(--text-tertiary)', fontWeight:600 }}>{rev > 0 ? fmt(rev) : ''}</div>
                <div style={{ width:'100%', height:`${h}%`, background:'var(--brand-primary)', borderRadius:'4px 4px 0 0', minHeight:4 }} />
                <span style={{ fontSize:11, color:'var(--text-tertiary)' }}>{day}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Performance settimanale tabella */}
      <div className="card" style={{ marginBottom:'var(--space-xl)' }}>
        <h4 style={{ marginBottom:'var(--space-lg)' }}>Performance Settimanale</h4>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Giorno</th><th>Revenue</th><th>Trans.</th><th>Avg Sale</th></tr>
            </thead>
            <tbody>
              {['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map((day, i) => {
                const rev = data.weekRevenue[i]
                return (
                  <tr key={day}>
                    <td>{day}</td>
                    <td style={{ fontWeight:600 }}>{rev > 0 ? fmt(rev) : ''}</td>
                    <td></td>
                    <td></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confronto Store */}
      {stores.length > 1 && (
        <div className="card" style={{ marginBottom:'var(--space-xl)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'var(--space-lg)' }}>
            <h4>Confronto Store</h4>
            <span className="badge badge-brand">{stores.length} Store Attivi</span>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Metrica</th>
                  {stores.slice(0,3).map(s => <th key={s.id}>{s.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {['Revenue Oggi','Transazioni','Avg Sale','Dipendenti Attivi'].map(row => (
                  <tr key={row}>
                    <td style={{ fontWeight:600 }}>{row}</td>
                    {stores.slice(0,3).map(s => <td key={s.id}></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ultime vendite */}
      <div className="card">
        <h4 style={{ marginBottom:'var(--space-md)' }}>Ultime Vendite</h4>
        {data.recentSales.length === 0
          ? <p style={{ color:'var(--text-tertiary)', fontSize:14 }}>Nessuna vendita nel periodo</p>
          : data.recentSales.map((sale: any, i: number) => (
            <div key={sale.id} style={{ display:'flex', alignItems:'center', gap:'var(--space-md)', padding:'10px 0', borderBottom: i < data.recentSales.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
              <span style={{ fontSize:16 }}>{['','',''][i] || ''}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:600 }}>{sale.customer_name || 'Anonimo'}</div>
                <div style={{ fontSize:12, color:'var(--text-tertiary)' }}>{sale.invoice_number}  {formatTime(sale.created_at)}</div>
              </div>
              <div style={{ display:'flex', flex:'column', alignItems:'flex-end', gap:4 }}>
                <span className={`badge ${sale.payment_method === 'cash' ? 'badge-success' : 'badge-indigo'}`} style={{ fontSize:10 }}>
                  {sale.payment_method === 'cash' ? 'Cash' : 'POS'}
                </span>
                <span style={{ fontWeight:700 }}>{fmt(sale.total)}</span>
              </div>
            </div>
          ))
        }
      </div>

      {/* Prodotti più venduti oggi */}
      {data.topProducts?.length > 0 && (
        <div className="card" style={{ marginTop:'var(--space-xl)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'var(--space-md)' }}>
            <h4>🏆 Top Prodotti — {dateFilter === 'oggi' ? 'Oggi' : dateFilter === 'settimana' ? 'Settimana' : 'Mese'}</h4>
            <span className="badge badge-brand">{data.topProducts.length} prodotti</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
            {data.topProducts.map((p: any, i: number) => (
              <div key={p.name} style={{ background:'var(--bg-surface)', borderRadius:10, padding:12, display:'flex', flexDirection:'column', gap:4 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:16 }}>{['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣'][i]}</span>
                  <span style={{ fontSize:13, fontWeight:600, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                </div>
                <div style={{ fontSize:12, color:'var(--text-secondary)' }}>{p.qty} unità vendute</div>
                <div style={{ fontSize:14, fontWeight:700, color:'var(--brand-primary)' }}>{fmt(p.revenue)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tasks */}
      <div className="card" style={{ marginTop:'var(--space-xl)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'var(--space-md)' }}>
          <h4>✅ Task del Negozio</h4>
          <span className="badge badge-gray">{tasks.filter(t=>!t.completed).length} da fare</span>
        </div>
        {/* Nuovo task */}
        <div style={{ display:'flex', gap:8, marginBottom:'var(--space-md)' }}>
          <input
            className="input" style={{ flex:1, height:36 }}
            placeholder="Nuovo task..."
            value={newTask}
            onChange={e => setNewTask(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTask()}
          />
          <select className="input" style={{ width:90, height:36, fontSize:12 }} value={taskPriority} onChange={e => setTaskPriority(e.target.value as any)}>
            <option value="alta">🔴 Alta</option>
            <option value="media">🟡 Media</option>
            <option value="bassa">🟢 Bassa</option>
          </select>
          <button className="btn btn-primary" style={{ height:36, padding:'0 14px', fontSize:13 }} onClick={addTask} disabled={savingTask||!newTask.trim()}>
            + Aggiungi
          </button>
        </div>
        {tasks.length === 0 && (
          <p style={{ color:'var(--text-tertiary)', fontSize:13, textAlign:'center', padding:'var(--space-lg)' }}>Nessun task. Aggiungine uno!</p>
        )}
        {tasks.map(task => (
          <div key={task.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:'1px solid var(--border-subtle)' }}>
            <div
              onClick={() => toggleTask(task.id, task.completed)}
              style={{ width:22, height:22, borderRadius:6, border:`2px solid ${task.completed ? 'var(--success)' : 'var(--border-default)'}`, background: task.completed ? 'var(--success)' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, transition:'all 0.15s' }}
            >
              {task.completed && <span style={{ color:'white', fontSize:13, fontWeight:700 }}>✓</span>}
            </div>
            <span style={{ flex:1, fontSize:13, fontWeight:500, textDecoration:task.completed?'line-through':'none', color:task.completed?'var(--text-tertiary)':'var(--text-primary)' }}>{task.title}</span>
            <span className={`badge ${task.priority==='alta'?'badge-danger':task.priority==='bassa'?'badge-success':'badge-warning'}`} style={{ fontSize:10 }}>
              {task.priority === 'alta' ? '🔴' : task.priority === 'bassa' ? '🟢' : '🟡'} {task.priority}
            </span>
            <button onClick={() => deleteTask(task.id)} style={{ background:'none', border:'none', color:'var(--text-tertiary)', cursor:'pointer', fontSize:16, padding:'0 4px' }}>✕</button>
          </div>
        ))}
      </div>
    </div>
  )
}
