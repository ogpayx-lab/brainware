'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmt, formatDate, categoryLabel } from '@/lib/utils'
import type { ProductCategory } from '@/types/database'
import { useT } from '@/lib/i18n'

const STATUS_COLOR: Record<string, string> = { Critico: 'badge-danger', Warning: 'badge-warning', OK: 'badge-success' }

export default function GeneralWarehousePage() {
  const router = useRouter()
  const supabase = createClient()
  const t = useT()
  const [products, setProducts] = useState<any[]>([])
  const [transfers, setTransfers] = useState<any[]>([])
  const [stores, setStores] = useState<any[]>([])
  const [storeId, setStoreId] = useState<string | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'inventory' | 'transfers'>('inventory')
  const [showNewTransfer, setShowNewTransfer] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tf, setTf] = useState<{ dest_type: string; dest_id: string; items: {product_id: string; qty: string}[] }>({
    dest_type: 'store', dest_id: '', items: [{ product_id: '', qty: '' }]
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('users').select('store_id, role, stores(organization_id)').eq('id', user.id).single()
    if (profile?.role !== 'owner') { router.push('/login'); return }
    setStoreId(profile.store_id)
    const oid = (profile.stores as any)?.organization_id
    setOrgId(oid)

    const { data: storesData } = await supabase.from('stores').select('id,name').eq('organization_id', oid)
    setStores(storesData ?? [])

    const { data: prods } = await supabase.from('products').select('*').eq('store_id', profile.store_id).order('stock', { ascending: true })
    setProducts(prods ?? [])

    const { data: trData } = await supabase
      .from('transfers')
      .select('*, stores!transfers_from_store_id_fkey(name), stores!transfers_to_store_id_fkey(name)')
      .eq('from_store_id', profile.store_id)
      .order('created_at', { ascending: false })
      .limit(20)
    setTransfers(trData ?? [])
    setLoading(false)
  }

  async function submitTransfer() {
    if (!storeId || !tf.dest_id || tf.items.every(i => !i.product_id || !i.qty)) return
    setSaving(true)
    const destStore = tf.dest_type === 'store' ? tf.dest_id : storeId
    const { data: tr } = await supabase.from('transfers').insert({ from_store_id: storeId, to_store_id: destStore, status: 'pending', notes: `Tipo: ${tf.dest_type}` }).select('id').single()
    if (tr) {
      const validItems = tf.items.filter(i => i.product_id && i.qty)
      await supabase.from('transfer_items').insert(validItems.map(i => ({ transfer_id: tr.id, product_id: i.product_id, qty_sent: parseInt(i.qty), qty_received: parseInt(i.qty) })))
    }
    setShowNewTransfer(false)
    setSaving(false)
    setTf({ dest_type: 'store', dest_id: '', items: [{ product_id: '', qty: '' }] })
    loadData()
  }

  const totalSku = products.length
  const totalUnits = products.reduce((s, p) => s + p.stock, 0)
  const lowCount = products.filter(p => p.stock <= p.stock_alert).length
  const criticalCount = products.filter(p => p.stock <= 5).length

  const getStatus = (p: any) => p.stock <= 5 ? 'Critico' : p.stock <= p.stock_alert ? 'Warning' : 'OK'

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>{t('loading')}</div>

  return (
    <div>
      {showNewTransfer && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 560 }}>
            <h3 style={{ marginBottom: 8 }}>Nuovo Trasferimento</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 'var(--space-lg)' }}>Da: Magazzino Generale</p>

            <div className="input-group" style={{ marginBottom: 'var(--space-md)' }}>
              <label className="input-label">Destinazione</label>
              <select className="input" value={tf.dest_type} onChange={e => setTf(t => ({ ...t, dest_type: e.target.value, dest_id: '' }))}>
                <option value="store">Punto Vendita</option>
                <option value="vending">Macchina H24</option>
                <option value="online">Cliente Online</option>
                <option value="offline">Cliente Offline</option>
              </select>
            </div>

            {tf.dest_type === 'store' && (
              <div className="input-group" style={{ marginBottom: 'var(--space-md)' }}>
                <label className="input-label">Punto Vendita</label>
                <select className="input" value={tf.dest_id} onChange={e => setTf(t => ({ ...t, dest_id: e.target.value }))}>
                  <option value="">Seleziona negozio...</option>
                  {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}

            <div style={{ marginBottom: 'var(--space-md)' }}>
              <label className="input-label">Prodotti</label>
              {tf.items.map((item, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 32px', gap: 8, marginBottom: 8 }}>
                  <select className="input" value={item.product_id} onChange={e => setTf(t => ({ ...t, items: t.items.map((it, idx) => idx === i ? { ...it, product_id: e.target.value } : it) }))}>
                    <option value="">Seleziona prodotto...</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} (stock: {p.stock})</option>)}
                  </select>
                  <input className="input" type="number" min="1" placeholder="Qta" value={item.qty} onChange={e => setTf(t => ({ ...t, items: t.items.map((it, idx) => idx === i ? { ...it, qty: e.target.value } : it) }))} />
                  {i > 0 && <button onClick={() => setTf(t => ({ ...t, items: t.items.filter((_, idx) => idx !== i) }))} style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 16, cursor: 'pointer' }}></button>}
                </div>
              ))}
              <button onClick={() => setTf(t => ({ ...t, items: [...t.items, { product_id: '', qty: '' }] }))} style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', fontSize: 13, cursor: 'pointer', padding: 0 }}>+ Aggiungi prodotto</button>
            </div>

            <div style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
               Il trasferimento aggiornera automaticamente l'inventario del magazzino (scarico) e del destinatario (carico)
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowNewTransfer(false)}>{t('cancel')}</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={submitTransfer} disabled={saving}>
                {saving ? 'Invio...' : 'Invia Trasferimento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-xl)' }}>
        <div>
          <h2>{t('wh.central')}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>01 Mar  {new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" style={{ fontSize: 12 }}> Export PDF</button>
          <button className="btn btn-secondary" style={{ fontSize: 12 }}> Export Excel</button>
        </div>
      </div>

      {/* 4 KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
        <div className="kpi-card"><div className="kpi-label">Total SKUs</div><div className="kpi-value">{totalSku}</div></div>
        <div className="kpi-card"><div className="kpi-label">Total Units</div><div className="kpi-value">{totalUnits.toLocaleString('it-IT')}</div></div>
        <div className="kpi-card" style={{ border: lowCount > 0 ? '1.5px solid var(--warning)' : undefined }}>
          <div className="kpi-label">Low Stock Alerts</div>
          <div className="kpi-value" style={{ color: lowCount > 0 ? 'var(--warning)' : undefined }}>{lowCount}</div>
          {criticalCount > 0 && <span className="badge badge-danger" style={{ fontSize: 10, marginTop: 4 }}> {criticalCount} critici</span>}
        </div>
        <div className="kpi-card"><div className="kpi-label">Pending Restocks</div><div className="kpi-value">{criticalCount}</div></div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--space-xl)' }}>
        <button onClick={() => setActiveTab('inventory')} className={`badge ${activeTab === 'inventory' ? 'badge-brand' : 'badge-gray'}`} style={{ cursor: 'pointer', border: 'none', padding: '7px 18px', fontSize: 13 }}>Inventario</button>
        <button onClick={() => setActiveTab('transfers')} className={`badge ${activeTab === 'transfers' ? 'badge-brand' : 'badge-gray'}`} style={{ cursor: 'pointer', border: 'none', padding: '7px 18px', fontSize: 13 }}>Trasferimenti</button>
        {activeTab === 'transfers' && <button onClick={() => setShowNewTransfer(true)} className="btn btn-primary" style={{ marginLeft: 'auto', fontSize: 13 }}>+ Nuovo Trasferimento</button>}
      </div>

      {activeTab === 'inventory' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
            <h4>Inventario Prodotti</h4>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Prodotto</th><th>Categoria</th><th>Qty</th><th>Sett.</th><th>Mens.</th><th>Stato</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-tertiary)' }}>Nessun prodotto in magazzino</td></tr>}
                {products.map(p => {
                  const status = getStatus(p)
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td><span className="badge badge-indigo" style={{ fontSize: 10 }}>{categoryLabel[p.category as ProductCategory]}</span></td>
                      <td style={{ fontWeight: 700, color: status === 'Critico' ? 'var(--danger)' : status === 'Warning' ? 'var(--warning)' : 'var(--text-primary)' }}>{p.stock}</td>
                      <td style={{ color: 'var(--text-secondary)' }}></td>
                      <td style={{ color: 'var(--text-secondary)' }}></td>
                      <td><span className={`badge ${STATUS_COLOR[status]}`}>{status}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Low stock alert section */}
          {lowCount > 0 && (
            <div className="card" style={{ marginTop: 'var(--space-xl)', border: '1.5px solid var(--warning)' }}>
              <h4 style={{ marginBottom: 'var(--space-md)', color: 'var(--warning)' }}> Alert Low Inventory</h4>
              {products.filter(p => p.stock <= p.stock_alert).map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</span>
                  <span style={{ fontSize: 13, color: p.stock <= 5 ? 'var(--danger)' : 'var(--warning)' }}>Stock: {p.stock} / Soglia: {p.stock_alert}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'transfers' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
            <h4>Storico Trasferimenti</h4>
            <span className="badge badge-brand">{transfers.length} trasferimenti</span>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Data</th><th>Destinazione</th><th>Prodotti</th><th>Quantita</th><th>Stato</th><th>Inv. Aggiornato</th></tr>
              </thead>
              <tbody>
                {transfers.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-tertiary)' }}>Nessun trasferimento</td></tr>}
                {transfers.map(t => (
                  <tr key={t.id}>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{formatDate(t.created_at)}</td>
                    <td style={{ fontWeight: 600 }}>{(t as any).stores?.name || 'Destinazione'}</td>
                    <td></td>
                    <td></td>
                    <td>
                      <span className={`badge ${t.status === 'completed' ? 'badge-success' : t.status === 'pending' ? 'badge-warning' : 'badge-gray'}`}>
                        {t.status === 'completed' ? 'Completato' : t.status === 'pending' ? 'In Transito' : t.status === 'cancelled' ? 'Annullato' : t.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Mag. / Dest. +qty</td>
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
