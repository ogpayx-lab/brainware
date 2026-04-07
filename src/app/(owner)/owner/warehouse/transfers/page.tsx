'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmt, categoryLabel } from '@/lib/utils'

type TransferType = 'wh_to_store' | 'wh_to_wh' | 'store_to_store'

export default function WarehouseTransfersPage() {
  const router = useRouter()
  const supabase = createClient()
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [stores, setStores] = useState<any[]>([])
  const [movements, setMovements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [orgId, setOrgId] = useState<string | null>(null)

  // New transfer
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [transferType, setTransferType] = useState<TransferType>('wh_to_store')
  const [sourceId, setSourceId] = useState('')
  const [destId, setDestId] = useState('')
  const [sourceStock, setSourceStock] = useState<any[]>([])
  const [items, setItems] = useState<{ stock_item_id: string; product_name: string; qty: string; available: number }[]>([])

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('users').select('store_id, role, stores(organization_id)').eq('id', user.id).single()
    if (profile?.role !== 'owner') { router.push('/login'); return }
    const oid = (profile.stores as any)?.organization_id
    setOrgId(oid)

    const { data: whs } = await supabase.from('warehouses').select('*').eq('organization_id', oid).eq('is_active', true).order('type', { ascending: true })
    setWarehouses(whs ?? [])

    const { data: sts } = await supabase.from('stores').select('*').eq('organization_id', oid).eq('is_active', true).order('name')
    setStores(sts ?? [])

    const { data: movs } = await supabase.from('warehouse_movements').select('*').in('movement_type', ['transfer_out', 'transfer_in']).order('created_at', { ascending: false }).limit(50)
    setMovements(movs ?? [])
    setLoading(false)
  }

  async function loadSourceStock(whId: string) {
    setSourceId(whId)
    if (transferType === 'store_to_store') {
      const { data: prods } = await supabase.from('products').select('id, name, stock').eq('store_id', whId).eq('is_active', true).gt('stock', 0).order('name')
      setSourceStock((prods ?? []).map(p => ({ ...p, product_name: p.name, qty: p.stock })))
    } else {
      const { data: stock } = await supabase.from('warehouse_stock').select('*').eq('warehouse_id', whId).gt('qty', 0).order('product_name')
      setSourceStock(stock ?? [])
    }
    setItems([])
  }

  function addItem() {
    setItems(prev => [...prev, { stock_item_id: '', product_name: '', qty: '', available: 0 }])
  }

  function updateItem(idx: number, field: string, value: string) {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it
      if (field === 'stock_item_id') {
        const src = sourceStock.find(s => s.id === value)
        return { ...it, stock_item_id: value, product_name: src?.product_name || src?.name || '', available: src?.qty || src?.stock || 0 }
      }
      return { ...it, [field]: value }
    }))
  }

  async function submitTransfer() {
    const validItems = items.filter(i => i.stock_item_id && parseInt(i.qty) > 0)
    if (!sourceId || !destId || validItems.length === 0) return
    setSaving(true)

    const destName = transferType === 'wh_to_store'
      ? stores.find(s => s.id === destId)?.name
      : transferType === 'wh_to_wh'
        ? warehouses.find(w => w.id === destId)?.name
        : stores.find(s => s.id === destId)?.name
    const sourceName = transferType === 'store_to_store'
      ? stores.find(s => s.id === sourceId)?.name
      : warehouses.find(w => w.id === sourceId)?.name

    for (const item of validItems) {
      const qty = parseInt(item.qty)

      if (transferType === 'wh_to_store') {
        // Decrease warehouse stock
        const src = sourceStock.find(s => s.id === item.stock_item_id)
        if (src) {
          await supabase.from('warehouse_stock').update({ qty: Math.max(0, src.qty - qty) }).eq('id', src.id)
        }
        // Increase store product stock (find by name match)
        const { data: storeProduct } = await supabase.from('products').select('id, stock').eq('store_id', destId).ilike('name', item.product_name).single()
        if (storeProduct) {
          await supabase.from('products').update({ stock: storeProduct.stock + qty }).eq('id', storeProduct.id)
        }
        // Log movement OUT
        await supabase.from('warehouse_movements').insert({
          warehouse_id: sourceId, stock_item_id: item.stock_item_id, product_name: item.product_name,
          movement_type: 'transfer_out', qty, destination_type: 'store', destination_id: destId,
          destination_name: destName, reference_type: 'store_restock', notes: `Trasferimento a ${destName}`,
        })
      } else if (transferType === 'wh_to_wh') {
        // Decrease source warehouse
        const src = sourceStock.find(s => s.id === item.stock_item_id)
        if (src) {
          await supabase.from('warehouse_stock').update({ qty: Math.max(0, src.qty - qty) }).eq('id', src.id)
        }
        // Increase or create dest warehouse stock
        const { data: destItem } = await supabase.from('warehouse_stock').select('id, qty').eq('warehouse_id', destId).ilike('product_name', item.product_name).single()
        if (destItem) {
          await supabase.from('warehouse_stock').update({ qty: destItem.qty + qty }).eq('id', destItem.id)
        } else {
          await supabase.from('warehouse_stock').insert({
            warehouse_id: destId, product_name: item.product_name,
            category: src?.category || 'flowers', qty, cost_per_unit: src?.cost_per_unit || 0,
            sell_price: src?.sell_price || 0, stock_alert: src?.stock_alert || 5,
          })
        }
        // Log movements
        await supabase.from('warehouse_movements').insert({
          warehouse_id: sourceId, stock_item_id: item.stock_item_id, product_name: item.product_name,
          movement_type: 'transfer_out', qty, destination_type: 'warehouse', destination_id: destId,
          destination_name: destName, reference_type: 'warehouse_transfer',
        })
        await supabase.from('warehouse_movements').insert({
          warehouse_id: destId, product_name: item.product_name,
          movement_type: 'transfer_in', qty, destination_type: 'warehouse', destination_id: sourceId,
          destination_name: sourceName, reference_type: 'warehouse_transfer',
        })
      } else if (transferType === 'store_to_store') {
        // Decrease source store
        const src = sourceStock.find(s => s.id === item.stock_item_id)
        if (src) {
          await supabase.from('products').update({ stock: Math.max(0, (src.stock || src.qty) - qty) }).eq('id', src.id)
        }
        // Increase dest store
        const { data: destProduct } = await supabase.from('products').select('id, stock').eq('store_id', destId).ilike('name', item.product_name).single()
        if (destProduct) {
          await supabase.from('products').update({ stock: destProduct.stock + qty }).eq('id', destProduct.id)
        }
      }
    }

    setShowNew(false)
    setItems([])
    setSourceId('')
    setDestId('')
    setSaving(false)
    loadData()
  }

  const typeLabels: Record<TransferType, string> = {
    wh_to_store: '🏭→🏪 Magazzino → Store',
    wh_to_wh: '📦→📦 Magazzino → Magazzino',
    store_to_store: '🏪→🏪 Store → Store',
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>Caricamento...</div>

  return (
    <div>
      {/* New Transfer Modal */}
      {showNew && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 620 }}>
            <h3 style={{ marginBottom: 'var(--space-lg)' }}>🔄 Nuovo Trasferimento</h3>

            {/* Transfer type */}
            <div className="input-group" style={{ marginBottom: 'var(--space-md)' }}>
              <label className="input-label">Tipo Trasferimento</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {(Object.keys(typeLabels) as TransferType[]).map(t => (
                  <button key={t} onClick={() => { setTransferType(t); setSourceId(''); setDestId(''); setSourceStock([]); setItems([]) }}
                    className={`badge ${transferType === t ? 'badge-brand' : 'badge-gray'}`}
                    style={{ cursor: 'pointer', border: 'none', padding: '6px 14px', fontSize: 12 }}>
                    {typeLabels[t]}
                  </button>
                ))}
              </div>
            </div>

            {/* Source */}
            <div className="input-group" style={{ marginBottom: 'var(--space-md)' }}>
              <label className="input-label">Origine</label>
              <select className="input" value={sourceId} onChange={e => loadSourceStock(e.target.value)}>
                <option value="">Seleziona...</option>
                {transferType === 'store_to_store'
                  ? stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                  : warehouses.map(w => <option key={w.id} value={w.id}>{w.type === 'central' ? '🏭 ' : '📦 '}{w.name}</option>)
                }
              </select>
            </div>

            {/* Destination */}
            <div className="input-group" style={{ marginBottom: 'var(--space-md)' }}>
              <label className="input-label">Destinazione</label>
              <select className="input" value={destId} onChange={e => setDestId(e.target.value)}>
                <option value="">Seleziona...</option>
                {transferType === 'wh_to_store'
                  ? stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                  : transferType === 'wh_to_wh'
                    ? warehouses.filter(w => w.id !== sourceId).map(w => <option key={w.id} value={w.id}>{w.name}</option>)
                    : stores.filter(s => s.id !== sourceId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                }
              </select>
            </div>

            {/* Items */}
            {sourceId && (
              <div style={{ marginBottom: 'var(--space-md)' }}>
                <label className="input-label" style={{ marginBottom: 8, display: 'block' }}>Prodotti da trasferire</label>
                {items.map((item, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 32px', gap: 8, marginBottom: 8 }}>
                    <select className="input" value={item.stock_item_id} onChange={e => updateItem(i, 'stock_item_id', e.target.value)}>
                      <option value="">Seleziona prodotto...</option>
                      {sourceStock.map(s => (
                        <option key={s.id} value={s.id}>{s.product_name || s.name} (disp: {s.qty || s.stock})</option>
                      ))}
                    </select>
                    <input className="input" type="number" min="1" max={item.available} placeholder="Qty" value={item.qty}
                      onChange={e => updateItem(i, 'qty', e.target.value)} style={{ textAlign: 'center' }} />
                    {items.length > 1 && (
                      <button onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))}
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 16, cursor: 'pointer' }}>✕</button>
                    )}
                  </div>
                ))}
                <button onClick={addItem} style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', fontSize: 13, cursor: 'pointer', padding: 0 }}>+ Aggiungi prodotto</button>
              </div>
            )}

            {items.some(i => parseInt(i.qty) > 0) && (
              <div style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 'var(--space-lg)' }}>
                <strong>Riepilogo:</strong> {items.filter(i => parseInt(i.qty) > 0).length} prodotti, {items.reduce((s, i) => s + (parseInt(i.qty) || 0), 0)} unità totali
              </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setShowNew(false); setItems([]) }}>Annulla</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={submitTransfer}
                disabled={saving || !sourceId || !destId || items.every(i => !i.stock_item_id || !(parseInt(i.qty) > 0))}>
                {saving ? 'Trasferimento...' : '🔄 Trasferisci'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-xl)' }}>
        <div>
          <h2>🔄 Trasferimenti</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>Gestisci i trasferimenti tra magazzini e store</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowNew(true); addItem() }}>+ Nuovo Trasferimento</button>
      </div>

      {/* Summary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
        <div className="kpi-card"><div className="kpi-label">Magazzini</div><div className="kpi-value">{warehouses.length}</div></div>
        <div className="kpi-card"><div className="kpi-label">Store</div><div className="kpi-value">{stores.length}</div></div>
        <div className="kpi-card"><div className="kpi-label">Trasferimenti Recenti</div><div className="kpi-value">{movements.length}</div></div>
      </div>

      {/* Transfers History */}
      <h4 style={{ marginBottom: 'var(--space-md)' }}>Storico Trasferimenti</h4>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr><th>Data</th><th>Prodotto</th><th>Tipo</th><th>Qty</th><th>Destinazione</th><th>Note</th></tr>
          </thead>
          <tbody>
            {movements.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-tertiary)' }}>Nessun trasferimento</td></tr>}
            {movements.map(m => (
              <tr key={m.id}>
                <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{new Date(m.created_at).toLocaleString('it-IT')}</td>
                <td style={{ fontWeight: 600 }}>{m.product_name}</td>
                <td>
                  <span style={{ fontWeight: 600, fontSize: 12, color: m.movement_type === 'transfer_in' ? 'var(--success)' : 'var(--warning)' }}>
                    {m.movement_type === 'transfer_in' ? '📥 Entrata' : '📤 Uscita'}
                  </span>
                </td>
                <td style={{ fontWeight: 700, color: m.movement_type === 'transfer_in' ? 'var(--success)' : 'var(--danger)' }}>
                  {m.movement_type === 'transfer_in' ? '+' : '-'}{m.qty}
                </td>
                <td style={{ fontSize: 13 }}>{m.destination_name || '—'}</td>
                <td style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{m.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
