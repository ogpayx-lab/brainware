'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  day_off_request:  { icon: '📅', color: '#F59E0B' },
  sale:             { icon: '💰', color: '#22C55E' },
  task_completed:   { icon: '✅', color: '#22C55E' },
  low_stock:        { icon: '⚠️', color: '#EF4444' },
  shift_open:       { icon: '🟢', color: '#22C55E' },
  shift_close:      { icon: '🔴', color: '#6B7280' },
  maintenance:      { icon: '🔧', color: '#3B82F6' },
  default:          { icon: '🔔', color: '#6B7280' },
}

export default function NotificationsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread' | 'day_off_request'>('all')
  const [storeId, setStoreId] = useState<string | null>(null)
  const [dayOffRequests, setDayOffRequests] = useState<any[]>([])

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('users').select('store_id,role,stores(organization_id)').eq('id', user.id).single()
    if (!profile || profile.role !== 'owner') { router.push('/login'); return }
    setStoreId(profile.store_id)

    // Carica notifiche del proprio store
    const { data: notifs } = await supabase
      .from('notifications')
      .select('*, users(full_name)')
      .eq('store_id', profile.store_id)
      .order('created_at', { ascending: false })
      .limit(100)
    setNotifications(notifs ?? [])

    // Carica richieste giorni liberi pendenti
    const { data: dorData } = await supabase
      .from('day_off_requests')
      .select('*, users(full_name)')
      .eq('store_id', profile.store_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    setDayOffRequests(dorData ?? [])

    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
    // Polling ogni 15 secondi per aggiornamenti live
    const t = setInterval(loadData, 15000)
    return () => clearInterval(t)
  }, [loadData])

  async function markAllRead() {
    if (!storeId) return
    await supabase.from('notifications').update({ read: true }).eq('store_id', storeId).eq('read', false)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  async function handleDayOff(id: string, action: 'approved' | 'rejected') {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('day_off_requests').update({
      status: action,
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', id)
    setDayOffRequests(prev => prev.filter(r => r.id !== id))
    // Inserisci notifica per il dipendente
    const req = dayOffRequests.find(r => r.id === id)
    if (req) {
      await supabase.from('notifications').insert({
        store_id: storeId,
        type: 'day_off_request',
        title: action === 'approved' ? '✅ Giorno libero approvato' : '❌ Giorno libero rifiutato',
        message: `Il tuo giorno libero del ${new Date(req.date + 'T12:00:00').toLocaleDateString('it-IT')} è stato ${action === 'approved' ? 'approvato' : 'rifiutato'}`,
        user_id: req.user_id,
        read: false,
      })
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length
  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.read
    if (filter === 'day_off_request') return n.type === 'day_off_request'
    return true
  })

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', color:'var(--text-secondary)' }}>Caricamento...</div>

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'var(--space-xl)' }}>
        <div>
          <h2>🔔 Centro Notifiche</h2>
          <p style={{ color:'var(--text-secondary)', fontSize:14, marginTop:4 }}>
            Aggiornamento live ogni 15 secondi {unreadCount > 0 && <span style={{ background:'var(--danger)', color:'white', borderRadius:20, padding:'2px 8px', fontSize:12, fontWeight:700, marginLeft:8 }}>{unreadCount} nuove</span>}
          </p>
        </div>
        {unreadCount > 0 && (
          <button className="btn btn-secondary" onClick={markAllRead} style={{ fontSize:12 }}>
            ✓ Segna tutto come letto
          </button>
        )}
      </div>

      {/* Richieste giorni liberi pendenti */}
      {dayOffRequests.length > 0 && (
        <div className="card" style={{ marginBottom:'var(--space-xl)', borderLeft:'4px solid var(--warning)' }}>
          <h4 style={{ marginBottom:'var(--space-md)', color:'var(--warning)' }}>
            ⏳ Richieste Giorni Liberi da Gestire ({dayOffRequests.length})
          </h4>
          <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-md)' }}>
            {dayOffRequests.map(req => (
              <div key={req.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'var(--space-md)', background:'var(--bg-surface)', borderRadius:'var(--radius-md)' }}>
                <div>
                  <div style={{ fontWeight:600, fontSize:14 }}>{req.users?.full_name}</div>
                  <div style={{ fontSize:13, color:'var(--text-secondary)', marginTop:2 }}>
                    📅 {new Date(req.date + 'T12:00:00').toLocaleDateString('it-IT', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
                  </div>
                  {req.notes && <div style={{ fontSize:12, color:'var(--text-tertiary)', marginTop:2 }}>💬 {req.notes}</div>}
                </div>
                <div style={{ display:'flex', gap:8, flexShrink:0, marginLeft:12 }}>
                  <button onClick={() => handleDayOff(req.id, 'rejected')} style={{ background:'#FEF2F2', color:'var(--danger)', border:'1px solid var(--danger)', borderRadius:8, padding:'6px 12px', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                    ❌ Rifiuta
                  </button>
                  <button onClick={() => handleDayOff(req.id, 'approved')} style={{ background:'var(--success)', color:'white', border:'none', borderRadius:8, padding:'6px 12px', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                    ✅ Approva
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtri */}
      <div style={{ display:'flex', gap:8, marginBottom:'var(--space-lg)' }}>
        {(['all', 'unread', 'day_off_request'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding:'6px 16px', borderRadius:20, border:'1px solid var(--border-default)', background: filter === f ? 'var(--brand-primary)' : 'var(--bg-primary)', color: filter === f ? 'white' : 'var(--text-secondary)', fontSize:13, fontWeight: filter === f ? 600 : 400, cursor:'pointer' }}>
            {f === 'all' ? '📋 Tutte' : f === 'unread' ? `🔵 Non lette (${unreadCount})` : '📅 Giorni liberi'}
          </button>
        ))}
      </div>

      {/* Lista notifiche */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        {filtered.length === 0 && (
          <div style={{ padding:'var(--space-xl)', textAlign:'center', color:'var(--text-tertiary)', fontSize:14 }}>
            🎉 Nessuna notifica
          </div>
        )}
        {filtered.map((notif, i) => {
          const cfg = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.default
          return (
            <div
              key={notif.id}
              onClick={async () => {
                if (!notif.read) {
                  await supabase.from('notifications').update({ read: true }).eq('id', notif.id)
                  setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n))
                }
              }}
              style={{
                display:'flex', alignItems:'flex-start', gap:'var(--space-md)',
                padding:'var(--space-md) var(--space-lg)',
                borderBottom: i < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                background: notif.read ? 'transparent' : 'var(--brand-primary-light)',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
            >
              <div style={{ width:36, height:36, borderRadius:10, background: cfg.color + '20', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                {cfg.icon}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                  <div style={{ fontWeight: notif.read ? 500 : 700, fontSize:14 }}>{notif.title}</div>
                  {!notif.read && <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--brand-primary)', flexShrink:0, marginTop:6 }} />}
                </div>
                {notif.message && <div style={{ fontSize:13, color:'var(--text-secondary)', marginTop:2, lineHeight:1.4 }}>{notif.message}</div>}
                <div style={{ fontSize:11, color:'var(--text-tertiary)', marginTop:4 }}>
                  {new Date(notif.created_at).toLocaleDateString('it-IT', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                  {notif.users?.full_name && ` · ${notif.users.full_name}`}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
