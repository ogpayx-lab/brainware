import type { ShiftCashSummary, SaleWithItems, Expense, ShiftReportData, CartItem } from '@/types/database'

// ============================================================
// Currency
// ============================================================
export function fmt(amount: number | null | undefined): string {
  if (amount == null) return '0,00'
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount)
}

// ============================================================
// Cart
// ============================================================
export function calcCart(items: CartItem[], discountPct = 0, discountAmt = 0) {
  const subtotal = items.reduce((s, i) => s + i.line_total, 0)
  const discount = discountAmt > 0 ? discountAmt : subtotal * (discountPct / 100)
  const total = Math.max(0, subtotal - discount)
  return { subtotal, discount, total }
}

// ============================================================
// Margin
// ============================================================
export function calcMarginPct(price: number, cost: number | null | undefined): number | null {
  if (!cost || cost <= 0 || price <= 0) return null
  return ((price - cost) / price) * 100
}

// ============================================================
// Date / Time
// ============================================================
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ============================================================
// Labels
// ============================================================
export const periodLabel: Record<string, string> = {
  morning: 'Turno Mattina',
  evening: 'Turno Sera',
}

export const categoryLabel: Record<string, string> = {
  flowers:     'Infiorescenze',
  hashish:     'Hashish',
  oils:        'Oli & Estratti',
  edibles:     'Edibili',
  accessories: 'Accessori',
}

export const movementLabel: Record<string, string> = {
  sale:         'Vendita',
  reso:         'Reso',
  rotto:        'Rotto',
  missing:      'Mancante',
  autoconsumo:  'Autoconsumo',
  trasferimento:'Trasferimento',
}

// ============================================================
// Shift report
// ============================================================
export function buildShiftReport(summary: ShiftCashSummary, sales: SaleWithItems[], expenses: Expense[], fcuDefault: number): ShiftReportData {
  const totalCash = sales.filter(s => s.payment_method === 'cash' && s.movement_type === 'sale').reduce((s, x) => s + x.total, 0)
  const totalPos  = sales.filter(s => s.payment_method === 'pos'  && s.movement_type === 'sale').reduce((s, x) => s + x.total, 0)
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const cashExpected  = summary.fce + totalCash - totalExpenses
  const depositExpected = Math.max(0, cashExpected - fcuDefault)

  return {
    ...summary,
    total_cash: totalCash,
    total_pos:  totalPos,
    total_expenses: totalExpenses,
    cash_expected: cashExpected,
    deposit_expected: depositExpected,
    fcu_default: fcuDefault,
  }
}

export function calcDepositExpected(fce: number, totalCash: number, totalExpenses: number, fcuDefault: number): number {
  return Math.max(0, fce + totalCash - totalExpenses - fcuDefault)
}

export function calcVariance(depositExpected: number, depositActual: number): number {
  return depositActual - depositExpected
}