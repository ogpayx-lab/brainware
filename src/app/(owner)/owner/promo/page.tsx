'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function PromoCodesPage() {
  const router = useRouter()
  const supabase = createClient()
  const [codes, setCodes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string|null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ code:'', description:'', type:'pct' as 'pct'|'fixed', value:'', expires_at:'', is_active:true })

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('users').select('store_id,role').eq('id', user.id).single()
    if (profile?.role !== 'owner') { router.push('/login'); return }
    setStoreId(profile.store_id)
    const { data } = await supabase.from('promo_codes').select('*').eq('store_id', profile.store_id).order('created_at', { ascending: false })
    setCodes(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function saveCode() {
    if (!storeId || !form.code || !form.value) return
    setSaving(true)
    await supabase.from('promo_codes').insert({
      store_id: storeId,
      code: form.code.toUpperCase().trim(),
      description: form.description,
      type: form.type,
      value: parseFloat(form.value),
      expires_at: form.expires_at || null,
      is_active: true,
    })
    setSaving(false)
    setShowForm(false)
    setForm({ code:'', description:'', type:'pct', value:'', expires_at:'', is_active:true })
    loadData()
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('promo_codes').update({ is_active: !current }).eq('id', id)
    loadData()
  }

  async function deleteCode(id: string) {
    if (!confirm('Eliminare questo codice promo?')) return
    await supabase.from('promo_codes').delete().eq('id', id)
    setCodes(prev => prev.filter(c => c.id !== id))
  }

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', color:'var(--text-secondary)' }}>Caricamento...</div>

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'var(--space-xl)' }}>
        <div>
          <h2>🎟️ Codici Promo</h2>
          <p style={{ color:'var(--text-secondary)', fontSize:14, marginTop:4 }}>
            Crea e gestisci i codici sconto da usare nel POS
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Nuovo Codice</button>
      </div>

      {codes.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:'var(--space-xl)', color:'var(--text-tertiary)' }}>
          <div style={{ fontSize:48, marginBottom:12 }}>🎟️</div>
          <div style={{ fontWeight:600, marginBottom:8 }}>Nessun codice promo</div>
          <div style={{ fontSize:13 }}>Crea il primo codice sconto per i tuoi clienti</div>
        </div>
      ) : (
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'var(--bg-surface)', borderBottom:'1px solid var(--border-subtle)' }}>
                <th style={{ padding:'10px 16px', textAlign:'left', fontSize:12, fontWeight:700, color:'var(--text-tertiary)' }}>CODICE</th>
                <th style={{ padding:'10px 16px', textAlign:'left', fontSize:12, fontWeight:700, color:'var(--text-tertiary)' }}>TIPO</th>
                <th style={{ padding:'10px 16px', textAlign:'left', fontSize:12, fontWeight:700, color:'var(--text-tertiary)' }}>VALORE</th>
                <th style={{ padding:'10px 16px', textAlign:'left', fontSize:12, fontWeight:700, color:'var(--text-tertiary)' }}>SCADENZA</th>
                <th style={{ padding:'10px 16px', textAlign:'left', fontSize:12, fontWeight:700, color:'var(--text-tertiary)' }}>STATO</th>
                <th style={{ padding:'10px 16px', textAlign:'left', fontSize:12, fontWeight:700, color:'var(--text-tertiary)' }}>AZIONI</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c, i) => (
                <tr key={c.id} style={{ borderBottom: i < codes.length-1 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <td style={{ padding:'12px 16px' }}>
                    <div style={{ fontFamily:'monospace', fontWeight:700, fontSize:15, color:'var(--brand-primary)' }}>{c.code}</div>
                    {c.description && <div style={{ fontSize:12, color:'var(--text-tertiary)', marginTop:2 }}>{c.description}</div>}
                  </td>
                  <td style={{ padding:'12px 16px' }}>
                    <span style={{ fontSize:12, fontWeight:600, color: c.type === 'pct' ? 'var(--accent-indigo)' : 'var(--warning)' }}>
                      {c.type === 'pct' ? '% Percentuale' : '€ Fisso'}
                    </span>
                  </td>
                  <td style={{ padding:'12px 16px', fontWeight:700, fontSize:15 }}>
                    {c.type === 'pct' ? `${c.value}%` : `€${c.value.toFixed(2)}`}
                  </td>
                  <td style={{ padding:'12px 16px', fontSize:13, color:'var(--text-secondary)' }}>
                    {c.expires_at ? new Date(c.expires_at).toLocaleDateString('it-IT') : '—'}
                  </td>
                  <td style={{ padding:'12px 16px' }}>
                    <span className={`badge ${c.is_active ? 'badge-success' : 'badge-gray'}`}>
                      {c.is_active ? '✅ Attivo' : '⏸ Disabilitato'}
                    </span>
                  </td>
                  <td style={{ padding:'12px 16px' }}>
                    <div style={{ display:'flex', gap:6 }}>
                      <button onClick={() => toggleActive(c.id, c.is_active)} className="btn btn-secondary" style={{ padding:'4px 10px', fontSize:12 }}>
                        {c.is_active ? 'Disabilita' : 'Abilita'}
                      </button>
                      <button onClick={() => deleteCode(c.id)} style={{ padding:'4px 10px', fontSize:12, background:'#FEF2F2', border:'1px solid var(--danger)', borderRadius:8, cursor:'pointer', color:'var(--danger)' }}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:'var(--space-lg)' }}>
          <div style={{ background:'var(--bg-primary)', borderRadius:'var(--radius-lg)', padding:'var(--space-xl)', width:'100%', maxWidth:440 }}>
            <h3 style={{ marginBottom:'var(--space-lg)' }}>🎟️ Nuovo Codice Promo</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-md)' }}>
              <div>
                <label className="input-label">Codice * (Es: SCONTO10)</label>
                <input className="input" placeholder="SCONTO10" value={form.code} onChange={e => setForm(f=>({...f,code:e.target.value.toUpperCase()}))} style={{ fontFamily:'monospace', fontWeight:700, letterSpacing:2 }} />
              </div>
              <div>
                <label className="input-label">Descrizione (opzionale)</label>
                <input className="input" placeholder="Es. Sconto benvenuto" value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--space-md)' }}>
                <div>
                  <label className="input-label">Tipo sconto</label>
                  <select className="input" value={form.type} onChange={e => setForm(f=>({...f,type:e.target.value as 'pct'|'fixed'}))}>
                    <option value="pct">% Percentuale</option>
                    <option value="fixed">€ Importo fisso</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">Valore *</label>
                  <input className="input" type="number" min="0" placeholder={form.type==='pct'?'10':'5.00'} value={form.value} onChange={e => setForm(f=>({...f,value:e.target.value}))} />
                </div>
              </div>
              <div>
                <label className="input-label">Scadenza (opzionale)</label>
                <input className="input" type="date" value={form.expires_at} onChange={e => setForm(f=>({...f,expires_at:e.target.value}))} min={new Date().toISOString().split('T')[0]} />
              </div>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:'var(--space-xl)' }}>
              <button className="btn btn-secondary" style={{ flex:1 }} onClick={() => setShowForm(false)}>Annulla</button>
              <button className="btn btn-primary" style={{ flex:2 }} disabled={saving||!form.code||!form.value} onClick={saveCode}>
                {saving ? 'Salvataggio...' : '+ Crea Codice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
