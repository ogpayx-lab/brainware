'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmt, formatDateTime } from '@/lib/utils'
import { useT } from '@/lib/i18n'

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  pending:    { label: 'Da evadere',  badge: 'badge-warning' },
  processing: { label: 'In lavorazione', badge: 'badge-blue' },
  shipped:    { label: 'Spedito',     badge: 'badge-indigo' },
  completed:  { label: 'Completato',  badge: 'badge-success' },
}

export default function EcommercePage() {
  const router = useRouter()
  const supabase = createClient()
  const t = useT()

  const [orders, setOrders] = useState<any[]>([])
  const [storeId, setStoreId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase.from('users').select('store_id, role').eq('id', user.id).single()
    if (profile?.role !== 'owner') { router.push('/login'); return }
    setStoreId(profile.store_id)

    const { data: orderData } = await supabase
      .from('ecommerce_orders')
      .select('*')
      .eq('store_id', profile.store_id)
      .order('created_at', { ascending: false })

    setOrders(orderData ?? [])
    setLoading(false)
  }

  async function updateStatus(orderId: string, status: string) {
    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
    await supabase.from('ecommerce_orders')
      .update({ status, fulfilled_by: user?.id ?? null, updated_at: new Date().toISOString() })
      .eq('id', orderId)
    await loadData()
  }

  const filtered = orders.filter(o => filterStatus === 'all' || o.status === filterStatus)
  const pendingCount = orders.filter(o => o.status === 'pending').length
  const totalRevenue = orders.filter(o => o.status === 'completed').reduce((s, o) => s + o.total, 0)

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>{t('loading')}</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xl)' }}>
        <h2>{t('sidebar.ecommerce')}</h2>
        {pendingCount > 0 && <span className="badge badge-danger" style={{ fontSize: 14, padding: '6px 16px' }}>{pendingCount} da evadere</span>}
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
        <div className="kpi-card"><div className="kpi-label">Ordini Totali</div><div className="kpi-value">{orders.length}</div></div>
        <div className="kpi-card"><div className="kpi-label">Da Evadere</div><div className="kpi-value" style={{ color: pendingCount > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>{pendingCount}</div></div>
        <div className="kpi-card"><div className="kpi-label">Completati</div><div className="kpi-value">{orders.filter(o => o.status === 'completed').length}</div></div>
        <div className="kpi-card"><div className="kpi-label">Revenue E-com</div><div className="kpi-value">{fmt(totalRevenue)}</div></div>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}>
        {['all', 'pending', 'processing', 'shipped', 'completed'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`badge ${filterStatus === s ? 'badge-brand' : 'badge-gray'}`}
            style={{ cursor: 'pointer', border: 'none', padding: '6px 14px' }}
          >
            {s === 'all' ? 'Tutti' : STATUS_CONFIG[s]?.label ?? s}
            {s !== 'all' && <span style={{ marginLeft: 4 }}>({orders.filter(o => o.status === s).length})</span>}
          </button>
        ))}
      </div>

      {/* Orders table */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr><th>Ordine</th><th>Cliente</th><th>Data</th><th>Totale</th><th>Stato</th><th>Azioni</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 'var(--space-xl)' }}>Nessun ordine trovato</td></tr>
            )}
            {filtered.map(order => (
              <tr key={order.id}>
                <td>
                  <div style={{ fontWeight: 700 }}>{order.order_reference}</div>
                  {order.notes && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{order.notes}</div>}
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{order.customer_name ?? ''}</div>
                  {order.customer_email && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{order.customer_email}</div>}
                </td>
                <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{formatDateTime(order.created_at)}</td>
                <td style={{ fontWeight: 700 }}>{fmt(order.total)}</td>
                <td>
                  <span className={`badge ${STATUS_CONFIG[order.status]?.badge ?? 'badge-gray'}`}>
                    {STATUS_CONFIG[order.status]?.label ?? order.status}
                  </span>
                </td>
                <td>
                  <select
                    value={order.status}
                    onChange={e => updateStatus(order.id, e.target.value)}
                    style={{ padding: '4px 8px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', fontSize: 12, background: 'var(--bg-primary)', cursor: 'pointer' }}
                  >
                    <option value="pending">Da evadere</option>
                    <option value="processing">In lavorazione</option>
                    <option value="shipped">Spedito</option>
                    <option value="completed">Completato</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
