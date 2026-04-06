'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmt, categoryLabel } from '@/lib/utils'
import type { VendingMachine, VendingStatus, Product } from '@/types/database'

const STATUS_CONFIG: Record<VendingStatus, { label: string; color: string; bg: string }> = {
  online:      { label: 'Online',       color: 'var(--success)',  bg: 'var(--success-light)' },
  offline:     { label: 'Offline',      color: 'var(--danger)',   bg: 'var(--danger-light)' },
  maintenance: { label: 'Manutenzione', color: 'var(--warning)',  bg: '#FFF7ED' },
}

interface VendingProduct {
  id: string
  vending_machine_id: string
  product_id: string
  qty_loaded: number
  qty_remaining: number
  vending_price: number
  loaded_at: string
  product?: { name: string; category: string; price: number }
}

export default function VendingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [machines, setMachines] = useState<VendingMachine[]>([])
  const [showAddMachine, setShowAddMachine] = useState(false)
  const [showEditMachine, setShowEditMachine] = useState<VendingMachine | null>(null)
  const [machineForm, setMachineForm] = useState({ name: '', location: '', status: 'offline' as VendingStatus })
  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // Ricarica
  const [selectedMachine, setSelectedMachine] = useState<VendingMachine | null>(null)
  const [machineProducts, setMachineProducts] = useState<VendingProduct[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [addForm, setAddForm] = useState({ product_id: '', qty: '', price: '' })
  const [restockQty, setRestockQty] = useState<Record<string, string>>({})
  const [loadingProducts, setLoadingProducts] = useState(false)
  // CyberEtna Sync
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ success?: boolean; message?: string } | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('users').select('store_id, role').eq('id', user.id).single()
    if (profile?.role !== 'owner') { router.push('/login'); return }
    setStoreId(profile.store_id)
    if (profile.store_id) {
      const { data } = await supabase.from('vending_machines').select('*').eq('store_id', profile.store_id).order('name')
      setMachines(data ?? [])
      const { data: prods } = await supabase.from('products').select('*').eq('store_id', profile.store_id).eq('is_active', true).order('name')
      setAllProducts(prods ?? [])
    }
    setLoading(false)
  }

  async function addMachine() {
    if (!storeId || !machineForm.name) return
    setSaving(true)
    await supabase.from('vending_machines').insert({
      store_id: storeId, name: machineForm.name,
      location: machineForm.location || null, status: 'offline', is_active: true,
    })
    setShowAddMachine(false)
    setMachineForm({ name: '', location: '', status: 'offline' })
    setSaving(false)
    loadData()
  }

  async function deleteMachine(m: VendingMachine) {
    if (!confirm(`Eliminare la macchina "${m.name}"${m.location ? ` (${m.location})` : ''}? Questa azione non è reversibile.`)) return
    await supabase.from('vending_machine_products').delete().eq('vending_machine_id', m.id)
    await supabase.from('vending_machines').delete().eq('id', m.id)
    if (selectedMachine?.id === m.id) { setSelectedMachine(null); setMachineProducts([]) }
    loadData()
  }

  async function updateStatus(m: VendingMachine, status: VendingStatus) {
    await supabase.from('vending_machines').update({ status }).eq('id', m.id)
    loadData()
  }

  async function saveEdit() {
    if (!showEditMachine) return
    setSaving(true)
    await supabase.from('vending_machines').update({
      name: machineForm.name, location: machineForm.location || null, status: machineForm.status,
    }).eq('id', showEditMachine.id)
    setShowEditMachine(null)
    setMachineForm({ name: '', location: '', status: 'offline' })
    setSaving(false)
    loadData()
  }

  // ---- CyberEtna Sync ----
  async function syncCyberEtna() {
    if (!storeId || syncing) return
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/vending-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, action: 'all' }),
      })
      const data = await res.json()
      if (data.success) {
        setSyncResult({ success: true, message: `✅ Sincronizzati ${data.synced?.length || 0} dati macchina` })
        loadData()
      } else {
        setSyncResult({ success: false, message: `❌ ${data.error || 'Errore sync'}` })
      }
    } catch (e: any) {
      setSyncResult({ success: false, message: `❌ Errore: ${e.message}` })
    }
    setSyncing(false)
    setTimeout(() => setSyncResult(null), 5000)
  }

  function openEdit(m: VendingMachine) {
    setMachineForm({ name: m.name, location: m.location || '', status: m.status })
    setShowEditMachine(m)
  }

  // ---- Gestione prodotti macchina ----
  async function openMachineDetail(m: VendingMachine) {
    setSelectedMachine(m)
    setLoadingProducts(true)
    const { data } = await supabase
      .from('vending_machine_products')
      .select('*, product:products(name, category, price)')
      .eq('vending_machine_id', m.id)
      .order('loaded_at', { ascending: false })
    setMachineProducts(data ?? [])
    setLoadingProducts(false)
  }

  async function addProductToMachine() {
    if (!selectedMachine || !addForm.product_id || !addForm.qty) return
    setSaving(true)
    const prod = allProducts.find(p => p.id === addForm.product_id)
    const price = parseFloat(addForm.price) || prod?.price || 0
    const qty = parseInt(addForm.qty) || 0

    // Controlla se il prodotto è già nella macchina
    const existing = machineProducts.find(mp => mp.product_id === addForm.product_id)
    if (existing) {
      // Aggiungi alla quantità esistente
      await supabase.from('vending_machine_products').update({
        qty_loaded: existing.qty_loaded + qty,
        qty_remaining: existing.qty_remaining + qty,
        vending_price: price,
        loaded_at: new Date().toISOString(),
      }).eq('id', existing.id)
    } else {
      await supabase.from('vending_machine_products').insert({
        vending_machine_id: selectedMachine.id,
        product_id: addForm.product_id,
        qty_loaded: qty,
        qty_remaining: qty,
        vending_price: price,
        loaded_at: new Date().toISOString(),
      })
    }

    // Aggiorna data ultima ricarica
    await supabase.from('vending_machines').update({ last_restock_at: new Date().toISOString() }).eq('id', selectedMachine.id)

    setShowAddProduct(false)
    setAddForm({ product_id: '', qty: '', price: '' })
    setSaving(false)
    openMachineDetail(selectedMachine)
    loadData()
  }

  async function restockProduct(vp: VendingProduct) {
    const addQty = parseInt(restockQty[vp.id] || '0')
    if (addQty <= 0) return
    await supabase.from('vending_machine_products').update({
      qty_loaded: vp.qty_loaded + addQty,
      qty_remaining: vp.qty_remaining + addQty,
      loaded_at: new Date().toISOString(),
    }).eq('id', vp.id)
    await supabase.from('vending_machines').update({ last_restock_at: new Date().toISOString() }).eq('id', vp.vending_machine_id)
    setRestockQty(prev => ({ ...prev, [vp.id]: '' }))
    if (selectedMachine) openMachineDetail(selectedMachine)
    loadData()
  }

  async function removeProductFromMachine(vp: VendingProduct) {
    if (!confirm(`Rimuovere "${vp.product?.name}" dalla macchina?`)) return
    await supabase.from('vending_machine_products').delete().eq('id', vp.id)
    if (selectedMachine) openMachineDetail(selectedMachine)
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>Caricamento...</div>

  // Se una macchina è selezionata, mostra il dettaglio prodotti
  if (selectedMachine) {
    const cfg = STATUS_CONFIG[selectedMachine.status] || STATUS_CONFIG.offline
    const totalProducts = machineProducts.reduce((s, p) => s + p.qty_remaining, 0)
    const totalLoaded = machineProducts.reduce((s, p) => s + p.qty_loaded, 0)
    const stockPct = totalLoaded > 0 ? Math.round((totalProducts / totalLoaded) * 100) : 0

    return (
      <div>
        {/* Aggiungi prodotto modal */}
        {showAddProduct && (
          <div className="modal-overlay">
            <div className="modal" style={{ maxWidth: 460 }}>
              <h3 style={{ marginBottom: 'var(--space-xl)' }}>📦 Aggiungi Prodotto</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 'var(--space-lg)' }}>
                Macchina: <strong>{selectedMachine.name}</strong>
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                <div className="input-group">
                  <label className="input-label">Prodotto *</label>
                  <select className="input" value={addForm.product_id} onChange={e => {
                    const p = allProducts.find(x => x.id === e.target.value)
                    setAddForm(f => ({ ...f, product_id: e.target.value, price: p?.price?.toString() || '' }))
                  }}>
                    <option value="">Seleziona prodotto...</option>
                    {allProducts.map(p => (
                      <option key={p.id} value={p.id}>{p.name} — {fmt(p.price)}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                  <div className="input-group">
                    <label className="input-label">Quantità *</label>
                    <input className="input" type="number" min="1" placeholder="Es. 20" value={addForm.qty} onChange={e => setAddForm(f => ({ ...f, qty: e.target.value }))} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Prezzo in macchina (€)</label>
                    <input className="input" type="number" step="0.01" placeholder="Es. 12.00" value={addForm.price} onChange={e => setAddForm(f => ({ ...f, price: e.target.value }))} />
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-xl)' }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setShowAddProduct(false); setAddForm({ product_id: '', qty: '', price: '' }) }}>Annulla</button>
                <button className="btn btn-primary" style={{ flex: 2 }} disabled={!addForm.product_id || !addForm.qty || saving} onClick={addProductToMachine}>
                  {saving ? 'Salvataggio...' : '📦 Carica nella Macchina'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header dettaglio */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-xl)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
            <button onClick={() => { setSelectedMachine(null); setMachineProducts([]) }} className="btn btn-ghost" style={{ fontSize: 18, padding: '4px 10px' }}>←</button>
            <div>
              <h2>{selectedMachine.name}</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 2 }}>
                {selectedMachine.location || 'Posizione non specificata'}
                <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
              </p>
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => setShowAddProduct(true)}>+ Aggiungi Prodotto</button>
        </div>

        {/* KPI macchina */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
          <div className="kpi-card">
            <div className="kpi-label">Prodotti Caricati</div>
            <div className="kpi-value">{machineProducts.length}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Unità Rimaste</div>
            <div className="kpi-value" style={{ color: stockPct < 30 ? 'var(--danger)' : stockPct < 60 ? 'var(--warning)' : 'var(--success)' }}>{totalProducts}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Livello Stock</div>
            <div className="kpi-value" style={{ color: stockPct < 30 ? 'var(--danger)' : stockPct < 60 ? 'var(--warning)' : 'var(--success)' }}>{stockPct}%</div>
            <div style={{ height: 6, background: 'var(--bg-surface-alt)', borderRadius: 3, marginTop: 6 }}>
              <div style={{ height: '100%', width: `${stockPct}%`, background: stockPct < 30 ? 'var(--danger)' : stockPct < 60 ? 'var(--warning)' : 'var(--success)', borderRadius: 3, transition: 'width 0.3s' }} />
            </div>
          </div>
        </div>

        {/* Lista prodotti */}
        {loadingProducts ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-secondary)' }}>Caricamento prodotti...</div>
        ) : machineProducts.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-xxl)' }}>
            <div style={{ fontSize: 48, marginBottom: 'var(--space-md)' }}>📦</div>
            <h3 style={{ marginBottom: 8 }}>Nessun prodotto caricato</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 'var(--space-lg)' }}>
              Aggiungi il primo prodotto a questa macchina.
            </p>
            <button className="btn btn-primary" onClick={() => setShowAddProduct(true)}>+ Aggiungi Prodotto</button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Prodotto</th>
                  <th>Prezzo VM</th>
                  <th>Caricati</th>
                  <th>Rimasti</th>
                  <th>Stato</th>
                  <th>Ricarica</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {machineProducts.map(vp => {
                  const pct = vp.qty_loaded > 0 ? Math.round((vp.qty_remaining / vp.qty_loaded) * 100) : 0
                  const needsRestock = vp.qty_remaining <= Math.ceil(vp.qty_loaded * 0.2)
                  return (
                    <tr key={vp.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{vp.product?.name || '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{categoryLabel[vp.product?.category || ''] || vp.product?.category}</div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{fmt(vp.vending_price)}</td>
                      <td>{vp.qty_loaded}</td>
                      <td style={{ fontWeight: 700, color: needsRestock ? 'var(--danger)' : 'var(--text-primary)' }}>{vp.qty_remaining}</td>
                      <td>
                        {needsRestock
                          ? <span className="badge badge-danger" style={{ fontSize: 10 }}>⚠️ Ricarica</span>
                          : <span className="badge badge-success" style={{ fontSize: 10 }}>OK</span>
                        }
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <input
                            type="number" min="1" className="input"
                            placeholder="+N"
                            value={restockQty[vp.id] || ''}
                            onChange={e => setRestockQty(prev => ({ ...prev, [vp.id]: e.target.value }))}
                            style={{ width: 70, height: 32, fontSize: 13 }}
                          />
                          <button onClick={() => restockProduct(vp)} className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 11, height: 32 }} disabled={!restockQty[vp.id] || parseInt(restockQty[vp.id]) <= 0}>
                            +
                          </button>
                        </div>
                      </td>
                      <td>
                        <button onClick={() => removeProductFromMachine(vp)} className="btn btn-ghost" style={{ color: 'var(--danger)', fontSize: 12, padding: '4px 8px' }}>🗑️</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Ultima ricarica */}
        {selectedMachine.last_restock_at && (
          <div style={{ marginTop: 'var(--space-lg)', fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>
            Ultima ricarica: {new Date(selectedMachine.last_restock_at).toLocaleString('it-IT')}
          </div>
        )}
      </div>
    )
  }

  // ---- Vista lista macchine ----
  return (
    <div>
      {/* Aggiungi Macchina Modal */}
      {showAddMachine && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 440 }}>
            <h3 style={{ marginBottom: 'var(--space-xl)' }}>➕ Aggiungi Macchina H24</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div className="input-group">
                <label className="input-label">Nome macchina *</label>
                <input className="input" placeholder="Es. VM-001" value={machineForm.name} onChange={e => setMachineForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="input-group">
                <label className="input-label">Posizione</label>
                <input className="input" placeholder="Es. Stazione Centrale" value={machineForm.location} onChange={e => setMachineForm(f => ({ ...f, location: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-xl)' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setShowAddMachine(false); setMachineForm({ name: '', location: '', status: 'offline' }) }}>Annulla</button>
              <button className="btn btn-primary" style={{ flex: 2 }} disabled={!machineForm.name || saving} onClick={addMachine}>
                {saving ? 'Salvataggio...' : 'Aggiungi Macchina'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modifica Macchina Modal */}
      {showEditMachine && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 440 }}>
            <h3 style={{ marginBottom: 'var(--space-xl)' }}>✏️ Modifica Macchina</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div className="input-group">
                <label className="input-label">Nome macchina *</label>
                <input className="input" value={machineForm.name} onChange={e => setMachineForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="input-group">
                <label className="input-label">Posizione</label>
                <input className="input" value={machineForm.location} onChange={e => setMachineForm(f => ({ ...f, location: e.target.value }))} />
              </div>
              <div className="input-group">
                <label className="input-label">Stato</label>
                <select className="input" value={machineForm.status} onChange={e => setMachineForm(f => ({ ...f, status: e.target.value as VendingStatus }))}>
                  <option value="online">🟢 Online</option>
                  <option value="offline">🔴 Offline</option>
                  <option value="maintenance">🟡 Manutenzione</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-xl)' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setShowEditMachine(null); setMachineForm({ name: '', location: '', status: 'offline' }) }}>Annulla</button>
              <button className="btn btn-primary" style={{ flex: 2 }} disabled={!machineForm.name || saving} onClick={saveEdit}>
                {saving ? 'Salvataggio...' : 'Salva Modifiche'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-xl)' }}>
        <div>
          <h2>🏪 Macchine H24</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>{machines.length} macchine registrate</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={syncCyberEtna} disabled={syncing} style={{ fontSize: 12 }}>
            {syncing ? '🔄 Sincronizzazione...' : '🔗 Sync CyberEtna'}
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddMachine(true)}>+ Aggiungi Macchina</button>
        </div>
      </div>

      {/* Sync result banner */}
      {syncResult && (
        <div style={{
          padding: '10px 16px', borderRadius: 10, marginBottom: 'var(--space-md)',
          background: syncResult.success ? 'var(--success-light)' : 'var(--danger-light)',
          color: syncResult.success ? 'var(--success)' : 'var(--danger)',
          fontSize: 13, fontWeight: 600,
        }}>
          {syncResult.message}
        </div>
      )}

      {/* Empty state */}
      {machines.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-xxl)' }}>
          <div style={{ fontSize: 48, marginBottom: 'var(--space-md)' }}>🏪</div>
          <h3 style={{ marginBottom: 8 }}>Nessuna macchina H24</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 'var(--space-lg)' }}>
            Aggiungi la tua prima macchina per iniziare a monitorarla.
          </p>
          <button className="btn btn-primary" onClick={() => setShowAddMachine(true)}>+ Aggiungi Macchina</button>
        </div>
      )}

      {/* Machine cards */}
      {machines.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
          {machines.map(m => {
            const cfg = STATUS_CONFIG[m.status] || STATUS_CONFIG.offline
            return (
              <div key={m.id} className="card" style={{ cursor: 'pointer' }} onClick={() => openMachineDetail(m)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-md)' }}>
                  <div>
                    <h4 style={{ marginBottom: 2 }}>{m.name}</h4>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{m.location || 'Posizione non specificata'}</p>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>
                    {cfg.label}
                  </span>
                </div>

                {m.last_restock_at && (
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>
                    Ultima ricarica: {new Date(m.last_restock_at).toLocaleDateString('it-IT')}
                  </div>
                )}

                {/* Stato buttons */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                  {(['online', 'offline', 'maintenance'] as VendingStatus[]).map(s => (
                    <button
                      key={s}
                      onClick={(e) => { e.stopPropagation(); updateStatus(m, s) }}
                      className={`btn ${m.status === s ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ flex: 1, fontSize: 10, padding: '4px 0' }}
                    >
                      {STATUS_CONFIG[s].label}
                    </button>
                  ))}
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 5 }}>
                  <button onClick={(e) => { e.stopPropagation(); openMachineDetail(m) }} className="btn btn-primary" style={{ flex: 1, fontSize: 11, padding: '5px 0' }}>📦 Prodotti</button>
                  <button onClick={(e) => { e.stopPropagation(); openEdit(m) }} className="btn btn-secondary" style={{ flex: 1, fontSize: 11, padding: '5px 0' }}>✏️ Modifica</button>
                  <button onClick={(e) => { e.stopPropagation(); deleteMachine(m) }} className="btn btn-ghost" style={{ fontSize: 11, padding: '5px 8px', color: 'var(--danger)' }}>🗑️</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
