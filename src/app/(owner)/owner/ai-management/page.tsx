'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface KBItem {
  id?: string
  type: 'faq' | 'procedure' | 'product_info' | 'document'
  question?: string
  answer: string
  title?: string
  file_url?: string
  file_name?: string
  file_size?: number
  is_active: boolean
}

const DEFAULT_FAQS: KBItem[] = [
  { type: 'faq', question: 'Come gestisco un reso senza scontrino?', answer: 'Chiedi un documento d\'identita al cliente, verifica nel sistema tramite nome cliente. Se trovi la transazione procedi con il reso, altrimenti offri un buono sostitutivo dello stesso valore.', is_active: true },
  { type: 'faq', question: 'Cosa faccio se il POS non funziona?', answer: 'Prova a riavviare il terminale. Se il problema persiste, accetta solo contanti e annota le vendite. Contatta il supporto tecnico.', is_active: true },
  { type: 'procedure', title: 'Apertura Negozio', answer: 'Checklist apertura: 1) Controlla FCE in cassa, 2) Accendi tutti i sistemi, 3) Controlla le scorte minime, 4) Pulisci l\'area vendita.', is_active: true },
]

export default function ManageAIPage() {
  const router = useRouter()
  const supabase = createClient()

  const [items, setItems] = useState<KBItem[]>([])
  const [storeId, setStoreId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'faq' | 'procedure' | 'documents' | 'stats'>('faq')
  const [showForm, setShowForm] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [form, setForm] = useState<KBItem>({ type: 'faq', question: '', answer: '', title: '', is_active: true })
  const [stats, setStats] = useState({ faq: 0, procedures: 0, products: 0, docs: 0 })
  const [uploading, setUploading] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadDesc, setUploadDesc] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase.from('users').select('store_id, role').eq('id', user.id).single()
    if (profile?.role !== 'owner') { router.push('/login'); return }
    setStoreId(profile.store_id)

    const { data: kb } = await supabase.from('ai_knowledge_base').select('*').eq('store_id', profile.store_id).order('sort_order')

    if (!kb || kb.length === 0) {
      // Seed default items
      if (profile.store_id) {
        await supabase.from('ai_knowledge_base').insert(
          DEFAULT_FAQS.map((item, i) => ({ ...item, store_id: profile.store_id, sort_order: i }))
        )
        const { data: newKb } = await supabase.from('ai_knowledge_base').select('*').eq('store_id', profile.store_id)
        setItems(newKb ?? [])
      }
    } else {
      setItems(kb)
    }

    setStats({
      faq: (kb ?? []).filter(i => i.type === 'faq').length,
      procedures: (kb ?? []).filter(i => i.type === 'procedure').length,
      products: (kb ?? []).filter(i => i.type === 'product_info').length,
      docs: (kb ?? []).filter(i => i.type === 'document').length,
    })
    setLoading(false)
  }

  async function saveItem() {
    if (!storeId || !form.answer.trim()) return
    setSaving(true)

    const payload = { ...form, store_id: storeId, sort_order: items.length }

    if ((form as any).id) {
      await supabase.from('ai_knowledge_base').update(payload).eq('id', (form as any).id)
    } else {
      await supabase.from('ai_knowledge_base').insert(payload)
    }

    setShowForm(false)
    setForm({ type: 'faq', question: '', answer: '', title: '', is_active: true })
    await loadData()
    setSaving(false)
  }

  async function toggleItem(id: string, current: boolean) {
    await supabase.from('ai_knowledge_base').update({ is_active: !current }).eq('id', id)
    loadData()
  }

  async function deleteItem(id: string) {
    const item = items.find(i => i.id === id)
    // Delete file from storage if document
    if (item?.type === 'document' && (item as any).file_url) {
      const path = (item as any).file_url.split('/ai-docs/').pop()
      if (path) await supabase.storage.from('ai-docs').remove([path])
    }
    await supabase.from('ai_knowledge_base').delete().eq('id', id)
    loadData()
  }

  async function uploadDocument() {
    if (!storeId || !uploadFile || !uploadTitle.trim()) return
    setUploading(true)

    const ext = uploadFile.name.split('.').pop()?.toLowerCase() || 'bin'
    const path = `${storeId}/${Date.now()}_${uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

    const { data: uploaded, error: uploadError } = await supabase.storage.from('ai-docs').upload(path, uploadFile)

    if (uploadError) {
      alert(`Errore upload: ${uploadError.message}`)
      setUploading(false)
      return
    }

    const { data: urlData } = supabase.storage.from('ai-docs').getPublicUrl(path)

    // Read text content for TXT files
    let content = `Documento: ${uploadTitle}. File: ${uploadFile.name} (${formatFileSize(uploadFile.size)})`
    if (['txt', 'md', 'csv'].includes(ext)) {
      try {
        content = await uploadFile.text()
        if (content.length > 5000) content = content.substring(0, 5000) + '\n... (troncato)'
      } catch { /* keep default */ }
    }
    if (uploadDesc.trim()) content = `${uploadDesc}\n\n${content}`

    await supabase.from('ai_knowledge_base').insert({
      store_id: storeId,
      type: 'document',
      title: uploadTitle.trim(),
      answer: content,
      file_url: urlData.publicUrl,
      file_name: uploadFile.name,
      file_size: uploadFile.size,
      sort_order: items.length,
      is_active: true,
    })

    setShowUpload(false)
    setUploadFile(null)
    setUploadTitle('')
    setUploadDesc('')
    if (fileRef.current) fileRef.current.value = ''
    setUploading(false)
    loadData()
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function getFileIcon(name: string) {
    const ext = name?.split('.').pop()?.toLowerCase() || ''
    if (['pdf'].includes(ext)) return '📕'
    if (['doc', 'docx'].includes(ext)) return '📘'
    if (['txt', 'md'].includes(ext)) return '📝'
    if (['xls', 'xlsx', 'csv'].includes(ext)) return '📊'
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return '🖼️'
    return '📎'
  }

  const filtered = items.filter(i => {
    if (activeTab === 'faq') return i.type === 'faq'
    if (activeTab === 'procedure') return i.type === 'procedure' || i.type === 'product_info'
    if (activeTab === 'documents') return i.type === 'document'
    return true
  })

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>Caricamento...</div>

  return (
    <div>
      {showForm && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 560 }}>
            <h3 style={{ marginBottom: 'var(--space-xl)' }}>
              {(form as any).id ? 'Modifica' : 'Aggiungi'} {form.type === 'faq' ? 'FAQ' : 'Procedura'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div className="input-group">
                <label className="input-label">Tipo</label>
                <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}>
                  <option value="faq">FAQ  Domanda & Risposta</option>
                  <option value="procedure">Procedura Operativa</option>
                  <option value="product_info">Info Prodotto</option>
                </select>
              </div>
              {form.type === 'faq' ? (
                <div className="input-group">
                  <label className="input-label">Domanda *</label>
                  <input className="input" placeholder="Es. Come gestisco un reso?" value={form.question ?? ''} onChange={e => setForm(f => ({ ...f, question: e.target.value }))} />
                </div>
              ) : (
                <div className="input-group">
                  <label className="input-label">Titolo *</label>
                  <input className="input" placeholder="Es. Apertura Negozio" value={form.title ?? ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                </div>
              )}
              <div className="input-group">
                <label className="input-label">Risposta / Contenuto *</label>
                <textarea className="input" rows={5} placeholder="Scrivi la risposta dettagliata..." value={form.answer} onChange={e => setForm(f => ({ ...f, answer: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-xl)' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowForm(false)}>Annulla</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={saveItem} disabled={saving || !form.answer.trim()}>
                {saving ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {showUpload && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 520 }}>
            <h3 style={{ marginBottom: 'var(--space-lg)' }}>📄 Carica Documento / Guida</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div className="input-group">
                <label className="input-label">Titolo *</label>
                <input className="input" placeholder="Es. Guida Apertura Negozio" value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">Descrizione (opzionale)</label>
                <textarea className="input" rows={3} placeholder="Descrivi il contenuto del documento..." value={uploadDesc} onChange={e => setUploadDesc(e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">File</label>
                <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt,.md,.csv,.xlsx,.xls,.jpg,.jpeg,.png,.webp" onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
                  style={{ padding: 10, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', width: '100%', fontSize: 14 }} />
              </div>
              {uploadFile && (
                <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{getFileIcon(uploadFile.name)}</span>
                  <div>
                    <div style={{ fontWeight: 600 }}>{uploadFile.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{formatFileSize(uploadFile.size)}</div>
                  </div>
                </div>
              )}
              <div style={{ background: '#F0FDF4', border: '1px solid var(--success)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 12, color: '#166534' }}>
                💡 <strong>Formati supportati:</strong> PDF, Word, TXT, Excel, CSV, Immagini. I file di testo vengono letti automaticamente e inseriti nella knowledge base AI.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-xl)' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setShowUpload(false); setUploadFile(null) }}>Annulla</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={uploadDocument} disabled={uploading || !uploadFile || !uploadTitle.trim()}>
                {uploading ? 'Caricamento...' : '📤 Carica Documento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-xl)' }}>
        <div>
          <h2>Gestione AI Dipendente</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>Configura la knowledge base dell'assistente AI per i tuoi dipendenti</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <button className="btn btn-secondary" onClick={() => setShowUpload(true)}>📄 Carica File</button>
          <button className="btn btn-primary" onClick={() => { setForm({ type: activeTab === 'faq' ? 'faq' : activeTab === 'documents' ? 'faq' : 'procedure', question: '', answer: '', title: '', is_active: true }); setShowForm(true) }}>
            + Aggiungi
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
        {[
          { label: 'FAQ', value: stats.faq, icon: '' },
          { label: 'Procedure', value: stats.procedures, icon: '' },
          { label: 'Prodotti', value: stats.products, icon: '' },
          { label: 'Documenti', value: stats.docs, icon: '' },
        ].map(s => (
          <div key={s.label} className="kpi-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="kpi-label">{s.label}</div>
                <div className="kpi-value">{s.value}</div>
              </div>
              <span style={{ fontSize: 28, opacity: 0.6 }}>{s.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="toggle-group" style={{ marginBottom: 'var(--space-lg)' }}>
        <button className={`toggle-option ${activeTab === 'faq' ? 'active' : ''}`} onClick={() => setActiveTab('faq')}>FAQ & Procedure</button>
        <button className={`toggle-option ${activeTab === 'procedure' ? 'active' : ''}`} onClick={() => setActiveTab('procedure')}>Info Prodotti</button>
        <button className={`toggle-option ${activeTab === 'documents' ? 'active' : ''}`} onClick={() => setActiveTab('documents')}>📄 Documenti ({stats.docs})</button>
        <button className={`toggle-option ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>Statistiche</button>
      </div>

      {activeTab === 'stats' ? (
        <div className="card">
          <h4 style={{ marginBottom: 'var(--space-lg)' }}>Utilizzo AI Dipendenti</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-lg)', marginBottom: 'var(--space-xl)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, fontWeight: 700, fontFamily: 'var(--font-heading)', color: 'var(--brand-primary)' }}>47</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Domande questa settimana</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, fontWeight: 700, fontFamily: 'var(--font-heading)', color: 'var(--brand-primary)' }}>89%</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Tasso di risoluzione</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>Resi</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Domanda piu frequente</div>
            </div>
          </div>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: 'var(--space-lg)' }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Anteprima Risposta AI</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Q: Come gestisco un reso?</div>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-primary)' }}>
              {items.find(i => i.type === 'faq' && i.question?.toLowerCase().includes('reso'))?.answer ?? 'Nessuna FAQ configurata su questo argomento.'}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-tertiary)' }}>
              Nessuna voce configurata. Aggiungi la prima!
            </div>
          )}
          {filtered.map(item => (
            <div key={item.id} className="card" style={{ opacity: item.is_active ? 1 : 0.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                  <span className={`badge ${item.type === 'faq' ? 'badge-blue' : item.type === 'procedure' ? 'badge-brand' : item.type === 'document' ? 'badge-warning' : 'badge-indigo'}`} style={{ fontSize: 10 }}>
                    {item.type === 'faq' ? 'FAQ' : item.type === 'procedure' ? 'Procedura' : item.type === 'document' ? '📄 Documento' : 'Prodotto'}
                  </span>
                  {!item.is_active && <span className="badge badge-gray" style={{ fontSize: 10 }}>Disattiva</span>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {item.type !== 'document' && <button onClick={() => { setForm(item as any); setShowForm(true) }} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }}>Modifica</button>}
                  {(item as any).file_url && <a href={(item as any).file_url} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12, textDecoration: 'none' }}>⬇ Scarica</a>}
                  <button onClick={() => toggleItem(item.id!, item.is_active)} className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '4px 8px' }}>
                    {item.is_active ? 'Disattiva' : 'Attiva'}
                  </button>
                  <button onClick={() => deleteItem(item.id!)} className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--danger)', padding: '4px 8px' }}>🗑️</button>
                </div>
              </div>
              {item.type === 'document' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                  <span style={{ fontSize: 28 }}>{getFileIcon((item as any).file_name || '')}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{(item as any).file_name} · {formatFileSize((item as any).file_size || 0)}</div>
                    {item.answer && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.4 }}>{item.answer.substring(0, 150)}{item.answer.length > 150 ? '...' : ''}</div>}
                  </div>
                </div>
              ) : (
                <>
                  {item.question && <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 14 }}>D: {item.question}</div>}
                  {item.title && <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 14 }}>{item.title}</div>}
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.answer}</div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
