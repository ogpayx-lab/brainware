'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { fmt, formatTime, periodLabel } from '@/lib/utils'
import { BottomNav } from '@/components/employee/BottomNav'
import { playNotificationSound } from '@/lib/useNotificationSound'

const QUICK_ACTIONS = [
  { href:'/employee/pos',         icon:'🛒', label:'Nuova Vendita',        color:'#22C55E', desc:'Registra vendita' },
  { href:'/employee/orders',      icon:'📦', label:'Nuova Spedizione',     color:'#3B82F6', desc:'Evadi ordini Shopify' },
  { href:'/employee/fidelity',    icon:'💳', label:'Fidelity Card',         color:'#8B5CF6', desc:'Nuovo cliente fedele' },
  { href:'/employee/inventory',   icon:'📊', label:'Conteggio Inventario', color:'#F59E0B', desc:'Verifica giacenze' },
  { href:'/employee/stock',       icon:'📥', label:'Ricarica Stock',        color:'#EF4444', desc:'Aggiungi quantità' },
  { href:'/employee/notifications', icon:'🔔', label:'Notifiche',           color:'#F97316', desc:'Messaggi e avvisi' },
  { href:'/employee/reorder',     icon:'📢', label:'Richiedi Ricarica',    color:'#EC4899', desc:'Segnala prodotti mancanti' },
]
const OTHER_ACTIONS = [
  { href:'/employee/expenses',         icon:'💸', label:'Aggiungi Spesa',     color:'#F97316', desc:'Registra uscite' },
  { href:'/employee/maintenance',      icon:'🔧', label:'Manutenzione',       color:'#6B7280', desc:'Checklist giornaliera' },
  { href:'/employee/photos',           icon:'📷', label:'Foto Registro',      color:'#06B6D4', desc:'Carica foto registro' },
  { href:'/employee/transfers',        icon:'🔄', label:'Trasferimenti',      color:'#8B5CF6', desc:'Sposta tra store' },
  { href:'/employee/calendar',         icon:'📅', label:'Giorni Liberi',      color:'#14B8A6', desc:'Richiedi permessi' },
  { href:'/employee/ai',              icon:'🤖', label:'Assistente AI',       color:'#6366F1', desc:'Aiuto e procedure' },
  { href:'#checkout',                  icon:'🚪', label:'Check Out',           color:'#F59E0B', desc:'Esci senza chiudere turno' },
  { href:'/employee/shift/close',      icon:'🔒', label:'Chiudi Turno',       color:'#EF4444', desc:'Fine turno e deposito' },
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
  const [tasks, setTasks] = useState<any[]>([])
  const [showCheckout, setShowCheckout] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const prevNotifCount = useRef<number | null>(null)
  const [perf, setPerf] = useState({ punctuality: 0, punctualityTotal: 0, invMatch: 0, invTotal: 0, tasksCompleted: 0, tasksTotal: 0 })

  useEffect(() => { loadData(); const t = setInterval(loadData, 30000); return () => clearInterval(t) }, [])

  async function loadData() {
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase.from('users').select('full_name,store_id,stores(name)').eq('id', user.id).single()
    if (!profile) { router.push('/login'); return }

    // Use active employee name from localStorage (store account model)
    const activeEmpName = typeof window !== 'undefined' ? localStorage.getItem('activeEmployeeName') : null
    setName(activeEmpName || profile.full_name)
    setStoreName((profile.stores as any)?.name ?? '')

    if (profile.store_id) {
      const { data: cfg } = await supabase.from('store_config').select('fcu_default').eq('store_id', profile.store_id).single()
      if (cfg) setFcuDefault(cfg.fcu_default)
      try {
        const { data: tasksData } = await supabase.from('tasks').select('*').eq('store_id', profile.store_id).eq('assigned_to', user.id).neq('status','done').order('created_at',{ascending:false}).limit(5)
        setTasks(tasksData ?? [])
      } catch {}
      // Notification sound check
      try {
        const { count } = await supabase.from('notifications').select('id', { count:'exact', head:true }).eq('store_id', profile.store_id).eq('user_id', user.id).eq('read', false)
        const unread = count ?? 0
        if (prevNotifCount.current !== null && unread > prevNotifCount.current) {
          playNotificationSound()
        }
        prevNotifCount.current = unread
      } catch {}
    }

    // Find open shift for this store (not user-specific anymore)
    const { data: openShift } = await supabase
      .from('shifts')
      .select('*')
      .eq('store_id', profile.store_id)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!openShift) { router.push('/employee/shift/open'); return }

    const { data: salesData } = await supabase
      .from('sales')
      .select('*')
      .eq('shift_id', openShift.id)
      .order('created_at', { ascending: false })
      .limit(8)

    setSales(salesData ?? [])

    let expensesList: any[] = []
    try {
      const { data: expensesData } = await supabase.from('expenses').select('amount').eq('shift_id', openShift.id)
      expensesList = expensesData ?? []
    } catch {}

    const allSales = salesData ?? []
    const totalSales = allSales.reduce((s: number, r: any) => s + (parseFloat(r.total) || 0), 0)
    const totalCash = allSales.filter((r: any) => r.payment_method === 'cash').reduce((s: number, r: any) => s + (parseFloat(r.total) || 0), 0)
    const totalExpenses = expensesList.reduce((s: number, r: any) => s + (parseFloat(r.amount) || 0), 0)

    setSummary({
      shift_id: openShift.id,
      user_id: user.id,
      status: 'open',
      fce: openShift.fce ?? 0,
      period: openShift.period,
      total_sales: totalSales,
      total_cash: totalCash,
      total_pos: totalSales - totalCash,
      total_expenses: totalExpenses,
      total_transactions: allSales.length,
      created_at: openShift.created_at,
      opened_at: openShift.created_at,
    })

    // --- Performance metrics ---
    try {
      // Load store schedule
      const { data: storeCfg } = await supabase
        .from('store_config')
        .select('morning_shift_start, evening_shift_start, punctuality_tolerance_min')
        .eq('store_id', profile.store_id)
        .single()

      const morningStart = storeCfg?.morning_shift_start || '08:00'
      const eveningStart = storeCfg?.evening_shift_start || '14:00'
      const TOLERANCE_MIN = storeCfg?.punctuality_tolerance_min ?? 5

      // Puntualità: ultimi 30 turni
      const { data: recentShifts } = await supabase
        .from('shifts')
        .select('id, created_at, period')
        .eq('store_id', profile.store_id)
        .order('created_at', { ascending: false })
        .limit(30)

      const punctualityTotal = recentShifts?.length ?? 0
      let punctualityOnTime = 0
      for (const s of recentShifts ?? []) {
        const openedAt = new Date(s.created_at)
        const expectedTime = s.period === 'morning' ? morningStart : eveningStart
        const [h, m] = expectedTime.split(':').map(Number)
        const expected = new Date(openedAt)
        expected.setHours(h, m, 0, 0)
        const diffMin = (openedAt.getTime() - expected.getTime()) / 60000
        if (diffMin <= TOLERANCE_MIN) punctualityOnTime++
      }

      // Match inventario: conteggi di questo store
      const { data: storeCountIds } = await supabase
        .from('inventory_counts')
        .select('id')
        .eq('store_id', profile.store_id)
      const countIds = (storeCountIds ?? []).map((c: any) => c.id)
      let invMatch = 0, invTotal = 0
      if (countIds.length > 0) {
        const { data: allItems } = await supabase
          .from('inventory_count_items')
          .select('status')
          .in('inventory_count_id', countIds)
        invTotal = allItems?.length ?? 0
        invMatch = allItems?.filter((i: any) => i.status === 'match').length ?? 0
      }

      // Task giornalieri completati oggi
      const todayStr = new Date().toISOString().split('T')[0]
      const { data: todayLogs } = await supabase
        .from('maintenance_logs')
        .select('completed')
        .eq('store_id', profile.store_id)
        .gte('created_at', todayStr)
      const tasksTotal = todayLogs?.length ?? 0
      const tasksCompleted = todayLogs?.filter((l: any) => l.completed).length ?? 0

      setPerf({ punctuality: punctualityOnTime, punctualityTotal, invMatch, invTotal, tasksCompleted, tasksTotal })
    } catch {}

    setLoading(false)
  }

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}><div style={{ color:'var(--text-secondary)' }}>Caricamento...</div></div>
  if (!summary) return null

  const depositExpected = summary.fce + summary.total_cash - summary.total_expenses - fcuDefault
  const salesPct = Math.min(100, Math.round((summary.total_sales / objectives.sales_target) * 100))

  return (
    <div className="page" style={{ paddingBottom:80 }}>
      <div style={{ background:'var(--bg-primary)', borderBottom:'1px solid var(--border-subtle)', padding:'16px 20px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <h3 style={{ margin:0, fontSize:18 }}>Ciao {name.split(' ')[0]} 👋</h3>
            <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:2 }}>{storeName} · {new Date().toLocaleDateString('it-IT',{day:'numeric',month:'short',year:'numeric'})}</div>
          </div>
          <span className="badge badge-brand" style={{ fontSize:11 }}>{periodLabel[summary.period] || summary.period}</span>
        </div>
      </div>

      <div style={{ padding:'16px', display:'flex', flexDirection:'column', gap:'12px' }}>

        {/* ═══════════════════════════════════════════════════════ */}
        {/*  ZONA MENU / AZIONI                                    */}
        {/* ═══════════════════════════════════════════════════════ */}
        <div style={{ background:'var(--bg-primary)', borderRadius:16, padding:'16px', border:'1px solid var(--border-subtle)' }}>
          <h4 style={{ margin:'0 0 12px', fontSize:15 }}>⚡ Azioni Rapide</h4>
          <Link href={QUICK_ACTIONS[0].href} style={{ textDecoration:'none', display:'block', marginBottom:8 }}>
            <div style={{
              background: `linear-gradient(135deg, ${QUICK_ACTIONS[0].color}, ${QUICK_ACTIONS[0].color}dd)`,
              borderRadius:14, padding:'16px 20px',
              display:'flex', alignItems:'center', justifyContent:'space-between',
              boxShadow:`0 4px 12px ${QUICK_ACTIONS[0].color}40`,
              cursor:'pointer',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                <span style={{ fontSize:28 }}>{QUICK_ACTIONS[0].icon}</span>
                <div>
                  <div style={{ fontWeight:700, color:'white', fontSize:16 }}>{QUICK_ACTIONS[0].label}</div>
                  <div style={{ fontSize:12, color:'rgba(255,255,255,0.8)', marginTop:2 }}>{QUICK_ACTIONS[0].desc}</div>
                </div>
              </div>
              <span style={{ color:'white', fontSize:22 }}>→</span>
            </div>
          </Link>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {QUICK_ACTIONS.slice(1).map(a => (
              <Link key={a.href} href={a.href} style={{ textDecoration:'none' }}>
                <div style={{
                  background: `linear-gradient(135deg, ${a.color}15, ${a.color}08)`,
                  border: `1.5px solid ${a.color}30`,
                  borderRadius:12, padding:'14px',
                  display:'flex', flexDirection:'column', gap:6,
                  cursor:'pointer',
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:20, width:32, height:32, borderRadius:8, background:`${a.color}18`, display:'flex', alignItems:'center', justifyContent:'center' }}>{a.icon}</span>
                    <div style={{ fontWeight:700, fontSize:13, color:a.color }}>{a.label}</div>
                  </div>
                  <div style={{ fontSize:11, color:'var(--text-secondary)' }}>{a.desc}</div>
                </div>
              </Link>
            ))}
          </div>

          {/* Divider tra azioni rapide e altre azioni */}
          <div style={{ height:1, background:'var(--border-subtle)', margin:'14px 0 10px' }} />

          <h4 style={{ margin:'0 0 12px', fontSize:15 }}>📋 Altre Azioni</h4>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {OTHER_ACTIONS.map(a => {
              if (a.href === '#checkout') {
                return (
                  <div key={a.href} onClick={() => setShowCheckout(true)} style={{
                    background:'var(--bg-surface)', border:`1.5px solid ${a.color}20`,
                    borderRadius:12, padding:'12px',
                    display:'flex', alignItems:'center', gap:10,
                    cursor:'pointer',
                  }}>
                    <span style={{ fontSize:22, width:36, height:36, borderRadius:8, background:`${a.color}12`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{a.icon}</span>
                    <div>
                      <div style={{ fontWeight:700, fontSize:13, color:'var(--text-primary)' }}>{a.label}</div>
                      <div style={{ fontSize:11, color:'var(--text-tertiary)', marginTop:1 }}>{a.desc}</div>
                    </div>
                  </div>
                )
              }
              return (
                <Link key={a.href} href={a.href} style={{ textDecoration:'none' }}>
                  <div style={{
                    background:'var(--bg-surface)', border:`1.5px solid ${a.color}20`,
                    borderRadius:12, padding:'12px',
                    display:'flex', alignItems:'center', gap:10,
                    cursor:'pointer',
                  }}>
                    <span style={{ fontSize:22, width:36, height:36, borderRadius:8, background:`${a.color}12`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{a.icon}</span>
                    <div>
                      <div style={{ fontWeight:700, fontSize:13, color:'var(--text-primary)' }}>{a.label}</div>
                      <div style={{ fontSize:11, color:'var(--text-tertiary)', marginTop:1 }}>{a.desc}</div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════ */}
        {/*  DIVISORE VISIVO                                       */}
        {/* ═══════════════════════════════════════════════════════ */}
        <div style={{
          display:'flex', alignItems:'center', gap:12, padding:'8px 0',
        }}>
          <div style={{ width:4, height:28, borderRadius:2, background:'var(--brand-primary)' }} />
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:'var(--text-primary)' }}>📊 Il Tuo Turno</div>
            <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>Statistiche e riepilogo in tempo reale</div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════ */}
        {/*  ZONA STATISTICHE / DATI                               */}
        {/* ═══════════════════════════════════════════════════════ */}
        <div style={{ background:'var(--bg-primary)', borderRadius:16, padding:'16px', border:'1px solid var(--border-subtle)' }}>
          {/* KPI Grid */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
            {[
              { label:'Vendite', value:fmt(summary.total_sales), sub:`${summary.total_transactions} transazioni`, icon:'📈' },
              { label:'Contanti', value:fmt(summary.total_cash), sub:'cash raccolto', icon:'💵' },
              { label:'POS', value:fmt(summary.total_pos || 0), sub:'elettronico', icon:'💳' },
              { label:'Spese', value:fmt(summary.total_expenses), sub:'uscite', icon:'📤', danger:summary.total_expenses > 0 },
            ].map(k => (
              <div key={k.label} style={{ background:'var(--bg-surface)', borderRadius:12, padding:'12px 14px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                  <span style={{ fontSize:16 }}>{k.icon}</span>
                  <span style={{ fontSize:12, color:'var(--text-secondary)', fontWeight:600 }}>{k.label}</span>
                </div>
                <div style={{ fontSize:20, fontWeight:700, color: k.danger ? 'var(--danger)' : 'var(--text-primary)' }}>{k.value}</div>
                <div style={{ fontSize:11, color:'var(--text-tertiary)', marginTop:2 }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div style={{ height:1, background:'var(--border-subtle)', margin:'0 0 14px' }} />

          {/* Riepilogo Cassa */}
          <h4 style={{ margin:'0 0 10px', fontSize:14 }}>💰 Riepilogo Cassa</h4>
          {[
            { label:'FCE (Fondo Cassa Entrata)', value:`+${fmt(summary.fce)}`, color:'var(--text-primary)' },
            { label:'+ Vendite Cash', value:`+${fmt(summary.total_cash)}`, color:'var(--success)' },
            { label:'− Spese', value:`−${fmt(summary.total_expenses)}`, color:'var(--danger)' },
            { label:'− FCU', value:`−${fmt(fcuDefault)}`, color:'var(--text-secondary)' },
          ].map(row => (
            <div key={row.label} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid var(--border-subtle)', fontSize:13 }}>
              <span style={{ color:'var(--text-secondary)' }}>{row.label}</span>
              <span style={{ fontWeight:600, color:row.color }}>{row.value}</span>
            </div>
          ))}
          <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 0 0', marginTop:4 }}>
            <span style={{ fontWeight:700, fontSize:15 }}>Deposito Atteso</span>
            <span style={{ fontWeight:700, fontSize:18, color: depositExpected >= 0 ? 'var(--brand-primary)' : 'var(--danger)' }}>{fmt(depositExpected)}</span>
          </div>

          {/* Divider */}
          <div style={{ height:1, background:'var(--border-subtle)', margin:'14px 0' }} />

          {/* Obiettivi */}
          <h4 style={{ margin:'0 0 10px', fontSize:14 }}>🎯 Obiettivi</h4>
          <div style={{ marginBottom:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
              <span style={{ fontSize:13, fontWeight:600 }}>Vendite Giornaliere</span>
              <span style={{ fontSize:12, color:'var(--text-secondary)' }}>{fmt(summary.total_sales)} / {fmt(objectives.sales_target)}</span>
            </div>
            <div style={{ height:8, background:'var(--bg-surface-alt)', borderRadius:4, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${salesPct}%`, background: salesPct >= 100 ? 'var(--success)' : 'var(--brand-primary)', borderRadius:4, transition:'width 0.5s' }} />
            </div>
            <div style={{ fontSize:11, color:'var(--text-tertiary)', marginTop:2 }}>{salesPct}%</div>
          </div>
          {objectives.streak > 0 && (
            <div style={{ background:'var(--brand-primary-light)', borderRadius:10, padding:'10px 12px', display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:22 }}>🔥</span>
              <div style={{ flex:1, fontSize:12, color:'var(--brand-primary-dark)' }}>
                <strong>{objectives.streak} giorni</strong> consecutivi sopra target! Rank #{objectives.rank}
              </div>
            </div>
          )}

          {/* Divider */}
          <div style={{ height:1, background:'var(--border-subtle)', margin:'14px 0' }} />

          {/* Performance */}
          <h4 style={{ margin:'0 0 10px', fontSize:14 }}>📊 Performance</h4>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[
              {
                label: '⏰ Puntualità',
                value: perf.punctualityTotal > 0 ? Math.round((perf.punctuality / perf.punctualityTotal) * 100) : 0,
                sub: `${perf.punctuality}/${perf.punctualityTotal} turni puntuali`,
                color: 'var(--success)',
              },
              {
                label: '📋 Match Inventario',
                value: perf.invTotal > 0 ? Math.round((perf.invMatch / perf.invTotal) * 100) : 0,
                sub: `${perf.invMatch}/${perf.invTotal} prodotti corrispondenti`,
                color: 'var(--accent-blue)',
              },
              {
                label: '🔧 Task Giornalieri',
                value: perf.tasksTotal > 0 ? Math.round((perf.tasksCompleted / perf.tasksTotal) * 100) : 0,
                sub: `${perf.tasksCompleted}/${perf.tasksTotal} completati oggi`,
                color: 'var(--accent-indigo)',
              },
            ].map(m => (
              <div key={m.label}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:13, fontWeight:600 }}>{m.label}</span>
                  <span style={{ fontSize:12, color:'var(--text-secondary)', fontWeight:700 }}>{m.value}%</span>
                </div>
                <div style={{ height:8, background:'var(--bg-surface-alt)', borderRadius:4, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${m.value}%`, background: m.value >= 80 ? m.color : m.value >= 50 ? 'var(--warning)' : 'var(--danger)', borderRadius:4, transition:'width 0.5s' }} />
                </div>
                <div style={{ fontSize:11, color:'var(--text-tertiary)', marginTop:2 }}>{m.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {tasks.length > 0 && (
          <div>
            <h4 style={{ margin:'0 0 10px', fontSize:14 }}>📋 I Tuoi Task ({tasks.length})</h4>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {tasks.map(task => (
                <div key={task.id} className="card" style={{ padding:'12px 14px', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, fontSize:14, marginBottom:3 }}>{task.title}</div>
                    {task.description && <div style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:3 }}>{task.description}</div>}
                    {task.due_date && <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>📅 {new Date(task.due_date).toLocaleDateString('it-IT')}</div>}
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

        <div>
          <h4 style={{ margin:'0 0 10px', fontSize:14 }}>🧾 Ultime Vendite</h4>
          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            {sales.length === 0 && <div style={{ padding:'30px', textAlign:'center', color:'var(--text-tertiary)', fontSize:13 }}>Nessuna vendita in questo turno</div>}
            {sales.map((sale, i) => (
              <div key={sale.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderBottom:i<sales.length-1?'1px solid var(--border-subtle)':'none' }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:600 }}>{sale.customer_name || 'Anonimo'}</div>
                  <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>{sale.invoice_number} · {formatTime(sale.created_at)}</div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:3 }}>
                  <span style={{ fontSize:10, padding:'2px 7px', borderRadius:20, background:sale.payment_method==='cash'?'var(--success-light)':'#EEF2FF', color:sale.payment_method==='cash'?'var(--brand-primary)':'var(--accent-indigo)', fontWeight:600 }}>
                    {sale.payment_method==='cash'?'💵 Cash':'💳 POS'}
                  </span>
                  <span style={{ fontWeight:700, fontSize:14 }}>{fmt(sale.total)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Check Out Modal */}
      {showCheckout && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:20 }}>
          <div style={{ background:'var(--bg-primary)', borderRadius:20, padding:28, width:'100%', maxWidth:380, textAlign:'center' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🚪</div>
            <h3 style={{ marginBottom:8 }}>Check Out</h3>
            <p style={{ color:'var(--text-secondary)', fontSize:14, marginBottom:20, lineHeight:1.6 }}>
              Stai per uscire <strong>senza chiudere il turno</strong>.<br/>
              Il turno resterà aperto per il prossimo dipendente o per la chiusura successiva.
            </p>
            <div style={{ background:'var(--bg-surface)', borderRadius:12, padding:'12px 16px', marginBottom:20, fontSize:13, color:'var(--text-secondary)', textAlign:'left' }}>
              <div style={{ marginBottom:4 }}>💡 <strong>Quando usare il Check Out:</strong></div>
              <div>• Cambio turno con collega</div>
              <div>• Pausa prolungata / metà turno</div>
              <div>• Non sei responsabile della chiusura</div>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button
                className="btn btn-secondary"
                style={{ flex:1 }}
                onClick={() => setShowCheckout(false)}
              >
                Annulla
              </button>
              <button
                className="btn btn-primary"
                style={{ flex:1, background:'#F59E0B' }}
                disabled={checkingOut}
                onClick={async () => {
                  setCheckingOut(true)
                  await supabase.auth.signOut()
                  router.push('/login')
                }}
              >
                {checkingOut ? '⏳ Uscita...' : '🚪 Check Out'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
