'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmt, formatDate, formatTime, periodLabel, exportShiftCSV_owner } from '@/lib/utils'
import type { Sale } from '@/types/database'

type Tab = 'cash-pos' | 'products' | 'avg' | 'discounts'

interface DayRow {
  date: string
  cash: number
  pos: number
  total: number
  txn: number
}

export default function ReportsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [tab, setTab] = useState<Tab>('cash-pos')
  const [sales, setSales] = useState<any[]>([])
  const [storeId, setStoreId] = useState<string | null>(null)
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0]
  })
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [fromDate, toDate])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase.from('users').select('store_id, role').eq('id', user.id).single()
    if (profile?.role !== 'owner') { router.push('/login'); return }
    setStoreId(profile.store_id)

    const { data: s } = await supabase
      .from('sales')
      .select('*, sale_items(product_name, qty, unit_price, line_total)')
      .eq('store_id', profile.store_id)
      .gte('created_at', fromDate + 'T00:00:00')
      .lte('created_at', toDate + 'T23:59:59')
      .order('created_at', { ascending: false })

    setSales(s ?? [])
    setLoading(false)
  }

  // Group by date for cash/POS report
  const byDate = sales.reduce((acc, s) => {
    const date = s.created_at.split('T')[0]
    if (!acc[date]) acc[date] = { date, cash: 0, pos: 0, total: 0, txn: 0 }
    acc[date].total += s.total
    acc[date].txn++
    if (s.payment_method === 'cash') acc[date].cash += s.total
    else if (s.payment_method === 'pos') acc[date].pos += s.total
    return acc
  }, {} as Record<string, DayRow>)

  const dayRows = Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date)) as DayRow[]
  const grandTotal = dayRows.reduce((s, r) => s + r.total, 0)
  const grandCash = dayRows.reduce((s, r) => s + r.cash, 0)
  const grandPos = dayRows.reduce((s, r) => s + r.pos, 0)
  const grandTxn = dayRows.reduce((s, r) => s + r.txn, 0)

  // Group by product
  const byProduct = sales.flatMap(s => s.sale_items ?? []).reduce((acc, i) => {
    if (!acc[i.product_name]) acc[i.product_name] = { name: i.product_name, qty: 0, revenue: 0 }
    acc[i.product_name].qty += i.qty
    acc[i.product_name].revenue += i.line_total
    return acc
  }, {} as Record<string, { name: string; qty: number; revenue: number }>)
  const productRows = Object.values(byProduct).sort((a, b) => b.revenue - a.revenue)

  function exportCSV() {
    const rows = [
      ['Data', 'Cash ()', 'POS ()', 'Totale ()', 'Transazioni'],
      ...dayRows.map(r => [r.date, r.cash.toFixed(2), r.pos.toFixed(2), r.total.toFixed(2), r.txn.toString()]),
      ['', '', '', '', ''],
      ['TOTALE', grandCash.toFixed(2), grandPos.toFixed(2), grandTotal.toFixed(2), grandTxn.toString()],
    ]
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `report_${fromDate}_${toDate}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  function printReport() {
    window.print()
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'cash-pos', label: 'Cash / POS' },
    { key: 'products', label: 'Prodotti' },
    { key: 'avg', label: 'Avg Sales' },
    { key: 'discounts', label: 'Sconti' },
  ]

  const discounts = sales.filter(s => s.discount_amount > 0)

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>Caricamento...</div>

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xl)' }}>
        <h2>Report</h2>
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <button onClick={printReport} className="btn btn-secondary"> Stampa PDF</button>
          <button onClick={exportCSV} className="btn btn-secondary"> Export CSV</button>
        </div>
      </div>

      {/* Date range */}
      <div className="card" style={{ display: 'flex', gap: 'var(--space-lg)', alignItems: 'center', marginBottom: 'var(--space-xl)', padding: 'var(--space-md) var(--space-lg)' }}>
        <div className="input-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <label className="input-label" style={{ whiteSpace: 'nowrap' }}>Dal</label>
          <input className="input" type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ width: 160 }} />
        </div>
        <div className="input-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <label className="input-label" style={{ whiteSpace: 'nowrap' }}>Al</label>
          <input className="input" type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ width: 160 }} />
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-sm)' }}>
          {[
            { label: 'Oggi', days: 0 },
            { label: '7gg', days: 7 },
            { label: '30gg', days: 30 },
          ].map(({ label, days }) => (
            <button key={label} className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: 13 }}
              onClick={() => {
                const to = new Date()
                const from = new Date(); from.setDate(from.getDate() - days)
                setToDate(to.toISOString().split('T')[0])
                setFromDate(from.toISOString().split('T')[0])
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
        <div className="kpi-card"><div className="kpi-label">Totale</div><div className="kpi-value">{fmt(grandTotal)}</div></div>
        <div className="kpi-card"><div className="kpi-label">Cash</div><div className="kpi-value" style={{ color: 'var(--success)' }}>{fmt(grandCash)}</div></div>
        <div className="kpi-card"><div className="kpi-label">POS</div><div className="kpi-value" style={{ color: 'var(--accent-blue)' }}>{fmt(grandPos)}</div></div>
        <div className="kpi-card"><div className="kpi-label">Transazioni</div><div className="kpi-value">{grandTxn}</div><div className="kpi-sub">avg {fmt(grandTxn > 0 ? grandTotal / grandTxn : 0)}</div></div>
      </div>

      {/* Tabs */}
      <div className="toggle-group" style={{ width: '100%', marginBottom: 'var(--space-lg)' }}>
        {TABS.map(t => (
          <button key={t.key} className={`toggle-option ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Cash/POS Tab */}
      {tab === 'cash-pos' && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Data</th><th>Cash ()</th><th>POS ()</th><th>Totale ()</th><th>Transazioni</th></tr>
            </thead>
            <tbody>
              {dayRows.map(r => (
                <tr key={r.date}>
                  <td style={{ fontWeight: 600 }}>{formatDate(r.date + 'T12:00:00')}</td>
                  <td style={{ color: 'var(--success)', fontWeight: 600 }}>{fmt(r.cash)}</td>
                  <td style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>{fmt(r.pos)}</td>
                  <td style={{ fontWeight: 700, fontSize: 15 }}>{fmt(r.total)}</td>
                  <td>{r.txn}</td>
                </tr>
              ))}
              <tr style={{ background: 'var(--bg-surface)' }}>
                <td style={{ fontWeight: 700 }}>TOTALE</td>
                <td style={{ fontWeight: 700, color: 'var(--success)' }}>{fmt(grandCash)}</td>
                <td style={{ fontWeight: 700, color: 'var(--accent-blue)' }}>{fmt(grandPos)}</td>
                <td style={{ fontWeight: 700, fontSize: 15 }}>{fmt(grandTotal)}</td>
                <td style={{ fontWeight: 700 }}>{grandTxn}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Products Tab */}
      {tab === 'products' && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>#</th><th>Prodotto</th><th>Qty venduta</th><th>Revenue</th><th>% del totale</th></tr>
            </thead>
            <tbody>
              {productRows.map((p, i) => (
                <tr key={p.name}>
                  <td style={{ color: 'var(--text-tertiary)', fontWeight: 700 }}>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td>{p.qty}</td>
                  <td style={{ fontWeight: 700 }}>{fmt(p.revenue)}</td>
                  <td>{grandTotal > 0 ? ((p.revenue / grandTotal) * 100).toFixed(1) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Avg Sales Tab */}
      {tab === 'avg' && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Data</th><th>Transazioni</th><th>Revenue</th><th>Avg / Txn</th></tr>
            </thead>
            <tbody>
              {dayRows.map(r => (
                <tr key={r.date}>
                  <td style={{ fontWeight: 600 }}>{formatDate(r.date + 'T12:00:00')}</td>
                  <td>{r.txn}</td>
                  <td>{fmt(r.total)}</td>
                  <td style={{ fontWeight: 700 }}>{fmt(r.txn > 0 ? r.total / r.txn : 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Discounts Tab */}
      {tab === 'discounts' && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Data</th><th>Cliente</th><th>Fattura</th><th>Sconto</th><th>Motivo</th><th>Approvato</th></tr>
            </thead>
            <tbody>
              {discounts.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 'var(--space-xl)' }}>Nessuno sconto nel periodo</td></tr>
              )}
              {discounts.map(s => (
                <tr key={s.id}>
                  <td>{formatTime(s.created_at)}</td>
                  <td style={{ fontWeight: 600 }}>{s.customer_name ?? 'Anonimo'}</td>
                  <td style={{ color: 'var(--text-tertiary)' }}>{s.invoice_number}</td>
                  <td style={{ fontWeight: 700, color: 'var(--danger)' }}>{fmt(s.discount_amount)}</td>
                  <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{s.discount_reason ?? ''}</td>
                  <td>
                    <span className={`badge ${s.discount_approved ? 'badge-success' : 'badge-warning'}`}>
                      {s.discount_approved ? 'Approvato' : 'In attesa'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
