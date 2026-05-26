'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/lib/i18n'

type ShopifyOrder = {
  id: number
  name: string
  created_at: string
  financial_status: string
  fulfillment_status: string | null
  total_price: string
  currency: string
  line_items: { title: string; quantity: number; price: string; sku?: string }[]
  shipping_lines?: { title: string; code: string; price: string }[]
  shipping_address?: { name: string; address1: string; address2?: string; city: string; province?: string; zip?: string; country: string; phone?: string }
  billing_address?: { name: string; address1: string; city: string; country: string; phone?: string }
  customer?: { first_name: string; last_name: string; email: string; phone?: string }
  email: string
  phone?: string
  tags: string
  note?: string
  gateway?: string
  payment_gateway_names?: string[]
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
  const t = useT()
  const [orders, setOrders] = useState<ShopifyOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notConfigured, setNotConfigured] = useState(false)
  const [filter, setFilter] = useState<'all'|'unfulfilled'|'fulfilled'>('unfulfilled')
  const [search, setSearch] = useState('')
  const [storeId, setStoreId] = useState<string|null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [shopifyConfig, setShopifyConfig] = useState<any>(null)
  const [stores, setStores] = useState<any[]>([])
  const [accessToken, setAccessToken] = useState<string|null>(null)
  const [fulfillModal, setFulfillModal] = useState<ShopifyOrder|null>(null)
  const [fulfilling, setFulfilling] = useState(false)
  const [fulfillForm, setFulfillForm] = useState({ trackingCompany:'', trackingNumber:'', notifyCustomer:true, sourceType:'store' as 'store'|'warehouse', sourceId:'', deductStock:true })
  const [fulfillError, setFulfillError] = useState('')
  const [fulfillSuccess, setFulfillSuccess] = useState('')
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [suggestedStore, setSuggestedStore] = useState<string|null>(null)
  const [sourceStockMap, setSourceStockMap] = useState<Record<string,{qty:number;matchedId:string|null;matchType:string}>>({})
  const [loadingStock, setLoadingStock] = useState(false)

  useEffect(() => { checkAuthAndLoad() }, [])

  async function getAuthHeader() {
    // Use saved token, or get fresh session as fallback
    let token = accessToken
    if (!token) {
      const { data: { session } } = await supabase.auth.getSession()
      token = session?.access_token ?? null
    }
    return {
      'Authorization': `Bearer ${token ?? ''}`,
      'Content-Type': 'application/json',
    }
  }

  async function checkAuthAndLoad() {
    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('users').select('store_id,role,stores(organization_id,name)').eq('id', user.id).single()
    if (profile?.role !== 'owner') { router.push('/login'); return }
    setStoreId(profile.store_id)

    // Salva il token e passa direttamente a fetchOrders (evita race condition React state)
    const token = session?.access_token ?? ''
    if (token) setAccessToken(token)

    // Recupera tutti gli store dell'org
    const oid = (profile.stores as any)?.organization_id
    if (oid) {
      const { data: storesData } = await supabase.from('stores').select('id,name,city').eq('organization_id', oid)
      setStores(storesData ?? [])

      // Load warehouses
      const { data: whData } = await supabase.from('warehouses').select('id,name,type').eq('organization_id', oid).eq('is_active', true)
      setWarehouses(whData ?? [])
    }

    // Carica config Shopify
    const { data: cfg } = await supabase.from('shopify_config').select('*').eq('store_id', profile.store_id).single()
    setShopifyConfig(cfg)

    await fetchOrders(token)
  }

  async function fetchOrders(token?: string) {
    setLoading(true); setError('')
    const authToken = token ?? accessToken ?? ''
    try {
      const res = await fetch('/api/shopify?endpoint=orders.json%3Fstatus%3Dany%26limit%3D100', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
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

  // Smart product matching: tries multiple strategies to find the local product
  async function findLocalProduct(sourceType: 'store'|'warehouse', sourceId: string, shopifyTitle: string, shopifySku?: string): Promise<{id:string;qty:number;matchType:string}|null> {
    const name = shopifyTitle.toLowerCase().trim()
    const words = name.split(/[\s\-–_,./()]+/).filter(w => w.length > 2 && !/^\d+$/.test(w))

    if (sourceType === 'warehouse') {
      let { data } = await supabase.from('warehouse_stock').select('id,qty,product_name').eq('warehouse_id', sourceId).ilike('product_name', name).single()
      if (data) return { id: data.id, qty: data.qty, matchType: 'esatto' }
      if (shopifySku) {
        ;({ data } = await supabase.from('warehouse_stock').select('id,qty,product_name').eq('warehouse_id', sourceId).ilike('product_name', `%${shopifySku}%`).single())
        if (data) return { id: data.id, qty: data.qty, matchType: 'SKU' }
      }
      ;({ data } = await supabase.from('warehouse_stock').select('id,qty,product_name').eq('warehouse_id', sourceId).ilike('product_name', `%${name}%`).single())
      if (data) return { id: data.id, qty: data.qty, matchType: 'contiene' }
      for (const word of words) {
        const { data: items } = await supabase.from('warehouse_stock').select('id,qty,product_name').eq('warehouse_id', sourceId).ilike('product_name', `%${word}%`)
        if (items && items.length === 1) return { id: items[0].id, qty: items[0].qty, matchType: `parola "${word}"` }
      }
      return null
    } else {
      let { data } = await supabase.from('products').select('id,stock,name,barcode').eq('store_id', sourceId).eq('is_active', true).ilike('name', name).single()
      if (data) return { id: data.id, qty: data.stock, matchType: 'esatto' }
      if (shopifySku) {
        ;({ data } = await supabase.from('products').select('id,stock,name,barcode').eq('store_id', sourceId).eq('is_active', true).eq('barcode', shopifySku).single())
        if (data) return { id: data.id, qty: data.stock, matchType: 'SKU/barcode' }
      }
      ;({ data } = await supabase.from('products').select('id,stock,name,barcode').eq('store_id', sourceId).eq('is_active', true).ilike('name', `%${name}%`).single())
      if (data) return { id: data.id, qty: data.stock, matchType: 'contiene' }
      for (const word of words) {
        const { data: items } = await supabase.from('products').select('id,stock,name,barcode').eq('store_id', sourceId).eq('is_active', true).ilike('name', `%${word}%`)
        if (items && items.length === 1) return { id: items[0].id, qty: items[0].stock, matchType: `parola "${word}"` }
      }
      return null
    }
  }

  async function loadSourceStock(sourceType: 'store'|'warehouse', sourceId: string, lineItems: {title:string;quantity:number;sku?:string}[]) {
    if (!sourceId) { setSourceStockMap({}); return }
    setLoadingStock(true)
    const map: Record<string,{qty:number;matchedId:string|null;matchType:string}> = {}
    for (const li of lineItems) {
      const match = await findLocalProduct(sourceType, sourceId, li.title, li.sku)
      if (match) {
        map[li.title] = { qty: match.qty, matchedId: match.id, matchType: match.matchType }
      } else {
        map[li.title] = { qty: -1, matchedId: null, matchType: 'non trovato' }
      }
    }
    setSourceStockMap(map)
    setLoadingStock(false)
  }

  async function fulfillOrder() {
    if (!fulfillModal) return
    setFulfilling(true); setFulfillError('')
    const token = accessToken ?? (await supabase.auth.getSession()).data.session?.access_token ?? ''
    try {
      const res = await fetch('/api/shopify', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: fulfillModal.id,
          trackingCompany: fulfillForm.trackingCompany || null,
          trackingNumber: fulfillForm.trackingNumber || null,
          notifyCustomer: fulfillForm.notifyCustomer,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setFulfillError(json.error || `Errore ${res.status}`)
        setFulfilling(false)
        return
      }
      // Aggiorna l'ordine nella lista
      setOrders(prev => prev.map(o => o.id === fulfillModal.id ? { ...o, fulfillment_status: 'fulfilled' } : o))

      // Register sale in BrainWare
      const saleStoreId = fulfillForm.sourceType === 'store' ? fulfillForm.sourceId : (storeId || stores[0]?.id)
      if (saleStoreId) {
        const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
        const paymentMethod = (fulfillModal.payment_gateway_names?.[0] || fulfillModal.gateway || '').toLowerCase()
        const pmMapped = paymentMethod.includes('cash') || paymentMethod.includes('cod') ? 'cash' : 'pos'

        await supabase.from('sales').insert({
          store_id: saleStoreId,
          user_id: user?.id,
          movement_type: 'sale',
          payment_method: pmMapped,
          subtotal: parseFloat(fulfillModal.total_price),
          total: parseFloat(fulfillModal.total_price),
          acquisition_channel: 'shopify',
          customer_name: fulfillModal.shipping_address?.name || fulfillModal.email || null,
          customer_email: fulfillModal.email || null,
        })

        // Register sale_items
        await supabase.from('sale_items').insert(
          fulfillModal.line_items.map(li => ({
            product_name: li.title,
            qty: li.quantity,
            unit_price: parseFloat(li.price),
            line_total: li.quantity * parseFloat(li.price),
          }))
        ).then(() => {}) // fire and forget
      }

      // Deduct stock if enabled (usa ID già matchati)
      if (fulfillForm.deductStock && fulfillForm.sourceId) {
        for (const li of fulfillModal.line_items) {
          const stockInfo = sourceStockMap[li.title]
          if (stockInfo?.matchedId) {
            if (fulfillForm.sourceType === 'warehouse') {
              const { data: whItem } = await supabase.from('warehouse_stock').select('qty').eq('id', stockInfo.matchedId).single()
              if (whItem) await supabase.from('warehouse_stock').update({ qty: Math.max(0, whItem.qty - li.quantity) }).eq('id', stockInfo.matchedId)
            } else {
              const { data: prod } = await supabase.from('products').select('stock').eq('id', stockInfo.matchedId).single()
              if (prod) await supabase.from('products').update({ stock: Math.max(0, prod.stock - li.quantity) }).eq('id', stockInfo.matchedId)
            }
          } else {
            const match = await findLocalProduct(fulfillForm.sourceType, fulfillForm.sourceId, li.title, li.sku)
            if (match) {
              if (fulfillForm.sourceType === 'warehouse') {
                await supabase.from('warehouse_stock').update({ qty: Math.max(0, match.qty - li.quantity) }).eq('id', match.id)
              } else {
                await supabase.from('products').update({ stock: Math.max(0, match.qty - li.quantity) }).eq('id', match.id)
              }
            }
          }
        }
      }

      setFulfillSuccess(`✅ Ordine ${fulfillModal.name} evaso con successo!`)
      setTimeout(() => { setFulfillModal(null); setFulfillSuccess('') }, 2000)
    } catch (e: any) {
      setFulfillError(e.message)
    }
    setFulfilling(false)
  }

  const filtered = orders.filter(o => {
    const matchFilter = filter === 'all' || (filter === 'unfulfilled' && !o.fulfillment_status) || (filter === 'fulfilled' && o.fulfillment_status === 'fulfilled')
    const matchSearch = !search || o.name.toLowerCase().includes(search.toLowerCase()) || o.email?.toLowerCase().includes(search.toLowerCase()) || o.shipping_address?.name?.toLowerCase().includes(search.toLowerCase())
    const orderDate = o.created_at?.split('T')[0] || ''
    const matchFrom = !dateFrom || orderDate >= dateFrom
    const matchTo = !dateTo || orderDate <= dateTo
    return matchFilter && matchSearch && matchFrom && matchTo
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
          <h2>{t('sidebar.shopify')}</h2>
          <p style={{ color:'var(--text-secondary)', fontSize:14, marginTop:4 }}>
            {shopifyConfig?.shopify_domain || 'mamamarycannabis.myshopify.com'}
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-secondary" onClick={() => fetchOrders()} style={{ fontSize:12 }}>🔄 Aggiorna</button>
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

      {/* Date filter */}
      <div style={{ display:'flex', gap:10, marginBottom:'var(--space-md)', alignItems:'center', flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:4 }}>
          {[
            { label:'Oggi', fn:() => { const t=new Date().toISOString().split('T')[0]; setDateFrom(t); setDateTo(t) } },
            { label:'7gg', fn:() => { const t=new Date(); t.setDate(t.getDate()-7); setDateFrom(t.toISOString().split('T')[0]); setDateTo(new Date().toISOString().split('T')[0]) } },
            { label:'30gg', fn:() => { const t=new Date(); t.setDate(t.getDate()-30); setDateFrom(t.toISOString().split('T')[0]); setDateTo(new Date().toISOString().split('T')[0]) } },
            { label:'Tutti', fn:() => { setDateFrom(''); setDateTo('') } },
          ].map(p => (
            <button key={p.label} onClick={p.fn} className="btn btn-ghost" style={{ fontSize:11, padding:'4px 10px', background: (!dateFrom && !dateTo && p.label==='Tutti') ? 'var(--bg-surface)' : 'transparent' }}>{p.label}</button>
          ))}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input" style={{ height:32, fontSize:12, width:140 }} />
          <span style={{ fontSize:12, color:'var(--text-tertiary)' }}>→</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input" style={{ height:32, fontSize:12, width:140 }} />
        </div>
      </div>

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
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4, flexWrap:'wrap' }}>
                    <span style={{ fontWeight:700, fontSize:14 }}>{order.name}</span>
                    <span className="badge badge-gray" style={{ fontSize:10 }}>
                      {order.financial_status === 'paid' ? '💳 Pagato' : order.financial_status === 'pending' ? '⏳ In attesa' : order.financial_status === 'refunded' ? '↩️ Rimborsato' : order.financial_status}
                    </span>
                    {(() => {
                      const gw = (order.payment_gateway_names?.[0] || order.gateway || '').toLowerCase()
                      let icon = '💳'; let label = gw || 'N/D'
                      if (gw.includes('paypal')) { icon = '🌍'; label = 'PayPal' }
                      else if (gw.includes('shopify_payments') || gw.includes('shopify payments')) { icon = '💳'; label = 'Shopify Pay' }
                      else if (gw.includes('bank') || gw.includes('bonifico') || gw.includes('transfer') || gw.includes('deposit')) { icon = '🏦'; label = 'Bonifico' }
                      else if (gw.includes('manual') || gw === '') { icon = '🏦'; label = 'Manuale' }
                      else if (gw.includes('cash') || gw.includes('contanti') || gw.includes('contrassegno') || gw.includes('cod')) { icon = '💵'; label = 'Contrassegno' }
                      else if (gw.includes('stripe') || gw.includes('card') || gw.includes('carta') || gw.includes('credit')) { icon = '💳'; label = 'Carta' }
                      else if (gw.includes('apple')) { icon = '🍏'; label = 'Apple Pay' }
                      else if (gw.includes('google')) { icon = '🔵'; label = 'Google Pay' }
                      else if (gw.includes('klarna') || gw.includes('scalapay')) { icon = '🔄'; label = label.charAt(0).toUpperCase() + label.slice(1) }
                      else if (gw) { label = gw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }
                      return (
                        <span title={gw} style={{ padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:600, background: icon === '🏦' ? '#DBEAFE' : '#F3F4F6', color: icon === '🏦' ? '#1E40AF' : '#374151' }}>
                          {icon} {label}
                        </span>
                      )
                    })()}
                    <span style={{ padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:600, background: (!order.fulfillment_status) ? '#FEF3C7' : '#D1FAE5', color: (!order.fulfillment_status) ? '#92400E' : '#065F46' }}>
                      {order.fulfillment_status ? '✅ Evaso' : '⏳ Da evadere'}
                    </span>
                    {(() => {
                      const shippingTitle = order.shipping_lines?.[0]?.title?.toLowerCase() || order.tags?.toLowerCase() || ''
                      const isLocal = shippingTitle.includes('local') || shippingTitle.includes('locale') || shippingTitle.includes('consegna') || shippingTitle.includes('pickup') || shippingTitle.includes('ritiro')
                      return (
                        <span style={{ padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:600, background: isLocal ? '#EDE9FE' : '#DBEAFE', color: isLocal ? '#5B21B6' : '#1E40AF', display:'flex', alignItems:'center', gap:3 }}>
                          {isLocal ? '🚴 Local Delivery' : '🚚 Spedizione'}
                          {order.shipping_lines?.[0]?.title && !isLocal && <span style={{ fontWeight:400 }}> · {order.shipping_lines[0].title}</span>}
                        </span>
                      )
                    })()}
                  </div>
                  {/* Customer info */}
                  <div style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:6 }}>
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
                    <div style={{ display:'flex', gap:12, marginTop:4, flexWrap:'wrap' }}>
                      {(order.phone || order.shipping_address?.phone || order.customer?.phone) && (
                        <span style={{ fontSize:11, color:'var(--text-tertiary)' }}>📞 {order.shipping_address?.phone || order.phone || order.customer?.phone}</span>
                      )}
                      {order.email && (
                        <span style={{ fontSize:11, color:'var(--text-tertiary)' }}>📧 {order.email}</span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize:12, color:'var(--text-tertiary)' }}>
                    {order.line_items.slice(0,3).map(li => `${li.title} (x${li.quantity})`).join(' · ')}
                    {order.line_items.length > 3 && ` +${order.line_items.length - 3} altri`}
                  </div>
                  {order.note && (
                    <div style={{ fontSize:11, color:'var(--warning)', marginTop:4 }}>📝 Nota: {order.note}</div>
                  )}
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
                  <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:2 }}>
                    📅 {new Date(order.created_at).toLocaleDateString('it-IT', { day:'2-digit', month:'short', year:'numeric' })}
                  </div>
                  <div style={{ fontSize:12, color:'var(--text-tertiary)' }}>
                    🕐 {new Date(order.created_at).toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit' })}
                  </div>
                  {!order.fulfillment_status && (
                    <button
                      className="btn btn-primary"
                      style={{ marginTop:8, fontSize:11, padding:'4px 12px', background:'var(--brand-primary)' }}
                      onClick={() => {
                        setFulfillModal(order)
                        setFulfillForm({ trackingCompany:'', trackingNumber:'', notifyCustomer:true, sourceType:'store', sourceId: stores[0]?.id || '', deductStock:true })
                        setFulfillError('')
                        setSourceStockMap({})
                        // Suggest nearest store for local delivery
                        const shTitle = order.shipping_lines?.[0]?.title?.toLowerCase() || order.tags?.toLowerCase() || ''
                        const isLocal = shTitle.includes('local') || shTitle.includes('locale') || shTitle.includes('consegna') || shTitle.includes('pickup') || shTitle.includes('ritiro')
                        let initialSourceId = stores[0]?.id || ''
                        if (isLocal && order.shipping_address?.city && stores.length > 1) {
                          const destCity = order.shipping_address.city.toLowerCase().trim()
                          const match = stores.find(s => s.city?.toLowerCase().trim() === destCity)
                          if (match) {
                            setSuggestedStore(match.name + (match.city ? ` (${match.city})` : ''))
                            setFulfillForm(f => ({...f, sourceId: match.id}))
                            initialSourceId = match.id
                          } else {
                            setSuggestedStore(stores[0].name + ' (nessun match città)')
                          }
                        } else {
                          setSuggestedStore(null)
                        }
                        // Auto-load stock for initial source
                        if (initialSourceId) loadSourceStock('store', initialSourceId, order.line_items)
                      }}
                    >
                      📦 Evadi ordine →
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Modal Evasione Ordine */}
      {fulfillModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }}>
          <div style={{ background:'var(--bg-primary)', borderRadius:16, padding:32, width:'100%', maxWidth:480, boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>

            {fulfillSuccess ? (
              <div style={{ textAlign:'center', padding:'20px 0' }}>
                <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
                <h3 style={{ color:'var(--success)' }}>{fulfillSuccess}</h3>
              </div>
            ) : (
              <>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
                  <div>
                    <h3 style={{ margin:0 }}>📦 Evadi Ordine</h3>
                    <div style={{ fontSize:14, color:'var(--text-secondary)', marginTop:4 }}>{fulfillModal.name} · €{parseFloat(fulfillModal.total_price).toFixed(2)}</div>
                  </div>
                  <button onClick={() => setFulfillModal(null)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'var(--text-tertiary)' }}>×</button>
                </div>

                {/* Prodotti */}
                <div style={{ background:'var(--bg-surface)', borderRadius:10, padding:12, marginBottom:16 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--text-secondary)', marginBottom:8 }}>ARTICOLI</div>
                  {fulfillModal.line_items.map((li, i) => {
                    const stockInfo = sourceStockMap[li.title]
                    const hasMatch = stockInfo && stockInfo.matchedId !== null
                    const notFound = stockInfo && stockInfo.matchedId === null
                    const enough = hasMatch && stockInfo.qty >= li.quantity
                    return (
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:13, padding:'6px 0', borderBottom: i < fulfillModal.line_items.length-1 ? '1px solid var(--border-subtle)' : 'none' }}>
                        <div style={{ flex:1 }}>
                          <div>{li.title}</div>
                          {fulfillForm.deductStock && hasMatch && (
                            <div style={{ fontSize:11, fontWeight:600, marginTop:2 }}>
                              <span style={{ color: enough ? 'var(--success)' : 'var(--danger)' }}>
                                {enough ? `✅ Disponibile: ${stockInfo.qty}` : `⚠️ Disponibile: ${stockInfo.qty} (servono ${li.quantity})`}
                              </span>
                              <span style={{ color:'var(--text-tertiary)', fontWeight:400, marginLeft:6, fontSize:10 }}>
                                match: {stockInfo.matchType}
                              </span>
                            </div>
                          )}
                          {fulfillForm.deductStock && notFound && (
                            <div style={{ fontSize:11, color:'#f59e0b', fontWeight:600, marginTop:2 }}>
                              ❌ Prodotto non trovato nell'inventario — non verrà scalato
                            </div>
                          )}
                        </div>
                        <span style={{ fontWeight:600, flexShrink:0 }}>×{li.quantity}</span>
                      </div>
                    )
                  })}
                </div>

                {/* Destinatario */}
                <div style={{ background:'var(--bg-surface)', borderRadius:10, padding:12, marginBottom:16 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--text-secondary)', marginBottom:6 }}>DESTINATARIO</div>
                  {fulfillModal.shipping_address && (
                    <>
                      <div style={{ fontSize:14, fontWeight:600, marginBottom:2 }}>📍 {fulfillModal.shipping_address.name}</div>
                      <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.6 }}>
                        {fulfillModal.shipping_address.address1}{fulfillModal.shipping_address.address2 ? `, ${fulfillModal.shipping_address.address2}` : ''}<br/>
                        {fulfillModal.shipping_address.zip && `${fulfillModal.shipping_address.zip} `}{fulfillModal.shipping_address.city}{fulfillModal.shipping_address.province ? ` (${fulfillModal.shipping_address.province})` : ''}, {fulfillModal.shipping_address.country}
                      </div>
                    </>
                  )}
                  <div style={{ display:'flex', gap:14, marginTop:8, flexWrap:'wrap' }}>
                    {(fulfillModal.phone || fulfillModal.shipping_address?.phone || fulfillModal.customer?.phone) && (
                      <div style={{ fontSize:12, color:'var(--text-secondary)' }}>📞 {fulfillModal.shipping_address?.phone || fulfillModal.phone || fulfillModal.customer?.phone}</div>
                    )}
                    {fulfillModal.email && (
                      <div style={{ fontSize:12, color:'var(--text-secondary)' }}>📧 {fulfillModal.email}</div>
                    )}
                  </div>
                </div>

                {/* Local Delivery Suggestion */}
                {suggestedStore && (
                  <div style={{ background:'#EDE9FE', border:'1px solid #A78BFA', borderRadius:10, padding:12, marginBottom:16, fontSize:13 }}>
                    <div style={{ fontWeight:700, color:'#5B21B6', marginBottom:4 }}>📍 Store suggerito per Local Delivery</div>
                    <div style={{ color:'#6D28D9' }}>{suggestedStore} — lo store più vicino all'indirizzo di consegna</div>
                  </div>
                )}

                {/* Source: from which warehouse/store to deduct */}
                <div style={{ background:'var(--bg-surface)', borderRadius:10, padding:12, marginBottom:16 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--text-secondary)', marginBottom:8 }}>📦 SORGENTE INVENTARIO</div>
                  <div style={{ display:'flex', gap:6, marginBottom:10 }}>
                    <button onClick={() => { setFulfillForm(f => ({...f, sourceType:'store', sourceId:stores[0]?.id||''})); if (fulfillModal) loadSourceStock('store', stores[0]?.id||'', fulfillModal.line_items) }} style={{ flex:1, padding:'6px 10px', borderRadius:8, border:'none', background: fulfillForm.sourceType==='store' ? 'var(--brand-primary)' : 'var(--bg-primary)', color: fulfillForm.sourceType==='store' ? 'white' : 'var(--text-secondary)', cursor:'pointer', fontSize:12, fontWeight:600 }}>
                      🏠 Store
                    </button>
                    <button onClick={() => { setFulfillForm(f => ({...f, sourceType:'warehouse', sourceId:warehouses[0]?.id||''})); if (fulfillModal) loadSourceStock('warehouse', warehouses[0]?.id||'', fulfillModal.line_items) }} style={{ flex:1, padding:'6px 10px', borderRadius:8, border:'none', background: fulfillForm.sourceType==='warehouse' ? 'var(--brand-primary)' : 'var(--bg-primary)', color: fulfillForm.sourceType==='warehouse' ? 'white' : 'var(--text-secondary)', cursor:'pointer', fontSize:12, fontWeight:600 }}>
                      🏭 Magazzino
                    </button>
                  </div>
                  <select className="input" value={fulfillForm.sourceId} onChange={e => { setFulfillForm(f => ({...f, sourceId:e.target.value})); if (fulfillModal) loadSourceStock(fulfillForm.sourceType, e.target.value, fulfillModal.line_items) }} style={{ height:36, fontSize:13, marginBottom:8 }}>
                    <option value="">Seleziona {fulfillForm.sourceType === 'store' ? 'store' : 'magazzino'}...</option>
                    {fulfillForm.sourceType === 'store'
                      ? stores.map(s => <option key={s.id} value={s.id}>{s.name}{s.city ? ` (${s.city})` : ''}</option>)
                      : warehouses.map(w => <option key={w.id} value={w.id}>{w.type === 'central' ? '🏭' : '📦'} {w.name}</option>)
                    }
                  </select>
                  <div style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }} onClick={() => setFulfillForm(f => ({...f, deductStock:!f.deductStock}))}>
                    <div style={{ width:18, height:18, borderRadius:4, border:`2px solid ${fulfillForm.deductStock ? 'var(--brand-primary)' : 'var(--border-default)'}`, background:fulfillForm.deductStock ? 'var(--brand-primary)' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {fulfillForm.deductStock && <span style={{ color:'white', fontSize:11, fontWeight:700 }}>✓</span>}
                    </div>
                    <div style={{ fontSize:12 }}>Scala automaticamente dall'inventario</div>
                  </div>
                </div>

                {/* Tracking */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:'var(--text-secondary)', display:'block', marginBottom:4 }}>Corriere (opzionale)</label>
                    <input className="input" placeholder="Es: GLS, DHL..." value={fulfillForm.trackingCompany} onChange={e => setFulfillForm(f => ({...f, trackingCompany:e.target.value}))} style={{ height:36, fontSize:13 }} />
                  </div>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:'var(--text-secondary)', display:'block', marginBottom:4 }}>N° Tracking (opzionale)</label>
                    <input className="input" placeholder="Es: 1Z999AA1..." value={fulfillForm.trackingNumber} onChange={e => setFulfillForm(f => ({...f, trackingNumber:e.target.value}))} style={{ height:36, fontSize:13 }} />
                  </div>
                </div>

                {/* Notifica cliente */}
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20, padding:12, background:'var(--bg-surface)', borderRadius:10, cursor:'pointer' }} onClick={() => setFulfillForm(f => ({...f, notifyCustomer:!f.notifyCustomer}))}>
                  <div style={{ width:20, height:20, borderRadius:5, border:`2px solid ${fulfillForm.notifyCustomer ? 'var(--brand-primary)' : 'var(--border-default)'}`, background:fulfillForm.notifyCustomer ? 'var(--brand-primary)' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    {fulfillForm.notifyCustomer && <span style={{ color:'white', fontSize:12, fontWeight:700 }}>✓</span>}
                  </div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600 }}>📧 Notifica il cliente</div>
                    <div style={{ fontSize:11, color:'var(--text-secondary)' }}>Shopify invierà un&apos;email di conferma spedizione</div>
                  </div>
                </div>

                {/* Registrazione vendita info */}
                <div style={{ background:'#F0FDF4', border:'1px solid var(--success)', borderRadius:8, padding:10, marginBottom:16, fontSize:12, color:'#166534' }}>
                  📊 La vendita verrà registrata automaticamente come <strong>canale Shopify</strong> nelle vendite giornaliere.
                </div>

                {fulfillError && <div style={{ background:'#FEF2F2', border:'1px solid var(--danger)', borderRadius:8, padding:10, marginBottom:12, fontSize:13, color:'var(--danger)' }}>⚠️ {fulfillError}</div>}

                <div style={{ display:'flex', gap:10 }}>
                  <button className="btn btn-secondary" style={{ flex:1 }} onClick={() => setFulfillModal(null)}>{t('cancel')}</button>
                  <button className="btn btn-primary" style={{ flex:2, background:'var(--brand-primary)' }} onClick={fulfillOrder} disabled={fulfilling}>
                    {fulfilling ? '⏳ Evasione in corso...' : '✅ Conferma Evasione'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
