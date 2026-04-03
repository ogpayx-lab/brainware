'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { categoryLabel } from '@/lib/utils'
import type { Product, ProductCategory, Store } from '@/types/database'

const CATEGORIES: ProductCategory[] = ['flowers', 'hashish', 'oils', 'edibles', 'accessories']
const QUICK_AMOUNTS = [10, 25, 50, 100]

interface StockEntry {
  product_id: string
  name: string
  category: string
  current_stock: number
  new_stock: string
  stock_alert: string
}

export default function InventorySetupPage() {
  const router = useRouter()
  const supabase = createClient()
  const csvRef = useRef<HTMLInputElement>(null)

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
  // CSV stock import
  const [showCsvImport, setShowCsvImport] = useState(false)
  const [csvRows, setCsvRows] = useState<{ name: string; stock: number; matched: boolean; product_id: string | null }[]>([])
  const [csvError, setCsvError] = useState<string | null>(null)
  const [csvApplied, setCsvApplied] = useState(false)

  useEffect(() => { loadStores() }, [])

  async function loadStores() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase.from('users').select('store_id, role').eq('id', user.id).single()
    if (profile?.role !== 'owner') { router.push('/login'); return }

    // Get organization_id
    const { data: myStore } = await supabase.from('stores').select('organization_id').eq('id', profile.store_id).single()
    const org = myStore?.organization_id
    setOrgId(org)

    // Load all stores for this organization
    let query = supabase.from('stores').select('*').eq('is_active', true)
    if (org) query = query.eq('organization_id', org)
    const { data: storeList } = await query.order('name')
    setStores(storeList ?? [])
    setLoading(false)
  }

  async function loadProducts(storeId: string) {
    setLoadingProducts(true)
    setSaved(false)
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .order('name')

    setEntries((products ?? []).map(p => ({
      product_id: p.id,
      name: p.name,
      category: p.category,
      current_stock: p.stock,
      new_stock: p.stock.toString(),
      stock_alert: p.stock_alert.toString(),
    })))
    setLoadingProducts(false)
  }

  function handleStoreChange(storeId: string) {
    setSelectedStore(storeId)
    if (storeId) loadProducts(storeId)
    else setEntries([])
  }

  function updateEntry(productId: string, field: 'new_stock' | 'stock_alert', value: string) {
    setEntries(prev => prev.map(e =>
      e.product_id === productId ? { ...e, [field]: value } : e
    ))
  }

  function addToStock(productId: string, amount: number) {
    setEntries(prev => prev.map(e =>
      e.product_id === productId ? { ...e, new_stock: (Math.max(0, (parseInt(e.new_stock) || 0) + amount)).toString() } : e
    ))
  }

  function setAllStock(value: number) {
    setEntries(prev => prev.map(e => ({ ...e, new_stock: value.toString() })))
  }

  async function handleSave() {
    if (!selectedStore || entries.length === 0) return
    setSaving(true)

    // Update each product's stock
    for (const entry of entries) {
      const newStock = parseInt(entry.new_stock) || 0
      const newAlert = parseInt(entry.stock_alert) || 5
      await supabase.from('products').update({
        stock: newStock,
        stock_alert: newAlert,
      }).eq('id', entry.product_id)
    }

    setSaving(false)
    setSaved(true)

    // Refresh
    loadProducts(selectedStore)
  }

  // CSV stock import
  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvError(null)
    setCsvApplied(false)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const lines = text.trim().split('\n').filter(l => l.trim())
      if (lines.length < 2) { setCsvError('File vuoto o solo intestazione.'); return }
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
      const nameIdx = headers.indexOf('nome')
      const stockIdx = headers.indexOf('stock')
      if (nameIdx === -1 || stockIdx === -1) {
        setCsvError('Colonne obbligatorie mancanti: nome, stock')
        return
      }
      const rows = lines.slice(1).map(line => {
        const cols = line.split(',').map(c => c.trim())
        const name = cols[nameIdx] ?? ''
        const stock = parseInt(cols[stockIdx]) || 0
        const match = entries.find(e => e.name.toLowerCase() === name.toLowerCase())
        return { name, stock, matched: !!match, product_id: match?.product_id ?? null }
      })
      setCsvRows(rows)
    }
    reader.readAsText(file)
  }

  function applyCsvStock() {
    setEntries(prev => {
      const updated = [...prev]
      for (const row of csvRows) {
        if (row.product_id) {
          const idx = updated.findIndex(e => e.product_id === row.product_id)
          if (idx >= 0) updated[idx] = { ...updated[idx], new_stock: row.stock.toString() }
        }
      }
      return updated
    })
    setCsvApplied(true)
    setShowCsvImport(false)
    setCsvRows([])
    if (csvRef.current) csvRef.current.value = ''
  }

  // Stats
  const zeroStockCount = entries.filter(e => (parseInt(e.new_stock) || 0) === 0).length
  const lowStockCount = entries.filter(e => {
    const s = parseInt(e.new_stock) || 0
    const a = parseInt(e.stock_alert) || 5
    return s > 0 && s <= a
  }).length

  // Filtering
  const filtered = entries.filter(e => {
    const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase())
    const matchCat = filterCat === 'all' || e.category === filterCat
    const stock = parseInt(e.new_stock) || 0
    const alert = parseInt(e.stock_alert) || 5
    const matchStock = filterStock === 'all' || (filterStock === 'zero' && stock === 0) || (filterStock === 'low' && stock > 0 && stock <= alert)
    return matchSearch && matchCat && matchStock
  })

  const changedCount = entries.filter(e => parseInt(e.new_stock) !== e.current_stock).length
  const totalNewStock = entries.reduce((s, e) => s + (parseInt(e.new_stock) || 0), 0)

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>Caricamento...</div>

  return (
    <div>
      {/* CSV Import Modal */}
      {showCsvImport && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 560 }}>
            <h3 style={{ marginBottom: 8 }}>📊 Importa Stock da CSV</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 'var(--space-lg)' }}>
              Carica un CSV con colonne <strong>nome, stock</strong> per aggiornare le quantità in bulk.
            </p>

            <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                <strong>Formato richiesto:</strong> CSV con colonne <code>nome, stock</code>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                Esempio: <code>Amnesia Haze, 50</code> — il nome deve corrispondere esattamente al prodotto
              </div>
            </div>

            <div className="input-group" style={{ marginBottom: 'var(--space-lg)' }}>
              <label className="input-label">Carica file CSV</label>
              <input ref={csvRef} type="file" accept=".csv" onChange={handleCsvFile} style={{ padding: '10px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', width: '100%', fontSize: 14 }} />
            </div>

            {csvError && <div style={{ background: 'var(--danger-light)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 13, color: 'var(--danger)', marginBottom: 'var(--space-md)' }}>⚠️ {csvError}</div>}

            {csvRows.length > 0 && (
              <div style={{ marginBottom: 'var(--space-lg)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                  Anteprima · {csvRows.filter(r => r.matched).length} prodotti trovati su {csvRows.length}
                </div>
                <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-surface)' }}>
                        {['Nome', 'Stock', 'Stato'].map(h => (
                          <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.map((row, i) => (
                        <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)', opacity: row.matched ? 1 : 0.5 }}>
                          <td style={{ padding: '6px 10px', fontWeight: 600 }}>{row.name}</td>
                          <td style={{ padding: '6px 10px' }}>{row.stock}</td>
                          <td style={{ padding: '6px 10px' }}>
                            <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, background: row.matched ? 'var(--success-light)' : 'var(--danger-light)', color: row.matched ? 'var(--brand-primary)' : 'var(--danger)' }}>
                              {row.matched ? '✓ Trovato' : '✗ Non trovato'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setShowCsvImport(false); setCsvRows([]); setCsvError(null) }}>Chiudi</button>
              {csvRows.length > 0 && csvRows.some(r => r.matched) && (
                <button className="btn btn-primary" style={{ flex: 2 }} onClick={applyCsvStock}>
                  Applica Stock ({csvRows.filter(r => r.matched).length} prodotti)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-xl)' }}>
        <div>
          <h2>📦 Inventario Iniziale</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>
            Imposta le quantità dei prodotti per ogni store o magazzino
          </p>
        </div>
      </div>

      {/* Store selector */}
      <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)', marginBottom: 'var(--space-xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 250 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>Seleziona Store / Magazzino</label>
            <select
              className="input"
              value={selectedStore}
              onChange={e => handleStoreChange(e.target.value)}
              style={{ fontSize: 15, fontWeight: 600 }}
            >
              <option value="">— Seleziona uno store —</option>
              {stores.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          {selectedStore && entries.length > 0 && (
            <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-end' }}>
              <div className="kpi-card" style={{ padding: '10px 16px', minWidth: 100 }}>
                <div className="kpi-label">Prodotti</div>
                <div className="kpi-value" style={{ fontSize: 20 }}>{entries.length}</div>
              </div>
              <div className="kpi-card" style={{ padding: '10px 16px', minWidth: 100, border: zeroStockCount > 0 ? '1.5px solid var(--danger)' : undefined }}>
                <div className="kpi-label">Senza Stock</div>
                <div className="kpi-value" style={{ fontSize: 20, color: zeroStockCount > 0 ? 'var(--danger)' : undefined }}>{zeroStockCount}</div>
              </div>
              <div className="kpi-card" style={{ padding: '10px 16px', minWidth: 100, border: lowStockCount > 0 ? '1.5px solid var(--warning)' : undefined }}>
                <div className="kpi-label">Stock Basso</div>
                <div className="kpi-value" style={{ fontSize: 20, color: lowStockCount > 0 ? 'var(--warning)' : undefined }}>{lowStockCount}</div>
              </div>
              <div className="kpi-card" style={{ padding: '10px 16px', minWidth: 100 }}>
                <div className="kpi-label">Modificati</div>
                <div className="kpi-value" style={{ fontSize: 20, color: changedCount > 0 ? 'var(--brand-primary)' : undefined }}>{changedCount}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {loadingProducts && (
        <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-secondary)' }}>Caricamento prodotti...</div>
      )}

      {!selectedStore && !loadingProducts && (
        <div style={{ textAlign: 'center', padding: 'var(--space-2xl) 0' }}>
          <span style={{ fontSize: 48, display: 'block', marginBottom: 12 }}>🏪</span>
          <h3 style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>Seleziona uno store</h3>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Scegli lo store o il magazzino per impostare le quantità dei prodotti</p>
        </div>
      )}

      {selectedStore && entries.length === 0 && !loadingProducts && (
        <div style={{ textAlign: 'center', padding: 'var(--space-2xl) 0' }}>
          <span style={{ fontSize: 48, display: 'block', marginBottom: 12 }}>📭</span>
          <h3 style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>Nessun prodotto</h3>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Questo store non ha prodotti. Vai su Prodotti per aggiungerli o importarli da CSV, poi usa &quot;Distribuisci a Store&quot; per copiarli qui.</p>
        </div>
      )}

      {selectedStore && entries.length > 0 && !loadingProducts && (
        <>
          {/* Alert per prodotti senza stock */}
          {zeroStockCount > 0 && (
            <div style={{ background: '#FEF2F2', border: '1.5px solid #EF4444', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 'var(--space-lg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>⚠️</span>
                <div>
                  <div style={{ fontWeight: 600, color: '#EF4444', fontSize: 14 }}>{zeroStockCount} prodotti senza stock</div>
                  <div style={{ fontSize: 12, color: '#B91C1C' }}>Questi prodotti non saranno visibili nel POS dei dipendenti</div>
                </div>
              </div>
              <button onClick={() => setFilterStock('zero')} className="btn btn-secondary" style={{ fontSize: 12, flexShrink: 0 }}>Mostra solo questi</button>
            </div>
          )}

          {/* CSV applied success message */}
          {csvApplied && (
            <div style={{ background: 'var(--success-light)', border: '1px solid var(--brand-primary)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>✅</span>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--brand-primary-dark)', fontSize: 14 }}>Stock da CSV applicato!</div>
                <div style={{ fontSize: 12, color: 'var(--brand-primary-dark)', opacity: 0.8 }}>Clicca &quot;Salva Inventario&quot; per confermare le modifiche definitivamente.</div>
              </div>
            </div>
          )}

          {/* Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center', flex: 1 }}>
              <input
                className="input"
                placeholder="🔍 Cerca prodotto..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: 250 }}
              />
              {/* Category filter */}
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => setFilterCat('all')} className={`badge ${filterCat === 'all' ? 'badge-brand' : 'badge-gray'}`} style={{ cursor: 'pointer', border: 'none', padding: '5px 10px', fontSize: 11 }}>Tutte</button>
                {CATEGORIES.map(c => (
                  <button key={c} onClick={() => setFilterCat(c)} className={`badge ${filterCat === c ? 'badge-brand' : 'badge-gray'}`} style={{ cursor: 'pointer', border: 'none', padding: '5px 10px', fontSize: 11 }}>{categoryLabel[c]}</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Stock filters */}
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => setFilterStock('all')} className={`badge ${filterStock === 'all' ? 'badge-brand' : 'badge-gray'}`} style={{ cursor: 'pointer', border: 'none', padding: '5px 10px', fontSize: 11 }}>Tutti</button>
                <button onClick={() => setFilterStock('zero')} className={`badge ${filterStock === 'zero' ? 'badge-danger' : 'badge-gray'}`} style={{ cursor: 'pointer', border: 'none', padding: '5px 10px', fontSize: 11 }}>🚫 Stock 0 ({zeroStockCount})</button>
                <button onClick={() => setFilterStock('low')} className={`badge ${filterStock === 'low' ? 'badge-warning' : 'badge-gray'}`} style={{ cursor: 'pointer', border: 'none', padding: '5px 10px', fontSize: 11 }}>⚠️ Basso ({lowStockCount})</button>
              </div>
              <div style={{ height: 20, width: 1, background: 'var(--border-default)' }} />
              <button onClick={() => { setShowCsvImport(true); setCsvApplied(false) }} className="btn btn-secondary" style={{ fontSize: 12 }}>📊 Import Stock CSV</button>
              <div style={{ height: 20, width: 1, background: 'var(--border-default)' }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Imposta tutti a:</span>
              {[0, 10, 25, 50, 100].map(v => (
                <button key={v} onClick={() => setAllStock(v)} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }}>{v}</button>
              ))}
            </div>
          </div>

          {/* Success message */}
          {saved && (
            <div style={{ background: 'var(--success-light)', border: '1px solid var(--brand-primary)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>✅</span>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--brand-primary-dark)', fontSize: 14 }}>Inventario salvato!</div>
                <div style={{ fontSize: 12, color: 'var(--brand-primary-dark)', opacity: 0.8 }}>Le quantità sono state aggiornate per {entries.length} prodotti.</div>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Prodotto</th>
                  <th>Categoria</th>
                  <th>Stock Attuale</th>
                  <th style={{ width: 140 }}>Nuovo Stock</th>
                  <th>Azioni Rapide</th>
                  <th style={{ width: 100 }}>Soglia Alert</th>
                  <th>Variazione</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-tertiary)' }}>Nessun prodotto trovato con i filtri selezionati</td></tr>
                )}
                {filtered.map(entry => {
                  const newVal = parseInt(entry.new_stock) || 0
                  const diff = newVal - entry.current_stock
                  const isZero = newVal === 0
                  return (
                    <tr key={entry.product_id} style={{ background: isZero ? '#FEF2F2' : undefined }}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{entry.name}</div>
                      </td>
                      <td>
                        <span className="badge badge-indigo" style={{ fontSize: 11 }}>{categoryLabel[entry.category as ProductCategory] || entry.category}</span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: entry.current_stock === 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
                          {entry.current_stock}
                        </span>
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          value={entry.new_stock}
                          onChange={e => updateEntry(entry.product_id, 'new_stock', e.target.value)}
                          style={{
                            width: '100%', padding: '6px 10px', fontSize: 14, fontWeight: 700,
                            border: `2px solid ${diff !== 0 ? 'var(--brand-primary)' : isZero ? 'var(--danger)' : 'var(--border-default)'}`,
                            borderRadius: 8, textAlign: 'center',
                            background: diff !== 0 ? 'var(--brand-primary-light)' : isZero ? '#FEF2F2' : 'var(--bg-primary)',
                          }}
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {QUICK_AMOUNTS.map(amt => (
                            <button
                              key={amt}
                              onClick={() => addToStock(entry.product_id, amt)}
                              style={{
                                padding: '4px 8px', fontSize: 11, fontWeight: 600,
                                background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                                borderRadius: 6, cursor: 'pointer', color: 'var(--brand-primary)',
                              }}
                            >
                              +{amt}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          value={entry.stock_alert}
                          onChange={e => updateEntry(entry.product_id, 'stock_alert', e.target.value)}
                          style={{
                            width: '100%', padding: '6px 10px', fontSize: 13,
                            border: '1px solid var(--border-default)', borderRadius: 8, textAlign: 'center',
                          }}
                        />
                      </td>
                      <td>
                        {diff !== 0 && (
                          <span style={{
                            fontWeight: 700, fontSize: 13,
                            color: diff > 0 ? 'var(--success)' : 'var(--danger)',
                          }}>
                            {diff > 0 ? '+' : ''}{diff}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Save button */}
          <div style={{ position: 'sticky', bottom: 0, background: 'var(--bg-surface)', borderTop: '1px solid var(--border-subtle)', padding: 'var(--space-lg)', marginTop: 'var(--space-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 'var(--radius-lg)' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{changedCount} prodotti modificati</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Stock totale: {totalNewStock} unità · {zeroStockCount > 0 ? `⚠️ ${zeroStockCount} senza stock` : '✅ Tutti con stock'}</div>
            </div>
            <button
              onClick={handleSave}
              disabled={saving || changedCount === 0}
              className="btn btn-primary btn-lg"
              style={{ minWidth: 220 }}
            >
              {saving ? 'Salvataggio...' : `💾 Salva Inventario (${changedCount} modifiche)`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
