'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmt, formatDate, categoryLabel } from '@/lib/utils'

export default function ProductsAnalyticsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [data, setData] = useState<any>(null)
  const [stores, setStores] = useState<any[]>([])
  const [selectedStore, setSelectedStore] = useState('all')
  const [period, setPeriod] = useState('week')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [period, selectedStore])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('users').select('store_id,role,stores(organization_id)').eq('id', user.id).single()
    if (profile?.role !== 'owner') { router.push('/login'); return }

    const oid = (profile.stores as any)?.organization_id
    const { data: storesData } = await supabase.from('stores').select('id,name').eq('organization_id', oid)
    setStores(storesData ?? [])

    const days = period === 'week' ? 7 : period === 'month' ? 30 : 90
    const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    const storeIds = selectedStore === 'all' ? (storesData ?? []).map(s => s.id) : [selectedStore]

    // Sales
    let salesQ = supabase.from('sales').select('id,total,payment_method,movement_type,created_at,store_id,discount_amount,customer_nationality,acquisition_channel').eq('movement_type', 'sale').gte('created_at', fromDate)
    if (selectedStore !== 'all') salesQ = salesQ.eq('store_id', selectedStore)
    else salesQ = salesQ.in('store_id', storeIds)
    const { data: sales } = await salesQ

    // Sale items with product category
    const saleIds = (sales ?? []).map(s => s.id)
    const { data: saleItems } = saleIds.length > 0
      ? await supabase.from('sale_items').select('product_name,qty,line_total,sale_id,products(category)').in('sale_id', saleIds)
      : { data: [] }

    // Resi
    let resiQ = supabase.from('sales').select('total').eq('movement_type', 'reso').gte('created_at', fromDate)
    if (selectedStore !== 'all') resiQ = resiQ.eq('store_id', selectedStore)
    else resiQ = resiQ.in('store_id', storeIds)
    const { data: resiData } = await resiQ

    // Active products
    let prodsQ = supabase.from('products').select('id,name,stock,is_active,category')
    if (selectedStore !== 'all') prodsQ = prodsQ.eq('store_id', selectedStore)
    else prodsQ = prodsQ.in('store_id', storeIds)
    const { data: products } = await prodsQ

    // Low stock
    let lowQ = supabase.from('low_stock_products').select('*')
    if (selectedStore !== 'all') lowQ = lowQ.eq('store_id', selectedStore)
    else lowQ = lowQ.in('store_id', storeIds)
    const { data: lowStock } = await lowQ

    // Inventory counts (mismatch data)
    let invQ = supabase.from('inventory_counts').select('id,store_id,finalized_at,stores(name)').eq('finalized', true).gte('finalized_at', fromDate)
    if (selectedStore !== 'all') invQ = invQ.eq('store_id', selectedStore)
    else invQ = invQ.in('store_id', storeIds)
    const { data: invCounts } = await invQ

    const invCountIds = (invCounts ?? []).map(c => c.id)
    const { data: invItems } = invCountIds.length > 0
      ? await supabase.from('inventory_count_items').select('*').in('inventory_count_id', invCountIds)
      : { data: [] }

    // Compute KPIs
    const totalRev = (sales ?? []).reduce((s, x) => s + x.total, 0)
    const totalTxn = (sales ?? []).length
    const totalQty = (saleItems ?? []).reduce((s: number, i: any) => s + i.qty, 0)
    const avgSale = totalTxn > 0 ? totalRev / totalTxn : 0
    const resoRate = totalTxn > 0 ? (resiData ?? []).length / totalTxn * 100 : 0
    const avgDiscount = totalTxn > 0 ? (sales ?? []).reduce((s, x) => s + (x.discount_amount || 0), 0) / totalTxn : 0
    const uniqueSaleIds = new Set((saleItems ?? []).map((i: any) => i.sale_id))
    const qtyPerTxn = uniqueSaleIds.size > 0 ? totalQty / uniqueSaleIds.size : 0
    const activeProducts = (products ?? []).filter(p => p.is_active).length

    // Top products
    const prodMap: Record<string, { qty: number; revenue: number }> = {}
    for (const item of (saleItems ?? [])) {
      if (!prodMap[item.product_name]) prodMap[item.product_name] = { qty: 0, revenue: 0 }
      prodMap[item.product_name].qty += item.qty
      prodMap[item.product_name].revenue += item.line_total
    }
    const topProds = Object.entries(prodMap).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 10).map(([name, d], i) => ({ rank: i + 1, name, ...d, pct: totalRev > 0 ? d.revenue / totalRev * 100 : 0 }))

    // By category
    const catMap: Record<string, number> = {}
    for (const item of (saleItems ?? [])) {
      const cat = (item.products as any)?.category || 'other'
      catMap[cat] = (catMap[cat] ?? 0) + item.line_total
    }

    // Nationality
    const natMap: Record<string, number> = {}
    for (const sale of (sales ?? [])) { const n = sale.customer_nationality || 'IT'; natMap[n] = (natMap[n] ?? 0) + 1 }
    const natTotal = Object.values(natMap).reduce((s, v) => s + v, 0)
    const nats = Object.entries(natMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, cnt]) => ({ name, pct: natTotal > 0 ? Math.round(cnt / natTotal * 100) : 0 }))

    // Acquisition channel
    const acqMap: Record<string, number> = {}
    for (const sale of (sales ?? [])) { const a = sale.acquisition_channel || 'walk-in'; acqMap[a] = (acqMap[a] ?? 0) + 1 }
    const acqTotal = Object.values(acqMap).reduce((s, v) => s + v, 0)
    const acqs = Object.entries(acqMap).sort((a, b) => b[1] - a[1]).map(([name, cnt]) => ({ name, cnt, pct: acqTotal > 0 ? Math.round(cnt / acqTotal * 100) : 0 }))

    // Inventory mismatch KPIs
    const allInvItems = invItems ?? []
    const invTotal = allInvItems.length
    const invMatch = allInvItems.filter(i => i.status === 'match').length
    const invMismatch = allInvItems.filter(i => i.status === 'mismatch' || i.status === 'escalated').length
    const invEscalated = allInvItems.filter(i => i.status === 'escalated').length
    const mismatchPct = invTotal > 0 ? (invMismatch / invTotal * 100) : 0
    const totalDiff = allInvItems.filter(i => i.status !== 'match').reduce((s, i) => s + Math.abs((i.counted_qty || 0) - (i.system_qty || 0)), 0)

    // Top discrepant products
    const discrepMap: Record<string, { count: number; totalDiff: number }> = {}
    for (const item of allInvItems.filter(i => i.status !== 'match')) {
      const name = item.product_name || 'Sconosciuto'
      if (!discrepMap[name]) discrepMap[name] = { count: 0, totalDiff: 0 }
      discrepMap[name].count++
      discrepMap[name].totalDiff += Math.abs((item.counted_qty || 0) - (item.system_qty || 0))
    }
    const topDiscrep = Object.entries(discrepMap).sort((a, b) => b[1].count - a[1].count).slice(0, 5).map(([name, d]) => ({ name, ...d }))

    // Discounts list
    const discounts = (sales ?? []).filter(s => s.discount_amount > 0)
    const totalDiscountAmt = discounts.reduce((s, x) => s + x.discount_amount, 0)

    setData({
      totalRev, totalTxn, totalQty, avgSale, resoRate, avgDiscount, qtyPerTxn, activeProducts,
      topProds, catMap, nats, acqs, lowStock: lowStock ?? [],
      invCountsN: (invCounts ?? []).length, invTotal, invMatch, invMismatch, invEscalated, mismatchPct, totalDiff,
      topDiscrep, allInvItems, invCounts: invCounts ?? [],
      totalDiscountAmt, discountCount: discounts.length,
    })
    setLoading(false)
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>Caricamento...</div>
  if (!data) return null

  const acqLabel: Record<string, string> = { 'walk-in': '🚶 Passaggio', 'social': '📱 Social', 'google': '🔍 Google', 'referral': '🗣️ Passaparola', 'shopify': '🛍️ Shopify', 'other': '❓ Altro' }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-xl)' }}>
        <div>
          <h2>📈 Prodotti & Inventario</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>Analisi vendite prodotto, stock e conteggi inventario</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="toggle-group">
            {[{ key: 'week', label: '7gg' }, { key: 'month', label: '30gg' }, { key: 'quarter', label: '90gg' }].map(p => (
              <button key={p.key} className={`toggle-option ${period === p.key ? 'active' : ''}`} onClick={() => setPeriod(p.key)}>{p.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Store tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--space-xl)', flexWrap: 'wrap' }}>
        <button onClick={() => setSelectedStore('all')} className={`badge ${selectedStore === 'all' ? 'badge-brand' : 'badge-gray'}`} style={{ cursor: 'pointer', border: 'none', padding: '6px 14px', fontSize: 13 }}>Tutti</button>
        {stores.map(s => (
          <button key={s.id} onClick={() => setSelectedStore(s.id)} className={`badge ${selectedStore === s.id ? 'badge-brand' : 'badge-gray'}`} style={{ cursor: 'pointer', border: 'none', padding: '6px 14px', fontSize: 13 }}>{s.name}</button>
        ))}
      </div>

      {/* KPI Vendite */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
        {[
          { label: 'Unità Vendute', value: data.totalQty.toString() },
          { label: 'Prodotti Attivi', value: data.activeProducts.toString() },
          { label: 'Qty Media / Txn', value: data.qtyPerTxn.toFixed(1) },
          { label: 'Sconto Medio', value: `${data.avgDiscount.toFixed(1)}%` },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">{k.value}</div>
          </div>
        ))}
      </div>

      {/* KPI Inventario */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
        {[
          { label: '📋 Conteggi', value: data.invCountsN.toString(), sub: 'finalizzati' },
          { label: '✅ Match', value: data.invMatch.toString(), sub: `${data.invTotal > 0 ? ((data.invMatch / data.invTotal) * 100).toFixed(0) : 0}%` },
          { label: '⚠️ Non-Match', value: data.invMismatch.toString(), sub: `${data.mismatchPct.toFixed(1)}%`, color: data.invMismatch > 0 ? 'var(--danger)' : 'var(--success)' },
          { label: '📊 Diff. Totale', value: `${data.totalDiff} unità`, sub: `${data.invEscalated} escalation`, color: data.totalDiff > 0 ? 'var(--warning)' : 'var(--success)' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color: (k as any).color || 'var(--text-primary)' }}>{k.value}</div>
            <div className="kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-xl)', marginBottom: 'var(--space-xl)' }}>
        {/* Top 10 Prodotti */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
            <h4>🏆 Top 10 Prodotti</h4>
            <span className="badge badge-brand">{data.topProds.length}</span>
          </div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>#</th><th>Prodotto</th><th>Qty</th><th>Revenue</th><th>%</th></tr></thead>
              <tbody>
                {data.topProds.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 20 }}>Nessun dato</td></tr>}
                {data.topProds.map((p: any) => (
                  <tr key={p.name}>
                    <td style={{ fontWeight: 700 }}>{['🥇', '🥈', '🥉'][p.rank - 1] || p.rank}</td>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td>{p.qty}</td>
                    <td style={{ fontWeight: 600 }}>{fmt(p.revenue)}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{p.pct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Vendite per Categoria */}
        <div className="card">
          <h4 style={{ marginBottom: 'var(--space-lg)' }}>📊 Revenue per Categoria</h4>
          {Object.entries(data.catMap).length === 0 ? <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Nessun dato</p> :
            Object.entries(data.catMap as Record<string, number>).sort((a, b) => b[1] - a[1]).map(([cat, rev]) => {
              const pct = data.totalRev > 0 ? (rev / data.totalRev * 100) : 0
              return (
                <div key={cat} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13 }}>{categoryLabel[cat as keyof typeof categoryLabel] || cat}</span>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{fmt(rev)} ({pct.toFixed(1)}%)</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--bg-surface-alt)', borderRadius: 4 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'var(--brand-primary)', borderRadius: 4, transition: 'width 0.3s' }} />
                  </div>
                </div>
              )
            })
          }
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-xl)', marginBottom: 'var(--space-xl)' }}>
        {/* Low Stock */}
        <div className="card" style={{ border: data.lowStock.length > 0 ? '1.5px solid var(--danger)' : undefined }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
            <h4>⚠️ Low Stock</h4>
            <span className="badge badge-danger">{data.lowStock.length} prodotti</span>
          </div>
          {data.lowStock.length === 0 ? <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Nessun prodotto in esaurimento</p> :
            data.lowStock.slice(0, 8).map((p: any) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>{p.name}</span>
                <span className="badge badge-danger" style={{ fontSize: 10 }}>{p.stock} rimasti</span>
              </div>
            ))
          }
        </div>

        {/* Canale Acquisizione */}
        <div className="card">
          <h4 style={{ marginBottom: 'var(--space-md)' }}>📡 Canale Acquisizione</h4>
          {data.acqs.map((a: any) => (
            <div key={a.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: 14 }}>{acqLabel[a.name] || a.name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 80, height: 6, background: 'var(--bg-surface-alt)', borderRadius: 3 }}>
                  <div style={{ height: '100%', width: `${a.pct}%`, background: 'var(--brand-primary)', borderRadius: 3 }} />
                </div>
                <span style={{ fontWeight: 600, minWidth: 40, textAlign: 'right' }}>{a.pct}% <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, fontSize: 11 }}>({a.cnt})</span></span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Non-Match Inventario */}
      {data.allInvItems.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--space-xl)', border: data.invMismatch > 0 ? '1.5px solid var(--warning)' : undefined }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
            <h4>⚠️ Non-Match Inventario</h4>
            <div style={{ display: 'flex', gap: 8 }}>
              <span className="badge badge-success">✅ {data.invMatch} match</span>
              <span className="badge badge-danger">❌ {data.invMismatch} non-match</span>
            </div>
          </div>

          {/* Prodotti più discrepanti */}
          {data.topDiscrep.length > 0 && (
            <div style={{ marginBottom: 'var(--space-lg)' }}>
              <h5 style={{ marginBottom: 8, fontSize: 13, color: 'var(--text-secondary)' }}>Prodotti più discrepanti</h5>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 8 }}>
                {data.topDiscrep.map((p: any) => (
                  <div key={p.name} style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--danger)' }}>{p.count} non-match · Diff: {p.totalDiff} unità</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dettaglio non-match */}
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Prodotto</th><th>Qty Sistema</th><th>Qty Contata</th><th>Diff</th><th>Stato</th><th>Motivo</th><th>Data</th></tr></thead>
              <tbody>
                {data.allInvItems.filter((i: any) => i.status !== 'match').slice(0, 20).map((item: any, idx: number) => {
                  const diff = (item.counted_qty || 0) - (item.system_qty || 0)
                  const parentCount = data.invCounts.find((c: any) => c.id === item.inventory_count_id)
                  return (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{item.product_name}</td>
                      <td>{item.system_qty}</td>
                      <td style={{ fontWeight: 600 }}>{item.counted_qty}</td>
                      <td style={{ color: diff < 0 ? 'var(--danger)' : 'var(--warning)', fontWeight: 700 }}>{diff > 0 ? '+' : ''}{diff}</td>
                      <td><span className={`badge ${item.status === 'escalated' ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: 10 }}>{item.status === 'escalated' ? '🔺 Escalato' : '❌ Mismatch'}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.mismatch_reason || '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{parentCount?.finalized_at ? formatDate(parentCount.finalized_at) : '—'} {parentCount?.stores?.name ? `· ${(parentCount.stores as any).name}` : ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Nazionalità */}
      <div className="card">
        <h4 style={{ marginBottom: 'var(--space-md)' }}>🌍 Nazionalità Clienti</h4>
        {data.nats.length === 0 ? <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Nessun dato</p> :
          data.nats.map((n: any) => (
            <div key={n.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: 14 }}>{n.name}</span>
              <span style={{ fontWeight: 600 }}>{n.pct}%</span>
            </div>
          ))
        }
      </div>
    </div>
  )
}
