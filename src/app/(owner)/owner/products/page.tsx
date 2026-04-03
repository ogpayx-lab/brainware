'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmt, categoryLabel, calcMarginPct } from '@/lib/utils'
import type { Product, ProductCategory } from '@/types/database'

const CATEGORIES: ProductCategory[] = ['flowers', 'hashish', 'oils', 'edibles', 'accessories']
const EMPTY_FORM = {
  name: '', category: 'flowers' as ProductCategory,
  price: '', cost: '', unit: 'g', barcode: '', stock: '', stock_alert: '5',
}

export default function ProductsPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [products, setProducts] = useState<Product[]>([])
  const [storeId, setStoreId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState<ProductCategory | 'all'>('all')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [importRows, setImportRows] = useState<any[]>([])
  const [importError, setImportError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importDone, setImportDone] = useState<{ ok: number; skip: number } | null>(null)
  const [stats, setStats] = useState({ active: 0, lowStock: 0, inactive: 0 })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('users').select('store_id, role').eq('id', user.id).single()
    if (profile?.role !== 'owner') { router.push('/login'); return }
    setStoreId(profile.store_id)
    const { data: prods } = await supabase.from('products').select('*').eq('store_id', profile.store_id).order('name')
    const p = prods ?? []
    setProducts(p)
    setStats({ active: p.filter(x => x.is_active).length, lowStock: p.filter(x => x.stock <= x.stock_alert && x.is_active).length, inactive: p.filter(x => !x.is_active).length })
    setLoading(false)
  }

  function openAdd() { setForm(EMPTY_FORM); setEditId(null); setShowForm(true) }
  function openEdit(p: Product) {
    setForm({ name: p.name, category: p.category, price: p.price.toString(), cost: p.cost?.toString() ?? '', unit: p.unit, barcode: p.barcode ?? '', stock: p.stock.toString(), stock_alert: p.stock_alert.toString() })
    setEditId(p.id); setShowForm(true)
  }

  async function handleSave() {
    if (!storeId || !form.name || !form.price) return
    setSaving(true)
    const payload = { store_id: storeId, name: form.name, category: form.category, price: parseFloat(form.price), cost: form.cost ? parseFloat(form.cost) : null, unit: form.unit, barcode: form.barcode || null, stock: parseInt(form.stock) || 0, stock_alert: parseInt(form.stock_alert) || 5 }
    if (editId) await supabase.from('products').update(payload).eq('id', editId)
    else await supabase.from('products').insert(payload)
    setShowForm(false); setSaving(false); loadData()
  }

  async function toggleActive(p: Product) {
    await supabase.from('products').update({ is_active: !p.is_active }).eq('id', p.id)
    loadData()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError(null); setImportDone(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const lines = text.trim().split('\n').filter(l => l.trim())
      if (lines.length < 2) { setImportError('File vuoto o solo intestazione.'); return }
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
      const idx = (k: string) => headers.indexOf(k)
      if (idx('nome') === -1 || idx('categoria') === -1 || idx('prezzo') === -1) { setImportError('Colonne obbligatorie mancanti: nome, categoria, prezzo. Scarica il template.'); return }
      const rows = lines.slice(1).map((line, i) => {
        const cols = line.split(',').map(c => c.trim())
        const cat = cols[idx('categoria')]?.toLowerCase()
        const validCat = CATEGORIES.includes(cat as ProductCategory) ? cat : 'flowers'
        return { row: i + 2, name: cols[idx('nome')] ?? '', category: validCat as ProductCategory, price: parseFloat(cols[idx('prezzo')]) || 0, cost: idx('costo') >= 0 && cols[idx('costo')] ? parseFloat(cols[idx('costo')]) : null, unit: idx('unita') >= 0 && cols[idx('unita')] ? cols[idx('unita')] : 'g', barcode: idx('barcode') >= 0 && cols[idx('barcode')] ? cols[idx('barcode')] : null, stock: idx('stock') >= 0 ? parseInt(cols[idx('stock')]) || 0 : 0, stock_alert: idx('stock_alert') >= 0 ? parseInt(cols[idx('stock_alert')]) || 5 : 5, valid: !!(cols[idx('nome')] && parseFloat(cols[idx('prezzo')]) > 0) }
      })
      setImportRows(rows)
    }
    reader.readAsText(file)
  }

  async function confirmImport() {
    if (!storeId || importRows.length === 0) return
    setImporting(true)
    const valid = importRows.filter(r => r.valid)
    const skip = importRows.length - valid.length
    let ok = 0
    for (const row of valid) {
      const { error } = await supabase.from('products').insert({ store_id: storeId, name: row.name, category: row.category, price: row.price, cost: row.cost, unit: row.unit, barcode: row.barcode, stock: row.stock, stock_alert: row.stock_alert })
      if (!error) ok++
    }
    setImporting(false); setImportDone({ ok, skip }); setImportRows([])
    if (fileRef.current) fileRef.current.value = ''
    loadData()
  }

  const filtered = products.filter(p => (filterCat === 'all' || p.category === filterCat) && (!search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.barcode && p.barcode.includes(search))))

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>Caricamento...</div>

  return (
    <div>
      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 520 }}>
            <h3 style={{ marginBottom: 'var(--space-xl)' }}>{editId ? 'Modifica Prodotto' : 'Nuovo Prodotto'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div className="input-group"><label className="input-label">Nome *</label><input className="input" placeholder="Nome prodotto" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                <div className="input-group"><label className="input-label">Categoria *</label>
                  <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as ProductCategory }))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{categoryLabel[c]}</option>)}
                  </select>
                </div>
                <div className="input-group"><label className="input-label">Unita</label>
                  <select className="input" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                    <option value="g">Grammi (g)</option><option value="ml">Millilitri (ml)</option><option value="pz">Pezzo (pz)</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                <div className="input-group"><label className="input-label">Prezzo vendita () *</label><input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} /></div>
                <div className="input-group"><label className="input-label">Costo acquisto ()</label><input className="input" type="number" min="0" step="0.01" placeholder="Opzionale" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} /></div>
              </div>
              {form.price && form.cost && (
                <div style={{ background: 'var(--brand-primary-light)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: 13, color: 'var(--brand-primary-dark)' }}>
                  Margine: {calcMarginPct(parseFloat(form.price), parseFloat(form.cost))?.toFixed(1)}%  Profitto: {fmt(parseFloat(form.price) - parseFloat(form.cost))}/{form.unit}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                <div className="input-group"><label className="input-label">Stock iniziale (opzionale)</label><input className="input" type="number" min="0" placeholder="0" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} /></div>
                <div className="input-group"><label className="input-label">Soglia alert (opzionale)</label><input className="input" type="number" min="0" placeholder="5" value={form.stock_alert} onChange={e => setForm(f => ({ ...f, stock_alert: e.target.value }))} /></div>
              </div>
              <div className="input-group"><label className="input-label">Barcode / ID interno</label><input className="input" placeholder="Es. 8901234567890" value={form.barcode} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-xl)' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowForm(false)}>Annulla</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleSave} disabled={saving || !form.name || !form.price}>{saving ? 'Salvataggio...' : 'Salva Prodotto'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImport && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 640 }}>
            <h3 style={{ marginBottom: 8 }}>Importa Prodotti da CSV</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 'var(--space-lg)' }}>Carica un file CSV con i tuoi prodotti. Scarica il template per vedere il formato corretto.</p>

            {/* Template download */}
            <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)', marginBottom: 'var(--space-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>📄 Template CSV</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Colonne: nome, categoria, prezzo, costo, unita, barcode (stock e stock_alert opzionali)</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>Categorie valide: flowers, hashish, oils, edibles, accessories</div>
              </div>
              <a href="/prodotti_template.csv" download className="btn btn-secondary" style={{ flexShrink: 0, textDecoration: 'none' }}> Scarica Template</a>
            </div>

            <div className="input-group" style={{ marginBottom: 'var(--space-lg)' }}>
              <label className="input-label">Carica file CSV</label>
              <input ref={fileRef} type="file" accept=".csv" onChange={handleFileChange} style={{ padding: '10px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', width: '100%', fontSize: 14 }} />
            </div>

            {importError && <div style={{ background: 'var(--danger-light)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 13, color: 'var(--danger)', marginBottom: 'var(--space-md)' }}> {importError}</div>}
            {importDone && <div style={{ background: 'var(--success-light)', border: '1px solid var(--brand-primary)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 13, color: 'var(--brand-primary-dark)', marginBottom: 'var(--space-md)' }}> Importati {importDone.ok} prodotti{importDone.skip > 0 ? `  ${importDone.skip} righe saltate (dati mancanti)` : ''}</div>}

            {importRows.length > 0 && (
              <div style={{ marginBottom: 'var(--space-lg)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Anteprima  {importRows.filter(r => r.valid).length} prodotti validi su {importRows.length}</div>
                <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-surface)' }}>
                        {['#', 'Nome', 'Categoria', 'Prezzo', 'Stock', 'Stato'].map(h => (
                          <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.map(row => (
                        <tr key={row.row} style={{ borderTop: '1px solid var(--border-subtle)', opacity: row.valid ? 1 : 0.5 }}>
                          <td style={{ padding: '6px 10px', color: 'var(--text-tertiary)' }}>{row.row}</td>
                          <td style={{ padding: '6px 10px', fontWeight: 600 }}>{row.name || ''}</td>
                          <td style={{ padding: '6px 10px' }}>{categoryLabel[row.category as ProductCategory] || row.category}</td>
                          <td style={{ padding: '6px 10px' }}>{row.price > 0 ? fmt(row.price) : ''}</td>
                          <td style={{ padding: '6px 10px' }}>{row.stock}</td>
                          <td style={{ padding: '6px 10px' }}>
                            <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, background: row.valid ? 'var(--success-light)' : 'var(--danger-light)', color: row.valid ? 'var(--brand-primary)' : 'var(--danger)' }}>
                              {row.valid ? ' OK' : ' Skip'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setShowImport(false); setImportRows([]); setImportError(null); setImportDone(null) }}>Chiudi</button>
              {importRows.length > 0 && (
                <button className="btn btn-primary" style={{ flex: 2 }} onClick={confirmImport} disabled={importing}>{importing ? 'Importazione...' : `Importa ${importRows.filter(r => r.valid).length} Prodotti`}</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stats banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
        <div className="kpi-card"><div className="kpi-label">Prodotti Attivi</div><div className="kpi-value">{stats.active}</div></div>
        <div className="kpi-card" style={{ border: stats.lowStock > 0 ? '1.5px solid var(--warning)' : undefined }}><div className="kpi-label">Stock Basso</div><div className="kpi-value" style={{ color: stats.lowStock > 0 ? 'var(--warning)' : undefined }}>{stats.lowStock}</div></div>
        <div className="kpi-card"><div className="kpi-label">Disattivati</div><div className="kpi-value">{stats.inactive}</div></div>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xl)' }}>
        <h2>Gestione Prodotti</h2>
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <button className="btn btn-secondary" style={{ fontSize:12 }}> Export PDF</button>
          <button className="btn btn-secondary" style={{ fontSize:12 }}> Export Excel</button>
          <button className="btn btn-secondary" onClick={() => setShowImport(true)}> Import CSV</button>
          <button className="btn btn-primary" onClick={openAdd}>+ Nuovo Prodotto</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}>
        <input className="input" placeholder="Cerca prodotto per nome o barcode..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 300 }} />
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <button onClick={() => setFilterCat('all')} className={`badge ${filterCat === 'all' ? 'badge-brand' : 'badge-gray'}`} style={{ cursor: 'pointer', border: 'none', padding: '6px 14px' }}>Tutte le categorie</button>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setFilterCat(c)} className={`badge ${filterCat === c ? 'badge-brand' : 'badge-gray'}`} style={{ cursor: 'pointer', border: 'none', padding: '6px 14px' }}>
              {categoryLabel[c]}
            </button>
          ))}
        </div>
      </div>

      {/* Products table */}
      <div className="table-wrapper">
        <table>
          <thead><tr><th>Nome</th><th>Categoria</th><th>Prezzo</th><th>Costo</th><th>Margine</th><th>Barcode</th><th>Stock</th><th>Stato</th><th>Azioni</th></tr></thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-tertiary)' }}>
                {products.length === 0 ? 'Nessun prodotto. Aggiungine uno o importa da CSV.' : 'Nessun prodotto trovato.'}
              </td></tr>
            )}
            {filtered.map(p => {
              const margin = calcMarginPct(p.price, p.cost)
              return (
                <tr key={p.id} style={{ opacity: p.is_active ? 1 : 0.5 }}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{p.unit}</div>
                  </td>
                  <td><span className="badge badge-indigo" style={{ fontSize: 11 }}>{categoryLabel[p.category]}</span></td>
                  <td style={{ fontWeight: 600 }}>{fmt(p.price)}/{p.unit}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{p.cost ? fmt(p.cost) : ''}</td>
                  <td>
                    {margin !== null ? (
                      <span style={{ fontWeight: 600, color: margin > 50 ? 'var(--success)' : margin > 30 ? 'var(--warning)' : 'var(--danger)' }}>{margin.toFixed(1)}%</span>
                    ) : ''}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.barcode || ''}</td>
                  <td>
                    <span style={{ fontWeight: 700, color: p.stock === 0 ? 'var(--danger)' : p.stock <= p.stock_alert ? 'var(--warning)' : 'var(--text-primary)' }}>{p.stock}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 4 }}>/ {p.stock_alert}</span>
                  </td>
                  <td><span className={`badge ${p.is_active ? 'badge-success' : 'badge-gray'}`}>{p.is_active ? 'Attivo' : 'Inattivo'}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEdit(p)} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }}>Modifica</button>
                      <button onClick={() => toggleActive(p)} className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }}>{p.is_active ? 'Disabilita' : 'Abilita'}</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
