'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BottomNav } from '@/components/employee/BottomNav'

type ShopifyOrder = {
  id: number
  name: string
  created_at: string
  financial_status: string
  fulfillment_status: string | null
  total_price: string
  currency: string
  line_items: { title: string; quantity: number; price: string }[]
  shipping_address?: { name: string; address1: string; city: string; country: string }
  email: string
}

export default function EmployeeOrdersPage() {
  const router = useRouter()
  const supabase = createClient()
  const [orders, setOrders] = useState<ShopifyOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notConfigured, setNotConfigured] = useState(false)
  const [accessToken, setAccessToken] = useState<string|null>(null)
  const [fulfillModal, setFulfillModal] = useState<ShopifyOrder|null>(null)
  const [fulfilling, setFulfilling] = useState(false)
  const [fulfillForm, setFulfillForm] = useState({
    trackingCompany: '',
    trackingNumber: '',
    notifyCustomer: true,
  })
  const [fulfillError, setFulfillError] = useState('')
  const [fulfillSuccess, setFulfillSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'unfulfilled'|'all'>('unfulfilled')

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token ?? ''
    setAccessToken(token)
    await fetchOrders(token)
  }

  async function fetchOrders(token?: string) {
    setLoading(true); setError('')
    const authToken = token ?? accessToken ?? ''
    try {
      const res = await fetch('/api/shopify?endpoint=orders.json%3Fstatus%3Dany%26limit%3D100', {
        headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      })
      const json = await res.json()
      if (json.not_configured) { setNotConfigured(true); setLoading(false); return }
      if (json.error) { setError(json.error); setLoading(false); return }
      setOrders(json.orders ?? [])
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  async function fulfillOrder() {
    if (!fulfillModal) return
    if (!fulfillForm.trackingCompany.trim()) { setFulfillError('Il nome del corriere è obbligatorio'); return }
    if (!fulfillForm.trackingNumber.trim()) { setFulfillError('Il numero di tracking è obbligatorio'); return }

    setFulfilling(true); setFulfillError('')
    const token = accessToken ?? (await supabase.auth.getSession()).data.session?.access_token ?? ''
    try {
      const res = await fetch('/api/shopify', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: fulfillModal.id,
          trackingCompany: fulfillForm.trackingCompany,
          trackingNumber: fulfillForm.trackingNumber,
          notifyCustomer: fulfillForm.notifyCustomer,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setFulfillError(json.error || `Errore ${res.status}`)
        setFulfilling(false)
        return
      }
      setOrders(prev => prev.map(o => o.id === fulfillModal.id ? { ...o, fulfillment_status: 'fulfilled' } : o))
      setFulfillSuccess(`Ordine ${fulfillModal.name} evaso con successo!`)
      setTimeout(() => { setFulfillModal(null); setFulfillSuccess('') }, 2500)
    } catch (e: any) {
      setFulfillError(e.message)
    }
    setFulfilling(false)
  }

  const pending = orders.filter(o => !o.fulfillment_status)
  const filtered = orders.filter(o => {
    const matchFilter = filter === 'all' || !o.fulfillment_status
    const matchSearch = !search || o.name.toLowerCase().includes(search.toLowerCase()) || o.shipping_address?.name?.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  if (notConfigured) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface)', paddingBottom: 80 }}>
      <div style={{ textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🛍️</div>
        <h3>Shopify non configurato</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 8 }}>Contatta il tuo owner per configurare la connessione Shopify.</p>
      </div>
      <BottomNav />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-surface)', paddingBottom: 80 }}>
      {/* Fulfill Modal */}
      {fulfillModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: '20px 20px 0 0', padding: '24px 20px 36px', width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
            {fulfillSuccess ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
                <h3 style={{ color: 'var(--success)', fontSize: 18 }}>{fulfillSuccess}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 8 }}>Il cliente è stato notificato via email.</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18 }}>📦 Evadi Ordine</h3>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                      {fulfillModal.name} · €{parseFloat(fulfillModal.total_price).toFixed(2)}
                    </div>
                  </div>
                  <button onClick={() => { setFulfillModal(null); setFulfillError('') }} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, width: 32, height: 32, fontSize: 18, cursor: 'pointer' }}>×</button>
                </div>

                {/* Articoli */}
                <div style={{ background: 'var(--bg-surface)', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.05em', marginBottom: 8 }}>ARTICOLI DA SPEDIRE</div>
                  {fulfillModal.line_items.map((li, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < fulfillModal.line_items.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                      <span style={{ fontSize: 14 }}>{li.title}</span>
                      <span style={{ fontWeight: 700, fontSize: 14, background: 'var(--brand-primary-light)', color: 'var(--brand-primary)', borderRadius: 6, padding: '2px 8px' }}>×{li.quantity}</span>
                    </div>
                  ))}
                </div>

                {/* Destinatario */}
                {fulfillModal.shipping_address && (
                  <div style={{ background: 'var(--bg-surface)', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.05em', marginBottom: 6 }}>DESTINATARIO</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>📍 {fulfillModal.shipping_address.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {fulfillModal.shipping_address.address1}, {fulfillModal.shipping_address.city}, {fulfillModal.shipping_address.country}
                    </div>
                  </div>
                )}

                {/* Tracking — OBBLIGATORIO */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 6 }}>
                    🚚 Corriere <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <select
                    className="input"
                    value={fulfillForm.trackingCompany}
                    onChange={e => setFulfillForm(f => ({ ...f, trackingCompany: e.target.value }))}
                    style={{ marginBottom: 0, borderColor: fulfillError && !fulfillForm.trackingCompany ? 'var(--danger)' : undefined }}
                  >
                    <option value="">Seleziona corriere...</option>
                    {['GLS', 'DHL', 'BRT', 'SDA', 'TNT', 'UPS', 'FedEx', 'Poste Italiane', 'Nexive', 'InPost', 'Altro'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 6 }}>
                    🔢 Numero Tracking <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    className="input"
                    placeholder="Es: 1Z999AA1012987431"
                    value={fulfillForm.trackingNumber}
                    onChange={e => setFulfillForm(f => ({ ...f, trackingNumber: e.target.value }))}
                    style={{ letterSpacing: fulfillForm.trackingNumber ? '0.05em' : 0, borderColor: fulfillError && !fulfillForm.trackingNumber ? 'var(--danger)' : undefined }}
                  />
                </div>

                {/* Notifica cliente */}
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, padding: '12px 14px', background: 'var(--bg-surface)', borderRadius: 12, cursor: 'pointer' }}
                  onClick={() => setFulfillForm(f => ({ ...f, notifyCustomer: !f.notifyCustomer }))}
                >
                  <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${fulfillForm.notifyCustomer ? 'var(--brand-primary)' : 'var(--border-default)'}`, background: fulfillForm.notifyCustomer ? 'var(--brand-primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                    {fulfillForm.notifyCustomer && <span style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>✓</span>}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>📧 Notifica il cliente</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Shopify invia email con link tracking</div>
                  </div>
                </div>

                {fulfillError && (
                  <div style={{ background: '#FEF2F2', border: '1px solid var(--danger)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: 'var(--danger)' }}>
                    ⚠️ {fulfillError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setFulfillModal(null); setFulfillError('') }}>Annulla</button>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 2 }}
                    onClick={fulfillOrder}
                    disabled={fulfilling}
                  >
                    {fulfilling ? '⏳ Invio in corso...' : '✅ Evadi & Notifica'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-subtle)', padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17 }}>🛍️ Ordini da Evadere</h3>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              {loading ? '...' : `${pending.length} ordini in attesa`}
            </div>
          </div>
          <button onClick={() => fetchOrders()} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10, padding: '6px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)' }}>
            🔄 Aggiorna
          </button>
        </div>

        {/* Badge riepilogo */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <div style={{ background: pending.length > 0 ? '#FEF3C7' : 'var(--bg-surface)', borderRadius: 10, padding: '8px 14px', flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: pending.length > 0 ? '#92400E' : 'var(--text-primary)' }}>{pending.length}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Da evadere</div>
          </div>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 10, padding: '8px 14px', flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{orders.filter(o => o.fulfillment_status === 'fulfilled').length}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Evasi oggi</div>
          </div>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 10, padding: '8px 14px', flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--brand-primary)' }}>€{orders.reduce((s, o) => s + parseFloat(o.total_price || '0'), 0).toFixed(0)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Revenue</div>
          </div>
        </div>
      </div>

      {/* Filtri + Cerca */}
      <div style={{ padding: '12px 16px', background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ display: 'flex', background: 'var(--bg-surface)', borderRadius: 10, padding: 3, gap: 3 }}>
          <button onClick={() => setFilter('unfulfilled')} style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: filter === 'unfulfilled' ? 'var(--bg-primary)' : 'transparent', fontWeight: filter === 'unfulfilled' ? 600 : 400, fontSize: 13, cursor: 'pointer', color: filter === 'unfulfilled' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
            ⏳ Da evadere
          </button>
          <button onClick={() => setFilter('all')} style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: filter === 'all' ? 'var(--bg-primary)' : 'transparent', fontWeight: filter === 'all' ? 600 : 400, fontSize: 13, cursor: 'pointer', color: filter === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
            📋 Tutti
          </button>
        </div>
        <input className="input" placeholder="Cerca ordine..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, height: 36 }} />
      </div>

      {/* Lista ordini */}
      <div style={{ padding: '12px 16px' }}>
        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid var(--danger)', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: 'var(--danger)' }}>
            ⚠️ {error}
          </div>
        )}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
            Caricamento ordini...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>
              {filter === 'unfulfilled' ? 'Nessun ordine da evadere!' : 'Nessun ordine trovato'}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 8 }}>Ottimo lavoro!</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(order => (
              <div key={order.id} style={{ background: 'var(--bg-primary)', borderRadius: 14, padding: '14px 16px', border: !order.fulfillment_status ? '1.5px solid #FCD34D' : '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{order.name}</span>
                    <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: !order.fulfillment_status ? '#FEF3C7' : '#D1FAE5', color: !order.fulfillment_status ? '#92400E' : '#065F46' }}>
                      {order.fulfillment_status ? '✅ Evaso' : '⏳ Da evadere'}
                    </span>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--brand-primary)' }}>€{parseFloat(order.total_price).toFixed(2)}</span>
                </div>

                {order.shipping_address && (
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    📍 {order.shipping_address.name} — {order.shipping_address.city}
                  </div>
                )}

                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10 }}>
                  {order.line_items.slice(0, 3).map(li => `${li.title} ×${li.quantity}`).join(' · ')}
                  {order.line_items.length > 3 && ` +${order.line_items.length - 3} altri`}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {new Date(order.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {!order.fulfillment_status && (
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: 13, padding: '8px 18px' }}
                      onClick={() => {
                        setFulfillModal(order)
                        setFulfillForm({ trackingCompany: '', trackingNumber: '', notifyCustomer: true })
                        setFulfillError('')
                      }}
                    >
                      📦 Evadi ordine →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
