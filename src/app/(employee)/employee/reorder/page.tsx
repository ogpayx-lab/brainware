'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { BottomNav } from '@/components/employee/BottomNav'

export default function RichiediRicaricaPage() {
  const router = useRouter()
  const supabase = createClient()
  const [products, setProducts] = useState<any[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [storeId, setStoreId] = useState<string | null>(null)
  const [empName, setEmpName] = useState('')
  const [search, setSearch] = useState('')
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

    // Get active employee from localStorage (shared tablet model)
    const activeEmpStr = typeof window !== 'undefined' ? localStorage.getItem('brainware_active_employee') : null
    const activeEmp = activeEmpStr ? JSON.parse(activeEmpStr) : null
    setEmpName(activeEmp?.name || 'Dipendente')

    const { data: prods } = await supabase
      .from('products').select('*')
      .eq('store_id', profile.store_id).eq('is_active', true)
      .order('stock', { ascending: true })
    setProducts(prods ?? [])

    // Pre-select low stock items
    const lowStock = (prods ?? []).filter(p => p.stock <= p.stock_alert)
    setSelectedIds(new Set(lowStock.map(p => p.id)))

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
    const productList = selectedProducts.map(p => `${p.name} (stock: ${p.stock})`).join(', ')

    // Send notification to owner
    await supabase.from('notifications').insert({
      store_id: storeId,
      type: 'restock_request',
      title: '🔔 Richiesta Ricarica',
      message: `${empName} richiede ricarica per ${selectedIds.size} prodotti: ${productList}`,
    })

    setSaving(false)
    setDone(true)
  }

  const filtered = products.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  )
  const lowStock = filtered.filter(p => p.stock <= p.stock_alert)
  const okStock = filtered.filter(p => p.stock > p.stock_alert)

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
    <div className="page" style={{ paddingBottom: 80 }}>
      <div style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-subtle)', padding: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
        <Link href="/employee/dashboard" style={{ textDecoration: 'none', color: 'var(--text-primary)', fontSize: 20 }}>←</Link>
        <div style={{ flex: 1 }}>
          <h3>Richiedi Ricarica</h3>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Seleziona i prodotti che servono</div>
        </div>
        {selectedIds.size > 0 && (
          <span className="badge badge-brand">{selectedIds.size}</span>
        )}
      </div>

      <div style={{ padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

        <input
          className="input"
          placeholder="Cerca prodotto..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {/* Low stock section */}
        {lowStock.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
              ⚠️ Stock basso ({lowStock.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {lowStock.map(p => {
                const isSelected = selectedIds.has(p.id)
                return (
                  <div key={p.id} onClick={() => toggle(p.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                    background: isSelected ? 'rgba(239,68,68,0.08)' : 'var(--bg-primary)',
                    border: `1.5px solid ${isSelected ? 'var(--danger)' : 'var(--border-default)'}`,
                  }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                      border: `2px solid ${isSelected ? 'var(--danger)' : 'var(--border-strong)'}`,
                      background: isSelected ? 'var(--danger)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontSize: 12,
                    }}>
                      {isSelected && '✓'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                        Stock: <strong style={{ color: p.stock <= 5 ? 'var(--danger)' : 'var(--warning)' }}>{p.stock}</strong> / soglia: {p.stock_alert}
                      </div>
                    </div>
                    <span className="badge badge-danger" style={{ fontSize: 10 }}>Basso</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* OK stock section */}
        {okStock.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
              Altri prodotti ({okStock.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {okStock.map(p => {
                const isSelected = selectedIds.has(p.id)
                return (
                  <div key={p.id} onClick={() => toggle(p.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                    background: isSelected ? 'var(--brand-primary-light)' : 'var(--bg-primary)',
                    border: `1.5px solid ${isSelected ? 'var(--brand-primary)' : 'var(--border-default)'}`,
                    opacity: 0.8,
                  }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                      border: `2px solid ${isSelected ? 'var(--brand-primary)' : 'var(--border-strong)'}`,
                      background: isSelected ? 'var(--brand-primary)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontSize: 12,
                    }}>
                      {isSelected && '✓'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Stock: {p.stock}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {selectedIds.size > 0 && (
          <button onClick={sendRequest} disabled={saving} className="btn btn-primary btn-full btn-lg">
            {saving ? 'Invio...' : `🔔 Invia Richiesta (${selectedIds.size} prodotti)`}
          </button>
        )}
      </div>
      <BottomNav />
    </div>
  )
}
