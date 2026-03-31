'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'

const SA_CARD = { background: '#1E293B', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 } as React.CSSProperties
const SA_TH = { fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', padding: '10px 16px', textAlign: 'left' as const, background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)' }
const SA_TD = { padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 14, color: 'rgba(255,255,255,0.8)' }

const TYPE_COLORS: Record<string, string> = { Retail: '#3B82F6', H24: '#8B5CF6', Vending: '#F59E0B', Online: '#22C55E' }

export default function SuperAdminStoresPage() {
  const router = useRouter()
  const supabase = createClient()
  const [stores, setStores] = useState<any[]>([])
  const [owners, setOwners] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filterOwner, setFilterOwner] = useState('all')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', address: '', city: '', owner_id: '', type: 'Retail' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/superadmin/login'); return }

    const [{ data: storeData }, { data: ownerData }] = await Promise.all([
      supabase.from('stores').select('*, organizations(name, plan), users!store_id(full_name, role)').eq('users.role', 'owner').order('name'),
      supabase.from('users').select('id, full_name, store_id').eq('role', 'owner').eq('is_active', true),
    ])

    setStores(storeData ?? [])
    setOwners(ownerData ?? [])
    setLoading(false)
  }

  async function toggleStore(id: string, current: boolean) {
    await supabase.from('stores').update({ is_active: !current }).eq('id', id)
    loadData()
  }

  const filtered = stores.filter(s => {
    const matchSearch = !search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.city?.toLowerCase().includes(search.toLowerCase())
    const matchOwner = filterOwner === 'all' || s.users?.some((u: any) => u.full_name === filterOwner)
    return matchSearch && matchOwner
  })

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><div style={{ color: 'rgba(255,255,255,0.4)' }}>Caricamento...</div></div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ color: 'white', fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700 }}>Gestione Negozi</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 4 }}>Crea negozi e associali agli owner  {stores.length} negozi totali</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{ padding: '8px 16px', background: '#22C55E', border: 'none', borderRadius: 8, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
          + Nuovo Negozio
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca negozio o citta..."
          style={{ flex: 1, background: '#1E293B', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: 'white', outline: 'none' }} />
        <select value={filterOwner} onChange={e => setFilterOwner(e.target.value)}
          style={{ background: '#1E293B', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: 'rgba(255,255,255,0.7)', outline: 'none', minWidth: 180 }}>
          <option value="all">Owner: Tutti</option>
          {owners.map(o => <option key={o.id} value={o.full_name}>{o.full_name}</option>)}
        </select>
        <select style={{ background: '#1E293B', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: 'rgba(255,255,255,0.7)', outline: 'none', minWidth: 140 }}>
          <option>Tipo: Tutti</option>
          <option>Retail</option><option>H24</option><option>Vending</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ ...SA_CARD, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['Negozio', 'Indirizzo', 'Owner Associato', 'Tipo', 'Stato', 'Azioni'].map(h => <th key={h} style={SA_TH}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ ...SA_TD, textAlign: 'center', color: 'rgba(255,255,255,0.2)', padding: '32px' }}>Nessun negozio trovato</td></tr>
            )}
            {filtered.map(store => {
              const owner = Array.isArray(store.users) ? store.users.find((u: any) => u.role === 'owner') : null
              const type = 'Retail'
              const typeColor = TYPE_COLORS[type] ?? '#6B7280'
              return (
                <tr key={store.id}>
                  <td style={SA_TD}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: typeColor + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: typeColor }}>
                        {store.name?.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ color: 'white', fontWeight: 600 }}>{store.name}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{store.organizations?.name ?? ''}  {store.organizations?.plan ?? ''}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ ...SA_TD, color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
                    {store.address ? `${store.address}, ${store.city ?? ''}` : store.city ?? ''}
                  </td>
                  <td style={SA_TD}>
                    {owner ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white' }}>
                          {owner.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                        </div>
                        <span>{owner.full_name}</span>
                      </div>
                    ) : <span style={{ color: 'rgba(255,255,255,0.2)' }}>Non assegnato</span>}
                  </td>
                  <td style={SA_TD}>
                    <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: typeColor + '22', color: typeColor, fontWeight: 600 }}>{type}</span>
                  </td>
                  <td style={SA_TD}>
                    <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: store.is_active ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.2)', color: store.is_active ? '#22C55E' : 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
                      {store.is_active ? 'Attivo' : 'Inattivo'}
                    </span>
                  </td>
                  <td style={SA_TD}>
                    <button onClick={() => toggleStore(store.id, store.is_active)}
                      style={{ padding: '5px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: store.is_active ? '#FCA5A5' : '#22C55E', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                      {store.is_active ? 'Disabilita' : 'Riabilita'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
          Mostrando {filtered.length} di {stores.length} negozi
        </div>
      </div>
    </div>
  )
}
