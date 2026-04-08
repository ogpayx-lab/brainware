'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmt, formatDate } from '@/lib/utils'

interface EmpPerf {
  id: string
  name: string
  revenue: number
  txn: number
  avg: number
  hours: number
  revenuePerHour: number
  cards: number
  shifts: number
  bonus: number
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
    // Get employees from all stores in org
    const { data: storesData } = await supabase.from('stores').select('id').eq('organization_id', oid)
    const storeIds = (storesData ?? []).map(s => s.id)
    const { data: emps } = await supabase.from('users').select('*,stores(name)').in('store_id', storeIds).eq('role', 'employee').eq('is_active', true)
    setEmployees(emps ?? [])
    if (emps && emps.length > 0) setSelected(emps[0])
    setLoading(false)
  }

  async function loadTeamData() {
    const days = period === 'month' ? 30 : 7
    const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    const team: EmpPerf[] = []

    for (const emp of employees) {
      const [{ data: sales }, { data: shiftData }, { data: cards }] = await Promise.all([
        supabase.from('sales').select('total').eq('user_id', emp.id).eq('movement_type', 'sale').gte('created_at', fromDate),
        supabase.from('shifts').select('opened_at,closed_at,status').eq('user_id', emp.id).gte('created_at', fromDate),
        supabase.from('fidelity_cards').select('id').eq('created_by', emp.id).gte('created_at', fromDate),
      ])
      const rev = (sales ?? []).reduce((s, x) => s + x.total, 0)
      const txn = (sales ?? []).length
      const hours = (shiftData ?? []).reduce((s, sh) => s + (sh.closed_at ? ((new Date(sh.closed_at).getTime() - new Date(sh.opened_at).getTime()) / 3600000) : 0), 0)
      const closedShifts = (shiftData ?? []).filter(sh => sh.status === 'closed').length
      const bonus = rev * 0.01 + closedShifts * 5
      team.push({
        id: emp.id, name: emp.full_name, revenue: rev, txn, avg: txn > 0 ? rev / txn : 0,
        hours: Math.round(hours), revenuePerHour: hours > 0 ? rev / hours : 0,
        cards: (cards ?? []).length, shifts: closedShifts, bonus: Math.round(bonus)
      })
    }
    setTeamData(team.sort((a, b) => b.revenue - a.revenue))
  }

  async function loadPerf() {
    if (!selected) return
    const days = period === 'month' ? 30 : 7
    const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    const [{ data: sales }, { data: shiftData }, { data: cards }] = await Promise.all([
      supabase.from('sales').select('total,created_at').eq('user_id', selected.id).eq('movement_type', 'sale').gte('created_at', fromDate),
      supabase.from('shifts').select('*').eq('user_id', selected.id).gte('created_at', fromDate).order('created_at', { ascending: false }).limit(10),
      supabase.from('fidelity_cards').select('customer_name,customer_nationality,created_at').eq('created_by', selected.id).gte('created_at', fromDate).order('created_at', { ascending: false }).limit(10),
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
    setPerfData({ totalSales, txnCount, avgSale, totalHours: Math.round(totalHours), bonus: Math.round(bonus), cardCount: (cards ?? []).length, revenuePerHour, closedShifts })
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>Caricamento...</div>

  const totalTeamRev = teamData.reduce((s, e) => s + e.revenue, 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-xl)' }}>
        <div>
          <h2>👥 Team Performance</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>Confronto e analisi dettagliata dipendenti</p>
        </div>
        <div className="toggle-group">
          <button className={`toggle-option ${period === 'week' ? 'active' : ''}`} onClick={() => setPeriod('week')}>7 giorni</button>
          <button className={`toggle-option ${period === 'month' ? 'active' : ''}`} onClick={() => setPeriod('month')}>30 giorni</button>
        </div>
      </div>

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
                  <tr><th>#</th><th>Dipendente</th><th>Revenue</th><th>Txn</th><th>Avg Sale</th><th>Ore</th><th>€/Ora</th><th>Cards</th><th>Bonus</th></tr>
                </thead>
                <tbody>
                  {teamData.map((emp, i) => (
                    <tr key={emp.id} onClick={() => setSelected(employees.find(e => e.id === emp.id))} style={{ cursor: 'pointer', background: selected?.id === emp.id ? 'var(--bg-surface)' : undefined }}>
                      <td style={{ fontWeight: 700 }}>{['🥇', '🥈', '🥉'][i] || (i + 1)}</td>
                      <td style={{ fontWeight: 600 }}>{emp.name}</td>
                      <td style={{ fontWeight: 700, color: 'var(--brand-primary)' }}>{fmt(emp.revenue)}</td>
                      <td>{emp.txn}</td>
                      <td>{fmt(emp.avg)}</td>
                      <td>{emp.hours}h</td>
                      <td style={{ color: emp.revenuePerHour > 20 ? 'var(--success)' : 'var(--text-secondary)' }}>{fmt(emp.revenuePerHour)}</td>
                      <td>{emp.cards}</td>
                      <td style={{ fontWeight: 600, color: 'var(--success)' }}>{fmt(emp.bonus)}</td>
                    </tr>
                  ))}
                  <tr style={{ background: 'var(--bg-surface)' }}>
                    <td></td>
                    <td style={{ fontWeight: 700 }}>TOTALE TEAM</td>
                    <td style={{ fontWeight: 700 }}>{fmt(totalTeamRev)}</td>
                    <td style={{ fontWeight: 700 }}>{teamData.reduce((s, e) => s + e.txn, 0)}</td>
                    <td></td>
                    <td style={{ fontWeight: 700 }}>{teamData.reduce((s, e) => s + e.hours, 0)}h</td>
                    <td></td>
                    <td style={{ fontWeight: 700 }}>{teamData.reduce((s, e) => s + e.cards, 0)}</td>
                    <td style={{ fontWeight: 700 }}>{fmt(teamData.reduce((s, e) => s + e.bonus, 0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Individual Detail */}
          {selected && (
            <>
              <div className="card" style={{ marginBottom: 'var(--space-xl)', display: 'flex', alignItems: 'center', gap: 'var(--space-xl)' }}>
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
                  {[
                    { label: 'Revenue', value: fmt(perfData.totalSales), color: 'var(--brand-primary)' },
                    { label: 'Transazioni', value: perfData.txnCount.toString() },
                    { label: 'Avg Sale', value: fmt(perfData.avgSale) },
                    { label: 'Ore Lavorate', value: `${perfData.totalHours}h` },
                    { label: '€/Ora', value: fmt(perfData.revenuePerHour), color: perfData.revenuePerHour > 20 ? 'var(--success)' : undefined },
                    { label: 'Turni', value: perfData.closedShifts.toString() },
                    { label: 'Fidelity Card', value: perfData.cardCount.toString() },
                    { label: 'Bonus', value: fmt(perfData.bonus), color: 'var(--success)' },
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-xl)' }}>
                {/* Turni */}
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
            </>
          )}
        </>
      )}
    </div>
  )
}
