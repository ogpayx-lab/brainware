'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { categoryLabel } from '@/lib/utils'
import { BottomNav } from '@/components/employee/BottomNav'
import type { Product, ProductCategory, InventoryCountItem } from '@/types/database'

interface CountRow extends Product {
  counted: string
  status: 'pending' | 'match' | 'mismatch' | 'escalated'
  mismatchReason: string
  attempts: number
  escalated: boolean
  showEscalateModal: boolean
}

export default function InventoryPage() {
  const router = useRouter()
  const supabase = createClient()

  const [rows, setRows] = useState<CountRow[]>([])
  const [activeCategory, setActiveCategory] = useState<ProductCategory | 'all'>('all')
  const [countId, setCountId] = useState<string | null>(null)
  const [shiftId, setShiftId] = useState<string | null>(null)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [finalizing, setFinalizing] = useState(false)
  const [finalized, setFinalized] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUserId(user.id)

    const { data: profile } = await supabase.from('users').select('store_id').eq('id', user.id).single()
    if (!profile?.store_id) return
    setStoreId(profile.store_id)

    const { data: shift } = await supabase.from('shifts').select('id').eq('user_id', user.id).eq('status', 'open').order('created_at',{ascending:false}).limit(1).single()
    if (!shift) { router.push('/employee/shift/open'); return }
    setShiftId(shift.id)

    const { data: prods } = await supabase
      .from('products').select('*').eq('store_id', profile.store_id).eq('is_active', true).order('name')

    setRows((prods ?? []).map(p => ({
      ...p,
      counted: '',
      status: 'pending',
      mismatchReason: '',
      attempts: 0,
      escalated: false,
      showEscalateModal: false,
    })))
    setLoading(false)
  }

  function handleCount(productId: string, val: string) {
    setRows(prev => prev.map(r => {
      if (r.id !== productId) return r
      if (val === '') return { ...r, counted: '', status: 'pending' }

      const counted = parseInt(val)
      const isMatch = counted === r.stock

      if (isMatch) return { ...r, counted: val, status: 'match', attempts: r.attempts + 1 }

      // Mismatch
      const newAttempts = r.attempts + 1
      if (newAttempts >= 2 && !isMatch) {
        return { ...r, counted: val, status: 'escalated', attempts: newAttempts, showEscalateModal: true }
      }
      return { ...r, counted: val, status: 'mismatch', attempts: newAttempts }
    }))
  }

  async function handleFinalize() {
    if (!shiftId || !storeId || !userId) return
    setFinalizing(true)

    // Create inventory count record
    const { data: count } = await supabase
      .from('inventory_counts')
      .insert({ shift_id: shiftId, store_id: storeId, user_id: userId, finalized: true, finalized_at: new Date().toISOString() })
      .select('id').single()

    if (!count) { setFinalizing(false); return }

    const counted = rows.filter(r => r.counted !== '')
    await supabase.from('inventory_count_items').insert(
      counted.map(r => ({
        inventory_count_id: count.id,
        product_id: r.id,
        product_name: r.name,
        system_qty: r.stock,
        counted_qty: parseInt(r.counted),
        status: r.status,
        mismatch_reason: r.mismatchReason || null,
        attempt_count: r.attempts,
      }))
    )

    setFinalized(true)
    setFinalizing(false)
  }

  const categories: (ProductCategory | 'all')[] = ['all', 'flowers', 'hashish', 'oils', 'edibles', 'accessories']
  const filtered = rows.filter(r => activeCategory === 'all' || r.category === activeCategory)
  const counted = rows.filter(r => r.counted !== '')
  const matchCount = counted.filter(r => r.status === 'match').length
  const mismatchCount = counted.filter(r => r.status === 'mismatch' || r.status === 'escalated').length
  const canFinalize = counted.length > 0 && rows.filter(r => r.status === 'mismatch').every(r => r.mismatchReason.trim().length > 0)

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>Caricamento...</div>

  if (finalized) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-lg)', padding: 'var(--space-lg)' }}>
      <span style={{ fontSize: 64 }}></span>
      <h3>Conteggio finalizzato!</h3>
      <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
        <span className="badge badge-success">{matchCount} Match</span>
        <span className="badge badge-danger">{mismatchCount} Non corrispondenti</span>
      </div>
      <Link href="/employee/dashboard" className="btn btn-primary">Torna alla Dashboard</Link>
    </div>
  )

  return (
    <div className="page" style={{ paddingBottom: 80 }}>
      {/* Escalation modal */}
      {rows.some(r => r.showEscalateModal) && (
        <div className="modal-overlay">
          <div className="modal" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 'var(--space-md)' }}></div>
            <h3 style={{ marginBottom: 'var(--space-sm)' }}>Richiedi Assistenza</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)', fontSize: 14 }}>
              Hai esaurito i tentativi. Il conteggio non corrisponde al valore di sistema. Contatta il responsabile.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setRows(prev => prev.map(r => ({ ...r, showEscalateModal: false })))}>
                Annulla
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setRows(prev => prev.map(r => ({ ...r, showEscalateModal: false })))}>
                 Chiama Responsabile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-subtle)', padding: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
        <Link href="/employee/dashboard" style={{ textDecoration: 'none', color: 'var(--text-primary)', fontSize: 20 }}></Link>
        <div style={{ flex: 1 }}>
          <h3>Conteggio Inventario</h3>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{new Date().toLocaleDateString('it-IT')}</div>
        </div>
      </div>

      {/* Category pills */}
      <div style={{ padding: 'var(--space-md) var(--space-lg)', background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 'var(--space-sm)', overflowX: 'auto' }}>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`badge ${activeCategory === cat ? 'badge-brand' : 'badge-gray'}`}
            style={{ cursor: 'pointer', border: 'none', whiteSpace: 'nowrap', padding: '6px 14px' }}
          >
            {cat === 'all' ? 'Tutti' : categoryLabel[cat]}
          </button>
        ))}
      </div>

      {/* Stats bar */}
      <div style={{ padding: 'var(--space-md) var(--space-lg)', background: 'var(--bg-surface-alt)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 'var(--space-lg)' }}>
        <span style={{ fontSize: 13 }}>Contati: <strong>{counted.length}</strong></span>
        <span style={{ fontSize: 13, color: 'var(--success)' }}> Match: <strong>{matchCount}</strong></span>
        <span style={{ fontSize: 13, color: 'var(--danger)' }}> Non corrisp.: <strong>{mismatchCount}</strong></span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Prodotto</th>
              <th>Sistema</th>
              <th>Contato</th>
              <th>Stato</th>
              <th>Motivo</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(row => (
              <tr key={row.id}>
                <td style={{ fontWeight: 600 }}>{row.name}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{row.stock}</td>
                <td>
                  <input
                    type="number"
                    min="0"
                    value={row.counted}
                    onChange={e => handleCount(row.id, e.target.value)}
                    placeholder=""
                    style={{
                      width: 64, padding: '4px 8px', border: '1.5px solid var(--border-default)',
                      borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 700, textAlign: 'center',
                    }}
                  />
                </td>
                <td>
                  {row.status === 'pending' && <span className="badge badge-gray">In attesa</span>}
                  {row.status === 'match' && <span className="badge badge-success"> Match</span>}
                  {row.status === 'mismatch' && <span className="badge badge-danger"> Non corrisponde</span>}
                  {row.status === 'escalated' && <span className="badge badge-warning"> Escalato</span>}
                </td>
                <td>
                  {(row.status === 'mismatch' || row.status === 'escalated') && (
                    <input
                      type="text"
                      placeholder="Motivo..."
                      value={row.mismatchReason}
                      onChange={e => setRows(prev => prev.map(r =>
                        r.id === row.id ? { ...r, mismatchReason: e.target.value } : r
                      ))}
                      style={{ padding: '4px 8px', border: '1.5px solid var(--border-default)', borderRadius: 'var(--radius-sm)', fontSize: 12, width: 140 }}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Finalize */}
      <div style={{ padding: 'var(--space-lg)' }}>
        <button
          onClick={handleFinalize}
          disabled={!canFinalize || finalizing}
          className="btn btn-primary btn-full btn-lg"
        >
          {finalizing ? 'Finalizzazione...' : `Finalizza Conteggio (${counted.length} prodotti)`}
        </button>
        {!canFinalize && mismatchCount > 0 && (
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>
            Inserisci tutti i motivi per procedere
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
