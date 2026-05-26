'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BottomNav } from '@/components/employee/BottomNav'
import { useT } from '@/lib/i18n'

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay() // 0=Sun
}

const MONTH_NAMES = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']
const DAY_NAMES = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom']

export default function CalendarioTurni() {
  const router = useRouter()
  const supabase = createClient()
  const t = useT()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [shifts, setShifts] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string|null>(null)
  const [storeId, setStoreId] = useState<string|null>(null)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [requestDate, setRequestDate] = useState('')
  const [requestReason, setRequestReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<string|null>(null)

  useEffect(() => { loadData() }, [year, month])

  async function loadData() {
    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
    if (!user) { router.push('/login'); return }
    setUserId(user.id)
    const { data: profile } = await supabase.from('users').select('store_id').eq('id', user.id).single()
    if (!profile?.store_id) return
    setStoreId(profile.store_id)

    const from = new Date(year, month, 1).toISOString()
    const to = new Date(year, month + 1, 0, 23, 59, 59).toISOString()

    const [{ data: shiftsData }, { data: reqData }] = await Promise.all([
      supabase.from('shifts').select('*').eq('user_id', user.id).gte('opened_at', from).lte('opened_at', to),
      supabase.from('day_off_requests').select('*').eq('user_id', user.id)
        .gte('date', `${year}-${String(month+1).padStart(2,'0')}-01`)
        .lte('date', `${year}-${String(month+1).padStart(2,'0')}-${getDaysInMonth(year,month)}`),
    ])
    setShifts(shiftsData ?? [])
    setRequests(reqData ?? [])
    setLoading(false)
  }

  async function submitRequest() {
    if (!requestDate || !userId || !storeId) return
    setSaving(true)
    // Inserisci richiesta
    await supabase.from('day_off_requests').insert({
      user_id: userId,
      store_id: storeId,
      date: requestDate,
      notes: requestReason,
    })
    // Inserisci notifica per l'owner
    const { data: profile } = await supabase.from('users').select('full_name').eq('id', userId).single()
    await supabase.from('notifications').insert({
      store_id: storeId,
      type: 'day_off_request',
      title: `📅 Richiesta giorno libero`,
      message: `${profile?.full_name} ha richiesto il giorno libero del ${new Date(requestDate + 'T12:00:00').toLocaleDateString('it-IT', { weekday:'long', day:'numeric', month:'long' })}${requestReason ? ` — ${requestReason}` : ''}`,
      user_id: userId,
      metadata: { date: requestDate, notes: requestReason },
    })
    setSaving(false)
    setShowRequestModal(false)
    setRequestDate(''); setRequestReason('')
    loadData()
  }

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = (getFirstDayOfMonth(year, month) + 6) % 7 // convert Sun=0 to Mon=0

  function getDayInfo(day: number) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    const shift = shifts.find(s => s.opened_at.startsWith(dateStr))
    const req = requests.find(r => r.date === dateStr)
    return { dateStr, shift, req }
  }

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>{t('loading')}</div>

  return (
    <div className="page" style={{ paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background:'var(--bg-primary)', borderBottom:'1px solid var(--border-subtle)', padding:'var(--space-lg)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h3>📅 Calendario Turni</h3>
          <button
            className="btn btn-primary"
            style={{ fontSize:12, padding:'6px 14px' }}
            onClick={() => { setShowRequestModal(true) }}
          >
            + Richiedi giorno libero
          </button>
        </div>
        {/* Navigazione mese */}
        <div style={{ display:'flex', alignItems:'center', gap:16, marginTop:12 }}>
          <button onClick={() => { if (month === 0) { setMonth(11); setYear(y => y-1) } else setMonth(m => m-1) }} style={{ background:'none', border:'1px solid var(--border-default)', borderRadius:8, padding:'4px 10px', cursor:'pointer', fontSize:16 }}>‹</button>
          <span style={{ fontWeight:700, fontSize:16, flex:1, textAlign:'center' }}>{MONTH_NAMES[month]} {year}</span>
          <button onClick={() => { if (month === 11) { setMonth(0); setYear(y => y+1) } else setMonth(m => m+1) }} style={{ background:'none', border:'1px solid var(--border-default)', borderRadius:8, padding:'4px 10px', cursor:'pointer', fontSize:16 }}>›</button>
        </div>
      </div>

      <div style={{ padding:'var(--space-lg)', display:'flex', flexDirection:'column', gap:'var(--space-lg)' }}>
        {/* Legenda */}
        <div style={{ display:'flex', gap:12, flexWrap:'wrap', fontSize:12 }}>
          {[
            { color:'var(--brand-primary)', label:'Turno mattina' },
            { color:'var(--accent-indigo)', label:'Turno sera' },
            { color:'var(--warning)', label:'Giorno libero richiesto' },
            { color:'var(--success)', label:'Richiesta approvata' },
            { color:'var(--danger)', label:'Richiesta rifiutata' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display:'flex', alignItems:'center', gap:5 }}>
              <div style={{ width:10, height:10, borderRadius:3, background:color }} />
              <span style={{ color:'var(--text-secondary)' }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Calendario */}
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          {/* Intestazioni giorni */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', background:'var(--bg-surface)', borderBottom:'1px solid var(--border-subtle)' }}>
            {DAY_NAMES.map(d => (
              <div key={d} style={{ padding:'8px 4px', textAlign:'center', fontSize:11, fontWeight:700, color:'var(--text-tertiary)' }}>{d}</div>
            ))}
          </div>
          {/* Griglia giorni */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)' }}>
            {/* Celle vuote prima del primo giorno */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} style={{ minHeight:64, borderRight:'1px solid var(--border-subtle)', borderBottom:'1px solid var(--border-subtle)' }} />
            ))}
            {/* Giorni del mese */}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const { dateStr, shift, req } = getDayInfo(day)
              const isToday = dateStr === today.toISOString().split('T')[0]
              const isPast = new Date(dateStr) < new Date(today.toISOString().split('T')[0])
              const isSelected = selected === dateStr
              const dotColor = shift
                ? (shift.period === 'morning' ? 'var(--brand-primary)' : 'var(--accent-indigo)')
                : req
                ? (req.status === 'approved' ? 'var(--success)' : req.status === 'rejected' ? 'var(--danger)' : 'var(--warning)')
                : null

              return (
                <div
                  key={day}
                  onClick={() => setSelected(isSelected ? null : dateStr)}
                  style={{
                    minHeight: 64,
                    padding: '6px 8px',
                    borderRight: '1px solid var(--border-subtle)',
                    borderBottom: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--brand-primary-light)' : 'transparent',
                    transition: 'background 0.15s',
                    position: 'relative',
                  }}
                >
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: isToday ? 'var(--brand-primary)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: isToday ? 700 : 400,
                    color: isToday ? 'white' : isPast ? 'var(--text-tertiary)' : 'var(--text-primary)',
                    marginBottom: 4,
                  }}>
                    {day}
                  </div>
                  {dotColor && (
                    <div style={{ width: '100%' }}>
                      <div style={{ height: 4, borderRadius: 2, background: dotColor, marginBottom: 2 }} />
                      <div style={{ fontSize: 9, color: dotColor, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {shift ? (shift.period === 'morning' ? '☀️ Mattina' : '🌙 Sera') : req ? (req.status === 'approved' ? '✅ Libero' : req.status === 'rejected' ? '❌ Rifiutato' : '⏳ In attesa') : ''}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Dettaglio giorno selezionato */}
        {selected && (() => {
          const { shift, req } = getDayInfo(parseInt(selected.split('-')[2]))
          return (
            <div className="card">
              <h4 style={{ marginBottom:'var(--space-md)' }}>
                {new Date(selected + 'T12:00:00').toLocaleDateString('it-IT', { weekday:'long', day:'numeric', month:'long' })}
              </h4>
              {shift && (
                <div style={{ padding:12, background:'var(--brand-primary-light)', borderRadius:8, marginBottom:8 }}>
                  <div style={{ fontWeight:600, color:'var(--brand-primary-dark)' }}>{shift.period === 'morning' ? '☀️ Turno Mattina' : '🌙 Turno Sera'}</div>
                  <div style={{ fontSize:12, color:'var(--brand-primary-dark)', marginTop:4 }}>Stato: <b>{shift.status === 'open' ? 'Aperto' : 'Chiuso'}</b></div>
                </div>
              )}
              {req && (
                <div style={{ padding:12, background:'var(--bg-surface)', borderRadius:8, marginBottom:8 }}>
                  <div style={{ fontWeight:600 }}>📋 Richiesta Giorno Libero</div>
                  <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:4 }}>Motivo: {req.reason || 'Non specificato'}</div>
                  <div style={{ marginTop:6 }}>
                    <span className={`badge ${req.status === 'approved' ? 'badge-success' : req.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>
                      {req.status === 'approved' ? '✅ Approvata' : req.status === 'rejected' ? '❌ Rifiutata' : '⏳ In attesa di approvazione'}
                    </span>
                  </div>
                </div>
              )}
              {!shift && !req && (
                <div style={{ color:'var(--text-tertiary)', fontSize:13 }}>Nessun turno o richiesta per questo giorno.</div>
              )}
              {!req && new Date(selected) >= new Date(today.toISOString().split('T')[0]) && (
                <button
                  className="btn btn-secondary"
                  style={{ marginTop:10, fontSize:12 }}
                  onClick={() => { setRequestDate(selected); setShowRequestModal(true) }}
                >
                  + Richiedi giorno libero
                </button>
              )}
            </div>
          )
        })()}

        {/* Richieste recenti */}
        {requests.length > 0 && (
          <div className="card">
            <h4 style={{ marginBottom:'var(--space-md)' }}>Le Tue Richieste</h4>
            {requests.map(r => (
              <div key={r.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600 }}>{new Date((r.date || r.request_date) + 'T12:00:00').toLocaleDateString('it-IT', { weekday:'short', day:'numeric', month:'short' })}</div>
                  <div style={{ fontSize:12, color:'var(--text-tertiary)' }}>{r.notes || r.reason || 'Nessun motivo'}</div>
                </div>
                <span className={`badge ${r.status === 'approved' ? 'badge-success' : r.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize:11 }}>
                  {r.status === 'approved' ? '✅ Approvata' : r.status === 'rejected' ? '❌ Rifiutata' : '⏳ In attesa'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal richiesta giorno libero */}
      {showRequestModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h4 style={{ marginBottom:'var(--space-md)' }}>📋 Richiedi Giorno Libero</h4>
            <div className="input-group" style={{ marginBottom:12 }}>
              <label className="input-label">Data</label>
              <input type="date" className="input" value={requestDate} onChange={e => setRequestDate(e.target.value)} min={today.toISOString().split('T')[0]} />
            </div>
            <div className="input-group" style={{ marginBottom:16 }}>
              <label className="input-label">Motivo (opzionale)</label>
              <textarea className="input" rows={3} placeholder="Es. visita medica, impegno personale..." value={requestReason} onChange={e => setRequestReason(e.target.value)} style={{ resize:'none' }} />
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-secondary" style={{ flex:1 }} onClick={() => { setShowRequestModal(false); setRequestDate(''); setRequestReason('') }}>{t('cancel')}</button>
              <button className="btn btn-primary" style={{ flex:2 }} disabled={saving||!requestDate} onClick={submitRequest}>
                {saving ? 'Invio...' : 'Invia Richiesta'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
