'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { playNotificationSound } from '@/lib/useNotificationSound'

// Map notification types to owner pages
const TYPE_ROUTES: Record<string, string> = {
  restock_request: '/owner/warehouse/stock-movements',
  stock_transfer: '/owner/warehouse/stock-movements',
  stock_counted: '/owner/warehouse/stock-movements',
  stock_reload: '/owner/warehouse/stock-movements',
  stock_approved: '/owner/warehouse/stock-movements',
  stock_rejected: '/owner/warehouse/stock-movements',
  task_assigned: '/owner/tasks',
  task_completed: '/owner/tasks',
  shift_alert: '/owner/reports',
  checkout_missed: '/owner/reports',
  sale: '/owner/reports',
}

export function OwnerNotificationListener() {
  const supabase = createClient()
  const router = useRouter()
  const prevCount = useRef<number | null>(null)
  const [toast, setToast] = useState<{ title: string; message: string; type: string } | null>(null)

  useEffect(() => {
    checkNotifications()
    const interval = setInterval(checkNotifications, 15000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(timer)
  }, [toast])

  function handleClick() {
    if (!toast) return
    const route = TYPE_ROUTES[toast.type] || '/owner/warehouse/stock-movements'
    router.push(route)
    setTimeout(() => setToast(null), 300)
  }

  async function checkNotifications() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('users').select('store_id, stores(organization_id)').eq('id', user.id).single()
      if (!profile?.store_id) return
      const oid = (profile.stores as any)?.organization_id
      if (!oid) return

      const { data: stores } = await supabase.from('stores').select('id').eq('organization_id', oid)
      const storeIds = (stores ?? []).map(s => s.id)
      if (storeIds.length === 0) return

      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .in('store_id', storeIds)
        .eq('read', false)

      const unread = count ?? 0

      if (prevCount.current !== null && unread > prevCount.current) {
        playNotificationSound()

        const { data: latest } = await supabase
          .from('notifications')
          .select('title, message, type')
          .in('store_id', storeIds)
          .eq('read', false)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (latest) {
          setToast({ title: latest.title, message: latest.message, type: latest.type || '' })
        }
      }
      prevCount.current = unread
    } catch {}
  }

  if (!toast) return null

  return (
    <div
      onClick={handleClick}
      style={{
        position: 'fixed', top: 20, right: 20, zIndex: 10000,
        background: 'var(--bg-primary)', border: '1.5px solid var(--brand-primary)',
        borderRadius: 14, padding: '14px 18px', maxWidth: 380,
        boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        animation: 'slideInRight 0.3s ease-out',
        cursor: 'pointer', transition: 'transform 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.02)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontSize: 24 }}>🔔</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{toast.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{toast.message}</div>
          <div style={{ fontSize: 11, color: 'var(--brand-primary)', fontWeight: 600, marginTop: 6 }}>
            Clicca per gestire →
          </div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); setToast(null) }}
          style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 18, cursor: 'pointer', padding: 0 }}
        >×</button>
      </div>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
