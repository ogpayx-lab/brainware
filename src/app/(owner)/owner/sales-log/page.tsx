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
  saleIndex: number
  isFirstInGroup: boolean
  itemsInSale: number
}

const CELL: React.CSSProperties = {
  border: '1px solid #D1D5DB',
  padding: '5px 8px',
  fontSize: 12,
  whiteSpace: 'nowrap',
  verticalAlign: 'middle',
}
const HEADER_CELL: React.CSSProperties = {
  ...CELL,
  background: '#F3F4F6',
  fontWeight: 700,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  color: '#374151',
  position: 'sticky' as const,
  top: 0,
  zIndex: 2,
}

export default function SalesLogPage() {
  const router = useRouter()
  const supabase = createClient()
  const [rows, setRows] = useState<SaleRow[]>([])
  const [stores, setStores] = useState<any[]>([])
  const [selectedStore, setSelectedStore] = useState('all')
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30)
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

    // Fetch sales with items, user name, store name
    let query = supabase
      .from('sales')
      .select(`
        id, created_at, payment_method, customer_name, customer_nationality,
        movement_type, invoice_number, store_id, user_id, total,
        sale_items(product_name, qty, unit_price, line_total),
        users!sales_user_id_fkey(full_name),
        stores(name)
      `)
      .gte('created_at', fromDate)
      .lte('created_at', toDate)
      .order('created_at', { ascending: false })

    if (selectedStore !== 'all') query = query.eq('store_id', storeIds[0])
    else query = query.in('store_id', storeIds)

    const { data: sales, error } = await query.limit(1000)

    // Fallback: if the explicit FK hint fails, retry without it
    let salesData = sales
    if (error) {
      const { data: fallback } = await supabase
        .from('sales')
        .select('id, created_at, payment_method, customer_name, customer_nationality, movement_type, invoice_number, store_id, user_id, total, sale_items(product_name, qty, unit_price, line_total), stores(name)')
        .gte('created_at', fromDate)
        .lte('created_at', toDate)
        .in('store_id', storeIds)
        .order('created_at', { ascending: false })
        .limit(1000)
      salesData = fallback

      // Load user names separately
      if (salesData && salesData.length > 0) {
        const userIds = [...new Set(salesData.map((s: any) => s.user_id))]
        const { data: usersData } = await supabase.from('users').select('id, full_name').in('id', userIds)
        const userMap = new Map((usersData ?? []).map(u => [u.id, u.full_name]))
        salesData = salesData.map((s: any) => ({ ...s, _employee: userMap.get(s.user_id) || '' }))
      }
    }

    const allRows: SaleRow[] = []
    let saleIndex = 0

    for (const sale of (salesData ?? [])) {
      const items = (sale.sale_items as any[]) ?? []
      const dt = new Date(sale.created_at)
      const dateStr = dt.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
      const timeStr = dt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      const empName = (sale as any)._employee || (sale.users as any)?.full_name || ''

      if (items.length === 0) {
        allRows.push({
          saleId: sale.id, date: dateStr, time: timeStr, productName: '(nessun prodotto)',
          price: sale.total, qty: 1, lineTotal: sale.total,
          paymentMethod: sale.payment_method, customerName: sale.customer_name || '',
          nationality: sale.customer_nationality || '', employee: empName,
          storeName: (sale.stores as any)?.name || '', invoiceNumber: sale.invoice_number,
          movementType: sale.movement_type || 'sale', saleIndex, isFirstInGroup: true, itemsInSale: 1,
        })
      } else {
        items.forEach((item, idx) => {
          allRows.push({
            saleId: sale.id, date: dateStr, time: timeStr, productName: item.product_name,
            price: item.unit_price, qty: item.qty, lineTotal: item.line_total,
            paymentMethod: sale.payment_method, customerName: sale.customer_name || '',
            nationality: sale.customer_nationality || '', employee: empName,
            storeName: (sale.stores as any)?.name || '', invoiceNumber: sale.invoice_number,
            movementType: sale.movement_type || 'sale', saleIndex, isFirstInGroup: idx === 0, itemsInSale: items.length,
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
    const headers = ['Data', 'Ora', 'Negozio', 'N° Vendita', 'Prodotto', 'Prezzo Unitario', 'Quantità', 'Totale Riga', 'Metodo Pagamento', 'Cliente', 'Nazionalità', 'Referente', 'Tipo Movimento']
    const csvRows = [headers.join(';')]
    for (const row of rows) {
      const line = [
        row.date, row.time, row.storeName,
        row.invoiceNumber || row.saleId.slice(0, 8),
        row.productName,
        row.price.toFixed(2).replace('.', ','),
        row.qty.toString().replace('.', ','),
        row.lineTotal.toFixed(2).replace('.', ','),
        row.paymentMethod === 'cash' ? 'Cash' : 'POS',
        row.customerName, row.nationality, row.employee,
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

  const uniqueSales = new Set(rows.map(r => r.saleId)).size
  const totalRevenue = rows.reduce((s, r) => s + r.lineTotal, 0)

  if (loading && stores.length === 0) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-secondary)' }}>Caricamento...</div>

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>🧾 Registro Vendite</h2>
          <p style={{ color: '#6B7280', fontSize: 13 }}>Dettaglio vendite per negozio — esportabile in Excel</p>
        </div>
        <button onClick={exportToExcel} disabled={exporting || rows.length === 0}
          style={{
            background: '#16A34A', color: 'white', border: 'none', borderRadius: 6,
            padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            opacity: rows.length === 0 ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6,
          }}>
          📥 {exporting ? 'Esportazione...' : 'Esporta Excel'}
        </button>
      </div>

      {/* Filters — compact bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>Negozio:</label>
          <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)}
            style={{ fontSize: 12, padding: '4px 8px', border: '1px solid #D1D5DB', borderRadius: 4, background: 'white' }}>
            <option value="all">Tutti</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div style={{ width: 1, height: 20, background: '#D1D5DB' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>Da:</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ fontSize: 12, padding: '4px 8px', border: '1px solid #D1D5DB', borderRadius: 4 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>A:</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{ fontSize: 12, padding: '4px 8px', border: '1px solid #D1D5DB', borderRadius: 4 }} />
        </div>
        <div style={{ width: 1, height: 20, background: '#D1D5DB' }} />
        <span style={{ fontSize: 12, color: '#6B7280' }}>
          <strong>{uniqueSales}</strong> vendite · <strong>{rows.length}</strong> righe · <strong style={{ color: '#16A34A' }}>{fmt(totalRevenue)}</strong>
        </span>
      </div>

      {/* Excel-style table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Caricamento...</div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF', background: 'white', border: '1px solid #E5E7EB', borderRadius: 4 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#6B7280' }}>Nessuna vendita trovata</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Prova a cambiare il periodo o il negozio.</div>
        </div>
      ) : (
        <div style={{ border: '1px solid #9CA3AF', borderRadius: 4, overflow: 'hidden', background: 'white' }}>
          <div style={{ maxHeight: '72vh', overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
              <thead>
                <tr>
                  <th style={HEADER_CELL}>Data</th>
                  <th style={HEADER_CELL}>Ora</th>
                  <th style={HEADER_CELL}>Negozio</th>
                  <th style={HEADER_CELL}>Prodotto</th>
                  <th style={{ ...HEADER_CELL, textAlign: 'right' }}>Prezzo</th>
                  <th style={{ ...HEADER_CELL, textAlign: 'center' }}>Qty</th>
                  <th style={{ ...HEADER_CELL, textAlign: 'right' }}>Totale</th>
                  <th style={{ ...HEADER_CELL, textAlign: 'center' }}>Pagamento</th>
                  <th style={HEADER_CELL}>Cliente</th>
                  <th style={HEADER_CELL}>Nazionalità</th>
                  <th style={HEADER_CELL}>Referente</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const isEven = row.saleIndex % 2 === 0
                  const groupBg = isEven ? '#FFFFFF' : '#F9FAFB'
                  const isGroupStart = row.isFirstInGroup && i > 0
                  const borderTopStyle = isGroupStart ? '2.5px solid #6B7280' : undefined

                  return (
                    <tr key={`${row.saleId}-${i}`} style={{ background: groupBg }}>
                      <td style={{ ...CELL, borderTop: borderTopStyle, fontWeight: row.isFirstInGroup ? 600 : 400, color: row.isFirstInGroup ? '#111827' : '#D1D5DB' }}>
                        {row.isFirstInGroup ? row.date : '↳'}
                      </td>
                      <td style={{ ...CELL, borderTop: borderTopStyle, color: row.isFirstInGroup ? '#111827' : '#D1D5DB' }}>
                        {row.isFirstInGroup ? row.time : ''}
                      </td>
                      <td style={{ ...CELL, borderTop: borderTopStyle, color: '#6B7280' }}>
                        {row.isFirstInGroup ? row.storeName : ''}
                      </td>
                      <td style={{ ...CELL, borderTop: borderTopStyle, fontWeight: 500, color: '#111827', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {row.itemsInSale > 1 && !row.isFirstInGroup && (
                          <span style={{ color: '#16A34A', marginRight: 4, fontSize: 10 }}>┗</span>
                        )}
                        {row.productName}
                      </td>
                      <td style={{ ...CELL, borderTop: borderTopStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {row.price.toFixed(2)} €
                      </td>
                      <td style={{ ...CELL, borderTop: borderTopStyle, textAlign: 'center', fontWeight: 600 }}>
                        {row.qty}
                      </td>
                      <td style={{ ...CELL, borderTop: borderTopStyle, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: row.movementType === 'reso' ? '#DC2626' : '#111827' }}>
                        {row.movementType === 'reso' ? '-' : ''}{row.lineTotal.toFixed(2)} €
                      </td>
                      <td style={{ ...CELL, borderTop: borderTopStyle, textAlign: 'center' }}>
                        {row.isFirstInGroup && (
                          <span style={{
                            display: 'inline-block', padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 700,
                            background: row.paymentMethod === 'cash' ? '#DCFCE7' : '#EDE9FE',
                            color: row.paymentMethod === 'cash' ? '#166534' : '#5B21B6',
                          }}>
                            {row.paymentMethod === 'cash' ? 'CASH' : 'POS'}
                          </span>
                        )}
                      </td>
                      <td style={{ ...CELL, borderTop: borderTopStyle, color: '#374151' }}>
                        {row.isFirstInGroup ? row.customerName : ''}
                      </td>
                      <td style={{ ...CELL, borderTop: borderTopStyle, color: '#6B7280' }}>
                        {row.isFirstInGroup ? row.nationality : ''}
                      </td>
                      <td style={{ ...CELL, borderTop: borderTopStyle, color: '#374151' }}>
                        {row.isFirstInGroup ? row.employee : ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderTop: '2px solid #9CA3AF', background: '#F3F4F6', fontSize: 11, color: '#6B7280' }}>
            <span>{uniqueSales} vendite · {rows.length} righe prodotto</span>
            <span>{dateFrom} → {dateTo}</span>
          </div>
        </div>
      )}
    </div>
  )
}
