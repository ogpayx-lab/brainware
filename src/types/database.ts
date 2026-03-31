export type UserRole = 'owner' | 'employee'
export type ShiftPeriod = 'morning' | 'evening'
export type ShiftStatus = 'open' | 'closed'
export type PaymentMethod = 'cash' | 'pos' | 'other'
export type ProductCategory = 'flowers' | 'hashish' | 'oils' | 'edibles' | 'accessories'
export type AcquisitionChannel = 'walk-in' | 'social' | 'google' | 'referral' | 'other'
export type TransferStatus = 'pending' | 'in_transit' | 'completed' | 'cancelled'
export type InventoryStatus = 'pending' | 'match' | 'mismatch' | 'escalated'
export type VendingStatus = 'online' | 'offline' | 'maintenance'
export type RequestPriority = 'alta' | 'media' | 'bassa'
export type MovementType = 'sale' | 'reso' | 'trasferimento' | 'rotto' | 'missing' | 'autoconsumo' | 'vendita_errata'

export const movementLabel: Record<MovementType, string> = {
  sale: 'Vendita', reso: 'Reso', trasferimento: 'Trasferimento',
  rotto: 'Rotto', missing: 'Missing', autoconsumo: 'Autoconsumo', vendita_errata: 'Vendita Errata',
}
export const movementColor: Record<MovementType, string> = {
  sale: 'var(--success)', reso: 'var(--danger)', trasferimento: 'var(--accent-blue)',
  rotto: 'var(--warning)', missing: '#FF6B6B', autoconsumo: 'var(--accent-indigo)', vendita_errata: 'var(--danger)',
}
export const priorityColor: Record<RequestPriority, string> = {
  alta: 'badge-danger', media: 'badge-warning', bassa: 'badge-gray',
}
export const vendingStatusLabel: Record<VendingStatus, { label: string; color: string }> = {
  online: { label: 'Online', color: 'var(--success)' },
  offline: { label: 'Offline', color: 'var(--danger)' },
  maintenance: { label: 'Manutenzione', color: 'var(--warning)' },
}

export interface BrandConfig {
  id: string; store_id: string; brand_name: string; logo_letter: string
  primary_color: string; piva: string | null; receipt_header: string | null
  receipt_footer: string | null; language: string
}
export interface StoreConfig {
  id: string; store_id: string; fcu_default: number
  morning_shift_start: string; morning_shift_end: string
  evening_shift_start: string; evening_shift_end: string
  stock_alert_threshold: number; discount_notify_pct: number
}
export interface Store { id: string; name: string; address: string | null; city: string | null; is_active: boolean; created_at: string; updated_at: string }
export interface User { id: string; store_id: string | null; full_name: string; role: UserRole; hired_at: string | null; is_active: boolean; avatar_url: string | null; created_at: string; updated_at: string }
export interface BonusConfig { id: string; store_id: string; sales_commission_pct: number; hours_bonus_amount: number; hours_bonus_threshold: number; avg_sale_threshold: number; is_active: boolean }
export interface Product { id: string; store_id: string; name: string; category: ProductCategory; price: number; cost: number | null; unit: string; barcode: string | null; stock: number; stock_alert: number; is_active: boolean; created_at: string; updated_at: string }
export interface Shift { id: string; store_id: string; user_id: string; period: ShiftPeriod; status: ShiftStatus; fce: number; fcu: number | null; deposit_actual: number | null; variance_reason: string | null; opened_at: string; closed_at: string | null; created_at: string }

export interface ShiftCashSummary {
  shift_id: string; store_id: string; user_id: string; period: ShiftPeriod; status: ShiftStatus
  fce: number; fcu: number | null; deposit_actual: number | null
  total_cash: number; total_pos: number; total_sales: number; total_transactions: number
  total_resi: number; total_resi_count: number; total_expenses: number
  total_rotti: number; total_missing: number; total_autoconsumo: number
  deposit_expected: number; cash_variance: number | null; opened_at: string; closed_at: string | null
}

export interface Sale {
  id: string; shift_id: string; store_id: string; user_id: string
  movement_type: MovementType; payment_method: PaymentMethod
  subtotal: number; discount_amount: number; discount_pct: number; total: number
  cash_received: number | null; cash_change: number | null; pos_reference: string | null
  customer_name: string | null; customer_nationality: string | null
  acquisition_channel: AcquisitionChannel | null; customer_email: string | null
  discount_reason: string | null; discount_approved: boolean
  invoice_number: string | null; document_number: string | null; original_sale_id: string | null
  created_at: string
}
export interface SaleItem { id: string; sale_id: string; product_id: string; product_name: string; qty: number; unit_price: number; line_total: number }
export interface SaleWithItems extends Sale { items: SaleItem[]; employee_name?: string; store_name?: string }
export interface Expense { id: string; shift_id: string; store_id: string; user_id: string; amount: number; description: string; created_at: string }
export interface CartItem { product: Product; qty: number; line_total: number }

export interface VendingMachine {
  id: string; store_id: string; name: string; location: string | null
  status: VendingStatus; daily_revenue: number | null
  last_restock_at: string | null; next_restock_at: string | null; is_active: boolean
}
export interface StockRequestItem {
  id: string; stock_request_id: string; product_id: string; product_name: string
  stock_before: number; qty_requested: number; qty_delivered: number | null
  priority: RequestPriority; min_threshold: number; cost_per_unit: number | null
}
export interface EmployeeBonusResult { total_sales: number; total_shifts: number; qualifying_shifts: number; avg_sale_per_txn: number; commission: number; hours_bonus: number; total_bonus: number }

export interface ShiftReportData {
  store_name: string; brand_name: string; employee_name: string; period: ShiftPeriod
  date: string; opened_at: string; closed_at: string | null
  fce: number; fcu: number | null; total_cash: number; total_pos: number
  total_sales: number; total_resi: number; total_expenses: number
  deposit_expected: number; deposit_actual: number | null; cash_variance: number | null
  total_transactions: number; sales: SaleWithItems[]; expenses: Expense[]
}

export interface BanconoteMap { 50: number; 20: number; 10: number; 5: number; 2: number; 1: number }
export function calcFCU(b: BanconoteMap): number {
  return b[50]*50 + b[20]*20 + b[10]*10 + b[5]*5 + b[2]*2 + b[1]*1
}

export interface FidelityCard {
  id: string
  store_id: string
  created_by: string
  card_number: string
  customer_name: string
  customer_phone: string | null
  customer_email: string | null
  customer_nationality: string | null
  customer_dob: string | null
  acquisition_source: string | null
  notes: string | null
  points: number
  is_active: boolean
  created_at: string
}