'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmt, categoryLabel, calcMarginPct } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import type { Product, ProductCategory } from '@/types/database'
import * as XLSX from 'xlsx'

const CATEGORIES: ProductCategory[] = ['flowers', 'hashish', 'oils', 'edibles', 'accessories', 'cosmetics', 'clothes', 'seeds', 'vape', 'food']
const EMPTY_FORM = {
  name: '', category: 'flowers' as ProductCategory,
  price: '', cost: '', unit: 'g', barcode: '', stock_alert: '5', target_store: '',
}

export default function ProductsPage() {
  const router = useRouter()
  const supabase = createClient()
  const t = useT()
  const fileRef = useRef<HTMLInputElement>(null)

  const [products, setProducts] = useState<Product[]>([])
  const [storeId, setStoreId] = useState<string | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [orgStores, setOrgStores] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showCopyTo, setShowCopyTo] = useState(false)
  const [copyTargets, setCopyTargets] = useState<{ type: 'store' | 'warehouse'; id: string }[]>([])
  const [copying, setCopying] = useState(false)
  const [copyResult, setCopyResult] = useState<{ ok: number; skip: number; dests: number } | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
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

  // All stores (including own) for store selector
  const [allStores, setAllStores] = useState<any[]>([])
  const [viewStore, setViewStore] = useState<string>('') // filter by store
  const [warehouses, setWarehouses] = useState<any[]>([])

  useEffect(() => { loadData() }, [])

  async function loadData(forceStoreId?: string) {
    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('users').select('store_id, role, stores(organization_id, name)').eq('id', user.id).single()
    if (profile?.role !== 'owner') { router.push('/login'); return }
    setStoreId(profile.store_id)
    const oid = (profile.stores as any)?.organization_id
    setOrgId(oid)

    let storesList: any[] = [{ id: profile.store_id, name: (profile.stores as any)?.name || 'Store Principale' }]
    if (oid) {
      const { data: storeList } = await supabase.from('stores').select('id,name').eq('organization_id', oid).eq('is_active', true)
      storesList = storeList ?? storesList
      // Other stores for distribute (excluding own)
      setOrgStores((storeList ?? []).filter(s => s.id !== profile.store_id))
    }
    setAllStores(storesList)
    const defaultStore = forceStoreId || storesList[0]?.id || profile.store_id
    if (!viewStore || forceStoreId) setViewStore(defaultStore)

    // Load warehouses
    if (oid) {
      const { data: whs } = await supabase.from('warehouses').select('id,name,type').eq('organization_id', oid).eq('is_active', true)
      setWarehouses(whs ?? [])
    }

    // Load products for currently viewed store
    const targetSid = forceStoreId || defaultStore || profile.store_id
    const { data: prods } = await supabase.from('products').select('*').eq('store_id', targetSid).order('name')
    const p = prods ?? []
    setProducts(p)
    setStats({ active: p.filter(x => x.is_active).length, lowStock: p.filter(x => x.stock <= x.stock_alert && x.is_active).length, inactive: p.filter(x => !x.is_active).length })
    setLoading(false)
  }

  function openAdd() {
    setForm({ ...EMPTY_FORM, target_store: viewStore || storeId || '' })
    setEditId(null); setShowForm(true)
  }
  function openEdit(p: Product) {
    setForm({ name: p.name, category: p.category, price: p.price.toString(), cost: p.cost?.toString() ?? '', unit: p.unit, barcode: p.barcode ?? '', stock_alert: p.stock_alert.toString(), target_store: (p as any).store_id || viewStore || storeId || '' })
    setEditId(p.id); setShowForm(true)
  }

  async function handleSave() {
    if (!form.name || !form.price) return
    const targetStore = form.target_store || viewStore || storeId
    if (!targetStore) return
    setSaving(true)
    const payload: any = { store_id: targetStore, name: form.name, category: form.category, price: parseFloat(form.price), cost: form.cost ? parseFloat(form.cost) : null, unit: form.unit, barcode: form.barcode || null, stock_alert: parseInt(form.stock_alert) || 5 }
    let error: any = null
    if (editId) {
      const res = await supabase.from('products').update(payload).eq('id', editId)
      error = res.error
    } else {
      payload.stock = 0
      const res = await supabase.from('products').insert(payload)
      error = res.error
    }
    if (error) {
      alert(`Errore nel salvataggio: ${error.message}`)
      setSaving(false)
      return
    }
    setShowForm(false); setSaving(false); loadData()
  }

  async function toggleActive(p: Product) {
    await supabase.from('products').update({ is_active: !p.is_active }).eq('id', p.id)
    loadData()
  }

  async function deleteProduct(p: Product) {
    if (!confirm(`Eliminare definitivamente "${p.name}"? Questa azione non è reversibile.`)) return
    await supabase.from('products').delete().eq('id', p.id)
    loadData()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError(null); setImportDone(null)

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]

        // Converte tutto il foglio in array di array (righe raw)
        const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
        if (rawRows.length < 2) { setImportError('File vuoto o solo intestazione.'); return }

        // Normalizza una stringa per match colonne
        const normalize = (s: any) => String(s ?? '').toLowerCase().trim().replace(/\s+/g, '_')

        // Auto-detect: cerca la riga che contiene "nome", "categoria", "prezzo"
        let headerRowIdx = -1
        for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
          const cells = rawRows[i].map(normalize)
          if (cells.includes('nome') && cells.includes('categoria') && cells.includes('prezzo')) {
            headerRowIdx = i
            break
          }
        }

        if (headerRowIdx === -1) {
          const allHeaders = rawRows.slice(0, 5).map((r, i) => `Riga ${i + 1}: [${r.map(normalize).join(', ')}]`).join('\n')
          setImportError(`Colonne obbligatorie non trovate: nome, categoria, prezzo.\n${allHeaders}`)
          return
        }

        // Mappa colonne
        const headers = rawRows[headerRowIdx].map(normalize)
        const idx = (k: string) => headers.indexOf(k)
        const dataRows = rawRows.slice(headerRowIdx + 1).filter(r => r.some((c: any) => String(c).trim() !== ''))

        if (dataRows.length === 0) { setImportError('Nessun dato trovato dopo le intestazioni.'); return }

        const rows = dataRows.map((cols, i) => {
          const cat = normalize(cols[idx('categoria')])
          const validCat = CATEGORIES.includes(cat as ProductCategory) ? cat : 'flowers'
          const name = String(cols[idx('nome')] ?? '').trim()
          const price = parseFloat(cols[idx('prezzo')]) || 0
          const cost = idx('costo') >= 0 ? parseFloat(cols[idx('costo')]) || null : null
          const unit = idx('unita') >= 0 && String(cols[idx('unita')]).trim() ? String(cols[idx('unita')]).trim() : 'g'
          const barcode = idx('barcode') >= 0 && String(cols[idx('barcode')]).trim() ? String(cols[idx('barcode')]).trim() : null
          const stockAlert = idx('stock_alert') >= 0 ? parseInt(cols[idx('stock_alert')]) || 5 : 5

          return {
            row: headerRowIdx + i + 2,
            name,
            category: validCat as ProductCategory,
            price,
            cost,
            unit,
            barcode,
            stock: 0,
            stock_alert: stockAlert,
            valid: !!name,
          }
        })
        setImportRows(rows)
      } catch (err: any) {
        setImportError(`Errore nella lettura del file: ${err.message || 'formato non supportato'}`)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  async function confirmImport() {
    if (!storeId || importRows.length === 0) return
    setImporting(true)
    const valid = importRows.filter(r => r.valid)
    const skip = importRows.length - valid.length
    let ok = 0
    for (const row of valid) {
      const { error } = await supabase.from('products').insert({ store_id: storeId, name: row.name, category: row.category, price: row.price, cost: row.cost, unit: row.unit, barcode: row.barcode, stock: 0, stock_alert: row.stock_alert })
      if (!error) ok++
    }
    setImporting(false); setImportDone({ ok, skip }); setImportRows([])
    if (fileRef.current) fileRef.current.value = ''
    loadData()
  }

  async function copyToDestinations() {
    if (copyTargets.length === 0) return
    setCopying(true)
    const selectedProducts = selectedIds.size > 0
      ? products.filter(p => selectedIds.has(p.id))
      : products.filter(p => p.is_active)
    let totalOk = 0, totalSkip = 0

    for (const target of copyTargets) {
      if (target.type === 'store') {
        // Copy to store (products table)
        const { data: existing } = await supabase.from('products').select('name').eq('store_id', target.id)
        const existingNames = new Set((existing ?? []).map((p: any) => p.name.toLowerCase()))
        const newProducts = selectedProducts.filter(p => !existingNames.has(p.name.toLowerCase()))
        totalSkip += selectedProducts.length - newProducts.length
        if (newProducts.length > 0) {
          const { error } = await supabase.from('products').insert(
            newProducts.map(p => ({
              store_id: target.id,
              name: p.name, category: p.category, price: p.price,
              cost: p.cost, unit: p.unit, barcode: p.barcode,
              stock: 0, stock_alert: p.stock_alert,
            }))
          )
          if (!error) totalOk += newProducts.length
        }
      } else {
        // Copy to warehouse (warehouse_stock table)
        const { data: existing } = await supabase.from('warehouse_stock').select('product_name').eq('warehouse_id', target.id)
        const existingNames = new Set((existing ?? []).map((p: any) => p.product_name.toLowerCase()))
        const newProducts = selectedProducts.filter(p => !existingNames.has(p.name.toLowerCase()))
        totalSkip += selectedProducts.length - newProducts.length
        if (newProducts.length > 0) {
          const { error } = await supabase.from('warehouse_stock').insert(
            newProducts.map(p => ({
              warehouse_id: target.id,
              product_name: p.name,
              category: p.category,
              qty: 0,
              cost_per_unit: p.cost || 0,
              sell_price: p.price,
              stock_alert: p.stock_alert,
              unit: p.unit,
            }))
          )
          if (!error) totalOk += newProducts.length
        }
      }
    }
    setCopyResult({ ok: totalOk, skip: totalSkip, dests: copyTargets.length })
    setCopying(false)
  }

  function toggleCopyTarget(type: 'store' | 'warehouse', id: string) {
    setCopyTargets(prev => {
      const exists = prev.some(t => t.type === type && t.id === id)
      return exists ? prev.filter(t => !(t.type === type && t.id === id)) : [...prev, { type, id }]
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map(p => p.id)))
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const filtered = products.filter(p => (filterCat === 'all' || p.category === filterCat) && (!search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.barcode && p.barcode.includes(search))))

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>{t('loading')}</div>

  return (
    <div>
      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 520 }}>
            <h3 style={{ marginBottom: 'var(--space-xl)' }}>{editId ? t('edit') + ' ' + t('products') : t('prod.addProduct')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              {/* Store selector */}
              {allStores.length > 1 && (
                <div className="input-group">
                  <label className="input-label">Store di destinazione *</label>
                  <select className="input" value={form.target_store} onChange={e => setForm(f => ({ ...f, target_store: e.target.value }))}>
                    {allStores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
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
              <div className="input-group">
                <label className="input-label">Soglia alert stock</label>
                <input className="input" type="number" min="0" placeholder="5" value={form.stock_alert} onChange={e => setForm(f => ({ ...f, stock_alert: e.target.value }))} />
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>💡 Lo stock verrà gestito dalla pagina Inventario Iniziale per ogni store</div>
              </div>
              <div className="input-group"><label className="input-label">Barcode / ID interno</label><input className="input" placeholder="Es. 8901234567890" value={form.barcode} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-xl)' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowForm(false)}>{t('cancel')}</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleSave} disabled={saving || !form.name || !form.price}>{saving ? t('saving') : t('save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImport && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 640 }}>
            <h3 style={{ marginBottom: 8 }}>Importa Prodotti</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 'var(--space-lg)' }}>Carica un file con i tuoi prodotti. Formati supportati: <strong>CSV, Excel (.xlsx), Numbers</strong>.</p>

            {/* Template download */}
            <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>📄 Template CSV</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Colonne: nome, categoria, prezzo, costo, unita, barcode, stock_alert</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>Categorie valide: flowers, hashish, oils, edibles, accessories</div>
                </div>
                <a href="/prodotti_template.csv" download className="btn btn-secondary" style={{ flexShrink: 0, textDecoration: 'none' }}> Scarica Template</a>
              </div>
              <div style={{ background: 'var(--brand-primary-light)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: 12, color: 'var(--brand-primary-dark)', marginTop: 6 }}>
                💡 Questo è il <strong>catalogo prodotti</strong> dell&apos;azienda. I prodotti vengono caricati con stock = 0. Usa &quot;Inventario Iniziale&quot; per impostare le quantità per ogni store.
              </div>
            </div>

            <div className="input-group" style={{ marginBottom: 'var(--space-lg)' }}>
              <label className="input-label">Carica file (CSV, Excel, Numbers)</label>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.numbers" onChange={handleFileChange} style={{ padding: '10px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', width: '100%', fontSize: 14 }} />
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
        <div className="kpi-card"><div className="kpi-label">{t('products')} {t('active')}</div><div className="kpi-value">{stats.active}</div></div>
        <div className="kpi-card" style={{ border: stats.lowStock > 0 ? '1.5px solid var(--warning)' : undefined }}><div className="kpi-label">{t('dash.lowStock')}</div><div className="kpi-value" style={{ color: stats.lowStock > 0 ? 'var(--warning)' : undefined }}>{stats.lowStock}</div></div>
        <div className="kpi-card"><div className="kpi-label">{t('disabled')}</div><div className="kpi-value">{stats.inactive}</div></div>
      </div>

      {/* Copy-to modal */}
      {showCopyTo && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 520 }}>
            <h3 style={{ marginBottom: 8 }}>📋 Copia Prodotti</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 'var(--space-lg)' }}>
              {selectedIds.size > 0
                ? `Copia ${selectedIds.size} prodotti selezionati verso le destinazioni scelte.`
                : `Copia tutti i ${products.filter(p => p.is_active).length} prodotti attivi.`
              } I prodotti verranno creati con stock/qty = 0.
            </p>

            {/* Store destinations */}
            {allStores.filter(s => s.id !== viewStore).length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>🏪 Store</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                  {allStores.filter(s => s.id !== viewStore).map(s => {
                    const isSelected = copyTargets.some(t => t.type === 'store' && t.id === s.id)
                    return (
                      <div key={s.id} onClick={() => toggleCopyTarget('store', s.id)} style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                        background: isSelected ? 'var(--brand-primary-light)' : 'var(--bg-surface)',
                        border: `1.5px solid ${isSelected ? 'var(--brand-primary)' : 'var(--border-default)'}`,
                        borderRadius: 10, cursor: 'pointer',
                      }}>
                        <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${isSelected ? 'var(--brand-primary)' : 'var(--border-strong)'}`, background: isSelected ? 'var(--brand-primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, flexShrink: 0 }}>
                          {isSelected && '✓'}
                        </div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>🏪 {s.name}</div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* Warehouse destinations */}
            {warehouses.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>🏭 Magazzini</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                  {warehouses.map(w => {
                    const isSelected = copyTargets.some(t => t.type === 'warehouse' && t.id === w.id)
                    return (
                      <div key={w.id} onClick={() => toggleCopyTarget('warehouse', w.id)} style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                        background: isSelected ? '#EFF6FF' : 'var(--bg-surface)',
                        border: `1.5px solid ${isSelected ? '#3B82F6' : 'var(--border-default)'}`,
                        borderRadius: 10, cursor: 'pointer',
                      }}>
                        <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${isSelected ? '#3B82F6' : 'var(--border-strong)'}`, background: isSelected ? '#3B82F6' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, flexShrink: 0 }}>
                          {isSelected && '✓'}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{w.type === 'central' ? '🏭' : '📦'} {w.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{w.type === 'central' ? 'Magazzino Centrale' : 'Secondario'}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {allStores.filter(s => s.id !== viewStore).length === 0 && warehouses.length === 0 && (
              <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-tertiary)' }}>
                Nessuno store o magazzino trovato. Creane uno prima.
              </div>
            )}

            {copyResult && (
              <div style={{ background: 'var(--success-light)', border: '1px solid var(--brand-primary)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 13, color: 'var(--brand-primary-dark)', marginBottom: 'var(--space-md)' }}>
                ✅ Copiati <strong>{copyResult.ok}</strong> prodotti a <strong>{copyResult.dests}</strong> destinazioni{copyResult.skip > 0 && ` · ${copyResult.skip} già esistenti (saltati)`}
              </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setShowCopyTo(false); setCopyTargets([]); setCopyResult(null) }}>Chiudi</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={copyToDestinations} disabled={copying || copyTargets.length === 0}>
                {copying ? 'Copia in corso...' : `📋 Copia a ${copyTargets.length} destinazioni`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xl)', flexWrap: 'wrap', gap: 8 }}>
        <h2>{t('prod.title')}</h2>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => { setShowCopyTo(true); setCopyResult(null) }} style={{ fontSize: 12 }}>📋 Copy...</button>
          <button className="btn btn-secondary" onClick={() => setShowImport(true)}>📥 Import CSV</button>
          <button className="btn btn-primary" onClick={openAdd}>+ {t('prod.addProduct')}</button>
        </div>
      </div>

      {/* Selection toolbar */}
      {selectedIds.size > 0 && (
        <div style={{
          background: 'var(--brand-primary-light)', border: '1.5px solid var(--brand-primary)',
          borderRadius: 10, padding: '10px 16px', marginBottom: 'var(--space-lg)',
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--brand-primary-dark)' }}>
            ✓ {selectedIds.size} selezionati
          </span>
          <button className="btn btn-primary" onClick={() => { setShowCopyTo(true); setCopyResult(null) }} style={{ padding: '5px 14px', fontSize: 12 }}>
            📋 Copia a Store/Magazzino
          </button>
          <button className="btn btn-secondary" onClick={() => setSelectedIds(new Set())} style={{ padding: '5px 10px', fontSize: 12 }}>
            ✕ Deseleziona
          </button>
        </div>
      )}

      {/* Store filter tabs */}
      {allStores.length > 1 && (
        <div style={{ display:'flex', gap:6, marginBottom:'var(--space-lg)', flexWrap:'wrap' }}>
          {allStores.map(s => (
            <button
              key={s.id}
              onClick={() => { setViewStore(s.id); setLoading(true); loadData(s.id) }}
              className={`badge ${viewStore === s.id ? 'badge-brand' : 'badge-gray'}`}
              style={{ cursor:'pointer', border:'none', padding:'6px 14px', fontSize:13 }}
            >
              🏪 {s.name}
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}>
        <input className="input" placeholder={t('search') + '...'} value={search} onChange={e => setSearch(e.target.value)} style={{ width: 300 }} />
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <button onClick={() => setFilterCat('all')} className={`badge ${filterCat === 'all' ? 'badge-brand' : 'badge-gray'}`} style={{ cursor: 'pointer', border: 'none', padding: '6px 14px' }}>{t('all')}</button>
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
          <thead><tr>
            <th style={{ width: 36 }}>
              <input type="checkbox" checked={filtered.length > 0 && selectedIds.size === filtered.length} onChange={toggleSelectAll} style={{ cursor: 'pointer', width: 16, height: 16 }} />
            </th>
            <th>{t('name')}</th><th>{t('category')}</th><th>{t('price')}</th><th>{t('prod.costPrice')}</th><th>Margin</th><th>Barcode</th><th>Stock</th><th>{t('status')}</th><th>{t('actions')}</th>
          </tr></thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-tertiary)' }}>
                {products.length === 0 ? 'Nessun prodotto. Aggiungine uno o importa da CSV.' : 'Nessun prodotto trovato.'}
              </td></tr>
            )}
            {filtered.map(p => {
              const margin = calcMarginPct(p.price, p.cost)
              const isSelected = selectedIds.has(p.id)
              return (
                <tr key={p.id} style={{ opacity: p.is_active ? 1 : 0.5, background: isSelected ? 'var(--brand-primary-light)' : undefined }}>
                  <td>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(p.id)} style={{ cursor: 'pointer', width: 16, height: 16 }} />
                  </td>
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
                  <td><span className={`badge ${p.is_active ? 'badge-success' : 'badge-gray'}`}>{p.is_active ? t('active') : t('inactive')}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEdit(p)} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }}>{t('edit')}</button>
                      <button onClick={() => toggleActive(p)} className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }}>{p.is_active ? t('prod.deactivate') : t('prod.activate')}</button>
                      <button onClick={() => deleteProduct(p)} className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12, color: 'var(--danger)' }} title="Elimina prodotto">🗑️</button>
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
