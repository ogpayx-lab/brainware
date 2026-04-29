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
  const [tab, setTab] = useState<'request' | 'history'>('request')
  const [history, setHistory] = useState<any[]>([])

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
    // Load history
    const { data: histData } = await supabase
      .from('stock_requests')
      .select('*, stock_request_items(*)')
      .eq('store_id', profile.store_id)
      .in('status', ['approved', 'owner_review', 'pending', 'restock_requested'])
      .order('created_at', { ascending: false })
      .limit(30)
    setHistory(histData ?? [])
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

    const productList = selectedProducts.map(p => p.name).join(', ')
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
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setTab('request')} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: `1.5px solid ${tab === 'request' ? 'var(--brand-primary)' : 'var(--border-default)'}`, background: tab === 'request' ? 'var(--brand-primary-light)' : 'transparent', color: tab === 'request' ? 'var(--brand-primary)' : 'var(--text-secondary)', cursor: 'pointer' }}>🔔 Richiedi</button>
          <button onClick={() => setTab('history')} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: `1.5px solid ${tab === 'history' ? 'var(--brand-primary)' : 'var(--border-default)'}`, background: tab === 'history' ? 'var(--brand-primary-light)' : 'transparent', color: tab === 'history' ? 'var(--brand-primary)' : 'var(--text-secondary)', cursor: 'pointer' }}>📋 Storico</button>
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

      {tab === 'request' && (
        <>
          {/* Search + Categories */}
          <div style={{ padding: 'var(--space-lg)', paddingBottom: 0 }}>
            <div style={{ position: 'relative', marginBottom: 'var(--space-md)' }}>
              <input className="input" placeholder="Cerca prodotto..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16 }}>🔍</span>
            </div>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 'var(--space-lg)', paddingBottom: 4 }}>
              {(['all', ...CATEGORIES] as (ProductCategory | 'all')[]).map(c => (
                <button key={c} onClick={() => setActiveCat(c)} className={`badge ${activeCat === c ? 'badge-brand' : 'badge-gray'}`} style={{ cursor: 'pointer', border: 'none', padding: '6px 14px', whiteSpace: 'nowrap' }}>
                  {c === 'all' ? 'Tutto' : categoryLabel[c]}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 var(--space-lg)', paddingBottom: selectedIds.size > 0 ? 80 : 'var(--space-lg)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 'var(--space-md)' }}>
              {filtered.map(p => {
                const isSelected = selectedIds.has(p.id)
                return (
                  <div key={p.id} onClick={() => toggle(p.id)} className="card card-sm" style={{
                    cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8,
                    border: isSelected ? '2px solid var(--brand-primary)' : undefined,
                    background: isSelected ? 'var(--brand-primary-light)' : undefined,
                    position: 'relative',
                  }}>
                    {isSelected && (
                      <div style={{ position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: '50%', background: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 700 }}>✓</div>
                    )}
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                    <span className="badge badge-indigo" style={{ fontSize: 10 }}>
                      {categoryLabel[p.category as ProductCategory] || p.category}
                    </span>
                  </div>
                )
              })}
            </div>
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-tertiary)' }}>Nessun prodotto trovato</div>
            )}
          </div>

          {/* Floating bottom bar */}
          {selectedIds.size > 0 && (
            <div style={{ position: 'fixed', bottom: 60, left: 0, right: 0, padding: '12px var(--space-lg)', background: 'var(--bg-primary)', borderTop: '1px solid var(--border-subtle)', boxShadow: '0 -4px 20px rgba(0,0,0,0.1)', zIndex: 50 }}>
              <button onClick={sendRequest} disabled={saving} className="btn btn-primary btn-full btn-lg">
                {saving ? 'Invio...' : `🔔 Invia Richiesta (${selectedIds.size} prodotti)`}
              </button>
            </div>
          )}
        </>
      )}

      {tab === 'history' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-lg)' }}>
          {history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-tertiary)' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Nessuna ricarica ancora</div>
              <div style={{ fontSize: 13 }}>Le ricariche completate appariranno qui</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {history.map(req => {
                const items = req.stock_request_items || []
                const statusMap: Record<string, { label: string; badge: string }> = {
                  approved: { label: '✅ Approvata', badge: 'badge-success' },
                  owner_review: { label: '⚠️ In revisione', badge: 'badge-warning' },
                  pending: { label: '⏳ In attesa', badge: 'badge-gray' },
                  restock_requested: { label: '🔔 Richiesta', badge: 'badge-brand' },
                }
                const st = statusMap[req.status] || { label: req.status, badge: 'badge-gray' }
                return (
                  <div key={req.id} className="card" style={{ padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{items.length} prodotti</div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                          {new Date(req.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <span className={`badge ${st.badge}`}>{st.label}</span>
                    </div>
                    {req.notes && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>{req.notes}</div>}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {items.slice(0, 8).map((item: any) => (
                        <span key={item.id} className="badge badge-gray" style={{ fontSize: 11 }}>
                          {item.product_name}{item.qty_delivered ? ` ×${item.qty_delivered}` : ''}
                        </span>
                      ))}
                      {items.length > 8 && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>+{items.length - 8} altri</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <BottomNav />
    </div>
  )
}
