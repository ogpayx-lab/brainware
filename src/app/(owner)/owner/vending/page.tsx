'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmt, formatDate } from '@/lib/utils'

const MOCK_MACHINES = [
  { id: 'vm-001', name: 'VM-001', location: 'Stazione Centrale', status: 'online' as const, stock_pct: 78, last_restock: '24/03', revenue_day: 342 },
  { id: 'vm-002', name: 'VM-002', location: 'Piazza Duomo', status: 'offline' as const, stock_pct: 23, last_restock: '20/03', revenue_day: 0 },
  { id: 'vm-003', name: 'VM-003', location: 'Via Roma', status: 'maintenance' as const, stock_pct: 45, last_restock: '22/03', revenue_day: 128 },
  { id: 'vm-004', name: 'VM-004', location: 'Aeroporto', status: 'online' as const, stock_pct: 91, last_restock: '25/03', revenue_day: 567 },
]

const MOCK_INVENTORY: Record<string, any[]> = {
  'vm-001': [
    { product: 'CBD Oil 10%', loaded: 20, remaining: 14, sold: 6, needs_restock: false },
    { product: 'Pre-rolled Joint', loaded: 30, remaining: 8, sold: 22, needs_restock: true },
    { product: 'Tisana Canapa', loaded: 15, remaining: 12, sold: 3, needs_restock: false },
    { product: 'CBD Crystals', loaded: 10, remaining: 7, sold: 3, needs_restock: false },
  ],
  'vm-002': [
    { product: 'Grinder Premium', loaded: 12, remaining: 2, sold: 10, needs_restock: true },
    { product: 'CBD Oil 10%', loaded: 15, remaining: 1, sold: 14, needs_restock: true },
    { product: 'Pre-rolled Joint', loaded: 25, remaining: 3, sold: 22, needs_restock: true },
  ],
  'vm-003': [
    { product: 'CBD Oil 10%', loaded: 18, remaining: 9, sold: 9, needs_restock: false },
    { product: 'Tisana Canapa', loaded: 10, remaining: 4, sold: 6, needs_restock: true },
    { product: 'Grinder Premium', loaded: 8, remaining: 5, sold: 3, needs_restock: false },
  ],
  'vm-004': [
    { product: 'CBD Oil 10%', loaded: 25, remaining: 22, sold: 3, needs_restock: false },
    { product: 'Pre-rolled Joint', loaded: 30, remaining: 28, sold: 2, needs_restock: false },
    { product: 'CBD Crystals', loaded: 15, remaining: 14, sold: 1, needs_restock: false },
  ],
}

const MOCK_SALES = [
  { datetime: '26/03 14:32', machine: 'VM-001', product: 'CBD Oil 10%', qty: 1, amount: 29.90 },
  { datetime: '26/03 13:15', machine: 'VM-004', product: 'Pre-rolled Joint', qty: 2, amount: 19.80 },
  { datetime: '26/03 12:48', machine: 'VM-001', product: 'Tisana Canapa', qty: 1, amount: 8.50 },
  { datetime: '26/03 11:20', machine: 'VM-003', product: 'CBD Crystals', qty: 1, amount: 34.00 },
  { datetime: '26/03 10:05', machine: 'VM-004', product: 'Grinder Premium', qty: 1, amount: 15.90 },
]

const STATUS_CONFIG = {
  online:      { label: 'Online',       color: 'var(--success)',  bg: 'var(--success-light)' },
  offline:     { label: 'Offline',      color: 'var(--danger)',   bg: 'var(--danger-light)' },
  maintenance: { label: 'Manutenzione', color: 'var(--warning)',  bg: '#FFF7ED' },
}

export default function VendingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [tab, setTab] = useState<'sales' | 'inventory'>('sales')
  const [showRestock, setShowRestock] = useState<string | null>(null)
  const [showAddProduct, setShowAddProduct] = useState<string | null>(null)
  const [showAddMachine, setShowAddMachine] = useState(false)
  const [restockQty, setRestockQty] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<any[]>([])
  const [newProduct, setNewProduct] = useState({ product_id: '', qty_loaded: '', price: '' })
  const [machineForm, setMachineForm] = useState({ name: '', location: '' })
  const [machines, setMachines] = useState(MOCK_MACHINES)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('users').select('store_id, role').eq('id', user.id).single()
      if (profile?.role !== 'owner') { router.push('/login'); return }
      if (profile.store_id) {
        const { data: prods } = await supabase.from('products').select('id, name, price').eq('store_id', profile.store_id).eq('is_active', true).order('name')
        setProducts(prods ?? [])
      }
      setLoading(false)
    }
    load()
  }, [])

  const totalRevDay = machines.reduce((s, m) => s + m.revenue_day, 0)
  const machine = showRestock ? machines.find(m => m.id === showRestock) : null
  const addProdMachine = showAddProduct ? machines.find(m => m.id === showAddProduct) : null
  const machineInv = showRestock ? (MOCK_INVENTORY[showRestock] ?? []) : []

  function deleteMachine(id: string, name: string, location: string) {
    if (!confirm(`Eliminare la macchina "${name}" (${location})? Questa azione non è reversibile.`)) return
    setMachines(prev => prev.filter(m => m.id !== id))
  }

  function addMachine() {
    if (!machineForm.name || !machineForm.location) return
    const newId = `vm-${Date.now()}`
    setMachines(prev => [...prev, { id: newId, name: machineForm.name, location: machineForm.location, status: 'offline' as const, stock_pct: 0, last_restock: '-', revenue_day: 0 }])
    setShowAddMachine(false)
    setMachineForm({ name: '', location: '' })
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>Caricamento...</div>

  return (
    <div>
      {/* Ricarica Modal */}
      {showRestock && machine && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 560 }}>
            <h3 style={{ marginBottom: 4 }}>Ricarica Macchina</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 'var(--space-lg)' }}>Seleziona prodotti e quantita da caricare</p>
            <div style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: '8px 14px', marginBottom: 'var(--space-lg)', fontSize: 13, fontWeight: 600 }}>
              Macchina: {machine.name}  {machine.location}
            </div>
            <div style={{ marginBottom: 'var(--space-lg)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 120px', gap: 8, marginBottom: 8 }}>
                {['Prodotto', 'Rimasti', 'Da caricare'].map(h => (
                  <div key={h} style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</div>
                ))}
              </div>
              {machineInv.map((item, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 120px', gap: 8, marginBottom: 8, alignItems: 'center', opacity: item.needs_restock ? 1 : 0.65 }}>
                  <span style={{ fontSize: 14, fontWeight: item.needs_restock ? 600 : 400 }}>{item.product}</span>
                  <span style={{ fontSize: 14, color: item.remaining < 5 ? 'var(--danger)' : 'var(--success)', fontWeight: 700 }}>{item.remaining}</span>
                  <input
                    type="number" min="0" className="input"
                    value={restockQty[`${showRestock}-${i}`] ?? (item.needs_restock ? item.loaded - item.remaining : 0)}
                    onChange={e => setRestockQty(r => ({ ...r, [`${showRestock}-${i}`]: e.target.value }))}
                    style={{ height: 36, fontSize: 14 }}
                  />
                </div>
              ))}
            </div>
            <div style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: '10px 14px', marginBottom: 'var(--space-lg)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Totale prodotti da caricare</span>
              <span style={{ fontWeight: 700 }}>
                {machineInv.filter(i => i.needs_restock).reduce((s, i) => s + (i.loaded - i.remaining), 0)} unita
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowRestock(null)}>Annulla</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => setShowRestock(null)}>Conferma Ricarica</button>
            </div>
          </div>
        </div>
      )}

      {/* Aggiungi Prodotto a Macchina Modal */}
      {showAddProduct && addProdMachine && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 460 }}>
            <h3 style={{ marginBottom: 4 }}>Aggiungi Prodotto alla Macchina</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 'var(--space-lg)' }}>{addProdMachine.name}  {addProdMachine.location}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div className="input-group">
                <label className="input-label">Prodotto *</label>
                <select className="input" value={newProduct.product_id} onChange={e => setNewProduct(p => ({ ...p, product_id: e.target.value }))}>
                  <option value="">Seleziona prodotto dal catalogo...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}  {fmt(p.price)}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                <div className="input-group">
                  <label className="input-label">Qta da caricare *</label>
                  <input className="input" type="number" min="1" placeholder="Es. 20" value={newProduct.qty_loaded} onChange={e => setNewProduct(p => ({ ...p, qty_loaded: e.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">Prezzo vendita ()</label>
                  <input className="input" type="number" step="0.01" placeholder="Es. 12.00" value={newProduct.price} onChange={e => setNewProduct(p => ({ ...p, price: e.target.value }))} />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-xl)' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setShowAddProduct(null); setNewProduct({ product_id: '', qty_loaded: '', price: '' }) }}>Annulla</button>
              <button className="btn btn-primary" style={{ flex: 2 }} disabled={!newProduct.product_id || !newProduct.qty_loaded} onClick={() => { setShowAddProduct(null); setNewProduct({ product_id: '', qty_loaded: '', price: '' }) }}>
                Aggiungi alla Macchina
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Aggiungi Macchina Modal */}
      {showAddMachine && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 440 }}>
            <h3 style={{ marginBottom: 'var(--space-xl)' }}>Aggiungi Macchina H24</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div className="input-group">
                <label className="input-label">Nome macchina *</label>
                <input className="input" placeholder="Es. VM-005" value={machineForm.name} onChange={e => setMachineForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="input-group">
                <label className="input-label">Posizione *</label>
                <input className="input" placeholder="Es. Centro Commerciale Nord" value={machineForm.location} onChange={e => setMachineForm(f => ({ ...f, location: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-xl)' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowAddMachine(false)}>Annulla</button>
              <button className="btn btn-primary" style={{ flex: 2 }} disabled={!machineForm.name || !machineForm.location} onClick={addMachine}>
                Aggiungi Macchina
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-xl)' }}>
        <div>
          <h2>Macchine H24</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>{machines.length} macchine attive</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" style={{ fontSize: 12 }}> Export PDF</button>
          <button className="btn btn-secondary" style={{ fontSize: 12 }}> Export Excel</button>
          <button className="btn btn-secondary" onClick={() => { if (machines.length > 0) setShowRestock(machines[0].id) }}>📦 Ricarica Macchina</button>
          <button className="btn btn-primary" onClick={() => setShowAddMachine(true)}>+ Aggiungi Macchina</button>
        </div>
      </div>

      {/* Machine cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
        {machines.map(m => {
          const cfg = STATUS_CONFIG[m.status]
          return (
            <div key={m.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-md)' }}>
                <div>
                  <h4 style={{ marginBottom: 2 }}>{m.name}</h4>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{m.location}</p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>
                  {cfg.label}
                </span>
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Stock</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: m.stock_pct < 30 ? 'var(--danger)' : m.stock_pct < 50 ? 'var(--warning)' : 'var(--success)' }}>{m.stock_pct}%</span>
                </div>
                <div style={{ height: 6, background: 'var(--bg-surface-alt)', borderRadius: 3 }}>
                  <div style={{ height: '100%', width: `${m.stock_pct}%`, background: m.stock_pct < 30 ? 'var(--danger)' : m.stock_pct < 50 ? 'var(--warning)' : 'var(--success)', borderRadius: 3 }} />
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>Ricarica: {m.last_restock}</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>{m.revenue_day > 0 ? fmt(m.revenue_day) : ''}/giorno</div>
              <div style={{ display: 'flex', gap: 5 }}>
                <button onClick={() => setShowAddProduct(m.id)} className="btn btn-primary" style={{ flex: 1, fontSize: 11, padding: '5px 0' }}>+ Prodotto</button>
                <button onClick={() => setShowRestock(m.id)} className="btn btn-secondary" style={{ flex: 1, fontSize: 11, padding: '5px 0' }}>Ricarica</button>
                <button onClick={() => setTab('inventory')} className="btn btn-ghost" style={{ flex: 1, fontSize: 11, padding: '5px 0' }}>Stock</button>
                <button onClick={() => deleteMachine(m.id, m.name, m.location)} className="btn btn-ghost" style={{ fontSize: 11, padding: '5px 8px', color: 'var(--danger)' }} title="Elimina macchina">🗑️</button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Total revenue */}
      <div className="card" style={{ marginBottom: 'var(--space-xl)', background: 'var(--brand-primary-light)', border: '1px solid var(--brand-primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, color: 'var(--brand-primary-dark)' }}>Totale Ricavi H24 Oggi</span>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 24, color: 'var(--brand-primary-dark)' }}>{fmt(totalRevDay)}</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--space-xl)' }}>
        <button onClick={() => setTab('sales')} className={`badge ${tab === 'sales' ? 'badge-brand' : 'badge-gray'}`} style={{ cursor: 'pointer', border: 'none', padding: '7px 18px', fontSize: 13 }}>Vendite Recenti H24</button>
        <button onClick={() => setTab('inventory')} className={`badge ${tab === 'inventory' ? 'badge-brand' : 'badge-gray'}`} style={{ cursor: 'pointer', border: 'none', padding: '7px 18px', fontSize: 13 }}>Inventario per Macchina</button>
      </div>

      {tab === 'sales' && (
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Data/Ora</th><th>Macchina</th><th>Prodotto</th><th>Qta</th><th>Importo</th></tr></thead>
            <tbody>
              {MOCK_SALES.map((s, i) => (
                <tr key={i}>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{s.datetime}</td>
                  <td style={{ fontWeight: 600 }}>{s.machine}</td>
                  <td>{s.product}</td>
                  <td style={{ textAlign: 'center' }}>{s.qty}</td>
                  <td style={{ fontWeight: 700 }}>{fmt(s.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'inventory' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
          {machines.map(m => {
            const inv = MOCK_INVENTORY[m.id] ?? []
            const cfg = STATUS_CONFIG[m.status]
            return (
              <div key={m.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                  <div>
                    <h4>{m.name}  {m.location}</h4>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      Ultima ricarica: {m.last_restock}  Prossima: consigliata presto
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                    <button onClick={() => setShowAddProduct(m.id)} className="btn btn-primary" style={{ fontSize: 12 }}>+ Prodotto</button>
                    <button onClick={() => setShowRestock(m.id)} className="btn btn-secondary" style={{ fontSize: 12 }}>Ricarica</button>
                  </div>
                </div>
                <div className="table-wrapper">
                  <table>
                    <thead><tr><th>Prodotto</th><th>Caricati</th><th>Rimasti</th><th>Venduti</th><th>Ricarica</th></tr></thead>
                    <tbody>
                      {inv.map((item, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>{item.product}</td>
                          <td>{item.loaded}</td>
                          <td style={{ fontWeight: 700, color: item.remaining < 5 ? 'var(--danger)' : item.remaining < item.loaded * 0.3 ? 'var(--warning)' : 'var(--text-primary)' }}>{item.remaining}</td>
                          <td>{item.sold}</td>
                          <td>{item.needs_restock ? <span className="badge badge-warning" style={{ fontSize: 10 }}>Si</span> : <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
