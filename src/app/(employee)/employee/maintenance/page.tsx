'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { BottomNav } from '@/components/employee/BottomNav'

interface TaskRow {
  id: string
  template_id: string | null
  title: string
  completed: boolean
  log_id: string | null
}

export default function MaintenancePage() {
  const router = useRouter()
  const supabase = createClient()

  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [shiftId, setShiftId] = useState<string | null>(null)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUserId(user.id)

    const { data: profile } = await supabase.from('users').select('store_id').eq('id', user.id).single()
    if (!profile?.store_id) return
    setStoreId(profile.store_id)

    const { data: shift } = await supabase.from('shifts').select('id').eq('user_id', user.id).eq('status', 'open').order('created_at',{ascending:false}).limit(1).single()
    if (!shift) { router.push('/employee/shift/open'); return }
    setShiftId(shift.id)

    // Load templates (daily tasks for this store + global)
    const { data: templates } = await supabase
      .from('maintenance_templates')
      .select('*')
      .or(`store_id.eq.${profile.store_id},store_id.is.null`)
      .eq('is_active', true)
      .eq('frequency', 'daily')
      .order('sort_order')

    // Load existing logs for this shift
    const { data: logs } = await supabase
      .from('maintenance_logs')
      .select('*')
      .eq('shift_id', shift.id)

    const taskList: TaskRow[] = (templates ?? []).map(t => {
      const log = logs?.find(l => l.template_id === t.id)
      return {
        id: t.id,
        template_id: t.id,
        title: t.title,
        completed: log?.completed ?? false,
        log_id: log?.id ?? null,
      }
    })

    setTasks(taskList)
    setLoading(false)
  }

  async function toggleTask(task: TaskRow) {
    if (!shiftId || !storeId || !userId) return
    const newCompleted = !task.completed

    if (task.log_id) {
      await supabase.from('maintenance_logs')
        .update({ completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null })
        .eq('id', task.log_id)
    } else {
      const { data: log } = await supabase.from('maintenance_logs')
        .insert({
          shift_id: shiftId, store_id: storeId, user_id: userId,
          template_id: task.template_id, title: task.title,
          completed: newCompleted,
          completed_at: newCompleted ? new Date().toISOString() : null,
        })
        .select('id').single()

      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, log_id: log?.id ?? null, completed: newCompleted } : t))
      return
    }

    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: newCompleted } : t))
  }

  const completed = tasks.filter(t => t.completed).length
  const pct = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>Caricamento...</div>

  return (
    <div className="page" style={{ paddingBottom: 80 }}>
      <div style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-subtle)', padding: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
        <Link href="/employee/dashboard" style={{ textDecoration: 'none', color: 'var(--text-primary)', fontSize: 20 }}></Link>
        <div style={{ flex: 1 }}>
          <h3>Manutenzione Store</h3>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{new Date().toLocaleDateString('it-IT')}</div>
        </div>
      </div>

      <div style={{ padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

        {/* Progress */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
            <h4>Checklist Giornaliera</h4>
            <span style={{ fontSize: 14, color: 'var(--text-tertiary)', fontWeight: 600 }}>{completed}/{tasks.length} completati</span>
          </div>
          <div style={{ height: 8, background: 'var(--bg-surface-alt)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${pct}%`,
              background: pct === 100 ? 'var(--brand-primary)' : 'var(--accent-blue)',
              borderRadius: 4,
              transition: 'width 0.3s ease',
            }} />
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'right' }}>{pct}%</div>
        </div>

        {/* Task list */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {tasks.map((task, i) => (
            <div
              key={task.id}
              onClick={() => toggleTask(task)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-md)',
                padding: 'var(--space-md) var(--space-lg)',
                borderBottom: i < tasks.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                cursor: 'pointer',
                transition: 'background var(--transition)',
                background: task.completed ? 'var(--success-light)' : 'var(--bg-primary)',
              }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: 6,
                border: `2px solid ${task.completed ? 'var(--brand-primary)' : 'var(--border-strong)'}`,
                background: task.completed ? 'var(--brand-primary)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: 13, flexShrink: 0,
                transition: 'all var(--transition)',
              }}>
                {task.completed && ''}
              </div>
              <span style={{
                fontSize: 14,
                fontWeight: 500,
                color: task.completed ? 'var(--text-secondary)' : 'var(--text-primary)',
                textDecoration: task.completed ? 'line-through' : 'none',
              }}>
                {task.title}
              </span>
            </div>
          ))}
        </div>

        {pct === 100 && (
          <div style={{ textAlign: 'center', padding: 'var(--space-lg)', background: 'var(--success-light)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--brand-primary)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}></div>
            <div style={{ fontWeight: 700, color: 'var(--brand-primary-dark)' }}>Checklist completata!</div>
          </div>
        )}

      </div>
      <BottomNav />
    </div>
  )
}
