'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { fmt, formatTime } from '@/lib/utils'

const SA_STYLE = {
  card: {
    background: '#1E293B',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 20,
  } as React.CSSProperties,
  label: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 500, marginBottom: 4 } as React.CSSProperties,
  value: { fontSize: 28, fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'white', lineHeight: 1 } as React.CSSProperties,
  change: { fontSize: 12, color: '#22C55E', marginTop: 4 } as React.CSSProperties,
  text: { color: 'rgba(255,255,255,0.7)', fontSize: 14 } as React.CSSProperties,
  heading: { color: 'white', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18, marginBottom: 16 } as React.CSSProperties,
  th: { fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', padding: '8px 12px', textAlign: 'left' as const, borderBottom: '1px solid rgba(255,255,255,0.06)' },
  td: { padding: '12px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 14, color: 'rgba(255,255,255,0.8)' },
}

export default function SuperAdminDashboard() {
  const router = useRouter()
  const supabase = createClient()
  const [stats, setStats] = useState({ owners: 0, stores: 0, totalRevenue: 0, mrr: 0 })
  const [topOwners, setTopOwners] = useState<any[]>([])
  const [activity, setActivity] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/superadmin/login'); return }
    const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
    if (profile?.role !== 'superadmin') { router.push('/login'); return }

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const [{ count: ownerCount }, { count: storeCount }, { data: salesData }, { data: recentUsers }, { data: recentStores }] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'owner'),
      supabase.from('stores').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('sales').select('total, store_id, stores(name, users!store_id(full_name))').eq('movement_type', 'sale').gte('created_at', monthStart),
      supabase.from('users').select('full_name, created_at, role').order('created_at', { ascending: false }).limit(3),
      supabase.from('stores').select('name, created_at').order('created_at', { ascending: false }).limit(2),
    ])

    const totalRevenue = (salesData ?? []).reduce((s, x) => s + x.total, 0)

    // Group by owner (via store)
    const byOwner: Record<string, { name: string; stores: number; revenue: number }> = {}
    for (const sale of (salesData ?? [])) {
      const ownerName = (sale.stores as any)?.users?.full_name ?? 'Sconosciuto'
      if (!byOwner[ownerName]) byOwner[ownerName] = { name: ownerName, stores: 0, revenue: 0 }
      byOwner[ownerName].revenue += sale.total
    }
    const top = Object.values(byOwner).sort((a, b) => b.revenue - a.revenue).slice(0, 5)
    setTopOwners(top)

    // Activity feed
    const acts: any[] = []
    for (const u of (recentUsers ?? [])) {
      if (u.role === 'owner') acts.push({ text: 'Nuovo owner registrato', sub: `${u.full_name}  ${formatTime(u.created_at)}`, icon: '' })
    }
    for (const s of (recentStores ?? [])) {
      acts.push({ text: `Negozio aggiunto: ${s.name}`, sub: formatTime(s.created_at), icon: '' })
    }

    setStats({ owners: ownerCount ?? 0, stores: storeCount ?? 0, totalRevenue, mrr: (ownerCount ?? 0) * 499 })
    setActivity(acts)
    setLoading(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ color: 'rgba(255,255,255,0.4)' }}>Caricamento...</div>
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ color: 'white', fontFamily: 'var(--font-heading)', fontSize: 24, fontWeight: 700 }}>Dashboard Globale</h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 4 }}>Panoramica di tutti gli owner e negozi</p>
      </div>

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Owners Totali', value: stats.owners.toString(), change: 'attivi sulla piattaforma' },
          { label: 'Negozi Attivi', value: stats.stores.toString(), change: 'su tutti gli owner' },
          { label: 'Revenue Totale (mese)', value: fmt(stats.totalRevenue), change: '+18.2% vs mese prec.' },
          { label: 'MRR Licenze (est.)', value: fmt(stats.mrr), change: 'ricavo ricorrente mensile' },
        ].map(k => (
          <div key={k.label} style={SA_STYLE.card}>
            <div style={SA_STYLE.label}>{k.label}</div>
            <div style={SA_STYLE.value}>{k.value}</div>
            <div style={SA_STYLE.change}>{k.change}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Top owners */}
        <div style={SA_STYLE.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h4 style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>Top Owners per Revenue</h4>
            <Link href="/superadmin/owners" style={{ fontSize: 13, color: '#22C55E', textDecoration: 'none' }}>Vedi tutti </Link>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Owner', 'Revenue', 'Stato'].map(h => <th key={h} style={SA_STYLE.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {topOwners.length === 0 && (
                <tr><td colSpan={3} style={{ ...SA_STYLE.td, textAlign: 'center', color: 'rgba(255,255,255,0.2)' }}>Nessun dato disponibile</td></tr>
              )}
              {topOwners.map((owner, i) => (
                <tr key={owner.name}>
                  <td style={SA_STYLE.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white' }}>
                        {owner.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>{owner.name}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ ...SA_STYLE.td, fontWeight: 700, color: '#22C55E' }}>{fmt(owner.revenue)}</td>
                  <td style={SA_STYLE.td}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(34,197,94,0.15)', color: '#22C55E', fontWeight: 600 }}>Attivo</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Activity */}
        <div style={SA_STYLE.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h4 style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>Attivita Recenti</h4>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(34,197,94,0.15)', color: '#22C55E', fontWeight: 600 }}> Live</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {activity.length === 0 && <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>Nessuna attivita recente</p>}
            {activity.map((act, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{act.icon}</span>
                <div>
                  <div style={{ fontSize: 13, color: 'white', fontWeight: 500 }}>{act.text}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{act.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Quick links */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 20 }}>
        {[
          { href: '/superadmin/owners', icon: '', label: 'Gestione Owners', desc: 'Crea e gestisci gli account' },
          { href: '/superadmin/analytics', icon: '', label: 'Analytics Globale', desc: 'Metriche aggregate di tutti' },
          { href: '/superadmin/settings', icon: '', label: 'Impostazioni Piattaforma', desc: 'Policy e default globali' },
        ].map(link => (
          <Link key={link.href} href={link.href} style={{ textDecoration: 'none' }}>
            <div style={{ ...SA_STYLE.card, cursor: 'pointer', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 24 }}>{link.icon}</span>
              <div>
                <div style={{ color: 'white', fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{link.label}</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{link.desc}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
