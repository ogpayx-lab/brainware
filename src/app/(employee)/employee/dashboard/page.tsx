'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { fmt, formatTime, periodLabel } from '@/lib/utils'
import { BottomNav } from '@/components/employee/BottomNav'
import { playNotificationSound } from '@/lib/useNotificationSound'
import { useT } from '@/lib/i18n'

const PRIORITY_COLOR: Record<string, string> = {
  urgent: '#EF4444', high: '#F59E0B', normal: '#22C55E', low: '#9CA3AF'
}
const PRIORITY_LABEL: Record<string, string> = {
  urgent: '🔴 Urgente', high: '🟡 Alta', normal: '🟢 Normale', low: '⚪ Bassa'
}

export default function EmployeeDashboard() {
  const router = useRouter()
  const supabase = createClient()
  const t = useT()
  const [summary, setSummary] = useState<any>(null)
  const [sales, setSales] = useState<any[]>([])
  const [name, setName] = useState('')
  const [storeName, setStoreName] = useState('')
  const [fcuDefault, setFcuDefault] = useState(50)
  const [objectives, setObjectives] = useState({ sales_target:1500, fidelity_target:3, streak:5, rank:2 })
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState<any[]>([])
  const [showCheckout, setShowCheckout] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const prevNotifCount = useRef<number | null>(null)
  const [perf, setPerf] = useState({ punctuality: 0, punctualityTotal: 0, invMatch: 0, invTotal: 0, tasksCompleted: 0, tasksTotal: 0 })
  const [todayStats, setTodayStats] = useState({ totalSales: 0, customers: 0, avgPerCustomer: 0, deposits: 0, onlineSales: 0 })
  const [kpiModal, setKpiModal] = useState<{ type: string; title: string } | null>(null)
  const [todaySalesData, setTodaySalesData] = useState<any[]>([])
  const [todayDepositsData, setTodayDepositsData] = useState<any[]>([])

  useEffect(() => { loadData(); const t = setInterval(loadData, 30000); return () => clearInterval(t) }, [])

  async function loadData() {
    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase.from('users').select('full_name,store_id,stores(name)').eq('id', user.id).single()
    if (!profile) { router.push('/login'); return }

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
      try {
        const { count } = await supabase.from('notifications').select('id', { count:'exact', head:true }).eq('store_id', profile.store_id).eq('user_id', user.id).eq('read', false)
        const unread = count ?? 0
        if (prevNotifCount.current !== null && unread > prevNotifCount.current) { playNotificationSound() }
        prevNotifCount.current = unread
      } catch {}

      // Today's store-wide stats
      const todayStr = new Date().toISOString().split('T')[0]
      try {
        const { data: todaySales } = await supabase.from('sales').select('id, total, payment_method, customer_name, created_at, invoice_number').eq('store_id', profile.store_id).gte('created_at', todayStr).eq('movement_type', 'sale')
        const allToday = todaySales ?? []
        setTodaySalesData(allToday)
        const totalSales = allToday.reduce((s, r) => s + (parseFloat(r.total) || 0), 0)
        const customers = allToday.length
        const avgPerCustomer = customers > 0 ? totalSales / customers : 0

        const { data: todayDeposits } = await supabase.from('shifts').select('id, deposit_actual, created_at, period').eq('store_id', profile.store_id).gte('created_at', todayStr).eq('status', 'closed')
        setTodayDepositsData(todayDeposits ?? [])
        const deposits = (todayDeposits ?? []).reduce((s, r) => s + (parseFloat(r.deposit_actual) || 0), 0)

        setTodayStats({ totalSales, customers, avgPerCustomer, deposits, onlineSales: 0 })
      } catch {}
    }

    // Find open shift
    const { data: openShift } = await supabase
      .from('shifts').select('*')
      .eq('store_id', profile.store_id)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1).single()

    if (!openShift) { router.push('/employee/shift/open'); return }

    const { data: salesData } = await supabase.from('sales').select('*').eq('shift_id', openShift.id).order('created_at', { ascending: false }).limit(8)
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
      shift_id: openShift.id, user_id: user.id, status: 'open',
      fce: openShift.fce ?? 0, period: openShift.period,
      total_sales: totalSales, total_cash: totalCash,
      total_pos: totalSales - totalCash, total_expenses: totalExpenses,
      total_transactions: allSales.length, created_at: openShift.created_at, opened_at: openShift.created_at,
    })

    // Performance
    try {
      const { data: storeCfg } = await supabase.from('store_config').select('morning_shift_start, evening_shift_start, punctuality_tolerance_min').eq('store_id', profile.store_id).single()
      const morningStart = storeCfg?.morning_shift_start || '08:00'
      const eveningStart = storeCfg?.evening_shift_start || '14:00'
      const TOLERANCE_MIN = storeCfg?.punctuality_tolerance_min ?? 5

      const { data: recentShifts } = await supabase.from('shifts').select('id, created_at, period').eq('store_id', profile.store_id).order('created_at', { ascending: false }).limit(30)
      const punctualityTotal = recentShifts?.length ?? 0
      let punctualityOnTime = 0
      for (const s of recentShifts ?? []) {
        const openedAt = new Date(s.created_at)
        const expectedTime = s.period === 'morning' ? morningStart : eveningStart
        const [h, m] = expectedTime.split(':').map(Number)
        const expected = new Date(openedAt); expected.setHours(h, m, 0, 0)
        if ((openedAt.getTime() - expected.getTime()) / 60000 <= TOLERANCE_MIN) punctualityOnTime++
      }

      const { data: storeCountIds } = await supabase.from('inventory_counts').select('id').eq('store_id', profile.store_id)
      const countIds = (storeCountIds ?? []).map((c: any) => c.id)
      let invMatch = 0, invTotal = 0
      if (countIds.length > 0) {
        const { data: allItems } = await supabase.from('inventory_count_items').select('status').in('inventory_count_id', countIds)
        invTotal = allItems?.length ?? 0
        invMatch = allItems?.filter((i: any) => i.status === 'match').length ?? 0
      }

      const todayStr = new Date().toISOString().split('T')[0]
      const { data: todayLogs } = await supabase.from('maintenance_logs').select('completed').eq('store_id', profile.store_id).gte('created_at', todayStr)
      const tasksTotal = todayLogs?.length ?? 0
      const tasksCompleted = todayLogs?.filter((l: any) => l.completed).length ?? 0

      setPerf({ punctuality: punctualityOnTime, punctualityTotal, invMatch, invTotal, tasksCompleted, tasksTotal })
    } catch {}

    setLoading(false)
  }

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}><div style={{ color:'var(--text-secondary)' }}>{t('loading')}</div></div>
  if (!summary) return null

  const depositExpected = summary.fce + summary.total_cash - summary.total_expenses - fcuDefault
  const salesPct = Math.min(100, Math.round((summary.total_sales / objectives.sales_target) * 100))

  // Mini bar chart component
  const MiniBar = ({ value, max, color = 'var(--accent-blue)' }: { value: number; max: number; color?: string }) => {
    const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
    return (
      <div style={{ height: 60, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
        <div style={{ width: 32, height:`${Math.max(8, pct)}%`, background: color, borderRadius:'4px 4px 0 0', transition:'height 0.5s' }} />
      </div>
    )
  }

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

        {/* ═══ STATS GIORNALIERE (come screenshot) ═══ */}
        <div style={{ background:'var(--bg-primary)', borderRadius:16, padding:'16px', border:'1px solid var(--border-subtle)' }}>
          <h4 style={{ margin:'0 0 4px', fontSize:15 }}>{t('empApp.dailyStats')}</h4>
          <div style={{ fontSize:11, color:'var(--text-tertiary)', marginBottom:12 }}>{new Date().toLocaleDateString('it-IT', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}</div>

          {/* Average Sales Card */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
            <div style={{ background:'var(--bg-surface)', borderRadius:12, padding:'12px', cursor:'pointer' }} onClick={() => setKpiModal({ type: 'sales', title: t('empApp.salesToday') })}>
              <div style={{ fontSize:11, color:'var(--text-secondary)', fontWeight:600, marginBottom:6 }}>{t('empApp.salesToday')}</div>
              <div style={{ fontSize:22, fontWeight:700, color:'var(--brand-primary)' }}>{fmt(todayStats.totalSales)}</div>
              <div style={{ fontSize:11, color:'var(--text-tertiary)', marginTop:4 }}>{todayStats.customers} {t('empApp.clients')}</div>
            </div>
            <div style={{ background:'var(--bg-surface)', borderRadius:12, padding:'12px' }}>
              <div style={{ fontSize:11, color:'var(--text-secondary)', fontWeight:600, marginBottom:6 }}>{t('empApp.avgPerCustomer')}</div>
              <div style={{ fontSize:22, fontWeight:700 }}>{fmt(todayStats.avgPerCustomer)}</div>
              <div style={{ fontSize:11, color:'var(--text-tertiary)', marginTop:4 }}>{t('empApp.avgReceipt')}</div>
            </div>
          </div>

          {/* Charts Grid */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
            {[
              { label:'Cash', value:summary.total_cash, color:'#3B82F6', type:'cash' },
              { label:'POS', value:summary.total_pos, color:'#8B5CF6', type:'pos' },
              { label: t('empApp.deposits'), value:todayStats.deposits, color:'#22C55E', type:'deposits' },
            ].map(c => (
              <div key={c.label} style={{ background:'var(--bg-surface)', borderRadius:12, padding:'10px', textAlign:'center', cursor:'pointer' }} onClick={() => setKpiModal({ type: c.type, title: c.label })}>
                <div style={{ fontSize:11, color:'var(--text-secondary)', fontWeight:600, marginBottom:4 }}>{c.label}</div>
                <MiniBar value={c.value} max={todayStats.totalSales || 1} color={c.color} />
                <div style={{ fontSize:13, fontWeight:700, marginTop:4 }}>{fmt(c.value)}</div>
              </div>
            ))}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:8 }}>
            <div style={{ background:'var(--bg-surface)', borderRadius:12, padding:'10px', textAlign:'center' }}>
              <div style={{ fontSize:11, color:'var(--text-secondary)', fontWeight:600, marginBottom:4 }}>{t('empApp.dailyExpenses')}</div>
              <MiniBar value={summary.total_expenses} max={todayStats.totalSales || 1} color="#EF4444" />
              <div style={{ fontSize:13, fontWeight:700, marginTop:4, color:'var(--danger)' }}>{fmt(summary.total_expenses)}</div>
            </div>
            <div style={{ background:'var(--bg-surface)', borderRadius:12, padding:'10px', textAlign:'center' }}>
              <div style={{ fontSize:11, color:'var(--text-secondary)', fontWeight:600, marginBottom:4 }}>{t('empApp.onlineSales')}</div>
              <MiniBar value={todayStats.onlineSales} max={todayStats.totalSales || 1} color="#06B6D4" />
              <div style={{ fontSize:13, fontWeight:700, marginTop:4 }}>{fmt(todayStats.onlineSales)}</div>
            </div>
          </div>
        </div>

        {/* ═══ RIEPILOGO CASSA ═══ */}
        <div style={{ background:'var(--bg-primary)', borderRadius:16, padding:'16px', border:'1px solid var(--border-subtle)' }}>
          <h4 style={{ margin:'0 0 10px', fontSize:14 }}>{t('empApp.cashSummary')}</h4>
          {[
            { label: t('empApp.fce'), value:`+${fmt(summary.fce)}`, color:'var(--text-primary)' },
            { label: t('empApp.cashSales'), value:`+${fmt(summary.total_cash)}`, color:'var(--success)' },
            { label: t('empApp.minusExpenses'), value:`−${fmt(summary.total_expenses)}`, color:'var(--danger)' },
            { label: t('empApp.minusFcu'), value:`−${fmt(fcuDefault)}`, color:'var(--text-secondary)' },
          ].map(row => (
            <div key={row.label} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid var(--border-subtle)', fontSize:13 }}>
              <span style={{ color:'var(--text-secondary)' }}>{row.label}</span>
              <span style={{ fontWeight:600, color:row.color }}>{row.value}</span>
            </div>
          ))}
          <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 0 0', marginTop:4 }}>
            <span style={{ fontWeight:700, fontSize:15 }}>{t('empApp.expectedDeposit')}</span>
            <span style={{ fontWeight:700, fontSize:18, color: depositExpected >= 0 ? 'var(--brand-primary)' : 'var(--danger)' }}>{fmt(depositExpected)}</span>
          </div>
        </div>

        {/* ═══ OBIETTIVI & PERFORMANCE ═══ */}
        <div style={{ background:'var(--bg-primary)', borderRadius:16, padding:'16px', border:'1px solid var(--border-subtle)' }}>
          <h4 style={{ margin:'0 0 10px', fontSize:14 }}>{t('empApp.objectives')}</h4>
          <div style={{ marginBottom:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
              <span style={{ fontSize:13, fontWeight:600 }}>{t('empApp.dailySales')}</span>
              <span style={{ fontSize:12, color:'var(--text-secondary)' }}>{fmt(summary.total_sales)} / {fmt(objectives.sales_target)}</span>
            </div>
            <div style={{ height:8, background:'var(--bg-surface-alt)', borderRadius:4, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${salesPct}%`, background: salesPct >= 100 ? 'var(--success)' : 'var(--brand-primary)', borderRadius:4, transition:'width 0.5s' }} />
            </div>
            <div style={{ fontSize:11, color:'var(--text-tertiary)', marginTop:2 }}>{salesPct}%</div>
          </div>
          {objectives.streak > 0 && (
            <div style={{ background:'var(--brand-primary-light)', borderRadius:10, padding:'10px 12px', display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
              <span style={{ fontSize:22 }}>🔥</span>
              <div style={{ flex:1, fontSize:12, color:'var(--brand-primary-dark)' }}>
                <strong>{objectives.streak}</strong> {t('empApp.daysAbove')} Rank #{objectives.rank}
              </div>
            </div>
          )}

          <div style={{ height:1, background:'var(--border-subtle)', margin:'14px 0' }} />

          <h4 style={{ margin:'0 0 10px', fontSize:14 }}>{t('empApp.performance')}</h4>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[
              { label: t('empApp.punctuality'), value: perf.punctualityTotal > 0 ? Math.round((perf.punctuality / perf.punctualityTotal) * 100) : 0, sub: `${perf.punctuality}/${perf.punctualityTotal} ${t('empApp.punctualShifts')}`, color: 'var(--success)' },
              { label: t('empApp.invMatch'), value: perf.invTotal > 0 ? Math.round((perf.invMatch / perf.invTotal) * 100) : 0, sub: `${perf.invMatch}/${perf.invTotal} ${t('empApp.matching')}`, color: 'var(--accent-blue)' },
              { label: t('empApp.dailyTasks'), value: perf.tasksTotal > 0 ? Math.round((perf.tasksCompleted / perf.tasksTotal) * 100) : 0, sub: `${perf.tasksCompleted}/${perf.tasksTotal} ${t('empApp.completed')}`, color: 'var(--accent-indigo)' },
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

        {/* ═══ TASK ═══ */}
        {tasks.length > 0 && (
          <div>
            <h4 style={{ margin:'0 0 10px', fontSize:14 }}>{t('empApp.yourTasks')} ({tasks.length})</h4>
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
                    }} style={{ fontSize:11, padding:'4px 10px', background:'var(--success)', color:'white', border:'none', borderRadius:6, cursor:'pointer', fontWeight:600 }}>{t('empApp.done')}</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ ULTIME VENDITE ═══ */}
        <div>
          <h4 style={{ margin:'0 0 10px', fontSize:14 }}>{t('empApp.recentSales')}</h4>
          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            {sales.length === 0 && <div style={{ padding:'30px', textAlign:'center', color:'var(--text-tertiary)', fontSize:13 }}>{t('empApp.noSalesThisShift')}</div>}
            {sales.map((sale, i) => (
              <div key={sale.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderBottom:i<sales.length-1?'1px solid var(--border-subtle)':'none' }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:600 }}>{sale.customer_name || t('empApp.anonymous')}</div>
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

      {/* KPI Drill-Down Modal */}
      {kpiModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:20 }}>
          <div style={{ background:'var(--bg-primary)', borderRadius:20, padding:24, width:'100%', maxWidth:420, maxHeight:'80vh', display:'flex', flexDirection:'column' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <h3 style={{ margin:0, fontSize:16 }}>{kpiModal.title}</h3>
              <button onClick={() => setKpiModal(null)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer' }}>×</button>
            </div>
            <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:8 }}>
              {kpiModal.type === 'deposits' ? (
                todayDepositsData.length === 0 ? (
                  <div style={{ textAlign:'center', padding:30, color:'var(--text-tertiary)', fontSize:13 }}>{t('empApp.noDepositsToday')}</div>
                ) : todayDepositsData.map(d => (
                  <div key={d.id} style={{ padding:12, background:'var(--bg-surface)', borderRadius:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600 }}>Turno {d.period}</div>
                      <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>{new Date(d.created_at).toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit' })}</div>
                    </div>
                    <span style={{ fontWeight:700, fontSize:15, color:'#22C55E' }}>{fmt(parseFloat(d.deposit_actual) || 0)}</span>
                  </div>
                ))
              ) : (
                (() => {
                  const filteredSales = kpiModal.type === 'cash'
                    ? todaySalesData.filter(s => s.payment_method === 'cash')
                    : kpiModal.type === 'pos'
                    ? todaySalesData.filter(s => s.payment_method === 'pos')
                    : todaySalesData
                  return filteredSales.length === 0 ? (
                    <div style={{ textAlign:'center', padding:30, color:'var(--text-tertiary)', fontSize:13 }}>{t('empApp.noSales')}</div>
                  ) : filteredSales.map(s => (
                    <div key={s.id} style={{ padding:12, background:'var(--bg-surface)', borderRadius:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:600 }}>{s.customer_name || 'Anonimo'}</div>
                        <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>{s.invoice_number} · {new Date(s.created_at).toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit' })}</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <span style={{ fontSize:10, padding:'2px 7px', borderRadius:20, background: s.payment_method==='cash'?'rgba(34,197,94,0.1)':'rgba(124,58,237,0.1)', color: s.payment_method==='cash'?'#22C55E':'#7C3AED', fontWeight:600, display:'block', marginBottom:4 }}>
                          {s.payment_method === 'cash' ? '💵 Cash' : '💳 POS'}
                        </span>
                        <span style={{ fontWeight:700, fontSize:14 }}>{fmt(parseFloat(s.total))}</span>
                      </div>
                    </div>
                  ))
                })()
              )}
            </div>
            <div style={{ marginTop:16, textAlign:'center' }}>
              <button onClick={() => setKpiModal(null)} className="btn btn-secondary">{t('close')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Check Out Modal */}
      {showCheckout && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:20 }}>
          <div style={{ background:'var(--bg-primary)', borderRadius:20, padding:28, width:'100%', maxWidth:380, textAlign:'center' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🚪</div>
            <h3 style={{ marginBottom:8 }}>{t('empApp.checkOut')}</h3>
            <p style={{ color:'var(--text-secondary)', fontSize:14, marginBottom:20, lineHeight:1.6 }}>
              {t('empApp.checkOutDesc')}<br/>
              {t('empApp.checkOutNote')}
            </p>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-secondary" style={{ flex:1 }} onClick={() => setShowCheckout(false)}>{t('cancel')}</button>
              <button className="btn btn-primary" style={{ flex:1, background:'#F59E0B' }} disabled={checkingOut}
                onClick={async () => {
                  setCheckingOut(true)
                  localStorage.removeItem('activeEmployeeId')
                  localStorage.removeItem('activeEmployeeName')
                  router.push('/employee/shift/open')
                }}
              >
                {checkingOut ? `⏳ ${t('empApp.exitMsg')}` : `🚪 ${t('empApp.checkOut')}`}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
