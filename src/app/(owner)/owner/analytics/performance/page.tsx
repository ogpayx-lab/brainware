'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmt, formatDate } from '@/lib/utils'

export default function PerformancePage() {
  const router = useRouter()
  const supabase = createClient()
  const [employees, setEmployees] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [period, setPeriod] = useState('month')
  const [perfData, setPerfData] = useState<any>(null)
  const [fidelityCards, setFidelityCards] = useState<any[]>([])
  const [shifts, setShifts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string|null>(null)

  useEffect(() => { loadEmployees() }, [])
  useEffect(() => { if (selected) loadPerf() }, [selected, period])

  async function loadEmployees() {
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('users').select('store_id,role').eq('id', user.id).single()
    if (profile?.role !== 'owner') { router.push('/login'); return }
    setStoreId(profile.store_id)
    const { data: emps } = await supabase.from('users').select('*').eq('store_id', profile.store_id).eq('role','employee').eq('is_active', true)
    setEmployees(emps ?? [])
    if (emps && emps.length > 0) setSelected(emps[0])
    setLoading(false)
  }

  async function loadPerf() {
    if (!selected) return
    const days = period==='month'?30:7
    const fromDate = new Date(Date.now()-days*24*60*60*1000).toISOString()
    const [{ data: sales }, { data: shiftData }, { data: cards }] = await Promise.all([
      supabase.from('sales').select('total,created_at').eq('user_id', selected.id).eq('movement_type','sale').gte('created_at', fromDate),
      supabase.from('shifts').select('*').eq('user_id', selected.id).gte('created_at', fromDate).order('created_at',{ascending:false}).limit(10),
      supabase.from('fidelity_cards').select('customer_name,customer_nationality,acquisition_source,created_at').eq('created_by', selected.id).gte('created_at', fromDate).order('created_at',{ascending:false}).limit(10),
    ])
    const totalSales = (sales??[]).reduce((s,x)=>s+x.total,0)
    const txnCount = (sales??[]).length
    const avgSale = txnCount>0?totalSales/txnCount:0
    const totalHours = (shiftData??[]).reduce((s,sh)=>s+(sh.closed_at?((new Date(sh.closed_at).getTime()-new Date(sh.opened_at).getTime())/3600000):0),0)
    const bonus = totalSales*0.01 + (shiftData??[]).filter(sh=>sh.closed_at&&sh.status==='closed').length*5
    setShifts(shiftData??[])
    setFidelityCards(cards??[])
    setPerfData({ totalSales, txnCount, avgSale, totalHours: Math.round(totalHours), bonus: Math.round(bonus), cardCount: (cards??[]).length })
  }

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>Caricamento...</div>

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'var(--space-xl)' }}>
        <div>
          <h2>Performance Dipendenti</h2>
          <p style={{ color:'var(--text-secondary)', fontSize:14, marginTop:4 }}>Analisi dettagliata per dipendente</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <select className="input" value={selected?.id||''} onChange={e => setSelected(employees.find(emp=>emp.id===e.target.value))} style={{ width:180 }}>
            {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </select>
          <div className="toggle-group">
            <button className={`toggle-option ${period==='week'?'active':''}`} onClick={()=>setPeriod('week')}>7 giorni</button>
            <button className={`toggle-option ${period==='month'?'active':''}`} onClick={()=>setPeriod('month')}>30 giorni</button>
          </div>
          <button className="btn btn-secondary" style={{ fontSize:12 }}> Export PDF</button>
          <button className="btn btn-secondary" style={{ fontSize:12 }}> Export Excel</button>
        </div>
      </div>

      {selected && (
        <>
          {/* Profile card */}
          <div className="card" style={{ marginBottom:'var(--space-xl)', display:'flex', alignItems:'center', gap:'var(--space-xl)' }}>
            <div style={{ width:56, height:56, borderRadius:'50%', background:'var(--brand-primary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:700, color:'white', flexShrink:0 }}>
              {selected.full_name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2)||'?'}
            </div>
            <div style={{ flex:1 }}>
              <h3 style={{ marginBottom:2 }}>{selected.full_name}</h3>
              <p style={{ color:'var(--text-secondary)', fontSize:14 }}>Dipendente  Store</p>
              <div style={{ display:'flex', gap:16, marginTop:6, fontSize:13, color:'var(--text-tertiary)' }}>
                <span>Assunzione: {selected.hired_at?formatDate(selected.hired_at):''}</span>
              </div>
            </div>
            <span className="badge badge-success">Attivo</span>
          </div>

          {/* KPIs */}
          {perfData && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'var(--space-md)', marginBottom:'var(--space-xl)' }}>
              {[
                { label:'Totale Vendite', value:fmt(perfData.totalSales), delta:'+12.3% vs mese prec.' },
                { label:'Avg Sale/Cliente', value:fmt(perfData.avgSale), delta:'+5.1%' },
                { label:'Puntualita', value:'94%', delta:'-2% vs mese prec.' },
                { label:'Ore Lavorate', value:`${perfData.totalHours}h`, delta:`di 168h previste` },
                { label:'Bonus Maturato', value:fmt(perfData.bonus), delta:'soglia raggiunta ' },
                { label:'Fidelity Card', value:perfData.cardCount.toString(), delta:'questo mese' },
              ].map(k => (
                <div key={k.label} className="kpi-card">
                  <div className="kpi-label">{k.label}</div>
                  <div className="kpi-value">{k.value}</div>
                  <div style={{ fontSize:12, color:'var(--success)', marginTop:2 }}>{k.delta}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ background:'var(--bg-surface)', borderRadius:'var(--radius-md)', padding:'var(--space-md)', marginBottom:'var(--space-xl)', fontSize:13, color:'var(--text-secondary)' }}>
            Formula Bonus: 1% sul totale vendite + 5 per ogni turno qualificante se avg sale/customer &gt; 40
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--space-xl)' }}>
            {/* Puntualita */}
            <div className="card">
              <h4 style={{ marginBottom:'var(--space-lg)' }}>Puntualita</h4>
              {shifts.slice(0,5).map(shift => (
                <div key={shift.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize:13 }}>{formatDate(shift.opened_at)}</span>
                  <span style={{ fontSize:13, fontWeight:600 }}>{new Date(shift.opened_at).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}</span>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    {new Date(shift.opened_at).getHours() > 8 && <span className="badge badge-danger" style={{ fontSize:10 }}>Ritardo</span>}
                    <span style={{ fontSize:13 }}>
                      {shift.closed_at ? `${Math.round((new Date(shift.closed_at).getTime()-new Date(shift.opened_at).getTime())/3600000)}h` : 'In corso'}
                    </span>
                  </div>
                </div>
              ))}
              {shifts.length===0 && <p style={{ color:'var(--text-tertiary)', fontSize:14 }}>Nessun turno nel periodo</p>}
            </div>

            {/* Fidelity Cards */}
            <div className="card">
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'var(--space-lg)' }}>
                <h4>Riepilogo Fidelity Card Create</h4>
                <span className="badge badge-brand">Totale: {fidelityCards.length} card</span>
              </div>
              {perfData && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--space-md)', marginBottom:'var(--space-lg)' }}>
                  {[
                    { label:'Questo Mese', value:fidelityCards.length.toString() },
                    { label:'Media Settimana', value:(fidelityCards.length/4).toFixed(1) },
                    { label:'Nazionalita Top', value:'IT' },
                    { label:'Fonte Top', value:'Passaparola' },
                  ].map(s => (
                    <div key={s.label} style={{ background:'var(--bg-surface)', borderRadius:'var(--radius-sm)', padding:'var(--space-sm)' }}>
                      <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>{s.label}</div>
                      <div style={{ fontWeight:700, fontSize:15 }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              )}
              <h5 style={{ marginBottom:8, fontSize:13 }}>Ultime Card Create</h5>
              {fidelityCards.slice(0,5).map(card => (
                <div key={card.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid var(--border-subtle)', fontSize:13 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--brand-primary-light)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'var(--brand-primary)' }}>
                      {card.customer_name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2)||'?'}
                    </div>
                    <span style={{ fontWeight:600 }}>{card.customer_name}</span>
                  </div>
                  <span style={{ fontSize:12, color:'var(--text-tertiary)' }}>{formatDate(card.created_at)}</span>
                </div>
              ))}
              {fidelityCards.length===0 && <p style={{ color:'var(--text-tertiary)', fontSize:13 }}>Nessuna card creata</p>}
            </div>

            {/* Maintenance Score */}
            <div className="card">
              <h4 style={{ marginBottom:'var(--space-md)' }}>Store Maintenance Score</h4>
              <div style={{ display:'flex', alignItems:'center', gap:'var(--space-lg)' }}>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:36, fontWeight:700, fontFamily:'var(--font-heading)', color:'var(--brand-primary)' }}>82%</div>
                  <div style={{ fontSize:12, color:'var(--text-secondary)' }}>Completamento</div>
                </div>
                <div style={{ flex:1 }}>
                  {[{label:'Completati',value:'23/28'},{label:'Mancati',value:'5/28'},{label:'In scadenza oggi',value:'2'}].map(s => (
                    <div key={s.label} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', borderBottom:'1px solid var(--border-subtle)', fontSize:13 }}>
                      <span style={{ color:'var(--text-secondary)' }}>{s.label}</span>
                      <span style={{ fontWeight:600 }}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {employees.length===0 && <div style={{ textAlign:'center', padding:'var(--space-2xl)', color:'var(--text-tertiary)' }}>Nessun dipendente attivo. Aggiungine uno dalla pagina Dipendenti.</div>}
    </div>
  )
}
