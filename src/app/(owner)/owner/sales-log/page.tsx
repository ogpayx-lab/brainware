'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmt } from '@/lib/utils'
import { useT } from '@/lib/i18n'

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
  notes: string
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
  const t = useT()
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
  const [ownerId, setOwnerId] = useState<string | null>(null)

  // Manual sale modal
  const [showManual, setShowManual] = useState(false)
  const [manualStore, setManualStore] = useState('')
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0])
  const [manualTime, setManualTime] = useState(() => { const n = new Date(); return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}` })
  const [manualMethod, setManualMethod] = useState<'cash' | 'pos'>('cash')
  const [manualCustomer, setManualCustomer] = useState('')
  const [manualNationality, setManualNationality] = useState('Italia')
  const [manualProducts, setManualProducts] = useState<any[]>([])
  const [manualCart, setManualCart] = useState<{ id: string; name: string; price: number; qty: number }[]>([])
  const [manualSearch, setManualSearch] = useState('')
  const [savingManual, setSavingManual] = useState(false)

  useEffect(() => { loadStores() }, [])
  useEffect(() => { if (orgStoreIds.length > 0) loadSales() }, [selectedStore, dateFrom, dateTo, orgStoreIds])

  async function loadStores() {
    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('users').select('store_id, role').eq('id', user.id).single()
    if (profile?.role !== 'owner') { router.push('/login'); return }
    setOwnerId(user.id)
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
        movement_type, invoice_number, store_id, user_id, total, notes,
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
        .select('id, created_at, payment_method, customer_name, customer_nationality, movement_type, invoice_number, store_id, user_id, total, notes, sale_items(product_name, qty, unit_price, line_total), stores(name)')
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
          movementType: sale.movement_type || 'sale', notes: sale.notes || '', saleIndex, isFirstInGroup: true, itemsInSale: 1,
        })
      } else {
        items.forEach((item, idx) => {
          allRows.push({
            saleId: sale.id, date: dateStr, time: timeStr, productName: item.product_name,
            price: item.unit_price, qty: item.qty, lineTotal: item.line_total,
            paymentMethod: sale.payment_method, customerName: sale.customer_name || '',
            nationality: sale.customer_nationality || '', employee: empName,
            storeName: (sale.stores as any)?.name || '', invoiceNumber: sale.invoice_number,
            movementType: sale.movement_type || 'sale', notes: sale.notes || '', saleIndex, isFirstInGroup: idx === 0, itemsInSale: items.length,
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

  async function openManualModal() {
    setShowManual(true)
    setManualCart([])
    setManualSearch('')
    setManualCustomer('')
    setManualNationality('Italia')
    setManualMethod('cash')
    if (stores.length > 0 && !manualStore) setManualStore(stores[0].id)
  }

  async function loadManualProducts(storeId: string) {
    const { data } = await supabase.from('products').select('id, name, price').eq('store_id', storeId).eq('is_active', true).order('name')
    setManualProducts(data ?? [])
  }

  useEffect(() => { if (manualStore) loadManualProducts(manualStore) }, [manualStore])

  function addToManualCart(prod: any) {
    setManualCart(prev => {
      const existing = prev.find(p => p.id === prod.id)
      if (existing) return prev.map(p => p.id === prod.id ? { ...p, qty: p.qty + 1 } : p)
      return [...prev, { id: prod.id, name: prod.name, price: prod.price, qty: 1 }]
    })
    setManualSearch('')
  }

  async function submitManualSale() {
    if (!manualStore || !ownerId || manualCart.length === 0) return
    setSavingManual(true)
    try {
      // Find the OPEN shift for this store (same as employee dashboard uses)
      let { data: existingShift } = await supabase.from('shifts').select('id')
        .eq('store_id', manualStore).eq('status', 'open').order('created_at', { ascending: false }).limit(1).single()

      // Fallback: if no open shift, use the most recent one
      if (!existingShift) {
        const { data: recentShift } = await supabase.from('shifts').select('id')
          .eq('store_id', manualStore).order('created_at', { ascending: false }).limit(1).single()
        existingShift = recentShift
      }

      let shiftId = existingShift?.id
      if (!shiftId) {
        const { data: newShift } = await supabase.from('shifts').insert({
          store_id: manualStore, user_id: ownerId, period: 'morning', status: 'closed',
          fce: 0, opened_at: `${manualDate}T08:00:00`, closed_at: `${manualDate}T23:00:00`,
        }).select('id').single()
        shiftId = newShift?.id
      }
      if (!shiftId) { alert('Errore: impossibile creare turno'); setSavingManual(false); return }

      const subtotal = manualCart.reduce((s, p) => s + p.price * p.qty, 0)
      const localDate = new Date(`${manualDate}T${manualTime}:00`)
      const createdAt = localDate.toISOString()

      const { data: sale, error: saleErr } = await supabase.from('sales').insert({
        shift_id: shiftId, store_id: manualStore, user_id: ownerId, created_by: ownerId,
        movement_type: 'sale', payment_method: manualMethod,
        subtotal, discount_amount: 0, discount_pct: 0, total: subtotal,
        customer_name: manualCustomer || null, customer_nationality: manualNationality || null,
        created_at: createdAt,
      }).select('id').single()

      if (saleErr || !sale) {
        alert(`Errore: ${saleErr?.message || 'Vendita non creata'}`)
        setSavingManual(false)
        return
      }

      await supabase.from('sale_items').insert(
        manualCart.map(p => ({
          sale_id: sale.id, product_id: p.id, product_name: p.name,
          qty: p.qty, unit_price: p.price, line_total: p.price * p.qty,
        }))
      )

      // Update stock (atomic decrement via increment_stock with negative qty)
      for (const p of manualCart) {
        await supabase.rpc('increment_stock', { product_id: p.id, qty: -p.qty })
      }

      setShowManual(false)
      setSavingManual(false)
      loadSales()
    } catch (err: any) {
      alert(`Errore: ${err.message}`)
      setSavingManual(false)
    }
  }

  const manualTotal = manualCart.reduce((s, p) => s + p.price * p.qty, 0)
  const filteredManualProducts = manualProducts.filter(p =>
    manualSearch && p.name.toLowerCase().includes(manualSearch.toLowerCase())
  ).slice(0, 8)

  const uniqueSales = new Set(rows.map(r => r.saleId)).size
  const totalRevenue = rows.reduce((s, r) => s + r.lineTotal, 0)

  if (loading && stores.length === 0) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-secondary)' }}>{t('loading')}</div>

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>🧾 Registro Vendite</h2>
          <p style={{ color: '#6B7280', fontSize: 13 }}>Dettaglio vendite per negozio — esportabile in Excel</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={openManualModal}
            style={{ background: '#7C3AED', color: 'white', border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            ➕ Vendita Manuale
          </button>
          <button onClick={exportToExcel} disabled={exporting || rows.length === 0}
            style={{ background: '#16A34A', color: 'white', border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: rows.length === 0 ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            📥 {exporting ? t('loading') : t('sales.exportExcel')}
          </button>
        </div>
      </div>

      {/* Store Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 10, borderBottom: '2px solid #E5E7EB', overflowX: 'auto' }}>
        <button onClick={() => setSelectedStore('all')}
          style={{
            padding: '8px 18px', fontSize: 12, fontWeight: selectedStore === 'all' ? 700 : 500,
            border: selectedStore === 'all' ? '2px solid #16A34A' : '1px solid #D1D5DB',
            borderBottom: selectedStore === 'all' ? '2px solid white' : 'none',
            background: selectedStore === 'all' ? 'white' : '#F9FAFB',
            color: selectedStore === 'all' ? '#16A34A' : '#6B7280',
            borderRadius: '6px 6px 0 0', cursor: 'pointer', marginBottom: -2, whiteSpace: 'nowrap',
          }}>
          {t('all')}
        </button>
        {stores.map(s => (
          <button key={s.id} onClick={() => setSelectedStore(s.id)}
            style={{
              padding: '8px 18px', fontSize: 12, fontWeight: selectedStore === s.id ? 700 : 500,
              border: selectedStore === s.id ? '2px solid #16A34A' : '1px solid #D1D5DB',
              borderBottom: selectedStore === s.id ? '2px solid white' : 'none',
              background: selectedStore === s.id ? 'white' : '#F9FAFB',
              color: selectedStore === s.id ? '#16A34A' : '#6B7280',
              borderRadius: '6px 6px 0 0', cursor: 'pointer', marginBottom: -2, whiteSpace: 'nowrap',
            }}>
            {s.name}
          </button>
        ))}
      </div>

      {/* Filters — compact bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>{t('from')}:</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ fontSize: 12, padding: '4px 8px', border: '1px solid #D1D5DB', borderRadius: 4 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>{t('to')}:</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{ fontSize: 12, padding: '4px 8px', border: '1px solid #D1D5DB', borderRadius: 4 }} />
        </div>
        <div style={{ width: 1, height: 20, background: '#D1D5DB' }} />
        <span style={{ fontSize: 12, color: '#6B7280' }}>
          <strong>{uniqueSales}</strong> {t('orders')} · <strong>{rows.length}</strong> {t('rows')} · <strong style={{ color: '#16A34A' }}>{fmt(totalRevenue)}</strong>
        </span>
      </div>

      {/* Excel-style table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>{t('loading')}</div>
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
                  <th style={HEADER_CELL}>{t('date')}</th>
                  <th style={HEADER_CELL}>{t('time')}</th>
                  <th style={HEADER_CELL}>{t('sales.store')}</th>
                  <th style={HEADER_CELL}>{t('products')}</th>
                  <th style={{ ...HEADER_CELL, textAlign: 'right' }}>{t('price')}</th>
                  <th style={{ ...HEADER_CELL, textAlign: 'center' }}>{t('qty')}</th>
                  <th style={{ ...HEADER_CELL, textAlign: 'right' }}>{t('total')}</th>
                  <th style={{ ...HEADER_CELL, textAlign: 'center' }}>{t('sales.payment')}</th>
                  <th style={HEADER_CELL}>{t('sales.customerName')}</th>
                  <th style={HEADER_CELL}>{t('sales.nationality')}</th>
                  <th style={HEADER_CELL}>{t('sales.employee')}</th>
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
                            background: row.paymentMethod === 'cash' ? '#DCFCE7' : row.paymentMethod === 'split' ? '#FEF3C7' : row.paymentMethod === 'other' ? '#F3F4F6' : '#EDE9FE',
                            color: row.paymentMethod === 'cash' ? '#166534' : row.paymentMethod === 'split' ? '#92400E' : row.paymentMethod === 'other' ? '#6B7280' : '#5B21B6',
                          }}>
                            {row.paymentMethod === 'cash' ? '💵 CASH' : row.paymentMethod === 'split' ? '💵💳 SPLIT' : row.paymentMethod === 'other' ? '🔄 ALTRO' : '💳 POS'}
                          </span>
                        )}
                      </td>
                      <td style={{ ...CELL, borderTop: borderTopStyle, color: '#374151' }}>
                        {row.isFirstInGroup ? (
                          row.movementType === 'autoconsumo' ? (
                            <span style={{ color: '#D97706' }}>🍃 {row.notes || 'Autoconsumo'}</span>
                          ) : row.movementType === 'online' ? (
                            <span style={{ color: '#2563EB' }}>📦 {row.notes || 'Ordine Online'}</span>
                          ) : row.customerName || <span style={{ color: '#9CA3AF' }}>—</span>
                        ) : ''}
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
      {/* Manual Sale Modal */}
      {showManual && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h4>➕ Vendita Manuale</h4>
              <button onClick={() => setShowManual(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>Negozio</label>
                <select className="input" value={manualStore} onChange={e => setManualStore(e.target.value)} style={{ height: 36, fontSize: 12 }}>
                  {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>Pagamento</label>
                <select className="input" value={manualMethod} onChange={e => setManualMethod(e.target.value as any)} style={{ height: 36, fontSize: 12 }}>
                  <option value="cash">💵 Contanti</option>
                  <option value="pos">💳 POS</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>Data</label>
                <input className="input" type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} style={{ height: 36, fontSize: 12 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>Ora</label>
                <input className="input" type="time" value={manualTime} onChange={e => setManualTime(e.target.value)} style={{ height: 36, fontSize: 12 }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>Cliente</label>
                <input className="input" placeholder="Nome cliente" value={manualCustomer} onChange={e => setManualCustomer(e.target.value)} style={{ height: 36, fontSize: 12 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>Nazionalità</label>
                <input className="input" placeholder="Nazionalità" value={manualNationality} onChange={e => setManualNationality(e.target.value)} style={{ height: 36, fontSize: 12 }} />
              </div>
            </div>

            {/* Product search */}
            <div style={{ marginBottom: 12, position: 'relative' }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>Aggiungi Prodotti</label>
              <input className="input" placeholder="🔍 Cerca prodotto..." value={manualSearch} onChange={e => setManualSearch(e.target.value)} style={{ height: 36, fontSize: 12 }} />
              {filteredManualProducts.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999, background: 'var(--bg-primary)', border: '1px solid var(--border-default)', borderRadius: 8, maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                  {filteredManualProducts.map(p => (
                    <div key={p.id} onClick={() => addToManualCart(p)}
                      style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <span>{p.name}</span>
                      <span style={{ fontWeight: 700, color: '#16A34A' }}>{fmt(p.price)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cart */}
            {manualCart.length > 0 && (
              <div style={{ background: '#F9FAFB', borderRadius: 8, padding: 10, marginBottom: 12 }}>
                {manualCart.map((item, i) => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < manualCart.length - 1 ? '1px solid #E5E7EB' : 'none' }}>
                    <span style={{ fontSize: 13, flex: 1 }}>{item.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button onClick={() => setManualCart(prev => prev.map(p => p.id === item.id ? { ...p, qty: Math.max(1, p.qty - 1) } : p))} style={{ width: 24, height: 24, border: '1px solid #D1D5DB', borderRadius: 4, background: 'white', cursor: 'pointer', fontSize: 14 }}>−</button>
                      <span style={{ fontWeight: 700, minWidth: 20, textAlign: 'center', fontSize: 13 }}>{item.qty}</span>
                      <button onClick={() => setManualCart(prev => prev.map(p => p.id === item.id ? { ...p, qty: p.qty + 1 } : p))} style={{ width: 24, height: 24, border: '1px solid #D1D5DB', borderRadius: 4, background: 'white', cursor: 'pointer', fontSize: 14 }}>+</button>
                      <span style={{ fontWeight: 700, fontSize: 13, minWidth: 60, textAlign: 'right' }}>{fmt(item.price * item.qty)}</span>
                      <button onClick={() => setManualCart(prev => prev.filter(p => p.id !== item.id))} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: 16 }}>✕</button>
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, marginTop: 4, borderTop: '2px solid #D1D5DB', fontWeight: 700, fontSize: 15 }}>
                  <span>Totale</span>
                  <span style={{ color: '#16A34A' }}>{fmt(manualTotal)}</span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowManual(false)}>{t('cancel')}</button>
              <button className="btn btn-primary" style={{ flex: 2 }}
                disabled={savingManual || manualCart.length === 0}
                onClick={submitManualSale}>
                {savingManual ? t('saving') : `✅ Registra Vendita (${fmt(manualTotal)})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
