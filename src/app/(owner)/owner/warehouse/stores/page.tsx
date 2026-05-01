'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmt, categoryLabel } from '@/lib/utils'
import type { Product, ProductCategory, Store } from '@/types/database'

const CATEGORIES: ProductCategory[] = ['flowers', 'hashish', 'oils', 'edibles', 'accessories', 'cosmetics', 'clothes', 'seeds', 'vape', 'food']
const QUICK_AMOUNTS = [10, 25, 50, 100]

interface StockEntry {
  product_id: string; name: string; category: string; current_stock: number; new_stock: string; stock_alert: string; cost: number | null; price: number
}

export default function WarehouseStoresPage() {
  const router = useRouter()
  const supabase = createClient()
  const [stores, setStores] = useState<Store[]>([])
  const [selectedStore, setSelectedStore] = useState('')
  const [entries, setEntries] = useState<StockEntry[]>([])
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState<ProductCategory | 'all'>('all')
  const [filterStock, setFilterStock] = useState<'all' | 'zero' | 'low'>('all')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [orgId, setOrgId] = useState<string | null>(null)
  // Comparative view
  const [showComparative, setShowComparative] = useState(false)
  const [allStoreStock, setAllStoreStock] = useState<Record<string, any[]>>({})

  useEffect(() => { loadStores() }, [])

  async function loadStores() {
    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('users').select('store_id, role').eq('id', user.id).single()
    if (profile?.role !== 'owner') { router.push('/login'); return }
    const { data: myStore } = await supabase.from('stores').select('organization_id').eq('id', profile.store_id).single()
    const org = myStore?.organization_id
    setOrgId(org)
    let query = supabase.from('stores').select('*').eq('is_active', true)
    if (org) query = query.eq('organization_id', org)
    const { data: storeList } = await query.order('name')
    setStores(storeList ?? [])
    setLoading(false)
  }

  async function loadProducts(storeId: string) {
    setLoadingProducts(true); setSaved(false)
    const { data: products } = await supabase.from('products').select('*').eq('store_id', storeId).eq('is_active', true).order('name')
    setEntries((products ?? []).map(p => ({
      product_id: p.id, name: p.name, category: p.category, current_stock: p.stock,
      new_stock: p.stock.toString(), stock_alert: p.stock_alert.toString(), cost: p.cost, price: p.price,
    })))
    setLoadingProducts(false)
  }

  async function loadComparativeView() {
    setShowComparative(true)
    const data: Record<string, any[]> = {}
    for (const store of stores) {
      const { data: prods } = await supabase.from('products').select('name, stock, stock_alert, category').eq('store_id', store.id).eq('is_active', true).order('name')
      data[store.id] = prods ?? []
    }
    setAllStoreStock(data)
  }

  function handleStoreChange(storeId: string) {
    setSelectedStore(storeId); setShowComparative(false)
    if (storeId) loadProducts(storeId); else setEntries([])
  }

  function updateEntry(productId: string, field: 'new_stock' | 'stock_alert', value: string) {
    setEntries(prev => prev.map(e => e.product_id === productId ? { ...e, [field]: value } : e))
  }

  function addToStock(productId: string, amount: number) {
    setEntries(prev => prev.map(e => e.product_id === productId ? { ...e, new_stock: (Math.max(0, (parseInt(e.new_stock) || 0) + amount)).toString() } : e))
  }

  async function handleSave() {
    if (!selectedStore || entries.length === 0) return
    setSaving(true)
    for (const entry of entries) {
      const newStock = parseInt(entry.new_stock) || 0
      const newAlert = parseInt(entry.stock_alert) || 5
      await supabase.from('products').update({ stock: newStock, stock_alert: newAlert }).eq('id', entry.product_id)
    }
    setSaving(false); setSaved(true)
    loadProducts(selectedStore)
  }

  // Stats
  const zeroStockCount = entries.filter(e => (parseInt(e.new_stock) || 0) === 0).length
  const lowStockCount = entries.filter(e => { const s = parseInt(e.new_stock) || 0; const a = parseInt(e.stock_alert) || 5; return s > 0 && s <= a }).length
  const changedCount = entries.filter(e => parseInt(e.new_stock) !== e.current_stock).length
  const totalNewStock = entries.reduce((s, e) => s + (parseInt(e.new_stock) || 0), 0)
  const totalValue = entries.reduce((s, e) => s + (parseInt(e.new_stock) || 0) * (e.cost || 0), 0)

  // Filtering
  const filtered = entries.filter(e => {
    const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase())
    const matchCat = filterCat === 'all' || e.category === filterCat
    const stock = parseInt(e.new_stock) || 0; const alert = parseInt(e.stock_alert) || 5
    const matchStock = filterStock === 'all' || (filterStock === 'zero' && stock === 0) || (filterStock === 'low' && stock > 0 && stock <= alert)
    return matchSearch && matchCat && matchStock
  })

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>Caricamento...</div>

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-xl)' }}>
        <div>
          <h2>🏪 Stock per Store</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>Imposta e gestisci le quantità dei prodotti per ogni punto vendita</p>
        </div>
        {stores.length > 1 && (
          <button className="btn btn-secondary" onClick={loadComparativeView} style={{ fontSize: 12 }}>📊 Vista Comparativa</button>
        )}
      </div>

      {/* Store selector + KPIs */}
      <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)', marginBottom: 'var(--space-xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 250 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>Store</label>
            <select className="input" value={selectedStore} onChange={e => handleStoreChange(e.target.value)} style={{ fontSize: 15, fontWeight: 600 }}>
              <option value="">— Seleziona Store —</option>
              {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {selectedStore && entries.length > 0 && (
            <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-end' }}>
              <div className="kpi-card" style={{ padding: '10px 16px', minWidth: 90 }}><div className="kpi-label">Prodotti</div><div className="kpi-value" style={{ fontSize: 20 }}>{entries.length}</div></div>
              <div className="kpi-card" style={{ padding: '10px 16px', minWidth: 90 }}><div className="kpi-label">Unità</div><div className="kpi-value" style={{ fontSize: 20 }}>{totalNewStock}</div></div>
              <div className="kpi-card" style={{ padding: '10px 16px', minWidth: 100 }}><div className="kpi-label">Valore</div><div className="kpi-value" style={{ fontSize: 18 }}>{fmt(totalValue)}</div></div>
              <div className="kpi-card" style={{ padding: '10px 16px', minWidth: 90, border: zeroStockCount > 0 ? '1.5px solid var(--danger)' : undefined }}><div className="kpi-label">Esauriti</div><div className="kpi-value" style={{ fontSize: 20, color: zeroStockCount > 0 ? 'var(--danger)' : undefined }}>{zeroStockCount}</div></div>
              <div className="kpi-card" style={{ padding: '10px 16px', minWidth: 90, border: lowStockCount > 0 ? '1.5px solid var(--warning)' : undefined }}><div className="kpi-label">Bassi</div><div className="kpi-value" style={{ fontSize: 20, color: lowStockCount > 0 ? 'var(--warning)' : undefined }}>{lowStockCount}</div></div>
            </div>
          )}
        </div>
      </div>

      {/* Comparative View */}
      {showComparative && (
        <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
          <h4 style={{ marginBottom: 'var(--space-lg)' }}>📊 Confronto Stock tra Store</h4>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Prodotto</th>
                  {stores.map(s => <th key={s.id} style={{ textAlign: 'center', fontSize: 12 }}>{s.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const allNames = new Set<string>()
                  Object.values(allStoreStock).forEach(prods => prods.forEach(p => allNames.add(p.name)))
                  return Array.from(allNames).sort().map(name => (
                    <tr key={name}>
                      <td style={{ fontWeight: 600, fontSize: 13 }}>{name}</td>
                      {stores.map(s => {
                        const prod = (allStoreStock[s.id] || []).find(p => p.name === name)
                        const qty = prod?.stock ?? 0
                        const alert = prod?.stock_alert ?? 5
                        const color = qty === 0 ? 'var(--danger)' : qty <= alert ? 'var(--warning)' : 'var(--text-primary)'
                        return <td key={s.id} style={{ textAlign: 'center', fontWeight: 700, color }}>{prod ? qty : '—'}</td>
                      })}
                    </tr>
                  ))
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loadingProducts && <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-secondary)' }}>Caricamento prodotti...</div>}

      {!selectedStore && !loadingProducts && !showComparative && (
        <div style={{ textAlign: 'center', padding: 'var(--space-2xl) 0' }}>
          <span style={{ fontSize: 48, display: 'block', marginBottom: 12 }}>🏪</span>
          <h3 style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>Seleziona uno store</h3>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Scegli il punto vendita per gestire le quantità dei prodotti</p>
        </div>
      )}

      {selectedStore && entries.length > 0 && !loadingProducts && (
        <>
          {/* Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center', flex: 1 }}>
              <input className="input" placeholder="🔍 Cerca..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 250 }} />
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => setFilterStock('all')} className={`badge ${filterStock === 'all' ? 'badge-brand' : 'badge-gray'}`} style={{ cursor: 'pointer', border: 'none', padding: '5px 10px', fontSize: 11 }}>Tutti</button>
                <button onClick={() => setFilterStock('zero')} className={`badge ${filterStock === 'zero' ? 'badge-danger' : 'badge-gray'}`} style={{ cursor: 'pointer', border: 'none', padding: '5px 10px', fontSize: 11 }}>🚫 Esauriti ({zeroStockCount})</button>
                <button onClick={() => setFilterStock('low')} className={`badge ${filterStock === 'low' ? 'badge-warning' : 'badge-gray'}`} style={{ cursor: 'pointer', border: 'none', padding: '5px 10px', fontSize: 11 }}>⚠️ Bassi ({lowStockCount})</button>
              </div>
            </div>
          </div>

          {saved && (
            <div style={{ background: 'var(--success-light)', border: '1px solid var(--brand-primary)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>✅</span>
              <div><div style={{ fontWeight: 600, color: 'var(--brand-primary-dark)', fontSize: 14 }}>Stock salvato!</div></div>
            </div>
          )}

          {/* Table */}
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '25%' }}>Prodotto</th>
                  <th>Categoria</th>
                  <th>Prezzo</th>
                  <th>Stock</th>
                  <th style={{ width: 130 }}>Nuovo</th>
                  <th>Rapido</th>
                  <th style={{ width: 90 }}>Alert</th>
                  <th>Δ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(entry => {
                  const newVal = parseInt(entry.new_stock) || 0
                  const diff = newVal - entry.current_stock
                  const isZero = newVal === 0
                  return (
                    <tr key={entry.product_id} style={{ background: isZero ? '#FEF2F2' : undefined }}>
                      <td style={{ fontWeight: 600 }}>{entry.name}</td>
                      <td><span className="badge badge-indigo" style={{ fontSize: 10 }}>{categoryLabel[entry.category as ProductCategory] || entry.category}</span></td>
                      <td style={{ fontSize: 13 }}>{fmt(entry.price)}</td>
                      <td style={{ fontWeight: 600, color: entry.current_stock === 0 ? 'var(--danger)' : 'var(--text-primary)' }}>{entry.current_stock}</td>
                      <td>
                        <input type="number" min="0" value={entry.new_stock} onChange={e => updateEntry(entry.product_id, 'new_stock', e.target.value)}
                          style={{ width: '100%', padding: '6px 10px', fontSize: 14, fontWeight: 700, border: `2px solid ${diff !== 0 ? 'var(--brand-primary)' : isZero ? 'var(--danger)' : 'var(--border-default)'}`, borderRadius: 8, textAlign: 'center', background: diff !== 0 ? 'var(--brand-primary-light)' : isZero ? '#FEF2F2' : 'var(--bg-primary)' }} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 3 }}>
                          {QUICK_AMOUNTS.map(amt => (
                            <button key={amt} onClick={() => addToStock(entry.product_id, amt)} style={{ padding: '3px 7px', fontSize: 10, fontWeight: 600, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 6, cursor: 'pointer', color: 'var(--brand-primary)' }}>+{amt}</button>
                          ))}
                        </div>
                      </td>
                      <td>
                        <input type="number" min="0" value={entry.stock_alert} onChange={e => updateEntry(entry.product_id, 'stock_alert', e.target.value)}
                          style={{ width: '100%', padding: '6px 10px', fontSize: 13, border: '1px solid var(--border-default)', borderRadius: 8, textAlign: 'center' }} />
                      </td>
                      <td>{diff !== 0 && <span style={{ fontWeight: 700, fontSize: 13, color: diff > 0 ? 'var(--success)' : 'var(--danger)' }}>{diff > 0 ? '+' : ''}{diff}</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Save bar */}
          <div style={{ position: 'sticky', bottom: 0, background: 'var(--bg-surface)', borderTop: '1px solid var(--border-subtle)', padding: 'var(--space-lg)', marginTop: 'var(--space-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 'var(--radius-lg)' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{changedCount} modificati</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Stock totale: {totalNewStock} · {zeroStockCount > 0 ? `⚠️ ${zeroStockCount} esauriti` : '✅ OK'}</div>
            </div>
            <button onClick={handleSave} disabled={saving || changedCount === 0} className="btn btn-primary btn-lg" style={{ minWidth: 200 }}>
              {saving ? 'Salvataggio...' : `💾 Salva (${changedCount} modifiche)`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
