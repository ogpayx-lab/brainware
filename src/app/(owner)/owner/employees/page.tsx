'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function EmployeesPage() {
  const router = useRouter()
  const supabase = createClient()
  const [employees, setEmployees] = useState<any[]>([])
  const [storeId, setStoreId] = useState<string|null>(null)
  const [storeName, setStoreName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [totalClients, setTotalClients] = useState(0)
  const [feedback, setFeedback] = useState<{type:'success'|'error';msg:string}|null>(null)

  // Add employee form
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ full_name:'', pin:'' })

  // Store account form
  const [showStoreForm, setShowStoreForm] = useState(false)
  const [storeForm, setStoreForm] = useState({ email:'', password:'' })
  const [storeAccounts, setStoreAccounts] = useState<any[]>([])

  // PIN
  const [pinSaving, setPinSaving] = useState<string|null>(null)
  const [pinSaved, setPinSaved] = useState<string|null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('users').select('store_id,role,stores(name)').eq('id', user.id).single()
    if (profile?.role !== 'owner') { router.push('/login'); return }
    setStoreId(profile.store_id)
    setStoreName((profile.stores as any)?.name || 'Store')

    // Load all users of this store  
    const { data: emps } = await supabase
      .from('users')
      .select('*')
      .eq('store_id', profile.store_id)
      .order('role', { ascending: true })
      .order('full_name')
    
    // Separate referenti (employees without auth) from store accounts
    const allUsers = emps ?? []
    const referenti = allUsers.filter(u => u.role !== 'owner' && !u.full_name?.startsWith('[STORE]'))
    const storeAccs = allUsers.filter(u => u.role === 'employee' && u.email)
    setEmployees(referenti)
    setStoreAccounts(storeAccs)

    const { count } = await supabase.from('sales').select('id', { count: 'exact' }).eq('store_id', profile.store_id).eq('movement_type', 'sale')
    setTotalClients(count ?? 0)
    setLoading(false)
  }

  async function getAuthHeader() {
    const { data: { session } } = await supabase.auth.getSession()
    return { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' }
  }

  // ── Add employee (profile only, no auth) ──
  async function addEmployee() {
    if (!storeId || !form.full_name.trim()) return
    setSaving(true)

    const newId = crypto.randomUUID()
    const { error } = await supabase.from('users').insert({
      id: newId,
      full_name: form.full_name.trim(),
      role: 'employee',
      store_id: storeId,
      pin: form.pin || null,
      is_active: true,
    })

    if (error) {
      setFeedback({ type:'error', msg: 'Errore: ' + error.message })
    } else {
      setFeedback({ type:'success', msg: `✅ ${form.full_name} aggiunto come referente!` })
    }

    setShowForm(false)
    setForm({ full_name:'', pin:'' })
    setSaving(false)
    loadData()
    setTimeout(() => setFeedback(null), 3000)
  }

  // ── Create store account (auth account for tablet) ──
  async function createStoreAccount() {
    if (!storeId || !storeForm.email || !storeForm.password) return
    setSaving(true)

    try {
      const headers = await getAuthHeader()
      const res = await fetch('/api/create-store-account', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: storeForm.email,
          password: storeForm.password,
          storeId,
          storeName,
        }),
      })
      const json = await res.json()
      if (res.ok) {
        setFeedback({ type:'success', msg: `✅ Account store creato! Il tablet può loggarsi con ${storeForm.email}` })
      } else {
        setFeedback({ type:'error', msg: json.error || 'Errore nella creazione' })
      }
    } catch (e: any) {
      setFeedback({ type:'error', msg: e.message })
    }

    setShowStoreForm(false)
    setStoreForm({ email:'', password:'' })
    setSaving(false)
    loadData()
    setTimeout(() => setFeedback(null), 5000)
  }

  // ── Toggle employee active ──
  async function toggleActive(emp: any) {
    await supabase.from('users').update({ is_active: !emp.is_active }).eq('id', emp.id)
    loadData()
  }

  // ── Delete employee profile ──
  async function deleteEmployee(emp: any) {
    if (!confirm(`Eliminare ${emp.full_name}? Questa azione è irreversibile.`)) return
    await supabase.from('users').delete().eq('id', emp.id)
    loadData()
  }

  // ── Save PIN ──
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
      {/* ═══ MODALS ═══ */}

      {/* Add Employee Modal */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 420 }}>
            <h3 style={{ marginBottom: 'var(--space-lg)' }}>👤 Nuovo Referente</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-md)' }}>
              <div className="input-group">
                <label className="input-label">Nome completo *</label>
                <input className="input" placeholder="Mario Rossi" value={form.full_name} onChange={e => setForm(f=>({...f,full_name:e.target.value}))}/>
              </div>
              <div className="input-group">
                <label className="input-label">PIN (4 cifre)</label>
                <input className="input" type="text" inputMode="numeric" maxLength={4} placeholder="1234"
                  value={form.pin} onChange={e => setForm(f=>({...f,pin:e.target.value.replace(/\D/g,'').slice(0,4)}))}
                  style={{ fontSize:20, letterSpacing:8, textAlign:'center', fontWeight:700 }}
                />
              </div>
              <div style={{ background:'#F0FDF4', border:'1px solid #22C55E', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#15803D' }}>
                ℹ️ Il referente NON avrà un account login. Si identificherà con il PIN sul tablet del negozio.
              </div>
            </div>
            <div style={{ display:'flex', gap:'var(--space-sm)', marginTop:'var(--space-xl)' }}>
              <button className="btn btn-secondary" style={{ flex:1 }} onClick={() => setShowForm(false)}>Annulla</button>
              <button className="btn btn-primary" style={{ flex:2 }} onClick={addEmployee} disabled={saving || !form.full_name.trim()}>
                {saving ? 'Salvataggio...' : '✅ Aggiungi Referente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Store Account Modal */}
      {showStoreForm && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 420 }}>
            <h3 style={{ marginBottom: 'var(--space-lg)' }}>🏪 Account Tablet Store</h3>
            <p style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:16 }}>
              Crea le credenziali per il tablet di <strong>{storeName}</strong>. I dipendenti useranno questo account per accedere.
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-md)' }}>
              <div className="input-group">
                <label className="input-label">Email store *</label>
                <input className="input" type="email" placeholder={`${storeName.toLowerCase().replace(/\s/g,'')}@store.com`}
                  value={storeForm.email} onChange={e => setStoreForm(f=>({...f,email:e.target.value}))}/>
              </div>
              <div className="input-group">
                <label className="input-label">Password *</label>
                <input className="input" type="password" placeholder="Almeno 6 caratteri"
                  value={storeForm.password} onChange={e => setStoreForm(f=>({...f,password:e.target.value}))}/>
              </div>
              <div style={{ background:'#FFFBEB', border:'1px solid #FCD34D', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#92400E' }}>
                🔒 Queste credenziali sono per il <strong>tablet del negozio</strong>. Il tablet resterà sempre loggato con questo account.
              </div>
            </div>
            <div style={{ display:'flex', gap:'var(--space-sm)', marginTop:'var(--space-xl)' }}>
              <button className="btn btn-secondary" style={{ flex:1 }} onClick={() => setShowStoreForm(false)}>Annulla</button>
              <button className="btn btn-primary" style={{ flex:2 }} onClick={createStoreAccount}
                disabled={saving || !storeForm.email || storeForm.password.length < 6}>
                {saving ? 'Creazione...' : '🏪 Crea Account Store'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ PAGE HEADER ═══ */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'var(--space-xl)', flexWrap:'wrap', gap:12 }}>
        <div>
          <h2>Gestione Dipendenti</h2>
          <p style={{ color:'var(--text-secondary)', fontSize:14, marginTop:4 }}>{employees.length} referenti nel negozio</p>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button className="btn btn-secondary" onClick={() => setShowStoreForm(true)}>🏪 Account Store</button>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Nuovo Referente</button>
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div style={{
          background: feedback.type === 'success' ? '#F0FDF4' : '#FEF2F2',
          border: `1px solid ${feedback.type === 'success' ? '#22C55E' : '#EF4444'}`,
          borderRadius:10, padding:'12px 16px', marginBottom:'var(--space-lg)',
          display:'flex', alignItems:'center', gap:10, fontSize:14,
          color: feedback.type === 'success' ? '#15803D' : '#B91C1C',
        }}>
          <span>{feedback.msg}</span>
          <button onClick={() => setFeedback(null)} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', fontSize:18, color:'inherit' }}>×</button>
        </div>
      )}

      {/* Stats */}
      <div style={{ background:'var(--brand-primary-light)', border:'1px solid var(--brand-primary)', borderRadius:'var(--radius-md)', padding:'var(--space-md)', marginBottom:'var(--space-xl)', display:'flex', alignItems:'center', gap:16 }}>
        <div style={{ fontSize:28, fontWeight:700, fontFamily:'var(--font-heading)', color:'var(--brand-primary-dark)' }}>{totalClients.toLocaleString('it-IT')}</div>
        <div style={{ fontSize:14, color:'var(--brand-primary-dark)' }}>Vendite totali</div>
      </div>

      {/* Info box */}
      <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'var(--space-md)', marginBottom:'var(--space-lg)', fontSize:13, color:'var(--text-secondary)' }}>
        💡 I referenti sono i dipendenti del negozio. Non hanno un account login — si identificano con il <strong>PIN</strong> sul tablet del negozio per fare check-in e attribuire vendite.
      </div>

      {/* ═══ EMPLOYEE CARDS ═══ */}
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {employees.length === 0 && (
          <div style={{ textAlign:'center', padding:'var(--space-2xl)', color:'var(--text-tertiary)' }}>
            Nessun referente. Aggiungine uno con il pulsante "+ Nuovo Referente".
          </div>
        )}
        {employees.map(emp => (
          <div key={emp.id} className="card" style={{
            padding:'16px 20px', display:'flex', alignItems:'center', gap:14,
            flexWrap:'wrap',
            border: emp.is_active ? '1px solid var(--border-subtle)' : '1px solid var(--border-default)',
            opacity: emp.is_active ? 1 : 0.5,
          }}>
            {/* Avatar */}
            <div style={{
              width:42, height:42, borderRadius:12,
              background: emp.pin ? 'var(--brand-primary)' : 'var(--accent-blue)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:15, fontWeight:700, color:'white', flexShrink:0,
            }}>
              {emp.full_name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2)||'?'}
            </div>

            {/* Name */}
            <div style={{ flex:'1 1 150px', minWidth:120 }}>
              <div style={{ fontWeight:700, fontSize:15 }}>{emp.full_name}</div>
              <div style={{ fontSize:11, color: emp.pin ? 'var(--success)' : 'var(--text-tertiary)' }}>
                {emp.pin ? '🔑 PIN impostato' : '⚠️ Nessun PIN'}
              </div>
            </div>

            {/* Status */}
            <span className={`badge ${emp.is_active?'badge-success':'badge-gray'}`} style={{ fontSize:11 }}>
              {emp.is_active ? 'Attivo' : 'Disabilitato'}
            </span>

            {/* PIN input */}
            <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
              <span style={{ fontSize:11, color:'var(--text-tertiary)', fontWeight:600 }}>🔑</span>
              <input
                className="input"
                type="text"
                inputMode="numeric"
                maxLength={4}
                placeholder="PIN"
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

            {/* Actions */}
            <div style={{ display:'flex', gap:6, flexShrink:0 }}>
              <button
                onClick={() => toggleActive(emp)}
                className={`btn ${emp.is_active ? 'btn-secondary' : 'btn-primary'}`}
                style={{ padding:'5px 10px', fontSize:11 }}
              >
                {emp.is_active ? '🚫' : '✅'}
              </button>
              <button
                onClick={() => deleteEmployee(emp)}
                className="btn btn-secondary"
                style={{ padding:'5px 10px', fontSize:11, color:'var(--danger)' }}
              >🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
