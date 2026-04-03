'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Product, Store } from '@/types/database'

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

  const [stores, setStores] = useState<Store[]>([])
  const [selectedStore, setSelectedStore] = useState('')
  const [entries, setEntries] = useState<StockEntry[]>([])
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [orgId, setOrgId] = useState<string | null>(null)

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
      .order('category, name' as any)

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

  const filtered = entries.filter(e =>
    !search || e.name.toLowerCase().includes(search.toLowerCase())
  )

  const changedCount = entries.filter(e => parseInt(e.new_stock) !== e.current_stock).length
  const totalNewStock = entries.reduce((s, e) => s + (parseInt(e.new_stock) || 0), 0)

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>Caricamento...</div>

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-xl)' }}>
        <div>
          <h2>📦 Inventario Iniziale</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>
            Imposta le quantità iniziali dei prodotti per ogni store o magazzino
          </p>
        </div>
      </div>

      {/* Store selector */}
      <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)', marginBottom: 'var(--space-xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)' }}>
          <div style={{ flex: 1 }}>
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
              <div className="kpi-card" style={{ padding: '10px 16px', minWidth: 100 }}>
                <div className="kpi-label">Modificati</div>
                <div className="kpi-value" style={{ fontSize: 20, color: changedCount > 0 ? 'var(--brand-primary)' : undefined }}>{changedCount}</div>
              </div>
              <div className="kpi-card" style={{ padding: '10px 16px', minWidth: 100 }}>
                <div className="kpi-label">Stock Totale</div>
                <div className="kpi-value" style={{ fontSize: 20 }}>{totalNewStock}</div>
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
          <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Scegli lo store o il magazzino per impostare le quantità iniziali dei prodotti</p>
        </div>
      )}

      {selectedStore && entries.length === 0 && !loadingProducts && (
        <div style={{ textAlign: 'center', padding: 'var(--space-2xl) 0' }}>
          <span style={{ fontSize: 48, display: 'block', marginBottom: 12 }}>📭</span>
          <h3 style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>Nessun prodotto</h3>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Questo store non ha prodotti. Vai su Prodotti per aggiungerli o importarli da CSV.</p>
        </div>
      )}

      {selectedStore && entries.length > 0 && !loadingProducts && (
        <>
          {/* Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
            <input
              className="input"
              placeholder="🔍 Cerca prodotto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: 300 }}
            />
            <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
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
                  <th style={{ width: '40%' }}>Prodotto</th>
                  <th>Categoria</th>
                  <th>Stock Attuale</th>
                  <th style={{ width: 140 }}>Nuovo Stock</th>
                  <th style={{ width: 120 }}>Soglia Alert</th>
                  <th>Variazione</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(entry => {
                  const newVal = parseInt(entry.new_stock) || 0
                  const diff = newVal - entry.current_stock
                  return (
                    <tr key={entry.product_id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{entry.name}</div>
                      </td>
                      <td>
                        <span className="badge badge-indigo" style={{ fontSize: 11 }}>{entry.category}</span>
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
                            border: `2px solid ${diff !== 0 ? 'var(--brand-primary)' : 'var(--border-default)'}`,
                            borderRadius: 8, textAlign: 'center',
                            background: diff !== 0 ? 'var(--brand-primary-light)' : 'var(--bg-primary)',
                          }}
                        />
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
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Stock totale: {totalNewStock} unità</div>
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
