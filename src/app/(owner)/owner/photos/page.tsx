'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface PhotoItem {
  id: string
  storage_path: string
  caption: string | null
  created_at: string
  store_id: string
  user_id: string
  storeName: string
  employeeName: string
  url: string
}

export default function OwnerPhotosPage() {
  const router = useRouter()
  const supabase = createClient()
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [stores, setStores] = useState<any[]>([])
  const [selectedStore, setSelectedStore] = useState('all')
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7)
    return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)
  const [orgStoreIds, setOrgStoreIds] = useState<string[]>([])
  const [lightbox, setLightbox] = useState<PhotoItem | null>(null)

  useEffect(() => { loadStores() }, [])
  useEffect(() => { if (orgStoreIds.length > 0) loadPhotos() }, [selectedStore, dateFrom, dateTo, orgStoreIds])

  async function loadStores() {
    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('users').select('store_id, role').eq('id', user.id).single()
    if (profile?.role !== 'owner') { router.push('/login'); return }
    const { data: myStore } = await supabase.from('stores').select('organization_id').eq('id', profile.store_id).single()
    const oid = myStore?.organization_id
    const { data: storeList } = await supabase.from('stores').select('id,name').eq('organization_id', oid).eq('is_active', true).order('name')
    const allStores = storeList ?? []
    setStores(allStores)
    setOrgStoreIds(allStores.map(s => s.id))
    setLoading(false)
  }

  async function loadPhotos() {
    setLoading(true)
    const fromDate = `${dateFrom}T00:00:00`
    const toDate = `${dateTo}T23:59:59`
    const storeIds = selectedStore === 'all' ? orgStoreIds : [selectedStore]

    const { data: photosData } = await supabase
      .from('photos')
      .select('id, storage_path, caption, created_at, store_id, user_id, users(full_name), stores(name)')
      .in('store_id', storeIds)
      .gte('created_at', fromDate)
      .lte('created_at', toDate)
      .order('created_at', { ascending: false })
      .limit(200)

    // Get signed URLs
    const items: PhotoItem[] = []
    for (const p of (photosData ?? [])) {
      const { data: urlData } = await supabase.storage.from('photos').createSignedUrl(p.storage_path, 3600)
      items.push({
        id: p.id,
        storage_path: p.storage_path,
        caption: p.caption,
        created_at: p.created_at,
        store_id: p.store_id,
        user_id: p.user_id,
        storeName: (p.stores as any)?.name || '',
        employeeName: (p.users as any)?.full_name || '',
        url: urlData?.signedUrl ?? '',
      })
    }

    setPhotos(items)
    setLoading(false)
  }

  // Group photos by date
  const groupedByDate: Record<string, PhotoItem[]> = {}
  for (const p of photos) {
    const dateKey = new Date(p.created_at).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    if (!groupedByDate[dateKey]) groupedByDate[dateKey] = []
    groupedByDate[dateKey].push(p)
  }

  if (loading && stores.length === 0) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-secondary)' }}>Caricamento...</div>

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>📸 Foto Registro</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Foto del registro cartaceo — per negozio e data</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>{photos.length}</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>foto totali</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '10px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>Negozio:</label>
          <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)}
            className="input" style={{ fontSize: 12, padding: '4px 8px', minWidth: 140 }}>
            <option value="all">Tutti i negozi</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div style={{ width: 1, height: 20, background: 'var(--border-default)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>Da:</label>
          <input type="date" className="input" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ fontSize: 12, padding: '4px 8px' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>A:</label>
          <input type="date" className="input" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{ fontSize: 12, padding: '4px 8px' }} />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>Caricamento foto...</div>
      ) : photos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📷</div>
          <h3 style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>Nessuna foto trovata</h3>
          <p style={{ fontSize: 13 }}>Prova a cambiare il periodo o il negozio selezionato.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {Object.entries(groupedByDate).map(([dateLabel, datePhotos]) => (
            <div key={dateLabel}>
              {/* Date header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{dateLabel}</div>
                <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>{datePhotos.length} foto</span>
              </div>

              {/* Photo grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                {datePhotos.map(photo => (
                  <div
                    key={photo.id}
                    onClick={() => setLightbox(photo)}
                    style={{
                      borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-primary)', cursor: 'pointer',
                      transition: 'transform 0.15s, box-shadow 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none' }}
                  >
                    {photo.url ? (
                      <img src={photo.url} alt={photo.caption || 'Foto registro'} loading="lazy"
                        style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }} />
                    ) : (
                      <div style={{ width: '100%', height: 200, background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
                        📷 Errore caricamento
                      </div>
                    )}
                    <div style={{ padding: '8px 10px' }}>
                      {photo.caption && <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{photo.caption}</div>}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-tertiary)' }}>
                        <span>{photo.storeName}</span>
                        <span>{new Date(photo.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                        👤 {photo.employeeName}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out', padding: 20,
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: 900, width: '100%', position: 'relative' }}>
            <button onClick={() => setLightbox(null)}
              style={{ position: 'absolute', top: -40, right: 0, background: 'none', border: 'none', color: 'white', fontSize: 28, cursor: 'pointer' }}>
              ✕
            </button>
            <img src={lightbox.url} alt={lightbox.caption || 'Foto'}
              style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: 8 }} />
            <div style={{ color: 'white', marginTop: 12, textAlign: 'center' }}>
              {lightbox.caption && <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{lightbox.caption}</div>}
              <div style={{ fontSize: 13, opacity: 0.7 }}>
                {lightbox.storeName} · {lightbox.employeeName} ·{' '}
                {new Date(lightbox.created_at).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}{' '}
                {new Date(lightbox.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
