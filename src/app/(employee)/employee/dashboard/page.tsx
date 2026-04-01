'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { fmt, formatTime, periodLabel } from '@/lib/utils'
import { BottomNav } from '@/components/employee/BottomNav'

const QUICK_ACTIONS = [
  { href:'/employee/pos',         icon:'🛒', label:'Nuova Vendita' },
  { href:'/employee/fidelity',    icon:'💳', label:'Crea Fidelity Card' },
  { href:'/employee/stock',       icon:'📦', label:'Ricarica Stock' },
  { href:'/employee/shift/close', icon:'🔒', label:'Chiudi Turno' },
]
const MORE_ACTIONS = [
  { href:'/employee/expenses',    icon:'💸', label:'Aggiungi Spesa' },
  { href:'/employee/inventory',   icon:'📋', label:'Conteggio' },
  { href:'/employee/maintenance', icon:'🔧', label:'Manutenzione' },
  { href:'/employee/photos',      icon:'📷', label:'Foto Registro' },
  { href:'/employee/transfers',   icon:'🔄', label:'Trasferimenti' },
  { href:'/employee/transfers?mode=ship', icon:'🚚', label:'Spedizione' },
  { href:'/employee/stock?request=1', icon:'🔔', label:'Richiedi Ricarica' },
  { href:'/employee/calendar',    icon:'📅', label:'Giorni Liberi' },
  { href:'/employee/more',        icon:'👥', label:'Persone' },
]

const PRIORITY_COLOR: Record<string, string> = {
  urgent: '#EF4444', high: '#F59E0B', normal: '#22C55E', low: '#9CA3AF'
}
const PRIORITY_LABEL: Record<string, string> = {
  urgent: '🔴 Urgente', high: '🟡 Alta', normal: '🟢 Normale', low: '⚪ Bassa'
}

export default function EmployeeDashboard() {
  const router = useRouter()
  const supabase = createClient()
  const [summary, setSummary] = useState<any>(null)
  const [sales, setSales] = useState<any[]>([])
  const [name, setName] = useState('')
  const [storeName, setStoreName] = useState('')
  const [fcuDefault, setFcuDefault] = useState(200)
  const [objectives, setObjectives] = useState({ sales_target:1500, fidelity_target:3, streak:5, rank:2 })
  const [loading, setLoading] = useState(true)
  const [maintenanceDone, setMaintenanceDone] = useState(0)
  const [maintenanceTotal, setMaintenanceTotal] = useState(0)
  const [tasks, setTasks] = useState<any[]>([])
  const [userId, setUserId] = useState<string>('')

  useEffect(() => { loadData(); const t = setInterval(loadData, 30000); return () => clearInterval(t) }, [])

  async function loadData() {
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('users').select('full_name,store_id,stores(name)').eq('id', user.id).single()
    if (!profile) { router.push('/login'); return }
    setName(profile.full_name)
    setStoreName((profile.stores as any)?.name ?? '')
    setUserId(user.id)
    if (profile.store_id) {
      const { data: cfg } = await supabase.from('store_config').select('fcu_default').eq('store_id', profile.store_id).single()
      if (cfg) setFcuDefault(cfg.fcu_default)
      const { data: mLogs } = await supabase.from('maintenance_logs').select('id,status').eq('shift_user_id', user.id).gte('created_at', new Date().toISOString().split('T')[0])
      if (mLogs) { setMaintenanceDone(mLogs.filter((m:any) => m.status==='done').length); setMaintenanceTotal(mLogs.length) }
      // Carica task assegnati al dipendente
      try {
        const { data: tasksData } = await supabase.from('tasks').select('*').eq('store_id', profile.store_id).eq('assigned_to', user.id).neq('status','done').order('created_at',{ascending:false}).limit(5)
        setTasks(tasksData ?? [])
      } catch {}
    }
    const { data: sum } = await supabase.from('shift_cash_summary').select('*').eq('user_id', user.id).eq('status','open').single()
    if (!sum) { router.push('/employee/shift/open'); return }
    setSummary(sum)
    const { data: salesData } = await supabase.from('sales').select('*').eq('shift_id', sum.shift_id).eq('movement_type','sale').order('created_at',{ascending:false}).limit(8)
    setSales(salesData ?? [])
    setLoading(false)
  }

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}><div style={{ color:'var(--text-secondary)' }}>Caricamento...</div></div>
  if (!summary) return null

  const depositExpected = summary.fce + summary.total_cash - summary.total_expenses - fcuDefault
  const salesPct = Math.min(100, Math.round((summary.total_sales / objectives.sales_target) * 100))
  const fidelityToday = 2 // from fidelity cards created today

  return (
    <div className="page" style={{ paddingBottom:80 }}>
      {/* Header */}
      <div style={{ background:'var(--bg-primary)', borderBottom:'1px solid var(--border-subtle)', padding:'var(--space-lg)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <h3>Ciao {name.split(' ')[0]} </h3>
            <div style={{ fontSize:13, color:'var(--text-secondary)', marginTop:2 }}>{storeName}  {new Date().toLocaleDateString('it-IT',{day:'numeric',month:'short',year:'numeric'})}</div>
          </div>
          <span className="badge badge-brand">{periodLabel[summary.period]}</span>
        </div>
      </div>

      <div style={{ padding:'var(--space-lg)', display:'flex', flexDirection:'column', gap:'var(--space-lg)' }}>

        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--space-md)' }}>
          {[
            { label:'Vendite Oggi', value:fmt(summary.total_sales), sub:`${summary.total_transactions} transazioni` },
            { label:'Contanti', value:fmt(summary.total_cash), sub:`${summary.total_transactions > 0 ? Math.round(summary.total_cash/summary.total_sales*100) : 0}% del totale` },
            { label:'POS', value:fmt(summary.total_pos), sub:'pagamenti elettronici' },
            { label:'Spese', value:fmt(summary.total_expenses), sub:`${3} voci`, danger:summary.total_expenses > 0 },
          ].map(k => (
            <div key={k.label} className="kpi-card">
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-value" style={k.danger?{color:'var(--danger)'}:{}}>{k.value}</div>
              <div className="kpi-sub">{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Performance Oggi */}
        <div className="card">
          <h4 style={{ marginBottom:'var(--space-md)' }}>La Tua Performance Oggi</h4>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--space-md)' }}>
            <div style={{ background:'var(--bg-surface)', borderRadius:'var(--radius-md)', padding:'var(--space-md)' }}>
              <div style={{ fontSize:12, color:'var(--text-secondary)', fontWeight:600, marginBottom:4 }}>Puntualita</div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ fontWeight:700, fontSize:15 }}>In Orario</span>
                <span style={{ fontSize:16 }}></span>
              </div>
              <div style={{ fontSize:12, color:'var(--text-tertiary)', marginTop:4 }}>Ingresso: {formatTime(summary.opened_at)}</div>
            </div>
            <div style={{ background:'var(--bg-surface)', borderRadius:'var(--radius-md)', padding:'var(--space-md)' }}>
              <div style={{ fontSize:12, color:'var(--text-secondary)', fontWeight:600, marginBottom:4 }}>Store Maintenance</div>
              <div style={{ fontWeight:700, fontSize:15 }}>{maintenanceDone}/{maintenanceTotal || 3}</div>
              <div style={{ fontSize:12, color:'var(--text-tertiary)', marginTop:4 }}>completati</div>
            </div>
            <div style={{ background:'var(--bg-surface)', borderRadius:'var(--radius-md)', padding:'var(--space-md)' }}>
              <div style={{ fontSize:12, color:'var(--text-secondary)', fontWeight:600, marginBottom:4 }}>Clienti Serviti</div>
              <div style={{ fontWeight:700, fontSize:15 }}>{summary.total_transactions}</div>
              <div style={{ fontSize:12, color:'var(--text-tertiary)', marginTop:4 }}>oggi</div>
            </div>
            <div style={{ background:'var(--bg-surface)', borderRadius:'var(--radius-md)', padding:'var(--space-md)' }}>
              <div style={{ fontSize:12, color:'var(--text-secondary)', fontWeight:600, marginBottom:4 }}>Media per Cliente</div>
              <div style={{ fontWeight:700, fontSize:15 }}>{summary.total_transactions > 0 ? fmt(summary.total_sales/summary.total_transactions) : '0'}</div>
              <div style={{ fontSize:12, color:'var(--text-tertiary)', marginTop:4 }}>avg vendita</div>
            </div>
          </div>
        </div>

        {/* Obiettivi & Gamification */}
        <div className="card">
          <h4 style={{ marginBottom:'var(--space-md)' }}>I Tuoi Obiettivi</h4>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontSize:13, fontWeight:600 }}>Vendite Giornaliere</span>
                <span style={{ fontSize:13, color:'var(--text-secondary)' }}>{fmt(summary.total_sales)} / {fmt(objectives.sales_target)}</span>
              </div>
              <div style={{ height:8, background:'var(--bg-surface-alt)', borderRadius:4, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${salesPct}%`, background:'var(--brand-primary)', borderRadius:4, transition:'width 0.5s' }} />
              </div>
              <div style={{ fontSize:11, color:'var(--text-tertiary)', marginTop:2 }}>{salesPct}%</div>
            </div>
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontSize:13, fontWeight:600 }}>Fidelity Card</span>
                <span style={{ fontSize:13, color:'var(--text-secondary)' }}>{fidelityToday} / {objectives.fidelity_target} oggi</span>
              </div>
              <div style={{ height:8, background:'var(--bg-surface-alt)', borderRadius:4, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${Math.min(100,fidelityToday/objectives.fidelity_target*100)}%`, background:'var(--accent-blue)', borderRadius:4 }} />
              </div>
            </div>
          </div>
          {objectives.streak > 0 && (
            <div style={{ marginTop:14, background:'var(--brand-primary-light)', borderRadius:10, padding:'var(--space-md)', display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontSize:28 }}></span>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:14, color:'var(--brand-primary-dark)' }}>{objectives.streak} giorni consecutivi sopra target!</div>
                <div style={{ fontSize:12, color:'var(--brand-primary-dark)', opacity:0.8, marginTop:2 }}>Sei il #{objectives.rank} nel negozio questa settimana. Ancora {fmt(objectives.sales_target - summary.total_sales)} per raggiungere il #1!</div>
              </div>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:22, fontWeight:700, color:'var(--brand-primary)' }}>#{objectives.rank}</div>
                <div style={{ fontSize:10, color:'var(--text-tertiary)' }}>RANK</div>
              </div>
            </div>
          )}
        </div>

        {/* FCU Info */}
        <div style={{ background:'var(--brand-primary-light)', border:'1px solid var(--brand-primary)', borderRadius:'var(--radius-md)', padding:'var(--space-md)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:12, fontWeight:600, color:'var(--brand-primary-dark)' }}>FCU Desiderato (impostato dal proprietario)</div>
            <div style={{ fontSize:20, fontWeight:700, color:'var(--brand-primary-dark)', marginTop:2 }}>{fmt(fcuDefault)}</div>
            <div style={{ fontSize:11, color:'var(--brand-primary-dark)', opacity:0.7, marginTop:2 }}>da confermare a fine turno con banconote</div>
          </div>
          <Link href="/employee/shift/close"><button className="btn btn-secondary" style={{ fontSize:12 }}>Dettagli </button></Link>
        </div>

        {/* Riepilogo Cassa */}
        <div className="card">
          <h4 style={{ marginBottom:'var(--space-md)' }}>Riepilogo Cassa</h4>
          {[
            { label:'FCE', value:`+${fmt(summary.fce)}`, color:'var(--text-primary)' },
            { label:'+ Vendite Cash', value:`+${fmt(summary.total_cash)}`, color:'var(--success)' },
            { label:' Spese', value:`${fmt(summary.total_expenses)}`, color:'var(--danger)' },
            { label:' FCU', value:`${fmt(fcuDefault)}`, color:'var(--text-secondary)' },
          ].map(row => (
            <div key={row.label} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--border-subtle)' }}>
              <span style={{ fontSize:14, color:'var(--text-secondary)' }}>{row.label}</span>
              <span style={{ fontSize:14, fontWeight:600, color:row.color }}>{row.value}</span>
            </div>
          ))}
          <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', marginTop:2 }}>
            <span style={{ fontWeight:700, fontSize:15 }}>Deposito Atteso</span>
            <span style={{ fontWeight:700, fontSize:18, color:'var(--brand-primary)' }}>{fmt(depositExpected)}</span>
          </div>
        </div>

        {/* Azioni Rapide */}
        <div>
          <h4 style={{ marginBottom:'var(--space-md)' }}>Azioni Rapide</h4>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'var(--space-sm)' }}>
            {QUICK_ACTIONS.map(a => (
              <Link key={a.href} href={a.href} style={{ textDecoration:'none' }}>
                <div style={{ background:'var(--brand-primary)', borderRadius:'var(--radius-md)', padding:'var(--space-lg)', display:'flex', alignItems:'center', gap:'var(--space-md)', cursor:'pointer' }}>
                  <span style={{ fontSize:22 }}>{a.icon}</span>
                  <span style={{ fontWeight:600, color:'white', fontSize:14 }}>{a.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Altre Azioni */}
        <div>
          <h4 style={{ marginBottom:'var(--space-md)' }}>Altre Azioni</h4>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'var(--space-sm)' }}>
            {MORE_ACTIONS.map(a => (
              <Link key={a.href} href={a.href} style={{ textDecoration:'none' }}>
                <div style={{ background:'var(--bg-primary)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'var(--space-md)', display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:22 }}>{a.icon}</span>
                  <span style={{ fontSize:11, color:'var(--text-secondary)', textAlign:'center', fontWeight:500, lineHeight:1.2 }}>{a.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Tasks */}
        {tasks.length > 0 && (
          <div>
            <h4 style={{ marginBottom:'var(--space-md)' }}>📋 I Tuoi Task ({tasks.length})</h4>
            <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-sm)' }}>
              {tasks.map(task => (
                <div key={task.id} className="card" style={{ padding:'var(--space-md)', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, fontSize:14, marginBottom:4 }}>{task.title}</div>
                    {task.description && <div style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:4 }}>{task.description}</div>}
                    {task.due_date && <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>📅 Scadenza: {new Date(task.due_date).toLocaleDateString('it-IT')}</div>}
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6, marginLeft:12 }}>
                    <span style={{ fontSize:10, fontWeight:700, color: PRIORITY_COLOR[task.priority] }}>{PRIORITY_LABEL[task.priority]}</span>
                    <button onClick={async () => {
                      await supabase.from('tasks').update({ status:'done', completed_at: new Date().toISOString() }).eq('id', task.id)
                      setTasks(prev => prev.filter(t => t.id !== task.id))
                    }} style={{ fontSize:11, padding:'4px 10px', background:'var(--success)', color:'white', border:'none', borderRadius:6, cursor:'pointer', fontWeight:600 }}>✓ Fatto</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ultime Vendite */}
        <div>
          <h4 style={{ marginBottom:'var(--space-md)' }}>Ultime Vendite</h4>
          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            {sales.length === 0 && <div style={{ padding:'var(--space-xl)', textAlign:'center', color:'var(--text-tertiary)', fontSize:13 }}>Nessuna vendita oggi</div>}
            {sales.map((sale, i) => (
              <div key={sale.id} style={{ display:'flex', alignItems:'center', gap:'var(--space-md)', padding:'var(--space-md) var(--space-lg)', borderBottom:i<sales.length-1?'1px solid var(--border-subtle)':'none' }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:600 }}>{sale.customer_name || 'Anonimo'}</div>
                  <div style={{ fontSize:12, color:'var(--text-tertiary)' }}>{sale.invoice_number}  {formatTime(sale.created_at)}</div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:3 }}>
                  <span style={{ fontSize:11, padding:'2px 7px', borderRadius:20, background:sale.payment_method==='cash'?'var(--success-light)':'#EEF2FF', color:sale.payment_method==='cash'?'var(--brand-primary)':'var(--accent-indigo)', fontWeight:600 }}>
                    {sale.customer_nationality || 'IT'}  {sale.payment_method==='cash'?'Cash':'POS'}
                  </span>
                  <span style={{ fontWeight:700, fontSize:14 }}>{fmt(sale.total)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
      <BottomNav />
    </div>
  )
}
