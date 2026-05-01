'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmt, formatDate } from '@/lib/utils'

type TransferType = 'wh_to_store' | 'wh_to_wh' | 'store_to_store'

export default function StockApprovalsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [requests, setRequests] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [restockRequests, setRestockRequests] = useState<any[]>([])
  const [pendingTransfers, setPendingTransfers] = useState<any[]>([])
  const [transferLog, setTransferLog] = useState<any[]>([])
  const [stores, setStores] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [selectedStore, setSelectedStore] = useState('all')
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editQtys, setEditQtys] = useState<Record<string, number>>({})
  const [processing, setProcessing] = useState(false)

  // Restock fulfillment modal
  const [fulfilling, setFulfilling] = useState<any>(null)
  const [fulfillSource, setFulfillSource] = useState('')
  const [fulfillSourceStock, setFulfillSourceStock] = useState<any[]>([])
  const [fulfillItems, setFulfillItems] = useState<{ product_name: string; qty: string; available: number }[]>([])
  const [fulfillSaving, setFulfillSaving] = useState(false)

  // New transfer modal (merged from transfers page)
  const [showNewTransfer, setShowNewTransfer] = useState(false)
  const [transferSaving, setTransferSaving] = useState(false)
  const [transferType, setTransferType] = useState<TransferType>('wh_to_store')
  const [sourceId, setSourceId] = useState('')
  const [destId, setDestId] = useState('')
  const [sourceStock, setSourceStock] = useState<any[]>([])
  const [transferItems, setTransferItems] = useState<{ stock_item_id: string; product_name: string; qty: string; available: number }[]>([])
  const [orgId, setOrgId] = useState<string | null>(null)

  useEffect(() => { loadData() }, [selectedStore])

  async function loadData() {
    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('users').select('store_id, role, stores(organization_id)').eq('id', user.id).single()
    if (profile?.role !== 'owner') { router.push('/login'); return }
    const oid = (profile.stores as any)?.organization_id
    setOrgId(oid)

    const { data: storesData } = await supabase.from('stores').select('id,name').eq('organization_id', oid)
    setStores(storesData ?? [])

    const { data: whsData } = await supabase.from('warehouses').select('id,name,type').eq('organization_id', oid).eq('is_active', true)
    setWarehouses(whsData ?? [])

    const storeIds = selectedStore === 'all' ? (storesData ?? []).map(s => s.id) : [selectedStore]

    // Pending reviews
    const { data: pending } = await supabase
      .from('stock_requests')
      .select('*, stock_request_items(*), users(full_name), stores(name)')
      .in('store_id', storeIds)
      .eq('status', 'owner_review')
      .order('created_at', { ascending: false })
    setRequests(pending ?? [])

    // Restock requests (from employee notifications — show last 7 days, not yet handled)
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
    const { data: restocks } = await supabase
      .from('notifications')
      .select('*')
      .in('store_id', storeIds)
      .eq('type', 'restock_request')
      .gte('created_at', weekAgo)
      .order('created_at', { ascending: false })
    setRestockRequests(restocks ?? [])

    // Pending transfers (sent, waiting employee count)
    const { data: pendingT } = await supabase
      .from('stock_requests')
      .select('*, stock_request_items(*), users(full_name), stores(name)')
      .in('store_id', storeIds)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    setPendingTransfers(pendingT ?? [])

    // History
    const { data: hist } = await supabase
      .from('stock_requests')
      .select('*, stock_request_items(*), users(full_name), stores(name)')
      .in('store_id', storeIds)
      .in('status', ['approved', 'rejected'])
      .order('approved_at', { ascending: false })
      .limit(30)
    setHistory(hist ?? [])

    // Warehouse transfer movements log
    const { data: movs } = await supabase
      .from('warehouse_movements')
      .select('*')
      .in('movement_type', ['transfer_out', 'transfer_in'])
      .order('created_at', { ascending: false })
      .limit(50)
    setTransferLog(movs ?? [])

    setLoading(false)
  }

  function expandRequest(req: any) {
    if (expandedId === req.id) { setExpandedId(null); return }
    setExpandedId(req.id)
    const qtys: Record<string, number> = {}
    for (const item of (req.stock_request_items || [])) {
      qtys[item.id] = item.qty_requested || 0
    }
    setEditQtys(qtys)
  }

  async function approveRequest(req: any) {
    setProcessing(true)
    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user

    for (const item of (req.stock_request_items || [])) {
      const approvedQty = editQtys[item.id] ?? item.qty_requested ?? 0
      await supabase.from('stock_request_items').update({
        qty_delivered: approvedQty,
      }).eq('id', item.id)

      // Update product stock
      if (item.product_id && approvedQty > 0) {
        const { data: prod } = await supabase.from('products').select('stock').eq('id', item.product_id).single()
        if (prod) {
          await supabase.from('products').update({
            stock: prod.stock + approvedQty,
          }).eq('id', item.product_id)
        }
      }
    }

    await supabase.from('stock_requests').update({
      status: 'approved',
      approved_by: user?.id,
      approved_at: new Date().toISOString(),
    }).eq('id', req.id)

    await supabase.from('notifications').insert({
      store_id: req.store_id,
      type: 'stock_approved',
      title: '✅ Stock approvato',
      message: `La ricarica stock è stata approvata. Lo stock è stato aggiornato.`,
    })

    setExpandedId(null)
    setProcessing(false)
    loadData()
  }

  async function rejectRequest(req: any) {
    setProcessing(true)
    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user

    await supabase.from('stock_requests').update({
      status: 'rejected',
      approved_by: user?.id,
      approved_at: new Date().toISOString(),
      notes: (req.notes || '') + ' [RIFIUTATO]',
    }).eq('id', req.id)

    await supabase.from('notifications').insert({
      store_id: req.store_id,
      type: 'stock_rejected',
      title: '❌ Stock rifiutato',
      message: `La ricarica stock è stata rifiutata dall'owner.`,
    })

    setExpandedId(null)
    setProcessing(false)
    loadData()
  }

  // === RESTOCK FULFILLMENT ===
  async function openFulfillment(notif: any) {
    setFulfilling(notif)
    setFulfillSource('')
    setFulfillSourceStock([])

    // Try to load items from linked stock_request
    let items: { product_name: string; qty: string; available: number }[] = []

    // Check for metadata with stock_request_id
    let srId: string | null = null
    try {
      const meta = typeof notif.metadata === 'string' ? JSON.parse(notif.metadata) : notif.metadata
      srId = meta?.stock_request_id || null
    } catch {}

    if (srId) {
      const { data: srItems } = await supabase
        .from('stock_request_items')
        .select('product_name, product_id')
        .eq('stock_request_id', srId)
      items = (srItems ?? []).map(i => ({ product_name: i.product_name, qty: '', available: 0 }))
    }

    // Fallback: find restock_requested stock_request for this store
    if (items.length === 0) {
      const { data: srs } = await supabase
        .from('stock_requests')
        .select('id, stock_request_items(product_name, product_id)')
        .eq('store_id', notif.store_id)
        .eq('status', 'restock_requested')
        .order('created_at', { ascending: false })
        .limit(1)
      if (srs && srs[0]) {
        srId = srs[0].id
        items = ((srs[0] as any).stock_request_items ?? []).map((i: any) => ({ product_name: i.product_name, qty: '', available: 0 }))
      }
    }

    // Last resort: parse from message
    if (items.length === 0) {
      const msgProducts = parseProductsFromMessage(notif.message)
      items = msgProducts.map(name => ({ product_name: name, qty: '', available: 0 }))
    }

    // Store request ID for later use
    setFulfilling({ ...notif, _stock_request_id: srId })
    setFulfillItems(items)
  }

  function parseProductsFromMessage(message: string): string[] {
    const match = message.match(/prodotti:\s*(.+)$/i)
    if (!match) return []
    return match[1].split(',').map(s => {
      const nameMatch = s.trim().match(/^(.+?)\s*\(stock:/)
      return nameMatch ? nameMatch[1].trim() : s.trim()
    }).filter(Boolean)
  }

  async function loadFulfillSourceStock(whId: string) {
    setFulfillSource(whId)
    const { data } = await supabase.from('warehouse_stock').select('*').eq('warehouse_id', whId).order('product_name')
    setFulfillSourceStock(data ?? [])
    // Auto-match product names
    setFulfillItems(prev => prev.map(item => {
      const match = (data ?? []).find(s => s.product_name.toLowerCase() === item.product_name.toLowerCase())
      return { ...item, available: match?.qty ?? 0 }
    }))
  }

  async function submitFulfillment() {
    if (!fulfilling || !fulfillSource) return
    const validItems = fulfillItems.filter(i => parseInt(i.qty) > 0)
    if (validItems.length === 0) { alert('Inserisci almeno una quantità'); return }

    // Validate quantities don't exceed available stock
    for (const item of validItems) {
      const qty = parseInt(item.qty) || 0
      const sourceItem = fulfillSourceStock.find(s => s.product_name.toLowerCase() === item.product_name.toLowerCase())
      if (!sourceItem || qty > sourceItem.qty) {
        alert(`⚠️ ${item.product_name}: disponibili solo ${sourceItem?.qty ?? 0}, richiesti ${qty}`)
        return
      }
    }

    setFulfillSaving(true)

    const destStoreId = fulfilling.store_id
    const destStore = stores.find(s => s.id === destStoreId)
    const sourceWh = warehouses.find(w => w.id === fulfillSource)

    for (const item of validItems) {
      const qty = parseInt(item.qty) || 0
      if (qty <= 0) continue

      // Deduct from warehouse
      const sourceItem = fulfillSourceStock.find(s => s.product_name.toLowerCase() === item.product_name.toLowerCase())
      if (sourceItem) {
        await supabase.from('warehouse_stock').update({
          qty: Math.max(0, sourceItem.qty - qty),
          updated_at: new Date().toISOString(),
        }).eq('id', sourceItem.id)

        // Log warehouse movement
        await supabase.from('warehouse_movements').insert({
          warehouse_id: fulfillSource,
          stock_item_id: sourceItem.id,
          product_name: item.product_name,
          movement_type: 'transfer_out',
          qty,
          cost_per_unit: sourceItem.cost_per_unit || 0,
          total_cost: qty * (sourceItem.cost_per_unit || 0),
          reference_type: 'transfer',
          destination_name: destStore?.name || 'Store',
          notes: `Ricarica da richiesta dipendente`,
        })
      }
    }

    // Create stock_request in pending status (employee must count)
    const { data: sr } = await supabase.from('stock_requests').insert({
      store_id: destStoreId,
      status: 'pending',
      notes: `Ricarica da magazzino ${sourceWh?.name || ''} — richiesta dipendente`,
    }).select('id').single()

    if (sr) {
      for (const item of validItems) {
        const qty = parseInt(item.qty) || 0
        if (qty <= 0) continue
        // Find the product_id in the destination store
        const { data: prod } = await supabase.from('products').select('id, stock').eq('store_id', destStoreId).ilike('name', item.product_name).single()
        await supabase.from('stock_request_items').insert({
          stock_request_id: sr.id,
          product_id: prod?.id || null,
          product_name: item.product_name,
          stock_before: prod?.stock ?? 0,
          qty_requested: 0,
          qty_sent: qty,
        })
      }
    }

    // Mark notification as read
    await supabase.from('notifications').update({ read: true }).eq('id', fulfilling.id)

    // Mark original restock request as handled
    if (fulfilling._stock_request_id) {
      await supabase.from('stock_requests').update({
        status: 'approved',
        notes: `Gestita — trasferimento da ${sourceWh?.name || 'magazzino'}`,
      }).eq('id', fulfilling._stock_request_id)
    }

    // Notify store
    await supabase.from('notifications').insert({
      store_id: destStoreId,
      type: 'stock_transfer',
      title: '📦 Merce in arrivo',
      message: `Spediti ${validItems.length} prodotti da ${sourceWh?.name || 'magazzino'}. Conta la merce ricevuta in "Ricarica Stock".`,
    })

    setFulfillSaving(false)
    setFulfilling(null)
    loadData()
  }

  async function dismissRestock(id: string) {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setRestockRequests(prev => prev.filter(r => r.id !== id))
  }

  // === TRANSFER CREATION (merged from transfers page) ===
  const typeLabels: Record<TransferType, string> = {
    wh_to_store: '🏭→🏪 Magazzino → Store',
    wh_to_wh: '📦→📦 Magazzino → Magazzino',
    store_to_store: '🏪→🏪 Store → Store',
  }

  async function loadTransferSourceStock(whId: string) {
    setSourceId(whId)
    if (transferType === 'store_to_store') {
      const { data: prods } = await supabase.from('products').select('id, name, stock').eq('store_id', whId).eq('is_active', true).gt('stock', 0).order('name')
      setSourceStock((prods ?? []).map(p => ({ ...p, product_name: p.name, qty: p.stock })))
    } else {
      const { data: stock } = await supabase.from('warehouse_stock').select('*').eq('warehouse_id', whId).gt('qty', 0).order('product_name')
      setSourceStock(stock ?? [])
    }
    setTransferItems([])
  }

  function addTransferItem() {
    setTransferItems(prev => [...prev, { stock_item_id: '', product_name: '', qty: '', available: 0 }])
  }

  function updateTransferItem(idx: number, field: string, value: string) {
    setTransferItems(prev => prev.map((it, i) => {
      if (i !== idx) return it
      if (field === 'stock_item_id') {
        const src = sourceStock.find(s => s.id === value)
        return { ...it, stock_item_id: value, product_name: src?.product_name || src?.name || '', available: src?.qty || src?.stock || 0 }
      }
      return { ...it, [field]: value }
    }))
  }

  async function submitTransfer() {
    const validItems = transferItems.filter(i => i.stock_item_id && parseInt(i.qty) > 0)
    if (!sourceId || !destId || validItems.length === 0) return
    for (const item of validItems) {
      if (parseInt(item.qty) > item.available) {
        alert(`Quantità per "${item.product_name}" (${item.qty}) supera la disponibilità (${item.available})`)
        return
      }
    }
    setTransferSaving(true)
    const destName = transferType === 'wh_to_store'
      ? stores.find(s => s.id === destId)?.name
      : transferType === 'wh_to_wh'
        ? warehouses.find(w => w.id === destId)?.name
        : stores.find(s => s.id === destId)?.name
    const sourceName = transferType === 'store_to_store'
      ? stores.find(s => s.id === sourceId)?.name
      : warehouses.find(w => w.id === sourceId)?.name
    const isStoreDestination = transferType === 'wh_to_store' || transferType === 'store_to_store'

    for (const item of validItems) {
      const qty = parseInt(item.qty)
      if (transferType === 'wh_to_store') {
        const src = sourceStock.find(s => s.id === item.stock_item_id)
        if (src) await supabase.from('warehouse_stock').update({ qty: Math.max(0, src.qty - qty) }).eq('id', src.id)
        await supabase.from('warehouse_movements').insert({
          warehouse_id: sourceId, stock_item_id: item.stock_item_id, product_name: item.product_name,
          movement_type: 'transfer_out', qty, destination_type: 'store', destination_id: destId,
          destination_name: destName, reference_type: 'store_restock', notes: `Trasferimento a ${destName}`,
        })
      } else if (transferType === 'wh_to_wh') {
        const src = sourceStock.find(s => s.id === item.stock_item_id)
        if (src) await supabase.from('warehouse_stock').update({ qty: Math.max(0, src.qty - qty) }).eq('id', src.id)
        const { data: destItem } = await supabase.from('warehouse_stock').select('id, qty').eq('warehouse_id', destId).ilike('product_name', item.product_name).single()
        if (destItem) {
          await supabase.from('warehouse_stock').update({ qty: destItem.qty + qty }).eq('id', destItem.id)
        } else {
          await supabase.from('warehouse_stock').insert({ warehouse_id: destId, product_name: item.product_name, category: src?.category || 'flowers', qty, cost_per_unit: src?.cost_per_unit || 0, sell_price: src?.sell_price || 0, stock_alert: src?.stock_alert || 5 })
        }
        await supabase.from('warehouse_movements').insert({ warehouse_id: sourceId, stock_item_id: item.stock_item_id, product_name: item.product_name, movement_type: 'transfer_out', qty, destination_type: 'warehouse', destination_id: destId, destination_name: destName, reference_type: 'warehouse_transfer' })
        await supabase.from('warehouse_movements').insert({ warehouse_id: destId, product_name: item.product_name, movement_type: 'transfer_in', qty, destination_type: 'warehouse', destination_id: sourceId, destination_name: sourceName, reference_type: 'warehouse_transfer' })
      } else if (transferType === 'store_to_store') {
        const src = sourceStock.find(s => s.id === item.stock_item_id)
        if (src) await supabase.from('products').update({ stock: Math.max(0, (src.stock || src.qty) - qty) }).eq('id', src.id)
      }
    }

    if (isStoreDestination) {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
      const { data: openShift } = await supabase.from('shifts').select('id').eq('store_id', destId).eq('status', 'open').limit(1).single()
      const { data: req } = await supabase.from('stock_requests').insert({
        shift_id: openShift?.id || null, store_id: destId, user_id: user?.id, status: 'pending',
        notes: `Trasferimento da ${sourceName} — in attesa di conteggio`,
      }).select('id').single()
      if (req) {
        for (const item of validItems) {
          const qty = parseInt(item.qty)
          const { data: prod } = await supabase.from('products').select('id, stock').eq('store_id', destId).ilike('name', item.product_name).single()
          if (prod) {
            await supabase.from('stock_request_items').insert({
              stock_request_id: req.id, product_id: prod.id, product_name: item.product_name,
              stock_before: prod.stock, qty_requested: 0, qty_sent: qty,
            })
          }
        }
        await supabase.from('notifications').insert({
          store_id: destId, type: 'stock_transfer',
          title: '📦 Trasferimento in arrivo',
          message: `${validItems.length} prodotti da ${sourceName}. Conta la merce in "Ricarica Stock".`,
        })
      }
    }
    setShowNewTransfer(false)
    setTransferItems([])
    setSourceId('')
    setDestId('')
    setTransferSaving(false)
    loadData()
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>Caricamento...</div>

  return (
    <div>
      {/* Fulfillment Modal */}
      {fulfilling && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 600 }}>
            <h3 style={{ marginBottom: 4 }}>📦 Gestisci Ricarica</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 'var(--space-lg)' }}>
              {fulfilling.message}
            </p>

            {/* Source warehouse */}
            <div className="input-group" style={{ marginBottom: 'var(--space-lg)' }}>
              <label className="input-label">Da quale magazzino spedire? *</label>
              <select className="input" value={fulfillSource} onChange={e => loadFulfillSourceStock(e.target.value)}>
                <option value="">Seleziona magazzino...</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.type === 'central' ? '🏭 ' : '📦 '}{w.name}</option>
                ))}
              </select>
            </div>

            {/* Items with quantities */}
            {fulfillSource && (
              <>
                {/* Available products */}
                {fulfillItems.filter(i => i.available > 0).length > 0 && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                      ✅ Disponibili in magazzino — inserisci quantità
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 'var(--space-lg)' }}>
                      {fulfillItems.filter(i => i.available > 0).map((item, idx) => {
                        const realIdx = fulfillItems.indexOf(item)
                        return (
                          <div key={realIdx} style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 14px', background: 'var(--bg-surface)', borderRadius: 10,
                            border: '1.5px solid var(--success)',
                          }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, fontSize: 14 }}>{item.product_name}</div>
                              <div style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>
                                Disponibile: {item.available}
                              </div>
                            </div>
                            <input
                              type="number" min="0" max={item.available}
                              placeholder="Qty"
                              value={item.qty}
                              onChange={e => {
                                const val = Math.min(parseInt(e.target.value) || 0, item.available)
                                setFulfillItems(prev => prev.map((p, i) => i === realIdx ? { ...p, qty: val.toString() } : p))
                              }}
                              style={{
                                width: 80, textAlign: 'center', border: '1.5px solid var(--success)',
                                borderRadius: 8, padding: '8px', fontSize: 14, fontWeight: 700,
                              }}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}

                {/* Unavailable products */}
                {fulfillItems.filter(i => i.available === 0).length > 0 && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                      ❌ Non disponibili in questo magazzino ({fulfillItems.filter(i => i.available === 0).length})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 'var(--space-lg)' }}>
                      {fulfillItems.filter(i => i.available === 0).map((item, idx) => (
                        <span key={idx} style={{ fontSize: 11, padding: '4px 10px', background: '#FEF2F2', color: 'var(--danger)', borderRadius: 6, border: '1px solid #FECACA' }}>
                          {item.product_name}
                        </span>
                      ))}
                    </div>
                  </>
                )}

                {fulfillItems.filter(i => i.available > 0).length === 0 && (
                  <div style={{ padding: 'var(--space-lg)', textAlign: 'center', color: 'var(--danger)', fontSize: 14, fontWeight: 600 }}>
                    ⚠️ Nessun prodotto richiesto è disponibile in questo magazzino. Seleziona un altro magazzino.
                  </div>
                )}
              </>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setFulfilling(null)}>Annulla</button>
              <button
                className="btn btn-primary" style={{ flex: 2 }}
                disabled={fulfillSaving || !fulfillSource || fulfillItems.every(i => !parseInt(i.qty))}
                onClick={submitFulfillment}
              >
                {fulfillSaving ? 'Spedizione...' : `📦 Spedisci a ${stores.find(s => s.id === fulfilling.store_id)?.name || 'store'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Transfer Modal */}
      {showNewTransfer && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 620 }}>
            <h3 style={{ marginBottom: 'var(--space-lg)' }}>🔄 Nuovo Trasferimento</h3>
            <div className="input-group" style={{ marginBottom: 'var(--space-md)' }}>
              <label className="input-label">Tipo Trasferimento</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {(Object.keys(typeLabels) as TransferType[]).map(t => (
                  <button key={t} onClick={() => { setTransferType(t); setSourceId(''); setDestId(''); setSourceStock([]); setTransferItems([]) }}
                    className={`badge ${transferType === t ? 'badge-brand' : 'badge-gray'}`}
                    style={{ cursor: 'pointer', border: 'none', padding: '6px 14px', fontSize: 12 }}>
                    {typeLabels[t]}
                  </button>
                ))}
              </div>
            </div>
            <div className="input-group" style={{ marginBottom: 'var(--space-md)' }}>
              <label className="input-label">Origine</label>
              <select className="input" value={sourceId} onChange={e => loadTransferSourceStock(e.target.value)}>
                <option value="">Seleziona...</option>
                {transferType === 'store_to_store'
                  ? stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                  : warehouses.map(w => <option key={w.id} value={w.id}>{w.type === 'central' ? '🏭 ' : '📦 '}{w.name}</option>)
                }
              </select>
            </div>
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
            {sourceId && (
              <div style={{ marginBottom: 'var(--space-md)' }}>
                <label className="input-label" style={{ marginBottom: 8, display: 'block' }}>Prodotti da trasferire</label>
                {transferItems.map((item, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 32px', gap: 8, marginBottom: 8 }}>
                    <select className="input" value={item.stock_item_id} onChange={e => updateTransferItem(i, 'stock_item_id', e.target.value)}>
                      <option value="">Seleziona prodotto...</option>
                      {sourceStock.map(s => (
                        <option key={s.id} value={s.id}>{s.product_name || s.name} (disp: {s.qty || s.stock})</option>
                      ))}
                    </select>
                    <input className="input" type="number" min="1" max={item.available} placeholder="Qty" value={item.qty}
                      onChange={e => updateTransferItem(i, 'qty', e.target.value)} style={{ textAlign: 'center' }} />
                    {transferItems.length > 1 && (
                      <button onClick={() => setTransferItems(prev => prev.filter((_, idx) => idx !== i))}
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 16, cursor: 'pointer' }}>✕</button>
                    )}
                  </div>
                ))}
                <button onClick={addTransferItem} style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', fontSize: 13, cursor: 'pointer', padding: 0 }}>+ Aggiungi prodotto</button>
              </div>
            )}
            {transferItems.some(i => parseInt(i.qty) > 0) && (
              <div style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 'var(--space-lg)' }}>
                <strong>Riepilogo:</strong> {transferItems.filter(i => parseInt(i.qty) > 0).length} prodotti, {transferItems.reduce((s, i) => s + (parseInt(i.qty) || 0), 0)} unità totali
              </div>
            )}
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setShowNewTransfer(false); setTransferItems([]) }}>Annulla</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={submitTransfer}
                disabled={transferSaving || !sourceId || !destId || transferItems.every(i => !i.stock_item_id || !(parseInt(i.qty) > 0))}>
                {transferSaving ? 'Trasferimento...' : '🔄 Trasferisci'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-xl)' }}>
        <div>
          <h2>📦 Movimenti Stock</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>Trasferimenti, ricariche e approvazioni</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowNewTransfer(true); addTransferItem() }}>+ Nuovo Trasferimento</button>
      </div>

      {/* Store tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--space-xl)', flexWrap: 'wrap' }}>
        <button onClick={() => setSelectedStore('all')} className={`badge ${selectedStore === 'all' ? 'badge-brand' : 'badge-gray'}`} style={{ cursor: 'pointer', border: 'none', padding: '6px 14px', fontSize: 13 }}>Tutti</button>
        {stores.map(s => (
          <button key={s.id} onClick={() => setSelectedStore(s.id)} className={`badge ${selectedStore === s.id ? 'badge-brand' : 'badge-gray'}`} style={{ cursor: 'pointer', border: 'none', padding: '6px 14px', fontSize: 13 }}>{s.name}</button>
        ))}
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
        <div className="kpi-card" style={{ border: restockRequests.length > 0 ? '1.5px solid var(--brand-primary)' : undefined }}>
          <div className="kpi-label">🔔 Richieste Ricarica</div>
          <div className="kpi-value" style={{ color: restockRequests.length > 0 ? 'var(--brand-primary)' : undefined }}>{restockRequests.length}</div>
        </div>
        <div className="kpi-card" style={{ border: requests.length > 0 ? '1.5px solid var(--warning)' : undefined }}>
          <div className="kpi-label">⏳ Da approvare</div>
          <div className="kpi-value" style={{ color: requests.length > 0 ? 'var(--warning)' : undefined }}>{requests.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">✅ Approvate</div>
          <div className="kpi-value">{history.filter(h => h.status === 'approved').length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">❌ Rifiutate</div>
          <div className="kpi-value">{history.filter(h => h.status === 'rejected').length}</div>
        </div>
      </div>

      {/* ========== RESTOCK REQUESTS FROM EMPLOYEES ========== */}
      {restockRequests.length > 0 && (
        <div style={{ marginBottom: 'var(--space-2xl)' }}>
          <h4 style={{ marginBottom: 'var(--space-md)' }}>🔔 Richieste Ricarica Dipendenti</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {restockRequests.map(notif => {
              const store = stores.find(s => s.id === notif.store_id)
              return (
                <div key={notif.id} className="card" style={{
                  padding: '16px 20px',
                  border: '1.5px solid var(--brand-primary)',
                  background: 'var(--brand-primary-light)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <span style={{ fontSize: 24 }}>🔔</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{notif.title}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
                        {notif.message}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
                        {store?.name} · {new Date(notif.created_at).toLocaleString('it-IT')}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                    <button onClick={() => dismissRestock(notif.id)} className="btn btn-secondary" style={{ flex: 1, fontSize: 12 }}>
                      ✕ Ignora
                    </button>
                    <button onClick={() => openFulfillment(notif)} className="btn btn-primary" style={{ flex: 2, fontSize: 12 }}>
                      📦 Gestisci Ricarica
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ========== PENDING TRANSFER APPROVALS ========== */}
      {requests.length > 0 && (
        <div style={{ marginBottom: 'var(--space-2xl)' }}>
          <h4 style={{ marginBottom: 'var(--space-md)' }}>⏳ In attesa di approvazione</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {requests.map(req => {
              const isExpanded = expandedId === req.id
              const items = req.stock_request_items || []
              const hasTransfer = items.some((i: any) => i.qty_sent != null)
              const hasMismatch = items.some((i: any) => i.qty_sent != null && i.qty_requested !== i.qty_sent)

              return (
                <div key={req.id} className="card" style={{
                  padding: 0, overflow: 'hidden',
                  border: hasMismatch ? '1.5px solid var(--danger)' : hasTransfer ? '1.5px solid var(--warning)' : undefined,
                }}>
                  <div
                    onClick={() => expandRequest(req)}
                    style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
                  >
                    <span style={{ fontSize: 20 }}>{hasTransfer ? '📦' : '➕'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>
                        {hasTransfer ? 'Conteggio Trasferimento' : 'Ricarica Manuale'}
                        {hasMismatch && <span style={{ color: 'var(--danger)', marginLeft: 8 }}>⚠️ Discrepanza</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {(req.stores as any)?.name} · {req.users?.full_name || 'Dipendente'} · {items.length} prodotti · {new Date(req.created_at).toLocaleString('it-IT')}
                      </div>
                      {req.notes && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{req.notes}</div>}
                    </div>
                    <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>{isExpanded ? '▲' : '▼'}</span>
                  </div>

                  {isExpanded && (
                    <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <div className="table-wrapper" style={{ margin: 0 }}>
                        <table>
                          <thead>
                            <tr>
                              <th>Prodotto</th>
                              {hasTransfer && <th>Inviati</th>}
                              <th>Contati</th>
                              {hasTransfer && <th>Δ</th>}
                              <th>Da approvare</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((item: any) => {
                              const diff = hasTransfer ? ((item.qty_requested || 0) - (item.qty_sent || 0)) : null
                              return (
                                <tr key={item.id}>
                                  <td style={{ fontWeight: 600 }}>{item.product_name}</td>
                                  {hasTransfer && <td>{item.qty_sent}</td>}
                                  <td style={{ fontWeight: 600 }}>{item.qty_requested}</td>
                                  {hasTransfer && (
                                    <td style={{ fontWeight: 700, color: diff === 0 ? 'var(--success)' : 'var(--danger)' }}>
                                      {diff === 0 ? '✅' : `${diff! > 0 ? '+' : ''}${diff}`}
                                    </td>
                                  )}
                                  <td>
                                    <input
                                      type="number" min="0"
                                      value={editQtys[item.id] ?? item.qty_requested ?? 0}
                                      onChange={e => setEditQtys(prev => ({ ...prev, [item.id]: parseInt(e.target.value) || 0 }))}
                                      style={{ width: 70, textAlign: 'center', border: '1.5px solid var(--border-default)', borderRadius: 6, padding: '4px 8px', fontSize: 13, fontWeight: 700 }}
                                    />
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div style={{ display: 'flex', gap: 8, padding: '14px 18px' }}>
                        <button onClick={() => rejectRequest(req)} disabled={processing} className="btn btn-secondary" style={{ flex: 1, color: 'var(--danger)' }}>
                          ❌ Rifiuta
                        </button>
                        <button onClick={() => approveRequest(req)} disabled={processing} className="btn btn-primary" style={{ flex: 2 }}>
                          {processing ? 'Elaborazione...' : '✅ Approva Stock'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {requests.length === 0 && restockRequests.length === 0 && pendingTransfers.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-xl)' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
          <div>Nessuna richiesta in attesa</div>
        </div>
      )}

      {/* Pending Transfers (shipped, waiting for employee count) */}
      {pendingTransfers.length > 0 && (
        <div style={{ marginBottom: 'var(--space-2xl)' }}>
          <h4 style={{ marginBottom: 'var(--space-md)' }}>🚚 Merce Spedita (in attesa conteggio)</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {pendingTransfers.map(pt => {
              const items = pt.stock_request_items || []
              return (
                <div key={pt.id} className="card" style={{ padding: '14px 18px', border: '1px solid var(--warning)', background: '#FFFBEB' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>🚚</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>
                        {(pt.stores as any)?.name} — {items.length} prodotti
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {pt.notes || 'Trasferimento'} · {new Date(pt.created_at).toLocaleString('it-IT')}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--warning)', fontWeight: 600, marginTop: 4 }}>
                        ⏳ Il dipendente deve ancora contare la merce
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {items.map((i: any) => (
                        <div key={i.id} style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                          {i.product_name}: <strong>{i.qty_sent ?? '?'}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div style={{ marginBottom: 'var(--space-2xl)' }}>
          <h4 style={{ marginBottom: 'var(--space-md)' }}>📋 Storico Approvazioni</h4>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Data</th><th>Store</th><th>Tipo</th><th>Prodotti</th><th>Stato</th></tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id}>
                    <td style={{ fontSize: 12 }}>{new Date(h.approved_at || h.created_at).toLocaleString('it-IT')}</td>
                    <td>{(h.stores as any)?.name}</td>
                    <td>
                      {(h.stock_request_items || []).some((i: any) => i.qty_sent != null) ? '📦 Trasferimento' : '➕ Manuale'}
                    </td>
                    <td>{(h.stock_request_items || []).length}</td>
                    <td>
                      <span className={`badge ${h.status === 'approved' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: 11 }}>
                        {h.status === 'approved' ? '✅ Approvata' : '❌ Rifiutata'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transfer movements log */}
      {transferLog.length > 0 && (
        <div>
          <h4 style={{ marginBottom: 'var(--space-md)' }}>🔄 Log Trasferimenti</h4>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Data</th><th>Prodotto</th><th>Tipo</th><th>Qty</th><th>Destinazione</th><th>Note</th></tr>
              </thead>
              <tbody>
                {transferLog.map(m => (
                  <tr key={m.id}>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{new Date(m.created_at).toLocaleString('it-IT')}</td>
                    <td style={{ fontWeight: 600 }}>{m.product_name}</td>
                    <td>
                      <span style={{ fontWeight: 600, fontSize: 12, color: m.movement_type === 'transfer_in' ? 'var(--success)' : 'var(--warning)' }}>
                        {m.movement_type === 'transfer_out' ? '📤 Uscita' : '📥 Entrata'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: m.movement_type === 'transfer_in' ? 'var(--success)' : 'var(--danger)' }}>
                      {m.movement_type === 'transfer_in' ? '+' : '-'}{m.qty}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{m.destination_name || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{m.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
