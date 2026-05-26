'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/lib/i18n'

export default function EmployeesPage() {
  const router = useRouter()
  const supabase = createClient()
  const t = useT()
  const [employees, setEmployees] = useState<any[]>([])
  const [allStores, setAllStores] = useState<any[]>([])
  const [selectedStoreId, setSelectedStoreId] = useState<string>('all')
  const [orgId, setOrgId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [totalSales, setTotalSales] = useState(0)
  const [feedback, setFeedback] = useState<{type:'success'|'error';msg:string}|null>(null)

  // Add employee form
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ full_name:'', pin:'' })
  const [formStoreIds, setFormStoreIds] = useState<string[]>([])

  // Store account form
  const [showStoreForm, setShowStoreForm] = useState(false)
  const [storeForm, setStoreForm] = useState({ email:'', password:'', storeId:'' })

  // PIN
  const [pinSaving, setPinSaving] = useState<string|null>(null)
  const [pinSaved, setPinSaved] = useState<string|null>(null)

  // Edit name
  const [editingId, setEditingId] = useState<string|null>(null)
  const [editName, setEditName] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('users').select('store_id,role,stores(name,organization_id)').eq('id', user.id).single()
    if (profile?.role !== 'owner') { router.push('/login'); return }

    const oid = (profile.stores as any)?.organization_id
    setOrgId(oid)

    // Load all stores in org
    const { data: storesData } = await supabase.from('stores').select('id, name').eq('organization_id', oid).order('name')
    setAllStores(storesData ?? [])

    // Load ALL employees across all org stores
    const storeIds = (storesData ?? []).map(s => s.id)
    const { data: emps } = await supabase
      .from('users')
      .select('*, stores(name)')
      .in('store_id', storeIds)
      .eq('is_active', true)
      .order('full_name')

    const allUsers = emps ?? []
    const referenti = allUsers.filter(u => u.role !== 'owner' && !u.full_name?.startsWith('[STORE]'))
    setEmployees(referenti)

    // Sales count for selected/all stores
    let salesQuery = supabase.from('sales').select('id', { count: 'exact', head: true }).eq('movement_type', 'sale')
    if (selectedStoreId !== 'all') salesQuery = salesQuery.eq('store_id', selectedStoreId)
    else salesQuery = salesQuery.in('store_id', storeIds)
    const { count } = await salesQuery
    setTotalSales(count ?? 0)

    setLoading(false)
  }

  // Reload when store filter changes
  useEffect(() => {
    if (!loading) loadData()
  }, [selectedStoreId])

  async function getAuthHeader() {
    const { data: { session } } = await supabase.auth.getSession()
    return { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' }
  }

  // ── Add employee to one or multiple stores ──
  async function addEmployee() {
    if (formStoreIds.length === 0 || !form.full_name.trim()) return
    setSaving(true)

    let errors: string[] = []
    for (const sid of formStoreIds) {
      const newId = crypto.randomUUID()
      const { error } = await supabase.from('users').insert({
        id: newId,
        full_name: form.full_name.trim(),
        role: 'employee',
        store_id: sid,
        pin: form.pin || null,
        is_active: true,
      })
      if (error) errors.push(error.message)
    }

    if (errors.length > 0) {
      setFeedback({ type: 'error', msg: 'Errori: ' + errors.join(', ') })
    } else {
      const storeNames = allStores.filter(s => formStoreIds.includes(s.id)).map(s => s.name).join(', ')
      setFeedback({ type: 'success', msg: `✅ ${form.full_name} aggiunto a: ${storeNames}` })
    }

    setShowForm(false)
    setForm({ full_name: '', pin: '' })
    setFormStoreIds([])
    setSaving(false)
    loadData()
    setTimeout(() => setFeedback(null), 4000)
  }

  // ── Create store account (auth account for tablet) ──
  async function createStoreAccount() {
    if (!storeForm.storeId || !storeForm.email || !storeForm.password) return
    setSaving(true)
    try {
      const headers = await getAuthHeader()
      const storeName = allStores.find(s => s.id === storeForm.storeId)?.name || 'Store'
      const res = await fetch('/api/create-store-account', {
        method: 'POST', headers,
        body: JSON.stringify({ email: storeForm.email, password: storeForm.password, storeId: storeForm.storeId, storeName }),
      })
      const json = await res.json()
      if (res.ok) {
        setFeedback({ type: 'success', msg: `✅ Account creato! Il tablet può loggarsi con ${storeForm.email}` })
      } else {
        setFeedback({ type: 'error', msg: json.error || 'Errore' })
      }
    } catch (e: any) { setFeedback({ type: 'error', msg: e.message }) }
    setShowStoreForm(false)
    setStoreForm({ email: '', password: '', storeId: '' })
    setSaving(false)
    loadData()
    setTimeout(() => setFeedback(null), 5000)
  }

  async function toggleActive(emp: any) {
    await supabase.from('users').update({ is_active: !emp.is_active }).eq('id', emp.id)
    loadData()
  }

  async function deleteEmployee(emp: any) {
    if (!confirm(`Eliminare ${emp.full_name}? Questa azione è irreversibile.`)) return
    await removeEmployee(emp)
  }

  async function removeEmployee(emp: any) {
    const { error } = await supabase.from('users').delete().eq('id', emp.id)
    if (error) {
      // FK constraint — fallback to soft delete
      const { error: deactErr } = await supabase.from('users').update({ is_active: false }).eq('id', emp.id)
      if (deactErr) {
        alert(`❌ Impossibile eliminare: ${deactErr.message}`)
      } else {
        setFeedback({ type: 'success', msg: `⚠️ ${emp.full_name} disattivato (ha vendite/turni collegati)` })
        setTimeout(() => setFeedback(null), 5000)
      }
    } else {
      setFeedback({ type: 'success', msg: `🗑️ ${emp.full_name} eliminato` })
      setTimeout(() => setFeedback(null), 3000)
    }
    loadData()
  }

  async function saveEmployeeName(empId: string) {
    if (!editName.trim()) return
    const { error } = await supabase.from('users').update({ full_name: editName.trim() }).eq('id', empId)
    if (error) {
      alert(`❌ Errore: ${error.message}`)
    } else {
      setFeedback({ type: 'success', msg: `✅ Nome aggiornato` })
      setTimeout(() => setFeedback(null), 3000)
    }
    setEditingId(null)
    loadData()
  }

  async function savePin(empId: string, pin: string | null) {
    setPinSaving(empId)
    await supabase.from('users').update({ pin: pin || null }).eq('id', empId)
    setPinSaving(null)
    setPinSaved(empId)
    setTimeout(() => setPinSaved(null), 2000)
  }

  // Toggle store in multi-select
  function toggleFormStore(sid: string) {
    setFormStoreIds(prev => prev.includes(sid) ? prev.filter(id => id !== sid) : [...prev, sid])
  }

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>{t('loading')}</div>

  // Filter employees by selected store
  const filtered = selectedStoreId === 'all' ? employees : employees.filter(e => e.store_id === selectedStoreId)

  // Group by name when viewing all stores
  type GroupedEmp = { name: string; entries: typeof employees; storeNames: string[]; pin: string | null; primaryId: string }
  let displayed: GroupedEmp[] = []
  if (selectedStoreId === 'all') {
    const map = new Map<string, typeof employees>()
    for (const e of filtered) {
      const existing = map.get(e.full_name) || []
      existing.push(e)
      map.set(e.full_name, existing)
    }
    displayed = Array.from(map.entries()).map(([name, entries]) => ({
      name, entries,
      storeNames: entries.map(e => (e.stores as any)?.name?.replace('MamaMary ', '') || '').filter(Boolean),
      pin: entries[0]?.pin,
      primaryId: entries[0]?.id,
    }))
  } else {
    displayed = filtered.map(e => ({
      name: e.full_name,
      entries: [e],
      storeNames: [(e.stores as any)?.name?.replace('MamaMary ', '') || ''],
      pin: e.pin,
      primaryId: e.id,
    }))
  }

  return (
    <div>
      {/* ═══ MODALS ═══ */}

      {/* Add Employee Modal */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 480 }}>
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

              {/* Multi-store selector */}
              <div className="input-group">
                <label className="input-label">Assegna a negozi *</label>
                <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:200, overflowY:'auto' }}>
                  {allStores.map(s => {
                    const selected = formStoreIds.includes(s.id)
                    return (
                      <div
                        key={s.id}
                        onClick={() => toggleFormStore(s.id)}
                        style={{
                          display:'flex', alignItems:'center', gap:10,
                          padding:'10px 14px', borderRadius:10,
                          background: selected ? 'var(--brand-primary-light)' : 'var(--bg-surface)',
                          border: selected ? '2px solid var(--brand-primary)' : '1.5px solid var(--border-subtle)',
                          cursor:'pointer', transition:'all 0.15s',
                        }}
                      >
                        <div style={{
                          width:20, height:20, borderRadius:6, flexShrink:0,
                          border: selected ? 'none' : '2px solid var(--border-default)',
                          background: selected ? 'var(--brand-primary)' : 'transparent',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          color:'white', fontSize:12, fontWeight:700,
                        }}>
                          {selected && '✓'}
                        </div>
                        <span style={{ fontSize:14, fontWeight: selected ? 600 : 400, color: selected ? 'var(--brand-primary-dark)' : 'var(--text-primary)' }}>
                          {s.name}
                        </span>
                      </div>
                    )
                  })}
                </div>
                {formStoreIds.length > 1 && (
                  <div style={{ fontSize:11, color:'var(--text-tertiary)', marginTop:4 }}>
                    ℹ️ Verrà creato un profilo per ogni negozio selezionato ({formStoreIds.length} negozi)
                  </div>
                )}
              </div>

              <div style={{ background:'#F0FDF4', border:'1px solid #22C55E', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#15803D' }}>
                ℹ️ Il referente NON avrà un account login. Si identificherà con il PIN sul tablet del negozio.
              </div>
            </div>
            <div style={{ display:'flex', gap:'var(--space-sm)', marginTop:'var(--space-xl)' }}>
              <button className="btn btn-secondary" style={{ flex:1 }} onClick={() => { setShowForm(false); setFormStoreIds([]) }}>{t('cancel')}</button>
              <button className="btn btn-primary" style={{ flex:2 }} onClick={addEmployee} disabled={saving || !form.full_name.trim() || formStoreIds.length === 0}>
                {saving ? t('saving') : `✅ Aggiungi${formStoreIds.length > 1 ? ` (${formStoreIds.length} negozi)` : ''}`}
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
            <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-md)' }}>
              <div className="input-group">
                <label className="input-label">Negozio *</label>
                <select className="input" value={storeForm.storeId} onChange={e => setStoreForm(f=>({...f,storeId:e.target.value}))}>
                  <option value="">— Seleziona negozio —</option>
                  {allStores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Email store *</label>
                <input className="input" type="email" placeholder="negozio@azienda.com"
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
              <button className="btn btn-secondary" style={{ flex:1 }} onClick={() => setShowStoreForm(false)}>{t('cancel')}</button>
              <button className="btn btn-primary" style={{ flex:2 }} onClick={createStoreAccount}
                disabled={saving || !storeForm.email || !storeForm.storeId || storeForm.password.length < 6}>
                {saving ? 'Creazione...' : '🏪 Crea Account Store'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ PAGE HEADER ═══ */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'var(--space-lg)', flexWrap:'wrap', gap:12 }}>
        <div>
          <h2>{t('emp.title')}</h2>
          <p style={{ color:'var(--text-secondary)', fontSize:14, marginTop:4 }}>{displayed.length} referenti{selectedStoreId !== 'all' ? ` in ${allStores.find(s => s.id === selectedStoreId)?.name}` : ' totali'}</p>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button className="btn btn-secondary" onClick={() => setShowStoreForm(true)}>🏪 Account Store</button>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Nuovo Referente</button>
        </div>
      </div>

      {/* Store Filter */}
      <div style={{ display:'flex', gap:6, marginBottom:'var(--space-lg)', flexWrap:'wrap' }}>
        <button
          onClick={() => setSelectedStoreId('all')}
          style={{
            padding:'6px 14px', borderRadius:20, border:'none', cursor:'pointer', fontSize:12, fontWeight:600,
            background: selectedStoreId === 'all' ? 'var(--brand-primary)' : 'var(--bg-surface)',
            color: selectedStoreId === 'all' ? 'white' : 'var(--text-secondary)',
            transition:'all 0.15s',
          }}
        >
          🏢 Tutti ({employees.length})
        </button>
        {allStores.map(s => {
          const count = employees.filter(e => e.store_id === s.id).length
          return (
            <button
              key={s.id}
              onClick={() => setSelectedStoreId(s.id)}
              style={{
                padding:'6px 14px', borderRadius:20, border:'none', cursor:'pointer', fontSize:12, fontWeight:600,
                background: selectedStoreId === s.id ? 'var(--brand-primary)' : 'var(--bg-surface)',
                color: selectedStoreId === s.id ? 'white' : 'var(--text-secondary)',
                transition:'all 0.15s',
              }}
            >
              {s.name.replace('MamaMary ', '')} ({count})
            </button>
          )
        })}
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
        <div style={{ fontSize:28, fontWeight:700, fontFamily:'var(--font-heading)', color:'var(--brand-primary-dark)' }}>{totalSales.toLocaleString('it-IT')}</div>
        <div style={{ fontSize:14, color:'var(--brand-primary-dark)' }}>Vendite totali</div>
      </div>

      {/* Info box */}
      <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'var(--space-md)', marginBottom:'var(--space-lg)', fontSize:13, color:'var(--text-secondary)' }}>
        💡 I referenti sono i dipendenti del negozio. Non hanno un account login — si identificano con il <strong>PIN</strong> sul tablet del negozio per fare check-in e attribuire vendite.
      </div>

      {/* ═══ EMPLOYEE CARDS ═══ */}
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {displayed.length === 0 && (
          <div style={{ textAlign:'center', padding:'var(--space-2xl)', color:'var(--text-tertiary)' }}>
            Nessun referente{selectedStoreId !== 'all' ? ' in questo negozio' : ''}. Aggiungine uno con il pulsante &quot;+ Nuovo Referente&quot;.
          </div>
        )}
        {displayed.map(group => (
          <div key={group.primaryId} className="card" style={{
            padding:'16px 20px', display:'flex', alignItems:'center', gap:14,
            flexWrap:'wrap',
            border: '1px solid var(--border-subtle)',
          }}>
            {/* Avatar */}
            <div style={{
              width:42, height:42, borderRadius:12,
              background: group.pin ? 'var(--brand-primary)' : 'var(--accent-blue)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:15, fontWeight:700, color:'white', flexShrink:0,
            }}>
              {group.name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2)||'?'}
            </div>

            {/* Name + stores */}
            <div style={{ flex:'1 1 150px', minWidth:120 }}>
              {editingId === group.primaryId ? (
                <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                  <input className="input" value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { group.entries.forEach(emp => supabase.from('users').update({ full_name: editName.trim() }).eq('id', emp.id)); saveEmployeeName(group.primaryId) }; if (e.key === 'Escape') setEditingId(null) }}
                    autoFocus
                    style={{ height:30, fontSize:14, fontWeight:700, padding:'2px 8px' }} />
                  <button onClick={() => { group.entries.forEach(emp => supabase.from('users').update({ full_name: editName.trim() }).eq('id', emp.id)); saveEmployeeName(group.primaryId) }} style={{ background:'none', border:'none', cursor:'pointer', fontSize:16 }}>✅</button>
                  <button onClick={() => setEditingId(null)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:16 }}>❌</button>
                </div>
              ) : (
                <div style={{ fontWeight:700, fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}
                  onClick={() => { setEditingId(group.primaryId); setEditName(group.name) }}>
                  {group.name}
                  <span style={{ fontSize:11, color:'var(--text-tertiary)' }}>✏️</span>
                </div>
              )}
              <div style={{ fontSize:11, color:'var(--text-tertiary)', display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginTop: 2 }}>
                {group.storeNames.map(s => (
                  <span key={s} style={{ display:'inline-block', background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', borderRadius:4, padding:'1px 6px', fontSize:10 }}>🏪 {s}</span>
                ))}
                <span>·</span>
                <span style={{ color: group.pin ? 'var(--success)' : 'var(--warning)' }}>
                  {group.pin ? '🔑 PIN ok' : '⚠️ No PIN'}
                </span>
              </div>
            </div>

            {/* Status */}
            <span className="badge badge-success" style={{ fontSize:11 }}>
              Attivo
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
                value={group.pin || ''}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 4)
                  setEmployees(prev => prev.map(em => group.entries.some(ge => ge.id === em.id) ? { ...em, pin: val || null } : em))
                }}
                style={{
                  width:64, textAlign:'center', fontSize:15, fontWeight:700,
                  letterSpacing:4, padding:'5px 6px', borderRadius:8,
                  border: pinSaved === group.primaryId ? '2px solid var(--success)' : '1.5px solid var(--border-default)',
                }}
              />
              <button
                className="btn btn-secondary"
                disabled={pinSaving === group.primaryId}
                onClick={() => { group.entries.forEach(emp => savePin(emp.id, group.entries[0].pin)) }}
                style={{ padding:'5px 10px', fontSize:11, whiteSpace:'nowrap' }}
              >
                {pinSaving === group.primaryId ? '...' : pinSaved === group.primaryId ? '✅' : '💾'}
              </button>
            </div>

            {/* Actions */}
            <div style={{ display:'flex', gap:6, flexShrink:0 }}>
              <button
                onClick={() => { if (confirm(`Eliminare ${group.name} da tutti gli store?`)) group.entries.forEach(emp => removeEmployee(emp)) }}
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
