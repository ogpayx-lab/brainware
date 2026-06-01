'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import * as XLSX from 'xlsx'
import { useT } from '@/lib/i18n'

type ParsedProduct = { name: string; category: string; stock: number; price?: number; barcode?: string }
type ParsedWarehouseItem = { product_name: string; qty: number; sku?: string; category?: string }

export default function BulkLoadPage() {
  const router = useRouter()
  const supabase = createClient()
  const t = useT()
  const fileRef = useRef<HTMLInputElement>(null)

  const [tab, setTab] = useState<'store' | 'warehouse'>('store')
  const [stores, setStores] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [storeId, setStoreId] = useState<string | null>(null)

  // CSV parsing
  const [csvText, setCsvText] = useState('')
  const [parsedRows, setParsedRows] = useState<any[]>([])
  const [parseError, setParseError] = useState('')

  // Upload state
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [mode, setMode] = useState<'replace' | 'merge' | 'inventory'>('inventory')

  useEffect(() => { loadAuth() }, [])

  async function loadAuth() {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('users').select('store_id,role,stores(organization_id)').eq('id', user.id).single()
    if (profile?.role !== 'owner') { router.push('/login'); return }
    setStoreId(profile.store_id)

    const oid = (profile.stores as any)?.organization_id
    if (oid) {
      const { data: s } = await supabase.from('stores').select('id,name').eq('organization_id', oid)
      setStores(s ?? [])
      if (s && s.length > 0) setSelectedId(s[0].id)

      const { data: w } = await supabase.from('warehouses').select('id,name,type').eq('organization_id', oid).eq('is_active', true)
      setWarehouses(w ?? [])
    }
  }

  function parseCSV(text: string) {
    setParseError('')
    const lines = text.trim().split('\n').filter(l => l.trim())
    if (lines.length < 2) { setParseError('Il CSV deve avere almeno intestazione + 1 riga'); return [] }

    const headers = lines[0].split(/[,;\t]/).map(h => h.trim().toLowerCase().replace(/"/g, ''))
    const rows: any[] = []

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(/[,;\t]/).map(c => c.trim().replace(/^"|"$/g, ''))
      const row: any = {}
      headers.forEach((h, idx) => { row[h] = cols[idx] || '' })
      rows.push(row)
    }

    if (tab === 'store') {
      const nameCol = headers.find(h => ['name', 'nome', 'prodotto', 'product'].includes(h))
      if (!nameCol) { setParseError('Colonna "name" o "nome" non trovata. Intestazioni trovate: ' + headers.join(', ')); return [] }
      return rows.map(r => {
        const rawCat = (r['category'] || r['categoria'] || 'other').trim().toLowerCase()
        // Map to valid enum values
        const catMap: Record<string, string> = {
          flowers: 'flowers', flower: 'flowers', fiori: 'flowers', cannabis: 'flowers', cbd: 'flowers', weed: 'flowers',
          hashish: 'hashish', hash: 'hashish', resina: 'hashish',
          oils: 'oils', oil: 'oils', olio: 'oils', cbd_oil: 'oils',
          edibles: 'edibles', edible: 'edibles', food: 'edibles', cibo: 'edibles',
          accessories: 'accessories', accessory: 'accessories', accessori: 'accessories', accessorio: 'accessories',
          seeds: 'accessories', semi: 'accessories',
          cosmetics: 'accessories', cosmetici: 'accessories',
          clothes: 'accessories', abbigliamento: 'accessories',
          vape: 'accessories', vaping: 'accessories',
          other: 'accessories',
        }
        return {
          name: r[nameCol],
          category: catMap[rawCat] || 'accessories',
          stock: parseInt(r['stock'] || r['qty'] || r['quantita'] || '0') || 0,
          price: parseFloat(r['price'] || r['prezzo'] || '0') || 0,
          barcode: r['barcode'] || r['sku'] || '',
        }
      }).filter(r => r.name)
    } else {
      const nameCol = headers.find(h => ['product_name', 'name', 'nome', 'prodotto'].includes(h))
      const qtyCol = headers.find(h => ['qty', 'stock', 'quantita', 'quantity'].includes(h))
      if (!nameCol) { setParseError('Colonna "name" o "product_name" non trovata'); return [] }
      return rows.map(r => ({
        product_name: r[nameCol],
        qty: parseInt(r[qtyCol || 'qty'] || '0') || 0,
        sku: r['sku'] || r['barcode'] || '',
        category: r['category'] || r['categoria'] || '',
      })).filter(r => r.product_name)
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
    const reader = new FileReader()
    reader.onload = (ev) => {
      if (isExcel) {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const csv = XLSX.utils.sheet_to_csv(sheet, { FS: ',' })
        setCsvText(csv)
        const rows = parseCSV(csv)
        setParsedRows(rows)
      } else {
        const text = ev.target?.result as string
        setCsvText(text)
        const rows = parseCSV(text)
        setParsedRows(rows)
      }
    }
    if (isExcel) reader.readAsArrayBuffer(file)
    else reader.readAsText(file)
  }

  function handleTextParse() {
    const rows = parseCSV(csvText)
    setParsedRows(rows)
  }

  async function handleUpload() {
    if (!selectedId || parsedRows.length === 0) return
    setUploading(true)
    setResult(null)
    let created = 0, updated = 0, errors = 0, zeroed = 0

    try {
      if (tab === 'store') {
        if (mode === 'replace') {
          // Cancella tutto e ricrea
          await supabase.from('products').delete().eq('store_id', selectedId)
          for (const p of parsedRows as ParsedProduct[]) {
            const { error } = await supabase.from('products').insert({
              store_id: selectedId, name: p.name.trim(), category: p.category || 'other',
              stock: p.stock, price: p.price || 0, barcode: p.barcode || null, is_active: true, unit: 'pz',
            })
            if (error) errors++; else created++
          }
        } else {
          // MERGE / CONTEGGIO: aggiorna stock esistenti, crea nuovi
          // 1. Prendi tutti i prodotti attuali dello store
          const { data: allProducts } = await supabase.from('products').select('id, name').eq('store_id', selectedId)
          const existingMap = new Map<string, string>() // name_lower -> id
          for (const prod of (allProducts || [])) {
            existingMap.set(prod.name.trim().toLowerCase(), prod.id)
          }
          
          const matchedIds = new Set<string>()
          
          for (const p of parsedRows as ParsedProduct[]) {
            const nameKey = p.name.trim().toLowerCase()
            const existingId = existingMap.get(nameKey)
            
            if (existingId) {
              // Prodotto esiste: aggiorna stock + campi
              const { error } = await supabase.from('products').update({
                stock: p.stock,
                ...(p.category ? { category: p.category } : {}),
                ...(p.price ? { price: p.price } : {}),
                ...(p.barcode ? { barcode: p.barcode } : {}),
              }).eq('id', existingId)
              if (error) errors++; else updated++
              matchedIds.add(existingId)
            } else {
              // Prodotto nuovo: crea
              const { error } = await supabase.from('products').insert({
                store_id: selectedId, name: p.name.trim(), category: p.category || 'other',
                stock: p.stock, price: p.price || 0, barcode: p.barcode || null, is_active: true, unit: 'pz',
              })
              if (error) errors++; else created++
            }
          }
          
          // Se mode è 'inventory': azzera stock dei prodotti NON nel file
          if (mode === 'inventory') {
            for (const [, prodId] of existingMap) {
              if (!matchedIds.has(prodId)) {
                await supabase.from('products').update({ stock: 0 }).eq('id', prodId)
                zeroed++
              }
            }
          }
        }
      } else {
        // Warehouse stock
        if (mode === 'replace') {
          await supabase.from('warehouse_stock').delete().eq('warehouse_id', selectedId)
        }

        for (const item of parsedRows as ParsedWarehouseItem[]) {
          if (mode === 'merge') {
            const { data: existing } = await supabase.from('warehouse_stock').select('id').eq('warehouse_id', selectedId).ilike('product_name', item.product_name).single()
            if (existing) {
              const { error } = await supabase.from('warehouse_stock').update({ qty: item.qty, ...(item.category ? { category: item.category } : {}) }).eq('id', existing.id)
              if (error) errors++; else updated++
            } else {
              const { error } = await supabase.from('warehouse_stock').insert({
                warehouse_id: selectedId, product_name: item.product_name, qty: item.qty, sku: item.sku || null, category: item.category || null,
              })
              if (error) errors++; else created++
            }
          } else {
            const { error } = await supabase.from('warehouse_stock').insert({
              warehouse_id: selectedId, product_name: item.product_name, qty: item.qty, sku: item.sku || null, category: item.category || null,
            })
            if (error) errors++; else created++
          }
        }
      }

      setResult({ created, updated, errors, zeroed })
    } catch (err: any) {
      setResult({ error: err.message })
    }
    setUploading(false)
  }

  const targetName = tab === 'store'
    ? stores.find(s => s.id === selectedId)?.name || ''
    : warehouses.find(w => w.id === selectedId)?.name || ''

  function downloadTemplate() {
    const headers = tab === 'store'
      ? [['name', 'category', 'stock', 'price', 'barcode'], ['OG Kush 2g', 'flowers', '10', '15.00', ''], ['Grinder MM', 'accessories', '5', '8.00', '123456'], ['CBD Oil 10%', 'oils', '20', '29.90', '']]
      : [['product_name', 'category', 'qty', 'sku'], ['OG Kush Sfuso', 'flowers', '500', 'OGK-S'], ['Amnesia Sfuso', 'flowers', '300', 'AMN-S'], ['Grinder MM', 'accessories', '50', 'GRD-MM']]
    const ws = XLSX.utils.aoa_to_sheet(headers)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, tab === 'store' ? 'Prodotti' : 'Magazzino')
    ws['!cols'] = tab === 'store'
      ? [{wch:30},{wch:15},{wch:8},{wch:10},{wch:15}]
      : [{wch:30},{wch:15},{wch:10},{wch:15}]
    XLSX.writeFile(wb, `template_${tab === 'store' ? 'prodotti_store' : 'stock_magazzino'}.xlsx`)
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 4 }}>📦 Bulk Upload Inventario</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 'var(--space-xl)' }}>
        Carica prodotti via CSV per store o magazzini
      </p>

      {/* Tab Store / Warehouse */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 'var(--space-lg)', background: 'var(--bg-surface)', borderRadius: 10, padding: 3 }}>
        <button
          onClick={() => { setTab('store'); setParsedRows([]); setResult(null); setSelectedId(stores[0]?.id || '') }}
          style={{ flex: 1, padding: '10px 16px', borderRadius: 8, border: 'none', background: tab === 'store' ? 'var(--bg-primary)' : 'transparent', fontWeight: tab === 'store' ? 700 : 400, cursor: 'pointer', fontSize: 14, color: tab === 'store' ? 'var(--text-primary)' : 'var(--text-secondary)' }}
        >
          🏠 Stock Store
        </button>
        <button
          onClick={() => { setTab('warehouse'); setParsedRows([]); setResult(null); setSelectedId(warehouses[0]?.id || '') }}
          style={{ flex: 1, padding: '10px 16px', borderRadius: 8, border: 'none', background: tab === 'warehouse' ? 'var(--bg-primary)' : 'transparent', fontWeight: tab === 'warehouse' ? 700 : 400, cursor: 'pointer', fontSize: 14, color: tab === 'warehouse' ? 'var(--text-primary)' : 'var(--text-secondary)' }}
        >
          🏭 Stock Magazzino
        </button>
      </div>

      {/* Destinazione */}
      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 8, color: 'var(--text-secondary)' }}>
          📍 {tab === 'store' ? 'Store destinazione' : 'Magazzino destinazione'}
        </label>
        <select className="input" value={selectedId} onChange={e => setSelectedId(e.target.value)} style={{ marginBottom: 12 }}>
          <option value="">Seleziona...</option>
          {(tab === 'store' ? stores : warehouses).map(x => (
            <option key={x.id} value={x.id}>{x.name}{x.type ? ` (${x.type})` : ''}</option>
          ))}
        </select>

        <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 8, color: 'var(--text-secondary)' }}>
          ⚙️ Modalità
        </label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => setMode('inventory')} style={{ flex: 1, minWidth: 140, padding: '8px 12px', borderRadius: 8, border: 'none', background: mode === 'inventory' ? 'var(--brand-primary)' : 'var(--bg-surface)', color: mode === 'inventory' ? 'white' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
            📋 Conteggio Inventario
          </button>
          <button onClick={() => setMode('merge')} style={{ flex: 1, minWidth: 140, padding: '8px 12px', borderRadius: 8, border: 'none', background: mode === 'merge' ? 'var(--brand-primary)' : 'var(--bg-surface)', color: mode === 'merge' ? 'white' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
            🔄 Merge
          </button>
          <button onClick={() => setMode('replace')} style={{ flex: 1, minWidth: 140, padding: '8px 12px', borderRadius: 8, border: 'none', background: mode === 'replace' ? 'var(--danger)' : 'var(--bg-surface)', color: mode === 'replace' ? 'white' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
            🗑️ Sostituisci tutto
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
          {mode === 'inventory' && '📋 Aggiorna stock in base al conteggio reale. Prodotti non nel file → stock a 0.'}
          {mode === 'merge' && '🔄 Aggiorna prodotti esistenti e crea quelli nuovi. Non tocca prodotti non nel file.'}
          {mode === 'replace' && '🗑️ Cancella TUTTI i prodotti e li ricrea dal file. Attenzione: irreversibile!'}
        </div>
      </div>

      {/* Template + Upload */}
      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', margin: 0 }}>
            📄 Carica Excel / CSV
          </label>
          <button onClick={downloadTemplate} className="btn btn-secondary" style={{ fontSize: 12, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
            📥 Scarica Template Excel
          </button>
        </div>

        <div style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {tab === 'store' ? (
            <><strong>Colonne richieste:</strong> <code>name</code> (nome prodotto), <code>category</code> (flowers/hashish/accessories/oils/seeds/food/cosmetics/clothes/vape), <code>stock</code> (quantità), <code>price</code> (prezzo €), <code>barcode</code> (opzionale)</>
          ) : (
            <><strong>Colonne richieste:</strong> <code>product_name</code> (nome prodotto), <code>category</code> (flowers/hashish/accessories/oils/vape...), <code>qty</code> (quantità), <code>sku</code> (opzionale)</>
          )}
        </div>

        <div style={{ background: 'var(--bg-surface)', borderRadius: 10, padding: 16, marginBottom: 12, border: '2px dashed var(--border-default)', textAlign: 'center', cursor: 'pointer' }} onClick={() => fileRef.current?.click()}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Clicca per caricare un file Excel o CSV</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
            {tab === 'store' ? 'Colonne: name, category, stock, price, barcode' : 'Colonne: product_name, qty, sku'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--brand-primary)', marginTop: 2 }}>Formati: .xlsx, .xls, .csv</div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.txt,.tsv" onChange={handleFileUpload} style={{ display: 'none' }} />
        </div>

        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textAlign: 'center', marginBottom: 8 }}>— oppure incolla i dati —</div>

        <textarea
          className="input"
          placeholder={tab === 'store'
            ? 'name,category,stock,price\nOG Kush 2g,flowers,10,15.00\nGrinder MM,accessories,5,8.00'
            : 'product_name,qty\nOG Kush Sfuso,500\nAmnesia Sfuso,300'}
          value={csvText}
          onChange={e => setCsvText(e.target.value)}
          style={{ minHeight: 120, fontFamily: 'monospace', fontSize: 12 }}
        />
        <button onClick={handleTextParse} className="btn btn-secondary" style={{ marginTop: 8, fontSize: 13 }}>
          🔍 Analizza dati
        </button>
      </div>

      {parseError && (
        <div style={{ background: '#FEF2F2', border: '1px solid var(--danger)', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: 'var(--danger)' }}>
          ❌ {parseError}
        </div>
      )}

      {/* Preview */}
      {parsedRows.length > 0 && !result && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <h4>📋 Anteprima — {parsedRows.length} righe</h4>
            <span className="badge badge-brand">{targetName}</span>
          </div>
          <div className="table-wrapper" style={{ maxHeight: 300, overflow: 'auto' }}>
            <table>
              <thead>
                {tab === 'store' ? (
                  <tr><th>Nome</th><th>Categoria</th><th>Stock</th><th>Prezzo</th></tr>
                ) : (
                  <tr><th>Prodotto</th><th>Categoria</th><th>Qty</th><th>SKU</th></tr>
                )}
              </thead>
              <tbody>
                {parsedRows.slice(0, 50).map((r, i) => (
                  tab === 'store' ? (
                    <tr key={i}><td style={{ fontWeight: 600 }}>{r.name}</td><td>{r.category}</td><td>{r.stock}</td><td>{r.price ? `€${r.price}` : '-'}</td></tr>
                  ) : (
                    <tr key={i}><td style={{ fontWeight: 600 }}>{r.product_name}</td><td>{r.category || '-'}</td><td>{r.qty}</td><td>{r.sku || '-'}</td></tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
          {parsedRows.length > 50 && <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>...e altre {parsedRows.length - 50} righe</p>}

          <button
            onClick={handleUpload}
            disabled={uploading || !selectedId}
            className="btn btn-primary btn-full"
            style={{ marginTop: 16, padding: '14px 24px', fontSize: 15, fontWeight: 700 }}
          >
            {uploading ? '⏳ Caricamento in corso...' : `🚀 Carica ${parsedRows.length} ${tab === 'store' ? 'prodotti' : 'articoli'} in "${targetName}"`}
          </button>
        </div>
      )}

      {/* Result */}
      {result && !result.error && (
        <div className="card" style={{ background: '#F0FDF4', border: '1.5px solid var(--success)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
            <h3 style={{ color: 'var(--success)', marginBottom: 12 }}>Caricamento completato!</h3>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 20, fontSize: 14, flexWrap: 'wrap' }}>
              <div><strong>{result.created}</strong> creati</div>
              <div><strong>{result.updated}</strong> aggiornati</div>
              {result.zeroed > 0 && <div style={{ color: 'var(--warning)' }}><strong>{result.zeroed}</strong> azzerati</div>}
              <div style={{ color: result.errors > 0 ? 'var(--danger)' : 'var(--text-tertiary)' }}><strong>{result.errors}</strong> errori</div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
              <button onClick={() => { setParsedRows([]); setResult(null); setCsvText('') }} className="btn btn-secondary">📦 Carica altro</button>
              <button onClick={() => router.push(tab === 'store' ? '/owner/products' : '/owner/warehouse')} className="btn btn-primary">
                Vai a {tab === 'store' ? 'Prodotti' : 'Magazzino'} →
              </button>
            </div>
          </div>
        </div>
      )}

      {result?.error && (
        <div className="card" style={{ background: '#FEF2F2', border: '1.5px solid var(--danger)' }}>
          <h4 style={{ color: 'var(--danger)' }}>❌ Errore</h4>
          <p style={{ fontSize: 13 }}>{result.error}</p>
        </div>
      )}
    </div>
  )
}
