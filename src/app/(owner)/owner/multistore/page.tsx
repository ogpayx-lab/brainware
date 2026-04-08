'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmt, formatDate } from '@/lib/utils'

export default function MultistorePage() {
  const router = useRouter()
  const supabase = createClient()
  const [storeId, setStoreId] = useState<string | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [stores, setStores] = useState<any[]>([])
  const [storeStats, setStoreStats] = useState<Record<string, { employees: number; products: number; sales: number }>>({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', city: '', address: '', phone: '', email: '' })
  const [brand, setBrand] = useState({ brand_name: 'BrainWare', logo_letter: 'B', primary_color: '#22C55E' })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('users').select('store_id, role, stores(organization_id)').eq('id', user.id).single()
    if (profile?.role !== 'owner') { router.push('/login'); return }
    setStoreId(profile.store_id)
    const oid = (profile.stores as any)?.organization_id
    setOrgId(oid)

    // Brand config
    const { data: brandData } = await supabase.from('brand_config').select('brand_name,logo_letter,primary_color').eq('store_id', profile.store_id).single()
    if (brandData) setBrand(brandData)

    // All stores in org
    if (oid) {
      const { data: storesData } = await supabase.from('stores').select('*').eq('organization_id', oid).order('created_at')
      setStores(storesData ?? [])

      // Stats per store
      const stats: Record<string, any> = {}
      for (const s of (storesData ?? [])) {
        const [{ count: empCount }, { count: prodCount }, { count: salesCount }] = await Promise.all([
          supabase.from('users').select('id', { count: 'exact', head: true }).eq('store_id', s.id).eq('role', 'employee'),
          supabase.from('products').select('id', { count: 'exact', head: true }).eq('store_id', s.id),
          supabase.from('sales').select('id', { count: 'exact', head: true }).eq('store_id', s.id).eq('movement_type', 'sale'),
        ])
        stats[s.id] = { employees: empCount ?? 0, products: prodCount ?? 0, sales: salesCount ?? 0 }
      }
      setStoreStats(stats)
    }
    setLoading(false)
  }

  async function addStore() {
    if (!orgId || !form.name) return
    setSaving(true)
    const { data: st } = await supabase.from('stores').insert({
      name: form.name, city: form.city || null, address: form.address || null, organization_id: orgId,
    }).select('id').single()
    if (st) {
      await Promise.all([
        supabase.from('brand_config').insert({ store_id: st.id, brand_name: brand.brand_name, logo_letter: brand.logo_letter, primary_color: brand.primary_color }),
        supabase.from('store_config').insert({ store_id: st.id }),
        supabase.from('bonus_config').insert({ store_id: st.id }),
      ])
    }
    setShowForm(false)
    setForm({ name: '', city: '', address: '', phone: '', email: '' })
    setSaving(false)
    loadData()
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>Caricamento...</div>

  return (
    <div>
      {/* Add Store Modal */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 500 }}>
            <h3 style={{ marginBottom: 'var(--space-xl)' }}>➕ Nuovo Store</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div className="input-group"><label className="input-label">Nome Store *</label><input className="input" placeholder="Store Via Roma" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-md)' }}>
                <div className="input-group"><label className="input-label">Indirizzo</label><input className="input" placeholder="Via Roma 42" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
                <div className="input-group"><label className="input-label">Città</label><input className="input" placeholder="Catania" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                <div className="input-group"><label className="input-label">Telefono</label><input className="input" type="tel" placeholder="+39 095 123456" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
                <div className="input-group"><label className="input-label">Email</label><input className="input" type="email" placeholder="store@brand.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              </div>
              <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#92400E' }}>
                💡 Lo store erediterà il branding e le configurazioni base. Potrai personalizzarle dopo la creazione.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-xl)' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowForm(false)}>Annulla</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={addStore} disabled={saving || !form.name}>{saving ? 'Creazione...' : '🏪 Crea Store'}</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-xl)' }}>
        <div>
          <h2>🏪 Multistore</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>{stores.length} store nella tua organizzazione</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Aggiungi Store</button>
      </div>

      {/* Summary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
        <div className="kpi-card">
          <div className="kpi-label">Store Totali</div>
          <div className="kpi-value">{stores.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Dipendenti Totali</div>
          <div className="kpi-value">{Object.values(storeStats).reduce((s, v) => s + v.employees, 0)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Prodotti Totali</div>
          <div className="kpi-value">{Object.values(storeStats).reduce((s, v) => s + v.products, 0)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Vendite Totali</div>
          <div className="kpi-value">{Object.values(storeStats).reduce((s, v) => s + v.sales, 0)}</div>
        </div>
      </div>

      {/* Store Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-lg)' }}>
        {stores.map(s => {
          const stats = storeStats[s.id] || { employees: 0, products: 0, sales: 0 }
          const isPrimary = s.id === storeId
          return (
            <div key={s.id} className="card" style={{ border: isPrimary ? `2px solid ${brand.primary_color}` : undefined, position: 'relative' }}>
              {isPrimary && (
                <div style={{ position: 'absolute', top: 12, right: 12 }}>
                  <span className="badge badge-brand" style={{ fontSize: 10 }}>⭐ Principale</span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: brand.primary_color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🏪</div>
                <div>
                  <h4>{s.name}</h4>
                  {(s.address || s.city) && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      📍 {[s.address, s.city].filter(Boolean).join(', ')}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
                <div style={{ background: 'var(--bg-surface)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>{stats.employees}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Dipendenti</div>
                </div>
                <div style={{ background: 'var(--bg-surface)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>{stats.products}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Prodotti</div>
                </div>
                <div style={{ background: 'var(--bg-surface)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>{stats.sales}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Vendite</div>
                </div>
              </div>

              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Creato: {formatDate(s.created_at)}</span>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 12px', fontSize: 12 }}
                  onClick={() => router.push('/owner/settings')}
                >
                  ⚙️ Configura
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {stores.length <= 1 && (
        <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', marginTop: 'var(--space-xl)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🚀</div>
          <h3>Espandi il tuo business</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 8, maxWidth: 400, margin: '8px auto 0' }}>
            Aggiungi nuovi store per gestire più negozi da un unico pannello. Ogni store avrà il suo inventario, dipendenti e report dedicati.
          </p>
        </div>
      )}
    </div>
  )
}
