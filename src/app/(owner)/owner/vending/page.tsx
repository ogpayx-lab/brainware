'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmt } from '@/lib/utils'
import type { VendingMachine, VendingStatus } from '@/types/database'

const STATUS_CONFIG: Record<VendingStatus, { label: string; color: string; bg: string }> = {
  online:      { label: 'Online',       color: 'var(--success)',  bg: 'var(--success-light)' },
  offline:     { label: 'Offline',      color: 'var(--danger)',   bg: 'var(--danger-light)' },
  maintenance: { label: 'Manutenzione', color: 'var(--warning)',  bg: '#FFF7ED' },
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
    }
    setLoading(false)
  }

  async function addMachine() {
    if (!storeId || !machineForm.name) return
    setSaving(true)
    await supabase.from('vending_machines').insert({
      store_id: storeId,
      name: machineForm.name,
      location: machineForm.location || null,
      status: 'offline',
      is_active: true,
    })
    setShowAddMachine(false)
    setMachineForm({ name: '', location: '', status: 'offline' })
    setSaving(false)
    loadData()
  }

  async function deleteMachine(m: VendingMachine) {
    if (!confirm(`Eliminare la macchina "${m.name}"${m.location ? ` (${m.location})` : ''}? Questa azione non è reversibile.`)) return
    await supabase.from('vending_machines').delete().eq('id', m.id)
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
      name: machineForm.name,
      location: machineForm.location || null,
      status: machineForm.status,
    }).eq('id', showEditMachine.id)
    setShowEditMachine(null)
    setMachineForm({ name: '', location: '', status: 'offline' })
    setSaving(false)
    loadData()
  }

  function openEdit(m: VendingMachine) {
    setMachineForm({ name: m.name, location: m.location || '', status: m.status })
    setShowEditMachine(m)
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>Caricamento...</div>

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
        <button className="btn btn-primary" onClick={() => setShowAddMachine(true)}>+ Aggiungi Macchina</button>
      </div>

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
              <div key={m.id} className="card">
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
                      onClick={() => updateStatus(m, s)}
                      className={`btn ${m.status === s ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ flex: 1, fontSize: 10, padding: '4px 0' }}
                    >
                      {STATUS_CONFIG[s].label}
                    </button>
                  ))}
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 5 }}>
                  <button onClick={() => openEdit(m)} className="btn btn-secondary" style={{ flex: 1, fontSize: 11, padding: '5px 0' }}>✏️ Modifica</button>
                  <button onClick={() => deleteMachine(m)} className="btn btn-ghost" style={{ fontSize: 11, padding: '5px 8px', color: 'var(--danger)' }} title="Elimina macchina">🗑️ Elimina</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
