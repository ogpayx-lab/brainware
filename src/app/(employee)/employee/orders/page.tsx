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
  shipping_lines?: { title: string; code: string; price: string }[]
  shipping_address?: { name: string; address1: string; address2?: string; city: string; province?: string; zip?: string; country: string; phone?: string }
  customer?: { first_name: string; last_name: string; email: string; phone?: string }
  email: string
  phone?: string
  tags: string
  payment_gateway_names?: string[]
  gateway?: string
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
    sourceType: 'store' as 'store' | 'warehouse',
    sourceId: '',
    deductStock: true,
  })
  const [fulfillError, setFulfillError] = useState('')
  const [fulfillSuccess, setFulfillSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'unfulfilled'|'all'>('unfulfilled')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [stores, setStores] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [storeId, setStoreId] = useState<string|null>(null)
  const [sourceStockMap, setSourceStockMap] = useState<Record<string,number>>({})
  const [loadingStock, setLoadingStock] = useState(false)
  const [suggestedStore, setSuggestedStore] = useState<string|null>(null)

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token ?? ''
    setAccessToken(token)

    // Carica store e magazzini dell'organizzazione
    const { data: profile } = await supabase.from('users').select('store_id, stores(organization_id, name, city)').eq('id', user.id).single()
    if (profile?.store_id) setStoreId(profile.store_id)
    const oid = (profile?.stores as any)?.organization_id
    if (oid) {
      const { data: storesData } = await supabase.from('stores').select('id,name,city').eq('organization_id', oid).eq('is_active', true)
      setStores(storesData ?? [])
      const { data: whData } = await supabase.from('warehouses').select('id,name,type').eq('organization_id', oid).eq('is_active', true)
      setWarehouses(whData ?? [])
    }

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

  async function loadSourceStock(sourceType: 'store'|'warehouse', sourceId: string, lineItems: {title:string;quantity:number}[]) {
    if (!sourceId) { setSourceStockMap({}); return }
    setLoadingStock(true)
    const map: Record<string,number> = {}
    for (const li of lineItems) {
      const name = li.title.toLowerCase().trim()
      if (sourceType === 'warehouse') {
        const { data } = await supabase.from('warehouse_stock').select('qty').eq('warehouse_id', sourceId).ilike('product_name', `%${name}%`).single()
        map[li.title] = data?.qty ?? 0
      } else {
        const { data } = await supabase.from('products').select('stock').eq('store_id', sourceId).ilike('name', `%${name}%`).single()
        map[li.title] = data?.stock ?? 0
      }
    }
    setSourceStockMap(map)
    setLoadingStock(false)
  }

  async function fulfillOrder() {
    if (!fulfillModal) return
    if (!fulfillForm.trackingCompany.trim()) { setFulfillError('Il nome del corriere è obbligatorio'); return }
    if (!fulfillForm.trackingNumber.trim()) { setFulfillError('Il numero di tracking è obbligatorio'); return }
    if (fulfillForm.deductStock && !fulfillForm.sourceId) { setFulfillError('Seleziona una sorgente inventario'); return }

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

      // Scala inventario dalla sorgente selezionata
      if (fulfillForm.deductStock && fulfillForm.sourceId) {
        for (const li of fulfillModal.line_items) {
          const productName = li.title.toLowerCase().trim()
          if (fulfillForm.sourceType === 'warehouse') {
            const { data: whItem } = await supabase.from('warehouse_stock').select('id,qty').eq('warehouse_id', fulfillForm.sourceId).ilike('product_name', `%${productName}%`).single()
            if (whItem) {
              await supabase.from('warehouse_stock').update({ qty: Math.max(0, whItem.qty - li.quantity) }).eq('id', whItem.id)
            }
          } else {
            const { data: prod } = await supabase.from('products').select('id,stock').eq('store_id', fulfillForm.sourceId).ilike('name', `%${productName}%`).single()
            if (prod) {
              await supabase.from('products').update({ stock: Math.max(0, prod.stock - li.quantity) }).eq('id', prod.id)
            }
          }
        }
      }

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
    const orderDate = o.created_at?.split('T')[0] || ''
    const matchFrom = !dateFrom || orderDate >= dateFrom
    const matchTo = !dateTo || orderDate <= dateTo
    return matchFilter && matchSearch && matchFrom && matchTo
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
                  {fulfillModal.line_items.map((li, i) => {
                    const avail = sourceStockMap[li.title]
                    const hasStock = avail !== undefined
                    const enough = hasStock && avail >= li.quantity
                    return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < fulfillModal.line_items.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 14 }}>{li.title}</span>
                        {hasStock && fulfillForm.deductStock && (
                          <div style={{ fontSize: 11, color: enough ? 'var(--success, #22c55e)' : '#ef4444', fontWeight: 600, marginTop: 2 }}>
                            {enough ? `✅ Disponibile: ${avail}` : `⚠️ Disponibile: ${avail} (servono ${li.quantity})`}
                          </div>
                        )}
                      </div>
                      <span style={{ fontWeight: 700, fontSize: 14, background: 'var(--brand-primary-light)', color: 'var(--brand-primary)', borderRadius: 6, padding: '2px 8px', flexShrink: 0 }}>×{li.quantity}</span>
                    </div>
                    )
                  })}
                </div>

                {/* Destinatario */}
                <div style={{ background: 'var(--bg-surface)', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.05em', marginBottom: 6 }}>DESTINATARIO</div>
                  {fulfillModal.shipping_address && (
                    <>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>📍 {fulfillModal.shipping_address.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        {fulfillModal.shipping_address.address1}{fulfillModal.shipping_address.address2 ? `, ${fulfillModal.shipping_address.address2}` : ''}<br/>
                        {fulfillModal.shipping_address.zip && `${fulfillModal.shipping_address.zip} `}{fulfillModal.shipping_address.city}{fulfillModal.shipping_address.province ? ` (${fulfillModal.shipping_address.province})` : ''}, {fulfillModal.shipping_address.country}
                      </div>
                    </>
                  )}
                  <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
                    {(fulfillModal.phone || fulfillModal.shipping_address?.phone || fulfillModal.customer?.phone) && (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>📞 {fulfillModal.shipping_address?.phone || fulfillModal.phone || fulfillModal.customer?.phone}</div>
                    )}
                    {fulfillModal.email && (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>📧 {fulfillModal.email}</div>
                    )}
                  </div>
                </div>

                {/* Suggerimento Local Delivery */}
                {suggestedStore && (
                  <div style={{ background: '#EDE9FE', border: '1px solid #A78BFA', borderRadius: 12, padding: '10px 14px', marginBottom: 14, fontSize: 12 }}>
                    <div style={{ fontWeight: 700, color: '#5B21B6', marginBottom: 2 }}>📍 Store suggerito per Local Delivery</div>
                    <div style={{ color: '#6D28D9' }}>{suggestedStore}</div>
                  </div>
                )}

                {/* Sorgente Inventario */}
                <div style={{ background: 'var(--bg-surface)', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.05em', marginBottom: 8 }}>📦 SORGENTE INVENTARIO</div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                    <button
                      onClick={() => { setFulfillForm(f => ({...f, sourceType:'store', sourceId:stores[0]?.id||''})); if (fulfillModal) loadSourceStock('store', stores[0]?.id||'', fulfillModal.line_items) }}
                      style={{ flex:1, padding:'7px 10px', borderRadius:8, border:'none', background: fulfillForm.sourceType==='store' ? 'var(--brand-primary)' : 'var(--bg-primary, #fff)', color: fulfillForm.sourceType==='store' ? 'white' : 'var(--text-secondary)', cursor:'pointer', fontSize:13, fontWeight:600, transition:'all 0.15s' }}
                    >
                      🏠 Store
                    </button>
                    <button
                      onClick={() => { setFulfillForm(f => ({...f, sourceType:'warehouse', sourceId:warehouses[0]?.id||''})); if (fulfillModal) loadSourceStock('warehouse', warehouses[0]?.id||'', fulfillModal.line_items) }}
                      style={{ flex:1, padding:'7px 10px', borderRadius:8, border:'none', background: fulfillForm.sourceType==='warehouse' ? 'var(--brand-primary)' : 'var(--bg-primary, #fff)', color: fulfillForm.sourceType==='warehouse' ? 'white' : 'var(--text-secondary)', cursor:'pointer', fontSize:13, fontWeight:600, transition:'all 0.15s' }}
                    >
                      🏭 Magazzino
                    </button>
                  </div>
                  <select
                    className="input"
                    value={fulfillForm.sourceId}
                    onChange={e => { setFulfillForm(f => ({...f, sourceId:e.target.value})); if (fulfillModal) loadSourceStock(fulfillForm.sourceType, e.target.value, fulfillModal.line_items) }}
                    style={{ marginBottom: 8, borderColor: fulfillError && fulfillForm.deductStock && !fulfillForm.sourceId ? 'var(--danger, #ef4444)' : undefined }}
                  >
                    <option value="">Seleziona {fulfillForm.sourceType === 'store' ? 'store' : 'magazzino'}...</option>
                    {fulfillForm.sourceType === 'store'
                      ? stores.map(s => <option key={s.id} value={s.id}>{s.name}{s.city ? ` (${s.city})` : ''}</option>)
                      : warehouses.map(w => <option key={w.id} value={w.id}>{w.type === 'central' ? '🏭' : '📦'} {w.name}</option>)
                    }
                  </select>
                  {loadingStock && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>⏳ Verifica disponibilità...</div>}
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginTop: 4 }}
                    onClick={() => setFulfillForm(f => ({...f, deductStock: !f.deductStock}))}
                  >
                    <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${fulfillForm.deductStock ? 'var(--brand-primary)' : 'var(--border-default, #ddd)'}`, background: fulfillForm.deductStock ? 'var(--brand-primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                      {fulfillForm.deductStock && <span style={{ color: 'white', fontSize: 12, fontWeight: 700 }}>✓</span>}
                    </div>
                    <div style={{ fontSize: 13 }}>Scala automaticamente dall'inventario</div>
                  </div>
                </div>

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
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Evasi</div>
          </div>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 10, padding: '8px 14px', flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--brand-primary)' }}>{orders.length}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Totali</div>
          </div>
        </div>
      </div>

      {/* Date filter */}
      <div style={{ padding: '8px 16px', background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        {[
          { label:'Oggi', fn:() => { const t=new Date().toISOString().split('T')[0]; setDateFrom(t); setDateTo(t) } },
          { label:'7gg', fn:() => { const t=new Date(); t.setDate(t.getDate()-7); setDateFrom(t.toISOString().split('T')[0]); setDateTo(new Date().toISOString().split('T')[0]) } },
          { label:'30gg', fn:() => { const t=new Date(); t.setDate(t.getDate()-30); setDateFrom(t.toISOString().split('T')[0]); setDateTo(new Date().toISOString().split('T')[0]) } },
          { label:'Tutti', fn:() => { setDateFrom(''); setDateTo('') } },
        ].map(p => (
          <button key={p.label} onClick={p.fn} style={{ padding:'4px 10px', borderRadius:8, border:'none', background: (!dateFrom && !dateTo && p.label==='Tutti') ? 'var(--bg-surface)' : 'transparent', fontSize:12, cursor:'pointer', color:'var(--text-secondary)', fontWeight:500 }}>{p.label}</button>
        ))}
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input" style={{ height:30, fontSize:11, width:120 }} />
        <span style={{ fontSize:11, color:'var(--text-tertiary)' }}>→</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input" style={{ height:30, fontSize:11, width:120 }} />
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

                {/* Customer info */}
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  {order.shipping_address && (
                    <>
                      <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:2 }}>
                        <span>📍</span>
                        <span style={{ fontWeight:600 }}>{order.shipping_address.name}</span>
                      </div>
                      <div style={{ color:'var(--text-tertiary)', marginLeft:20, fontSize:11, lineHeight:1.5 }}>
                        {order.shipping_address.address1}{order.shipping_address.address2 ? `, ${order.shipping_address.address2}` : ''}<br/>
                        {order.shipping_address.zip && `${order.shipping_address.zip} `}{order.shipping_address.city}{order.shipping_address.province ? ` (${order.shipping_address.province})` : ''}, {order.shipping_address.country}
                      </div>
                    </>
                  )}
                  <div style={{ display:'flex', gap:10, marginTop:4, flexWrap:'wrap' }}>
                    {(order.phone || order.shipping_address?.phone || order.customer?.phone) && (
                      <span style={{ fontSize:11, color:'var(--text-tertiary)' }}>📞 {order.shipping_address?.phone || order.phone || order.customer?.phone}</span>
                    )}
                    {order.email && (
                      <span style={{ fontSize:11, color:'var(--text-tertiary)' }}>📧 {order.email}</span>
                    )}
                  </div>
                </div>

                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10 }}>
                  {order.line_items.slice(0, 3).map(li => `${li.title} ×${li.quantity}`).join(' · ')}
                  {order.line_items.length > 3 && ` +${order.line_items.length - 3} altri`}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      📅 {new Date(order.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      🕐 {new Date(order.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  {!order.fulfillment_status && (
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: 13, padding: '8px 18px' }}
                      onClick={() => {
                        setFulfillModal(order)
                        const initialSourceId = stores[0]?.id || ''
                        setFulfillForm({ trackingCompany: '', trackingNumber: '', notifyCustomer: true, sourceType: 'store', sourceId: initialSourceId, deductStock: true })
                        setFulfillError('')
                        setSourceStockMap({})
                        // Suggerimento local delivery
                        const shTitle = order.shipping_lines?.[0]?.title?.toLowerCase() || order.tags?.toLowerCase() || ''
                        const isLocal = shTitle.includes('local') || shTitle.includes('locale') || shTitle.includes('consegna') || shTitle.includes('pickup') || shTitle.includes('ritiro')
                        let srcId = initialSourceId
                        if (isLocal && order.shipping_address?.city && stores.length > 1) {
                          const destCity = order.shipping_address.city.toLowerCase().trim()
                          const match = stores.find((s: any) => s.city?.toLowerCase().trim() === destCity)
                          if (match) {
                            setSuggestedStore(match.name + (match.city ? ` (${match.city})` : ''))
                            setFulfillForm(f => ({...f, sourceId: match.id}))
                            srcId = match.id
                          } else {
                            setSuggestedStore(stores[0].name + ' (nessun match città)')
                          }
                        } else {
                          setSuggestedStore(null)
                        }
                        if (srcId) loadSourceStock('store', srcId, order.line_items)
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
