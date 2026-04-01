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

  useEffect(() => {
    async function loadStore() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('users').select('store_id,stores(name)').eq('id', user.id).single()
      if (profile?.stores) setStoreName((profile.stores as any).name ?? 'BrainWare')
    }
    loadStore()
  }, [])

  async function handleOpen() {
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase
      .from('users')
      .select('store_id, full_name')
      .eq('id', user.id)
      .single()

    if (!profile?.store_id) {
      // Prova a recuperare store_id dai metadati auth (impostati durante l'invito)
      const meta = user.user_metadata
      if (meta?.store_id) {
        await supabase.from('users').upsert({
          id: user.id,
          full_name: meta.full_name || profile?.full_name || user.email,
          role: meta.role || 'employee',
          store_id: meta.store_id,
          is_active: true,
        })
        // Riprova con il store_id recuperato
      } else {
        setError('Nessun negozio associato al tuo account. Contatta il tuo owner.')
        setLoading(false)
        return
      }
    }

    const storeId = profile?.store_id || user.user_metadata?.store_id

    const fceValue = parseFloat(fce) || 0

    const { error: shiftError } = await supabase
      .from('shifts')
      .insert({
        store_id: storeId,
        user_id: user.id,
        period,
        fce: fceValue,
        status: 'open',
      })

    if (shiftError) {
      setError('Errore nell\'apertura del turno. Riprova.')
      setLoading(false)
      return
    }

    router.push('/employee/dashboard')
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-surface)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-lg)',
    }}>
      <div style={{ width: '100%', maxWidth: 480 }}>

        {/* Header */}
        <div style={{ marginBottom: 'var(--space-xl)' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 700, color: 'var(--brand-primary)' }}>
            {storeName}
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>

          <div>
            <h2>Apertura Turno</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: 14 }}>
              Configura il tuo turno di lavoro
            </p>
          </div>

          {/* Date (read-only) */}
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
              >
                Mattina
              </button>
              <button
                type="button"
                className={`toggle-option ${period === 'evening' ? 'active' : ''}`}
                onClick={() => setPeriod('evening')}
              >
                Sera
              </button>
            </div>
          </div>

          {/* FCE */}
          <div className="input-group">
            <label className="input-label">Fondo Cassa Entrata (FCE)</label>
            <div className="input-with-prefix">
              <span className="input-prefix"></span>
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
            onClick={handleOpen}
            disabled={loading}
            className="btn btn-primary btn-full btn-lg"
          >
            {loading ? 'Apertura in corso...' : 'Inizia Turno'}
          </button>
        </div>
      </div>
    </div>
  )
}
