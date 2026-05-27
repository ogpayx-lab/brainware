'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/lib/i18n'

export default function BillingPage() {
  const [sub, setSub] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')
  const t = useT()

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      setUserId(session.user.id)

      const { data } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      setSub(data)
      setLoading(false)
    }
    load()
  }, [])

  const planLabels: Record<string, string> = {
    starter: 'Starter — €49/mese',
    growth: 'Growth — €99/mese',
    business: 'Business — €149/mese',
    free: 'Free Trial',
  }

  const statusColors: Record<string, string> = {
    active: '#22C55E',
    trialing: '#3B82F6',
    cancelled: '#EF4444',
    past_due: '#F59E0B',
  }

  async function openPortal() {
    const res = await fetch('/api/stripe/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
  }

  async function startCheckout(planId: string) {
    const res = await fetch('/api/stripe/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId, userId }),
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
  }

  if (loading) return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ fontSize: 18, color: 'var(--text-secondary)' }}>Caricamento...</div>
    </div>
  )

  return (
    <div className="page" style={{ padding: '24px 20px', maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>💳 Billing & Abbonamento</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>Gestisci il tuo piano e monitora il consumo AI</p>

      {sub ? (
        <>
          {/* Current Plan Card */}
          <div style={{
            background: 'var(--bg-surface)', borderRadius: 16, padding: 24, marginBottom: 20,
            border: '1px solid var(--border-subtle)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Piano Attivo</div>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{planLabels[sub.plan] || sub.plan}</div>
              </div>
              <span style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                background: `${statusColors[sub.status] || '#6B7280'}15`,
                color: statusColors[sub.status] || '#6B7280',
              }}>
                {sub.status === 'active' ? '✅ Attivo' : sub.status === 'trialing' ? '🎁 Trial' : sub.status === 'cancelled' ? '❌ Cancellato' : sub.status}
              </span>
            </div>

            {sub.current_period_end && (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {sub.status === 'trialing' ? 'Trial termina il' : 'Prossimo rinnovo'}:{' '}
                <strong>{new Date(sub.current_period_end).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
              </div>
            )}
          </div>

          {/* AI Usage Card */}
          <div style={{
            background: 'linear-gradient(135deg, #6366F115, #8B5CF615)', borderRadius: 16, padding: 24, marginBottom: 20,
            border: '1px solid #6366F130',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase' }}>🤖 Consumo AI Questo Mese</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#6366F1', marginTop: 4 }}>{sub.ai_requests_count || 0}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>richieste</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase' }}>Costo Stimato</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#6366F1', marginTop: 4 }}>
                  €{((sub.ai_requests_count || 0) * 0.10).toFixed(2)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>€0.10/richiesta</div>
              </div>
            </div>
          </div>

          {/* Manage Button */}
          <button onClick={openPortal} style={{
            width: '100%', padding: 16, background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
            border: 'none', borderRadius: 14, color: 'white', fontSize: 16, fontWeight: 700,
            cursor: 'pointer', marginBottom: 12,
          }}>
            ⚙️ Gestisci Abbonamento su Stripe
          </button>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>
            Modifica piano, aggiorna carta, scarica fatture
          </p>
        </>
      ) : (
        <>
          {/* No subscription — show plans */}
          <div style={{
            background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 14,
            padding: 16, marginBottom: 24, fontSize: 14, color: '#92400E',
          }}>
            ⚠️ Non hai un abbonamento attivo. Scegli un piano per iniziare.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {[
              { id: 'starter', name: 'Starter', price: '49', stores: '1 store', features: ['POS & Vendite', 'Inventario', 'Turni', 'Analytics base'] },
              { id: 'growth', name: 'Growth', price: '99', stores: 'Fino a 3 store', popular: true, features: ['Tutto Starter +', 'Analytics avanzati', 'Supporto prioritario'] },
              { id: 'business', name: 'Business', price: '149', stores: 'Fino a 10 store', features: ['Tutto Growth +', 'Shopify', 'Onboarding dedicato'] },
            ].map(plan => (
              <div key={plan.id} style={{
                background: 'var(--bg-surface)', borderRadius: 16, padding: 20,
                border: plan.popular ? '2px solid #6366F1' : '1px solid var(--border-subtle)',
                position: 'relative',
              }}>
                {plan.popular && (
                  <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: '#6366F1', color: 'white', padding: '2px 12px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>⭐ Popolare</div>
                )}
                <div style={{ fontSize: 18, fontWeight: 800 }}>{plan.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{plan.stores}</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#6366F1' }}>€{plan.price}<span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>/mese</span></div>
                <div style={{ fontSize: 11, color: '#22C55E', marginBottom: 12 }}>🎁 30 giorni gratis</div>
                <ul style={{ listStyle: 'none', padding: 0, marginBottom: 16 }}>
                  {plan.features.map((f, i) => <li key={i} style={{ fontSize: 13, padding: '3px 0', color: 'var(--text-secondary)' }}>✓ {f}</li>)}
                  <li style={{ fontSize: 13, padding: '3px 0', color: '#6366F1', fontWeight: 600 }}>🤖 AI: €0.10/richiesta</li>
                </ul>
                <button onClick={() => startCheckout(plan.id)} style={{
                  width: '100%', padding: 12, background: plan.popular ? 'linear-gradient(135deg, #6366F1, #8B5CF6)' : 'var(--bg-primary)',
                  border: plan.popular ? 'none' : '1px solid var(--border-default)',
                  borderRadius: 12, color: plan.popular ? 'white' : 'var(--text-primary)',
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}>
                  Inizia Gratis
                </button>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 12 }}>
            + AI Assistant: €0.10 per richiesta — addebitato a fine mese
          </p>
        </>
      )}
    </div>
  )
}
