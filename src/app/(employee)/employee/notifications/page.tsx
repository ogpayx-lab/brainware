'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { BottomNav } from '@/components/employee/BottomNav'
import { playNotificationSound } from '@/lib/useNotificationSound'

export default function EmployeeNotificationsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [notifications, setNotifications] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string | null>(null)
  const prevCount = useRef<number | null>(null)

  useEffect(() => { loadData() }, [])

  // Auto-refresh every 15 seconds
  useEffect(() => {
    const interval = setInterval(loadData, 15000)
    return () => clearInterval(interval)
  }, [storeId])

  async function loadData() {
    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('users').select('store_id').eq('id', user.id).single()
    if (!profile?.store_id) return
    setStoreId(profile.store_id)

    // Load notifications for this store
    const { data: notifs } = await supabase
      .from('notifications')
      .select('*')
      .eq('store_id', profile.store_id)
      .order('created_at', { ascending: false })
      .limit(50)
    setNotifications(notifs ?? [])

    // Check for new notifications → play sound
    const unread = (notifs ?? []).filter(n => !n.read).length
    if (prevCount.current !== null && unread > prevCount.current) {
      playNotificationSound()
    }
    prevCount.current = unread

    // Load assigned tasks
    const { data: tasksData } = await supabase
      .from('tasks')
      .select('*')
      .eq('store_id', profile.store_id)
      .neq('status', 'done')
      .order('created_at', { ascending: false })
      .limit(20)
    setTasks(tasksData ?? [])

    setLoading(false)
  }

  async function markRead(id: string) {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  async function markAllRead() {
    if (!storeId) return
    await supabase.from('notifications').update({ read: true }).eq('store_id', storeId).eq('read', false)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  async function updateTaskStatus(id: string, status: string) {
    await supabase.from('tasks').update({ status }).eq('id', id)
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t))
  }

  const unreadCount = notifications.filter(n => !n.read).length
  const typeIcon: Record<string, string> = {
    stock_transfer: '📦', stock_reload: '📦', stock_counted: '✅',
    stock_approved: '✅', stock_rejected: '❌', restock_request: '🔔',
    task: '📋', sale: '💰', default: '🔔',
  }
  const priorityColor: Record<string, string> = { urgent: 'var(--danger)', high: 'var(--warning)', normal: 'var(--text-secondary)', low: 'var(--text-tertiary)' }
  const statusLabel: Record<string, string> = { pending: '⏳ Da fare', in_progress: '🔄 In corso', done: '✅ Fatto' }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>Caricamento...</div>

  return (
    <div className="page" style={{ paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-subtle)', padding: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
        <Link href="/employee/dashboard" style={{ textDecoration: 'none', color: 'var(--text-primary)', fontSize: 20 }}>←</Link>
        <div style={{ flex: 1 }}>
          <h3>🔔 Notifiche & Task</h3>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
            {unreadCount > 0 ? `${unreadCount} non lette` : 'Tutto letto'}
          </div>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="btn btn-secondary" style={{ fontSize: 11, padding: '5px 10px' }}>
            ✓ Segna tutto letto
          </button>
        )}
      </div>

      <div style={{ padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>

        {/* Active Tasks */}
        {tasks.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
              📋 Task Assegnati ({tasks.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tasks.map(task => (
                <div key={task.id} style={{
                  background: 'var(--bg-primary)',
                  border: `1.5px solid ${task.priority === 'urgent' ? 'var(--danger)' : task.priority === 'high' ? 'var(--warning)' : 'var(--border-default)'}`,
                  borderRadius: 12, padding: 'var(--space-md)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>{task.priority === 'urgent' ? '🔴' : task.priority === 'high' ? '🟡' : '📋'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: priorityColor[task.priority] || 'var(--text-primary)' }}>
                        {task.title}
                      </div>
                      {task.description && (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.4 }}>{task.description}</div>
                      )}
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
                        {new Date(task.created_at).toLocaleString('it-IT')} · {statusLabel[task.status] || task.status}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                    {task.status === 'pending' && (
                      <button onClick={() => updateTaskStatus(task.id, 'in_progress')} className="btn btn-primary" style={{ flex: 1, fontSize: 12, padding: '6px 10px' }}>
                        ▶️ Inizia
                      </button>
                    )}
                    {task.status === 'in_progress' && (
                      <button onClick={() => updateTaskStatus(task.id, 'done')} className="btn btn-primary" style={{ flex: 1, fontSize: 12, padding: '6px 10px' }}>
                        ✅ Completato
                      </button>
                    )}
                    {task.status !== 'done' && task.status !== 'pending' && (
                      <button onClick={() => updateTaskStatus(task.id, 'pending')} className="btn btn-secondary" style={{ fontSize: 12, padding: '6px 10px' }}>
                        ↩️ Riapri
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notifications */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
            🔔 Notifiche
          </div>
          {notifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-tertiary)' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🔕</div>
              <div>Nessuna notifica</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => !n.read && markRead(n.id)}
                  style={{
                    padding: '12px 14px', borderRadius: 10, cursor: !n.read ? 'pointer' : 'default',
                    background: n.read ? 'var(--bg-primary)' : 'var(--brand-primary-light)',
                    border: `1px solid ${n.read ? 'var(--border-default)' : 'var(--brand-primary)'}`,
                    opacity: n.read ? 0.7 : 1,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{typeIcon[n.type] || typeIcon.default}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: n.read ? 400 : 700, fontSize: 14 }}>{n.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.4 }}>{n.message}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
                        {new Date(n.created_at).toLocaleString('it-IT')}
                      </div>
                    </div>
                    {!n.read && (
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand-primary)', flexShrink: 0, marginTop: 6 }} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
