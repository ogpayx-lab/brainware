'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'

export default function OwnerMaintenancePage() {
  const router = useRouter()
  const supabase = createClient()

  const [templates, setTemplates] = useState<any[]>([])
  const [recentLogs, setRecentLogs] = useState<any[]>([])
  const [storeId, setStoreId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', frequency: 'daily' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'tasks' | 'logs'>('tasks')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase.from('users').select('store_id, role').eq('id', user.id).single()
    if (profile?.role !== 'owner') { router.push('/login'); return }
    setStoreId(profile.store_id)

    const [{ data: tmpl }, { data: logs }] = await Promise.all([
      supabase.from('maintenance_templates')
        .select('*')
        .or(`store_id.eq.${profile.store_id},store_id.is.null`)
        .eq('is_active', true)
        .order('sort_order'),
      supabase.from('maintenance_logs')
        .select('*, users(full_name), shifts(opened_at, period)')
        .eq('store_id', profile.store_id)
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    setTemplates(tmpl ?? [])
    setRecentLogs(logs ?? [])
    setLoading(false)
  }

  async function addTemplate() {
    if (!form.title) return
    setSaving(true)
    const maxOrder = templates.reduce((m, t) => Math.max(m, t.sort_order), 0)
    await supabase.from('maintenance_templates').insert({
      store_id: storeId,
      title: form.title,
      frequency: form.frequency,
      sort_order: maxOrder + 1,
    })
    setShowForm(false)
    setForm({ title: '', frequency: 'daily' })
    await loadData()
    setSaving(false)
  }

  async function toggleTemplate(id: string, isActive: boolean) {
    await supabase.from('maintenance_templates').update({ is_active: !isActive }).eq('id', id)
    loadData()
  }

  // Stats per task from logs
  const taskStats: Record<string, { completed: number; total: number }> = {}
  for (const log of recentLogs) {
    const title = log.title
    if (!taskStats[title]) taskStats[title] = { completed: 0, total: 0 }
    taskStats[title].total++
    if (log.completed) taskStats[title].completed++
  }

  // Overall completion rate today
  const todayStr = new Date().toISOString().split('T')[0]
  const todayLogs = recentLogs.filter(l => l.created_at.startsWith(todayStr))
  const todayCompletion = todayLogs.length > 0
    ? Math.round((todayLogs.filter(l => l.completed).length / todayLogs.length) * 100) : 0

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>Caricamento...</div>

  return (
    <div>
      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ marginBottom: 'var(--space-xl)' }}>Nuovo Task</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div className="input-group">
                <label className="input-label">Titolo *</label>
                <input className="input" placeholder="Es. Pulizia vetrine" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="input-group">
                <label className="input-label">Frequenza</label>
                <select className="input" value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
                  <option value="daily">Giornaliero</option>
                  <option value="weekly">Settimanale</option>
                  <option value="monthly">Mensile</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-xl)' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowForm(false)}>Annulla</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={addTemplate} disabled={saving || !form.title}>
                {saving ? 'Salvataggio...' : 'Aggiungi Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xl)' }}>
        <div>
          <h2>Configurazione Manutenzione</h2>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>
            Completamento oggi: <strong style={{ color: todayCompletion >= 80 ? 'var(--success)' : todayCompletion >= 50 ? 'var(--warning)' : 'var(--danger)' }}>{todayCompletion}%</strong>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Nuovo Task</button>
      </div>

      <div className="toggle-group" style={{ marginBottom: 'var(--space-lg)' }}>
        <button className={`toggle-option ${tab === 'tasks' ? 'active' : ''}`} onClick={() => setTab('tasks')}>Checklist Tasks</button>
        <button className={`toggle-option ${tab === 'logs' ? 'active' : ''}`} onClick={() => setTab('logs')}>Log Completamento</button>
      </div>

      {tab === 'tasks' && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Task</th><th>Frequenza</th><th>Completamento storico</th><th>Scope</th><th></th></tr>
            </thead>
            <tbody>
              {templates.map(t => {
                const stats = taskStats[t.title]
                const pct = stats ? Math.round((stats.completed / stats.total) * 100) : null
                return (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600 }}>{t.title}</td>
                    <td>
                      <span className={`badge ${t.frequency === 'daily' ? 'badge-brand' : t.frequency === 'weekly' ? 'badge-blue' : 'badge-gray'}`} style={{ fontSize: 11 }}>
                        {t.frequency === 'daily' ? 'Giornaliero' : t.frequency === 'weekly' ? 'Settimanale' : 'Mensile'}
                      </span>
                    </td>
                    <td>
                      {pct !== null ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ height: 6, width: 80, background: 'var(--bg-surface-alt)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: pct >= 80 ? 'var(--brand-primary)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)', borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{pct}%</span>
                        </div>
                      ) : <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}></span>}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{t.store_id ? 'Questo negozio' : 'Globale'}</td>
                    <td>
                      {t.store_id && (
                        <button onClick={() => toggleTemplate(t.id, t.is_active)} className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--danger)', padding: '4px 8px' }}>
                          Rimuovi
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'logs' && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Data</th><th>Task</th><th>Dipendente</th><th>Turno</th><th>Stato</th></tr>
            </thead>
            <tbody>
              {recentLogs.slice(0, 30).map(log => (
                <tr key={log.id}>
                  <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{formatDate(log.created_at)}</td>
                  <td style={{ fontWeight: 600 }}>{log.title}</td>
                  <td>{log.users?.full_name ?? ''}</td>
                  <td style={{ fontSize: 13 }}>{log.shifts?.period === 'morning' ? 'Mattina' : 'Sera'}</td>
                  <td>
                    <span className={`badge ${log.completed ? 'badge-success' : 'badge-danger'}`}>
                      {log.completed ? ' Completato' : ' Non fatto'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
