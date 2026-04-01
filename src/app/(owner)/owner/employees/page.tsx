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
  const [form, setForm] = useState({ full_name:'', email:'', role:'employee' })
  const [totalClients, setTotalClients] = useState(0)
  const [emailStatus, setEmailStatus] = useState<'idle'|'sent'|'error'>('idle')

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
    if (!storeId || !form.full_name || !form.email) return
    setSaving(true)
    setEmailStatus('idle')
    try {
      const res = await fetch('/api/send-employee-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeName: form.full_name,
          employeeEmail: form.email,
          role: form.role,
          storeId,
        }),
      })
      const json = await res.json()
      if (res.status === 409) {
        setEmailStatus('error') // email già registrata
      } else if (res.ok) {
        setEmailStatus('sent')
      } else {
        setEmailStatus('error')
      }
    } catch {
      setEmailStatus('error')
    }
    setShowForm(false)
    setForm({ full_name:'', email:'', role:'employee' })
    setSaving(false)
    loadData()
  }

  async function toggleActive(emp: any) {
    const newStatus = !emp.is_active
    // Aggiorna DB
    await supabase.from('users').update({ is_active: newStatus }).eq('id', emp.id)
    // Ban/unban reale su Supabase Auth via API admin
    await fetch('/api/admin-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: emp.id, action: newStatus ? 'unban' : 'ban' }),
    })
    loadData()
  }

  async function resendInvite(emp: any) {
    const res = await fetch('/api/send-employee-credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeName: emp.full_name,
        employeeEmail: emp.email,
        role: emp.role,
        storeId,
        resend: true,
      }),
    })
    setEmailStatus(res.ok ? 'sent' : 'error')
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
              <div className="input-group"><label className="input-label">Ruolo</label>
                <select className="input" value={form.role} onChange={e => setForm(f=>({...f,role:e.target.value}))}>
                  <option value="employee">Dipendente</option>
                  <option value="owner">Proprietario</option>
                </select>
              </div>
              <div style={{ background:'#FFFBEB', border:'1px solid #FCD34D', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#92400E' }}>
                📧 Il dipendente riceverà un&apos;email con il link per impostare la propria password.
              </div>
            </div>
            <div style={{ display:'flex', gap:'var(--space-sm)', marginTop:'var(--space-xl)' }}>
              <button className="btn btn-secondary" style={{ flex:1 }} onClick={() => setShowForm(false)}>Annulla</button>
              <button className="btn btn-primary" style={{ flex:2 }} onClick={createEmployee} disabled={saving || !form.full_name || !form.email}>{saving ? 'Invio invito...' : '✉️ Invia Invito'}</button>
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

      {/* Feedback email */}
      {emailStatus === 'sent' && (
        <div style={{ background:'#F0FDF4', border:'1px solid #22C55E', borderRadius:10, padding:'12px 16px', marginBottom:'var(--space-lg)', display:'flex', alignItems:'center', gap:10, fontSize:14, color:'#15803D' }}>
          <span style={{ fontSize:20 }}>✅</span>
          <span><strong>Dipendente invitato!</strong> Email di invito inviata a {form.email || 'il dipendente'}. Dovrà cliccare il link per impostare la password.</span>
          <button onClick={() => setEmailStatus('idle')} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', fontSize:18, color:'#15803D' }}>×</button>
        </div>
      )}
      {emailStatus === 'error' && (
        <div style={{ background:'#FEF2F2', border:'1px solid #EF4444', borderRadius:10, padding:'12px 16px', marginBottom:'var(--space-lg)', display:'flex', alignItems:'center', gap:10, fontSize:14, color:'#B91C1C' }}>
          <span style={{ fontSize:20 }}>⚠️</span>
          <span><strong>Dipendente creato</strong> ma l&apos;email non è stata inviata. Controlla la configurazione RESEND_API_KEY su Vercel.</span>
          <button onClick={() => setEmailStatus('idle')} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', fontSize:18, color:'#B91C1C' }}>×</button>
        </div>
      )}

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
                      <button
                        onClick={() => resendInvite(emp)}
                        className="btn btn-secondary"
                        style={{ padding:'4px 10px', fontSize:12 }}
                        title="Reinvia email di invito"
                      >
                        🔁 Reinvita
                      </button>
                      <button
                        onClick={() => toggleActive(emp)}
                        className={`btn ${emp.is_active ? 'btn-secondary' : 'btn-primary'}`}
                        style={{ padding:'4px 10px', fontSize:12 }}
                      >
                        {emp.is_active ? '🚫 Disabilita' : '✅ Abilita'}
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
