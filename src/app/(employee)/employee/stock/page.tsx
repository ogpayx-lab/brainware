'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { BottomNav } from '@/components/employee/BottomNav'
import { categoryLabel } from '@/lib/utils'
import type { Product, ProductCategory } from '@/types/database'
import { useT } from '@/lib/i18n'

const CATEGORIES: ProductCategory[] = ['flowers','hashish','oils','edibles','accessories','cosmetics','clothes','seeds','vape','food']

type Step = 'count' | 'review'

export default function StockPage() {
  const router = useRouter()
  const supabase = createClient()
  const t = useT()

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

  // Simplified: single step with inline quantities
  const [step, setStep] = useState<Step>('count')
  const [countedQtys, setCountedQtys] = useState<Record<string, number>>({})

  // Pending transfers
  const [pendingRequests, setPendingRequests] = useState<any[]>([])
  const [activeRequest, setActiveRequest] = useState<any>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
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

  // === INLINE QUANTITY HELPERS ===
  function setQty(productId: string, qty: number) {
    setCountedQtys(prev => ({ ...prev, [productId]: Math.max(0, qty) }))
  }

  function increment(productId: string) {
    setCountedQtys(prev => ({ ...prev, [productId]: (prev[productId] || 0) + 1 }))
  }

  function decrement(productId: string) {
    setCountedQtys(prev => {
      const current = prev[productId] || 0
      if (current <= 0) {
        const next = { ...prev }
        delete next[productId]
        return next
      }
      return { ...prev, [productId]: current - 1 }
    })
  }

  // Products that have qty > 0
  const selectedProducts = products.filter(p => (countedQtys[p.id] || 0) > 0)
  const totalPieces = Object.values(countedQtys).reduce((a, b) => a + b, 0)

  function goToReview() {
    if (selectedProducts.length === 0) return
    setStep('review')
  }

  // === SUBMIT ===
  async function submitManualCount() {
    const isTransfer = !!activeRequest
    const confirmMsg = isTransfer
      ? '⚠️ Sei sicuro di aver contato bene?\n\nSe il conteggio corrisponde, lo stock verrà aggiornato automaticamente.'
      : '⚠️ Sei sicuro di aver contato bene?\n\nI dati verranno inviati all\'owner per approvazione.'
    if (!confirm(confirmMsg)) return
    if (!storeId) return
    setSaving(true)

    try {
      const activeEmpStr = typeof window !== 'undefined' ? localStorage.getItem('brainware_active_employee') : null
      const activeEmp = activeEmpStr ? JSON.parse(activeEmpStr) : null
      const empName = activeEmp?.name || 'Dipendente'

      if (isTransfer) {
        const reqItems = activeRequest.stock_request_items || []

        for (const item of reqItems) {
          const prod = products.find(p => p.name.toLowerCase() === item.product_name?.toLowerCase() || p.id === item.product_id)
          const counted = prod ? (countedQtys[prod.id] ?? 0) : 0
          await supabase.from('stock_request_items').update({ qty_requested: counted }).eq('id', item.id)
        }

        const allMatch = reqItems.every((item: any) => {
          const prod = products.find(p => p.name.toLowerCase() === item.product_name?.toLowerCase() || p.id === item.product_id)
          return (prod ? (countedQtys[prod.id] ?? 0) : 0) === (item.qty_sent ?? 0)
        })

        if (allMatch) {
          for (const item of reqItems) {
            const prod = products.find(p => p.name.toLowerCase() === item.product_name?.toLowerCase() || p.id === item.product_id)
            const counted = prod ? (countedQtys[prod.id] ?? 0) : 0
            await supabase.from('stock_request_items').update({ qty_delivered: counted }).eq('id', item.id)
            if (prod) await supabase.from('products').update({ stock: prod.stock + counted }).eq('id', prod.id)
          }
          await supabase.from('stock_requests').update({
            status: 'approved', approved_at: new Date().toISOString(),
            notes: `✅ Auto-approvato — conteggio ${empName} corrisponde`,
          }).eq('id', activeRequest.id)

          const detailList = reqItems.map((item: any) => {
            const prod = products.find(p => p.name.toLowerCase() === item.product_name?.toLowerCase() || p.id === item.product_id)
            return `${item.product_name} ×${prod ? (countedQtys[prod.id] ?? 0) : 0}`
          }).join(', ')

          await supabase.from('notifications').insert({
            store_id: storeId, type: 'stock_approved', title: '✅ Ricarica completata',
            message: `${empName} ha contato ${reqItems.length} prodotti — match confermato. Dettaglio: ${detailList}. Stock aggiornato.`,
          })
          setDoneMessage('✅ Conteggio corretto! Lo stock è stato aggiornato automaticamente.')
        } else {
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
            status: 'owner_review', notes: `⚠️ Discrepanza — ${empName} ha contato quantità diverse`,
          }).eq('id', activeRequest.id)

          await supabase.from('notifications').insert({
            store_id: storeId, type: 'stock_counted', title: '⚠️ Discrepanza conteggio',
            message: `${empName}: ${mismatches.join(', ')}`,
          })
          setDoneMessage('⚠️ Conteggio inviato all\'owner — alcune quantità non corrispondono.')
        }
      } else {
        // === MANUAL FLOW ===
        const { data: req, error: reqError } = await supabase
          .from('stock_requests')
          .insert({
            shift_id: shiftId, store_id: storeId, user_id: userId,
            status: 'approved', approved_at: new Date().toISOString(),
            notes: `✅ Ricarica manuale da ${empName} — auto-approvata`,
          })
          .select('id').single()

        if (reqError || !req) {
          console.error('Stock request insert error:', reqError)
          alert(`❌ Errore nel salvataggio: ${reqError?.message || 'Nessun dato restituito'}.\n\nI tuoi dati NON sono stati persi. Riprova.`)
          setSaving(false)
          return
        }

        const items = selectedProducts.map(p => ({
          stock_request_id: req.id,
          product_id: p.id,
          product_name: p.name,
          stock_before: p.stock,
          qty_requested: countedQtys[p.id] || 0,
          qty_delivered: countedQtys[p.id] || 0,
        }))
        const { error: itemsError } = await supabase.from('stock_request_items').insert(items)
        if (itemsError) {
          console.error('Stock items insert error:', itemsError)
          alert(`❌ Errore nell'inserimento prodotti: ${itemsError.message}.\n\nRiprova.`)
          setSaving(false)
          return
        }

        for (const item of items) {
          if (item.qty_delivered > 0) {
            await supabase.from('products').update({
              stock: (products.find(p => p.id === item.product_id)?.stock || 0) + item.qty_delivered,
            }).eq('id', item.product_id)
          }
        }

        const detailList = items.map(i => `${i.product_name} ×${i.qty_delivered}`).join(', ')
        await supabase.from('notifications').insert({
          store_id: storeId, type: 'stock_approved', title: '✅ Ricarica Stock completata',
          message: `${empName} ha ricaricato ${items.length} prodotti (${items.reduce((s, i) => s + i.qty_delivered, 0)} pezzi). Dettaglio: ${detailList}.`,
        })
        setDoneMessage('✅ Stock aggiornato! L\'owner è stato notificato.')
      }

      setDone(true)
      setSaving(false)
    } catch (err: any) {
      console.error('Submit error:', err)
      alert(`❌ Errore imprevisto: ${err.message || 'Errore sconosciuto'}.\n\nI tuoi dati NON sono stati persi. Riprova.`)
      setSaving(false)
    }
  }

  // === FILTERS ===
  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase())
    const matchCat = activeCat === 'all' || p.category === activeCat
    return matchSearch && matchCat
  })

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>{t('loading')}</div>

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
          href={step === 'review' ? '#' : '/employee/dashboard'}
          onClick={e => { if (step === 'review') { e.preventDefault(); setStep('count') } }}
          style={{ textDecoration: 'none', color: 'var(--text-primary)', fontSize: 20 }}
        >←</Link>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 16 }}>📦 Ricarica Stock</h3>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            {step === 'count' ? 'Inserisci quantità ricevute' : 'Conferma e invia'}
          </div>
        </div>
        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 4 }}>
          {[1, 2].map(n => (
            <div key={n} style={{
              width: 24, height: 24, borderRadius: '50%',
              background: n <= (step === 'count' ? 1 : 2) ? 'var(--brand-primary)' : 'var(--border-default)',
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700,
            }}>{n}</div>
          ))}
        </div>
      </div>

      {/* ===== STEP 1: INLINE COUNT ===== */}
      {step === 'count' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Pending transfers */}
          {pendingRequests.length > 0 && (
            <div style={{ padding: 'var(--space-lg)', paddingBottom: 0 }}>
              {pendingRequests.map(req => {
                const items = req.stock_request_items || []
                return (
                  <div key={req.id} style={{
                    background: '#FEF3C7', border: '1.5px solid #F59E0B', borderRadius: 12,
                    padding: 'var(--space-md)', marginBottom: 8,
                  }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                      📦 {items.length} prodotti in arrivo
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                      {req.notes || 'Trasferimento in attesa'} — inserisci le quantità contate
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                      {items.slice(0, 6).map((item: any) => (
                        <span key={item.id} className="badge badge-gray" style={{ fontSize: 11 }}>
                          {item.product_name} ×{item.qty_sent}
                        </span>
                      ))}
                      {items.length > 6 && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>+{items.length - 6} altri</span>}
                    </div>
                    <button
                      onClick={() => {
                        // Pre-fill quantities from transfer
                        const newQtys = { ...countedQtys }
                        for (const item of items) {
                          const prod = products.find(p => p.name.toLowerCase() === item.product_name?.toLowerCase() || p.id === item.product_id)
                          if (prod) newQtys[prod.id] = item.qty_sent ?? 0
                        }
                        setCountedQtys(newQtys)
                        setActiveRequest(req)
                      }}
                      className="btn btn-primary btn-full" style={{ fontSize: 13 }}
                    >
                      ✅ Pre-compila quantità inviate
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Search + Categories */}
          <div style={{ padding: 'var(--space-lg)', paddingBottom: 0 }}>
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

          {/* Product list with inline qty */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 var(--space-lg)', paddingBottom: totalPieces > 0 ? 90 : 'var(--space-lg)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map(p => {
                const qty = countedQtys[p.id] || 0
                const hasQty = qty > 0
                return (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', borderRadius: 12,
                    background: hasQty ? 'var(--brand-primary-light)' : 'var(--bg-primary)',
                    border: hasQty ? '2px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                    transition: 'all 0.15s',
                  }}>
                    {/* Product info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                          {categoryLabel[p.category as ProductCategory] || p.category}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: p.stock <= p.stock_alert ? 'var(--danger)' : 'var(--text-tertiary)' }}>
                          Stock: {p.stock}
                        </span>
                      </div>
                    </div>

                    {/* Quantity controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      <button
                        onClick={() => decrement(p.id)}
                        style={{
                          width: 38, height: 38, borderRadius: 10, border: 'none',
                          background: hasQty ? 'var(--brand-primary)' : 'var(--bg-surface)',
                          color: hasQty ? 'white' : 'var(--text-tertiary)',
                          fontSize: 18, fontWeight: 700, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          opacity: qty <= 0 ? 0.4 : 1,
                        }}
                      >−</button>
                      <input
                        type="number" min="0" inputMode="numeric"
                        value={qty || ''}
                        placeholder="0"
                        onChange={e => setQty(p.id, parseInt(e.target.value) || 0)}
                        style={{
                          width: 52, textAlign: 'center',
                          border: hasQty ? '2px solid var(--brand-primary)' : '1.5px solid var(--border-default)',
                          borderRadius: 8, padding: '6px 2px', fontSize: 18, fontWeight: 700,
                          background: hasQty ? 'white' : 'var(--bg-primary)',
                          color: hasQty ? 'var(--brand-primary-dark)' : 'var(--text-primary)',
                        }}
                      />
                      <button
                        onClick={() => increment(p.id)}
                        style={{
                          width: 38, height: 38, borderRadius: 10, border: 'none',
                          background: 'var(--brand-primary)',
                          color: 'white',
                          fontSize: 18, fontWeight: 700, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >+</button>
                    </div>
                  </div>
                )
              })}
              {filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-tertiary)', fontSize: 14 }}>
                  Nessun prodotto trovato
                </div>
              )}
            </div>
          </div>

          {/* Bottom bar with summary */}
          {totalPieces > 0 && (
            <div style={{
              position: 'fixed', bottom: 60, left: 0, right: 0,
              padding: '10px var(--space-lg)',
              background: 'var(--bg-primary)', borderTop: '1px solid var(--border-subtle)',
              boxShadow: '0 -4px 20px rgba(0,0,0,0.1)', zIndex: 50,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-primary-dark)' }}>
                  {selectedProducts.length} prodotti · +{totalPieces} pezzi
                </div>
              </div>
              <button onClick={goToReview} className="btn btn-primary btn-lg" style={{ padding: '12px 24px' }}>
                Conferma →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===== STEP 2: REVIEW & CONFIRM ===== */}
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
              <strong style={{ color: '#22C55E' }}>+{totalPieces}</strong>
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
