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

  const [period, setPeriod] = useState<ShiftPeriod>('morning')
  const [fce, setFce] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [storeName, setStoreName] = useState('BrainWare')
  const [storeId, setStoreId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState('')
  const [pageLoading, setPageLoading] = useState(true)

  // Existing store session
  const [existingShift, setExistingShift] = useState<any>(null)
  const [checkedInUsers, setCheckedInUsers] = useState<{id:string;user_id:string;full_name:string;checked_in_at:string}[]>([])

  // Check-in PIN modal
  const [showPinModal, setShowPinModal] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUserId(user.id)

    const { data: profile } = await supabase
      .from('users')
      .select('store_id, full_name, stores(name)')
      .eq('id', user.id)
      .single()

    if (!profile?.store_id) {
      // Try to recover from auth metadata
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
    setUserName(profile?.full_name || '')
    if (profile?.stores) setStoreName((profile.stores as any).name ?? 'BrainWare')

    // Check if there's already an open session for this store today
    if (sid) {
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

        // Load who is checked in
        const { data: checkins } = await supabase
          .from('shift_checkins')
          .select('id, user_id, checked_in_at, users(full_name)')
          .eq('shift_id', openShift.id)
          .is('checked_out_at', null)

        const mapped = (checkins || []).map((c: any) => ({
          id: c.id,
          user_id: c.user_id,
          full_name: c.users?.full_name || 'Dipendente',
          checked_in_at: c.checked_in_at,
        }))
        setCheckedInUsers(mapped)

        // If current user is already checked in, go to dashboard
        if (mapped.some(c => c.user_id === user.id)) {
          router.push('/employee/dashboard')
          return
        }
      }
    }

    setPageLoading(false)
  }

  // ── Open new store session ──
  async function handleOpenSession() {
    if (!storeId || !userId) return
    setLoading(true)
    setError(null)

    const fceValue = parseFloat(fce) || 0

    const { data: shift, error: shiftError } = await supabase
      .from('shifts')
      .insert({
        store_id: storeId,
        user_id: userId,
        period,
        fce: fceValue,
        status: 'open',
      })
      .select('id')
      .single()

    if (shiftError || !shift) {
      setError('Errore nell\'apertura della sessione. Riprova.')
      setLoading(false)
      return
    }

    // Auto check-in the opener
    await supabase.from('shift_checkins').insert({
      shift_id: shift.id,
      user_id: userId,
      store_id: storeId,
    })

    router.push('/employee/dashboard')
  }

  // ── Check-in to existing session ──
  async function handleCheckin() {
    if (!existingShift || !userId || !storeId) return
    setLoading(true)
    setPinError('')

    // Verify PIN
    const { data: userProfile } = await supabase
      .from('users')
      .select('pin')
      .eq('id', userId)
      .single()

    if (userProfile?.pin && userProfile.pin !== pin) {
      setPinError('PIN non corretto')
      setLoading(false)
      return
    }

    // Insert check-in
    const { error: checkinError } = await supabase.from('shift_checkins').insert({
      shift_id: existingShift.id,
      user_id: userId,
      store_id: storeId,
    })

    if (checkinError) {
      setPinError('Errore nel check-in: ' + checkinError.message)
      setLoading(false)
      return
    }

    router.push('/employee/dashboard')
  }

  if (pageLoading) {
    return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>Caricamento...</div>
  }

  // ════════════════════════════════════
  //  EXISTING SESSION → CHECK-IN SCREEN
  // ════════════════════════════════════
  if (existingShift) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--bg-surface)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--space-lg)',
      }}>
        <div style={{ width: '100%', maxWidth: 480 }}>
          <div style={{ marginBottom: 'var(--space-xl)' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 700, color: 'var(--brand-primary)' }}>
              {storeName}
            </div>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            {/* Active Session Banner */}
            <div style={{
              background: 'var(--brand-primary-light)', borderRadius: 12, padding: 16,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, background: 'var(--brand-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
              }}>🟢</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--brand-primary-dark)' }}>
                  Sessione attiva
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Aperta alle {new Date(existingShift.opened_at).toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit' })} — Turno {existingShift.period === 'morning' ? 'Mattina' : 'Sera'}
                </div>
              </div>
            </div>

            {/* Who's in the store */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--text-secondary)' }}>
                👥 Chi è in negozio ({checkedInUsers.length})
              </div>
              {checkedInUsers.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {checkedInUsers.map(u => (
                    <div key={u.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                      background: 'var(--bg-surface)', borderRadius: 8,
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, background: 'var(--brand-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontWeight: 700, fontSize: 13,
                      }}>
                        {u.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{u.full_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                          Check-in: {new Date(u.checked_in_at).toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit' })}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>🟢 Presente</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: 12 }}>
                  Nessuno al momento
                </div>
              )}
            </div>

            {/* Check-in form */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-lg)' }}>
              <h3 style={{ fontSize: 16, marginBottom: 4 }}>Ciao {userName.split(' ')[0]}! 👋</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                Inserisci il tuo PIN per fare check-in nella sessione.
              </p>

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
                  style={{ textAlign: 'center', fontSize: 24, letterSpacing: 12, fontWeight: 700 }}
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

              <button
                onClick={handleCheckin}
                disabled={loading || pin.length < 4}
                className="btn btn-primary btn-full btn-lg"
                style={{ marginBottom: 8 }}
              >
                {loading ? 'Check-in...' : '🟢 Check-in'}
              </button>

              <div style={{ textAlign: 'center' }}>
                <button
                  onClick={() => { supabase.auth.signOut(); router.push('/login') }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 13, cursor: 'pointer' }}
                >
                  ← Cambia account
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════
  //  NO SESSION → OPEN NEW SESSION
  // ════════════════════════════════════
  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-surface)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 'var(--space-lg)',
    }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ marginBottom: 'var(--space-xl)' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 700, color: 'var(--brand-primary)' }}>
            {storeName}
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
          <div>
            <h2>🟢 Apri Sessione Negozio</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: 14 }}>
              Nessuna sessione attiva. Apri la giornata!
            </p>
          </div>

          {/* Date & Time (read-only) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)' }}>
            <div className="input-group">
              <span className="input-label">Data</span>
              <div style={{
                height: 44, padding: '0 14px', display: 'flex', alignItems: 'center',
                background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)',
                border: '1.5px solid var(--border-default)', color: 'var(--text-primary)',
                fontWeight: 600, fontSize: 14,
              }}>
                {formatDate(today.toISOString())}
              </div>
            </div>

            <div className="input-group">
              <span className="input-label">Check-in</span>
              <div style={{
                height: 44, padding: '0 14px', display: 'flex', alignItems: 'center',
                background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)',
                border: '1.5px solid var(--border-default)', color: 'var(--text-primary)',
                fontWeight: 600, fontSize: 14,
              }}>
                {today.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>

          {/* Shift Period Toggle */}
          <div className="input-group">
            <span className="input-label">Turno</span>
            <div className="toggle-group">
              <button
                type="button"
                className={`toggle-option ${period === 'morning' ? 'active' : ''}`}
                onClick={() => setPeriod('morning')}
              >Mattina</button>
              <button
                type="button"
                className={`toggle-option ${period === 'evening' ? 'active' : ''}`}
                onClick={() => setPeriod('evening')}
              >Sera</button>
            </div>
          </div>

          {/* FCE */}
          <div className="input-group">
            <label className="input-label">Fondo Cassa Entrata (FCE)</label>
            <div className="input-with-prefix">
              <span className="input-prefix">€</span>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={fce}
                onChange={e => setFce(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div style={{
              background: 'var(--danger-light)', border: '1px solid var(--danger)',
              borderRadius: 'var(--radius-sm)', padding: '10px var(--space-md)',
              fontSize: 13, color: 'var(--danger)',
            }}>
              {error}
            </div>
          )}

          <button
            onClick={handleOpenSession}
            disabled={loading}
            className="btn btn-primary btn-full btn-lg"
          >
            {loading ? 'Apertura in corso...' : '🟢 Apri Negozio'}
          </button>
        </div>
      </div>
    </div>
  )
}
