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

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUserId(user.id)

    const { data: profile } = await supabase.from('users').select('store_id').eq('id', user.id).single()
    if (!profile?.store_id) return
    setStoreId(profile.store_id)

    const { data: shift } = await supabase.from('shifts').select('id').eq('user_id', user.id).eq('status', 'open').single()
    if (!shift) { router.push('/employee/shift/open'); return }
    setShiftId(shift.id)

    const { data: prods } = await supabase
      .from('products').select('*').eq('store_id', profile.store_id).eq('is_active', true).order('name')
    setProducts(prods ?? [])
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

  async function handleSubmit() {
    if (!shiftId || !storeId || !userId || selected.length === 0) return
    setSaving(true)

    const { data: req } = await supabase
      .from('stock_requests')
      .insert({ shift_id: shiftId, store_id: storeId, user_id: userId })
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

    setDone(true)
    setSaving(false)
  }

  const filtered = products.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>Caricamento...</div>

  if (done) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-lg)', padding: 'var(--space-lg)' }}>
      <span style={{ fontSize: 64 }}></span>
      <h3>Richiesta inviata!</h3>
      <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>La richiesta di ricarica e stata inviata all'owner per l'approvazione.</p>
      <Link href="/employee/dashboard" className="btn btn-primary">Torna alla Dashboard</Link>
    </div>
  )

  return (
    <div className="page" style={{ paddingBottom: 80 }}>
      <div style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-subtle)', padding: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
        <Link href="/employee/dashboard" style={{ textDecoration: 'none', color: 'var(--text-primary)', fontSize: 20 }}></Link>
        <div style={{ flex: 1 }}>
          <h3>Ricarica Stock</h3>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{new Date().toLocaleDateString('it-IT')}</div>
        </div>
      </div>

      <div style={{ padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

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
                    <button onClick={() => updateQty(item.product.id, item.qty - 10)} className="btn btn-secondary" style={{ width: 32, height: 32, padding: 0 }}></button>
                    <input
                      type="number"
                      value={item.qty}
                      onChange={e => updateQty(item.product.id, parseInt(e.target.value) || 1)}
                      style={{ width: 60, textAlign: 'center', border: '1.5px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '4px', fontSize: 14, fontWeight: 700 }}
                    />
                    <button onClick={() => updateQty(item.product.id, item.qty + 10)} className="btn btn-secondary" style={{ width: 32, height: 32, padding: 0 }}>+</button>
                  </div>
                  <button onClick={() => toggleProduct(item.product)} style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}></button>
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
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-md)',
                    padding: 'var(--space-md) var(--space-lg)',
                    background: isSelected ? 'var(--brand-primary-light)' : 'var(--bg-primary)',
                    border: `1.5px solid ${isSelected ? 'var(--brand-primary)' : 'var(--border-default)'}`,
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    transition: 'all var(--transition)',
                  }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: 4,
                    border: `2px solid ${isSelected ? 'var(--brand-primary)' : 'var(--border-strong)'}`,
                    background: isSelected ? 'var(--brand-primary)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontSize: 12, flexShrink: 0,
                  }}>
                    {isSelected && ''}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{product.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Stock: {product.stock}  Alert: {product.stock_alert}</div>
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
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="btn btn-primary btn-full btn-lg"
          >
            {saving ? 'Invio...' : `Invia Richiesta (${selected.length} prodotti)`}
          </button>
        )}

      </div>
      <BottomNav />
    </div>
  )
}
