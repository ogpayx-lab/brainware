'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatTime } from '@/lib/utils'
import { BottomNav } from '@/components/employee/BottomNav'

interface Photo {
  id: string
  storage_path: string
  caption: string | null
  created_at: string
  url: string
}

export default function PhotosPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [photos, setPhotos] = useState<Photo[]>([])
  const [caption, setCaption] = useState('')
  const [shiftId, setShiftId] = useState<string | null>(null)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
    if (!user) { router.push('/login'); return }
    setUserId(user.id)

    const { data: profile } = await supabase.from('users').select('store_id').eq('id', user.id).single()
    if (!profile?.store_id) return
    setStoreId(profile.store_id)

    const { data: shift } = await supabase.from('shifts').select('id').eq('user_id', user.id).eq('status', 'open').order('created_at',{ascending:false}).limit(1).single()
    if (!shift) { router.push('/employee/shift/open'); return }
    setShiftId(shift.id)

    const { data: photoData } = await supabase
      .from('photos').select('*').eq('shift_id', shift.id).order('created_at', { ascending: false })

    // Get signed URLs
    const withUrls = await Promise.all((photoData ?? []).map(async p => {
      const { data } = await supabase.storage.from('photos').createSignedUrl(p.storage_path, 3600)
      return { ...p, url: data?.signedUrl ?? '' }
    }))

    setPhotos(withUrls)
    setLoading(false)
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingFile(file)
    const url = URL.createObjectURL(file)
    setPreview(url)
  }

  async function handleUpload() {
    if (!pendingFile || !shiftId || !storeId || !userId) return
    setUploading(true)

    const ext = pendingFile.name.split('.').pop() ?? 'jpg'
    const path = `${storeId}/${shiftId}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('photos')
      .upload(path, pendingFile, { contentType: pendingFile.type })

    if (!uploadError) {
      await supabase.from('photos').insert({
        shift_id: shiftId,
        store_id: storeId,
        user_id: userId,
        storage_path: path,
        caption: caption || null,
      })

      const { data: empProfile } = await supabase.from('users').select('full_name').eq('id', userId).single()
      await supabase.from('notifications').insert({
        store_id: storeId,
        type: 'photo',
        title: '📸 Foto caricata',
        message: `${empProfile?.full_name || 'Dipendente'} ha caricato una foto${caption ? `: "${caption}"` : '.'}.`,
      })
    }

    setPendingFile(null)
    setPreview(null)
    setCaption('')
    if (fileRef.current) fileRef.current.value = ''
    await loadData()
    setUploading(false)
  }

  function cancelPreview() {
    setPendingFile(null)
    setPreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>Caricamento...</div>

  return (
    <div className="page" style={{ paddingBottom: 80 }}>
      <div style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-subtle)', padding: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
        <Link href="/employee/dashboard" style={{ textDecoration: 'none', color: 'var(--text-primary)', fontSize: 20 }}></Link>
        <h3>Foto Registro</h3>
      </div>

      <div style={{ padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

        {/* Upload area */}
        {!preview ? (
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              border: '2px dashed var(--border-default)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-2xl)',
              textAlign: 'center',
              cursor: 'pointer',
              background: 'var(--bg-primary)',
              transition: 'all var(--transition)',
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 'var(--space-md)' }}></div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Scatta o carica una foto</div>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Tocca per aprire la fotocamera o scegliere dalla galleria</div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </div>
        ) : (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <img
              src={preview}
              alt="Preview"
              style={{ width: '100%', borderRadius: 'var(--radius-md)', maxHeight: 300, objectFit: 'cover' }}
            />
            <div className="input-group">
              <label className="input-label">Didascalia (opzionale)</label>
              <input
                className="input"
                placeholder="Descrivi la foto..."
                value={caption}
                onChange={e => setCaption(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={cancelPreview}>Annulla</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleUpload} disabled={uploading}>
                {uploading ? 'Caricamento...' : ' Carica Foto'}
              </button>
            </div>
          </div>
        )}

        {/* Photo grid */}
        {photos.length > 0 && (
          <div>
            <h4 style={{ marginBottom: 'var(--space-md)' }}>Foto di Oggi ({photos.length})</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              {photos.map(photo => (
                <div key={photo.id} style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                  {photo.url && (
                    <img src={photo.url} alt={photo.caption ?? 'Foto'} style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />
                  )}
                  <div style={{ padding: 'var(--space-sm)' }}>
                    {photo.caption && <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{photo.caption}</div>}
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{formatTime(photo.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {photos.length === 0 && !preview && (
          <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 'var(--space-xl)' }}>
            Nessuna foto registrata per questo turno
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
