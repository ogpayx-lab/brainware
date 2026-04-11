'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmt, categoryLabel } from '@/lib/utils'
import type { ProductCategory } from '@/types/database'

const CATEGORIES: ProductCategory[] = ['flowers', 'hashish', 'oils', 'edibles', 'accessories', 'cosmetics', 'clothes', 'seeds', 'vape', 'food']

export default function WarehouseSecondaryPage() {
  const router = useRouter()
  const supabase = createClient()
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [selectedWh, setSelectedWh] = useState<any>(null)
  const [stock, setStock] = useState<any[]>([])
  const [movements, setMovements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'stock' | 'movements'>('stock')

  // Modals
  const [showCreate, setShowCreate] = useState(false)
  const [showAddItem, setShowAddItem] = useState(false)
  const [showMovement, setShowMovement] = useState<{ item: any; type: 'in' | 'out' } | null>(null)
  const [saving, setSaving] = useState(false)

  // Forms
  const [whForm, setWhForm] = useState({ name: '', city: '', address: '', notes: '' })
  const [newItem, setNewItem] = useState({ product_name: '', category: 'flowers', qty: '0', cost_per_unit: '0', sell_price: '0', stock_alert: '5' })
  const [movementForm, setMovementForm] = useState({ qty: '', notes: '', cost_per_unit: '' })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('users').select('store_id, role, stores(organization_id)').eq('id', user.id).single()
    if (profile?.role !== 'owner') { router.push('/login'); return }
    const oid = (profile.stores as any)?.organization_id
    setOrgId(oid)

    const { data: whs } = await supabase.from('warehouses').select('*').eq('organization_id', oid).eq('type', 'secondary').eq('is_active', true).order('name')
    setWarehouses(whs ?? [])
    setLoading(false)
  }

  async function loadStock(wh: any) {
    setSelectedWh(wh)
    const { data: stockData } = await supabase.from('warehouse_stock').select('*').eq('warehouse_id', wh.id).order('product_name')
    setStock(stockData ?? [])
    const { data: movData } = await supabase.from('warehouse_movements').select('*').eq('warehouse_id', wh.id).order('created_at', { ascending: false }).limit(30)
    setMovements(movData ?? [])
  }

  async function createWarehouse() {
    if (!orgId || !whForm.name) return
    setSaving(true)
    const { error } = await supabase.from('warehouses').insert({ organization_id: orgId, name: whForm.name, type: 'secondary', city: whForm.city || null, address: whForm.address || null, notes: whForm.notes || null })
    if (error) {
      console.error('Create warehouse error:', error)
      alert(`Errore creazione magazzino: ${error.message}`)
      setSaving(false)
      return
    }
    setShowCreate(false)
    setWhForm({ name: '', city: '', address: '', notes: '' })
    setSaving(false)
    loadData()
  }

  async function deleteWarehouse(id: string) {
    if (!confirm('Eliminare questo magazzino e tutto il suo stock?')) return
    await supabase.from('warehouses').update({ is_active: false }).eq('id', id)
    if (selectedWh?.id === id) { setSelectedWh(null); setStock([]) }
    loadData()
  }

  async function addStockItem() {
    if (!selectedWh || !newItem.product_name) return
    setSaving(true)
    const qty = parseInt(newItem.qty) || 0
    await supabase.from('warehouse_stock').insert({
      warehouse_id: selectedWh.id, product_name: newItem.product_name, category: newItem.category,
      qty, cost_per_unit: parseFloat(newItem.cost_per_unit) || 0, sell_price: parseFloat(newItem.sell_price) || 0,
      stock_alert: parseInt(newItem.stock_alert) || 5,
    })
    if (qty > 0) {
      await supabase.from('warehouse_movements').insert({
        warehouse_id: selectedWh.id, product_name: newItem.product_name, movement_type: 'in', qty,
        cost_per_unit: parseFloat(newItem.cost_per_unit) || 0, total_cost: qty * (parseFloat(newItem.cost_per_unit) || 0),
        reference_type: 'purchase', notes: 'Carico iniziale',
      })
    }
    setShowAddItem(false)
    setNewItem({ product_name: '', category: 'flowers', qty: '0', cost_per_unit: '0', sell_price: '0', stock_alert: '5' })
    setSaving(false)
    loadStock(selectedWh)
  }

  async function submitMovement() {
    if (!selectedWh || !showMovement) return
    const item = showMovement.item
    const type = showMovement.type
    const qty = parseInt(movementForm.qty) || 0
    if (qty <= 0) return
    setSaving(true)
    const newQty = type === 'in' ? item.qty + qty : Math.max(0, item.qty - qty)
    const cost = parseFloat(movementForm.cost_per_unit) || item.cost_per_unit || 0
    await supabase.from('warehouse_stock').update({ qty: newQty, updated_at: new Date().toISOString() }).eq('id', item.id)
    await supabase.from('warehouse_movements').insert({
      warehouse_id: selectedWh.id, stock_item_id: item.id, product_name: item.product_name,
      movement_type: type, qty, cost_per_unit: cost, total_cost: qty * cost,
      reference_type: type === 'in' ? 'purchase' : 'manual', notes: movementForm.notes || null,
    })
    setShowMovement(null)
    setMovementForm({ qty: '', notes: '', cost_per_unit: '' })
    setSaving(false)
    loadStock(selectedWh)
  }

  const totalUnits = stock.reduce((s, i) => s + i.qty, 0)
  const totalValue = stock.reduce((s, i) => s + i.qty * (i.cost_per_unit || 0), 0)
  const getStatus = (i: any) => i.qty === 0 ? 'Esaurito' : i.qty <= i.stock_alert ? 'Basso' : 'OK'
  const statusColor: Record<string, string> = { Esaurito: 'badge-danger', Basso: 'badge-warning', OK: 'badge-success' }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>Caricamento...</div>

  return (
    <div>
      {/* Create Warehouse Modal */}
      {showCreate && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 460 }}>
            <h3 style={{ marginBottom: 'var(--space-lg)' }}>📦 Nuovo Magazzino Secondario</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div className="input-group"><label className="input-label">Nome *</label><input className="input" placeholder="Es. Magazzino Nord" value={whForm.name} onChange={e => setWhForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                <div className="input-group"><label className="input-label">Città</label><input className="input" placeholder="Roma" value={whForm.city} onChange={e => setWhForm(f => ({ ...f, city: e.target.value }))} /></div>
                <div className="input-group"><label className="input-label">Indirizzo</label><input className="input" placeholder="Via..." value={whForm.address} onChange={e => setWhForm(f => ({ ...f, address: e.target.value }))} /></div>
              </div>
              <div className="input-group"><label className="input-label">Note</label><input className="input" placeholder="Note opzionali" value={whForm.notes} onChange={e => setWhForm(f => ({ ...f, notes: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-xl)' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowCreate(false)}>Annulla</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={createWarehouse} disabled={saving || !whForm.name}>{saving ? '...' : 'Crea Magazzino'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddItem && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 500 }}>
            <h3 style={{ marginBottom: 'var(--space-lg)' }}>➕ Aggiungi Prodotto — {selectedWh?.name}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div className="input-group"><label className="input-label">Nome *</label><input className="input" value={newItem.product_name} onChange={e => setNewItem(f => ({ ...f, product_name: e.target.value }))} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                <div className="input-group"><label className="input-label">Categoria</label><select className="input" value={newItem.category} onChange={e => setNewItem(f => ({ ...f, category: e.target.value }))}>{CATEGORIES.map(c => <option key={c} value={c}>{categoryLabel[c]}</option>)}</select></div>
                <div className="input-group"><label className="input-label">Qty Iniziale</label><input className="input" type="number" min="0" value={newItem.qty} onChange={e => setNewItem(f => ({ ...f, qty: e.target.value }))} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-md)' }}>
                <div className="input-group"><label className="input-label">Costo (€)</label><input className="input" type="number" step="0.01" value={newItem.cost_per_unit} onChange={e => setNewItem(f => ({ ...f, cost_per_unit: e.target.value }))} /></div>
                <div className="input-group"><label className="input-label">Prezzo (€)</label><input className="input" type="number" step="0.01" value={newItem.sell_price} onChange={e => setNewItem(f => ({ ...f, sell_price: e.target.value }))} /></div>
                <div className="input-group"><label className="input-label">Alert</label><input className="input" type="number" value={newItem.stock_alert} onChange={e => setNewItem(f => ({ ...f, stock_alert: e.target.value }))} /></div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-xl)' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowAddItem(false)}>Annulla</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={addStockItem} disabled={saving || !newItem.product_name}>{saving ? '...' : 'Aggiungi'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Movement Modal */}
      {showMovement && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 420 }}>
            <h3 style={{ marginBottom: 4 }}>{showMovement.type === 'in' ? '📥 Carico' : '📤 Scarico'}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 'var(--space-lg)' }}>{showMovement.item.product_name} — Stock: <strong>{showMovement.item.qty}</strong></p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div className="input-group"><label className="input-label">Quantità</label><input className="input" type="number" min="1" value={movementForm.qty} onChange={e => setMovementForm(f => ({ ...f, qty: e.target.value }))} autoFocus /></div>
              {showMovement.type === 'in' && <div className="input-group"><label className="input-label">Costo (€)</label><input className="input" type="number" step="0.01" value={movementForm.cost_per_unit} onChange={e => setMovementForm(f => ({ ...f, cost_per_unit: e.target.value }))} /></div>}
              <div className="input-group"><label className="input-label">Note</label><input className="input" value={movementForm.notes} onChange={e => setMovementForm(f => ({ ...f, notes: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-xl)' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowMovement(null)}>Annulla</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={submitMovement} disabled={saving || !(parseInt(movementForm.qty) > 0)}>{saving ? '...' : showMovement.type === 'in' ? `📥 +${movementForm.qty || 0}` : `📤 -${movementForm.qty || 0}`}</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-xl)' }}>
        <div>
          <h2>📦 Magazzini Secondari</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>{warehouses.length} magazzini attivi</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Nuovo Magazzino</button>
      </div>

      {/* Warehouse Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--space-lg)', marginBottom: 'var(--space-xl)' }}>
        {warehouses.map(wh => (
          <div key={wh.id} className="card" style={{ cursor: 'pointer', border: selectedWh?.id === wh.id ? '2px solid var(--brand-primary)' : undefined, transition: 'border 0.15s' }} onClick={() => loadStock(wh)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h4>{wh.name}</h4>
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{wh.city || wh.address || '—'}</p>
              </div>
              <button onClick={e => { e.stopPropagation(); deleteWarehouse(wh.id) }} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 14 }}>🗑️</button>
            </div>
            {wh.notes && <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>{wh.notes}</p>}
          </div>
        ))}
        {warehouses.length === 0 && (
          <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
            <h3 style={{ color: 'var(--text-secondary)' }}>Nessun magazzino secondario</h3>
            <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Crea il primo per gestire stock distribuito</p>
          </div>
        )}
      </div>

      {/* Selected Warehouse Detail */}
      {selectedWh && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
            <div>
              <h3>{selectedWh.name} — Inventario</h3>
              <div style={{ display: 'flex', gap: 'var(--space-lg)', marginTop: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>SKU: <strong>{stock.length}</strong></span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Unità: <strong>{totalUnits}</strong></span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Valore: <strong>{fmt(totalValue)}</strong></span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={() => setShowAddItem(true)}>+ Aggiungi</button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--space-lg)' }}>
            <button onClick={() => setActiveTab('stock')} className={`badge ${activeTab === 'stock' ? 'badge-brand' : 'badge-gray'}`} style={{ cursor: 'pointer', border: 'none', padding: '7px 18px', fontSize: 13 }}>Inventario</button>
            <button onClick={() => setActiveTab('movements')} className={`badge ${activeTab === 'movements' ? 'badge-brand' : 'badge-gray'}`} style={{ cursor: 'pointer', border: 'none', padding: '7px 18px', fontSize: 13 }}>Movimenti</button>
          </div>

          {activeTab === 'stock' && (
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Prodotto</th><th>Cat.</th><th>Qty</th><th>Costo</th><th>Stato</th><th>Azioni</th></tr></thead>
                <tbody>
                  {stock.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-tertiary)' }}>Vuoto — aggiungi prodotti</td></tr>}
                  {stock.map(item => {
                    const status = getStatus(item)
                    return (
                      <tr key={item.id}>
                        <td style={{ fontWeight: 600 }}>{item.product_name}</td>
                        <td><span className="badge badge-indigo" style={{ fontSize: 10 }}>{categoryLabel[item.category as ProductCategory] || item.category}</span></td>
                        <td style={{ fontWeight: 700, color: status === 'Esaurito' ? 'var(--danger)' : status === 'Basso' ? 'var(--warning)' : undefined }}>{item.qty}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{fmt(item.cost_per_unit || 0)}</td>
                        <td><span className={`badge ${statusColor[status]}`} style={{ fontSize: 10 }}>{status}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => { setShowMovement({ item, type: 'in' }); setMovementForm({ qty: '', notes: '', cost_per_unit: '' }) }} style={{ padding: '3px 7px', fontSize: 11, fontWeight: 600, background: 'var(--success-light)', border: '1px solid var(--success)', borderRadius: 6, cursor: 'pointer', color: 'var(--success)' }}>+</button>
                            <button onClick={() => { setShowMovement({ item, type: 'out' }); setMovementForm({ qty: '', notes: '', cost_per_unit: '' }) }} style={{ padding: '3px 7px', fontSize: 11, fontWeight: 600, background: '#FEF2F2', border: '1px solid var(--danger)', borderRadius: 6, cursor: 'pointer', color: 'var(--danger)' }}>-</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'movements' && (
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Data</th><th>Prodotto</th><th>Tipo</th><th>Qty</th><th>Note</th></tr></thead>
                <tbody>
                  {movements.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-tertiary)' }}>Nessun movimento</td></tr>}
                  {movements.map(m => (
                    <tr key={m.id}>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{new Date(m.created_at).toLocaleString('it-IT')}</td>
                      <td style={{ fontWeight: 600 }}>{m.product_name}</td>
                      <td><span style={{ fontWeight: 600, fontSize: 12, color: m.movement_type === 'in' ? 'var(--success)' : 'var(--danger)' }}>{m.movement_type === 'in' ? '📥 Carico' : '📤 Scarico'}</span></td>
                      <td style={{ fontWeight: 700, color: m.movement_type === 'in' ? 'var(--success)' : 'var(--danger)' }}>{m.movement_type === 'in' ? '+' : '-'}{m.qty}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{m.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
