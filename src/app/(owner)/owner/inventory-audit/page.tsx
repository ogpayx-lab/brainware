'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDate, categoryLabel } from '@/lib/utils'
import type { Store, ProductCategory } from '@/types/database'

type Tab = 'audit' | 'config' | 'history' | 'stats'

interface CountSummary {
  id: string
  store_id: string
  store_name: string
  user_name: string
  user_id: string
  finalized_at: string
  total: number
  matches: number
  mismatches: number
  escalated: number
  items: CountItem[]
}

interface CountItem {
  id: string
  product_id: string
  product_name: string
  system_qty: number
  counted_qty: number | null
  status: string
  mismatch_reason: string | null
  resolved: boolean
  resolution_type: string | null
  resolution_notes: string | null
  corrected_qty: number | null
  stock_corrected: boolean
}

interface Diagnosis {
  type: string
  label: string
  icon: string
  detail: string
}

export default function InventoryAuditPage() {
  const router = useRouter()
  const supabase = createClient()

  const [tab, setTab] = useState<Tab>('audit')
  const [stores, setStores] = useState<(Store & { inventory_count_opens_at?: string; inventory_manually_opened?: boolean })[]>([])
  const [selectedStore, setSelectedStore] = useState('')
  const [loading, setLoading] = useState(true)
  const [orgStoreIds, setOrgStoreIds] = useState<string[]>([])

  // Audit
  const [auditData, setAuditData] = useState<CountSummary | null>(null)
  const [diagnoses, setDiagnoses] = useState<Record<string, Diagnosis[]>>({})
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [resolveNote, setResolveNote] = useState('')
  const [correctQty, setCorrectQty] = useState('')
  const [savingResolve, setSavingResolve] = useState(false)

  // Config
  const [savingConfig, setSavingConfig] = useState<string | null>(null)
  const [configTimes, setConfigTimes] = useState<Record<string, string>>({})

  // History
  const [historyDate, setHistoryDate] = useState(new Date().toISOString().split('T')[0])
  const [historyStore, setHistoryStore] = useState('')
  const [historyCounts, setHistoryCounts] = useState<CountSummary[]>([])
  const [expandedCount, setExpandedCount] = useState<string | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Stats
  const [statsData, setStatsData] = useState<any>(null)
  const [loadingStats, setLoadingStats] = useState(false)

  useEffect(() => { loadStores() }, [])

  async function loadStores() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('users').select('store_id, role').eq('id', user.id).single()
    if (profile?.role !== 'owner') { router.push('/login'); return }

    const { data: myStore } = await supabase.from('stores').select('organization_id').eq('id', profile.store_id).single()
    const org = myStore?.organization_id

    let query = supabase.from('stores').select('*').eq('is_active', true)
    if (org) query = query.eq('organization_id', org)
    const { data: storeList } = await query.order('name')
    const allStores = storeList ?? []
    setStores(allStores)
    setOrgStoreIds(allStores.map(s => s.id))

    // Init config times
    const times: Record<string, string> = {}
    allStores.forEach(s => { times[s.id] = (s as any).inventory_count_opens_at || '18:00' })
    setConfigTimes(times)

    if (allStores.length > 0) {
      setSelectedStore(allStores[0].id)
      setHistoryStore(allStores[0].id)
    }
    setLoading(false)
  }

  // ═══ AUDIT ═══
  useEffect(() => {
    if (selectedStore && tab === 'audit') loadAudit()
  }, [selectedStore, tab])

  async function loadAudit() {
    if (!selectedStore) return

    const { data: counts } = await supabase
      .from('inventory_counts')
      .select('id, store_id, user_id, finalized_at, users(full_name), stores(name)')
      .eq('store_id', selectedStore)
      .eq('finalized', true)
      .order('finalized_at', { ascending: false })
      .limit(1)

    if (!counts || counts.length === 0) { setAuditData(null); return }

    const count = counts[0]
    const { data: items } = await supabase
      .from('inventory_count_items')
      .select('*')
      .eq('inventory_count_id', count.id)

    const allItems: CountItem[] = (items ?? []).map(i => ({
      id: i.id,
      product_id: i.product_id,
      product_name: i.product_name,
      system_qty: i.system_qty,
      counted_qty: i.counted_qty,
      status: i.status,
      mismatch_reason: i.mismatch_reason,
      resolved: i.resolved ?? false,
      resolution_type: i.resolution_type,
      resolution_notes: i.resolution_notes,
      corrected_qty: i.corrected_qty,
      stock_corrected: i.stock_corrected ?? false,
    }))

    const summary: CountSummary = {
      id: count.id,
      store_id: count.store_id,
      store_name: (count.stores as any)?.name ?? '',
      user_name: (count.users as any)?.full_name ?? '',
      user_id: count.user_id,
      finalized_at: count.finalized_at ?? '',
      total: allItems.length,
      matches: allItems.filter(i => i.status === 'match').length,
      mismatches: allItems.filter(i => i.status === 'mismatch').length,
      escalated: allItems.filter(i => i.status === 'escalated').length,
      items: allItems,
    }

    setAuditData(summary)

    // Run diagnosis on mismatched items
    const mismatched = allItems.filter(i => i.status !== 'match' && !i.resolved)
    if (mismatched.length > 0) {
      await runDiagnosis(mismatched, selectedStore)
    }
  }

  async function runDiagnosis(mismatched: CountItem[], storeId: string) {
    const diagMap: Record<string, Diagnosis[]> = {}

    // 1. Swap detection — check pairs
    for (const item of mismatched) {
      const diags: Diagnosis[] = []
      const diff = (item.counted_qty ?? 0) - item.system_qty

      // Find potential swap partner
      const swapCandidate = mismatched.find(other =>
        other.id !== item.id &&
        ((other.counted_qty ?? 0) - other.system_qty) === -diff &&
        diff !== 0
      )
      if (swapCandidate) {
        diags.push({
          type: 'swap',
          label: 'Possibile scambio',
          icon: '🔄',
          detail: `Sospetto scambio con "${swapCandidate.product_name}" (Δ opposto: ${diff > 0 ? '+' : ''}${diff} vs ${-diff > 0 ? '+' : ''}${-diff})`,
        })
      }

      // 2. Check recent sales for qty errors
      const { data: recentSales } = await supabase
        .from('sales')
        .select('id, created_at, sale_items(product_name, qty)')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(200)

      const suspiciousSales = (recentSales ?? []).filter((s: any) =>
        (s.sale_items ?? []).some((si: any) =>
          si.product_name === item.product_name && si.qty > 1
        )
      )
      if (suspiciousSales.length > 0) {
        const sale = suspiciousSales[0] as any
        const saleItem = sale.sale_items.find((si: any) => si.product_name === item.product_name)
        diags.push({
          type: 'qty_error',
          label: 'Possibile errore quantità',
          icon: '📝',
          detail: `Vendita del ${new Date(sale.created_at).toLocaleDateString('it-IT')} con qty ${saleItem.qty} — possibile errore`,
        })
      }

      // 3. Check voided/incorrect sales
      const { data: voidedSales } = await supabase
        .from('sales')
        .select('id, created_at, movement_type, sale_items(product_name, qty)')
        .eq('store_id', storeId)
        .in('movement_type', ['reso', 'incorrect_sale'])
        .order('created_at', { ascending: false })
        .limit(50)

      const voidedForProduct = (voidedSales ?? []).filter((s: any) =>
        (s.sale_items ?? []).some((si: any) => si.product_name === item.product_name)
      )
      if (voidedForProduct.length > 0) {
        diags.push({
          type: 'void_not_restored',
          label: 'Vendita stornata',
          icon: '🗑️',
          detail: `${voidedForProduct.length} vendita/e stornate per questo prodotto — stock potrebbe non essere stato ripristinato`,
        })
      }

      // 4. Check missing restocks (transfers in)
      const { data: transfers } = await supabase
        .from('transfers')
        .select('id, created_at, status, transfer_items(product_name, qty)')
        .eq('to_store_id', storeId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(50)

      const transfersForProduct = (transfers ?? []).filter((t: any) =>
        (t.transfer_items ?? []).some((ti: any) => ti.product_name === item.product_name)
      )
      if (transfersForProduct.length > 0 && diff > 0) {
        diags.push({
          type: 'restock_missing',
          label: 'Ricarica non registrata?',
          icon: '📦',
          detail: `${transfersForProduct.length} trasferimento/i in entrata per questo prodotto — potrebbe non essere stato registrato`,
        })
      }

      if (diags.length === 0) {
        diags.push({
          type: 'unknown',
          label: 'Nessuna causa automatica trovata',
          icon: '❓',
          detail: 'Controlla manualmente i fogli cartacei vs sistema.',
        })
      }

      diagMap[item.id] = diags
    }

    setDiagnoses(diagMap)
  }

  async function resolveItem(itemId: string, type: 'count_accepted' | 'system_kept' | 'manual_correction') {
    if (!auditData) return
    setSavingResolve(true)

    const item = auditData.items.find(i => i.id === itemId)
    if (!item) { setSavingResolve(false); return }

    const updateData: any = {
      resolved: true,
      resolution_type: type,
      resolution_notes: resolveNote || null,
      resolved_at: new Date().toISOString(),
    }

    if (type === 'count_accepted' && item.counted_qty !== null) {
      // Update product stock to counted value
      await supabase.from('products').update({ stock: item.counted_qty }).eq('id', item.product_id)
      updateData.stock_corrected = true
    } else if (type === 'manual_correction' && correctQty) {
      const corrected = parseInt(correctQty)
      if (!isNaN(corrected)) {
        await supabase.from('products').update({ stock: corrected }).eq('id', item.product_id)
        updateData.corrected_qty = corrected
        updateData.stock_corrected = true
      }
    }

    await supabase.from('inventory_count_items').update(updateData).eq('id', itemId)

    setResolvingId(null)
    setResolveNote('')
    setCorrectQty('')
    setSavingResolve(false)
    loadAudit()
  }

  // ═══ CONFIG ═══
  async function saveConfig(storeId: string) {
    setSavingConfig(storeId)
    await supabase.from('stores').update({
      inventory_count_opens_at: configTimes[storeId] || '18:00',
    }).eq('id', storeId)
    setSavingConfig(null)
  }

  async function toggleManualOpen(storeId: string, open: boolean) {
    await supabase.from('stores').update({ inventory_manually_opened: open }).eq('id', storeId)
    setStores(prev => prev.map(s => s.id === storeId ? { ...s, inventory_manually_opened: open } as any : s))
  }

  // ═══ HISTORY ═══
  useEffect(() => {
    if (tab === 'history' && historyStore) loadHistory()
  }, [tab, historyStore, historyDate])

  async function loadHistory() {
    setLoadingHistory(true)
    const dateStart = `${historyDate}T00:00:00`
    const dateEnd = `${historyDate}T23:59:59`

    let query = supabase
      .from('inventory_counts')
      .select('id, store_id, user_id, finalized_at, users(full_name), stores(name)')
      .eq('finalized', true)
      .order('finalized_at', { ascending: false })

    if (historyStore !== 'all') {
      query = query.eq('store_id', historyStore)
    } else {
      query = query.in('store_id', orgStoreIds)
    }

    // If a specific date is selected, filter by date
    if (historyDate) {
      query = query.gte('finalized_at', dateStart).lte('finalized_at', dateEnd)
    }

    const { data: counts } = await query.limit(20)

    const summaries: CountSummary[] = []
    for (const count of (counts ?? [])) {
      const { data: items } = await supabase
        .from('inventory_count_items')
        .select('*')
        .eq('inventory_count_id', count.id)

      const allItems: CountItem[] = (items ?? []).map(i => ({
        id: i.id, product_id: i.product_id, product_name: i.product_name,
        system_qty: i.system_qty, counted_qty: i.counted_qty, status: i.status,
        mismatch_reason: i.mismatch_reason, resolved: i.resolved ?? false,
        resolution_type: i.resolution_type, resolution_notes: i.resolution_notes,
        corrected_qty: i.corrected_qty, stock_corrected: i.stock_corrected ?? false,
      }))

      summaries.push({
        id: count.id, store_id: count.store_id,
        store_name: (count.stores as any)?.name ?? '',
        user_name: (count.users as any)?.full_name ?? '',
        user_id: count.user_id,
        finalized_at: count.finalized_at ?? '',
        total: allItems.length,
        matches: allItems.filter(i => i.status === 'match').length,
        mismatches: allItems.filter(i => i.status === 'mismatch').length,
        escalated: allItems.filter(i => i.status === 'escalated').length,
        items: allItems,
      })
    }

    setHistoryCounts(summaries)
    setLoadingHistory(false)
  }

  // ═══ STATS ═══
  useEffect(() => {
    if (tab === 'stats') loadStats()
  }, [tab])

  async function loadStats() {
    setLoadingStats(true)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()

    const { data: counts } = await supabase
      .from('inventory_counts')
      .select('id, store_id, user_id, finalized_at, users(full_name), stores(name)')
      .eq('finalized', true)
      .gte('finalized_at', thirtyDaysAgo)
      .in('store_id', orgStoreIds)
      .order('finalized_at', { ascending: false })

    const countIds = (counts ?? []).map(c => c.id)
    const { data: allItems } = countIds.length > 0
      ? await supabase.from('inventory_count_items').select('*').in('inventory_count_id', countIds)
      : { data: [] }

    // Per-store accuracy
    const storeAccuracy: Record<string, { total: number; match: number; name: string }> = {}
    for (const count of (counts ?? [])) {
      const sName = (count.stores as any)?.name ?? count.store_id
      if (!storeAccuracy[count.store_id]) storeAccuracy[count.store_id] = { total: 0, match: 0, name: sName }
      const countItems = (allItems ?? []).filter(i => i.inventory_count_id === count.id)
      storeAccuracy[count.store_id].total += countItems.length
      storeAccuracy[count.store_id].match += countItems.filter(i => i.status === 'match').length
    }

    // Per-employee accuracy
    const empAccuracy: Record<string, { total: number; match: number; name: string }> = {}
    for (const count of (counts ?? [])) {
      const eName = (count.users as any)?.full_name ?? '?'
      if (!empAccuracy[count.user_id]) empAccuracy[count.user_id] = { total: 0, match: 0, name: eName }
      const countItems = (allItems ?? []).filter(i => i.inventory_count_id === count.id)
      empAccuracy[count.user_id].total += countItems.length
      empAccuracy[count.user_id].match += countItems.filter(i => i.status === 'match').length
    }

    // Top problematic products
    const productMismatch: Record<string, { name: string; count: number }> = {}
    for (const item of (allItems ?? [])) {
      if (item.status !== 'match') {
        if (!productMismatch[item.product_name]) productMismatch[item.product_name] = { name: item.product_name, count: 0 }
        productMismatch[item.product_name].count++
      }
    }

    // Resolution type distribution
    const resolutionTypes: Record<string, number> = {}
    for (const item of (allItems ?? [])) {
      if (item.resolution_type) {
        resolutionTypes[item.resolution_type] = (resolutionTypes[item.resolution_type] || 0) + 1
      }
    }

    setStatsData({
      totalCounts: (counts ?? []).length,
      totalItems: (allItems ?? []).length,
      totalMatch: (allItems ?? []).filter(i => i.status === 'match').length,
      storeAccuracy: Object.values(storeAccuracy).sort((a, b) => (b.match / (b.total || 1)) - (a.match / (a.total || 1))),
      empAccuracy: Object.values(empAccuracy).sort((a, b) => (b.match / (b.total || 1)) - (a.match / (a.total || 1))),
      topProblematic: Object.values(productMismatch).sort((a, b) => b.count - a.count).slice(0, 10),
      resolutionTypes,
    })
    setLoadingStats(false)
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>Caricamento...</div>

  const accuracy = auditData ? (auditData.total > 0 ? (auditData.matches / auditData.total * 100) : 0) : 0

  const RESOLUTION_LABELS: Record<string, string> = {
    swap: '🔄 Scambio prodotto',
    qty_error: '📝 Errore quantità',
    void_not_restored: '🗑️ Storno non ripristinato',
    starting_point: '📊 Starting point errato',
    restock_missing: '📦 Ricarica mancante',
    manual_correction: '✏️ Correzione manuale',
    count_accepted: '✅ Conteggio accettato',
    system_kept: '🔒 Valore sistema mantenuto',
    unknown: '❓ Non determinato',
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-xl)' }}>
        <div>
          <h2>🔍 Audit Inventario</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>
            Monitora conteggi, risolvi discrepanze, configura orari
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="toggle-group" style={{ marginBottom: 'var(--space-xl)' }}>
        {([
          { key: 'audit', label: '📊 Audit Live' },
          { key: 'config', label: '⚙️ Configurazione' },
          { key: 'history', label: '📅 Storico' },
          { key: 'stats', label: '📈 Statistiche' },
        ] as { key: Tab; label: string }[]).map(t => (
          <button key={t.key} className={`toggle-option ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {/* ═══════════════ TAB: AUDIT LIVE ═══════════════ */}
      {tab === 'audit' && (
        <div>
          {/* Store selector */}
          <div style={{ marginBottom: 'var(--space-lg)' }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {stores.map(s => (
                <button key={s.id} onClick={() => setSelectedStore(s.id)}
                  className={`badge ${selectedStore === s.id ? 'badge-brand' : 'badge-gray'}`}
                  style={{ cursor: 'pointer', border: 'none', padding: '6px 14px', fontSize: 13 }}
                >{s.name}</button>
              ))}
            </div>
          </div>

          {!auditData && (
            <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-tertiary)' }}>
              <span style={{ fontSize: 48, display: 'block', marginBottom: 12 }}>📋</span>
              <h3 style={{ color: 'var(--text-secondary)' }}>Nessun conteggio finalizzato</h3>
              <p style={{ fontSize: 14 }}>Non ci sono ancora conteggi per questo store.</p>
            </div>
          )}

          {auditData && (
            <>
              {/* KPI Header */}
              <div className="card" style={{ marginBottom: 'var(--space-lg)', padding: 'var(--space-lg)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                  <div>
                    <h4 style={{ marginBottom: 4 }}>Ultimo conteggio — {auditData.store_name}</h4>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      👤 {auditData.user_name} · {auditData.finalized_at ? new Date(auditData.finalized_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: accuracy >= 90 ? 'var(--success)' : accuracy >= 70 ? 'var(--warning)' : 'var(--danger)' }}>
                      {accuracy.toFixed(1)}%
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Accuratezza</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-md)' }}>
                  {[
                    { label: 'Contati', value: auditData.total, color: 'var(--text-primary)' },
                    { label: 'Match', value: auditData.matches, color: 'var(--success)' },
                    { label: 'Mismatch', value: auditData.mismatches, color: 'var(--warning)' },
                    { label: 'Escalated', value: auditData.escalated, color: 'var(--danger)' },
                  ].map(k => (
                    <div key={k.label} className="kpi-card" style={{ padding: '10px 14px' }}>
                      <div className="kpi-label">{k.label}</div>
                      <div className="kpi-value" style={{ fontSize: 22, color: k.color }}>{k.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Discrepancies */}
              {auditData.items.filter(i => i.status !== 'match').length > 0 && (
                <div>
                  <h4 style={{ marginBottom: 'var(--space-md)' }}>⚠️ Discrepanze ({auditData.items.filter(i => i.status !== 'match').length})</h4>
                  {auditData.items.filter(i => i.status !== 'match').map(item => {
                    const diff = (item.counted_qty ?? 0) - item.system_qty
                    const itemDiags = diagnoses[item.id] ?? []
                    const isResolving = resolvingId === item.id
                    return (
                      <div key={item.id} className="card" style={{
                        marginBottom: 'var(--space-md)', padding: 'var(--space-lg)',
                        border: item.resolved ? '1px solid var(--border-subtle)' : '1.5px solid var(--warning)',
                        opacity: item.resolved ? 0.7 : 1,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-sm)' }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 15 }}>{item.product_name}</div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                              Sistema: <strong>{item.system_qty}</strong> → Contato: <strong>{item.counted_qty ?? '—'}</strong>
                              <span style={{ fontWeight: 700, color: diff > 0 ? 'var(--success)' : 'var(--danger)', marginLeft: 8 }}>
                                Δ {diff > 0 ? '+' : ''}{diff}
                              </span>
                            </div>
                          </div>
                          {item.resolved ? (
                            <span className="badge badge-success" style={{ fontSize: 11 }}>
                              {RESOLUTION_LABELS[item.resolution_type ?? ''] || '✅ Risolto'}
                            </span>
                          ) : (
                            <span className={`badge ${item.status === 'escalated' ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: 11 }}>
                              {item.status === 'escalated' ? '🔺 Escalated' : '⚠️ Mismatch'}
                            </span>
                          )}
                        </div>

                        {/* Diagnosis */}
                        {!item.resolved && itemDiags.length > 0 && (
                          <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>🔍 Diagnosi automatica:</div>
                            {itemDiags.map((d, idx) => (
                              <div key={idx} style={{ fontSize: 13, padding: '4px 0', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                <span>{d.icon}</span>
                                <div>
                                  <span style={{ fontWeight: 600 }}>{d.label}</span>
                                  <span style={{ color: 'var(--text-secondary)', marginLeft: 6 }}>— {d.detail}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Resolution notes if resolved */}
                        {item.resolved && item.resolution_notes && (
                          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                            📝 {item.resolution_notes}
                          </div>
                        )}

                        {/* Actions */}
                        {!item.resolved && !isResolving && (
                          <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                            <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 14px' }}
                              onClick={() => resolveItem(item.id, 'count_accepted')}>
                              ✅ Accetta Conteggio
                            </button>
                            <button className="btn btn-secondary" style={{ fontSize: 12, padding: '6px 14px' }}
                              onClick={() => resolveItem(item.id, 'system_kept')}>
                              🔒 Mantieni Sistema
                            </button>
                            <button className="btn btn-secondary" style={{ fontSize: 12, padding: '6px 14px' }}
                              onClick={() => setResolvingId(item.id)}>
                              ✏️ Correggi / Note
                            </button>
                          </div>
                        )}

                        {/* Resolve form */}
                        {isResolving && (
                          <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)', marginTop: 'var(--space-sm)' }}>
                            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
                              <div style={{ flex: 1 }}>
                                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Quantità corretta</label>
                                <input type="number" className="input" placeholder="es. 47" value={correctQty} onChange={e => setCorrectQty(e.target.value)} style={{ fontSize: 14 }} />
                              </div>
                            </div>
                            <div style={{ marginBottom: 'var(--space-sm)' }}>
                              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Note</label>
                              <input className="input" placeholder="Motivo della correzione..." value={resolveNote} onChange={e => setResolveNote(e.target.value)} />
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                              <button className="btn btn-primary" style={{ fontSize: 12 }} disabled={savingResolve}
                                onClick={() => resolveItem(item.id, 'manual_correction')}>
                                {savingResolve ? '...' : '💾 Salva Correzione'}
                              </button>
                              <button className="btn btn-secondary" style={{ fontSize: 12 }}
                                onClick={() => { setResolvingId(null); setResolveNote(''); setCorrectQty('') }}>
                                Annulla
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* All match */}
              {auditData.items.filter(i => i.status !== 'match').length === 0 && (
                <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-tertiary)' }}>
                  <span style={{ fontSize: 48 }}>🎉</span>
                  <h3 style={{ color: 'var(--success)', marginTop: 8 }}>Tutto in ordine!</h3>
                  <p style={{ fontSize: 14 }}>Tutti i prodotti corrispondono al conteggio.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══════════════ TAB: CONFIG ═══════════════ */}
      {tab === 'config' && (
        <div>
          <h4 style={{ marginBottom: 'var(--space-lg)' }}>Configurazione conteggio per store</h4>
          {stores.map(store => {
            const isOpen = (store as any).inventory_manually_opened ?? false
            return (
              <div key={store.id} className="card" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-lg)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-md)' }}>
                  <div>
                    <h4 style={{ marginBottom: 4 }}>🏪 {store.name}</h4>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{store.city || store.address || ''}</div>
                  </div>
                  <span className={`badge ${isOpen ? 'badge-success' : 'badge-gray'}`} style={{ fontSize: 12 }}>
                    {isOpen ? '🟢 Aperto' : '🔴 Chiuso'}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div className="input-group" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
                    <label className="input-label">Orario apertura conteggio</label>
                    <input
                      type="time"
                      className="input"
                      value={configTimes[store.id] || '18:00'}
                      onChange={e => setConfigTimes(prev => ({ ...prev, [store.id]: e.target.value }))}
                      style={{ fontSize: 16, fontWeight: 600 }}
                    />
                  </div>
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: 12, padding: '8px 16px' }}
                    disabled={savingConfig === store.id}
                    onClick={() => saveConfig(store.id)}
                  >
                    {savingConfig === store.id ? '...' : '💾 Salva Orario'}
                  </button>

                  <div style={{ height: 36, width: 1, background: 'var(--border-default)' }} />

                  {isOpen ? (
                    <button className="btn btn-secondary" style={{ fontSize: 12, padding: '8px 16px', color: 'var(--danger)' }}
                      onClick={() => toggleManualOpen(store.id, false)}>
                      🔒 Chiudi Inventario
                    </button>
                  ) : (
                    <button className="btn btn-secondary" style={{ fontSize: 12, padding: '8px 16px', color: 'var(--success)' }}
                      onClick={() => toggleManualOpen(store.id, true)}>
                      🔓 Apri Inventario Ora
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ═══════════════ TAB: STORICO ═══════════════ */}
      {tab === 'history' && (
        <div>
          <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="input-group" style={{ minWidth: 200, marginBottom: 0 }}>
              <label className="input-label">Store</label>
              <select className="input" value={historyStore} onChange={e => setHistoryStore(e.target.value)}>
                <option value="all">Tutti gli store</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="input-group" style={{ minWidth: 180, marginBottom: 0 }}>
              <label className="input-label">Data</label>
              <input type="date" className="input" value={historyDate} onChange={e => setHistoryDate(e.target.value)} />
            </div>
          </div>

          {loadingHistory ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-secondary)' }}>Caricamento...</div>
          ) : historyCounts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-tertiary)' }}>
              <span style={{ fontSize: 48, display: 'block', marginBottom: 12 }}>📅</span>
              <h3 style={{ color: 'var(--text-secondary)' }}>Nessun conteggio</h3>
              <p style={{ fontSize: 14 }}>Nessun conteggio trovato per questa data e store.</p>
            </div>
          ) : (
            historyCounts.map(count => {
              const expanded = expandedCount === count.id
              const acc = count.total > 0 ? (count.matches / count.total * 100) : 0
              return (
                <div key={count.id} className="card" style={{ marginBottom: 'var(--space-md)', padding: 0, overflow: 'hidden' }}>
                  <div onClick={() => setExpandedCount(expanded ? null : count.id)}
                    style={{ padding: 'var(--space-lg)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>
                        📋 {count.store_name} — {count.finalized_at ? new Date(count.finalized_at).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                        👤 {count.user_name}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <span className="badge badge-success" style={{ fontSize: 10 }}>✅ {count.matches}</span>
                        {count.mismatches > 0 && <span className="badge badge-warning" style={{ fontSize: 10 }}>⚠️ {count.mismatches}</span>}
                        {count.escalated > 0 && <span className="badge badge-danger" style={{ fontSize: 10 }}>🔺 {count.escalated}</span>}
                      </div>
                      <span style={{ fontWeight: 700, fontSize: 14, color: acc >= 90 ? 'var(--success)' : acc >= 70 ? 'var(--warning)' : 'var(--danger)' }}>
                        {acc.toFixed(0)}%
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{expanded ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {expanded && (
                    <div style={{ borderTop: '1px solid var(--border-subtle)', padding: 'var(--space-md) var(--space-lg)' }}>
                      <div className="table-wrapper">
                        <table>
                          <thead>
                            <tr>
                              <th>Prodotto</th>
                              <th>Sistema</th>
                              <th>Contato</th>
                              <th>Δ</th>
                              <th>Status</th>
                              <th>Risoluzione</th>
                            </tr>
                          </thead>
                          <tbody>
                            {count.items.map(item => {
                              const diff = (item.counted_qty ?? 0) - item.system_qty
                              return (
                                <tr key={item.id} style={{ background: item.status === 'match' ? undefined : '#FEF3C7' }}>
                                  <td style={{ fontWeight: 600, fontSize: 13 }}>{item.product_name}</td>
                                  <td>{item.system_qty}</td>
                                  <td style={{ fontWeight: 600 }}>{item.counted_qty ?? '—'}</td>
                                  <td>
                                    {diff !== 0 && (
                                      <span style={{ fontWeight: 700, color: diff > 0 ? 'var(--success)' : 'var(--danger)' }}>
                                        {diff > 0 ? '+' : ''}{diff}
                                      </span>
                                    )}
                                  </td>
                                  <td>
                                    <span className={`badge ${item.status === 'match' ? 'badge-success' : item.status === 'escalated' ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: 10 }}>
                                      {item.status}
                                    </span>
                                  </td>
                                  <td style={{ fontSize: 12 }}>
                                    {item.resolved ? (
                                      <span style={{ color: 'var(--success)' }}>{RESOLUTION_LABELS[item.resolution_type ?? ''] || '✅'}</span>
                                    ) : item.status !== 'match' ? (
                                      <span style={{ color: 'var(--text-tertiary)' }}>In attesa</span>
                                    ) : '—'}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ═══════════════ TAB: STATISTICHE ═══════════════ */}
      {tab === 'stats' && (
        <div>
          {loadingStats ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-secondary)' }}>Caricamento statistiche...</div>
          ) : !statsData ? null : (
            <>
              {/* Global KPI */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
                {[
                  { label: 'Conteggi (30gg)', value: statsData.totalCounts, color: 'var(--text-primary)' },
                  { label: 'Prodotti Valutati', value: statsData.totalItems, color: 'var(--text-primary)' },
                  { label: 'Match Totali', value: statsData.totalMatch, color: 'var(--success)' },
                  { label: 'Accuratezza Media', value: statsData.totalItems > 0 ? `${(statsData.totalMatch / statsData.totalItems * 100).toFixed(1)}%` : '—', color: 'var(--brand-primary)' },
                ].map(k => (
                  <div key={k.label} className="kpi-card">
                    <div className="kpi-label">{k.label}</div>
                    <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-xl)', marginBottom: 'var(--space-xl)' }}>
                {/* Per-store accuracy */}
                <div className="card">
                  <h4 style={{ marginBottom: 'var(--space-lg)' }}>🏪 Accuratezza per Store</h4>
                  {statsData.storeAccuracy.map((s: any) => {
                    const pct = s.total > 0 ? (s.match / s.total * 100) : 0
                    return (
                      <div key={s.name} style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: pct >= 90 ? 'var(--success)' : pct >= 70 ? 'var(--warning)' : 'var(--danger)' }}>
                            {pct.toFixed(1)}% ({s.match}/{s.total})
                          </span>
                        </div>
                        <div style={{ height: 6, background: 'var(--bg-surface-alt)', borderRadius: 3 }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: pct >= 90 ? 'var(--success)' : pct >= 70 ? 'var(--warning)' : 'var(--danger)', borderRadius: 3, transition: 'width 0.3s' }} />
                        </div>
                      </div>
                    )
                  })}
                  {statsData.storeAccuracy.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Nessun dato</p>}
                </div>

                {/* Per-employee accuracy */}
                <div className="card">
                  <h4 style={{ marginBottom: 'var(--space-lg)' }}>👤 Accuratezza per Dipendente</h4>
                  {statsData.empAccuracy.map((e: any) => {
                    const pct = e.total > 0 ? (e.match / e.total * 100) : 0
                    return (
                      <div key={e.name} style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{e.name}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: pct >= 90 ? 'var(--success)' : pct >= 70 ? 'var(--warning)' : 'var(--danger)' }}>
                            {pct.toFixed(1)}% ({e.match}/{e.total})
                          </span>
                        </div>
                        <div style={{ height: 6, background: 'var(--bg-surface-alt)', borderRadius: 3 }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: pct >= 90 ? 'var(--success)' : pct >= 70 ? 'var(--warning)' : 'var(--danger)', borderRadius: 3, transition: 'width 0.3s' }} />
                        </div>
                      </div>
                    )
                  })}
                  {statsData.empAccuracy.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Nessun dato</p>}
                </div>
              </div>

              {/* Top problematic products */}
              <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
                <h4 style={{ marginBottom: 'var(--space-lg)' }}>🔴 Prodotti più Problematici</h4>
                {statsData.topProblematic.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Nessuna discrepanza registrata 🎉</p>
                ) : (
                  <div className="table-wrapper">
                    <table>
                      <thead><tr><th>Prodotto</th><th>Mismatch</th></tr></thead>
                      <tbody>
                        {statsData.topProblematic.map((p: any) => (
                          <tr key={p.name}>
                            <td style={{ fontWeight: 600 }}>{p.name}</td>
                            <td><span className="badge badge-danger" style={{ fontSize: 11 }}>{p.count} volte</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Resolution distribution */}
              {Object.keys(statsData.resolutionTypes).length > 0 && (
                <div className="card">
                  <h4 style={{ marginBottom: 'var(--space-lg)' }}>📊 Distribuzione Risoluzioni</h4>
                  {Object.entries(statsData.resolutionTypes).sort((a: any, b: any) => b[1] - a[1]).map(([type, count]) => (
                    <div key={type} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ fontSize: 13 }}>{RESOLUTION_LABELS[type] || type}</span>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{count as number}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
