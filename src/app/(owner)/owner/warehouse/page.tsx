'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmt, formatDate } from '@/lib/utils'

export default function MultiStorePage() {
  const router = useRouter()
  const supabase = createClient()
  const [stores, setStores] = useState<any[]>([])
  const [storeStats, setStoreStats] = useState<Record<string,any>>({})
  const [allProducts, setAllProducts] = useState<any[]>([])
  const [lowStockAll, setLowStockAll] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [showAddStore, setShowAddStore] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [storeForm, setStoreForm] = useState({ name:'', city:'', address:'' })
  const [transfer, setTransfer] = useState({ src:'', dest:'', product_id:'', qty:'25' })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [orgId, setOrgId] = useState<string|null>(null)
  const [storeId, setStoreId] = useState<string|null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('users').select('store_id,role,stores(organization_id)').eq('id', user.id).single()
    if (profile?.role !== 'owner') { router.push('/login'); return }
    setStoreId(profile.store_id)
    const oid = (profile.stores as any)?.organization_id
    setOrgId(oid)

    const { data: storesData } = await supabase.from('stores').select('*').eq('organization_id', oid)
    setStores(storesData ?? [])

    const stats: Record<string,any> = {}
    for (const s of (storesData ?? [])) {
      const today = new Date().toISOString().split('T')[0]
      const [{ data: revenue }, { data: emps }, { data: low }] = await Promise.all([
        supabase.from('sales').select('total').eq('store_id', s.id).eq('movement_type','sale').gte('created_at', today+'T00:00:00'),
        supabase.from('shifts').select('id').eq('store_id', s.id).eq('status','open'),
        supabase.from('low_stock_products').select('id').eq('store_id', s.id),
      ])
      stats[s.id] = {
        revenue: (revenue ?? []).reduce((sum: number, x: any) => sum + x.total, 0),
        empCount: (emps ?? []).length,
        lowStockCount: (low ?? []).length,
        isOpen: (emps ?? []).length > 0,
      }
    }
    setStoreStats(stats)

    const { data: prods } = await supabase.from('products').select('id,name').eq('store_id', profile.store_id)
    setProducts(prods ?? [])

    let lsAll: any[] = []
    for (const s of (storesData ?? [])) {
      const { data: ls } = await supabase.from('low_stock_products').select('*').eq('store_id', s.id)
      lsAll = [...lsAll, ...(ls ?? []).map((p: any) => ({ ...p, store_name: s.name }))]
    }
    setLowStockAll(lsAll)
    setLoading(false)
  }

  async function addStore() {
    if (!orgId || !storeForm.name) return
    setSaving(true)
    const { data: st } = await supabase.from('stores').insert({ name: storeForm.name, city: storeForm.city || null, address: storeForm.address || null, organization_id: orgId }).select('id').single()
    if (st) {
      await supabase.from('brand_config').insert({ store_id: st.id, brand_name: 'BrainWare', logo_letter: 'B' })
      await supabase.from('store_config').insert({ store_id: st.id })
      await supabase.from('bonus_config').insert({ store_id: st.id })
    }
    setShowAddStore(false)
    setStoreForm({ name: '', city: '', address: '' })
    setSaving(false)
    loadData()
  }

  async function doTransfer() {
    if (!storeId || !transfer.src || !transfer.dest || !transfer.product_id || !transfer.qty) return
    setSaving(true)
    const qty = parseInt(transfer.qty)
    const { data: tr } = await supabase.from('transfers').insert({ from_store_id: transfer.src, to_store_id: transfer.dest, status: 'completed' }).select('id').single()
    if (tr) await supabase.from('transfer_items').insert({ transfer_id: tr.id, product_id: transfer.product_id, qty_sent: qty, qty_received: qty })
    setShowTransfer(false)
    setTransfer({ src: '', dest: '', product_id: '', qty: '25' })
    setSaving(false)
    loadData()
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>Caricamento...</div>

  return (
    <div>
      {showAddStore && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 460 }}>
            <h3 style={{ marginBottom: 'var(--space-xl)' }}>Aggiungi Negozio</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div className="input-group"><label className="input-label">Nome negozio *</label><input className="input" placeholder="Es. BrainWare Napoli" value={storeForm.name} onChange={e => setStoreForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                <div className="input-group"><label className="input-label">Citta</label><input className="input" placeholder="Napoli" value={storeForm.city} onChange={e => setStoreForm(f => ({ ...f, city: e.target.value }))} /></div>
                <div className="input-group"><label className="input-label">Indirizzo</label><input className="input" placeholder="Via Roma 42" value={storeForm.address} onChange={e => setStoreForm(f => ({ ...f, address: e.target.value }))} /></div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-xl)' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowAddStore(false)}>Annulla</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={addStore} disabled={saving || !storeForm.name}>{saving ? 'Creazione...' : 'Aggiungi Negozio'}</button>
            </div>
          </div>
        </div>
      )}

      {showTransfer && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 460 }}>
            <h3 style={{ marginBottom: 'var(--space-xl)' }}>Trasferimento tra Store</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div className="input-group"><label className="input-label">Store Sorgente</label>
                <select className="input" value={transfer.src} onChange={e => setTransfer(t => ({ ...t, src: e.target.value }))}>
                  <option value="">Seleziona...</option>
                  {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="input-group"><label className="input-label">Store Destinazione</label>
                <select className="input" value={transfer.dest} onChange={e => setTransfer(t => ({ ...t, dest: e.target.value }))}>
                  <option value="">Seleziona...</option>
                  {stores.filter(s => s.id !== transfer.src).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="input-group"><label className="input-label">Prodotto</label>
                <select className="input" value={transfer.product_id} onChange={e => setTransfer(t => ({ ...t, product_id: e.target.value }))}>
                  <option value="">Seleziona prodotto...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="input-group"><label className="input-label">Quantita</label><input className="input" type="number" min="1" value={transfer.qty} onChange={e => setTransfer(t => ({ ...t, qty: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-xl)' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowTransfer(false)}>Annulla</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={doTransfer} disabled={saving || !transfer.src || !transfer.dest || !transfer.product_id}>{saving ? 'Trasferimento...' : 'Trasferisci'}</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-xl)' }}>
        <div>
          <h2>Gestione Multi-Store</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>{stores.length} negozi nella tua organizzazione</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" style={{ fontSize: 12 }}>Export PDF</button>
          <button className="btn btn-secondary" style={{ fontSize: 12 }}>Export Excel</button>
          <button className="btn btn-primary" onClick={() => setShowAddStore(true)}>+ Aggiungi Negozio</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 'var(--space-lg)', marginBottom: 'var(--space-xl)' }}>
        {stores.map(s => {
          const st = storeStats[s.id] || {}
          return (
            <div key={s.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-md)' }}>
                <div><h4>{s.name}</h4><p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{s.address || s.city || 'Indirizzo non impostato'}</p></div>
                <span className={`badge ${st.isOpen ? 'badge-success' : 'badge-gray'}`}>{st.isOpen ? 'Aperto' : 'Chiuso'}</span>
              </div>
              {[
                { label: 'Dipendenti attivi', value: st.empCount || 0 },
                { label: 'Incasso oggi', value: st.revenue > 0 ? fmt(st.revenue) : '' },
                { label: 'Inventario', value: st.lowStockCount > 0 ? `${st.lowStockCount} alert` : 'Regolare', danger: st.lowStockCount > 0 },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: (row as any).danger ? 'var(--danger)' : 'var(--text-primary)' }}>{row.value}</span>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
        <h4 style={{ marginBottom: 'var(--space-lg)' }}>Inventario per Negozio</h4>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Negozio</th><th>Scorte basse</th><th>Stato</th></tr></thead>
            <tbody>
              {stores.map(s => {
                const st = storeStats[s.id] || {}
                return (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td>{st.lowStockCount > 0 ? <span className="badge badge-danger">{st.lowStockCount}</span> : <span>0</span>}</td>
                    <td><span className={`badge ${st.isOpen ? 'badge-success' : 'badge-gray'}`}>{st.isOpen ? 'Aperto' : 'Chiuso'}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-xl)', marginBottom: 'var(--space-xl)' }}>
        <div className="card">
          <h4 style={{ marginBottom: 'var(--space-md)' }}>Trasferimento tra Store</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <select className="input" value={transfer.src} onChange={e => setTransfer(t => ({ ...t, src: e.target.value }))}>
              <option value="">Store Sorgente</option>
              {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select className="input" value={transfer.dest} onChange={e => setTransfer(t => ({ ...t, dest: e.target.value }))}>
              <option value="">Store Destinazione</option>
              {stores.filter(s => s.id !== transfer.src).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select className="input" value={transfer.product_id} onChange={e => setTransfer(t => ({ ...t, product_id: e.target.value }))}>
              <option value="">Prodotto</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" type="number" min="1" placeholder="Quantita" value={transfer.qty} onChange={e => setTransfer(t => ({ ...t, qty: e.target.value }))} style={{ flex: 1 }} />
              <button className="btn btn-primary" onClick={doTransfer} disabled={saving || !transfer.src || !transfer.dest || !transfer.product_id}>{saving ? '...' : 'Trasferisci'}</button>
            </div>
          </div>
        </div>

        <div className="card">
          <h4 style={{ marginBottom: 'var(--space-md)' }}>Magazzino Generale</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
            {[
              { label: 'Negozi Totali', value: stores.length.toString() },
              { label: 'Alert Inventario', value: lowStockAll.length.toString() },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-md)' }}>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {lowStockAll.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
            <h4>Alert Inventario</h4>
            <span className="badge badge-danger">{lowStockAll.length} alert attivi</span>
          </div>
          {lowStockAll.map((p, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}  {p.store_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Stock: {p.stock} / Soglia: {p.stock_alert}</div>
              </div>
              <span className={`badge ${p.stock <= 2 ? 'badge-danger' : 'badge-warning'}`}>{p.stock <= 2 ? 'Urgente' : 'Basso'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
