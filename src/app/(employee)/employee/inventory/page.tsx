'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { categoryLabel } from '@/lib/utils'
import { BottomNav } from '@/components/employee/BottomNav'
import type { Product, ProductCategory } from '@/types/database'
import { useT } from '@/lib/i18n'

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
  const t = useT()

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
  const [searchQuery, setSearchQuery] = useState('')

  // Time-lock
  const [locked, setLocked] = useState(false)
  const [opensAt, setOpensAt] = useState('09:00')
  const [now, setNow] = useState(new Date())

  useEffect(() => { loadData() }, [])
  // Live countdown clock
  useEffect(() => {
    if (!locked) return
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [locked])

  async function loadData() {
    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
    if (!user) { router.push('/login'); return }
    setUserId(user.id)

    const { data: profile } = await supabase.from('users').select('store_id').eq('id', user.id).single()
    if (!profile?.store_id) return
    setStoreId(profile.store_id)

    // Check time-lock: fetch store inventory config
    const { data: storeConfig } = await supabase.from('stores').select('inventory_count_opens_at, inventory_manually_opened').eq('id', profile.store_id).single()
    const opensTime = storeConfig?.inventory_count_opens_at || '09:00'
    const manuallyOpened = storeConfig?.inventory_manually_opened ?? false
    setOpensAt(opensTime)

    if (!manuallyOpened) {
      // Parse time and check
      const [h, m] = opensTime.split(':').map(Number)
      const nowDate = new Date()
      const opensDate = new Date()
      opensDate.setHours(h, m, 0, 0)
      if (nowDate < opensDate) {
        setLocked(true)
        setLoading(false)
        return
      }
    }
    // If manually opened or time passed, proceed
    setLocked(false)

    const { data: shift } = await supabase.from('shifts').select('id').eq('store_id', profile.store_id).eq('status', 'open').order('created_at', { ascending: false }).limit(1).single()
    if (!shift) { router.push('/employee/shift/open'); return }
    setShiftId(shift.id)

    const { data: prods } = await supabase
      .from('products').select('*').eq('store_id', profile.store_id).eq('is_active', true).neq('stock', 0).order('name')

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

  function handleInput(productId: string, val: string) {
    setRows(prev => prev.map(r =>
      r.id === productId ? { ...r, counted: val, status: val === '' ? 'pending' as const : r.status } : r
    ))
  }

  function handleValidate(productId: string) {
    setRows(prev => prev.map(r => {
      if (r.id !== productId) return r
      if (r.counted === '') return { ...r, status: 'pending' as const }
      const counted = parseInt(r.counted)
      if (isNaN(counted)) return r

      // Simple validation: match or mismatch (no attempt limits)
      if (counted === r.stock) return { ...r, status: 'match' as const }
      return { ...r, status: 'mismatch' as const }
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

    // NOTE: Stock is NOT updated here — owner must approve
    // discrepancies via Audit Inventario before stock changes.

    // Get employee name
    const { data: empProfile } = await supabase.from('users').select('full_name').eq('id', userId).single()
    const empName = empProfile?.full_name || 'Dipendente'
    const matches = countedRows.filter(r => r.status === 'match').length
    const mismatches = countedRows.filter(r => r.status !== 'match').length

    // Build discrepancy report for notification
    const discrepancies = countedRows
      .filter(r => r.status === 'mismatch' || r.status === 'escalated')
      .map(r => {
        const diff = parseInt(r.counted) - r.stock
        return { name: r.name, system: r.stock, counted: parseInt(r.counted), diff }
      })
    const surplus = discrepancies.filter(d => d.diff > 0)
    const deficit = discrepancies.filter(d => d.diff < 0)

    let reportMsg = `${empName} ha finalizzato il conteggio: ${countedRows.length} prodotti, ${matches} ✅ match, ${mismatches} ⚠️ discrepanze.`
    if (discrepancies.length > 0) {
      reportMsg += '\n\n📊 DISCREPANZE:'
      deficit.forEach(d => { reportMsg += `\n  🔴 ${d.name}: sistema ${d.system}, contato ${d.counted} (${d.diff})` })
      surplus.forEach(d => { reportMsg += `\n  🟢 ${d.name}: sistema ${d.system}, contato ${d.counted} (+${d.diff})` })
      if (surplus.length > 0 && deficit.length > 0) {
        reportMsg += '\n\n💡 Possibile scambio prodotti: verificare se items simili sono stati invertiti nelle vendite.'
      }
    }

    await supabase.from('notifications').insert({
      store_id: storeId,
      type: 'inventory_count',
      title: mismatches > 0 ? '📋 Inventario con discrepanze' : '📋 Inventario perfetto ✅',
      message: reportMsg,
    })

    setFinalized(true)
    setFinalizing(false)
  }

  const categories: (ProductCategory | 'all')[] = ['all', 'flowers', 'hashish', 'oils', 'edibles', 'accessories', 'cosmetics', 'clothes', 'seeds', 'vape', 'food']
  const filtered = rows
    .filter(r => activeCategory === 'all' || r.category === activeCategory)
    .filter(r => !searchQuery || r.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))
  const counted = rows.filter(r => r.counted !== '')
  const matchCount = counted.filter(r => r.status === 'match').length
  const mismatchCount = counted.filter(r => r.status === 'mismatch' || r.status === 'escalated').length
  const canFinalize = counted.length > 0

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>{t('loading')}</div>

  // Time-lock screen
  if (locked) {
    const [h, m] = opensAt.split(':').map(Number)
    const opensDate = new Date()
    opensDate.setHours(h, m, 0, 0)
    const diffMs = Math.max(0, opensDate.getTime() - now.getTime())
    const diffH = Math.floor(diffMs / 3600000)
    const diffM = Math.floor((diffMs % 3600000) / 60000)
    const diffS = Math.floor((diffMs % 60000) / 1000)

    // Auto-unlock when time arrives
    if (diffMs === 0) {
      setLocked(false)
      setLoading(true)
      loadData()
    }

    return (
      <div className="page" style={{ paddingBottom: 80 }}>
        <div style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-subtle)', padding: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
          <Link href="/employee/dashboard" style={{ textDecoration: 'none', color: 'var(--text-primary)', fontSize: 20 }}>←</Link>
          <h3>Conteggio Inventario</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-2xl)', minHeight: '60vh', gap: 'var(--space-lg)' }}>
          <span style={{ fontSize: 64 }}>🔒</span>
          <h3 style={{ textAlign: 'center' }}>Il conteggio inventario si aprirà alle {opensAt}</h3>
          <div style={{ fontSize: 32, fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--brand-primary)', letterSpacing: '-0.02em' }}>
            ⏳ {diffH > 0 ? `${diffH}h ` : ''}{diffM.toString().padStart(2, '0')}m {diffS.toString().padStart(2, '0')}s
          </div>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 14, textAlign: 'center', maxWidth: 300 }}>
            Puoi preparare i prodotti nel frattempo. La pagina si sbloccherà automaticamente.
          </p>
        </div>
        <BottomNav />
      </div>
    )
  }

  if (finalized) {
    const discrepancies = rows
      .filter(r => r.counted !== '' && (r.status === 'mismatch' || r.status === 'escalated'))
      .map(r => ({ name: r.name, category: r.category, system: r.stock, counted: parseInt(r.counted), diff: parseInt(r.counted) - r.stock }))
      .sort((a, b) => a.diff - b.diff)
    const surplus = discrepancies.filter(d => d.diff > 0)
    const deficit = discrepancies.filter(d => d.diff < 0)

    return (
      <div className="page" style={{ paddingBottom: 80 }}>
        <div style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-subtle)', padding: 'var(--space-lg)', textAlign: 'center' }}>
          <span style={{ fontSize: 48 }}>{discrepancies.length === 0 ? '🎉' : '📊'}</span>
          <h3>Conteggio finalizzato!</h3>
          <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', marginTop: 8 }}>
            <span className="badge badge-success">{matchCount} Match</span>
            <span className="badge badge-danger">{mismatchCount} Discrepanze</span>
          </div>
        </div>

        {discrepancies.length > 0 && (
          <div style={{ padding: 'var(--space-lg)' }}>
            <h4 style={{ marginBottom: 'var(--space-md)' }}>📊 Report Discrepanze</h4>

            {deficit.length > 0 && (
              <div style={{ marginBottom: 'var(--space-lg)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--danger)', marginBottom: 8 }}>🔴 Meno del previsto ({deficit.length})</div>
                {deficit.map((d, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(239,68,68,0.05)', borderRadius: 8, marginBottom: 4, border: '1px solid rgba(239,68,68,0.15)' }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{d.name}</span>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Sistema: {d.system}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Contato: {d.counted}</span>
                      <span style={{ fontWeight: 800, color: 'var(--danger)', fontSize: 14 }}>{d.diff}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {surplus.length > 0 && (
              <div style={{ marginBottom: 'var(--space-lg)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)', marginBottom: 8 }}>🟢 Più del previsto ({surplus.length})</div>
                {surplus.map((d, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(34,197,94,0.05)', borderRadius: 8, marginBottom: 4, border: '1px solid rgba(34,197,94,0.15)' }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{d.name}</span>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Sistema: {d.system}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Contato: {d.counted}</span>
                      <span style={{ fontWeight: 800, color: 'var(--success)', fontSize: 14 }}>+{d.diff}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {surplus.length > 0 && deficit.length > 0 && (
              <div style={{ padding: '12px 16px', background: 'rgba(99,102,241,0.06)', borderRadius: 8, border: '1px solid rgba(99,102,241,0.2)', marginBottom: 'var(--space-lg)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-primary)', marginBottom: 4 }}>💡 Possibile scambio prodotti</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Ci sono prodotti in eccesso e in difetto. Verifica se items simili sono stati invertiti nelle vendite di ieri.</div>
              </div>
            )}
          </div>
        )}

        {discrepancies.length === 0 && (
          <div style={{ padding: 'var(--space-2xl)', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--success)' }}>Tutto perfetto! Nessuna discrepanza.</div>
          </div>
        )}

        <div style={{ padding: 'var(--space-lg)', textAlign: 'center' }}>
          <Link href="/employee/dashboard" className="btn btn-primary btn-lg">Torna alla Dashboard</Link>
        </div>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="page" style={{ paddingBottom: 80 }}>

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
        {categories.filter(cat => cat === 'all' || rows.some(r => r.category === cat)).map(cat => {
          const catCount = cat === 'all' ? rows.length : rows.filter(r => r.category === cat).length
          const catCounted = cat === 'all' ? counted.length : counted.filter(r => r.category === cat).length
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`badge ${activeCategory === cat ? 'badge-brand' : 'badge-gray'}`}
              style={{ cursor: 'pointer', border: 'none', whiteSpace: 'nowrap', padding: '6px 14px', fontSize: 12 }}
            >
              {cat === 'all' ? 'Tutti' : categoryLabel[cat]} ({catCounted}/{catCount})
            </button>
          )
        })}
      </div>

      {/* Search bar */}
      <div style={{ padding: 'var(--space-sm) var(--space-lg)', background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-subtle)' }}>
        <input
          type="text"
          placeholder="🔍 Cerca prodotto..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            width: '100%', padding: '10px 14px', border: '1.5px solid var(--border-default)',
            borderRadius: 'var(--radius-md)', fontSize: 14, background: 'var(--bg-surface)',
          }}
        />
      </div>

      {/* Progress bar */}
      <div style={{ padding: 'var(--space-md) var(--space-lg)', background: 'var(--bg-surface-alt)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Progresso: {counted.length}/{rows.length}</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>✅ {matchCount}</span>
            <span style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 600 }}>❌ {mismatchCount}</span>
          </div>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: 'var(--border-subtle)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 3, transition: 'width 0.3s',
            width: `${rows.length > 0 ? (counted.length / rows.length) * 100 : 0}%`,
            background: mismatchCount > 0 ? 'linear-gradient(90deg, var(--success), var(--danger))' : 'var(--success)',
          }} />
        </div>
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
                  <input
                    type="number"
                    min="0"
                    value={row.counted}
                    onChange={e => handleInput(row.id, e.target.value)}
                    onBlur={() => handleValidate(row.id)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur() } }}
                    placeholder=""
                    style={{
                      width: 64, padding: '4px 8px',
                      border: `2px solid ${row.status === 'match' ? 'var(--success)' : row.status === 'mismatch' ? 'var(--danger)' : 'var(--border-default)'}`,
                      background: row.status === 'match' ? 'rgba(34,197,94,0.08)' : row.status === 'mismatch' ? 'rgba(239,68,68,0.08)' : 'var(--bg-primary)',
                      borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 700, textAlign: 'center',
                    }}
                  />
                </td>
                <td>
                  {row.status === 'pending' && <span className="badge badge-gray">In attesa</span>}
                  {row.status === 'match' && <span className="badge badge-success">✅ Match</span>}
                  {row.status === 'mismatch' && <span className="badge badge-danger">❌ Non corrisponde</span>}
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
