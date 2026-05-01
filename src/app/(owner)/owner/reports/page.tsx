'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmt, formatDate } from '@/lib/utils'

interface DayRow {
  date: string
  cash: number
  pos: number
  total: number
  txn: number
  deposit: number
  shopify: number
  shopifyTxn: number
}

export default function LiveReportPage() {
  const router = useRouter()
  const supabase = createClient()
  const [sales, setSales] = useState<any[]>([])
  const [stores, setStores] = useState<any[]>([])
  const [viewMode, setViewMode] = useState<'aggregate'|'per-store'>('aggregate')
  const [storeId, setStoreId] = useState<string|null>(null)
  const [fromDate, setFromDate] = useState(() => new Date().toISOString().split('T')[0])
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)
  const [saleItems, setSaleItems] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'overview'|'products'>('overview')

  useEffect(() => { loadData() }, [fromDate, toDate])

  async function loadData() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('users').select('store_id, role, stores(organization_id)').eq('id', user.id).single()
    if (profile?.role !== 'owner') { router.push('/login'); return }
    setStoreId(profile.store_id)

    const oid = (profile.stores as any)?.organization_id
    const { data: storesData } = await supabase.from('stores').select('id,name').eq('organization_id', oid)
    setStores(storesData ?? [])
    const storeIds = (storesData ?? []).map(s => s.id)

    const { data: s } = await supabase
      .from('sales')
      .select('*, sale_items(product_name, qty, unit_price, line_total)')
      .in('store_id', storeIds)
      .gte('created_at', fromDate + 'T00:00:00')
      .lte('created_at', toDate + 'T23:59:59')
      .order('created_at', { ascending: false })

    setSales(s ?? [])
    const items = (s ?? []).flatMap(sale => (sale.sale_items ?? []).map((i: any) => ({ ...i, store_id: sale.store_id })))
    setSaleItems(items)
    setLoading(false)
  }

  function buildDayRows(filteredSales: any[]): DayRow[] {
    const byDate = filteredSales.reduce((acc, s) => {
      const date = s.created_at.split('T')[0]
      if (!acc[date]) acc[date] = { date, cash: 0, pos: 0, total: 0, txn: 0, deposit: 0, shopify: 0, shopifyTxn: 0 }
      if (s.movement_type === 'sale') {
        acc[date].total += s.total
        acc[date].txn++
        if (s.payment_method === 'cash') { acc[date].cash += s.total; acc[date].deposit += s.total }
        else if (s.payment_method === 'pos') acc[date].pos += s.total
        if (s.acquisition_channel === 'shopify') { acc[date].shopify += s.total; acc[date].shopifyTxn++ }
      }
      return acc
    }, {} as Record<string, DayRow>)
    return (Object.values(byDate) as DayRow[]).sort((a, b) => b.date.localeCompare(a.date))
  }

  function buildProductRows(filteredSales: any[]) {
    const realSales = filteredSales.filter(s => s.movement_type === 'sale')
    const items = realSales.flatMap(s => s.sale_items ?? [])
    const byProduct: Record<string, { name: string; qty: number; revenue: number }> = {}
    for (const i of items) {
      if (!byProduct[i.product_name]) byProduct[i.product_name] = { name: i.product_name, qty: 0, revenue: 0 }
      byProduct[i.product_name].qty += i.qty
      byProduct[i.product_name].revenue += i.line_total
    }
    return Object.values(byProduct).sort((a, b) => b.revenue - a.revenue)
  }

  const dayRows = buildDayRows(sales)
  const grandTotal = dayRows.reduce((s, r) => s + r.total, 0)
  const grandCash = dayRows.reduce((s, r) => s + r.cash, 0)
  const grandPos = dayRows.reduce((s, r) => s + r.pos, 0)
  const grandTxn = dayRows.reduce((s, r) => s + r.txn, 0)
  const grandDeposit = dayRows.reduce((s, r) => s + r.deposit, 0)
  const grandShopify = dayRows.reduce((s, r) => s + r.shopify, 0)
  const grandAvg = grandTxn > 0 ? grandTotal / grandTxn : 0
  const productRows = buildProductRows(sales)

  function setPreset(label: string) {
    const today = new Date()
    if (label === 'Oggi') { const d = today.toISOString().split('T')[0]; setFromDate(d); setToDate(d) }
    else if (label === '7gg') { const f = new Date(); f.setDate(f.getDate()-7); setFromDate(f.toISOString().split('T')[0]); setToDate(today.toISOString().split('T')[0]) }
    else if (label === '30gg') { const f = new Date(); f.setDate(f.getDate()-30); setFromDate(f.toISOString().split('T')[0]); setToDate(today.toISOString().split('T')[0]) }
    else if (label === 'Mese') { const f = new Date(today.getFullYear(), today.getMonth(), 1); setFromDate(f.toISOString().split('T')[0]); setToDate(today.toISOString().split('T')[0]) }
    else if (label === 'Anno') { const f = new Date(today.getFullYear(), 0, 1); setFromDate(f.toISOString().split('T')[0]); setToDate(today.toISOString().split('T')[0]) }
  }

  function exportCSV() {
    const header = ['Data','Cash (€)','POS (€)','Totale (€)','Transazioni','Avg Sale','Deposit (€)','Shopify (€)']
    const rows = dayRows.map(r => [r.date, r.cash.toFixed(2), r.pos.toFixed(2), r.total.toFixed(2), r.txn.toString(), r.txn>0?(r.total/r.txn).toFixed(2):'0', r.deposit.toFixed(2), r.shopify.toFixed(2)])
    rows.push(['TOTALE', grandCash.toFixed(2), grandPos.toFixed(2), grandTotal.toFixed(2), grandTxn.toString(), grandAvg.toFixed(2), grandDeposit.toFixed(2), grandShopify.toFixed(2)])
    const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `live_report_${fromDate}_${toDate}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>Caricamento...</div>

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'var(--space-xl)' }}>
        <div>
          <h2>📋 Live Report</h2>
          <p style={{ color:'var(--text-secondary)', fontSize:14, marginTop:4 }}>Report giornaliero — aggregato e per store</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => window.print()} className="btn btn-secondary" style={{ fontSize:12 }}>🖨️ Stampa</button>
          <button onClick={exportCSV} className="btn btn-secondary" style={{ fontSize:12 }}>📥 Export CSV</button>
        </div>
      </div>

      {/* Date range */}
      <div className="card" style={{ display:'flex', gap:12, alignItems:'center', marginBottom:'var(--space-xl)', padding:'var(--space-md) var(--space-lg)', flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <label style={{ fontSize:13, fontWeight:600, color:'var(--text-secondary)' }}>Dal</label>
          <input className="input" type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ width:150, height:36 }} />
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <label style={{ fontSize:13, fontWeight:600, color:'var(--text-secondary)' }}>Al</label>
          <input className="input" type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ width:150, height:36 }} />
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:4 }}>
          {['Oggi','7gg','30gg','Mese','Anno'].map(p => (
            <button key={p} onClick={() => setPreset(p)} className="btn btn-secondary" style={{ padding:'6px 12px', fontSize:12 }}>{p}</button>
          ))}
        </div>
      </div>

      {/* KPI Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:'var(--space-md)', marginBottom:'var(--space-xl)' }}>
        <div className="kpi-card"><div className="kpi-label">💵 Cash</div><div className="kpi-value" style={{ color:'var(--success)' }}>{fmt(grandCash)}</div></div>
        <div className="kpi-card"><div className="kpi-label">💳 POS</div><div className="kpi-value" style={{ color:'var(--accent-blue)' }}>{fmt(grandPos)}</div></div>
        <div className="kpi-card"><div className="kpi-label">📊 Avg Sale</div><div className="kpi-value">{fmt(grandAvg)}</div><div className="kpi-sub">{grandTxn} txn</div></div>
        <div className="kpi-card"><div className="kpi-label">🏦 Deposit</div><div className="kpi-value" style={{ color:'#059669' }}>{fmt(grandDeposit)}</div><div className="kpi-sub">contanti in cassa</div></div>
        <div className="kpi-card"><div className="kpi-label">🛒 Online</div><div className="kpi-value" style={{ color:'#7C3AED' }}>{fmt(grandShopify)}</div><div className="kpi-sub">Shopify</div></div>
        <div className="kpi-card"><div className="kpi-label">📦 Totale</div><div className="kpi-value">{fmt(grandTotal)}</div><div className="kpi-sub">{grandTxn} transazioni</div></div>
      </div>

      {/* View mode toggle + tab */}
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'var(--space-lg)', flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', background:'var(--bg-surface)', borderRadius:10, padding:3, gap:3 }}>
          <button onClick={() => setViewMode('aggregate')} style={{ padding:'7px 16px', borderRadius:8, border:'none', background:viewMode==='aggregate'?'var(--bg-primary)':'transparent', fontWeight:viewMode==='aggregate'?600:400, color:viewMode==='aggregate'?'var(--text-primary)':'var(--text-secondary)', cursor:'pointer', fontSize:13 }}>📊 Aggregato</button>
          <button onClick={() => setViewMode('per-store')} style={{ padding:'7px 16px', borderRadius:8, border:'none', background:viewMode==='per-store'?'var(--bg-primary)':'transparent', fontWeight:viewMode==='per-store'?600:400, color:viewMode==='per-store'?'var(--text-primary)':'var(--text-secondary)', cursor:'pointer', fontSize:13 }}>🏪 Per Store</button>
        </div>
        <div style={{ display:'flex', background:'var(--bg-surface)', borderRadius:10, padding:3, gap:3 }}>
          <button onClick={() => setActiveTab('overview')} style={{ padding:'7px 16px', borderRadius:8, border:'none', background:activeTab==='overview'?'var(--bg-primary)':'transparent', fontWeight:activeTab==='overview'?600:400, cursor:'pointer', fontSize:13, color:activeTab==='overview'?'var(--text-primary)':'var(--text-secondary)' }}>💰 Metriche</button>
          <button onClick={() => setActiveTab('products')} style={{ padding:'7px 16px', borderRadius:8, border:'none', background:activeTab==='products'?'var(--bg-primary)':'transparent', fontWeight:activeTab==='products'?600:400, cursor:'pointer', fontSize:13, color:activeTab==='products'?'var(--text-primary)':'var(--text-secondary)' }}>📦 Prodotti</button>
        </div>
      </div>

      {/* AGGREGATE VIEW */}
      {viewMode === 'aggregate' && activeTab === 'overview' && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Data</th><th>💵 Cash</th><th>💳 POS</th><th>📊 Avg Sale</th><th>🏦 Deposit</th><th>🛒 Online</th><th>Totale</th><th>Txn</th></tr>
            </thead>
            <tbody>
              {dayRows.map(r => (
                <tr key={r.date}>
                  <td style={{ fontWeight:600 }}>{formatDate(r.date + 'T12:00:00')}</td>
                  <td style={{ color:'var(--success)', fontWeight:600 }}>{fmt(r.cash)}</td>
                  <td style={{ color:'var(--accent-blue)', fontWeight:600 }}>{fmt(r.pos)}</td>
                  <td>{fmt(r.txn > 0 ? r.total / r.txn : 0)}</td>
                  <td style={{ color:'#059669' }}>{fmt(r.deposit)}</td>
                  <td style={{ color:'#7C3AED' }}>{fmt(r.shopify)}</td>
                  <td style={{ fontWeight:700, fontSize:15 }}>{fmt(r.total)}</td>
                  <td>{r.txn}</td>
                </tr>
              ))}
              <tr style={{ background:'var(--bg-surface)' }}>
                <td style={{ fontWeight:700 }}>TOTALE</td>
                <td style={{ fontWeight:700, color:'var(--success)' }}>{fmt(grandCash)}</td>
                <td style={{ fontWeight:700, color:'var(--accent-blue)' }}>{fmt(grandPos)}</td>
                <td style={{ fontWeight:700 }}>{fmt(grandAvg)}</td>
                <td style={{ fontWeight:700, color:'#059669' }}>{fmt(grandDeposit)}</td>
                <td style={{ fontWeight:700, color:'#7C3AED' }}>{fmt(grandShopify)}</td>
                <td style={{ fontWeight:700, fontSize:15 }}>{fmt(grandTotal)}</td>
                <td style={{ fontWeight:700 }}>{grandTxn}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* PER-STORE VIEW */}
      {viewMode === 'per-store' && activeTab === 'overview' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-xl)' }}>
          {stores.map(store => {
            const storeSales = sales.filter(s => s.store_id === store.id)
            const storeRows = buildDayRows(storeSales)
            const sCash = storeRows.reduce((s,r) => s+r.cash, 0)
            const sPos = storeRows.reduce((s,r) => s+r.pos, 0)
            const sTotal = storeRows.reduce((s,r) => s+r.total, 0)
            const sTxn = storeRows.reduce((s,r) => s+r.txn, 0)
            const sDeposit = storeRows.reduce((s,r) => s+r.deposit, 0)
            const sShopify = storeRows.reduce((s,r) => s+r.shopify, 0)
            const sAvg = sTxn > 0 ? sTotal / sTxn : 0
            return (
              <div key={store.id} className="card">
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'var(--space-md)' }}>
                  <h4>🏪 {store.name}</h4>
                  <div style={{ display:'flex', gap:8 }}>
                    <span className="badge badge-gray">💵 {fmt(sCash)}</span>
                    <span className="badge badge-gray">💳 {fmt(sPos)}</span>
                    <span className="badge badge-brand">{fmt(sTotal)}</span>
                  </div>
                </div>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr><th>Data</th><th>Cash</th><th>POS</th><th>Avg</th><th>Deposit</th><th>Online</th><th>Totale</th><th>Txn</th></tr>
                    </thead>
                    <tbody>
                      {storeRows.map(r => (
                        <tr key={r.date}>
                          <td style={{ fontWeight:600 }}>{formatDate(r.date+'T12:00:00')}</td>
                          <td style={{ color:'var(--success)' }}>{fmt(r.cash)}</td>
                          <td style={{ color:'var(--accent-blue)' }}>{fmt(r.pos)}</td>
                          <td>{fmt(r.txn>0?r.total/r.txn:0)}</td>
                          <td style={{ color:'#059669' }}>{fmt(r.deposit)}</td>
                          <td style={{ color:'#7C3AED' }}>{fmt(r.shopify)}</td>
                          <td style={{ fontWeight:700 }}>{fmt(r.total)}</td>
                          <td>{r.txn}</td>
                        </tr>
                      ))}
                      <tr style={{ background:'var(--bg-surface)' }}>
                        <td style={{ fontWeight:700 }}>TOTALE</td>
                        <td style={{ fontWeight:700 }}>{fmt(sCash)}</td>
                        <td style={{ fontWeight:700 }}>{fmt(sPos)}</td>
                        <td style={{ fontWeight:700 }}>{fmt(sAvg)}</td>
                        <td style={{ fontWeight:700 }}>{fmt(sDeposit)}</td>
                        <td style={{ fontWeight:700 }}>{fmt(sShopify)}</td>
                        <td style={{ fontWeight:700 }}>{fmt(sTotal)}</td>
                        <td style={{ fontWeight:700 }}>{sTxn}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* PRODUCTS TAB — Aggregate */}
      {activeTab === 'products' && viewMode === 'aggregate' && (
        <div className="table-wrapper">
          <table>
            <thead><tr><th>#</th><th>Prodotto</th><th>Qty</th><th>Revenue</th><th>% Totale</th></tr></thead>
            <tbody>
              {productRows.length === 0 && <tr><td colSpan={5} style={{ textAlign:'center', color:'var(--text-tertiary)', padding:20 }}>Nessun prodotto venduto</td></tr>}
              {productRows.map((p, i) => (
                <tr key={p.name}>
                  <td style={{ fontWeight:700, color:'var(--text-tertiary)' }}>{i+1}</td>
                  <td style={{ fontWeight:600 }}>{p.name}</td>
                  <td>{p.qty}</td>
                  <td style={{ fontWeight:700 }}>{fmt(p.revenue)}</td>
                  <td>{grandTotal > 0 ? ((p.revenue/grandTotal)*100).toFixed(1) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* PRODUCTS TAB — Per Store */}
      {activeTab === 'products' && viewMode === 'per-store' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-xl)' }}>
          {stores.map(store => {
            const storeSales = sales.filter(s => s.store_id === store.id)
            const storeProducts = buildProductRows(storeSales)
            const storeTotal = storeSales.filter(s => s.movement_type === 'sale').reduce((s,x) => s+x.total, 0)
            return (
              <div key={store.id} className="card">
                <h4 style={{ marginBottom:'var(--space-md)' }}>🏪 {store.name}</h4>
                <div className="table-wrapper">
                  <table>
                    <thead><tr><th>#</th><th>Prodotto</th><th>Qty</th><th>Revenue</th><th>%</th></tr></thead>
                    <tbody>
                      {storeProducts.length === 0 && <tr><td colSpan={5} style={{ textAlign:'center', color:'var(--text-tertiary)', padding:16 }}>—</td></tr>}
                      {storeProducts.map((p, i) => (
                        <tr key={p.name}>
                          <td style={{ fontWeight:700, color:'var(--text-tertiary)' }}>{i+1}</td>
                          <td style={{ fontWeight:600 }}>{p.name}</td>
                          <td>{p.qty}</td>
                          <td style={{ fontWeight:700 }}>{fmt(p.revenue)}</td>
                          <td>{storeTotal > 0 ? ((p.revenue/storeTotal)*100).toFixed(1) : 0}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
