'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'

export default function EmployeesPage() {
  const router = useRouter()
  const supabase = createClient()
  const [employees, setEmployees] = useState<any[]>([])
  const [storeId, setStoreId] = useState<string|null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ full_name:'', email:'', password:'', role:'employee' })
  const [totalClients, setTotalClients] = useState(0)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('users').select('store_id,role').eq('id', user.id).single()
    if (profile?.role !== 'owner') { router.push('/login'); return }
    setStoreId(profile.store_id)
    const { data: emps } = await supabase.from('users').select('*').eq('store_id', profile.store_id).order('full_name')
    setEmployees(emps ?? [])
    const { count } = await supabase.from('sales').select('id', { count: 'exact' }).eq('store_id', profile.store_id).eq('movement_type', 'sale')
    setTotalClients(count ?? 0)
    setLoading(false)
  }

  async function createEmployee() {
    if (!storeId || !form.full_name || !form.email || !form.password) return
    setSaving(true)
    const { data: authData, error } = await supabase.auth.admin ? 
      { data: null, error: new Error('Use signup') } :
      await supabase.auth.signUp({ email: form.email, password: form.password, options: { data: { full_name: form.full_name } } })
    if (!error && (authData as any)?.user) {
      await supabase.from('users').upsert({ id: (authData as any).user.id, full_name: form.full_name, role: form.role, store_id: storeId, is_active: true })
    }
    setShowForm(false)
    setForm({ full_name:'', email:'', password:'', role:'employee' })
    setSaving(false)
    loadData()
  }

  async function toggleActive(emp: any) {
    await supabase.from('users').update({ is_active: !emp.is_active }).eq('id', emp.id)
    loadData()
  }

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>Caricamento...</div>

  return (
    <div>
      {showForm && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 480 }}>
            <h3 style={{ marginBottom: 'var(--space-xl)' }}>Nuovo Dipendente</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-md)' }}>
              <div className="input-group"><label className="input-label">Nome completo *</label><input className="input" placeholder="Mario Rossi" value={form.full_name} onChange={e => setForm(f=>({...f,full_name:e.target.value}))}/></div>
              <div className="input-group"><label className="input-label">Email *</label><input className="input" type="email" placeholder="mario@negozio.it" value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))}/></div>
              <div className="input-group"><label className="input-label">Password *</label><input className="input" type="password" placeholder="Min 8 caratteri" value={form.password} onChange={e => setForm(f=>({...f,password:e.target.value}))}/></div>
              <div className="input-group"><label className="input-label">Ruolo</label>
                <select className="input" value={form.role} onChange={e => setForm(f=>({...f,role:e.target.value}))}>
                  <option value="employee">Dipendente</option>
                  <option value="owner">Proprietario</option>
                </select>
              </div>
            </div>
            <div style={{ display:'flex', gap:'var(--space-sm)', marginTop:'var(--space-xl)' }}>
              <button className="btn btn-secondary" style={{ flex:1 }} onClick={() => setShowForm(false)}>Annulla</button>
              <button className="btn btn-primary" style={{ flex:2 }} onClick={createEmployee} disabled={saving || !form.full_name || !form.email || !form.password}>{saving?'Creazione...':'Crea Dipendente'}</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'var(--space-xl)' }}>
        <div>
          <h2>Gestione Dipendenti</h2>
          <p style={{ color:'var(--text-secondary)', fontSize:14, marginTop:4 }}>{employees.length} dipendenti nel negozio</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-secondary" style={{ fontSize:12 }}>Export PDF</button>
          <button className="btn btn-secondary" style={{ fontSize:12 }}>Export Excel</button>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Nuovo Dipendente</button>
        </div>
      </div>

      <div style={{ background:'var(--brand-primary-light)', border:'1px solid var(--brand-primary)', borderRadius:'var(--radius-md)', padding:'var(--space-md)', marginBottom:'var(--space-xl)', display:'flex', alignItems:'center', gap:16 }}>
        <div style={{ fontSize:28, fontWeight:700, fontFamily:'var(--font-heading)', color:'var(--brand-primary-dark)' }}>{totalClients.toLocaleString('it-IT')}</div>
        <div style={{ fontSize:14, color:'var(--brand-primary-dark)' }}>Clienti serviti questo mese</div>
      </div>

      <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'var(--space-md)', marginBottom:'var(--space-xl)', fontSize:13, color:'var(--text-secondary)' }}>
        Solo il proprietario puo abilitare o disabilitare i dipendenti
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Email</th>
              <th>Ruolo</th>
              <th>Clienti Serviti</th>
              <th>Stato</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign:'center', padding:'var(--space-2xl)', color:'var(--text-tertiary)' }}>Nessun dipendente. Aggiungine uno.</td></tr>
            )}
            {employees.map(emp => (
              <tr key={emp.id}>
                <td>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--brand-primary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'white', flexShrink:0 }}>
                      {emp.full_name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2)||'?'}
                    </div>
                    <span style={{ fontWeight:600 }}>{emp.full_name}</span>
                  </div>
                </td>
                <td style={{ color:'var(--text-secondary)', fontSize:13 }}>{emp.email || ''}</td>
                <td><span className={`badge ${emp.role==='owner'?'badge-brand':'badge-indigo'}`} style={{ fontSize:11 }}>{emp.role==='owner'?'Owner':'Employee'}</span></td>
                <td style={{ fontWeight:600 }}></td>
                <td>
                  <span className={`badge ${emp.is_active?'badge-success':'badge-gray'}`}>
                    {emp.role==='owner'?'Proprietario':emp.is_active?'Attivo':'Disabilitato'}
                  </span>
                </td>
                <td>
                  {emp.role !== 'owner' && (
                    <div style={{ display:'flex', gap:6 }}>
                      <button onClick={() => toggleActive(emp)} className={`btn ${emp.is_active?'btn-secondary':'btn-primary'}`} style={{ padding:'4px 10px', fontSize:12 }}>
                        {emp.is_active?'Disabilita':'Abilita'}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
