'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import type { ShiftPeriod } from '@/types/database'

export default function ShiftOpenPage() {
  const router = useRouter()
  const supabase = createClient()
  const today = new Date()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [storeName, setStoreName] = useState('Store')
  const [storeId, setStoreId] = useState<string | null>(null)
  const [authUserId, setAuthUserId] = useState<string | null>(null)

  // Employees
  const [employees, setEmployees] = useState<any[]>([])
  const [selectedEmp, setSelectedEmp] = useState<any>(null)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [checkingIn, setCheckingIn] = useState(false)

  // Existing shift
  const [existingShift, setExistingShift] = useState<any>(null)
  const [checkedInUsers, setCheckedInUsers] = useState<any[]>([])

  // Open session form (only when no session exists)
  const [showOpenForm, setShowOpenForm] = useState(false)
  const autoPeriod: ShiftPeriod = new Date().getHours() < 14 ? 'morning' : 'evening'
  const [fce, setFce] = useState('')
  const [opening, setOpening] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setAuthUserId(user.id)

    const { data: profile } = await supabase
      .from('users')
      .select('store_id, full_name, stores(name)')
      .eq('id', user.id)
      .single()

    if (!profile?.store_id) {
      const meta = user.user_metadata
      if (meta?.store_id) {
        await supabase.from('users').upsert({
          id: user.id,
          full_name: meta.full_name || profile?.full_name || user.email,
          role: meta.role || 'employee',
          store_id: meta.store_id,
          is_active: true,
        })
      }
    }

    const sid = profile?.store_id || user.user_metadata?.store_id
    setStoreId(sid)
    if (profile?.stores) setStoreName((profile.stores as any).name ?? 'Store')

    if (!sid) { setLoading(false); return }

    // Load employees of this store (exclude logged-in store account)
    const { data: emps } = await supabase
      .from('users')
      .select('id, full_name, pin, is_active')
      .eq('store_id', sid)
      .eq('is_active', true)
      .neq('role', 'owner')
      .neq('id', user.id)
      .order('full_name')
    setEmployees(emps ?? [])

    // Check for open shift today
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { data: openShift } = await supabase
      .from('shifts')
      .select('*')
      .eq('store_id', sid)
      .eq('status', 'open')
      .gte('opened_at', todayStart.toISOString())
      .order('opened_at', { ascending: false })
      .limit(1)
      .single()

    if (openShift) {
      setExistingShift(openShift)

      const { data: checkins } = await supabase
        .from('shift_checkins')
        .select('id, user_id, checked_in_at, users(full_name)')
        .eq('shift_id', openShift.id)
        .is('checked_out_at', null)

      setCheckedInUsers((checkins || []).map((c: any) => ({
        id: c.id,
        user_id: c.user_id,
        full_name: c.users?.full_name || 'Dipendente',
        checked_in_at: c.checked_in_at,
      })))
    }

    // Check if active employee is set in localStorage
    const activeEmpId = localStorage.getItem('activeEmployeeId')
    if (activeEmpId && openShift) {
      // Already checked in, go to dashboard
      const isStillCheckedIn = (checkins: any) => true // they selected themselves
      router.push('/employee/dashboard')
      return
    }

    setLoading(false)
  }

  // ── Open new session ──
  async function handleOpenSession() {
    if (!storeId || !authUserId || !selectedEmp) return
    setOpening(true)
    setError(null)

    const fceValue = parseFloat(fce) || 0

    const { data: shift, error: shiftError } = await supabase
      .from('shifts')
      .insert({
        store_id: storeId,
        user_id: authUserId,
        period: autoPeriod,
        fce: fceValue,
        status: 'open',
      })
      .select('id')
      .single()

    if (shiftError || !shift) {
      setError('Errore nell\'apertura della sessione.')
      setOpening(false)
      return
    }

    // Check-in the selected employee
    await supabase.from('shift_checkins').insert({
      shift_id: shift.id,
      user_id: selectedEmp.id,
      store_id: storeId,
    })

    // Notify owner
    await supabase.from('notifications').insert({
      store_id: storeId,
      type: 'shift_open',
      title: '🟢 Turno aperto',
      message: `${selectedEmp.full_name} ha aperto il turno ${autoPeriod === 'morning' ? 'mattina' : 'sera'} (FCE: €${fceValue.toFixed(2)}).`,
    })

    // Save active employee to localStorage
    localStorage.setItem('activeEmployeeId', selectedEmp.id)
    localStorage.setItem('activeEmployeeName', selectedEmp.full_name)

    router.push('/employee/dashboard')
  }

  // ── Check-in to existing session ──
  async function handleCheckin() {
    if (!existingShift || !selectedEmp || !storeId) return
    setCheckingIn(true)
    setPinError('')

    // Verify PIN
    if (selectedEmp.pin && selectedEmp.pin !== pin) {
      setPinError('PIN non corretto')
      setCheckingIn(false)
      return
    }

    // Insert check-in
    const { error: checkinError } = await supabase.from('shift_checkins').insert({
      shift_id: existingShift.id,
      user_id: selectedEmp.id,
      store_id: storeId,
    })

    if (checkinError) {
      setPinError('Errore: ' + checkinError.message)
      setCheckingIn(false)
      return
    }

    // Notify owner
    await supabase.from('notifications').insert({
      store_id: storeId,
      type: 'shift_checkin',
      title: '👤 Check-in dipendente',
      message: `${selectedEmp.full_name} ha effettuato il check-in al turno.`,
    })

    // Save active employee to localStorage
    localStorage.setItem('activeEmployeeId', selectedEmp.id)
    localStorage.setItem('activeEmployeeName', selectedEmp.full_name)

    router.push('/employee/dashboard')
  }

  if (loading) {
    return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontSize:16 }}>Caricamento...</div>
  }

  // ════════════════════════════════════════
  //  "CHI SEI?" – Employee Selection Screen
  // ════════════════════════════════════════
  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-surface)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 'var(--space-lg)',
    }}>
      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* Store Name */}
        <div style={{ textAlign:'center', marginBottom: 'var(--space-xl)' }}>
          <div style={{
            fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 700,
            color: 'var(--brand-primary)',
          }}>
            {storeName}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>
            {formatDate(today.toISOString())}
          </div>
        </div>

        {/* Active session banner */}
        {existingShift && (
          <div style={{
            background: 'var(--brand-primary-light)', borderRadius: 12, padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
          }}>
            <span style={{ fontSize: 20 }}>🟢</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--brand-primary-dark)' }}>
                Sessione attiva — {existingShift.period === 'morning' ? 'Mattina' : 'Sera'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {checkedInUsers.length} dipendente{checkedInUsers.length !== 1 ? 'i' : ''} in turno
              </div>
            </div>
          </div>
        )}

        <div className="card" style={{ padding: 0 }}>
          {/* Header */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
            <h2 style={{ fontSize: 20, marginBottom: 4 }}>
              {selectedEmp ? `Ciao ${selectedEmp.full_name.split(' ')[0]}! 👋` : 'Chi sei? 👋'}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {selectedEmp ? 'Inserisci il tuo PIN per iniziare' : 'Seleziona il tuo nome per fare check-in'}
            </p>
          </div>

          {/* Employee List OR PIN input */}
          {!selectedEmp ? (
            <div style={{ padding: '12px 16px', display:'flex', flexDirection:'column', gap: 6, maxHeight: 400, overflowY: 'auto' }}>
              {employees.length === 0 ? (
                <div style={{ textAlign:'center', padding:'var(--space-xl)', color:'var(--text-tertiary)', fontSize:14 }}>
                  Nessun referente configurato.<br/>L'owner deve aggiungere i dipendenti.
                </div>
              ) : employees.map(emp => {
                const isCheckedIn = checkedInUsers.some(c => c.user_id === emp.id)
                return (
                  <button
                    key={emp.id}
                    onClick={() => { setSelectedEmp(emp); setPin(''); setPinError('') }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 16px', borderRadius: 12, border: 'none',
                      background: isCheckedIn ? 'var(--brand-primary-light)' : 'var(--bg-surface)',
                      cursor: 'pointer', textAlign: 'left', width: '100%',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--brand-primary-light)')}
                    onMouseLeave={e => (e.currentTarget.style.background = isCheckedIn ? 'var(--brand-primary-light)' : 'var(--bg-surface)')}
                  >
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: 'var(--brand-primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontWeight: 700, fontSize: 16, flexShrink: 0,
                    }}>
                      {emp.full_name.split(' ').map((n:string) => n[0]).join('').slice(0,2)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{emp.full_name}</div>
                      {isCheckedIn && (
                        <div style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>🟢 Già in turno</div>
                      )}
                    </div>
                    <span style={{ fontSize: 20, color: 'var(--text-tertiary)' }}>→</span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div style={{ padding: '20px 24px' }}>
              {/* Selected employee */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
                padding: '12px 16px', background: 'var(--brand-primary-light)', borderRadius: 12,
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, background: 'var(--brand-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 700, fontSize: 16,
                }}>
                  {selectedEmp.full_name.split(' ').map((n:string) => n[0]).join('').slice(0,2)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{selectedEmp.full_name}</div>
                </div>
                <button
                  onClick={() => { setSelectedEmp(null); setPin(''); setPinError('') }}
                  style={{ background:'none', border:'none', fontSize:13, color:'var(--brand-primary)', cursor:'pointer', fontWeight:600 }}
                >
                  ← Cambia
                </button>
              </div>

              {/* PIN input */}
              {selectedEmp.pin ? (
                <>
                  <div className="input-group" style={{ marginBottom: 12 }}>
                    <label className="input-label">Il tuo PIN</label>
                    <input
                      className="input"
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="• • • •"
                      value={pin}
                      onChange={e => { setPin(e.target.value.replace(/\D/g,'')); setPinError('') }}
                      style={{ textAlign: 'center', fontSize: 28, letterSpacing: 16, fontWeight: 700, height: 56 }}
                      autoFocus
                    />
                  </div>

                  {pinError && (
                    <div style={{
                      background: 'var(--danger-light)', border: '1px solid var(--danger)',
                      borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--danger)', marginBottom: 12,
                    }}>
                      ⚠️ {pinError}
                    </div>
                  )}
                </>
              ) : (
                <div style={{
                  background:'#FFFBEB', border:'1px solid #FCD34D', borderRadius:8,
                  padding:'10px 14px', fontSize:13, color:'#92400E', marginBottom:12,
                }}>
                  ⚠️ Nessun PIN impostato. Chiedi all'owner di configurarlo.
                </div>
              )}

              {/* If no session exists, show "Open Session" form */}
              {!existingShift ? (
                <>
                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16, marginTop: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>
                      📋 Apri la giornata
                    </div>

                    <div style={{ marginBottom: 12, padding: '10px 14px', background: 'var(--brand-primary-light)', borderRadius: 8, fontSize: 13, color: 'var(--brand-primary-dark)', fontWeight: 600 }}>
                      🕐 Turno: {autoPeriod === 'morning' ? '☀️ Mattina' : '🌙 Sera'} (auto)
                    </div>

                    <div className="input-group" style={{ marginBottom: 16 }}>
                      <label className="input-label">Fondo Cassa (FCE)</label>
                      <div className="input-with-prefix">
                        <span className="input-prefix">€</span>
                        <input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={fce} onChange={e => setFce(e.target.value)} />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleOpenSession}
                    disabled={opening || (selectedEmp.pin && pin.length < 4)}
                    className="btn btn-primary btn-full btn-lg"
                  >
                    {opening ? 'Apertura...' : '🟢 Apri Negozio'}
                  </button>
                </>
              ) : (
                <button
                  onClick={handleCheckin}
                  disabled={checkingIn || (selectedEmp.pin && pin.length < 4)}
                  className="btn btn-primary btn-full btn-lg"
                >
                  {checkingIn ? 'Check-in...' : '🟢 Check-in'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Who's in */}
        {checkedInUsers.length > 0 && (
          <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--bg-primary)', borderRadius: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              👥 In turno ({checkedInUsers.length})
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {checkedInUsers.map(u => (
                <span key={u.id} style={{
                  background: 'var(--brand-primary-light)', color: 'var(--brand-primary-dark)',
                  padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                }}>
                  🟢 {u.full_name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
