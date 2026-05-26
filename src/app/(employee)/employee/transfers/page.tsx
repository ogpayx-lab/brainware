'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatDate, fmt, categoryLabel } from '@/lib/utils'
import { BottomNav } from '@/components/employee/BottomNav'
import type { Product, ProductCategory, Store } from '@/types/database'
import { useT } from '@/lib/i18n'

const CATEGORIES: ProductCategory[] = ['flowers', 'hashish', 'oils', 'edibles', 'accessories', 'cosmetics', 'clothes', 'seeds', 'vape', 'food']

interface TransferItem { product: Product; qty: number }

export default function TransfersPage() {
  const router = useRouter()
  const supabase = createClient()
  const t = useT()

  const [products, setProducts] = useState<Product[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [transfers, setTransfers] = useState<any[]>([])
  const [selected, setSelected] = useState<TransferItem[]>([])
  const [toStoreId, setToStoreId] = useState('')
  const [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')
  const [activeCat, setActiveCat] = useState<ProductCategory | 'all'>('all')

  const [storeId, setStoreId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'new' | 'history'>('new')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
    if (!user) { router.push('/login'); return }
    setUserId(user.id)

    const { data: profile } = await supabase.from('users').select('store_id').eq('id', user.id).single()
    if (!profile?.store_id) return
    setStoreId(profile.store_id)

    // Recupera organization_id dello store del dipendente
    const { data: myStore } = await supabase.from('stores').select('organization_id').eq('id', profile.store_id).single()
    const orgId = myStore?.organization_id

    // Carica solo store della stessa organizzazione (stesso owner)
    let storeQuery = supabase.from('stores').select('*').eq('is_active', true).neq('id', profile.store_id)
    if (orgId) storeQuery = storeQuery.eq('organization_id', orgId)

    const [{ data: prods }, { data: storeList }, { data: xfers }] = await Promise.all([
      supabase.from('products').select('*').eq('store_id', profile.store_id).eq('is_active', true).order('name'),
      storeQuery,
      supabase.from('transfers').select('*, transfer_items(product_name, qty)')
        .or(`from_store_id.eq.${profile.store_id},to_store_id.eq.${profile.store_id}`)
        .order('created_at', { ascending: false }).limit(20),
    ])

    setProducts(prods ?? [])
    setStores(storeList ?? [])
    setTransfers(xfers ?? [])
    setLoading(false)
  }

  function addToTransfer(p: Product) {
    setSelected(prev => {
      const exists = prev.find(i => i.product.id === p.id)
      if (exists) {
        return prev.map(i => i.product.id === p.id ? { ...i, qty: Math.min(i.qty + 1, i.product.stock) } : i)
      }
      return [...prev, { product: p, qty: 1 }]
    })
  }

  function removeFromTransfer(productId: string) {
    setSelected(prev => prev.filter(i => i.product.id !== productId))
  }

  function updateQty(productId: string, qty: number) {
    setSelected(prev => prev.map(i =>
      i.product.id === productId ? { ...i, qty: Math.max(1, Math.min(qty, i.product.stock)) } : i
    ))
  }

  async function handleSubmit() {
    if (!storeId || !userId || selected.length === 0) return
    setSaving(true)

    const { data: transfer } = await supabase.from('transfers').insert({
      from_store_id: storeId,
      to_store_id: toStoreId || null,
      requested_by: userId,
      status: 'pending',
      notes: notes || null,
    }).select('id').single()

    if (!transfer) { setSaving(false); return }

    await supabase.from('transfer_items').insert(
      selected.map(i => ({
        transfer_id: transfer.id,
        product_id: i.product.id,
        product_name: i.product.name,
        qty: i.qty,
      }))
    )

    setDone(true)
    setSaving(false)
  }

  const filtered = products.filter(p =>
    (activeCat === 'all' || p.category === activeCat) &&
    (!search || p.name.toLowerCase().includes(search.toLowerCase())) &&
    p.stock > 0
  )

  const statusBadge: Record<string, string> = {
    pending: 'badge-warning',
    in_transit: 'badge-blue',
    completed: 'badge-success',
    cancelled: 'badge-gray',
  }
  const statusLabel: Record<string, string> = {
    pending: 'In attesa',
    in_transit: 'In transito',
    completed: 'Completato',
    cancelled: 'Annullato',
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>{t('loading')}</div>

  if (done) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-lg)', padding: 'var(--space-lg)' }}>
      <span style={{ fontSize: 64 }}>✅</span>
      <h3>Trasferimento richiesto!</h3>
      <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>La richiesta è stata inviata all&apos;owner per approvazione.</p>
      <Link href="/employee/dashboard" className="btn btn-primary">Torna alla Dashboard</Link>
    </div>
  )

  return (
    <div className="page" style={{ paddingBottom: 80 }}>
      <div style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-subtle)', padding: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
        <Link href="/employee/dashboard" style={{ textDecoration: 'none', color: 'var(--text-primary)', fontSize: 20 }}>←</Link>
        <h3>Trasferimenti</h3>
      </div>

      {/* Tabs */}
      <div className="toggle-group" style={{ margin: 'var(--space-lg)', marginBottom: 0 }}>
        <button className={`toggle-option ${tab === 'new' ? 'active' : ''}`} onClick={() => setTab('new')}>Nuova Richiesta</button>
        <button className={`toggle-option ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>Storico</button>
      </div>

      <div style={{ padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

        {tab === 'new' && (
          <>
            {/* Destination */}
            <div className="input-group">
              <label className="input-label">Destinazione</label>
              <select className="input" value={toStoreId} onChange={e => setToStoreId(e.target.value)}>
                <option value="">Magazzino centrale</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* Selected items summary (mini-cart style) */}
            {selected.length > 0 && (
              <div style={{ background: 'var(--brand-primary-light)', border: '1px solid var(--brand-primary)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
                  <h4 style={{ fontSize: 14 }}>📦 Prodotti da trasferire ({selected.reduce((s, i) => s + i.qty, 0)})</h4>
                  <button onClick={() => setSelected([])} style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>Svuota</button>
                </div>
                {selected.map(item => (
                  <div key={item.product.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', padding: '6px 0', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.product.name}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => updateQty(item.product.id, item.qty - 1)} className="btn btn-secondary" style={{ width: 28, height: 28, padding: 0, fontSize: 14, borderRadius: 8 }}>−</button>
                      <span style={{ fontWeight: 700, minWidth: 22, textAlign: 'center', fontSize: 14 }}>{item.qty}</span>
                      <button onClick={() => updateQty(item.product.id, item.qty + 1)} className="btn btn-secondary" style={{ width: 28, height: 28, padding: 0, fontSize: 14, borderRadius: 8 }}>+</button>
                    </div>
                    <button onClick={() => removeFromTransfer(item.product.id)} style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* Search bar with icon — POS style */}
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input className="input" placeholder="Cerca prodotto..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16 }}>🔍</span>
              </div>
            </div>

            {/* Category filter — horizontal scroll */}
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginTop: -8 }}>
              {(['all', ...CATEGORIES] as (ProductCategory | 'all')[]).map(c => (
                <button
                  key={c}
                  onClick={() => setActiveCat(c)}
                  className={`badge ${activeCat === c ? 'badge-brand' : 'badge-gray'}`}
                  style={{ cursor: 'pointer', border: 'none', padding: '6px 14px', whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  {c === 'all' ? 'Tutto' : categoryLabel[c]}
                </button>
              ))}
            </div>

            {/* Product grid — POS style */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 'var(--space-md)' }}>
              {filtered.map(p => {
                const inCart = selected.find(i => i.product.id === p.id)
                return (
                  <div key={p.id} className="card card-sm" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{fmt(p.price)}/{p.unit}</div>
                      <span className="badge badge-indigo" style={{ fontSize: 10, marginTop: 4 }}>{categoryLabel[p.category]}</span>
                    </div>
                    <div style={{ fontSize: 11, color: p.stock <= p.stock_alert ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>Stock: {p.stock}</div>
                    {inCart ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                        <button onClick={() => updateQty(p.id, inCart.qty - 1)} className="btn btn-secondary" style={{ width: 30, height: 30, padding: 0, fontSize: 14, borderRadius: 8 }}>−</button>
                        <span style={{ fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{inCart.qty}</span>
                        <button onClick={() => updateQty(p.id, inCart.qty + 1)} className="btn btn-secondary" style={{ width: 30, height: 30, padding: 0, fontSize: 14, borderRadius: 8 }}>+</button>
                        <button onClick={() => removeFromTransfer(p.id)} style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, marginLeft: 4 }}>✕</button>
                      </div>
                    ) : (
                      <button className="btn btn-primary" style={{ padding: 8, fontSize: 12 }} onClick={() => addToTransfer(p)}>
                        + Aggiungi
                      </button>
                    )}
                  </div>
                )
              })}
              {filtered.length === 0 && (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-tertiary)' }}>
                  Nessun prodotto trovato
                </div>
              )}
            </div>

            <div className="input-group">
              <label className="input-label">Note (opzionale)</label>
              <textarea className="input" placeholder="Note per il trasferimento..." value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
            </div>

            {selected.length > 0 && (
              <button onClick={handleSubmit} disabled={saving} className="btn btn-primary btn-full btn-lg">
                {saving ? 'Invio...' : `Richiedi Trasferimento (${selected.reduce((s, i) => s + i.qty, 0)} prodotti)`}
              </button>
            )}
          </>
        )}

        {tab === 'history' && (
          <div>
            {transfers.length === 0 && (
              <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-tertiary)' }}>
                Nessun trasferimento recente
              </div>
            )}
            {transfers.map(t => (
              <div key={t.id} className="card card-sm" style={{ marginBottom: 'var(--space-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {t.from_store_id === storeId ? 'In uscita' : 'In entrata'}
                  </div>
                  <span className={`badge ${statusBadge[t.status] ?? 'badge-gray'}`}>{statusLabel[t.status] ?? t.status}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>{formatDate(t.created_at)}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {(t.transfer_items ?? []).map((i: any) => `${i.product_name} ×${i.qty}`).join(', ')}
                </div>
                {t.notes && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>{t.notes}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
