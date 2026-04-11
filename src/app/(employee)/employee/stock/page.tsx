'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { BottomNav } from '@/components/employee/BottomNav'
import type { Product } from '@/types/database'

interface StockItem {
  product: Product
  qty: number
}

export default function StockPage() {
  const router = useRouter()
  const supabase = createClient()

  const [products, setProducts] = useState<Product[]>([])
  const [selected, setSelected] = useState<StockItem[]>([])
  const [search, setSearch] = useState('')
  const [shiftId, setShiftId] = useState<string | null>(null)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(true)

  // Pending transfers
  const [pendingRequests, setPendingRequests] = useState<any[]>([])
  const [activeRequest, setActiveRequest] = useState<any>(null)
  const [requestItems, setRequestItems] = useState<any[]>([])
  const [countedQtys, setCountedQtys] = useState<Record<string, number>>({})
  const [mode, setMode] = useState<'select' | 'transfer'>('select')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUserId(user.id)

    const { data: profile } = await supabase.from('users').select('store_id').eq('id', user.id).single()
    if (!profile?.store_id) return
    setStoreId(profile.store_id)

    // Get active employee from localStorage (shared tablet model)
    const activeEmpStr = typeof window !== 'undefined' ? localStorage.getItem('brainware_active_employee') : null
    const activeEmp = activeEmpStr ? JSON.parse(activeEmpStr) : null

    const { data: shift } = await supabase.from('shifts').select('id')
      .eq('store_id', profile.store_id).eq('status', 'open')
      .order('created_at', { ascending: false }).limit(1).single()
    if (!shift) { router.push('/employee/shift/open'); return }
    setShiftId(shift.id)

    const { data: prods } = await supabase
      .from('products').select('*').eq('store_id', profile.store_id).eq('is_active', true).order('name')
    setProducts(prods ?? [])

    // Load pending transfer requests for this store
    const { data: pending } = await supabase
      .from('stock_requests')
      .select('*, stock_request_items(*)')
      .eq('store_id', profile.store_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    setPendingRequests(pending ?? [])

    setLoading(false)
  }

  function toggleProduct(product: Product) {
    setSelected(prev => {
      const exists = prev.find(i => i.product.id === product.id)
      if (exists) return prev.filter(i => i.product.id !== product.id)
      return [...prev, { product, qty: 10 }]
    })
  }

  function updateQty(productId: string, qty: number) {
    setSelected(prev => prev.map(i =>
      i.product.id === productId ? { ...i, qty: Math.max(1, qty) } : i
    ))
  }

  // Submit manual stock reload (no transfer)
  async function handleSubmit() {
    if (!shiftId || !storeId || !userId || selected.length === 0) return
    setSaving(true)

    const activeEmpStr = typeof window !== 'undefined' ? localStorage.getItem('brainware_active_employee') : null
    const activeEmp = activeEmpStr ? JSON.parse(activeEmpStr) : null

    const { data: req } = await supabase
      .from('stock_requests')
      .insert({
        shift_id: shiftId, store_id: storeId, user_id: userId,
        status: 'owner_review',
        notes: activeEmp ? `Ricarica manuale da ${activeEmp.name}` : 'Ricarica manuale',
      })
      .select('id').single()

    if (!req) { setSaving(false); return }

    await supabase.from('stock_request_items').insert(
      selected.map(i => ({
        stock_request_id: req.id,
        product_id: i.product.id,
        product_name: i.product.name,
        stock_before: i.product.stock,
        qty_requested: i.qty,
      }))
    )

    // Notify owner
    await supabase.from('notifications').insert({
      store_id: storeId,
      type: 'stock_reload',
      title: '📦 Ricarica Stock inviata',
      message: `${activeEmp?.name || 'Dipendente'} ha inserito ${selected.length} prodotti da ricaricare. In attesa di approvazione.`,
    })

    setDone(true)
    setSaving(false)
  }

  // Open a pending transfer to count
  function openTransferCount(request: any) {
    setActiveRequest(request)
    setRequestItems(request.stock_request_items || [])
    const initial: Record<string, number> = {}
    for (const item of (request.stock_request_items || [])) {
      initial[item.id] = item.qty_sent || 0 // default to sent qty
    }
    setCountedQtys(initial)
    setMode('transfer')
  }

  // Submit counted quantities for transfer
  async function submitTransferCount() {
    if (!activeRequest) return
    setSaving(true)

    const activeEmpStr = typeof window !== 'undefined' ? localStorage.getItem('brainware_active_employee') : null
    const activeEmp = activeEmpStr ? JSON.parse(activeEmpStr) : null

    // Update each item with counted qty
    for (const item of requestItems) {
      const counted = countedQtys[item.id] ?? 0
      await supabase.from('stock_request_items')
        .update({ qty_requested: counted })
        .eq('id', item.id)
    }

    // Update request status to owner_review
    await supabase.from('stock_requests').update({
      status: 'owner_review',
      notes: `${activeEmp?.name || 'Dipendente'} ha contato la merce ricevuta`,
    }).eq('id', activeRequest.id)

    // Notify owner
    await supabase.from('notifications').insert({
      store_id: storeId,
      type: 'stock_counted',
      title: '✅ Merce contata',
      message: `${activeEmp?.name || 'Dipendente'} ha contato ${requestItems.length} prodotti dal trasferimento. Verifica e approva.`,
    })

    setDone(true)
    setSaving(false)
  }

  const filtered = products.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>Caricamento...</div>

  if (done) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-lg)', padding: 'var(--space-lg)' }}>
      <span style={{ fontSize: 64 }}>✅</span>
      <h3>{mode === 'transfer' ? 'Conteggio inviato!' : 'Richiesta inviata!'}</h3>
      <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
        {mode === 'transfer'
          ? 'Il conteggio è stato inviato all\'owner per la verifica. Lo stock verrà aggiornato dopo l\'approvazione.'
          : 'La richiesta di ricarica è stata inviata all\'owner per l\'approvazione.'
        }
      </p>
      <Link href="/employee/dashboard" className="btn btn-primary">Torna alla Dashboard</Link>
    </div>
  )

  return (
    <div className="page" style={{ paddingBottom: 80 }}>
      <div style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-subtle)', padding: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
        <Link href="/employee/dashboard" style={{ textDecoration: 'none', color: 'var(--text-primary)', fontSize: 20 }}>←</Link>
        <div style={{ flex: 1 }}>
          <h3>Ricarica Stock</h3>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{new Date().toLocaleDateString('it-IT')}</div>
        </div>
      </div>

      <div style={{ padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

        {/* Pending transfers banner */}
        {pendingRequests.length > 0 && mode === 'select' && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
              📦 Trasferimenti in arrivo
            </div>
            {pendingRequests.map(req => (
              <div key={req.id} style={{
                background: '#FEF3C7', border: '1.5px solid #F59E0B', borderRadius: 12,
                padding: 'var(--space-md)', marginBottom: 8,
              }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                  📦 {(req.stock_request_items || []).length} prodotti in arrivo
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  {req.notes || 'Trasferimento in attesa di conteggio'}
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  {(req.stock_request_items || []).slice(0, 4).map((item: any) => (
                    <span key={item.id} className="badge badge-gray" style={{ fontSize: 11 }}>
                      {item.product_name} ×{item.qty_sent}
                    </span>
                  ))}
                  {(req.stock_request_items || []).length > 4 && (
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>+{(req.stock_request_items || []).length - 4} altri</span>
                  )}
                </div>
                <button
                  onClick={() => openTransferCount(req)}
                  className="btn btn-primary btn-full"
                  style={{ fontSize: 13 }}
                >
                  📋 Conta Merce Ricevuta
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Transfer counting mode */}
        {mode === 'transfer' && activeRequest && (
          <div>
            <div style={{
              background: 'var(--brand-primary-light)', border: '1.5px solid var(--brand-primary)',
              borderRadius: 12, padding: 'var(--space-md)', marginBottom: 'var(--space-lg)',
            }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>📋 Conta la merce ricevuta</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                Verifica le quantità per ogni prodotto. Se la quantità non corrisponde, modifica il valore.
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              {requestItems.map((item: any) => (
                <div key={item.id} className="card card-sm" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{item.product_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                      Inviati: <strong>{item.qty_sent}</strong> · Stock attuale: {item.stock_before}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                    <button
                      onClick={() => setCountedQtys(prev => ({ ...prev, [item.id]: Math.max(0, (prev[item.id] || 0) - 1) }))}
                      className="btn btn-secondary" style={{ width: 32, height: 32, padding: 0 }}>−</button>
                    <input
                      type="number"
                      value={countedQtys[item.id] ?? 0}
                      onChange={e => setCountedQtys(prev => ({ ...prev, [item.id]: parseInt(e.target.value) || 0 }))}
                      style={{
                        width: 60, textAlign: 'center', border: '1.5px solid var(--border-default)',
                        borderRadius: 'var(--radius-sm)', padding: '4px', fontSize: 14, fontWeight: 700,
                        color: (countedQtys[item.id] ?? 0) !== (item.qty_sent || 0) ? 'var(--danger)' : 'var(--brand-primary)',
                      }}
                    />
                    <button
                      onClick={() => setCountedQtys(prev => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }))}
                      className="btn btn-secondary" style={{ width: 32, height: 32, padding: 0 }}>+</button>
                  </div>
                  {(countedQtys[item.id] ?? 0) !== (item.qty_sent || 0) && (
                    <span className="badge badge-danger" style={{ fontSize: 10 }}>
                      Δ {(countedQtys[item.id] ?? 0) - (item.qty_sent || 0)}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-lg)' }}>
              <button onClick={() => { setMode('select'); setActiveRequest(null) }} className="btn btn-secondary" style={{ flex: 1 }}>Annulla</button>
              <button onClick={submitTransferCount} disabled={saving} className="btn btn-primary" style={{ flex: 2 }}>
                {saving ? 'Invio...' : '✅ Invia Conteggio'}
              </button>
            </div>
          </div>
        )}

        {/* Manual reload mode */}
        {mode === 'select' && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: -8 }}>
              ➕ Ricarica Manuale
            </div>

            <input
              className="input"
              placeholder="Cerca prodotto da ricaricare..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />

            {/* Selected items */}
            {selected.length > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                  <h4>Prodotti Selezionati</h4>
                  <span className="badge badge-brand">({selected.length})</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                  {selected.map(item => (
                    <div key={item.product.id} className="card card-sm" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{item.product.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Stock attuale: {item.product.stock}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                        <button onClick={() => updateQty(item.product.id, item.qty - 10)} className="btn btn-secondary" style={{ width: 32, height: 32, padding: 0 }}>−</button>
                        <input
                          type="number"
                          value={item.qty}
                          onChange={e => updateQty(item.product.id, parseInt(e.target.value) || 1)}
                          style={{ width: 60, textAlign: 'center', border: '1.5px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '4px', fontSize: 14, fontWeight: 700 }}
                        />
                        <button onClick={() => updateQty(item.product.id, item.qty + 10)} className="btn btn-secondary" style={{ width: 32, height: 32, padding: 0 }}>+</button>
                      </div>
                      <button onClick={() => toggleProduct(item.product)} style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Product list to select from */}
            <div>
              <h4 style={{ marginBottom: 'var(--space-md)' }}>Seleziona Prodotti</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {filtered.map(product => {
                  const isSelected = selected.some(i => i.product.id === product.id)
                  return (
                    <div
                      key={product.id}
                      onClick={() => toggleProduct(product)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
                        padding: 'var(--space-md) var(--space-lg)',
                        background: isSelected ? 'var(--brand-primary-light)' : 'var(--bg-primary)',
                        border: `1.5px solid ${isSelected ? 'var(--brand-primary)' : 'var(--border-default)'}`,
                        borderRadius: 'var(--radius-md)', cursor: 'pointer',
                      }}
                    >
                      <div style={{
                        width: 20, height: 20, borderRadius: 4,
                        border: `2px solid ${isSelected ? 'var(--brand-primary)' : 'var(--border-strong)'}`,
                        background: isSelected ? 'var(--brand-primary)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontSize: 12, flexShrink: 0,
                      }}>
                        {isSelected && '✓'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{product.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Stock: {product.stock} · Alert: {product.stock_alert}</div>
                      </div>
                      {product.stock <= product.stock_alert && (
                        <span className="badge badge-danger" style={{ fontSize: 11 }}>Basso</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {selected.length > 0 && (
              <button onClick={handleSubmit} disabled={saving} className="btn btn-primary btn-full btn-lg">
                {saving ? 'Invio...' : `Invia Richiesta (${selected.length} prodotti)`}
              </button>
            )}
          </>
        )}

      </div>
      <BottomNav />
    </div>
  )
}
