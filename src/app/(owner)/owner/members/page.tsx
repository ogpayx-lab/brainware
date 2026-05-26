'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/lib/i18n'

export default function MembersPage() {
  const router = useRouter()
  const supabase = createClient()
  const t = useT()
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [storeFilter, setStoreFilter] = useState('all')
  const [stores, setStores] = useState<any[]>([])

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase.from('users').select('store_id, role, stores(organization_id)').eq('id', user.id).single()
    if (!profile || profile.role !== 'owner') { router.push('/login'); return }

    const oid = (profile.stores as any)?.organization_id
    let storeIds = [profile.store_id]
    if (oid) {
      const { data: orgStores } = await supabase.from('stores').select('id, name').eq('organization_id', oid)
      storeIds = (orgStores ?? []).map(s => s.id)
      setStores(orgStores ?? [])
    }

    const { data: cards } = await supabase
      .from('fidelity_cards')
      .select('*, stores(name)')
      .in('store_id', storeIds)
      .order('created_at', { ascending: false })

    setMembers(cards ?? [])
    setLoading(false)
  }

  const filtered = members.filter(m => {
    const matchSearch = !search ||
      m.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.phone?.includes(search) ||
      m.email?.toLowerCase().includes(search.toLowerCase())
    const matchStore = storeFilter === 'all' || m.store_id === storeFilter
    return matchSearch && matchStore
  })

  const totalPoints = members.reduce((s, m) => s + (m.points || 0), 0)
  const totalRewards = members.reduce((s, m) => s + Math.floor((m.points || 0) / 10), 0)

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-secondary)' }}>{t('loading')}</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-xl)', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2>{t('members.title')}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>
            {members.length} membri registrati · {totalPoints} punti totali · {totalRewards} premi maturati
          </p>
        </div>
      </div>

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 'var(--space-lg)' }}>
        <div className="card" style={{ textAlign: 'center', padding: 16 }}>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{members.length}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Total {t('sidebar.members')}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 16 }}>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{members.filter(m => {
            const d = new Date(m.created_at)
            const now = new Date()
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
          }).length}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('new_')} {t('month')}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 16 }}>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{members.filter(m => m.is_resident).length}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Residenti</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 16 }}>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{members.filter(m => m.email).length}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Con Email</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}>
        <input className="input" placeholder="🔍 Cerca nome, telefono, email..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200, height: 38, fontSize: 13 }} />
        {stores.length > 1 && (
          <select className="input" value={storeFilter} onChange={e => setStoreFilter(e.target.value)} style={{ height: 38, fontSize: 13, minWidth: 180 }}>
            <option value="all">{t('dash.allStores')}</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      {/* Members table */}
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-default)', background: 'var(--bg-surface)' }}>
              <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, fontSize: 12, color: 'var(--text-secondary)' }}>{t('name')}</th>
              <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, fontSize: 12, color: 'var(--text-secondary)' }}>{t('phone')}</th>
              <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, fontSize: 12, color: 'var(--text-secondary)' }}>Email</th>
              <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, fontSize: 12, color: 'var(--text-secondary)' }}>{t('sales.nationality')}</th>
              <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 600, fontSize: 12, color: 'var(--text-secondary)' }}>Residente</th>
              <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 600, fontSize: 12, color: 'var(--text-secondary)' }}>{t('members.points')}</th>
              <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 600, fontSize: 12, color: 'var(--text-secondary)' }}>🎁</th>
              <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, fontSize: 12, color: 'var(--text-secondary)' }}>Store</th>
              <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, fontSize: 12, color: 'var(--text-secondary)' }}>Fonte</th>
              <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, fontSize: 12, color: 'var(--text-secondary)' }}>{t('date')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)' }}>Nessun membro trovato</td></tr>
            )}
            {filtered.map(m => (
              <tr key={m.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '10px 14px', fontWeight: 600 }}>{m.customer_name}</td>
                <td style={{ padding: '10px 14px' }}>
                  <a href={`tel:${m.phone}`} style={{ color: 'var(--brand-primary)', textDecoration: 'none' }}>{m.phone}</a>
                </td>
                <td style={{ padding: '10px 14px' }}>
                  {m.email ? <a href={`mailto:${m.email}`} style={{ color: 'var(--accent-blue)', textDecoration: 'none' }}>{m.email}</a> : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                </td>
                <td style={{ padding: '10px 14px' }}>{m.nationality || '—'}</td>
                <td style={{ padding: '10px 14px', textAlign: 'center' }}>{m.is_resident ? '✅' : '❌'}</td>
                <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>{m.points || 0}</td>
                <td style={{ padding: '10px 14px', textAlign: 'center' }}>{Math.floor((m.points || 0) / 10) > 0 ? `🎁 ${Math.floor((m.points || 0) / 10)}` : '—'}</td>
                <td style={{ padding: '10px 14px', fontSize: 12 }}>{(m.stores as any)?.name || '—'}</td>
                <td style={{ padding: '10px 14px', fontSize: 12 }}>{m.how_found || '—'}</td>
                <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {new Date(m.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
