'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { fmt, calcDepositExpected, calcVariance, periodLabel } from '@/lib/utils'
import { printShiftReport, exportShiftCSV } from '@/lib/utils/reports'
import type { ShiftCashSummary, SaleWithItems, Expense, BanconoteMap } from '@/types/database'
import { calcFCU } from '@/types/database'

const BANCONOTE: { value: keyof BanconoteMap; label: string }[] = [
  { value: 50, label: '50' },
  { value: 20, label: '20' },
  { value: 10, label: '10' },
  { value: 5,  label: '5' },
  { value: 2,  label: '2' },
  { value: 1,  label: '1' },
]

export default function ShiftClosePage() {
  const router = useRouter()
  const supabase = createClient()

  const [summary, setSummary] = useState<ShiftCashSummary | null>(null)
  const [sales, setSales] = useState<SaleWithItems[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [storeName, setStoreName] = useState('')
  const [brandName, setBrandName] = useState('MamaMary')
  const [employeeName, setEmployeeName] = useState('')
  const [fcuDefault, setFcuDefault] = useState(200)

  const [banconote, setBanconote] = useState<BanconoteMap>({ 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0 })
  const [depositActual, setDepositActual] = useState('')
  const [varianceReason, setVarianceReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Query direttamente dalla tabella shifts
    const { data: openShift } = await supabase.from('shifts').select('*').eq('user_id', user.id).eq('status', 'open').order('created_at',{ascending:false}).limit(1).single()
    if (!openShift) { router.push('/employee/dashboard'); return }

    // Carica vendite e spese del turno
    const { data: salesData } = await supabase.from('sales').select('*').eq('shift_id', openShift.id).order('created_at')
    const { data: expData } = await supabase.from('expenses').select('*').eq('shift_id', openShift.id).order('created_at')
    setSales(salesData ?? [])
    setExpenses(expData ?? [])

    // Calcola totali
    const allSales = salesData ?? []
    const totalSales = allSales.reduce((s: number, r: any) => s + (parseFloat(r.total) || 0), 0)
    const totalCash = allSales.filter((r: any) => r.payment_method === 'cash').reduce((s: number, r: any) => s + (parseFloat(r.total) || 0), 0)
    const totalPos = totalSales - totalCash
    const totalExpenses = (expData ?? []).reduce((s: number, r: any) => s + (parseFloat(r.amount) || 0), 0)
    const totalResi = allSales.filter((r: any) => r.movement_type === 'return').reduce((s: number, r: any) => s + (parseFloat(r.total) || 0), 0)
    const totalResiCount = allSales.filter((r: any) => r.movement_type === 'return').length

    const sum: any = {
      shift_id: openShift.id,
      user_id: user.id,
      store_id: openShift.store_id,
      status: 'open',
      fce: openShift.fce ?? 0,
      period: openShift.period,
      total_sales: totalSales,
      total_cash: totalCash,
      total_pos: totalPos,
      total_expenses: totalExpenses,
      total_transactions: allSales.length,
      total_resi: totalResi,
      total_resi_count: totalResiCount,
      total_rotti: 0,
      total_missing: 0,
      total_autoconsumo: 0,
      opened_at: openShift.created_at,
      created_at: openShift.created_at,
    }
    setSummary(sum)

    const { data: store } = await supabase.from('stores').select('name').eq('id', openShift.store_id).single()
    const { data: emp } = await supabase.from('users').select('full_name').eq('id', user.id).single()
    const { data: brand } = await supabase.from('brand_config').select('brand_name').eq('store_id', openShift.store_id).single()
    const { data: cfg } = await supabase.from('store_config').select('fcu_default').eq('store_id', openShift.store_id).single()

    setStoreName(store?.name ?? '')
    setEmployeeName(emp?.full_name ?? '')
    setBrandName(brand?.brand_name ?? 'MamaMary')
    setFcuDefault(cfg?.fcu_default ?? 200)
    setLoading(false)
  }

  const fcuValue = calcFCU(banconote)
  const depositValue = parseFloat(depositActual) || 0
  const depositExpected = summary ? calcDepositExpected(summary.fce, summary.total_cash, summary.total_expenses, fcuValue) : 0
  const variance = depositActual ? calcVariance(depositValue, depositExpected) : null
  const hasVariance = variance !== null && Math.abs(variance) > 0.01
  const canClose = Object.values(banconote).some(v => v > 0) && depositActual !== '' && (!hasVariance || varianceReason.trim().length > 0)

  function updateBanconota(value: keyof BanconoteMap, delta: number) {
    setBanconote(prev => ({ ...prev, [value]: Math.max(0, prev[value] + delta) }))
  }

  async function handleClose() {
    if (!summary || !canClose) return
    setClosing(true)
    setError(null)

    const now = new Date().toISOString()

    const { error: closeError } = await supabase.from('shifts').update({
      status: 'closed', fcu: fcuValue, deposit_actual: depositValue,
      variance_reason: hasVariance ? varianceReason : null, closed_at: now,
    }).eq('id', summary.shift_id)

    if (closeError) { setError('Errore nella chiusura del turno.'); setClosing(false); return }

    // Auto-checkout ALL employees still checked in on this shift
    await supabase.from('shift_checkins')
      .update({ checked_out_at: now })
      .eq('shift_id', summary.shift_id)
      .is('checked_out_at', null)

    const report = {
      store_name: storeName, brand_name: brandName, employee_name: employeeName,
      period: summary.period, date: new Date().toLocaleDateString('it-IT'),
      opened_at: new Date(summary.opened_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
      closed_at: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
      fce: summary.fce, fcu: fcuValue,
      total_cash: summary.total_cash, total_pos: summary.total_pos,
      total_sales: summary.total_sales, total_resi: summary.total_resi,
      total_expenses: summary.total_expenses, deposit_expected: depositExpected,
      deposit_actual: depositValue, cash_variance: variance,
      total_transactions: summary.total_transactions, sales, expenses,
    }

    printShiftReport(report)
    // Don't sign out — keep tablet logged in. Just clear active employee and go to check-in.
    localStorage.removeItem('activeEmployeeId')
    localStorage.removeItem('activeEmployeeName')
    router.push('/employee/shift/open')
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><div style={{ color: 'var(--text-secondary)' }}>Caricamento riepilogo...</div></div>
  if (!summary) return null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-surface)', padding: 'var(--space-lg)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', paddingTop: 'var(--space-sm)' }}>
          <Link href="/employee/dashboard" style={{ textDecoration: 'none', color: 'var(--text-primary)', fontSize: 20 }}></Link>
          <div>
            <h2>Chiusura Turno</h2>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center', marginTop: 2 }}>
              <span className="badge badge-brand">{periodLabel[summary.period]}</span>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}</span>
            </div>
          </div>
        </div>

        {/* Riepilogo vendite */}
        <div className="card">
          <h4 style={{ marginBottom: 'var(--space-md)' }}>Riepilogo Turno</h4>
          <div className="cash-row"><span className="cash-row-label">Vendite Totali</span><span className="cash-row-value">{fmt(summary.total_sales)}</span></div>
          <div className="cash-row"><span className="cash-row-label" style={{ paddingLeft: 12 }}>Cash</span><span className="cash-row-value">{fmt(summary.total_cash)}</span></div>
          <div className="cash-row"><span className="cash-row-label" style={{ paddingLeft: 12 }}>POS</span><span className="cash-row-value">{fmt(summary.total_pos)}</span></div>
          {summary.total_resi > 0 && <div className="cash-row"><span className="cash-row-label" style={{ color: 'var(--danger)' }}>Resi ({summary.total_resi_count})</span><span className="cash-row-value" style={{ color: 'var(--danger)' }}>{fmt(summary.total_resi)}</span></div>}
          <div className="cash-row"><span className="cash-row-label">Spese Totali</span><span className="cash-row-value" style={{ color: 'var(--danger)' }}>{fmt(summary.total_expenses)}</span></div>
        </div>

        {/* Movimenti inventario anomali */}
        {(summary.total_rotti > 0 || summary.total_missing > 0 || summary.total_autoconsumo > 0) && (
          <div className="card" style={{ border: '1.5px solid var(--warning)' }}>
            <h4 style={{ marginBottom: 'var(--space-md)', color: 'var(--warning)' }}> Movimenti Inventario</h4>
            {summary.total_resi_count > 0 && <div className="cash-row"><span className="cash-row-label">Resi</span><span className="cash-row-value">{summary.total_resi_count} ({fmt(summary.total_resi)})</span></div>}
            {summary.total_rotti > 0 && <div className="cash-row"><span className="cash-row-label">Prodotti Rotti</span><span className="cash-row-value">{summary.total_rotti}</span></div>}
            {summary.total_missing > 0 && <div className="cash-row"><span className="cash-row-label">Missing Items</span><span className="cash-row-value">{summary.total_missing}</span></div>}
            {summary.total_autoconsumo > 0 && <div className="cash-row"><span className="cash-row-label">Autoconsumo</span><span className="cash-row-value">{summary.total_autoconsumo}</span></div>}
          </div>
        )}

        {/* FCU  Componi Fondo Cassa Uscita */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div>
            <h4>Componi Fondo Cassa Uscita</h4>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
              Inserisci le banconote che lasci in cassa
            </p>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
              FCU Desiderato: <strong>{fmt(fcuDefault)}</strong> (impostato dal proprietario)
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {BANCONOTE.map(({ value, label }) => (
              <div key={value} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ width: 40, fontWeight: 700, fontSize: 15 }}>{label}</span>
                <button onClick={() => updateBanconota(value, -1)} className="btn btn-secondary" style={{ width: 32, height: 32, padding: 0 }}></button>
                <span style={{ fontWeight: 700, minWidth: 24, textAlign: 'center', fontSize: 16 }}>{banconote[value]}</span>
                <button onClick={() => updateBanconota(value, 1)} className="btn btn-secondary" style={{ width: 32, height: 32, padding: 0 }}>+</button>
                <span style={{ marginLeft: 'auto', fontSize: 14, color: 'var(--text-secondary)', fontWeight: 600 }}>
                  = {fmt(banconote[value] * value)}
                </span>
              </div>
            ))}
          </div>

          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: 'var(--space-md)', borderRadius: 'var(--radius-sm)',
            background: Math.abs(fcuValue - fcuDefault) < 1 ? 'var(--success-light)' : 'var(--bg-surface)',
            border: `1px solid ${Math.abs(fcuValue - fcuDefault) < 1 ? 'var(--brand-primary)' : 'var(--border-default)'}`,
          }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Totale FCU</span>
            <span style={{ fontWeight: 700, fontSize: 22, fontFamily: 'var(--font-heading)', color: 'var(--brand-primary)' }}>{fmt(fcuValue)}</span>
          </div>
        </div>

        {/* Chiusura cassa */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          <h4>Chiusura Cassa</h4>
          <div className="input-group">
            <label className="input-label">Deposito Effettivo</label>
            <div className="input-with-prefix">
              <span className="input-prefix"></span>
              <input className="input" type="number" min="0" step="0.01" placeholder={depositExpected.toFixed(2)} value={depositActual} onChange={e => setDepositActual(e.target.value)} />
            </div>
            {fcuValue > 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                Deposito atteso: <strong>{fmt(depositExpected)}</strong> = FCE {fmt(summary.fce)} + Cash {fmt(summary.total_cash)}  Resi {fmt(summary.total_resi)}  Spese {fmt(summary.total_expenses)}  FCU {fmt(fcuValue)}
              </div>
            )}
          </div>

          {variance !== null && (
            <div style={{ background: hasVariance ? 'var(--danger-light)' : 'var(--success-light)', border: `1px solid ${hasVariance ? 'var(--danger)' : 'var(--success)'}`, borderRadius: 'var(--radius-sm)', padding: 'var(--space-md)' }}>
              <div style={{ fontWeight: 700, color: hasVariance ? 'var(--danger)' : 'var(--success)', marginBottom: hasVariance ? 4 : 0 }}>
                Varianza Cassa: {variance > 0 ? '+' : ''}{fmt(variance)}
              </div>
              {hasVariance && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Il deposito non corrisponde al cash atteso. Inserisci il motivo per procedere.</div>}
            </div>
          )}

          {hasVariance && (
            <div className="input-group">
              <label className="input-label">Motivo Varianza *</label>
              <textarea className="input" placeholder="Inserisci motivo della varianza..." value={varianceReason} onChange={e => setVarianceReason(e.target.value)} rows={3} />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => exportShiftCSV({
            store_name: storeName, brand_name: brandName, employee_name: employeeName,
            period: summary.period, date: new Date().toLocaleDateString('it-IT'),
            opened_at: '', closed_at: null, fce: summary.fce, fcu: fcuValue,
            total_cash: summary.total_cash, total_pos: summary.total_pos,
            total_sales: summary.total_sales, total_resi: summary.total_resi,
            total_expenses: summary.total_expenses, deposit_expected: depositExpected,
            deposit_actual: depositValue, cash_variance: variance,
            total_transactions: summary.total_transactions, sales, expenses,
          })}>
             Export CSV
          </button>
        </div>

        {error && <div style={{ background: 'var(--danger-light)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', padding: '10px var(--space-md)', fontSize: 13, color: 'var(--danger)' }}>{error}</div>}

        <button onClick={handleClose} disabled={!canClose || closing} className="btn btn-primary btn-full btn-lg" style={{ marginBottom: 'var(--space-2xl)' }}>
          {closing ? 'Chiusura in corso...' : ' Chiudi Turno e Stampa Riepilogo'}
        </button>
      </div>
    </div>
  )
}
