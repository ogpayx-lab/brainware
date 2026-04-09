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
  const [apiError, setApiError] = useState('')
  // PIN
  const [pinSaving, setPinSaving] = useState<string|null>(null)
  const [pinSaved, setPinSaved] = useState<string|null>(null)

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

  async function getAuthHeader() {
    const { data: { session } } = await supabase.auth.getSession()
    return { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' }
  }

  async function createEmployee() {
    if (!storeId || !form.full_name || !form.email) return
    setSaving(true)
    setEmailStatus('idle')
    try {
      const headers = await getAuthHeader()
      const res = await fetch('/api/send-employee-credentials', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          employeeName: form.full_name,
          employeeEmail: form.email,
          role: form.role,
          storeId,
        }),
      })
      const json = await res.json()
      if (res.status === 409) {
        setApiError('Email già registrata: ' + (json.error || ''))
        setEmailStatus('error')
      } else if (res.ok) {
        setEmailStatus('sent')
      } else {
        setApiError(json.error || `Errore ${res.status}`)
        setEmailStatus('error')
      }
    } catch (e: any) {
      setApiError(e.message)
      setEmailStatus('error')
    }
    setShowForm(false)
    setForm({ full_name:'', email:'', role:'employee' })
    setSaving(false)
    loadData()
  }

  async function toggleActive(emp: any) {
    const newStatus = !emp.is_active
    await supabase.from('users').update({ is_active: newStatus }).eq('id', emp.id)
    const headers = await getAuthHeader()
    await fetch('/api/admin-user', {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId: emp.id, action: newStatus ? 'unban' : 'ban' }),
    })
    loadData()
  }

  async function resendInvite(emp: any) {
      const headers = await getAuthHeader()
      const res = await fetch('/api/send-employee-credentials', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          employeeName: emp.full_name,
          employeeEmail: emp.email,
          role: emp.role,
          storeId,
          resend: true,
        }),
      })
      const json = await res.json()
      if (res.ok) {
        setEmailStatus('sent')
      } else {
        setApiError(json.error || `Errore ${res.status}`)
        setEmailStatus('error')
      }
  }

  async function savePin(empId: string, pin: string | null) {
    setPinSaving(empId)
    await supabase.from('users').update({ pin: pin || null }).eq('id', empId)
    setPinSaving(null)
    setPinSaved(empId)
    setTimeout(() => setPinSaved(null), 2000)
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

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'var(--space-xl)', flexWrap:'wrap', gap:12 }}>
        <div>
          <h2>Gestione Dipendenti</h2>
          <p style={{ color:'var(--text-secondary)', fontSize:14, marginTop:4 }}>{employees.length} dipendenti nel negozio</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Nuovo Dipendente</button>
        </div>
      </div>

      {/* Feedback email */}
      {emailStatus === 'sent' && (
        <div style={{ background:'#F0FDF4', border:'1px solid #22C55E', borderRadius:10, padding:'12px 16px', marginBottom:'var(--space-lg)', display:'flex', alignItems:'center', gap:10, fontSize:14, color:'#15803D' }}>
          <span style={{ fontSize:20 }}>✅</span>
          <span><strong>Dipendente invitato!</strong> Email inviata. Dovrà cliccare il link per impostare la password.</span>
          <button onClick={() => setEmailStatus('idle')} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', fontSize:18, color:'#15803D' }}>×</button>
        </div>
      )}
      {emailStatus === 'error' && (
        <div style={{ background:'#FEF2F2', border:'1px solid #EF4444', borderRadius:10, padding:'12px 16px', marginBottom:'var(--space-lg)', display:'flex', alignItems:'center', gap:10, fontSize:14, color:'#B91C1C' }}>
          <span style={{ fontSize:20 }}>⚠️</span>
          <span><strong>Errore:</strong> {apiError || 'Impossibile inviare l\'email di invito.'}</span>
          <button onClick={() => { setEmailStatus('idle'); setApiError('') }} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', fontSize:18, color:'#B91C1C' }}>×</button>
        </div>
      )}

      <div style={{ background:'var(--brand-primary-light)', border:'1px solid var(--brand-primary)', borderRadius:'var(--radius-md)', padding:'var(--space-md)', marginBottom:'var(--space-xl)', display:'flex', alignItems:'center', gap:16 }}>
        <div style={{ fontSize:28, fontWeight:700, fontFamily:'var(--font-heading)', color:'var(--brand-primary-dark)' }}>{totalClients.toLocaleString('it-IT')}</div>
        <div style={{ fontSize:14, color:'var(--brand-primary-dark)' }}>Clienti serviti questo mese</div>
      </div>

      {/* Employee Cards (responsive) */}
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {employees.length === 0 && (
          <div style={{ textAlign:'center', padding:'var(--space-2xl)', color:'var(--text-tertiary)' }}>Nessun dipendente. Aggiungine uno.</div>
        )}
        {employees.map(emp => (
          <div key={emp.id} className="card" style={{
            padding:'16px 20px', display:'flex', alignItems:'center', gap:14,
            flexWrap:'wrap', border: emp.is_active ? '1px solid var(--border-subtle)' : '1px solid var(--border-default)',
            opacity: emp.is_active ? 1 : 0.6,
          }}>
            {/* Avatar */}
            <div style={{
              width:42, height:42, borderRadius:12,
              background: emp.role === 'owner' ? 'var(--brand-primary)' : emp.is_active ? 'var(--accent-blue)' : 'var(--border-default)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:15, fontWeight:700, color:'white', flexShrink:0,
            }}>
              {emp.full_name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2)||'?'}
            </div>

            {/* Name + email */}
            <div style={{ flex:'1 1 150px', minWidth:120 }}>
              <div style={{ fontWeight:700, fontSize:15 }}>{emp.full_name}</div>
              <div style={{ fontSize:12, color:'var(--text-tertiary)' }}>{emp.email || ''}</div>
            </div>

            {/* Role badge */}
            <span className={`badge ${emp.role==='owner'?'badge-brand':'badge-indigo'}`} style={{ fontSize:11 }}>
              {emp.role==='owner'?'Owner':'Employee'}
            </span>

            {/* Status badge */}
            <span className={`badge ${emp.is_active?'badge-success':'badge-gray'}`} style={{ fontSize:11 }}>
              {emp.role==='owner'?'Proprietario':emp.is_active?'Attivo':'Disabilitato'}
            </span>

            {/* PIN input */}
            {emp.role !== 'owner' && (
              <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                <span style={{ fontSize:11, color:'var(--text-tertiary)', fontWeight:600 }}>🔑 PIN</span>
                <input
                  className="input"
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="• • • •"
                  value={emp.pin || ''}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 4)
                    setEmployees(prev => prev.map(em => em.id === emp.id ? { ...em, pin: val || null } : em))
                  }}
                  style={{
                    width:64, textAlign:'center', fontSize:15, fontWeight:700,
                    letterSpacing:4, padding:'5px 6px', borderRadius:8,
                    border: pinSaved === emp.id ? '2px solid var(--success)' : '1.5px solid var(--border-default)',
                  }}
                />
                <button
                  className="btn btn-secondary"
                  disabled={pinSaving === emp.id}
                  onClick={() => savePin(emp.id, emp.pin)}
                  style={{ padding:'5px 10px', fontSize:11, whiteSpace:'nowrap' }}
                >
                  {pinSaving === emp.id ? '...' : pinSaved === emp.id ? '✅' : '💾'}
                </button>
              </div>
            )}

            {/* Actions */}
            {emp.role !== 'owner' && (
              <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                <button
                  onClick={() => resendInvite(emp)}
                  className="btn btn-secondary"
                  style={{ padding:'5px 10px', fontSize:11 }}
                  title="Reinvia email di invito"
                >🔁 Reinvita</button>
                <button
                  onClick={() => toggleActive(emp)}
                  className={`btn ${emp.is_active ? 'btn-secondary' : 'btn-primary'}`}
                  style={{ padding:'5px 10px', fontSize:11 }}
                >
                  {emp.is_active ? '🚫 Disabilita' : '✅ Abilita'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
