'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { fmt, formatTime } from '@/lib/utils'
import { playNotificationSound } from '@/lib/useNotificationSound'
import { useT } from '@/lib/i18n'

const TYPE_ICON: Record<string, string> = {
  day_off_request: '📅', sale: '💰', task_completed: '✅', task_assigned: '📋', low_stock: '⚠️',
  shift_open: '🟢', shift_close: '🔴', shift_checkin: '👤', maintenance: '🔧', checkout_alert: '⚠️',
  expense: '💸', fidelity: '💳', inventory_count: '📦', restock_request: '📥',
  stock_approved: '✅', stock_rejected: '❌', stock_transfer: '🔄', stock_counted: '📊', photo: '📸', default: '🔔',
}
const TYPE_ROUTE: Record<string, string> = {
  sale: '/owner/sales-log', task_completed: '/owner/tasks', task_assigned: '/owner/tasks',
  low_stock: '/owner/products', shift_open: '/owner/analytics/team', shift_close: '/owner/analytics/team',
  shift_checkin: '/owner/analytics/team', maintenance: '/owner/maintenance', expense: '/owner/reports',
  fidelity: '/owner/analytics/products', inventory_count: '/owner/inventory-audit',
  restock_request: '/owner/warehouse/stock-movements', stock_approved: '/owner/warehouse/stock-movements',
  stock_rejected: '/owner/warehouse/stock-movements', stock_transfer: '/owner/warehouse/stock-movements',
  stock_counted: '/owner/warehouse/stock-movements', day_off_request: '/owner/notifications',
}

export default function OwnerDashboard() {
  const router = useRouter()
  const supabase = createClient()
  const t = useT()
  const [data, setData] = useState<any>(null)
  const [stores, setStores] = useState<any[]>([])
  const [selectedStore, setSelectedStore] = useState('all')
  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [storeName, setStoreName] = useState('')
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0])
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0])

  // Shift time editing
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null)
  const [editTime, setEditTime] = useState('')
  const [savingShift, setSavingShift] = useState(false)

  // Notifications
  const [notifications, setNotifications] = useState<any[]>([])
  const [showAllNotifs, setShowAllNotifs] = useState(false)
  const prevNotifCount = useRef<number | null>(null)

  // Daily target
  const [dailyTarget, setDailyTarget] = useState(500)

  // Drill-down modal
  const [drillFilter, setDrillFilter] = useState<'cash' | 'pos' | 'split' | 'autoconsumo' | 'shopify' | null>(null)
  const [allSalesList, setAllSalesList] = useState<any[]>([])
  const [saleItemsMap, setSaleItemsMap] = useState<Record<string, any[]>>({})

  // Live clock
  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])

  // Day navigation
  function shiftDay(delta: number) {
    const d = new Date(dateFrom + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    const ds = d.toISOString().split('T')[0]
    setDateFrom(ds)
    setDateTo(ds)
  }
  function goToday() {
    const ds = new Date().toISOString().split('T')[0]
    setDateFrom(ds)
    setDateTo(ds)
  }

  useEffect(() => {
    loadData()
    const t = setInterval(loadData, 60000)
    return () => clearInterval(t)
  }, [selectedStore, dateFrom, dateTo])

  const loadNotifications = useCallback(async (orgStoreIds: string[]) => {
    const { data: notifs } = await supabase
      .from('notifications')
      .select('*, users(full_name), stores(name)')
      .in('store_id', orgStoreIds)
      .order('created_at', { ascending: false })
      .limit(30)
    setNotifications(notifs ?? [])
    const unread = (notifs ?? []).filter((n: any) => !n.read).length
    if (prevNotifCount.current !== null && unread > prevNotifCount.current) {
      playNotificationSound()
    }
    prevNotifCount.current = unread
  }, [])

  async function loadData() {
    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('users').select('store_id, role, full_name').eq('id', user.id).single()
    if (!profile || profile.role !== 'owner') { router.push('/login'); return }
    setStoreId(profile.store_id)

    const { data: storeData } = await supabase.from('stores').select('name, organization_id').eq('id', profile.store_id).single()
    setStoreName(storeData?.name ?? '')
    const oid = storeData?.organization_id
    const { data: storesData } = await supabase.from('stores').select('id,name').eq('organization_id', oid)
    setStores(storesData ?? [])

    const allStoreIds = (storesData ?? []).map((s: any) => s.id)
    loadNotifications(allStoreIds.length > 0 ? allStoreIds : [profile.store_id])

    // Load store config for daily target
    const { data: configData } = await supabase.from('store_config').select('*').eq('store_id', profile.store_id).single()
    if (configData?.daily_target) setDailyTarget(configData.daily_target)

    // Date range
    const dayStart = `${dateFrom}T00:00:00`
    const dayEnd = `${dateTo}T23:59:59`

    const isAll = selectedStore === 'all'
    const allStores = storesData ?? []
    const storeIds = isAll ? allStores.map(s => s.id) : [selectedStore || profile.store_id]

    // Sales (ALL movements including shopify)
    let salesQuery = supabase.from('sales').select('*').gte('created_at', dayStart).lte('created_at', dayEnd)
    if (!isAll) salesQuery = salesQuery.eq('store_id', storeIds[0])
    else salesQuery = salesQuery.in('store_id', storeIds)
    const { data: allSalesData } = await salesQuery
    setAllSalesList(allSalesData ?? [])

    // Sale items for top products AND drill-down
    const saleIds = (allSalesData ?? []).map((s: any) => s.id)
    let topProducts: any[] = []
    const itemsMap: Record<string, any[]> = {}
    if (saleIds.length > 0) {
      // Load all sale items (batch in chunks of 200)
      let allItems: any[] = []
      for (let i = 0; i < saleIds.length; i += 200) {
        const chunk = saleIds.slice(i, i + 200)
        const { data: chunkItems } = await supabase.from('sale_items').select('sale_id, product_name, qty, unit_price, line_total').in('sale_id', chunk)
        if (chunkItems) allItems = [...allItems, ...chunkItems]
      }
      allItems.forEach((item: any) => {
        if (!itemsMap[item.sale_id]) itemsMap[item.sale_id] = []
        itemsMap[item.sale_id].push(item)
      })
      setSaleItemsMap(itemsMap)
      const prodMap: Record<string, { qty: number; revenue: number; count: number }> = {}
      allItems.forEach((item: any) => {
        if (!prodMap[item.product_name]) prodMap[item.product_name] = { qty: 0, revenue: 0, count: 0 }
        prodMap[item.product_name].qty += Number(item.qty)
        prodMap[item.product_name].revenue += Number(item.line_total)
        prodMap[item.product_name].count++
      })
      topProducts = Object.entries(prodMap)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)
    }

    // Expenses
    let expQuery = supabase.from('expenses').select('*').gte('created_at', dayStart).lte('created_at', dayEnd)
    if (!isAll) expQuery = expQuery.eq('store_id', storeIds[0])
    else expQuery = expQuery.in('store_id', storeIds)
    const { data: expensesData } = await expQuery
    const totalExpenses = (expensesData ?? []).reduce((sum: number, e: any) => sum + Number(e.amount), 0)

    // Low stock products
    let lowStockQuery = supabase.from('products').select('id, name, stock, stock_alert, category').eq('is_active', true)
    if (!isAll) lowStockQuery = lowStockQuery.eq('store_id', storeIds[0])
    else lowStockQuery = lowStockQuery.in('store_id', storeIds)
    const { data: allProducts } = await lowStockQuery
    const lowStockProducts = (allProducts ?? []).filter((p: any) => p.stock <= p.stock_alert)

    // Previous period comparison (same duration shifted back)
    const fromDate = new Date(dateFrom + 'T00:00:00')
    const toDate = new Date(dateTo + 'T23:59:59')
    const rangeMs = toDate.getTime() - fromDate.getTime()
    const prevEnd = new Date(fromDate.getTime() - 1)
    const prevStart = new Date(prevEnd.getTime() - rangeMs)
    const prevDayStart = prevStart.toISOString()
    const prevDayEnd = prevEnd.toISOString()

    let prevSalesQuery = supabase.from('sales').select('total, movement_type').gte('created_at', prevDayStart).lte('created_at', prevDayEnd)
    if (!isAll) prevSalesQuery = prevSalesQuery.eq('store_id', storeIds[0])
    else prevSalesQuery = prevSalesQuery.in('store_id', storeIds)
    const { data: prevSalesData } = await prevSalesQuery
    const prevRealSales = (prevSalesData ?? []).filter((s: any) => s.movement_type === 'sale')
    const prevRevenue = prevRealSales.reduce((sum: number, x: any) => sum + Number(x.total), 0)
    const prevTxn = prevRealSales.length

    // Trend last 7 days
    const trend7: { date: string; revenue: number; txn: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const ds = d.toISOString().split('T')[0]
      trend7.push({ date: ds, revenue: 0, txn: 0 })
    }
    let trend7Query = supabase.from('sales').select('total, created_at, movement_type').gte('created_at', trend7[0].date + 'T00:00:00').lte('created_at', trend7[6].date + 'T23:59:59')
    if (!isAll) trend7Query = trend7Query.eq('store_id', storeIds[0])
    else trend7Query = trend7Query.in('store_id', storeIds)
    const { data: trend7Sales } = await trend7Query
    ;(trend7Sales ?? []).forEach((s: any) => {
      if (s.movement_type !== 'sale') return
      const sd = new Date(s.created_at).toISOString().split('T')[0]
      const entry = trend7.find(t => t.date === sd)
      if (entry) { entry.revenue += Number(s.total); entry.txn++ }
    })

    // Fidelity cards
    let fidelityQuery = supabase.from('fidelity_cards').select('id, created_at')
    if (!isAll) fidelityQuery = fidelityQuery.eq('store_id', storeIds[0])
    else fidelityQuery = fidelityQuery.in('store_id', storeIds)
    const { data: fidelityCards } = await fidelityQuery
    const totalFidelity = (fidelityCards ?? []).length
    const newFidelityToday = (fidelityCards ?? []).filter((c: any) => new Date(c.created_at).toISOString().split('T')[0] >= dateFrom).length

    // Shifts for this day
    let shiftQuery = supabase.from('shifts').select('*,users(full_name),stores(name)').gte('created_at', dayStart).lte('created_at', dayEnd)
    if (!isAll) shiftQuery = shiftQuery.eq('store_id', storeIds[0])
    else shiftQuery = shiftQuery.in('store_id', storeIds)
    const { data: dayShifts } = await shiftQuery

    let activeShiftQuery = supabase.from('shifts').select('*,users(full_name),stores(name)').lte('created_at', dayEnd).or(`closed_at.is.null,closed_at.gte.${dayStart}`)
    if (!isAll) activeShiftQuery = activeShiftQuery.eq('store_id', storeIds[0])
    else activeShiftQuery = activeShiftQuery.in('store_id', storeIds)
    const { data: activeShifts } = await activeShiftQuery

    const allShiftsMap = new Map()
    for (const s of [...(dayShifts ?? []), ...(activeShifts ?? [])]) {
      allShiftsMap.set(s.id, s)
    }
    const mergedShifts = Array.from(allShiftsMap.values())

    const allSales = allSalesData ?? []
    const realSales = allSales.filter((s: any) => s.movement_type === 'sale')

    // Core metrics
    const totalCash = realSales.filter((s: any) => s.payment_method === 'cash').reduce((sum: number, x: any) => sum + Number(x.total), 0)
    const totalPos = realSales.filter((s: any) => s.payment_method === 'pos').reduce((sum: number, x: any) => sum + Number(x.total), 0)
    const totalRevenue = totalCash + totalPos
    const totalTxn = realSales.length
    const avgSale = totalTxn > 0 ? totalRevenue / totalTxn : 0
    const customerCount = totalTxn

    // Discounts
    const totalDiscounts = realSales.reduce((sum: number, s: any) => sum + Number(s.discount_amount || 0), 0)
    const discountPct = totalRevenue > 0 ? (totalDiscounts / (totalRevenue + totalDiscounts)) * 100 : 0

    // Returns
    const returns = allSales.filter((s: any) => s.movement_type === 'return')
    const totalReturns = returns.reduce((sum: number, x: any) => sum + Math.abs(Number(x.total)), 0)

    // Comparison
    const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : (totalRevenue > 0 ? 100 : 0)
    const txnChange = prevTxn > 0 ? ((totalTxn - prevTxn) / prevTxn) * 100 : (totalTxn > 0 ? 100 : 0)

    // Net profit (Revenue - Expenses)
    const netProfit = totalRevenue - totalExpenses

    // Deposit from closed shifts
    const closedShifts = mergedShifts.filter((s: any) => s.deposit_actual != null)
    const totalDeposit = closedShifts.reduce((sum: number, s: any) => sum + (s.deposit_actual || 0), 0)

    // Online sales (Shopify)
    const shopifySales = allSales.filter((s: any) => s.acquisition_channel === 'shopify')
    const shopifyRevenue = shopifySales.reduce((sum: number, x: any) => sum + Math.abs(Number(x.total)), 0)
    const shopifyCount = shopifySales.length

    // Autoconsumo
    const autoconsumoSales = allSales.filter((s: any) => s.movement_type === 'autoconsumo')
    const autoconsumoTotal = autoconsumoSales.reduce((sum: number, x: any) => sum + Math.abs(Number(x.total)), 0)
    const autoconsumoCount = autoconsumoSales.length

    // Split payments
    const splitSales = realSales.filter((s: any) => s.payment_method === 'split')
    const splitTotal = splitSales.reduce((sum: number, x: any) => sum + Number(x.total), 0)
    const splitCount = splitSales.length

    // Nationality breakdown
    const nationalityMap: Record<string, number> = {}
    realSales.forEach((s: any) => {
      const nat = s.customer_nationality || 'Non specificato'
      nationalityMap[nat] = (nationalityMap[nat] || 0) + 1
    })
    const nationalities = Object.entries(nationalityMap)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)

    // Acquisition channel breakdown
    const channelBreakdown: Record<string, { count: number; revenue: number }> = {}
    realSales.forEach((s: any) => {
      const ch = s.acquisition_channel || 'walk-in'
      if (!channelBreakdown[ch]) channelBreakdown[ch] = { count: 0, revenue: 0 }
      channelBreakdown[ch].count++
      channelBreakdown[ch].revenue += Number(s.total)
    })

    // Hourly distribution
    const hourlyCustomers: number[] = Array(24).fill(0)
    const hourlyRevenue: number[] = Array(24).fill(0)
    realSales.forEach((s: any) => {
      const h = new Date(s.created_at).getHours()
      hourlyCustomers[h]++
      hourlyRevenue[h] += Number(s.total)
    })
    const peakHour = hourlyCustomers.indexOf(Math.max(...hourlyCustomers))

    // Workers
    const workerMap = new Map<string, { name: string; store: string; period: string; hours: string; shiftId: string; openedAt: string; closedAt: string | null }>()
    const sortedShifts = [...mergedShifts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    for (const shift of sortedShifts) {
      const uid = shift.user_id
      if (workerMap.has(uid)) continue
      const shiftStart = new Date(shift.opened_at || shift.created_at)
      const shiftEnd = shift.closed_at ? new Date(shift.closed_at) : now
      const hours = Math.max(0.5, (shiftEnd.getTime() - shiftStart.getTime()) / 3600000)
      workerMap.set(uid, {
        name: shift.users?.full_name ?? '?',
        store: shift.stores?.name ?? '',
        period: shift.period === 'morning' ? '☀️ Mattina' : '🌙 Sera',
        hours: hours.toFixed(1),
        shiftId: shift.id,
        openedAt: shift.opened_at || shift.created_at,
        closedAt: shift.closed_at || null,
      })
    }
    const workers = Array.from(workerMap.values())

    // Per-store breakdown
    const storeBreakdown: any[] = []
    if (allStores.length > 1) {
      for (const store of allStores) {
        const storeSales = realSales.filter((s: any) => s.store_id === store.id)
        const storeRev = storeSales.reduce((sum: number, x: any) => sum + Number(x.total), 0)
        const storeCash = storeSales.filter((s: any) => s.payment_method === 'cash').reduce((sum: number, x: any) => sum + Number(x.total), 0)
        const storePos = storeSales.filter((s: any) => s.payment_method === 'pos').reduce((sum: number, x: any) => sum + Number(x.total), 0)
        const storeTxn = storeSales.length
        const storeAvg = storeTxn > 0 ? storeRev / storeTxn : 0
        storeBreakdown.push({ name: store.name, revenue: storeRev, cash: storeCash, pos: storePos, txn: storeTxn, avg: storeAvg })
      }
    }

    setData({
      totalRevenue, totalCash, totalPos, totalTxn, avgSale, customerCount,
      totalDeposit, shopifyRevenue, shopifyCount, totalExpenses, netProfit,
      totalDiscounts, discountPct, totalReturns,
      channelBreakdown, hourlyCustomers, hourlyRevenue, peakHour,
      workers, storeBreakdown, topProducts, lowStockProducts,
      revenueChange, txnChange, prevRevenue, prevTxn,
      trend7, nationalities, totalFidelity, newFidelityToday,
      autoconsumoTotal, autoconsumoCount, splitTotal, splitCount,
    })
    setLoading(false)
  }

  async function markNotifRead(id: string) {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }
  async function markAllRead() {
    if (!storeId) return
    await supabase.from('notifications').update({ read: true }).eq('store_id', storeId).eq('read', false)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  // Modifica orario ingresso turno
  async function updateShiftTime(shiftId: string) {
    if (!editTime) return
    setSavingShift(true)
    // Combina la data del turno con il nuovo orario
    const worker = data?.workers?.find((w: any) => w.shiftId === shiftId)
    if (worker) {
      const originalDate = new Date(worker.openedAt)
      const [h, m] = editTime.split(':').map(Number)
      originalDate.setHours(h, m, 0, 0)
      await supabase.from('shifts').update({ opened_at: originalDate.toISOString() }).eq('id', shiftId)
    }
    setSavingShift(false)
    setEditingShiftId(null)
    setEditTime('')
    loadData()
  }

  // ═══════ EXPORT PDF ═══════
  async function exportPDF() {
    const { jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default
    const doc = new jsPDF()
    const d = data
    const title = `Report ${storeName} — ${dateFrom === dateTo ? dateFrom : `${dateFrom} → ${dateTo}`}`

    doc.setFontSize(18)
    doc.text('BrainWare Report', 14, 20)
    doc.setFontSize(11)
    doc.setTextColor(100)
    doc.text(title, 14, 28)
    doc.text(`Generato: ${new Date().toLocaleString('it-IT')}`, 14, 34)

    // KPIs table
    autoTable(doc, {
      startY: 42,
      head: [['KPI', 'Valore']],
      body: [
        ['Revenue Totale', fmt(d.totalRevenue)],
        ['vs Periodo Prec.', `${d.revenueChange >= 0 ? '+' : ''}${d.revenueChange.toFixed(1)}%`],
        ['Contanti', fmt(d.totalCash)],
        ['POS', fmt(d.totalPos)],
        ['Clienti', d.customerCount.toString()],
        ['Scontrino Medio', fmt(d.avgSale)],
        ['Spese', fmt(d.totalExpenses)],
        ['Profitto Netto', fmt(d.netProfit)],
        ['Sconti Concessi', `${fmt(d.totalDiscounts)} (${d.discountPct.toFixed(1)}%)`],
        ['Deposito', fmt(d.totalDeposit)],
        ['Shopify', `${fmt(d.shopifyRevenue)} (${d.shopifyCount} ordini)`],
        ['Fidelity Card', `${d.totalFidelity} totali (+${d.newFidelityToday} oggi)`],
        ['Prodotti Low Stock', d.lowStockProducts.length.toString()],
      ],
      theme: 'striped',
      headStyles: { fillColor: [99, 102, 241] },
    })

    // Top products
    if (d.topProducts.length > 0) {
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [['#', 'Prodotto', 'Qtà', 'Revenue']],
        body: d.topProducts.map((p: any, i: number) => [i + 1, p.name, p.qty.toFixed(1), fmt(p.revenue)]),
        theme: 'striped',
        headStyles: { fillColor: [99, 102, 241] },
      })
    }

    // Workers
    if (d.workers.length > 0) {
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [['Personale', 'Store', 'Turno', 'Ore']],
        body: d.workers.map((w: any) => [w.name, w.store, w.period.replace(/[☀️🌙]/g, ''), w.hours + 'h']),
        theme: 'striped',
        headStyles: { fillColor: [99, 102, 241] },
      })
    }

    doc.save(`brainware-report-${dateFrom}.pdf`)
  }

  // ═══════ EXPORT EXCEL ═══════
  async function exportExcel() {
    const XLSX = await import('xlsx')
    const d = data
    const wb = XLSX.utils.book_new()

    // KPIs sheet
    const kpiData = [
      ['KPI', 'Valore'],
      ['Revenue Totale', d.totalRevenue],
      ['vs Periodo Prec.', `${d.revenueChange >= 0 ? '+' : ''}${d.revenueChange.toFixed(1)}%`],
      ['Contanti', d.totalCash],
      ['POS', d.totalPos],
      ['Clienti', d.customerCount],
      ['Scontrino Medio', d.avgSale],
      ['Spese', d.totalExpenses],
      ['Profitto Netto', d.netProfit],
      ['Sconti Concessi', d.totalDiscounts],
      ['% Sconto', `${d.discountPct.toFixed(1)}%`],
      ['Deposito', d.totalDeposit],
      ['Shopify Revenue', d.shopifyRevenue],
      ['Shopify Ordini', d.shopifyCount],
      ['Fidelity Totali', d.totalFidelity],
      ['Fidelity Nuove', d.newFidelityToday],
      ['Low Stock', d.lowStockProducts.length],
      ['Resi', d.totalReturns],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kpiData), 'KPI')

    // Top Products sheet
    if (d.topProducts.length > 0) {
      const prodData = [['Prodotto', 'Quantità', 'Revenue'], ...d.topProducts.map((p: any) => [p.name, p.qty, p.revenue])]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(prodData), 'Top Prodotti')
    }

    // Trend 7 days sheet
    const trendData = [['Data', 'Revenue', 'Transazioni'], ...d.trend7.map((t: any) => [t.date, t.revenue, t.txn])]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(trendData), 'Trend 7 Giorni')

    // Nationality sheet
    if (d.nationalities.length > 0) {
      const natData = [['Nazionalità', 'Clienti'], ...d.nationalities.map((n: any) => [n.country, n.count])]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(natData), 'Nazionalità')
    }

    // Workers sheet
    if (d.workers.length > 0) {
      const workData = [['Nome', 'Store', 'Turno', 'Ore'], ...d.workers.map((w: any) => [w.name, w.store, w.period, w.hours])]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(workData), 'Personale')
    }

    // Low stock sheet
    if (d.lowStockProducts.length > 0) {
      const lsData = [['Prodotto', 'Stock', 'Soglia Alert', 'Categoria'], ...d.lowStockProducts.map((p: any) => [p.name, p.stock, p.stock_alert, p.category])]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(lsData), 'Low Stock')
    }

    XLSX.writeFile(wb, `brainware-report-${dateFrom}.xlsx`)
  }

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}><div style={{ color:'var(--text-secondary)' }}>{t('loading')}</div></div>
  if (!data) return null

  const unreadCount = notifications.filter(n => !n.read).length
  const maxHourly = Math.max(...data.hourlyCustomers, 1)
  const CHANNEL_LABELS: Record<string, string> = { 'walk-in': t('dash.walkin'), social: t('dash.social'), google: t('dash.google'), referral: t('dash.referral'), shopify: '🛍️ Shopify', other: t('dash.other') }
  const isTodayRange = dateTo === new Date().toISOString().split('T')[0]
  const isSingleDay = dateFrom === dateTo
  const targetPct = Math.min(100, (data.totalRevenue / dailyTarget) * 100)

  return (
    <div>
      {/* ═══════ HEADER ═══════ */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'var(--space-lg)' }}>
        <div>
          <h2>{t('dash.title')}</h2>
          <p style={{ color:'var(--text-secondary)', fontSize:14, marginTop:4 }}>
            {storeName} — {isSingleDay
              ? new Date(dateFrom + 'T12:00:00').toLocaleDateString('it-IT', { weekday:'long', day:'numeric', month:'long', year:'numeric' })
              : `${new Date(dateFrom + 'T12:00:00').toLocaleDateString('it-IT', { day:'numeric', month:'short' })} → ${new Date(dateTo + 'T12:00:00').toLocaleDateString('it-IT', { day:'numeric', month:'short', year:'numeric' })}`
            }
          </p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {/* Day navigation */}
          <button onClick={() => shiftDay(-1)} className="btn btn-ghost" style={{ fontSize:18, padding:'4px 10px', lineHeight:1 }} title="Giorno precedente">◀</button>
          {/* Export buttons */}
          <button onClick={exportPDF} className="btn btn-ghost" style={{ fontSize:12, padding:'5px 10px', display:'flex', alignItems:'center', gap:4 }}>📄 PDF</button>
          <button onClick={exportExcel} className="btn btn-ghost" style={{ fontSize:12, padding:'5px 10px', display:'flex', alignItems:'center', gap:4 }}>📊 Excel</button>
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            <label style={{ fontSize:11, color:'var(--text-tertiary)', fontWeight:600 }}>{t('from')}</label>
            <input type="date" className="input" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              style={{ fontSize:13, fontWeight:600, padding:'5px 8px' }} />
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            <label style={{ fontSize:11, color:'var(--text-tertiary)', fontWeight:600 }}>{t('to')}</label>
            <input type="date" className="input" value={dateTo} onChange={e => setDateTo(e.target.value)}
              style={{ fontSize:13, fontWeight:600, padding:'5px 8px' }} />
          </div>
          <button onClick={() => shiftDay(1)} className="btn btn-ghost" style={{ fontSize:18, padding:'4px 10px', lineHeight:1 }} title="Giorno successivo">▶</button>
          {!isTodayRange && (
            <button onClick={goToday} className="btn btn-ghost" style={{ fontSize:12, padding:'5px 10px', fontWeight:700, color:'var(--brand-primary)' }}>Oggi</button>
          )}
          {isTodayRange && (
            <div style={{ textAlign:'right', marginLeft:8 }}>
              <div style={{ fontFamily:'var(--font-heading)', fontSize:22, fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em' }}>
                {now.toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit' })}
              </div>
              <div style={{ fontSize:10, color:'var(--text-tertiary)' }}>{t('dash.live')}</div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════ STORE FILTER ═══════ */}
      <div style={{ display:'flex', gap:6, marginBottom:'var(--space-lg)', flexWrap:'wrap' }}>
        <button onClick={() => setSelectedStore('all')} className={`badge ${selectedStore==='all'?'badge-brand':'badge-gray'}`} style={{ cursor:'pointer', border:'none', padding:'6px 14px', fontSize:13 }}>
          {t('dash.allStores')}
        </button>
        {stores.map(s => (
          <button key={s.id} onClick={() => setSelectedStore(s.id)} className={`badge ${selectedStore===s.id?'badge-brand':'badge-gray'}`} style={{ cursor:'pointer', border:'none', padding:'6px 14px', fontSize:13 }}>
            {s.name}
          </button>
        ))}
      </div>

      {/* ═══════ DAILY TARGET ═══════ */}
      {isSingleDay && (
        <div className="card" style={{ marginBottom:'var(--space-lg)', padding:'16px 20px', background: targetPct >= 100 ? 'linear-gradient(135deg, rgba(34,197,94,0.08), rgba(34,197,94,0.02))' : undefined, border: targetPct >= 100 ? '1px solid rgba(34,197,94,0.3)' : undefined }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:18 }}>{targetPct >= 100 ? '🎯' : '📈'}</span>
              <span style={{ fontWeight:700, fontSize:14 }}>{t('dash.dailyTarget')}</span>
            </div>
            <div style={{ fontWeight:800, fontSize:18, color: targetPct >= 100 ? 'var(--success)' : 'var(--brand-primary)' }}>
              {fmt(data.totalRevenue)} / {fmt(dailyTarget)}
            </div>
          </div>
          <div style={{ height:8, background:'var(--bg-surface-alt)', borderRadius:4, overflow:'hidden' }}>
            <div style={{
              height:'100%', width:`${targetPct}%`, borderRadius:4, transition:'width 0.5s',
              background: targetPct >= 100 ? 'var(--success)' : targetPct >= 70 ? 'var(--brand-primary)' : targetPct >= 40 ? '#F59E0B' : 'var(--danger)',
            }} />
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
            <span style={{ fontSize:11, color:'var(--text-tertiary)' }}>{targetPct.toFixed(0)}% {t('reached')}</span>
            {targetPct < 100 && <span style={{ fontSize:11, color:'var(--text-tertiary)' }}>{t('remaining')} {fmt(dailyTarget - data.totalRevenue)}</span>}
            {targetPct >= 100 && <span style={{ fontSize:11, color:'var(--success)', fontWeight:600 }}>🎉 {t('exceeded')}</span>}
          </div>
        </div>
      )}

      {/* ═══════ CENTRO NOTIFICHE ═══════ */}
      <div className="card" style={{ marginBottom:'var(--space-xl)', padding:0, overflow:'hidden' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 18px', borderBottom: showAllNotifs ? '1px solid var(--border-subtle)' : 'none' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:18 }}>🔔</span>
            <h4 style={{ margin:0, fontSize:14 }}>{t('dash.notifications')}</h4>
            {unreadCount > 0 && <span style={{ background:'var(--danger)', color:'white', borderRadius:20, padding:'1px 8px', fontSize:11, fontWeight:700 }}>{unreadCount}</span>}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            {unreadCount > 0 && <button onClick={markAllRead} style={{ background:'none', border:'none', color:'var(--text-secondary)', fontSize:11, cursor:'pointer' }}>{t('dash.readAll')}</button>}
            <button onClick={() => setShowAllNotifs(!showAllNotifs)} style={{ background:'none', border:'none', color:'var(--brand-primary)', fontSize:12, fontWeight:600, cursor:'pointer' }}>
              {showAllNotifs ? '▲ Chiudi' : `▼ (${notifications.length})`}
            </button>
          </div>
        </div>
        {showAllNotifs && (
          <div style={{ maxHeight:300, overflowY:'auto' }}>
            {notifications.length === 0 && <div style={{ padding:'var(--space-lg)', textAlign:'center', color:'var(--text-tertiary)', fontSize:13 }}>{t('dash.noNotifications')}</div>}
            {notifications.map((n, i) => (
              <div key={n.id} onClick={() => {
                markNotifRead(n.id)
                const route = TYPE_ROUTE[n.type]
                if (route) router.push(route)
              }} style={{
                display:'flex', alignItems:'flex-start', gap:10, padding:'10px 18px',
                borderBottom: i < notifications.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                background: n.read ? 'transparent' : 'var(--brand-primary-light)', cursor:'pointer',
              }}>
                <span style={{ fontSize:16 }}>{TYPE_ICON[n.type] ?? '🔔'}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight: n.read ? 500 : 700, fontSize:13, display:'flex', alignItems:'center', gap:6 }}>
                    {n.title}
                    {n.stores?.name && <span style={{ fontSize:10, padding:'1px 6px', borderRadius:4, background:'var(--bg-surface)', color:'var(--text-tertiary)', fontWeight:500 }}>{n.stores.name}</span>}
                  </div>
                  {n.message && <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:1 }}>{n.message}</div>}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                  <span style={{ fontSize:10, color:'var(--text-tertiary)' }}>
                    {new Date(n.created_at).toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit' })}
                  </span>
                  {TYPE_ROUTE[n.type] && <span style={{ fontSize:12, color:'var(--text-tertiary)' }}>›</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══════ KPI ROW 1 — Revenue ═══════ */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'var(--space-md)', marginBottom:'var(--space-md)' }}>
        <div className="kpi-card">
          <div className="kpi-label">{t('dash.totalRevenue')}</div>
          <div className="kpi-value" style={{ color:'var(--brand-primary)' }}>{fmt(data.totalRevenue)}</div>
          <div style={{ fontSize:11, color: data.revenueChange >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight:600, marginTop:2 }}>
            {data.revenueChange >= 0 ? '▲' : '▼'} {Math.abs(data.revenueChange).toFixed(1)}% {t('vsPrevPeriod')}
          </div>
        </div>
        <div className="kpi-card" onClick={() => setDrillFilter('cash')} style={{ cursor:'pointer', transition:'transform 0.15s' }} onMouseEnter={e => (e.currentTarget.style.transform='scale(1.03)')} onMouseLeave={e => (e.currentTarget.style.transform='scale(1)')}>
          <div className="kpi-label">💵 {t('dash.cash')}</div>
          <div className="kpi-value">{fmt(data.totalCash)}</div>
          <div style={{ fontSize:10, color:'var(--text-tertiary)', marginTop:2 }}>Click per dettaglio →</div>
        </div>
        <div className="kpi-card" onClick={() => setDrillFilter('pos')} style={{ cursor:'pointer', transition:'transform 0.15s' }} onMouseEnter={e => (e.currentTarget.style.transform='scale(1.03)')} onMouseLeave={e => (e.currentTarget.style.transform='scale(1)')}>
          <div className="kpi-label">💳 {t('dash.pos')}</div>
          <div className="kpi-value" style={{ color:'#7C3AED' }}>{fmt(data.totalPos)}</div>
          <div style={{ fontSize:10, color:'var(--text-tertiary)', marginTop:2 }}>Click per dettaglio →</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{t('dash.deposit')}</div>
          <div className="kpi-value" style={{ color:'var(--success)' }}>{fmt(data.totalDeposit)}</div>
        </div>
      </div>

      {/* ═══════ KPI ROW 2 — Performance ═══════ */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'var(--space-md)', marginBottom:'var(--space-md)' }}>
        <div className="kpi-card">
          <div className="kpi-label">{t('dash.customers')}</div>
          <div className="kpi-value">{data.customerCount}</div>
          <div style={{ fontSize:11, color: data.txnChange >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight:600, marginTop:2 }}>
            {data.txnChange >= 0 ? '▲' : '▼'} {Math.abs(data.txnChange).toFixed(1)}% {t('vsPrevPeriod')}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{t('dash.avgTicket')}</div>
          <div className="kpi-value">{fmt(data.avgSale)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{t('dash.expenses')}</div>
          <div className="kpi-value" style={{ color:'var(--danger)' }}>{fmt(data.totalExpenses)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{t('dash.netProfit')}</div>
          <div className="kpi-value" style={{ color: data.netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmt(data.netProfit)}</div>
        </div>
      </div>

      {/* ═══════ KPI ROW 3 — Extra ═══════ */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'var(--space-md)', marginBottom:'var(--space-xl)' }}>
        <div className="kpi-card">
          <div className="kpi-label">{t('dash.discounts')}</div>
          <div className="kpi-value">{fmt(data.totalDiscounts)}</div>
          <div style={{ fontSize:11, color:'var(--text-tertiary)', marginTop:2 }}>{data.discountPct.toFixed(1)}% {t('dash.onTotal')}</div>
        </div>
        <div className="kpi-card" onClick={() => setDrillFilter('shopify')} style={{ cursor:'pointer', transition:'transform 0.15s' }} onMouseEnter={e => (e.currentTarget.style.transform='scale(1.03)')} onMouseLeave={e => (e.currentTarget.style.transform='scale(1)')}>
          <div className="kpi-label">🛍️ Shopify Online</div>
          <div className="kpi-value" style={{ color:'#7C3AED' }}>{fmt(data.shopifyRevenue)}</div>
          <div style={{ fontSize:11, color:'var(--text-tertiary)', marginTop:2 }}>{data.shopifyCount} {t('orders')} · Click →</div>
        </div>
        <div className="kpi-card" onClick={() => setDrillFilter('autoconsumo')} style={{ cursor:'pointer', transition:'transform 0.15s', background: data.autoconsumoCount > 0 ? 'rgba(156,163,175,0.06)' : undefined }} onMouseEnter={e => (e.currentTarget.style.transform='scale(1.03)')} onMouseLeave={e => (e.currentTarget.style.transform='scale(1)')}>
          <div className="kpi-label">🏠 Autoconsumo</div>
          <div className="kpi-value" style={{ color:'#6B7280' }}>{fmt(data.autoconsumoTotal)}</div>
          <div style={{ fontSize:11, color:'var(--text-tertiary)', marginTop:2 }}>{data.autoconsumoCount} movimenti · Click →</div>
        </div>
        <Link href="/owner/products" style={{ textDecoration:'none' }}>
          <div className="kpi-card" style={{ border: data.lowStockProducts.length > 0 ? '1px solid var(--danger)' : undefined, background: data.lowStockProducts.length > 0 ? 'rgba(239,68,68,0.04)' : undefined, cursor:'pointer' }}>
            <div className="kpi-label">{t('dash.lowStock')}</div>
            <div className="kpi-value" style={{ color: data.lowStockProducts.length > 0 ? 'var(--danger)' : 'var(--success)' }}>
              {data.lowStockProducts.length}
            </div>
            <div style={{ fontSize:11, color:'var(--text-tertiary)', marginTop:2 }}>{t('products')} {t('belowThreshold')}</div>
          </div>
        </Link>
      </div>

      {/* ═══════ TREND 7 GIORNI ═══════ */}
      <div className="card" style={{ marginBottom:'var(--space-xl)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'var(--space-lg)' }}>
          <h4>{t('dash.trend7Days')}</h4>
          <span style={{ fontSize:12, color:'var(--text-tertiary)' }}>{fmt(data.trend7.reduce((s: number, tr: any) => s + tr.revenue, 0))} {t('total')}</span>
        </div>
        <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:120 }}>
          {data.trend7.map((t: any, i: number) => {
            const maxRev = Math.max(...data.trend7.map((x: any) => x.revenue), 1)
            const h = maxRev > 0 ? Math.max(4, (t.revenue / maxRev) * 100) : 4
            const dayName = new Date(t.date + 'T12:00:00').toLocaleDateString('it-IT', { weekday:'short' })
            const isToday = t.date === new Date().toISOString().split('T')[0]
            return (
              <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                <div style={{ fontSize:10, fontWeight:600, color:'var(--text-secondary)' }}>{t.revenue > 0 ? fmt(t.revenue) : ''}</div>
                <div style={{
                  width:'100%', height:`${h}%`, minHeight:4,
                  background: isToday ? 'var(--brand-primary)' : t.revenue > 0 ? 'rgba(99,102,241,0.3)' : 'var(--bg-surface-alt)',
                  borderRadius:'4px 4px 0 0', transition:'height 0.3s',
                }} />
                <span style={{ fontSize:10, color: isToday ? 'var(--brand-primary)' : 'var(--text-tertiary)', fontWeight: isToday ? 700 : 400 }}>{dayName}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ═══════ TOP 5 + PERSONALE ═══════ */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--space-xl)', marginBottom:'var(--space-xl)' }}>
        {/* Top 5 Products */}
        <div className="card">
          <h4 style={{ marginBottom:'var(--space-lg)' }}>{t('dash.top5Products')}</h4>
          {data.topProducts.length === 0 ? (
            <p style={{ color:'var(--text-tertiary)', fontSize:14 }}>{t('dash.noSalesDetail')}</p>
          ) : (
            data.topProducts.map((p: any, i: number) => {
              const maxR = data.topProducts[0]?.revenue || 1
              return (
                <div key={i} style={{ marginBottom:12 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:13, fontWeight:600 }}>
                      <span style={{ color:'var(--text-tertiary)', marginRight:6 }}>#{i + 1}</span>
                      {p.name}
                    </span>
                    <span style={{ fontSize:13, fontWeight:700, color:'var(--brand-primary)' }}>{fmt(p.revenue)}</span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ flex:1, height:4, background:'var(--bg-surface-alt)', borderRadius:2 }}>
                      <div style={{ height:'100%', width:`${(p.revenue / maxR) * 100}%`, background:'var(--brand-primary)', borderRadius:2 }} />
                    </div>
                    <span style={{ fontSize:11, color:'var(--text-tertiary)', flexShrink:0 }}>{p.qty.toFixed(p.qty % 1 === 0 ? 0 : 1)} {t('dash.sold')}</span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Workers */}
        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'var(--space-md)' }}>
            <h4>{t('dash.staffOnDuty')}</h4>
            <span className="badge badge-gray">{data.workers.length} {t('persons')}</span>
          </div>
          {data.workers.length === 0 ? (
            <p style={{ color:'var(--text-tertiary)', fontSize:14 }}>{t('dash.noShifts')}</p>
          ) : (
            data.workers.map((w: any, i: number) => {
              const entryTime = new Date(w.openedAt).toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit' })
              const exitTime = w.closedAt ? new Date(w.closedAt).toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit' }) : t('dash.ongoing')
              const isEditing = editingShiftId === w.shiftId
              return (
                <div key={i} style={{ padding:'10px 0', borderBottom: i < data.workers.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--brand-primary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'white', flexShrink:0 }}>
                      {w.name?.split(' ').map((n: string) => n[0]).join('').slice(0,2)}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600 }}>{w.name}</div>
                      <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>{w.store} · {w.period}</div>
                    </div>
                    <span style={{ fontSize:13, fontWeight:600 }}>{w.hours}h</span>
                  </div>
                  {/* Orario ingresso/uscita */}
                  <div style={{ marginLeft:44, marginTop:6, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    {isEditing ? (
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ fontSize:11, color:'var(--text-secondary)' }}>Ingresso:</span>
                        <input
                          type="time"
                          className="input"
                          value={editTime}
                          onChange={e => setEditTime(e.target.value)}
                          style={{ fontSize:13, padding:'3px 8px', width:100, fontWeight:600 }}
                          autoFocus
                        />
                        <button
                          onClick={() => updateShiftTime(w.shiftId)}
                          disabled={savingShift || !editTime}
                          style={{ background:'var(--brand-primary)', color:'white', border:'none', borderRadius:6, padding:'4px 10px', fontSize:11, fontWeight:600, cursor:'pointer' }}
                        >
                          {savingShift ? '...' : '✓'}
                        </button>
                        <button
                          onClick={() => { setEditingShiftId(null); setEditTime('') }}
                          style={{ background:'none', border:'1px solid var(--border-default)', borderRadius:6, padding:'4px 10px', fontSize:11, cursor:'pointer', color:'var(--text-secondary)' }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <>
                        <span style={{ fontSize:11, color:'var(--text-secondary)' }}>
                          🕐 {entryTime} → {exitTime}
                        </span>
                        <button
                          onClick={() => {
                            setEditingShiftId(w.shiftId)
                            const d = new Date(w.openedAt)
                            setEditTime(`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`)
                          }}
                          style={{ background:'none', border:'none', cursor:'pointer', fontSize:11, color:'var(--brand-primary)', fontWeight:600, padding:'2px 6px' }}
                          title="Modifica orario ingresso"
                        >
                          ✏️ Modifica
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ═══════ NAZIONALITÀ + ORA DI PUNTA ═══════ */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--space-xl)', marginBottom:'var(--space-xl)' }}>
        {/* Nationality */}
        <div className="card">
          <h4 style={{ marginBottom:'var(--space-lg)' }}>{t('dash.nationalityBreak')}</h4>
          {data.nationalities.length === 0 ? (
            <p style={{ color:'var(--text-tertiary)', fontSize:14 }}>{t('noData')}</p>
          ) : (
            data.nationalities.map((n: any, i: number) => {
              const pct = data.customerCount > 0 ? (n.count / data.customerCount * 100) : 0
              const FLAG: Record<string, string> = { Italy: '🇮🇹', Germany: '🇩🇪', France: '🇫🇷', UK: '🇬🇧', Spain: '🇪🇸', USA: '🇺🇸', Switzerland: '🇨🇭', Austria: '🇦🇹', Netherlands: '🇳🇱', 'Non specificato': '🏳️' }
              return (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom: i < data.nationalities.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <span style={{ fontSize:16 }}>{FLAG[n.country] || '🏳️'}</span>
                  <span style={{ flex:1, fontSize:13, fontWeight:500 }}>{n.country}</span>
                  <span style={{ fontSize:13, fontWeight:700 }}>{n.count}</span>
                  <span style={{ fontSize:11, color:'var(--text-tertiary)', width:40, textAlign:'right' }}>{pct.toFixed(0)}%</span>
                </div>
              )
            })
          )}
        </div>

        {/* Hourly Distribution */}
        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'var(--space-lg)' }}>
            <h4>{t('dash.hourlyDist')}</h4>
            <span style={{ fontSize:12, color:'var(--text-tertiary)' }}>
              {t('dash.peakHour')}: <strong>{data.peakHour}:00</strong>
            </span>
          </div>
          <div style={{ display:'flex', alignItems:'flex-end', gap:2, height:120 }}>
            {data.hourlyCustomers.map((count: number, i: number) => {
              if (i < 7 || i > 23) return null
              const h = maxHourly > 0 ? Math.max(2, (count / maxHourly) * 100) : 2
              const isPeak = i === data.peakHour && count > 0
              return (
                <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                  {count > 0 && <div style={{ fontSize:9, color: isPeak ? 'var(--brand-primary)' : 'var(--text-tertiary)', fontWeight: isPeak ? 700 : 600 }}>{count}</div>}
                  <div style={{
                    width:'100%', height:`${h}%`, minHeight:2,
                    background: isPeak ? 'var(--brand-primary)' : count > 0 ? 'rgba(99,102,241,0.3)' : 'var(--bg-surface-alt)',
                    borderRadius:'3px 3px 0 0', transition:'height 0.3s',
                  }} />
                  <span style={{ fontSize:9, color: isPeak ? 'var(--brand-primary)' : 'var(--text-tertiary)', fontWeight: isPeak ? 700 : 400 }}>{i}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ═══════ CANALE ACQUISIZIONE ═══════ */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--space-xl)', marginBottom:'var(--space-xl)' }}>
        <div className="card">
          <h4 style={{ marginBottom:'var(--space-lg)' }}>{t('dash.channels')}</h4>
          {Object.keys(data.channelBreakdown).length === 0 ? (
            <p style={{ color:'var(--text-tertiary)', fontSize:14 }}>Nessuna vendita</p>
          ) : (
            Object.entries(data.channelBreakdown)
              .sort((a: any, b: any) => b[1].count - a[1].count)
              .map(([channel, stats]: any) => {
                const pct = data.customerCount > 0 ? (stats.count / data.customerCount * 100) : 0
                return (
                  <div key={channel} style={{ marginBottom:14 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontSize:13, fontWeight:600 }}>{CHANNEL_LABELS[channel] || channel}</span>
                      <span style={{ fontSize:13, fontWeight:700 }}>{stats.count} clienti · {fmt(stats.revenue)} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div style={{ height:6, background:'var(--bg-surface-alt)', borderRadius:3 }}>
                      <div style={{ height:'100%', width:`${pct}%`, background:'var(--brand-primary)', borderRadius:3, transition:'width 0.3s' }} />
                    </div>
                  </div>
                )
              })
          )}
        </div>

        {/* Low Stock Alert */}
        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'var(--space-lg)' }}>
            <h4>{t('dash.lowStock')}</h4>
            <Link href="/owner/products" style={{ fontSize:12, color:'var(--brand-primary)', fontWeight:600 }}>Vedi tutti →</Link>
          </div>
          {data.lowStockProducts.length === 0 ? (
            <div style={{ textAlign:'center', padding:'var(--space-lg)', color:'var(--success)' }}>
              <div style={{ fontSize:32, marginBottom:8 }}>✅</div>
              <div style={{ fontSize:14, fontWeight:600 }}>Tutto in ordine!</div>
              <div style={{ fontSize:12, color:'var(--text-tertiary)' }}>Nessun prodotto sotto soglia</div>
            </div>
          ) : (
            data.lowStockProducts.slice(0, 6).map((p: any, i: number) => (
              <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 0', borderBottom: i < Math.min(data.lowStockProducts.length, 6) - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                <span style={{ width:8, height:8, borderRadius:'50%', background: p.stock === 0 ? 'var(--danger)' : '#F59E0B', flexShrink:0 }} />
                <span style={{ flex:1, fontSize:13, fontWeight:500 }}>{p.name}</span>
                <span style={{ fontSize:13, fontWeight:700, color: p.stock === 0 ? 'var(--danger)' : '#F59E0B' }}>{p.stock}</span>
                <span style={{ fontSize:11, color:'var(--text-tertiary)' }}>/ {p.stock_alert}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ═══════ CONFRONTO STORE ═══════ */}
      {data.storeBreakdown.length > 0 && (
        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'var(--space-lg)' }}>
            <h4>{t('dash.storeBreakdown')}</h4>
            <span className="badge badge-brand">{stores.length} Store</span>
          </div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>{t('dash.store')}</th><th>{t('dash.revenue')}</th><th>Cash</th><th>POS</th><th>{t('dash.customers')}</th><th>{t('dash.avg')}</th></tr></thead>
              <tbody>
                {data.storeBreakdown.map((s: any) => (
                  <tr key={s.name}>
                    <td style={{ fontWeight:600 }}>{s.name}</td>
                    <td style={{ fontWeight:700, color:'var(--brand-primary)' }}>{fmt(s.revenue)}</td>
                    <td>{fmt(s.cash)}</td>
                    <td>{fmt(s.pos)}</td>
                    <td>{s.txn}</td>
                    <td>{fmt(s.avg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* ═══════ DRILL-DOWN MODAL ═══════ */}
      {drillFilter && (() => {
        const LABELS: Record<string, string> = { cash: '💵 Transazioni Cash', pos: '💳 Transazioni POS', split: '🔀 Split Payments', autoconsumo: '🏠 Autoconsumi', shopify: '🛍️ Ordini Online' }
        const filtered = allSalesList.filter((s: any) => {
          if (drillFilter === 'autoconsumo') return s.movement_type === 'autoconsumo'
          if (drillFilter === 'shopify') return s.acquisition_channel === 'shopify'
          return s.payment_method === drillFilter && s.movement_type === 'sale'
        }).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        const drillTotal = filtered.reduce((s: number, x: any) => s + Math.abs(Number(x.total)), 0)
        return (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
            onClick={() => setDrillFilter(null)}>
            <div style={{ background:'var(--bg-surface)', borderRadius:16, width:'100%', maxWidth:800, maxHeight:'80vh', overflow:'hidden', display:'flex', flexDirection:'column' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ padding:'20px 24px', borderBottom:'1px solid var(--border-subtle)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <h3 style={{ margin:0, fontSize:18 }}>{LABELS[drillFilter]}</h3>
                  <div style={{ fontSize:13, color:'var(--text-tertiary)', marginTop:4 }}>
                    {filtered.length} transazioni · Totale: <strong style={{ color:'var(--brand-primary)' }}>{fmt(drillTotal)}</strong>
                  </div>
                </div>
                <button onClick={() => setDrillFilter(null)} style={{ background:'none', border:'none', fontSize:24, cursor:'pointer', color:'var(--text-secondary)', padding:'4px 8px' }}>✕</button>
              </div>
              <div style={{ overflowY:'auto', flex:1 }}>
                <table style={{ width:'100%' }}>
                  <thead><tr style={{ position:'sticky', top:0, background:'var(--bg-surface)', zIndex:1 }}>
                    <th style={{ padding:'10px 16px', textAlign:'left', fontSize:12, fontWeight:700, color:'var(--text-tertiary)' }}>Ora</th>
                    <th style={{ padding:'10px 16px', textAlign:'left', fontSize:12, fontWeight:700, color:'var(--text-tertiary)' }}>Cliente</th>
                    <th style={{ padding:'10px 16px', textAlign:'left', fontSize:12, fontWeight:700, color:'var(--text-tertiary)' }}>Prodotti</th>
                    <th style={{ padding:'10px 16px', textAlign:'right', fontSize:12, fontWeight:700, color:'var(--text-tertiary)' }}>Totale</th>
                  </tr></thead>
                  <tbody>
                    {filtered.map((sale: any, i: number) => {
                      const items = saleItemsMap[sale.id] || []
                      return (
                        <tr key={sale.id} style={{ borderBottom:'1px solid var(--border-subtle)', background: i % 2 === 0 ? 'transparent' : 'var(--bg-surface-alt)' }}>
                          <td style={{ padding:'10px 16px', fontSize:13, fontWeight:600, whiteSpace:'nowrap' }}>
                            {new Date(sale.created_at).toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit' })}
                          </td>
                          <td style={{ padding:'10px 16px', fontSize:13 }}>
                            {sale.customer_name || '—'}
                          </td>
                          <td style={{ padding:'10px 16px', fontSize:12, color:'var(--text-secondary)', maxWidth:300 }}>
                            {items.length > 0
                              ? items.map((it: any) => `${it.product_name}${it.qty > 1 ? ` ×${it.qty}` : ''}`).join(', ')
                              : '—'}
                          </td>
                          <td style={{ padding:'10px 16px', fontSize:14, fontWeight:700, textAlign:'right', color:'var(--brand-primary)' }}>
                            {fmt(Math.abs(Number(sale.total)))}
                          </td>
                        </tr>
                      )
                    })}
                    {filtered.length === 0 && (
                      <tr><td colSpan={4} style={{ padding:40, textAlign:'center', color:'var(--text-tertiary)', fontSize:14 }}>Nessuna transazione trovata</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
