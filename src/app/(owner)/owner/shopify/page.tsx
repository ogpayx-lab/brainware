'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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
  tags: string
}

const FULFILLMENT_COLORS: Record<string, string> = {
  fulfilled: 'var(--success)',
  null: 'var(--warning)',
  partial: 'var(--accent-blue)',
  restocked: 'var(--danger)',
}

export default function ShopifyOrdersPage() {
  const router = useRouter()
  const supabase = createClient()
  const [orders, setOrders] = useState<ShopifyOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notConfigured, setNotConfigured] = useState(false)
  const [filter, setFilter] = useState<'all'|'unfulfilled'|'fulfilled'>('unfulfilled')
  const [search, setSearch] = useState('')
  const [storeId, setStoreId] = useState<string|null>(null)
  const [shopifyConfig, setShopifyConfig] = useState<any>(null)
  const [stores, setStores] = useState<any[]>([])

  useEffect(() => { checkAuthAndLoad() }, [])

  async function checkAuthAndLoad() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('users').select('store_id,role,stores(organization_id,name)').eq('id', user.id).single()
    if (profile?.role !== 'owner') { router.push('/login'); return }
    setStoreId(profile.store_id)

    // Recupera tutti gli store dell'org
    const oid = (profile.stores as any)?.organization_id
    if (oid) {
      const { data: storesData } = await supabase.from('stores').select('id,name').eq('organization_id', oid)
      setStores(storesData ?? [])
    }

    // Carica config Shopify
    const { data: cfg } = await supabase.from('shopify_config').select('*').eq('store_id', profile.store_id).single()
    setShopifyConfig(cfg)

    await fetchOrders()
  }

  async function fetchOrders() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/shopify?endpoint=orders.json?status=any&limit=100')
      const json = await res.json()
      if (json.not_configured) { setNotConfigured(true); setLoading(false); return }
      if (json.error) { setError(json.error); setLoading(false); return }
      setOrders(json.orders ?? [])
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  const filtered = orders.filter(o => {
    const matchFilter = filter === 'all' || (filter === 'unfulfilled' && !o.fulfillment_status) || (filter === 'fulfilled' && o.fulfillment_status === 'fulfilled')
    const matchSearch = !search || o.name.toLowerCase().includes(search.toLowerCase()) || o.email?.toLowerCase().includes(search.toLowerCase()) || o.shipping_address?.name?.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  const pending = orders.filter(o => !o.fulfillment_status).length

  if (notConfigured) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
      <div className="card" style={{ maxWidth:440, textAlign:'center', padding:40 }}>
        <div style={{ fontSize:48, marginBottom:16 }}>🛍️</div>
        <h3 style={{ marginBottom:8 }}>Shopify non configurato</h3>
        <p style={{ color:'var(--text-secondary)', fontSize:14, marginBottom:20 }}>
          Collega il tuo store Shopify per visualizzare e gestire gli ordini direttamente da BrainWare.
        </p>
        <button className="btn btn-primary" onClick={() => router.push('/owner/settings?tab=shopify')}>
          ⚙️ Configura Shopify
        </button>
      </div>
    </div>
  )

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'var(--space-xl)' }}>
        <div>
          <h2>🛍️ Ordini Shopify</h2>
          <p style={{ color:'var(--text-secondary)', fontSize:14, marginTop:4 }}>
            {shopifyConfig?.shopify_domain || 'Store non configurato'}
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-secondary" onClick={fetchOrders} style={{ fontSize:12 }}>🔄 Aggiorna</button>
          <button className="btn btn-secondary" onClick={() => router.push('/owner/settings?tab=shopify')} style={{ fontSize:12 }}>⚙️ Impostazioni</button>
        </div>
      </div>

      {/* KPI */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'var(--space-md)', marginBottom:'var(--space-xl)' }}>
        {[
          { label:'Ordini Totali', value: orders.length.toString(), color:'var(--text-primary)' },
          { label:'Da Evadere', value: pending.toString(), color:'var(--warning)' },
          { label:'Completati', value: orders.filter(o => o.fulfillment_status === 'fulfilled').length.toString(), color:'var(--success)' },
          { label:'Revenue Totale', value: `€${orders.reduce((s,o) => s + parseFloat(o.total_price||'0'), 0).toFixed(2)}`, color:'var(--brand-primary)' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {error && <div style={{ background:'#FEF2F2', border:'1px solid var(--danger)', borderRadius:8, padding:12, marginBottom:16, color:'var(--danger)', fontSize:13 }}>{error}</div>}

      {/* Filtri */}
      <div style={{ display:'flex', gap:10, marginBottom:'var(--space-lg)', alignItems:'center' }}>
        <div style={{ display:'flex', background:'var(--bg-surface)', borderRadius:10, padding:3, gap:3 }}>
          {(['unfulfilled','fulfilled','all'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding:'6px 14px', borderRadius:8, border:'none', background: filter===f ? 'var(--bg-primary)' : 'transparent', fontWeight: filter===f ? 600 : 400, color: filter===f ? 'var(--text-primary)' : 'var(--text-secondary)', cursor:'pointer', fontSize:13 }}>
              {f === 'unfulfilled' ? `⏳ Da evadere (${pending})` : f === 'fulfilled' ? '✅ Completati' : '📋 Tutti'}
            </button>
          ))}
        </div>
        <input className="input" placeholder="Cerca per ordine, email, nome..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex:1, height:36 }} />
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'var(--space-xl)', color:'var(--text-secondary)' }}>Caricamento ordini da Shopify...</div>
      ) : (
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          {filtered.length === 0 && (
            <div style={{ padding:'var(--space-xl)', textAlign:'center', color:'var(--text-tertiary)', fontSize:14 }}>
              {filter === 'unfulfilled' ? '🎉 Nessun ordine da evadere!' : 'Nessun ordine trovato.'}
            </div>
          )}
          {filtered.map((order, i) => (
            <div key={order.id} style={{ padding:'var(--space-md) var(--space-lg)', borderBottom: i < filtered.length-1 ? '1px solid var(--border-subtle)' : 'none' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <span style={{ fontWeight:700, fontSize:14 }}>{order.name}</span>
                    <span className="badge badge-gray" style={{ fontSize:10 }}>
                      {order.financial_status === 'paid' ? '💳 Pagato' : order.financial_status}
                    </span>
                    <span style={{ padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:600, background: (!order.fulfillment_status) ? '#FEF3C7' : '#D1FAE5', color: (!order.fulfillment_status) ? '#92400E' : '#065F46' }}>
                      {order.fulfillment_status ? '✅ Evaso' : '⏳ Da evadere'}
                    </span>
                  </div>
                  <div style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:4 }}>
                    {order.shipping_address ? `📍 ${order.shipping_address.name} — ${order.shipping_address.city}, ${order.shipping_address.country}` : order.email}
                  </div>
                  <div style={{ fontSize:12, color:'var(--text-tertiary)' }}>
                    {order.line_items.slice(0,3).map(li => `${li.title} (x${li.quantity})`).join(' · ')}
                    {order.line_items.length > 3 && ` +${order.line_items.length - 3} altri`}
                  </div>
                  {/* Assegnazione store: quale punto evade l'ordine */}
                  {stores.length > 1 && (
                    <div style={{ marginTop:6, display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:11, color:'var(--text-tertiary)' }}>📦 Evadi da:</span>
                      <select className="input" style={{ height:26, fontSize:11, padding:'2px 6px', width:'auto' }}>
                        {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontWeight:700, fontSize:16, color:'var(--brand-primary)' }}>€{parseFloat(order.total_price).toFixed(2)}</div>
                  <div style={{ fontSize:11, color:'var(--text-tertiary)', marginTop:2 }}>
                    {new Date(order.created_at).toLocaleDateString('it-IT', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                  </div>
                  {!order.fulfillment_status && (
                    <button className="btn btn-primary" style={{ marginTop:8, fontSize:11, padding:'4px 12px' }}>
                      Evadi ordine →
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
