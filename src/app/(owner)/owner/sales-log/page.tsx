'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmt } from '@/lib/utils'

interface SaleRow {
  saleId: string
  date: string
  time: string
  productName: string
  price: number
  qty: number
  lineTotal: number
  paymentMethod: string
  customerName: string
  nationality: string
  employee: string
  storeName: string
  invoiceNumber: string | null
  movementType: string
  // For grouping
  saleIndex: number
  isFirstInGroup: boolean
  itemsInSale: number
}

export default function SalesLogPage() {
  const router = useRouter()
  const supabase = createClient()
  const [rows, setRows] = useState<SaleRow[]>([])
  const [stores, setStores] = useState<any[]>([])
  const [selectedStore, setSelectedStore] = useState('all')
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7)
    return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)
  const [orgStoreIds, setOrgStoreIds] = useState<string[]>([])
  const [exporting, setExporting] = useState(false)

  useEffect(() => { loadStores() }, [])
  useEffect(() => { if (orgStoreIds.length > 0) loadSales() }, [selectedStore, dateFrom, dateTo, orgStoreIds])

  async function loadStores() {
    const { data: { user } } = await supabase.auth.getUser()
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

  async function loadSales() {
    setLoading(true)
    const fromDate = `${dateFrom}T00:00:00`
    const toDate = `${dateTo}T23:59:59`

    const storeIds = selectedStore === 'all' ? orgStoreIds : [selectedStore]

    let query = supabase
      .from('sales')
      .select('id, created_at, payment_method, customer_name, customer_nationality, movement_type, invoice_number, store_id, user_id, total, sale_items(product_name, qty, unit_price, line_total), users(full_name), stores(name)')
      .gte('created_at', fromDate)
      .lte('created_at', toDate)
      .order('created_at', { ascending: false })

    if (selectedStore !== 'all') {
      query = query.eq('store_id', storeIds[0])
    } else {
      query = query.in('store_id', storeIds)
    }

    const { data: sales } = await query.limit(500)

    const allRows: SaleRow[] = []
    let saleIndex = 0

    for (const sale of (sales ?? [])) {
      const items = (sale.sale_items as any[]) ?? []
      const dt = new Date(sale.created_at)
      const dateStr = dt.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
      const timeStr = dt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })

      if (items.length === 0) {
        // Sale without items (edge case)
        allRows.push({
          saleId: sale.id,
          date: dateStr,
          time: timeStr,
          productName: '—',
          price: sale.total,
          qty: 1,
          lineTotal: sale.total,
          paymentMethod: sale.payment_method,
          customerName: sale.customer_name || '',
          nationality: sale.customer_nationality || '',
          employee: (sale.users as any)?.full_name || '',
          storeName: (sale.stores as any)?.name || '',
          invoiceNumber: sale.invoice_number,
          movementType: sale.movement_type || 'sale',
          saleIndex,
          isFirstInGroup: true,
          itemsInSale: 1,
        })
      } else {
        items.forEach((item, idx) => {
          allRows.push({
            saleId: sale.id,
            date: dateStr,
            time: timeStr,
            productName: item.product_name,
            price: item.unit_price,
            qty: item.qty,
            lineTotal: item.line_total,
            paymentMethod: sale.payment_method,
            customerName: sale.customer_name || '',
            nationality: sale.customer_nationality || '',
            employee: (sale.users as any)?.full_name || '',
            storeName: (sale.stores as any)?.name || '',
            invoiceNumber: sale.invoice_number,
            movementType: sale.movement_type || 'sale',
            saleIndex,
            isFirstInGroup: idx === 0,
            itemsInSale: items.length,
          })
        })
      }
      saleIndex++
    }

    setRows(allRows)
    setLoading(false)
  }

  function exportToExcel() {
    setExporting(true)

    // Build CSV content (Excel-compatible with BOM for UTF-8)
    const headers = ['Data', 'Ora', 'Negozio', 'N° Vendita', 'Prodotto', 'Prezzo Unitario', 'Quantità', 'Totale Riga', 'Metodo Pagamento', 'Cliente', 'Nazionalità', 'Referente', 'Tipo Movimento']
    const csvRows = [headers.join(';')]

    for (const row of rows) {
      const line = [
        row.date,
        row.time,
        row.storeName,
        row.invoiceNumber || row.saleId.slice(0, 8),
        row.productName,
        row.price.toFixed(2).replace('.', ','),
        row.qty.toString().replace('.', ','),
        row.lineTotal.toFixed(2).replace('.', ','),
        row.paymentMethod === 'cash' ? 'Cash' : 'POS',
        row.customerName,
        row.nationality,
        row.employee,
        row.movementType === 'sale' ? 'Vendita' : row.movementType === 'reso' ? 'Reso' : row.movementType,
      ].map(v => `"${(v || '').replace(/"/g, '""')}"`)
      csvRows.push(line.join(';'))
    }

    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `registro_vendite_${dateFrom}_${dateTo}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setExporting(false)
  }

  // Group colors for alternating sale groups
  const getGroupBg = (idx: number) => idx % 2 === 0 ? 'transparent' : 'var(--bg-surface)'

  const PAYMENT_BADGE: Record<string, { label: string; cls: string }> = {
    cash: { label: '💵 Cash', cls: 'badge-success' },
    pos: { label: '💳 POS', cls: 'badge-indigo' },
  }

  const totalRevenue = rows.filter(r => r.isFirstInGroup && r.movementType === 'sale').reduce((s, r) => {
    const saleRows = rows.filter(x => x.saleId === r.saleId)
    return s + saleRows.reduce((ss, x) => ss + x.lineTotal, 0)
  }, 0)
  const uniqueSales = new Set(rows.map(r => r.saleId)).size

  if (loading && stores.length === 0) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>Caricamento...</div>

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-lg)' }}>
        <div>
          <h2>🧾 Registro Vendite</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>
            Dettaglio vendite per negozio — esportabile in Excel
          </p>
        </div>
        <button className="btn btn-primary" onClick={exportToExcel} disabled={exporting || rows.length === 0}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {exporting ? '...' : '📥 Esporta Excel'}
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="input-group" style={{ minWidth: 180, marginBottom: 0 }}>
          <label className="input-label">Negozio</label>
          <select className="input" value={selectedStore} onChange={e => setSelectedStore(e.target.value)}>
            <option value="all">Tutti i negozi</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="input-group" style={{ minWidth: 160, marginBottom: 0 }}>
          <label className="input-label">Da</label>
          <input type="date" className="input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className="input-group" style={{ minWidth: 160, marginBottom: 0 }}>
          <label className="input-label">A</label>
          <input type="date" className="input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
      </div>

      {/* Quick Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
        <div className="kpi-card">
          <div className="kpi-label">Vendite</div>
          <div className="kpi-value">{uniqueSales}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Righe Prodotto</div>
          <div className="kpi-value">{rows.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Revenue Totale</div>
          <div className="kpi-value" style={{ color: 'var(--brand-primary)' }}>{fmt(totalRevenue)}</div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-secondary)' }}>Caricamento vendite...</div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-tertiary)' }}>
          <span style={{ fontSize: 48, display: 'block', marginBottom: 12 }}>📋</span>
          <h3 style={{ color: 'var(--text-secondary)' }}>Nessuna vendita trovata</h3>
          <p style={{ fontSize: 14 }}>Prova a cambiare il periodo o il negozio selezionato.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrapper" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <table style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--bg-primary)', zIndex: 2 }}>Data</th>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--bg-primary)', zIndex: 2 }}>Ora</th>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--bg-primary)', zIndex: 2 }}>Negozio</th>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--bg-primary)', zIndex: 2 }}>Prodotto</th>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--bg-primary)', zIndex: 2 }}>Prezzo</th>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--bg-primary)', zIndex: 2 }}>Qty</th>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--bg-primary)', zIndex: 2 }}>Totale</th>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--bg-primary)', zIndex: 2 }}>Pagamento</th>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--bg-primary)', zIndex: 2 }}>Cliente</th>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--bg-primary)', zIndex: 2 }}>Nazionalità</th>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--bg-primary)', zIndex: 2 }}>Referente</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const bg = getGroupBg(row.saleIndex)
                  const isMultiItem = row.itemsInSale > 1
                  const badge = PAYMENT_BADGE[row.paymentMethod] || { label: row.paymentMethod, cls: 'badge-gray' }

                  return (
                    <tr key={`${row.saleId}-${i}`} style={{
                      background: bg,
                      borderTop: row.isFirstInGroup && i > 0 ? '2px solid var(--border-default)' : undefined,
                    }}>
                      <td style={{ fontWeight: row.isFirstInGroup ? 600 : 400, color: row.isFirstInGroup ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                        {row.isFirstInGroup ? row.date : ''}
                      </td>
                      <td style={{ color: row.isFirstInGroup ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                        {row.isFirstInGroup ? row.time : ''}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {row.isFirstInGroup ? row.storeName : ''}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {isMultiItem && (
                            <span style={{
                              width: 3, height: 20, borderRadius: 2,
                              background: 'var(--brand-primary)', flexShrink: 0,
                            }} />
                          )}
                          <span style={{ fontWeight: 600 }}>{row.productName}</span>
                        </div>
                      </td>
                      <td>{fmt(row.price)}</td>
                      <td style={{ fontWeight: 600 }}>{row.qty}</td>
                      <td style={{ fontWeight: 700, color: row.movementType === 'reso' ? 'var(--danger)' : 'var(--text-primary)' }}>
                        {row.movementType === 'reso' ? '-' : ''}{fmt(row.lineTotal)}
                      </td>
                      <td>
                        {row.isFirstInGroup && (
                          <span className={`badge ${badge.cls}`} style={{ fontSize: 10 }}>{badge.label}</span>
                        )}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {row.isFirstInGroup ? row.customerName : ''}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {row.isFirstInGroup ? row.nationality : ''}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {row.isFirstInGroup ? row.employee : ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>
            <span>{uniqueSales} vendite · {rows.length} righe prodotto</span>
            <span>Periodo: {dateFrom} → {dateTo}</span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div style={{ marginTop: 'var(--space-md)', display: 'flex', gap: 'var(--space-lg)', fontSize: 12, color: 'var(--text-tertiary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 3, height: 14, borderRadius: 2, background: 'var(--brand-primary)' }} />
          <span>Prodotti nella stessa vendita</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, background: 'var(--bg-surface)' }} />
          <span>Sfondo alternato = vendite diverse</span>
        </div>
      </div>
    </div>
  )
}
