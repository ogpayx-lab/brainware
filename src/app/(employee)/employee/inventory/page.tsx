'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { categoryLabel } from '@/lib/utils'
import { BottomNav } from '@/components/employee/BottomNav'
import type { Product, ProductCategory } from '@/types/database'

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
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUserId(user.id)

    const { data: profile } = await supabase.from('users').select('store_id').eq('id', user.id).single()
    if (!profile?.store_id) return
    setStoreId(profile.store_id)

    const { data: shift } = await supabase.from('shifts').select('id').eq('store_id', profile.store_id).eq('status', 'open').order('created_at',{ascending:false}).limit(1).single()
    if (!shift) { router.push('/employee/shift/open'); return }
    setShiftId(shift.id)

    const { data: prods } = await supabase
      .from('products').select('*').eq('store_id', profile.store_id).eq('is_active', true).order('name')

    // Check for existing draft (non-finalized count for this store)
    const { data: existingCount } = await supabase
      .from('inventory_counts')
      .select('id')
      .eq('store_id', profile.store_id)
      .eq('finalized', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    let savedItems: any[] = []
    if (existingCount) {
      setCountId(existingCount.id)
      const { data: items } = await supabase
        .from('inventory_count_items')
        .select('*')
        .eq('inventory_count_id', existingCount.id)
      savedItems = items ?? []
    }

    setRows((prods ?? []).map(p => {
      const saved = savedItems.find(s => s.product_id === p.id)
      if (saved) {
        const isEscalated = saved.status === 'escalated'
        return {
          ...p,
          counted: saved.counted_qty?.toString() ?? '',
          status: saved.status || 'pending',
          mismatchReason: saved.mismatch_reason || '',
          attempts: saved.attempt_count || 0,
          escalated: isEscalated,
          showEscalateModal: false,
        }
      }
      return {
        ...p,
        counted: '',
        status: 'pending' as const,
        mismatchReason: '',
        attempts: 0,
        escalated: false,
        showEscalateModal: false,
      }
    }))
    setLoading(false)
  }

  function handleCount(productId: string, val: string) {
    setRows(prev => prev.map(r => {
      if (r.id !== productId) return r
      if (r.escalated) return r // bloccato dopo 2 tentativi
      if (val === '') return { ...r, counted: '', status: 'pending' }

      const counted = parseInt(val)
      const isMatch = counted === r.stock

      if (isMatch) return { ...r, counted: val, status: 'match', attempts: r.attempts + 1 }

      // Mismatch
      const newAttempts = r.attempts + 1
      if (newAttempts >= 2 && !isMatch) {
        return { ...r, counted: val, status: 'escalated', attempts: newAttempts, escalated: true, showEscalateModal: true }
      }
      return { ...r, counted: val, status: 'mismatch', attempts: newAttempts }
    }))
  }

  async function saveItems(targetCountId: string) {
    const countedRows = rows.filter(r => r.counted !== '')
    // Delete old items and re-insert
    await supabase.from('inventory_count_items').delete().eq('inventory_count_id', targetCountId)
    if (countedRows.length > 0) {
      await supabase.from('inventory_count_items').insert(
        countedRows.map(r => ({
          inventory_count_id: targetCountId,
          product_id: r.id,
          product_name: r.name,
          system_qty: r.stock,
          counted_qty: parseInt(r.counted),
          status: r.status,
          mismatch_reason: r.mismatchReason || null,
          attempt_count: r.attempts,
        }))
      )
    }
  }

  async function handleSaveDraft() {
    if (!shiftId || !storeId || !userId) return
    setSaving(true)
    setSavedMsg('')

    let draftId = countId
    if (!draftId) {
      const { data: count } = await supabase
        .from('inventory_counts')
        .insert({ shift_id: shiftId, store_id: storeId, user_id: userId, finalized: false })
        .select('id').single()
      if (!count) { setSaving(false); return }
      draftId = count.id
      setCountId(draftId)
    }

    await saveItems(draftId!)
    setSaving(false)
    setSavedMsg('✅ Inventario salvato!')
    setTimeout(() => setSavedMsg(''), 3000)
  }

  async function handleFinalize() {
    if (!shiftId || !storeId || !userId) return
    setFinalizing(true)

    let finalId = countId
    if (!finalId) {
      const { data: count } = await supabase
        .from('inventory_counts')
        .insert({ shift_id: shiftId, store_id: storeId, user_id: userId, finalized: true, finalized_at: new Date().toISOString() })
        .select('id').single()
      if (!count) { setFinalizing(false); return }
      finalId = count.id
    } else {
      await supabase.from('inventory_counts').update({ finalized: true, finalized_at: new Date().toISOString() }).eq('id', finalId)
    }

    await saveItems(finalId!)

    // Get employee name
    const { data: empProfile } = await supabase.from('users').select('full_name').eq('id', userId).single()
    const empName = empProfile?.full_name || 'Dipendente'
    const countedRows = rows.filter(r => r.counted !== '')
    const matches = countedRows.filter(r => r.status === 'match').length
    const mismatches = countedRows.filter(r => r.status !== 'match').length

    await supabase.from('notifications').insert({
      store_id: storeId,
      type: 'inventory_count',
      title: '📋 Inventario completato',
      message: `${empName} ha finalizzato il conteggio inventario: ${countedRows.length} prodotti, ${matches} ✅ match, ${mismatches} ⚠️ discrepanze.`,
    })

    setFinalized(true)
    setFinalizing(false)
  }

  const categories: (ProductCategory | 'all')[] = ['all', 'flowers', 'hashish', 'oils', 'edibles', 'accessories']
  const filtered = rows.filter(r => activeCategory === 'all' || r.category === activeCategory)
  const counted = rows.filter(r => r.counted !== '')
  const matchCount = counted.filter(r => r.status === 'match').length
  const mismatchCount = counted.filter(r => r.status === 'mismatch' || r.status === 'escalated').length
  const canFinalize = counted.length > 0

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
              <th>Contato</th>
              <th>Stato</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(row => (
              <tr key={row.id}>
                <td style={{ fontWeight: 600 }}>{row.name}</td>
                <td>
                  {row.escalated ? (
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontWeight:700, fontSize:14 }}>{row.counted}</span>
                      <button
                        onClick={() => setRows(prev => prev.map(r => r.id === row.id ? { ...r, showEscalateModal: true } : r))}
                        title="Richiedi assistenza"
                        style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', padding:0 }}
                      >🆘</button>
                    </div>
                  ) : (
                    <input
                      type="number"
                      min="0"
                      value={row.counted}
                      onChange={e => handleCount(row.id, e.target.value)}
                      placeholder=""
                      style={{
                        width: 64, padding: '4px 8px',
                        border: `1.5px solid ${row.status === 'mismatch' ? 'var(--warning)' : 'var(--border-default)'}`,
                        borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 700, textAlign: 'center',
                      }}
                    />
                  )}
                  {row.status === 'mismatch' && <div style={{ fontSize:10, color:'var(--warning)', marginTop:2 }}>Tentativo {row.attempts}/2</div>}
                </td>
                <td>
                  {row.status === 'pending' && <span className="badge badge-gray">In attesa</span>}
                  {row.status === 'match' && <span className="badge badge-success">✅ Match</span>}
                  {row.status === 'mismatch' && <span className="badge badge-warning">⚠️ Riprova</span>}
                  {row.status === 'escalated' && <span className="badge badge-danger">🆘 Assistenza</span>}
                </td>
                <td>
                  {(row.status === 'mismatch' || row.status === 'escalated') && (
                    <input
                      type="text"
                      placeholder="Note (opzionale)"
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

      {/* Actions */}
      <div style={{ padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button
            onClick={handleSaveDraft}
            disabled={saving || counted.length === 0}
            className="btn btn-secondary btn-lg"
          >
            {saving ? '⏳ Salvataggio...' : '💾 Salva Inventario'}
          </button>
          <button
            onClick={handleFinalize}
            disabled={!canFinalize || finalizing}
            className="btn btn-primary btn-lg"
          >
            {finalizing ? 'Finalizzazione...' : '✅ Finalizza Conteggio'}
          </button>
        </div>
        {savedMsg && (
          <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>
            {savedMsg}
          </div>
        )}
        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>
          {counted.length} prodotti contati · {matchCount} ✅ · {mismatchCount} ⚠️
          {countId && <span> · 📂 Bozza salvata</span>}
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
