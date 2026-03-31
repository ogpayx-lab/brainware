'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'

const SA_CARD = { background: '#1E293B', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 } as React.CSSProperties
const SA_TH = { fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', padding: '10px 16px', textAlign: 'left' as const, background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)' }
const SA_TD = { padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 14, color: 'rgba(255,255,255,0.8)' }

const PLAN_COLORS: Record<string, string> = { enterprise: '#8B5CF6', pro: '#3B82F6', trial: '#F59E0B' }

export default function SuperAdminOwnersPage() {
  const router = useRouter()
  const supabase = createClient()
  const [owners, setOwners] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filterPlan, setFilterPlan] = useState('all')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', password: '', plan: 'pro', store_name: '', store_city: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/superadmin/login'); return }

    const { data: owners } = await supabase
      .from('users')
      .select('*, stores(name, city, organizations(name, plan, slug))')
      .eq('role', 'owner')
      .order('created_at', { ascending: false })

    setOwners(owners ?? [])
    setLoading(false)
  }

  async function createOwner() {
    if (!form.full_name || !form.email || !form.password || !form.store_name) return
    setSaving(true); setError(null)

    // 1. Crea organizzazione
    const slug = form.store_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const { data: org } = await supabase.from('organizations').insert({
      name: form.store_name, slug: slug + '-' + Date.now(), plan: form.plan
    }).select('id').single()

    if (!org) { setError('Errore creazione organizzazione'); setSaving(false); return }

    // 2. Crea store
    const { data: store } = await supabase.from('stores').insert({
      name: form.store_name, city: form.store_city || null, organization_id: org.id
    }).select('id').single()

    if (!store) { setError('Errore creazione store'); setSaving(false); return }

    // 3. Brand + store config
    await supabase.from('brand_config').insert({ store_id: store.id, brand_name: form.store_name, logo_letter: form.store_name[0].toUpperCase() })
    await supabase.from('store_config').insert({ store_id: store.id })
    await supabase.from('bonus_config').insert({ store_id: store.id })

    setShowForm(false)
    setForm({ full_name: '', email: '', password: '', plan: 'pro', store_name: '', store_city: '' })
    setSaving(false)
    alert(`Owner creato! Vai su Supabase Auth  Users per creare l'account con email: ${form.email} e poi esegui:\n\nINSERT INTO users (id, store_id, full_name, role)\nVALUES ('<auth-user-id>', '${store.id}', '${form.full_name}', 'owner');`)
    await loadData()
  }

  async function toggleOwnerStatus(userId: string, current: boolean) {
    await supabase.from('users').update({ is_active: !current }).eq('id', userId)
    loadData()
  }

  const filtered = owners.filter(o => {
    const matchSearch = !search || o.full_name?.toLowerCase().includes(search.toLowerCase()) || o.store_id
    return matchSearch
  })

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><div style={{ color: 'rgba(255,255,255,0.4)' }}>Caricamento...</div></div>

  return (
    <div>
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 24 }}>
          <div style={{ ...SA_CARD, width: '100%', maxWidth: 520 }}>
            <h3 style={{ color: 'white', fontWeight: 700, marginBottom: 20 }}>Nuovo Owner</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Nome Completo *', key: 'full_name', placeholder: 'Mario Rossi' },
                { label: 'Email *', key: 'email', placeholder: 'owner@email.it', type: 'email' },
                { label: 'Password Temporanea *', key: 'password', placeholder: '', type: 'password' },
                { label: 'Nome Negozio/Brand *', key: 'store_name', placeholder: 'MamaMary Milano' },
                { label: 'Citta', key: 'store_city', placeholder: 'Milano' },
              ].map(f => (
                <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{f.label}</label>
                  <input type={f.type ?? 'text'} placeholder={f.placeholder} value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: 'white', outline: 'none' }} />
                </div>
              ))}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Piano</label>
                <select value={form.plan} onChange={e => setForm(p => ({ ...p, plan: e.target.value }))}
                  style={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: 'white', outline: 'none' }}>
                  <option value="trial">Trial</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              {error && <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 8, padding: '10px', fontSize: 13, color: '#FCA5A5' }}>{error}</div>}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'rgba(255,255,255,0.6)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Annulla</button>
              <button onClick={createOwner} disabled={saving} style={{ flex: 2, padding: '10px', background: '#22C55E', border: 'none', borderRadius: 8, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                {saving ? 'Creazione...' : 'Crea Owner'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ color: 'white', fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700 }}>Gestione Owners</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 4 }}>Crea e gestisci gli account proprietari</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'rgba(255,255,255,0.6)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)' }}> Esporta</button>
          <button onClick={() => setShowForm(true)} style={{ padding: '8px 16px', background: '#22C55E', border: 'none', borderRadius: 8, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>+ Nuovo Owner</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca owner..."
          style={{ flex: 1, background: '#1E293B', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: 'white', outline: 'none' }} />
        <select value={filterPlan} onChange={e => setFilterPlan(e.target.value)}
          style={{ background: '#1E293B', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: 'rgba(255,255,255,0.7)', outline: 'none', minWidth: 140 }}>
          <option value="all">Piano: Tutti</option>
          <option value="trial">Trial</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ ...SA_CARD, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Owner', 'Email', 'Negozi', 'Piano', 'Stato', 'Azioni'].map(h => <th key={h} style={SA_TH}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ ...SA_TD, textAlign: 'center', color: 'rgba(255,255,255,0.2)', padding: '32px' }}>Nessun owner trovato</td></tr>
            )}
            {filtered.map(owner => {
              const store = Array.isArray(owner.stores) ? owner.stores[0] : owner.stores
              const plan = store?.organizations?.plan ?? 'trial'
              const planColor = PLAN_COLORS[plan] ?? '#6B7280'
              return (
                <tr key={owner.id}>
                  <td style={SA_TD}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                        {owner.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) ?? 'OW'}
                      </div>
                      <div>
                        <div style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>{owner.full_name}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                          {owner.hired_at ? `Dal ${formatDate(owner.hired_at)}` : owner.created_at ? `Registrato: ${formatDate(owner.created_at)}` : ''}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ ...SA_TD, color: 'rgba(255,255,255,0.5)' }}></td>
                  <td style={SA_TD}>{store?.name ?? ''}</td>
                  <td style={SA_TD}>
                    <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: planColor + '22', color: planColor, fontWeight: 700, textTransform: 'capitalize' }}>{plan}</span>
                  </td>
                  <td style={SA_TD}>
                    <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: owner.is_active ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.2)', color: owner.is_active ? '#22C55E' : 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
                      {owner.is_active ? 'Attivo' : 'Sospeso'}
                    </span>
                  </td>
                  <td style={SA_TD}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => toggleOwnerStatus(owner.id, owner.is_active)}
                        style={{ padding: '5px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: owner.is_active ? '#FCA5A5' : '#22C55E', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                        {owner.is_active ? 'Sospendi' : 'Riattiva'}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
          Mostrando {filtered.length} di {owners.length} owners
        </div>
      </div>
    </div>
  )
}
