'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmt, formatDate } from '@/lib/utils'

interface EmpPerf {
  id: string
  name: string
  store: string
  revenue: number
  txn: number
  avg: number
  hours: number
  revenuePerHour: number
  cards: number
  shifts: number
  bonus: number
  tasksCompleted: number
  maintenanceCompleted: number
  lateCheckins: number
  totalCheckins: number
}

export default function TeamPerformancePage() {
  const router = useRouter()
  const supabase = createClient()
  const [employees, setEmployees] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [period, setPeriod] = useState('month')
  const [perfData, setPerfData] = useState<any>(null)
  const [teamData, setTeamData] = useState<EmpPerf[]>([])
  const [fidelityCards, setFidelityCards] = useState<any[]>([])
  const [shifts, setShifts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string|null>(null)
  const [orgStoreIds, setOrgStoreIds] = useState<string[]>([])

  // Live check-ins & force checkout
  const [liveCheckins, setLiveCheckins] = useState<any[]>([])
  const [forceCheckoutId, setForceCheckoutId] = useState<string | null>(null)
  const [forceCheckoutTime, setForceCheckoutTime] = useState('')
  const [forcingCheckout, setForcingCheckout] = useState(false)

  // Clock
  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])

  useEffect(() => { loadEmployees() }, [])
  useEffect(() => { if (employees.length > 0) loadTeamData() }, [employees, period])
  useEffect(() => { if (selected) loadPerf() }, [selected, period])

  async function loadEmployees() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('users').select('store_id,role,stores(organization_id)').eq('id', user.id).single()
    if (profile?.role !== 'owner') { router.push('/login'); return }
    setStoreId(profile.store_id)

    const oid = (profile.stores as any)?.organization_id
    const { data: storesData } = await supabase.from('stores').select('id').eq('organization_id', oid)
    const storeIds = (storesData ?? []).map(s => s.id)
    setOrgStoreIds(storeIds)

    const { data: emps } = await supabase.from('users').select('*,stores(name)').in('store_id', storeIds).eq('role', 'employee').eq('is_active', true)
    const realEmps = (emps ?? []).filter(e => !e.full_name?.startsWith('[STORE]'))
    setEmployees(realEmps)
    if (realEmps.length > 0) setSelected(realEmps[0])

    // Load open shifts (turni in corso) — deduplicate by user_id
    const { data: openShifts } = await supabase
      .from('shifts')
      .select('id, user_id, opened_at, store_id, period, users(full_name), stores(name)')
      .in('store_id', storeIds)
      .eq('status', 'open')
      .is('closed_at', null)
      .order('opened_at', { ascending: false })
    // Keep only the latest open shift per user
    const checkinMap = new Map<string, any>()
    for (const s of (openShifts ?? [])) {
      if (!checkinMap.has(s.user_id)) checkinMap.set(s.user_id, s)
    }
    setLiveCheckins(Array.from(checkinMap.values()))

    setLoading(false)
  }

  async function loadTeamData() {
    const days = period === 'month' ? 30 : 7
    const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    const team: EmpPerf[] = []

    for (const emp of employees) {
      const [{ data: sales }, { data: shiftData }, { data: cards }, { data: tasks }, { data: maintenance }, { data: checkins }] = await Promise.all([
        supabase.from('sales').select('total').eq('user_id', emp.id).eq('movement_type', 'sale').gte('created_at', fromDate),
        supabase.from('shifts').select('opened_at,closed_at,status').eq('user_id', emp.id).gte('created_at', fromDate),
        supabase.from('fidelity_cards').select('id').eq('created_by', emp.id).gte('created_at', fromDate),
        supabase.from('tasks').select('id').eq('assigned_to', emp.id).eq('completed', true).gte('completed_at', fromDate),
        supabase.from('maintenance_tasks').select('id').eq('completed_by', emp.id).gte('completed_at', fromDate),
        supabase.from('shift_checkins').select('checked_in_at, store_id').eq('user_id', emp.id).gte('checked_in_at', fromDate),
      ])
      const rev = (sales ?? []).reduce((s, x) => s + x.total, 0)
      const txn = (sales ?? []).length
      const hours = (shiftData ?? []).reduce((s, sh) => s + (sh.closed_at ? ((new Date(sh.closed_at).getTime() - new Date(sh.opened_at).getTime()) / 3600000) : 0), 0)
      const closedShifts = (shiftData ?? []).filter(sh => sh.status === 'closed').length
      const bonus = rev * 0.01 + closedShifts * 5

      // Punctuality: check-ins after scheduled time (simplified: >15min late from shift open)
      const lateCount = (checkins ?? []).filter((c: any) => {
        const checkinTime = new Date(c.checked_in_at)
        const hour = checkinTime.getHours()
        // Morning shift starts at ~9, evening at ~14 — late if >15min after
        return (hour >= 9 && hour <= 10) || (hour >= 14 && hour <= 15)
      }).length

      team.push({
        id: emp.id, name: emp.full_name, store: (emp.stores as any)?.name || '',
        revenue: rev, txn, avg: txn > 0 ? rev / txn : 0,
        hours: Math.round(hours), revenuePerHour: hours > 0 ? rev / hours : 0,
        cards: (cards ?? []).length, shifts: closedShifts, bonus: Math.round(bonus),
        tasksCompleted: (tasks ?? []).length,
        maintenanceCompleted: (maintenance ?? []).length,
        lateCheckins: lateCount,
        totalCheckins: (checkins ?? []).length,
      })
    }
    setTeamData(team.sort((a, b) => b.revenue - a.revenue))
  }

  async function loadPerf() {
    if (!selected) return
    const days = period === 'month' ? 30 : 7
    const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    const [{ data: sales }, { data: shiftData }, { data: cards }, { data: tasks }, { data: maintenance }] = await Promise.all([
      supabase.from('sales').select('total,created_at').eq('user_id', selected.id).eq('movement_type', 'sale').gte('created_at', fromDate),
      supabase.from('shifts').select('*').eq('user_id', selected.id).gte('created_at', fromDate).order('created_at', { ascending: false }).limit(10),
      supabase.from('fidelity_cards').select('customer_name,customer_nationality,created_at').eq('created_by', selected.id).gte('created_at', fromDate).order('created_at', { ascending: false }).limit(10),
      supabase.from('tasks').select('id,title,completed_at').eq('assigned_to', selected.id).eq('completed', true).gte('completed_at', fromDate).order('completed_at', { ascending: false }).limit(10),
      supabase.from('maintenance_tasks').select('id,title,completed_at').eq('completed_by', selected.id).gte('completed_at', fromDate).order('completed_at', { ascending: false }).limit(10),
    ])
    const totalSales = (sales ?? []).reduce((s, x) => s + x.total, 0)
    const txnCount = (sales ?? []).length
    const avgSale = txnCount > 0 ? totalSales / txnCount : 0
    const totalHours = (shiftData ?? []).reduce((s, sh) => s + (sh.closed_at ? ((new Date(sh.closed_at).getTime() - new Date(sh.opened_at).getTime()) / 3600000) : 0), 0)
    const closedShifts = (shiftData ?? []).filter(sh => sh.closed_at && sh.status === 'closed').length
    const bonus = totalSales * 0.01 + closedShifts * 5
    const revenuePerHour = totalHours > 0 ? totalSales / totalHours : 0
    setShifts(shiftData ?? [])
    setFidelityCards(cards ?? [])
    setPerfData({
      totalSales, txnCount, avgSale,
      totalHours: Math.round(totalHours), bonus: Math.round(bonus),
      cardCount: (cards ?? []).length, revenuePerHour, closedShifts,
      tasksCompleted: (tasks ?? []).length,
      maintenanceCompleted: (maintenance ?? []).length,
      tasks: tasks ?? [],
      maintenance: maintenance ?? [],
    })
  }

  async function forceCheckout(shiftId: string) {
    if (!forceCheckoutTime) return
    setForcingCheckout(true)
    const closedAt = new Date(forceCheckoutTime).toISOString()
    await supabase.from('shifts').update({ closed_at: closedAt, status: 'closed' }).eq('id', shiftId)
    setLiveCheckins(prev => prev.filter(c => c.id !== shiftId))
    setForceCheckoutId(null)
    setForceCheckoutTime('')
    setForcingCheckout(false)
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>Caricamento...</div>

  const totalTeamRev = teamData.reduce((s, e) => s + e.revenue, 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-xl)' }}>
        <div>
          <h2>👥 Team Performance</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>Confronto, puntualità, task e analisi dettagliata dipendenti</p>
        </div>
        <div className="toggle-group">
          <button className={`toggle-option ${period === 'week' ? 'active' : ''}`} onClick={() => setPeriod('week')}>7 giorni</button>
          <button className={`toggle-option ${period === 'month' ? 'active' : ''}`} onClick={() => setPeriod('month')}>30 giorni</button>
        </div>
      </div>

      {/* ═══════ DIPENDENTI IN TURNO (LIVE) ═══════ */}
      {liveCheckins.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--space-xl)', padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>👥</span>
            <h4 style={{ margin: 0 }}>Dipendenti in Turno</h4>
            <span className="badge badge-success" style={{ fontSize: 11 }}>🟢 {liveCheckins.length} Live</span>
          </div>
          <div style={{ padding: '0 18px 14px' }}>
            {liveCheckins.map((c: any) => {
              const mins = Math.round((Date.now() - new Date(c.opened_at).getTime()) / 60000)
              const h = Math.floor(mins / 60)
              const m = mins % 60
              const isLong = mins > 600
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: isLong ? 'var(--danger)' : 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                    {(c.users?.full_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{c.users?.full_name || 'Dipendente'}</div>
                    <div style={{ fontSize: 11, color: isLong ? 'var(--danger)' : 'var(--text-secondary)' }}>
                      {c.stores?.name} · {c.period === 'morning' ? '☀️' : '🌙'} Apertura: {new Date(c.opened_at).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })} {new Date(c.opened_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} ·
                      {isLong ? ` ⚠️ ${h}h ${m}m` : ` ${h}h ${m}m`}
                    </div>
                  </div>
                  {forceCheckoutId === c.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="datetime-local" className="input" value={forceCheckoutTime} onChange={e => setForceCheckoutTime(e.target.value)} style={{ fontSize: 12, padding: '4px 8px', width: 180 }} />
                      <button className="btn btn-primary" disabled={forcingCheckout || !forceCheckoutTime} onClick={() => forceCheckout(c.id)} style={{ padding: '4px 10px', fontSize: 11 }}>
                        {forcingCheckout ? '...' : '✅'}
                      </button>
                      <button className="btn btn-secondary" onClick={() => { setForceCheckoutId(null); setForceCheckoutTime('') }} style={{ padding: '4px 8px', fontSize: 11 }}>✕</button>
                    </div>
                  ) : (
                    <button className="btn btn-secondary" onClick={() => { setForceCheckoutId(c.id); setForceCheckoutTime(new Date().toISOString().slice(0, 16)) }} style={{ padding: '5px 12px', fontSize: 11, whiteSpace: 'nowrap' }}>
                      🚪 Forza Check-out
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {employees.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-tertiary)' }}>Nessun dipendente attivo.</div>
      ) : (
        <>
          {/* Team Comparison Table */}
          <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
              <h4>🏆 Classifica Team</h4>
              <span className="badge badge-brand">{teamData.length} dipendenti</span>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>#</th><th>Dipendente</th><th>Store</th><th>Revenue</th><th>Txn</th><th>Ore</th><th>€/Ora</th><th>Cards</th><th>Task</th><th>Manut.</th><th>Bonus</th></tr>
                </thead>
                <tbody>
                  {teamData.map((emp, i) => (
                    <tr key={emp.id} onClick={() => setSelected(employees.find(e => e.id === emp.id))} style={{ cursor: 'pointer', background: selected?.id === emp.id ? 'var(--bg-surface)' : undefined }}>
                      <td style={{ fontWeight: 700 }}>{['🥇', '🥈', '🥉'][i] || (i + 1)}</td>
                      <td style={{ fontWeight: 600 }}>{emp.name}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{emp.store}</td>
                      <td style={{ fontWeight: 700, color: 'var(--brand-primary)' }}>{fmt(emp.revenue)}</td>
                      <td>{emp.txn}</td>
                      <td>{emp.hours}h</td>
                      <td style={{ color: emp.revenuePerHour > 20 ? 'var(--success)' : 'var(--text-secondary)' }}>{fmt(emp.revenuePerHour)}</td>
                      <td>{emp.cards}</td>
                      <td>{emp.tasksCompleted}</td>
                      <td>{emp.maintenanceCompleted}</td>
                      <td style={{ fontWeight: 600, color: 'var(--success)' }}>{fmt(emp.bonus)}</td>
                    </tr>
                  ))}
                  <tr style={{ background: 'var(--bg-surface)' }}>
                    <td></td>
                    <td style={{ fontWeight: 700 }} colSpan={2}>TOTALE TEAM</td>
                    <td style={{ fontWeight: 700 }}>{fmt(totalTeamRev)}</td>
                    <td style={{ fontWeight: 700 }}>{teamData.reduce((s, e) => s + e.txn, 0)}</td>
                    <td style={{ fontWeight: 700 }}>{teamData.reduce((s, e) => s + e.hours, 0)}h</td>
                    <td></td>
                    <td style={{ fontWeight: 700 }}>{teamData.reduce((s, e) => s + e.cards, 0)}</td>
                    <td style={{ fontWeight: 700 }}>{teamData.reduce((s, e) => s + e.tasksCompleted, 0)}</td>
                    <td style={{ fontWeight: 700 }}>{teamData.reduce((s, e) => s + e.maintenanceCompleted, 0)}</td>
                    <td style={{ fontWeight: 700 }}>{fmt(teamData.reduce((s, e) => s + e.bonus, 0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Individual Detail */}
          {selected && (
            <>
              <div className="card" style={{ marginBottom: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: 'var(--space-xl)' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                  {selected.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || '?'}
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ marginBottom: 2 }}>{selected.full_name}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                    {(selected.stores as any)?.name || 'Store'} · Dipendente
                  </p>
                </div>
                <select className="input" value={selected?.id || ''} onChange={e => setSelected(employees.find(emp => emp.id === e.target.value))} style={{ width: 180 }}>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
              </div>

              {perfData && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
                  {[
                    { label: 'Revenue', value: fmt(perfData.totalSales), color: 'var(--brand-primary)' },
                    { label: 'Transazioni', value: perfData.txnCount.toString() },
                    { label: 'Ore Lavorate', value: `${perfData.totalHours}h` },
                    { label: '€/Ora', value: fmt(perfData.revenuePerHour), color: perfData.revenuePerHour > 20 ? 'var(--success)' : undefined },
                    { label: 'Turni', value: perfData.closedShifts.toString() },
                    { label: 'Fidelity Card', value: perfData.cardCount.toString() },
                    { label: 'Task Completati', value: perfData.tasksCompleted.toString() },
                    { label: 'Manutenzioni', value: perfData.maintenanceCompleted.toString() },
                    { label: 'Bonus Maturato', value: fmt(perfData.bonus), color: 'var(--success)' },
                    { label: 'Avg Sale', value: fmt(perfData.avgSale) },
                  ].map(k => (
                    <div key={k.label} className="kpi-card">
                      <div className="kpi-label">{k.label}</div>
                      <div className="kpi-value" style={{ color: (k as any).color || 'var(--text-primary)' }}>{k.value}</div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)', marginBottom: 'var(--space-xl)', fontSize: 13, color: 'var(--text-secondary)' }}>
                💡 Formula Bonus: 1% sul totale vendite + €5 per ogni turno completato
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-xl)', marginBottom: 'var(--space-xl)' }}>
                {/* Turni + Puntualità */}
                <div className="card">
                  <h4 style={{ marginBottom: 'var(--space-lg)' }}>🕐 Storico Turni</h4>
                  {shifts.length === 0 ? <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Nessun turno</p> :
                    shifts.slice(0, 7).map(shift => (
                      <div key={shift.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                        <span style={{ fontSize: 13 }}>{formatDate(shift.opened_at)}</span>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{new Date(shift.opened_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
                        <span style={{ fontSize: 13 }}>
                          {shift.closed_at ? `${Math.round((new Date(shift.closed_at).getTime() - new Date(shift.opened_at).getTime()) / 3600000)}h` : '⏳ In corso'}
                        </span>
                      </div>
                    ))
                  }
                </div>

                {/* Fidelity Cards */}
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
                    <h4>💳 Fidelity Card Create</h4>
                    <span className="badge badge-brand">{fidelityCards.length}</span>
                  </div>
                  {fidelityCards.length === 0 ? <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Nessuna card</p> :
                    fidelityCards.slice(0, 5).map((card, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 13 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--brand-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--brand-primary)' }}>
                            {card.customer_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || '?'}
                          </div>
                          <span style={{ fontWeight: 600 }}>{card.customer_name}</span>
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{formatDate(card.created_at)}</span>
                      </div>
                    ))
                  }
                </div>
              </div>

              {/* Task & Maintenance completed */}
              {perfData && (perfData.tasks.length > 0 || perfData.maintenance.length > 0) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-xl)' }}>
                  {perfData.tasks.length > 0 && (
                    <div className="card">
                      <h4 style={{ marginBottom: 'var(--space-lg)' }}>✅ Task Completati</h4>
                      {perfData.tasks.map((t: any) => (
                        <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 13 }}>
                          <span style={{ fontWeight: 600 }}>{t.title}</span>
                          <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{t.completed_at ? formatDate(t.completed_at) : ''}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {perfData.maintenance.length > 0 && (
                    <div className="card">
                      <h4 style={{ marginBottom: 'var(--space-lg)' }}>🔧 Manutenzioni Completate</h4>
                      {perfData.maintenance.map((m: any) => (
                        <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 13 }}>
                          <span style={{ fontWeight: 600 }}>{m.title}</span>
                          <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{m.completed_at ? formatDate(m.completed_at) : ''}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
