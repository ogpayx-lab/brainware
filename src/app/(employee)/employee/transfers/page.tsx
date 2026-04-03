'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { BottomNav } from '@/components/employee/BottomNav'
import type { Product, Store } from '@/types/database'

interface TransferItem { product: Product; qty: number }

export default function TransfersPage() {
  const router = useRouter()
  const supabase = createClient()

  const [products, setProducts] = useState<Product[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [transfers, setTransfers] = useState<any[]>([])
  const [selected, setSelected] = useState<TransferItem[]>([])
  const [toStoreId, setToStoreId] = useState('')
  const [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')

  const [storeId, setStoreId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'new' | 'history'>('new')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
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

  function toggleProduct(p: Product) {
    setSelected(prev => {
      const exists = prev.find(i => i.product.id === p.id)
      if (exists) return prev.filter(i => i.product.id !== p.id)
      return [...prev, { product: p, qty: 1 }]
    })
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
    !search || p.name.toLowerCase().includes(search.toLowerCase())
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

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>Caricamento...</div>

  if (done) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-lg)', padding: 'var(--space-lg)' }}>
      <span style={{ fontSize: 64 }}></span>
      <h3>Trasferimento richiesto!</h3>
      <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>La richiesta e stata inviata all'owner per approvazione.</p>
      <Link href="/employee/dashboard" className="btn btn-primary">Torna alla Dashboard</Link>
    </div>
  )

  return (
    <div className="page" style={{ paddingBottom: 80 }}>
      <div style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-subtle)', padding: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
        <Link href="/employee/dashboard" style={{ textDecoration: 'none', color: 'var(--text-primary)', fontSize: 20 }}></Link>
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

            {/* Search products */}
            <input className="input" placeholder="Cerca prodotto..." value={search} onChange={e => setSearch(e.target.value)} />

            {/* Selected */}
            {selected.length > 0 && (
              <div>
                <h4 style={{ marginBottom: 'var(--space-md)' }}>Prodotti da trasferire ({selected.length})</h4>
                {selected.map(item => (
                  <div key={item.product.id} className="card card-sm" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-sm)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{item.product.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Disponibile: {item.product.stock}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button onClick={() => updateQty(item.product.id, item.qty - 1)} className="btn btn-secondary" style={{ width: 30, height: 30, padding: 0 }}></button>
                      <span style={{ fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{item.qty}</span>
                      <button onClick={() => updateQty(item.product.id, item.qty + 1)} className="btn btn-secondary" style={{ width: 30, height: 30, padding: 0 }}>+</button>
                    </div>
                    <button onClick={() => toggleProduct(item.product)} style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}></button>
                  </div>
                ))}
              </div>
            )}

            {/* Product list */}
            <div>
              <h4 style={{ marginBottom: 'var(--space-sm)' }}>Seleziona Prodotti</h4>
              {filtered.map(p => {
                const isSelected = selected.some(i => i.product.id === p.id)
                return (
                  <div
                    key={p.id}
                    onClick={() => toggleProduct(p)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
                      padding: 'var(--space-md)',
                      background: isSelected ? 'var(--brand-primary-light)' : 'var(--bg-primary)',
                      border: `1px solid ${isSelected ? 'var(--brand-primary)' : 'var(--border-default)'}`,
                      borderRadius: 'var(--radius-md)', cursor: 'pointer', marginBottom: 'var(--space-sm)',
                    }}
                  >
                    <div style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${isSelected ? 'var(--brand-primary)' : 'var(--border-strong)'}`, background: isSelected ? 'var(--brand-primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12 }}>
                      {isSelected && ''}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Stock: {p.stock}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="input-group">
              <label className="input-label">Note (opzionale)</label>
              <textarea className="input" placeholder="Note per il trasferimento..." value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
            </div>

            {selected.length > 0 && (
              <button onClick={handleSubmit} disabled={saving} className="btn btn-primary btn-full btn-lg">
                {saving ? 'Invio...' : `Richiedi Trasferimento (${selected.length} prodotti)`}
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
                  {(t.transfer_items ?? []).map((i: any) => `${i.product_name} ${i.qty}`).join(', ')}
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
