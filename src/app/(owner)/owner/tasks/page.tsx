'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const PRIORITY_CONFIG = {
  urgent: { label: '🔴 Urgente', color: '#EF4444', bg: '#FEF2F2' },
  high:   { label: '🟡 Alta',    color: '#F59E0B', bg: '#FFFBEB' },
  normal: { label: '🟢 Normale', color: '#22C55E', bg: '#F0FDF4' },
  low:    { label: '⚪ Bassa',   color: '#9CA3AF', bg: '#F9FAFB' },
}
const STATUS_CONFIG = {
  pending:     { label: '⏳ In attesa', color: '#F59E0B' },
  in_progress: { label: '🔵 In corso',  color: '#3B82F6' },
  done:        { label: '✅ Completato', color: '#22C55E' },
}

const EMPTY_FORM = { title: '', description: '', assigned_to: '', priority: 'normal', due_date: '', status: 'pending' }

export default function TasksPage() {
  const router = useRouter()
  const supabase = createClient()
  const [tasks, setTasks] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string>('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'in_progress' | 'done'>('all')
  const [filterEmployee, setFilterEmployee] = useState<string>('all')
  const [editingTask, setEditingTask] = useState<any | null>(null)

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUserId(user.id)
    const { data: profile } = await supabase.from('users').select('store_id,role').eq('id', user.id).single()
    if (!profile || profile.role !== 'owner') { router.push('/login'); return }
    setStoreId(profile.store_id)

    const [{ data: tasksData }, { data: empsData }] = await Promise.all([
      supabase.from('tasks').select('*, users!tasks_assigned_to_fkey(id,full_name)').eq('store_id', profile.store_id).order('created_at', { ascending: false }),
      supabase.from('users').select('id,full_name,role').eq('store_id', profile.store_id).eq('role', 'employee').order('full_name'),
    ])
    setTasks(tasksData ?? [])
    setEmployees((empsData ?? []).filter(e => !e.full_name?.startsWith('[STORE]')))
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function saveTask() {
    if (!form.title || !storeId) return
    setSaving(true)
    if (editingTask) {
      await supabase.from('tasks').update({ ...form, store_id: storeId }).eq('id', editingTask.id)
    } else {
      await supabase.from('tasks').insert({ ...form, store_id: storeId, created_by: userId })
      // Notifica al dipendente assegnato
      if (form.assigned_to) {
        await supabase.from('notifications').insert({
          store_id: storeId,
          type: 'task_assigned',
          title: '📋 Nuovo task assegnato',
          message: `Ti è stato assegnato un nuovo task: "${form.title}"${form.due_date ? ` (scadenza: ${new Date(form.due_date + 'T12:00:00').toLocaleDateString('it-IT')})` : ''}`,
          user_id: form.assigned_to,
        })
      }
    }
    setSaving(false)
    setShowForm(false)
    setForm({ ...EMPTY_FORM })
    setEditingTask(null)
    loadData()
  }

  async function deleteTask(id: string) {
    if (!confirm('Eliminare questo task?')) return
    await supabase.from('tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  async function updateStatus(id: string, status: string) {
    const update: any = { status }
    if (status === 'done') update.completed_at = new Date().toISOString()
    await supabase.from('tasks').update(update).eq('id', id)
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...update } : t))
  }

  function openEdit(task: any) {
    setForm({
      title: task.title,
      description: task.description ?? '',
      assigned_to: task.assigned_to ?? '',
      priority: task.priority,
      due_date: task.due_date ?? '',
      status: task.status,
    })
    setEditingTask(task)
    setShowForm(true)
  }

  const filtered = tasks.filter(t => {
    const matchStatus = filterStatus === 'all' || t.status === filterStatus
    const matchEmp = filterEmployee === 'all' || t.assigned_to === filterEmployee
    return matchStatus && matchEmp
  })

  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    done: tasks.filter(t => t.status === 'done').length,
    urgent: tasks.filter(t => t.priority === 'urgent' && t.status !== 'done').length,
  }

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', color:'var(--text-secondary)' }}>Caricamento...</div>

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'var(--space-xl)' }}>
        <div>
          <h2>📋 Gestione Task</h2>
          <p style={{ color:'var(--text-secondary)', fontSize:14, marginTop:4 }}>
            Assegna e monitora i task dei tuoi dipendenti
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditingTask(null); setForm({ ...EMPTY_FORM }) }}>
          + Nuovo Task
        </button>
      </div>

      {/* KPI */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'var(--space-md)', marginBottom:'var(--space-xl)' }}>
        {[
          { label:'Totali', value: stats.total, color:'var(--text-primary)' },
          { label:'In Attesa', value: stats.pending, color:'#F59E0B' },
          { label:'In Corso', value: stats.in_progress, color:'#3B82F6' },
          { label:'Completati', value: stats.done, color:'#22C55E' },
          { label:'🔴 Urgenti', value: stats.urgent, color:'#EF4444' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filtri */}
      <div style={{ display:'flex', gap:10, marginBottom:'var(--space-lg)', flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ display:'flex', background:'var(--bg-surface)', borderRadius:10, padding:3, gap:3 }}>
          {(['all', 'pending', 'in_progress', 'done'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              padding:'6px 14px', borderRadius:8, border:'none', fontSize:13, cursor:'pointer',
              background: filterStatus === s ? 'var(--bg-primary)' : 'transparent',
              fontWeight: filterStatus === s ? 700 : 400,
              color: filterStatus === s ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}>
              {s === 'all' ? '📋 Tutti' : STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
        <select className="input" style={{ height:36, width:'auto', minWidth:160 }} value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)}>
          <option value="all">👥 Tutti i dipendenti</option>
          {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
        </select>
      </div>

      {/* Lista task */}
      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:'var(--space-xl)', color:'var(--text-tertiary)' }}>
          <div style={{ fontSize:48, marginBottom:12 }}>📋</div>
          <div style={{ fontWeight:600, marginBottom:8 }}>Nessun task trovato</div>
          <div style={{ fontSize:13 }}>Crea un nuovo task cliccando "+ Nuovo Task"</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-sm)' }}>
          {filtered.map(task => {
            const pc = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG] ?? PRIORITY_CONFIG.normal
            const sc = STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending
            const isOverdue = task.due_date && task.status !== 'done' && new Date(task.due_date) < new Date()
            return (
              <div key={task.id} className="card" style={{ padding:'var(--space-md) var(--space-lg)', borderLeft:`4px solid ${pc.color}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
                      <span style={{ fontWeight:700, fontSize:15 }}>{task.title}</span>
                      <span style={{ fontSize:11, fontWeight:700, color: pc.color, background: pc.bg, padding:'2px 8px', borderRadius:20 }}>{pc.label}</span>
                      <span style={{ fontSize:11, fontWeight:600, color: sc.color }}>{sc.label}</span>
                      {isOverdue && <span style={{ fontSize:11, fontWeight:700, color:'#EF4444', background:'#FEF2F2', padding:'2px 8px', borderRadius:20 }}>⚠️ Scaduto</span>}
                    </div>
                    {task.description && (
                      <div style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:6 }}>{task.description}</div>
                    )}
                    <div style={{ display:'flex', gap:12, fontSize:12, color:'var(--text-tertiary)', flexWrap:'wrap' }}>
                      {task.users && <span>👤 {task.users.full_name}</span>}
                      {task.due_date && <span style={{ color: isOverdue ? '#EF4444' : 'var(--text-tertiary)' }}>📅 {new Date(task.due_date + 'T12:00:00').toLocaleDateString('it-IT')}</span>}
                      {task.completed_at && <span>✅ {new Date(task.completed_at).toLocaleDateString('it-IT')}</span>}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                    {task.status !== 'done' && (
                      <select
                        value={task.status}
                        onChange={e => updateStatus(task.id, e.target.value)}
                        style={{ height:32, fontSize:12, padding:'0 8px', border:'1px solid var(--border-default)', borderRadius:8, background:'var(--bg-primary)', cursor:'pointer' }}
                      >
                        <option value="pending">⏳ In attesa</option>
                        <option value="in_progress">🔵 In corso</option>
                        <option value="done">✅ Fatto</option>
                      </select>
                    )}
                    <button onClick={() => openEdit(task)} style={{ padding:'4px 10px', fontSize:12, background:'var(--bg-surface)', border:'1px solid var(--border-default)', borderRadius:8, cursor:'pointer' }}>✏️</button>
                    <button onClick={() => deleteTask(task.id)} style={{ padding:'4px 10px', fontSize:12, background:'#FEF2F2', border:'1px solid #EF4444', borderRadius:8, cursor:'pointer', color:'#EF4444' }}>🗑️</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal crea/modifica task */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:'var(--space-lg)' }}>
          <div style={{ background:'var(--bg-primary)', borderRadius:'var(--radius-lg)', padding:'var(--space-xl)', width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto' }}>
            <h3 style={{ marginBottom:'var(--space-lg)' }}>{editingTask ? '✏️ Modifica Task' : '📋 Nuovo Task'}</h3>

            <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-md)' }}>
              <div>
                <label className="input-label">Titolo *</label>
                <input className="input" placeholder="Es. Conta inventario prodotti A..." value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label className="input-label">Descrizione (opzionale)</label>
                <textarea className="input" rows={3} placeholder="Dettagli del task..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ resize:'vertical' }} />
              </div>
              <div>
                <label className="input-label">Assegna a</label>
                <select className="input" value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}>
                  <option value="">— Nessuno (task generale) —</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
                </select>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--space-md)' }}>
                <div>
                  <label className="input-label">Priorità</label>
                  <select className="input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                    {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label">Scadenza</label>
                  <input type="date" className="input" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} min={new Date().toISOString().split('T')[0]} />
                </div>
              </div>
              {editingTask && (
                <div>
                  <label className="input-label">Stato</label>
                  <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div style={{ display:'flex', gap:8, marginTop:'var(--space-xl)' }}>
              <button className="btn btn-secondary" style={{ flex:1 }} onClick={() => { setShowForm(false); setEditingTask(null); setForm({ ...EMPTY_FORM }) }}>
                Annulla
              </button>
              <button className="btn btn-primary" style={{ flex:2 }} disabled={saving || !form.title} onClick={saveTask}>
                {saving ? 'Salvataggio...' : editingTask ? 'Salva Modifiche' : '+ Crea Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
