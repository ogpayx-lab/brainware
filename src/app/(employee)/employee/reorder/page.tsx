'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { categoryLabel } from '@/lib/utils'
import type { ProductCategory } from '@/types/database'
import { BottomNav } from '@/components/employee/BottomNav'

const CATEGORIES: ProductCategory[] = ['flowers','hashish','oils','edibles','accessories','cosmetics','clothes','seeds','vape','food']

export default function RichiediRicaricaPage() {
  const router = useRouter()
  const supabase = createClient()
  const [products, setProducts] = useState<any[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [storeId, setStoreId] = useState<string | null>(null)
  const [empName, setEmpName] = useState('')
  const [search, setSearch] = useState('')
  const [activeCat, setActiveCat] = useState<ProductCategory | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('users').select('store_id, stores(name)').eq('id', user.id).single()
    if (!profile?.store_id) { router.push('/login'); return }
    setStoreId(profile.store_id)

    const activeEmpStr = typeof window !== 'undefined' ? localStorage.getItem('brainware_active_employee') : null
    const activeEmp = activeEmpStr ? JSON.parse(activeEmpStr) : null
    setEmpName(activeEmp?.name || 'Dipendente')

    const { data: prods } = await supabase
      .from('products').select('*')
      .eq('store_id', profile.store_id).eq('is_active', true)
      .order('name')
    setProducts(prods ?? [])
    setLoading(false)
  }

  function toggle(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function sendRequest() {
    if (!storeId || selectedIds.size === 0) return
    setSaving(true)
    const selectedProducts = products.filter(p => selectedIds.has(p.id))

    // Create a stock_request for the restock
    const { data: sr } = await supabase.from('stock_requests').insert({
      store_id: storeId,
      status: 'restock_requested',
      notes: `${empName} richiede ricarica per ${selectedProducts.length} prodotti`,
    }).select('id').single()

    if (sr) {
      // Save each product as an item
      await supabase.from('stock_request_items').insert(
        selectedProducts.map(p => ({
          stock_request_id: sr.id,
          product_id: p.id,
          product_name: p.name,
          stock_before: p.stock,
          qty_requested: 0,
          qty_sent: 0,
        }))
      )
    }

    const productList = selectedProducts.map(p => `${p.name} (stock: ${p.stock})`).join(', ')
    await supabase.from('notifications').insert({
      store_id: storeId,
      type: 'restock_request',
      title: '🔔 Richiesta Ricarica',
      message: `${empName} richiede ricarica per ${selectedIds.size} prodotti: ${productList}`,
      metadata: sr ? JSON.stringify({ stock_request_id: sr.id }) : null,
    })

    setSaving(false)
    setDone(true)
  }

  // Same filtering logic as POS
  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase())
    const matchCat = activeCat === 'all' || p.category === activeCat
    return matchSearch && matchCat
  })

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>Caricamento...</div>

  if (done) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
      <div style={{ fontSize: 56 }}>✅</div>
      <h3 style={{ textAlign: 'center' }}>Richiesta inviata!</h3>
      <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: 14 }}>
        L'owner ha ricevuto la notifica con i {selectedIds.size} prodotti da ricaricare.
      </p>
      <Link href="/employee/dashboard" className="btn btn-primary">Torna alla Dashboard</Link>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-subtle)', padding: 'var(--space-md) var(--space-lg)', display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
        <Link href="/employee/dashboard" style={{ textDecoration: 'none', color: 'var(--text-primary)', fontSize: 20 }}>←</Link>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 16 }}>🔔 Richiedi Ricarica</h3>
        </div>
        {selectedIds.size > 0 && (
          <span style={{
            background: 'var(--danger)', color: 'white', borderRadius: 20,
            padding: '4px 12px', fontSize: 13, fontWeight: 700,
          }}>
            {selectedIds.size} selezionati
          </span>
        )}
      </div>

      {/* Search + Categories — same as POS */}
      <div style={{ padding: 'var(--space-lg)', paddingBottom: 0 }}>
        <div style={{ position: 'relative', marginBottom: 'var(--space-md)' }}>
          <input
            className="input"
            placeholder="Cerca prodotto..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 36 }}
          />
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16 }}>🔍</span>
        </div>

        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 'var(--space-lg)', paddingBottom: 4 }}>
          {(['all', ...CATEGORIES] as (ProductCategory | 'all')[]).map(c => (
            <button
              key={c}
              onClick={() => setActiveCat(c)}
              className={`badge ${activeCat === c ? 'badge-brand' : 'badge-gray'}`}
              style={{ cursor: 'pointer', border: 'none', padding: '6px 14px', whiteSpace: 'nowrap' }}
            >
              {c === 'all' ? 'Tutto' : categoryLabel[c]}
            </button>
          ))}
        </div>
      </div>

      {/* Product Grid — same as POS */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 var(--space-lg)', paddingBottom: selectedIds.size > 0 ? 80 : 'var(--space-lg)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 'var(--space-md)' }}>
          {filtered.map(p => {
            const isSelected = selectedIds.has(p.id)
            const isLow = p.stock <= p.stock_alert
            return (
              <div
                key={p.id}
                onClick={() => toggle(p.id)}
                className="card card-sm"
                style={{
                  cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8,
                  border: isSelected ? '2px solid var(--brand-primary)' : undefined,
                  background: isSelected ? 'var(--brand-primary-light)' : undefined,
                  position: 'relative',
                }}
              >
                {/* Selection indicator */}
                {isSelected && (
                  <div style={{
                    position: 'absolute', top: 8, right: 8, width: 22, height: 22,
                    borderRadius: '50%', background: 'var(--brand-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontSize: 12, fontWeight: 700,
                  }}>✓</div>
                )}
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                  <span className="badge badge-indigo" style={{ fontSize: 10, marginTop: 4 }}>
                    {categoryLabel[p.category as ProductCategory] || p.category}
                  </span>
                </div>
                <div style={{
                  fontSize: 11, fontWeight: 600,
                  color: p.stock === 0 ? 'var(--danger)' : isLow ? 'var(--warning)' : 'var(--success)',
                }}>
                  Stock: {p.stock}
                  {isLow && p.stock > 0 && ' ⚠️'}
                  {p.stock === 0 && ' 🚫'}
                </div>
              </div>
            )
          })}
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-tertiary)' }}>
            Nessun prodotto trovato
          </div>
        )}
      </div>

      {/* Floating bottom bar when items selected */}
      {selectedIds.size > 0 && (
        <div style={{
          position: 'fixed', bottom: 60, left: 0, right: 0,
          padding: '12px var(--space-lg)',
          background: 'var(--bg-primary)',
          borderTop: '1px solid var(--border-subtle)',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
          zIndex: 50,
        }}>
          <button onClick={sendRequest} disabled={saving} className="btn btn-primary btn-full btn-lg">
            {saving ? 'Invio...' : `🔔 Invia Richiesta (${selectedIds.size} prodotti)`}
          </button>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
