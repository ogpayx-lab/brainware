'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmt, categoryLabel } from '@/lib/utils'
import type { ProductCategory } from '@/types/database'
import * as XLSX from 'xlsx'

const CATEGORIES: ProductCategory[] = ['flowers', 'hashish', 'oils', 'edibles', 'accessories', 'cosmetics', 'clothes', 'seeds', 'vape', 'food']

export default function WarehouseCentralPage() {
  const router = useRouter()
  const supabase = createClient()
  const [warehouse, setWarehouse] = useState<any>(null)
  const [stock, setStock] = useState<any[]>([])
  const [movements, setMovements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'stock' | 'movements'>('stock')
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState<ProductCategory | 'all'>('all')
  const [filterStock, setFilterStock] = useState<'all' | 'low' | 'zero'>('all')

  // Modals
  const [showAddItem, setShowAddItem] = useState(false)
  const [showMovement, setShowMovement] = useState<{ item: any; type: 'in' | 'out' } | null>(null)
  const [showRename, setShowRename] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [saving, setSaving] = useState(false)
  const csvRef = useRef<HTMLInputElement>(null)

  // Form states
  const [newItem, setNewItem] = useState({ product_name: '', category: 'flowers', qty: '0', cost_per_unit: '0', sell_price: '0', stock_alert: '5', is_bulk: false, bulk_unit: 'g', bulk_qty: '0', unit: 'pz', notes: '' })
  const [movementForm, setMovementForm] = useState({ qty: '', notes: '', cost_per_unit: '' })
  const [renameTo, setRenameTo] = useState('')
  const [csvRows, setCsvRows] = useState<{ product_name: string; qty: number; category: string; cost: number; price: number; matched: boolean; existing_id: string | null }[]>([])
  const [csvError, setCsvError] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('users').select('store_id, role, stores(organization_id)').eq('id', user.id).single()
    if (profile?.role !== 'owner') { router.push('/login'); return }
    const oid = (profile.stores as any)?.organization_id
    setOrgId(oid)

    // Get or create central warehouse
    let { data: wh } = await supabase.from('warehouses').select('*').eq('organization_id', oid).eq('type', 'central').single()
    if (!wh) {
      const { data: created } = await supabase.from('warehouses').insert({ organization_id: oid, name: 'Magazzino Centrale', type: 'central' }).select('*').single()
      wh = created
    }
    setWarehouse(wh)

    if (wh) {
      const { data: stockData } = await supabase.from('warehouse_stock').select('*').eq('warehouse_id', wh.id).order('product_name')
      setStock(stockData ?? [])

      const { data: movData } = await supabase.from('warehouse_movements').select('*').eq('warehouse_id', wh.id).order('created_at', { ascending: false }).limit(50)
      setMovements(movData ?? [])
    }
    setLoading(false)
  }

  async function addStockItem() {
    if (!warehouse || !newItem.product_name) return
    setSaving(true)
    await supabase.from('warehouse_stock').insert({
      warehouse_id: warehouse.id,
      product_name: newItem.product_name,
      category: newItem.category,
      qty: parseInt(newItem.qty) || 0,
      cost_per_unit: parseFloat(newItem.cost_per_unit) || 0,
      sell_price: parseFloat(newItem.sell_price) || 0,
      stock_alert: parseInt(newItem.stock_alert) || 5,
      is_bulk: newItem.is_bulk,
      bulk_unit: newItem.is_bulk ? newItem.bulk_unit : null,
      bulk_qty: newItem.is_bulk ? parseFloat(newItem.bulk_qty) || 0 : 0,
      unit: newItem.unit,
      notes: newItem.notes || null,
    })

    // Log movement if qty > 0
    const qty = parseInt(newItem.qty) || 0
    if (qty > 0) {
      await supabase.from('warehouse_movements').insert({
        warehouse_id: warehouse.id,
        product_name: newItem.product_name,
        movement_type: 'in',
        qty,
        cost_per_unit: parseFloat(newItem.cost_per_unit) || 0,
        total_cost: qty * (parseFloat(newItem.cost_per_unit) || 0),
        reference_type: 'purchase',
        notes: 'Carico iniziale',
      })
    }

    setShowAddItem(false)
    setNewItem({ product_name: '', category: 'flowers', qty: '0', cost_per_unit: '0', sell_price: '0', stock_alert: '5', is_bulk: false, bulk_unit: 'g', bulk_qty: '0', unit: 'pz', notes: '' })
    setSaving(false)
    loadData()
  }

  async function submitMovement() {
    if (!warehouse || !showMovement) return
    const item = showMovement.item
    const type = showMovement.type
    const qty = parseInt(movementForm.qty) || 0
    if (qty <= 0) return
    setSaving(true)

    const newQty = type === 'in' ? item.qty + qty : Math.max(0, item.qty - qty)
    const cost = parseFloat(movementForm.cost_per_unit) || item.cost_per_unit || 0

    // Update stock
    await supabase.from('warehouse_stock').update({ qty: newQty, updated_at: new Date().toISOString() }).eq('id', item.id)

    // Log movement
    await supabase.from('warehouse_movements').insert({
      warehouse_id: warehouse.id,
      stock_item_id: item.id,
      product_name: item.product_name,
      movement_type: type,
      qty,
      cost_per_unit: cost,
      total_cost: qty * cost,
      reference_type: type === 'in' ? 'purchase' : 'manual',
      notes: movementForm.notes || null,
    })

    setShowMovement(null)
    setMovementForm({ qty: '', notes: '', cost_per_unit: '' })
    setSaving(false)
    loadData()
  }

  async function deleteItem(id: string) {
    if (!confirm('Eliminare questo prodotto dal magazzino?')) return
    await supabase.from('warehouse_stock').delete().eq('id', id)
    loadData()
  }

  async function renameWarehouse() {
    if (!warehouse || !renameTo.trim()) return
    setSaving(true)
    const { error } = await supabase.from('warehouses').update({ name: renameTo.trim() }).eq('id', warehouse.id)
    if (error) {
      console.error('Rename warehouse error:', error)
      alert(`Errore rinomina: ${error.message}`)
      setSaving(false)
      return
    }
    setSaving(false)
    setShowRename(false)
    loadData()
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvError(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
        if (rawRows.length < 2) { setCsvError('File vuoto'); return }

        const normalize = (s: any) => String(s ?? '').toLowerCase().trim().replace(/\s+/g, '_')
        let headerIdx = -1
        for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
          const cells = rawRows[i].map(normalize)
          if (cells.includes('nome') || cells.includes('product_name') || cells.includes('prodotto')) { headerIdx = i; break }
        }
        if (headerIdx === -1) { setCsvError('Colonna "nome" o "prodotto" non trovata'); return }

        const headers = rawRows[headerIdx].map(normalize)
        const nameIdx = headers.findIndex(h => ['nome', 'product_name', 'prodotto'].includes(h))
        const qtyIdx = headers.findIndex(h => ['qty', 'quantita', 'quantità', 'stock'].includes(h))
        const catIdx = headers.findIndex(h => ['categoria', 'category', 'cat'].includes(h))
        const costIdx = headers.findIndex(h => ['costo', 'cost', 'costo_acquisto'].includes(h))
        const priceIdx = headers.findIndex(h => ['prezzo', 'price', 'prezzo_vendita'].includes(h))

        const rows = rawRows.slice(headerIdx + 1).filter(r => r.some((c: any) => String(c).trim())).map(cols => {
          const name = String(cols[nameIdx] ?? '').trim()
          const qty = qtyIdx >= 0 ? parseInt(cols[qtyIdx]) || 0 : 0
          const category = catIdx >= 0 ? String(cols[catIdx] ?? 'flowers').toLowerCase().trim() : 'flowers'
          const cost = costIdx >= 0 ? parseFloat(cols[costIdx]) || 0 : 0
          const price = priceIdx >= 0 ? parseFloat(cols[priceIdx]) || 0 : 0
          const existing = stock.find(s => s.product_name.toLowerCase() === name.toLowerCase())
          return { product_name: name, qty, category, cost, price, matched: !!existing, existing_id: existing?.id ?? null }
        }).filter(r => r.product_name)
        setCsvRows(rows)
      } catch (err: any) { setCsvError(`Errore: ${err.message}`) }
    }
    reader.readAsArrayBuffer(file)
  }

  async function applyImport() {
    if (!warehouse || csvRows.length === 0) return
    setSaving(true)
    for (const row of csvRows) {
      if (row.existing_id) {
        // Update existing
        await supabase.from('warehouse_stock').update({ qty: row.qty, cost_per_unit: row.cost || undefined, sell_price: row.price || undefined }).eq('id', row.existing_id)
      } else {
        // Insert new
        await supabase.from('warehouse_stock').insert({
          warehouse_id: warehouse.id, product_name: row.product_name, category: row.category,
          qty: row.qty, cost_per_unit: row.cost, sell_price: row.price, stock_alert: 5,
        })
      }
      // Log movement
      if (row.qty > 0) {
        await supabase.from('warehouse_movements').insert({
          warehouse_id: warehouse.id, product_name: row.product_name, movement_type: 'in',
          qty: row.qty, cost_per_unit: row.cost, total_cost: row.qty * row.cost,
          reference_type: 'purchase', notes: 'Import CSV/Excel',
        })
      }
    }
    setShowImport(false)
    setCsvRows([])
    if (csvRef.current) csvRef.current.value = ''
    setSaving(false)
    loadData()
  }

  function downloadTemplate() {
    const csvContent = 'nome,qty,categoria,costo,prezzo\n' + stock.map(s => `${s.product_name},${s.qty},${s.category},${s.cost_per_unit || 0},${s.sell_price || 0}`).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `magazzino_${warehouse?.name?.replace(/\s+/g, '_') || 'centrale'}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  // Stats
  const totalSku = stock.length
  const totalUnits = stock.reduce((s, i) => s + i.qty, 0)
  const totalValue = stock.reduce((s, i) => s + i.qty * (i.cost_per_unit || 0), 0)
  const totalSellValue = stock.reduce((s, i) => s + i.qty * (i.sell_price || 0), 0)
  const lowCount = stock.filter(i => i.qty > 0 && i.qty <= i.stock_alert).length
  const zeroCount = stock.filter(i => i.qty === 0).length

  // Filtering
  const filtered = stock.filter(i => {
    const matchSearch = !search || i.product_name.toLowerCase().includes(search.toLowerCase())
    const matchCat = filterCat === 'all' || i.category === filterCat
    const matchStock = filterStock === 'all' || (filterStock === 'zero' && i.qty === 0) || (filterStock === 'low' && i.qty > 0 && i.qty <= i.stock_alert)
    return matchSearch && matchCat && matchStock
  })

  const getStatus = (i: any) => i.qty === 0 ? 'Esaurito' : i.qty <= i.stock_alert ? 'Basso' : 'OK'
  const statusColor: Record<string, string> = { Esaurito: 'badge-danger', Basso: 'badge-warning', OK: 'badge-success' }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>Caricamento...</div>

  return (
    <div>
      {/* Add Item Modal */}
      {showAddItem && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 560 }}>
            <h3 style={{ marginBottom: 'var(--space-lg)' }}>➕ Nuovo Prodotto in Magazzino</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div className="input-group">
                <label className="input-label">Nome Prodotto *</label>
                <input className="input" placeholder="Es. Amnesia Haze 3G" value={newItem.product_name} onChange={e => setNewItem(f => ({ ...f, product_name: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                <div className="input-group">
                  <label className="input-label">Categoria</label>
                  <select className="input" value={newItem.category} onChange={e => setNewItem(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{categoryLabel[c]}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Quantità Iniziale</label>
                  <input className="input" type="number" min="0" value={newItem.qty} onChange={e => setNewItem(f => ({ ...f, qty: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-md)' }}>
                <div className="input-group">
                  <label className="input-label">Costo Acquisto (€)</label>
                  <input className="input" type="number" step="0.01" min="0" value={newItem.cost_per_unit} onChange={e => setNewItem(f => ({ ...f, cost_per_unit: e.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">Prezzo Vendita (€)</label>
                  <input className="input" type="number" step="0.01" min="0" value={newItem.sell_price} onChange={e => setNewItem(f => ({ ...f, sell_price: e.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">Soglia Alert</label>
                  <input className="input" type="number" min="0" value={newItem.stock_alert} onChange={e => setNewItem(f => ({ ...f, stock_alert: e.target.value }))} />
                </div>
              </div>

              {/* Bulk toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                  <input type="checkbox" checked={newItem.is_bulk} onChange={e => setNewItem(f => ({ ...f, is_bulk: e.target.checked }))} />
                  📦 Prodotto Bulk (kg, g, litri)
                </label>
              </div>
              {newItem.is_bulk && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                  <div className="input-group">
                    <label className="input-label">Unità Bulk</label>
                    <select className="input" value={newItem.bulk_unit} onChange={e => setNewItem(f => ({ ...f, bulk_unit: e.target.value }))}>
                      <option value="g">Grammi (g)</option>
                      <option value="kg">Chilogrammi (kg)</option>
                      <option value="l">Litri (l)</option>
                      <option value="ml">Millilitri (ml)</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Quantità Bulk</label>
                    <input className="input" type="number" step="0.001" min="0" value={newItem.bulk_qty} onChange={e => setNewItem(f => ({ ...f, bulk_qty: e.target.value }))} />
                  </div>
                </div>
              )}

              <div className="input-group">
                <label className="input-label">Note</label>
                <input className="input" placeholder="Note opzionali..." value={newItem.notes} onChange={e => setNewItem(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-xl)' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowAddItem(false)}>Annulla</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={addStockItem} disabled={saving || !newItem.product_name}>{saving ? 'Salvataggio...' : 'Aggiungi Prodotto'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Movement Modal */}
      {showMovement && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 420 }}>
            <h3 style={{ marginBottom: 4 }}>{showMovement.type === 'in' ? '📥 Carico' : '📤 Scarico'}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 'var(--space-lg)' }}>
              {showMovement.item.product_name} — Stock attuale: <strong>{showMovement.item.qty}</strong>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div className="input-group">
                <label className="input-label">Quantità</label>
                <input className="input" type="number" min="1" placeholder="Quantità" value={movementForm.qty} onChange={e => setMovementForm(f => ({ ...f, qty: e.target.value }))} autoFocus />
              </div>
              {showMovement.type === 'in' && (
                <div className="input-group">
                  <label className="input-label">Costo unitario (€)</label>
                  <input className="input" type="number" step="0.01" min="0" placeholder={showMovement.item.cost_per_unit?.toString() || '0'} value={movementForm.cost_per_unit} onChange={e => setMovementForm(f => ({ ...f, cost_per_unit: e.target.value }))} />
                </div>
              )}
              <div className="input-group">
                <label className="input-label">Note</label>
                <input className="input" placeholder="Motivo, fornitore..." value={movementForm.notes} onChange={e => setMovementForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-xl)' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowMovement(null)}>Annulla</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={submitMovement} disabled={saving || !(parseInt(movementForm.qty) > 0)}>
                {saving ? '...' : showMovement.type === 'in' ? `📥 Carica +${movementForm.qty || 0}` : `📤 Scarica -${movementForm.qty || 0}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {showRename && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 400 }}>
            <h3 style={{ marginBottom: 'var(--space-lg)' }}>✏️ Rinomina Magazzino</h3>
            <div className="input-group">
              <label className="input-label">Nome</label>
              <input className="input" value={renameTo} onChange={e => setRenameTo(e.target.value)} autoFocus />
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-xl)' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowRename(false)}>Annulla</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={renameWarehouse} disabled={saving || !renameTo.trim()}>{saving ? '...' : 'Salva'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImport && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 600 }}>
            <h3 style={{ marginBottom: 8 }}>📊 Importa Stock da File</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 'var(--space-lg)' }}>Carica CSV o Excel con colonne: <strong>nome, qty, categoria, costo, prezzo</strong></p>

            <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>📄 Template</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={downloadTemplate} className="btn btn-secondary" style={{ fontSize: 12 }} disabled={stock.length === 0}>
                  📥 Scarica Template ({stock.length} prodotti)
                </button>
              </div>
            </div>

            <div className="input-group" style={{ marginBottom: 'var(--space-lg)' }}>
              <label className="input-label">Carica file (CSV, Excel, Numbers)</label>
              <input ref={csvRef} type="file" accept=".csv,.xlsx,.xls,.numbers" onChange={handleImportFile} style={{ padding: 10, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', width: '100%', fontSize: 14 }} />
            </div>

            {csvError && <div style={{ background: '#FEF2F2', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 13, color: 'var(--danger)', marginBottom: 'var(--space-md)' }}>⚠️ {csvError}</div>}

            {csvRows.length > 0 && (
              <div style={{ marginBottom: 'var(--space-lg)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                  Anteprima: {csvRows.length} prodotti · {csvRows.filter(r => r.matched).length} già esistenti · {csvRows.filter(r => !r.matched).length} nuovi
                </div>
                <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead><tr style={{ background: 'var(--bg-surface)' }}>{['Nome', 'Qty', 'Cat.', 'Costo', 'Prezzo', 'Stato'].map(h => <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>{h}</th>)}</tr></thead>
                    <tbody>
                      {csvRows.map((r, i) => (
                        <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '6px 10px', fontWeight: 600 }}>{r.product_name}</td>
                          <td style={{ padding: '6px 10px' }}>{r.qty}</td>
                          <td style={{ padding: '6px 10px' }}>{r.category}</td>
                          <td style={{ padding: '6px 10px' }}>{r.cost > 0 ? fmt(r.cost) : '—'}</td>
                          <td style={{ padding: '6px 10px' }}>{r.price > 0 ? fmt(r.price) : '—'}</td>
                          <td style={{ padding: '6px 10px' }}>
                            <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, background: r.matched ? 'var(--bg-surface)' : 'var(--success-light)', color: r.matched ? 'var(--text-secondary)' : 'var(--brand-primary)' }}>
                              {r.matched ? '🔄 Aggiorna' : '✨ Nuovo'}
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
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setShowImport(false); setCsvRows([]); setCsvError(null) }}>Chiudi</button>
              {csvRows.length > 0 && (
                <button className="btn btn-primary" style={{ flex: 2 }} onClick={applyImport} disabled={saving}>
                  {saving ? 'Importazione...' : `📥 Importa ${csvRows.length} prodotti`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-xl)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2>🏭 {warehouse?.name || 'Magazzino Centrale'}</h2>
            <button onClick={() => { setRenameTo(warehouse?.name || ''); setShowRename(true) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-tertiary)', padding: 4 }} title="Rinomina">✏️</button>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>{warehouse?.city || warehouse?.address || 'Magazzino principale'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setShowImport(true)} style={{ fontSize: 12 }}>📊 Import CSV/Excel</button>
          <button className="btn btn-primary" onClick={() => setShowAddItem(true)}>+ Aggiungi Prodotto</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
        <div className="kpi-card"><div className="kpi-label">SKU Totali</div><div className="kpi-value">{totalSku}</div></div>
        <div className="kpi-card"><div className="kpi-label">Unità Totali</div><div className="kpi-value">{totalUnits.toLocaleString('it-IT')}</div></div>
        <div className="kpi-card"><div className="kpi-label">Valore Acquisto</div><div className="kpi-value" style={{ fontSize: 18 }}>{fmt(totalValue)}</div></div>
        <div className="kpi-card"><div className="kpi-label">Valore Vendita</div><div className="kpi-value" style={{ fontSize: 18, color: 'var(--success)' }}>{fmt(totalSellValue)}</div></div>
        <div className="kpi-card" style={{ border: lowCount > 0 ? '1.5px solid var(--warning)' : undefined }}>
          <div className="kpi-label">Stock Basso</div>
          <div className="kpi-value" style={{ color: lowCount > 0 ? 'var(--warning)' : undefined }}>{lowCount}</div>
        </div>
        <div className="kpi-card" style={{ border: zeroCount > 0 ? '1.5px solid var(--danger)' : undefined }}>
          <div className="kpi-label">Esauriti</div>
          <div className="kpi-value" style={{ color: zeroCount > 0 ? 'var(--danger)' : undefined }}>{zeroCount}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--space-lg)' }}>
        <button onClick={() => setActiveTab('stock')} className={`badge ${activeTab === 'stock' ? 'badge-brand' : 'badge-gray'}`} style={{ cursor: 'pointer', border: 'none', padding: '7px 18px', fontSize: 13 }}>📦 Inventario ({stock.length})</button>
        <button onClick={() => setActiveTab('movements')} className={`badge ${activeTab === 'movements' ? 'badge-brand' : 'badge-gray'}`} style={{ cursor: 'pointer', border: 'none', padding: '7px 18px', fontSize: 13 }}>📋 Movimenti ({movements.length})</button>
      </div>

      {activeTab === 'stock' && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap', alignItems: 'center' }}>
            <input className="input" placeholder="🔍 Cerca prodotto..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 250 }} />
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setFilterCat('all')} className={`badge ${filterCat === 'all' ? 'badge-brand' : 'badge-gray'}`} style={{ cursor: 'pointer', border: 'none', padding: '5px 10px', fontSize: 11 }}>Tutte</button>
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setFilterCat(c)} className={`badge ${filterCat === c ? 'badge-brand' : 'badge-gray'}`} style={{ cursor: 'pointer', border: 'none', padding: '5px 10px', fontSize: 11 }}>{categoryLabel[c]}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setFilterStock('all')} className={`badge ${filterStock === 'all' ? 'badge-brand' : 'badge-gray'}`} style={{ cursor: 'pointer', border: 'none', padding: '5px 10px', fontSize: 11 }}>Tutti</button>
              <button onClick={() => setFilterStock('low')} className={`badge ${filterStock === 'low' ? 'badge-warning' : 'badge-gray'}`} style={{ cursor: 'pointer', border: 'none', padding: '5px 10px', fontSize: 11 }}>⚠️ Basso ({lowCount})</button>
              <button onClick={() => setFilterStock('zero')} className={`badge ${filterStock === 'zero' ? 'badge-danger' : 'badge-gray'}`} style={{ cursor: 'pointer', border: 'none', padding: '5px 10px', fontSize: 11 }}>🚫 Esaurito ({zeroCount})</button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
              <h3 style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>Magazzino vuoto</h3>
              <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Clicca "Aggiungi Prodotto" per iniziare a caricare merce</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Prodotto</th>
                    <th>Categoria</th>
                    <th>Qty</th>
                    <th>Costo Unit.</th>
                    <th>Prezzo Vend.</th>
                    <th>Valore Stock</th>
                    <th>Stato</th>
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => {
                    const status = getStatus(item)
                    const value = item.qty * (item.cost_per_unit || 0)
                    const margin = item.sell_price && item.cost_per_unit ? ((item.sell_price - item.cost_per_unit) / item.sell_price * 100).toFixed(0) : null
                    return (
                      <tr key={item.id} style={{ background: item.qty === 0 ? '#FEF2F2' : undefined }}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{item.product_name}</div>
                          {item.is_bulk && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>📦 Bulk: {item.bulk_qty} {item.bulk_unit}</div>}
                          {item.notes && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{item.notes}</div>}
                        </td>
                        <td><span className="badge badge-indigo" style={{ fontSize: 10 }}>{categoryLabel[item.category as ProductCategory] || item.category}</span></td>
                        <td style={{ fontWeight: 700, color: status === 'Esaurito' ? 'var(--danger)' : status === 'Basso' ? 'var(--warning)' : 'var(--text-primary)' }}>{item.qty}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{fmt(item.cost_per_unit || 0)}</td>
                        <td>
                          {fmt(item.sell_price || 0)}
                          {margin && <span style={{ fontSize: 10, color: 'var(--success)', marginLeft: 4 }}>({margin}%)</span>}
                        </td>
                        <td style={{ fontWeight: 600 }}>{fmt(value)}</td>
                        <td><span className={`badge ${statusColor[status]}`} style={{ fontSize: 10 }}>{status}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => { setShowMovement({ item, type: 'in' }); setMovementForm({ qty: '', notes: '', cost_per_unit: item.cost_per_unit?.toString() || '' }) }} style={{ padding: '4px 8px', fontSize: 11, fontWeight: 600, background: 'var(--success-light)', border: '1px solid var(--success)', borderRadius: 6, cursor: 'pointer', color: 'var(--success)' }}>+Carico</button>
                            <button onClick={() => { setShowMovement({ item, type: 'out' }); setMovementForm({ qty: '', notes: '', cost_per_unit: '' }) }} style={{ padding: '4px 8px', fontSize: 11, fontWeight: 600, background: '#FEF2F2', border: '1px solid var(--danger)', borderRadius: 6, cursor: 'pointer', color: 'var(--danger)' }}>-Scarico</button>
                            <button onClick={() => deleteItem(item.id)} style={{ padding: '4px 6px', fontSize: 11, background: 'none', border: '1px solid var(--border-default)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-tertiary)' }}>🗑️</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === 'movements' && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Data</th><th>Prodotto</th><th>Tipo</th><th>Qty</th><th>Costo</th><th>Destinazione</th><th>Note</th></tr>
            </thead>
            <tbody>
              {movements.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-tertiary)' }}>Nessun movimento registrato</td></tr>}
              {movements.map(m => {
                const typeLabels: Record<string, { label: string; color: string }> = {
                  in: { label: '📥 Carico', color: 'var(--success)' },
                  out: { label: '📤 Scarico', color: 'var(--danger)' },
                  transfer_out: { label: '🔄 Trasf. Uscita', color: 'var(--warning)' },
                  transfer_in: { label: '🔄 Trasf. Entrata', color: 'var(--accent-blue)' },
                  adjustment: { label: '🔧 Rettifica', color: 'var(--text-secondary)' },
                  damaged: { label: '💔 Danneggiato', color: 'var(--danger)' },
                  return: { label: '↩️ Reso', color: 'var(--accent-indigo)' },
                }
                const tl = typeLabels[m.movement_type] || { label: m.movement_type, color: 'var(--text-secondary)' }
                return (
                  <tr key={m.id}>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{new Date(m.created_at).toLocaleString('it-IT')}</td>
                    <td style={{ fontWeight: 600 }}>{m.product_name}</td>
                    <td><span style={{ color: tl.color, fontWeight: 600, fontSize: 12 }}>{tl.label}</span></td>
                    <td style={{ fontWeight: 700, color: m.movement_type === 'in' || m.movement_type === 'transfer_in' || m.movement_type === 'return' ? 'var(--success)' : 'var(--danger)' }}>
                      {m.movement_type === 'in' || m.movement_type === 'transfer_in' || m.movement_type === 'return' ? '+' : '-'}{m.qty}
                    </td>
                    <td style={{ fontSize: 12 }}>{m.total_cost ? fmt(m.total_cost) : '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{m.destination_name || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{m.notes || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
