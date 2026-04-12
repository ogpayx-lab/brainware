'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { BottomNav } from '@/components/employee/BottomNav'
import { categoryLabel } from '@/lib/utils'
import type { Product, ProductCategory } from '@/types/database'

const CATEGORIES: ProductCategory[] = ['flowers','hashish','oils','edibles','accessories','cosmetics','clothes','seeds','vape','food']

type Step = 'select' | 'count' | 'review'

export default function StockPage() {
  const router = useRouter()
  const supabase = createClient()

  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [activeCat, setActiveCat] = useState<ProductCategory | 'all'>('all')
  const [shiftId, setShiftId] = useState<string | null>(null)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [doneMessage, setDoneMessage] = useState('')
  const [loading, setLoading] = useState(true)

  // Step flow
  const [step, setStep] = useState<Step>('select')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [countedQtys, setCountedQtys] = useState<Record<string, number>>({})

  // Pending transfers
  const [pendingRequests, setPendingRequests] = useState<any[]>([])
  const [activeRequest, setActiveRequest] = useState<any>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUserId(user.id)

    const { data: profile } = await supabase.from('users').select('store_id').eq('id', user.id).single()
    if (!profile?.store_id) return
    setStoreId(profile.store_id)

    const { data: shift } = await supabase.from('shifts').select('id')
      .eq('store_id', profile.store_id).eq('status', 'open')
      .order('created_at', { ascending: false }).limit(1).single()
    if (!shift) { router.push('/employee/shift/open'); return }
    setShiftId(shift.id)

    const { data: prods } = await supabase
      .from('products').select('*').eq('store_id', profile.store_id).eq('is_active', true).order('name')
    setProducts(prods ?? [])

    const { data: pending } = await supabase
      .from('stock_requests')
      .select('*, stock_request_items(*)')
      .eq('store_id', profile.store_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    setPendingRequests(pending ?? [])

    setLoading(false)
  }

  // === PRODUCT SELECTION ===
  function toggleProduct(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function goToCount() {
    if (selectedIds.size === 0) return
    // Initialize all counts to 0
    const initial: Record<string, number> = {}
    selectedIds.forEach(id => { initial[id] = 0 })
    setCountedQtys(initial)
    setStep('count')
  }

  function goToReview() {
    // Check all have values
    const hasEmpty = Array.from(selectedIds).some(id => (countedQtys[id] ?? 0) <= 0)
    if (hasEmpty) {
      alert('⚠️ Inserisci una quantità per tutti i prodotti selezionati')
      return
    }
    setStep('review')
  }

  async function submitManualCount() {
    const isTransfer = !!activeRequest
    const confirmMsg = isTransfer
      ? '⚠️ Sei sicuro di aver contato bene?\n\nSe il conteggio corrisponde, lo stock verrà aggiornato automaticamente.'
      : '⚠️ Sei sicuro di aver contato bene?\n\nI dati verranno inviati all\'owner per approvazione.'
    const confirmed = confirm(confirmMsg)
    if (!confirmed) return
    if (!storeId) return
    setSaving(true)

    const activeEmpStr = typeof window !== 'undefined' ? localStorage.getItem('brainware_active_employee') : null
    const activeEmp = activeEmpStr ? JSON.parse(activeEmpStr) : null
    const empName = activeEmp?.name || 'Dipendente'

    if (isTransfer) {
      // === TRANSFER FLOW: update existing stock_request items with counted qty ===
      const reqItems = activeRequest.stock_request_items || []

      // Update each item with counted qty
      for (const item of reqItems) {
        const prod = products.find(p => p.name.toLowerCase() === item.product_name?.toLowerCase() || p.id === item.product_id)
        const counted = prod ? (countedQtys[prod.id] ?? 0) : 0
        await supabase.from('stock_request_items')
          .update({ qty_requested: counted })
          .eq('id', item.id)
      }

      // Check if ALL items match
      const allMatch = reqItems.every((item: any) => {
        const prod = products.find(p => p.name.toLowerCase() === item.product_name?.toLowerCase() || p.id === item.product_id)
        const counted = prod ? (countedQtys[prod.id] ?? 0) : 0
        return counted === (item.qty_sent ?? 0)
      })

      if (allMatch) {
        // ✅ AUTO-APPROVE: update stock directly
        for (const item of reqItems) {
          const prod = products.find(p => p.name.toLowerCase() === item.product_name?.toLowerCase() || p.id === item.product_id)
          const counted = prod ? (countedQtys[prod.id] ?? 0) : 0

          await supabase.from('stock_request_items')
            .update({ qty_delivered: counted })
            .eq('id', item.id)

          if (prod) {
            await supabase.from('products').update({
              stock: prod.stock + counted,
            }).eq('id', prod.id)
          }
        }

        await supabase.from('stock_requests').update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          notes: `✅ Auto-approvato — conteggio ${empName} corrisponde`,
        }).eq('id', activeRequest.id)

        const detailList = reqItems.map((item: any) => {
          const prod = products.find(p => p.name.toLowerCase() === item.product_name?.toLowerCase() || p.id === item.product_id)
          const qty = prod ? (countedQtys[prod.id] ?? 0) : 0
          return `${item.product_name} ×${qty}`
        }).join(', ')

        await supabase.from('notifications').insert({
          store_id: storeId,
          type: 'stock_approved',
          title: '✅ Ricarica completata',
          message: `${empName} ha contato ${reqItems.length} prodotti — match confermato. Dettaglio: ${detailList}. Stock aggiornato.`,
        })

        setDoneMessage('✅ Conteggio corretto! Lo stock è stato aggiornato automaticamente.')
      } else {
        // ❌ MISMATCH: send to owner
        const mismatches = reqItems
          .filter((item: any) => {
            const prod = products.find(p => p.name.toLowerCase() === item.product_name?.toLowerCase() || p.id === item.product_id)
            return (prod ? (countedQtys[prod.id] ?? 0) : 0) !== (item.qty_sent ?? 0)
          })
          .map((item: any) => {
            const prod = products.find(p => p.name.toLowerCase() === item.product_name?.toLowerCase() || p.id === item.product_id)
            return `${item.product_name}: inviati ${item.qty_sent}, contati ${prod ? (countedQtys[prod.id] ?? 0) : 0}`
          })

        await supabase.from('stock_requests').update({
          status: 'owner_review',
          notes: `⚠️ Discrepanza — ${empName} ha contato quantità diverse`,
        }).eq('id', activeRequest.id)

        await supabase.from('notifications').insert({
          store_id: storeId,
          type: 'stock_counted',
          title: '⚠️ Discrepanza conteggio',
          message: `${empName}: ${mismatches.join(', ')}`,
        })

        setDoneMessage('⚠️ Conteggio inviato all\'owner — alcune quantità non corrispondono.')
      }
    } else {
      // === MANUAL FLOW: auto-approve and update stock directly ===
      const { data: req } = await supabase
        .from('stock_requests')
        .insert({
          shift_id: shiftId, store_id: storeId, user_id: userId,
          status: 'approved',
          approved_at: new Date().toISOString(),
          notes: `✅ Ricarica manuale da ${empName} — auto-approvata`,
        })
        .select('id').single()

      if (!req) { setSaving(false); return }

      const items = Array.from(selectedIds).map(id => {
        const product = products.find(p => p.id === id)!
        return {
          stock_request_id: req.id,
          product_id: id,
          product_name: product.name,
          stock_before: product.stock,
          qty_requested: countedQtys[id] || 0,
          qty_delivered: countedQtys[id] || 0,
        }
      })
      await supabase.from('stock_request_items').insert(items)

      // Update stock for each product
      for (const item of items) {
        if (item.qty_delivered > 0) {
          await supabase.from('products').update({
            stock: (products.find(p => p.id === item.product_id)?.stock || 0) + item.qty_delivered,
          }).eq('id', item.product_id)
        }
      }

      const detailList = items.map(i => `${i.product_name} ×${i.qty_delivered}`).join(', ')

      await supabase.from('notifications').insert({
        store_id: storeId,
        type: 'stock_approved',
        title: '✅ Ricarica Stock completata',
        message: `${empName} ha ricaricato ${items.length} prodotti (${items.reduce((s, i) => s + i.qty_delivered, 0)} pezzi). Dettaglio: ${detailList}.`,
      })

      setDoneMessage('✅ Stock aggiornato! L\'owner è stato notificato.')
    }

    setDone(true)
    setSaving(false)
  }



  // === FILTERS ===
  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase())
    const matchCat = activeCat === 'all' || p.category === activeCat
    return matchSearch && matchCat
  })

  const selectedProducts = products.filter(p => selectedIds.has(p.id))

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>Caricamento...</div>

  if (done) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
      <span style={{ fontSize: 64 }}>{doneMessage.includes('⚠️') ? '⚠️' : '✅'}</span>
      <h3 style={{ textAlign: 'center' }}>{doneMessage.includes('⚠️') ? 'Conteggio inviato' : 'Stock aggiornato!'}</h3>
      <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: 14, maxWidth: 320 }}>
        {doneMessage || 'Operazione completata.'}
      </p>
      <Link href="/employee/dashboard" className="btn btn-primary">Torna alla Dashboard</Link>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-subtle)', padding: 'var(--space-md) var(--space-lg)', display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
        <Link
          href={step === 'count' ? '#' : step === 'review' ? '#' : '/employee/dashboard'}
          onClick={e => {
            if (step === 'review') { e.preventDefault(); setStep('count') }
            else if (step === 'count') { e.preventDefault(); setStep('select') }
          }}
          style={{ textDecoration: 'none', color: 'var(--text-primary)', fontSize: 20 }}
        >←</Link>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 16 }}>📦 Ricarica Stock</h3>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            {step === 'select' ? 'Step 1: Seleziona prodotti' : step === 'count' ? 'Step 2: Inserisci quantità' : 'Step 3: Conferma'}
          </div>
        </div>
        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 4 }}>
          {[1, 2, 3].map(n => (
            <div key={n} style={{
              width: 24, height: 24, borderRadius: '50%',
              background: n <= (['select', 'count', 'review'].indexOf(step) + 1) ? 'var(--brand-primary)' : 'var(--border-default)',
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700,
            }}>{n}</div>
          ))}
        </div>
      </div>


      {/* ===== STEP 1: SELECT PRODUCTS ===== */}
      {step === 'select' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Pending transfers info */}
          {pendingRequests.length > 0 && (
            <div style={{ padding: 'var(--space-lg)', paddingBottom: 0 }}>
              {pendingRequests.map(req => {
                const items = req.stock_request_items || []
                const allPreSelected = items.every((i: any) => {
                  const prod = products.find(p => p.name.toLowerCase() === i.product_name?.toLowerCase() || p.id === i.product_id)
                  return prod && selectedIds.has(prod.id)
                })
                return (
                  <div key={req.id} style={{
                    background: '#FEF3C7', border: '1.5px solid #F59E0B', borderRadius: 12,
                    padding: 'var(--space-md)', marginBottom: 8,
                  }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                      📦 {items.length} prodotti in arrivo
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                      {req.notes || 'Trasferimento in attesa di conteggio'} — seleziona i prodotti e conta
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                      {items.slice(0, 6).map((item: any) => (
                        <span key={item.id} className="badge badge-gray" style={{ fontSize: 11 }}>
                          {item.product_name} ×{item.qty_sent}
                        </span>
                      ))}
                      {items.length > 6 && (
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>+{items.length - 6} altri</span>
                      )}
                    </div>
                    {!allPreSelected && (
                      <button
                        onClick={() => {
                          // Pre-select all products from the transfer
                          const newIds = new Set(selectedIds)
                          for (const item of items) {
                            const prod = products.find(p => p.name.toLowerCase() === item.product_name?.toLowerCase() || p.id === item.product_id)
                            if (prod) newIds.add(prod.id)
                          }
                          setSelectedIds(newIds)
                          // Store the active request for later match checking
                          setActiveRequest(req)
                        }}
                        className="btn btn-primary btn-full" style={{ fontSize: 13 }}
                      >
                        ✅ Seleziona tutti i prodotti in arrivo
                      </button>
                    )}
                    {allPreSelected && (
                      <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>
                        ✅ Prodotti selezionati — procedi con il conteggio
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Search + Categories */}
          <div style={{ padding: 'var(--space-lg)', paddingBottom: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
              ➕ Ricarica Manuale — Seleziona prodotti ricevuti
            </div>
            <div style={{ position: 'relative', marginBottom: 'var(--space-md)' }}>
              <input className="input" placeholder="Cerca prodotto..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16 }}>🔍</span>
            </div>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 'var(--space-md)', paddingBottom: 4 }}>
              {(['all', ...CATEGORIES] as (ProductCategory | 'all')[]).map(c => (
                <button key={c} onClick={() => setActiveCat(c)} className={`badge ${activeCat === c ? 'badge-brand' : 'badge-gray'}`} style={{ cursor: 'pointer', border: 'none', padding: '6px 14px', whiteSpace: 'nowrap' }}>
                  {c === 'all' ? 'Tutto' : categoryLabel[c]}
                </button>
              ))}
            </div>
          </div>

          {/* Product grid */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 var(--space-lg)', paddingBottom: selectedIds.size > 0 ? 80 : 'var(--space-lg)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 'var(--space-md)' }}>
              {filtered.map(p => {
                const isSelected = selectedIds.has(p.id)
                return (
                  <div key={p.id} onClick={() => toggleProduct(p.id)} className="card card-sm" style={{
                    cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6, position: 'relative',
                    border: isSelected ? '2px solid var(--brand-primary)' : undefined,
                    background: isSelected ? 'var(--brand-primary-light)' : undefined,
                  }}>
                    {isSelected && (
                      <div style={{ position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: '50%', background: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 700 }}>✓</div>
                    )}
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                    <span className="badge badge-indigo" style={{ fontSize: 10 }}>
                      {categoryLabel[p.category as ProductCategory] || p.category}
                    </span>
                    <div style={{ fontSize: 11, fontWeight: 600, color: p.stock <= p.stock_alert ? 'var(--danger)' : 'var(--success)' }}>
                      Stock: {p.stock}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Bottom bar */}
          {selectedIds.size > 0 && (
            <div style={{ position: 'fixed', bottom: 60, left: 0, right: 0, padding: '12px var(--space-lg)', background: 'var(--bg-primary)', borderTop: '1px solid var(--border-subtle)', boxShadow: '0 -4px 20px rgba(0,0,0,0.1)', zIndex: 50 }}>
              <button onClick={goToCount} className="btn btn-primary btn-full btn-lg">
                Avanti → Inserisci Quantità ({selectedIds.size} prodotti)
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===== STEP 2: COUNT QUANTITIES ===== */}
      {step === 'count' && (
        <div style={{ padding: 'var(--space-lg)', flex: 1 }}>
          <div style={{ background: 'var(--brand-primary-light)', border: '1.5px solid var(--brand-primary)', borderRadius: 12, padding: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>📝 Inserisci le quantità ricevute</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Conta con attenzione la merce ricevuta per ogni prodotto</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 80 }}>
            {selectedProducts.map(p => (
              <div key={p.id} className="card card-sm" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Stock attuale: {p.stock}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    onClick={() => setCountedQtys(prev => ({ ...prev, [p.id]: Math.max(0, (prev[p.id] || 0) - 1) }))}
                    className="btn btn-secondary" style={{ width: 36, height: 36, padding: 0, fontSize: 16 }}>−</button>
                  <input
                    type="number" min="0"
                    value={countedQtys[p.id] ?? 0}
                    onChange={e => setCountedQtys(prev => ({ ...prev, [p.id]: parseInt(e.target.value) || 0 }))}
                    style={{
                      width: 64, textAlign: 'center', border: '2px solid var(--border-default)',
                      borderRadius: 8, padding: '6px', fontSize: 18, fontWeight: 700,
                    }}
                  />
                  <button
                    onClick={() => setCountedQtys(prev => ({ ...prev, [p.id]: (prev[p.id] || 0) + 1 }))}
                    className="btn btn-secondary" style={{ width: 36, height: 36, padding: 0, fontSize: 16 }}>+</button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ position: 'fixed', bottom: 60, left: 0, right: 0, padding: '12px var(--space-lg)', background: 'var(--bg-primary)', borderTop: '1px solid var(--border-subtle)', boxShadow: '0 -4px 20px rgba(0,0,0,0.1)', zIndex: 50 }}>
            <button onClick={goToReview} className="btn btn-primary btn-full btn-lg">
              Avanti → Riepilogo
            </button>
          </div>
        </div>
      )}

      {/* ===== STEP 3: REVIEW & CONFIRM ===== */}
      {step === 'review' && (
        <div style={{ padding: 'var(--space-lg)', flex: 1 }}>
          <div style={{ background: 'var(--brand-primary-light)', border: '1.5px solid var(--brand-primary)', borderRadius: 12, padding: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>📋 Riepilogo prima dell'invio</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Controlla che tutto sia corretto</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 'var(--space-xl)' }}>
            {selectedProducts.map(p => (
              <div key={p.id} style={{
                padding: '12px 16px', borderRadius: 10,
                background: '#F0FDF4', border: '1.5px solid #22C55E',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Stock attuale: {p.stock}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: 20, color: '#22C55E' }}>+{countedQtys[p.id] || 0}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>→ {p.stock + (countedQtys[p.id] || 0)}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div style={{ background: 'var(--bg-surface)', borderRadius: 10, padding: 14, marginBottom: 'var(--space-lg)' }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
              <span>Prodotti</span><strong>{selectedProducts.length}</strong>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span>Totale pezzi da aggiungere</span>
              <strong style={{ color: '#22C55E' }}>+{Object.values(countedQtys).reduce((a, b) => a + b, 0)}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep('count')} className="btn btn-secondary" style={{ flex: 1 }}>← Modifica</button>
            <button onClick={submitManualCount} disabled={saving} className="btn btn-primary" style={{ flex: 2 }}>
              {saving ? 'Invio...' : '✅ Conferma e Invia'}
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
