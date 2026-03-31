'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface KBItem {
  id?: string
  type: 'faq' | 'procedure' | 'product_info' | 'document'
  question?: string
  answer: string
  title?: string
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
  const [activeTab, setActiveTab] = useState<'faq' | 'procedure' | 'stats'>('faq')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<KBItem>({ type: 'faq', question: '', answer: '', title: '', is_active: true })
  const [stats, setStats] = useState({ faq: 0, procedures: 0, products: 0, docs: 0 })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
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
    await supabase.from('ai_knowledge_base').delete().eq('id', id)
    loadData()
  }

  const filtered = items.filter(i => {
    if (activeTab === 'faq') return i.type === 'faq'
    if (activeTab === 'procedure') return i.type === 'procedure' || i.type === 'product_info'
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

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-xl)' }}>
        <div>
          <h2>Gestione AI Dipendente</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>Configura la knowledge base dell'assistente AI per i tuoi dipendenti</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <button className="btn btn-secondary" onClick={() => alert('Knowledge base pubblicata!')}>Pubblica Modifiche</button>
          <button className="btn btn-primary" onClick={() => { setForm({ type: activeTab === 'faq' ? 'faq' : 'procedure', question: '', answer: '', title: '', is_active: true }); setShowForm(true) }}>
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
        <button className={`toggle-option ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>Statistiche Utilizzo</button>
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
                  <span className={`badge ${item.type === 'faq' ? 'badge-blue' : item.type === 'procedure' ? 'badge-brand' : 'badge-indigo'}`} style={{ fontSize: 10 }}>
                    {item.type === 'faq' ? 'FAQ' : item.type === 'procedure' ? 'Procedura' : 'Prodotto'}
                  </span>
                  {!item.is_active && <span className="badge badge-gray" style={{ fontSize: 10 }}>Disattiva</span>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => { setForm(item as any); setShowForm(true) }} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }}>Modifica</button>
                  <button onClick={() => toggleItem(item.id!, item.is_active)} className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '4px 8px' }}>
                    {item.is_active ? 'Disattiva' : 'Attiva'}
                  </button>
                  <button onClick={() => deleteItem(item.id!)} className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--danger)', padding: '4px 8px' }}></button>
                </div>
              </div>
              {item.question && <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 14 }}>D: {item.question}</div>}
              {item.title && <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 14 }}>{item.title}</div>}
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.answer}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
