'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmt, formatDate } from '@/lib/utils'

export default function StockApprovalsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [requests, setRequests] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [stores, setStores] = useState<any[]>([])
  const [selectedStore, setSelectedStore] = useState('all')
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editQtys, setEditQtys] = useState<Record<string, number>>({})
  const [processing, setProcessing] = useState(false)

  useEffect(() => { loadData() }, [selectedStore])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('users').select('store_id, role, stores(organization_id)').eq('id', user.id).single()
    if (profile?.role !== 'owner') { router.push('/login'); return }
    const oid = (profile.stores as any)?.organization_id

    const { data: storesData } = await supabase.from('stores').select('id,name').eq('organization_id', oid)
    setStores(storesData ?? [])
    const storeIds = selectedStore === 'all' ? (storesData ?? []).map(s => s.id) : [selectedStore]

    // Pending reviews
    const { data: pending } = await supabase
      .from('stock_requests')
      .select('*, stock_request_items(*), users(full_name), stores(name)')
      .in('store_id', storeIds)
      .eq('status', 'owner_review')
      .order('created_at', { ascending: false })
    setRequests(pending ?? [])

    // History (approved/rejected)
    const { data: hist } = await supabase
      .from('stock_requests')
      .select('*, stock_request_items(*), users(full_name), stores(name)')
      .in('store_id', storeIds)
      .in('status', ['approved', 'rejected'])
      .order('approved_at', { ascending: false })
      .limit(30)
    setHistory(hist ?? [])

    setLoading(false)
  }

  function expandRequest(req: any) {
    if (expandedId === req.id) { setExpandedId(null); return }
    setExpandedId(req.id)
    const qtys: Record<string, number> = {}
    for (const item of (req.stock_request_items || [])) {
      qtys[item.id] = item.qty_requested || 0
    }
    setEditQtys(qtys)
  }

  async function approveRequest(req: any) {
    setProcessing(true)
    const { data: { user } } = await supabase.auth.getUser()

    // Set qty_delivered for each item (triggers stock update via DB trigger)
    for (const item of (req.stock_request_items || [])) {
      const approvedQty = editQtys[item.id] ?? item.qty_requested ?? 0
      await supabase.from('stock_request_items').update({
        qty_delivered: approvedQty,
      }).eq('id', item.id)
    }

    // Update request status
    await supabase.from('stock_requests').update({
      status: 'approved',
      approved_by: user?.id,
      approved_at: new Date().toISOString(),
    }).eq('id', req.id)

    // Notify store
    await supabase.from('notifications').insert({
      store_id: req.store_id,
      type: 'stock_approved',
      title: '✅ Stock approvato',
      message: `La ricarica stock è stata approvata. Lo stock è stato aggiornato.`,
    })

    setExpandedId(null)
    setProcessing(false)
    loadData()
  }

  async function rejectRequest(req: any) {
    setProcessing(true)
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('stock_requests').update({
      status: 'rejected',
      approved_by: user?.id,
      approved_at: new Date().toISOString(),
      notes: (req.notes || '') + ' [RIFIUTATO]',
    }).eq('id', req.id)

    await supabase.from('notifications').insert({
      store_id: req.store_id,
      type: 'stock_rejected',
      title: '❌ Stock rifiutato',
      message: `La ricarica stock è stata rifiutata dall'owner.`,
    })

    setExpandedId(null)
    setProcessing(false)
    loadData()
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>Caricamento...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-xl)' }}>
        <div>
          <h2>📦 Movimenti Stock</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>Approva ricariche e verifica trasferimenti</p>
        </div>
      </div>

      {/* Store tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--space-xl)', flexWrap: 'wrap' }}>
        <button onClick={() => setSelectedStore('all')} className={`badge ${selectedStore === 'all' ? 'badge-brand' : 'badge-gray'}`} style={{ cursor: 'pointer', border: 'none', padding: '6px 14px', fontSize: 13 }}>Tutti</button>
        {stores.map(s => (
          <button key={s.id} onClick={() => setSelectedStore(s.id)} className={`badge ${selectedStore === s.id ? 'badge-brand' : 'badge-gray'}`} style={{ cursor: 'pointer', border: 'none', padding: '6px 14px', fontSize: 13 }}>{s.name}</button>
        ))}
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
        <div className="kpi-card" style={{ border: requests.length > 0 ? '1.5px solid var(--warning)' : undefined }}>
          <div className="kpi-label">⏳ Da approvare</div>
          <div className="kpi-value" style={{ color: requests.length > 0 ? 'var(--warning)' : undefined }}>{requests.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">✅ Approvate</div>
          <div className="kpi-value">{history.filter(h => h.status === 'approved').length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">❌ Rifiutate</div>
          <div className="kpi-value">{history.filter(h => h.status === 'rejected').length}</div>
        </div>
      </div>

      {/* Pending approvals */}
      {requests.length > 0 && (
        <div style={{ marginBottom: 'var(--space-2xl)' }}>
          <h4 style={{ marginBottom: 'var(--space-md)' }}>⏳ In attesa di approvazione</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {requests.map(req => {
              const isExpanded = expandedId === req.id
              const items = req.stock_request_items || []
              const hasTransfer = items.some((i: any) => i.qty_sent != null)
              const hasMismatch = items.some((i: any) => i.qty_sent != null && i.qty_requested !== i.qty_sent)

              return (
                <div key={req.id} className="card" style={{
                  padding: 0, overflow: 'hidden',
                  border: hasMismatch ? '1.5px solid var(--danger)' : hasTransfer ? '1.5px solid var(--warning)' : undefined,
                }}>
                  {/* Header */}
                  <div
                    onClick={() => expandRequest(req)}
                    style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
                  >
                    <span style={{ fontSize: 20 }}>{hasTransfer ? '📦' : '➕'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>
                        {hasTransfer ? 'Conteggio Trasferimento' : 'Ricarica Manuale'}
                        {hasMismatch && <span style={{ color: 'var(--danger)', marginLeft: 8 }}>⚠️ Discrepanza</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {(req.stores as any)?.name} · {req.users?.full_name || 'Dipendente'} · {items.length} prodotti · {new Date(req.created_at).toLocaleString('it-IT')}
                      </div>
                      {req.notes && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{req.notes}</div>}
                    </div>
                    <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>{isExpanded ? '▲' : '▼'}</span>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <div className="table-wrapper" style={{ margin: 0 }}>
                        <table>
                          <thead>
                            <tr>
                              <th>Prodotto</th>
                              {hasTransfer && <th>Inviati</th>}
                              <th>Contati</th>
                              {hasTransfer && <th>Δ</th>}
                              <th>Da approvare</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((item: any) => {
                              const diff = hasTransfer ? ((item.qty_requested || 0) - (item.qty_sent || 0)) : null
                              return (
                                <tr key={item.id}>
                                  <td style={{ fontWeight: 600 }}>{item.product_name}</td>
                                  {hasTransfer && <td>{item.qty_sent}</td>}
                                  <td style={{ fontWeight: 600 }}>{item.qty_requested}</td>
                                  {hasTransfer && (
                                    <td style={{ fontWeight: 700, color: diff === 0 ? 'var(--success)' : 'var(--danger)' }}>
                                      {diff === 0 ? '✅' : `${diff! > 0 ? '+' : ''}${diff}`}
                                    </td>
                                  )}
                                  <td>
                                    <input
                                      type="number" min="0"
                                      value={editQtys[item.id] ?? item.qty_requested ?? 0}
                                      onChange={e => setEditQtys(prev => ({ ...prev, [item.id]: parseInt(e.target.value) || 0 }))}
                                      style={{ width: 70, textAlign: 'center', border: '1.5px solid var(--border-default)', borderRadius: 6, padding: '4px 8px', fontSize: 13, fontWeight: 700 }}
                                    />
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div style={{ display: 'flex', gap: 8, padding: '14px 18px' }}>
                        <button onClick={() => rejectRequest(req)} disabled={processing} className="btn btn-secondary" style={{ flex: 1, color: 'var(--danger)' }}>
                          ❌ Rifiuta
                        </button>
                        <button onClick={() => approveRequest(req)} disabled={processing} className="btn btn-primary" style={{ flex: 2 }}>
                          {processing ? 'Elaborazione...' : '✅ Approva Stock'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {requests.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-xl)' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
          <div>Nessuna richiesta in attesa di approvazione</div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <h4 style={{ marginBottom: 'var(--space-md)' }}>📋 Storico</h4>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Data</th><th>Store</th><th>Tipo</th><th>Prodotti</th><th>Stato</th></tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id}>
                    <td style={{ fontSize: 12 }}>{new Date(h.approved_at || h.created_at).toLocaleString('it-IT')}</td>
                    <td>{(h.stores as any)?.name}</td>
                    <td>
                      {(h.stock_request_items || []).some((i: any) => i.qty_sent != null) ? '📦 Trasferimento' : '➕ Manuale'}
                    </td>
                    <td>{(h.stock_request_items || []).length}</td>
                    <td>
                      <span className={`badge ${h.status === 'approved' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: 11 }}>
                        {h.status === 'approved' ? '✅ Approvata' : '❌ Rifiutata'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
