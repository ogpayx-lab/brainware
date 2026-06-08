'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/lib/i18n'

// ─── Tab definitions ───
interface TabDef {
  key: string
  label: string
  icon: string
  table: string
  select: string
  columns: { key: string; label: string; width?: number; editable?: boolean; type?: string; render?: (v: any, row: any) => string }[]
  orderBy: string
  computed?: boolean
}

const TABS: TabDef[] = [
  {
    key: 'products', label: 'Prodotti', icon: '📦', table: 'products',
    select: 'id, name, price, category, unit, barcode, is_active, store_id, created_at',
    orderBy: 'name',
    columns: [
      { key: '_store', label: 'Negozio', width: 140, render: (_, r) => r._storeName || '' },
      { key: 'name', label: 'Nome', width: 200, editable: true },
      { key: 'price', label: 'Prezzo', width: 70, editable: true, type: 'number' },
      { key: 'category', label: 'Categoria', width: 120, editable: true },
      { key: 'unit', label: 'Unità', width: 60, editable: true },
      { key: 'barcode', label: 'Barcode', width: 100, editable: true },
      { key: 'is_active', label: 'Attivo', width: 50, editable: true, render: (v) => v ? '✓' : '✗' },
    ],
  },
  {
    key: 'employees', label: 'Dipendenti', icon: '👤', table: 'users',
    select: 'id, full_name, pin, role, is_active, store_id, created_at',
    orderBy: 'full_name',
    columns: [
      { key: '_store', label: 'Negozio', width: 140, render: (_, r) => r._storeName || '' },
      { key: 'full_name', label: 'Nome', width: 160, editable: true },
      { key: 'pin', label: 'PIN', width: 60, editable: true },
      { key: 'role', label: 'Ruolo', width: 80, editable: true },
      { key: 'is_active', label: 'Attivo', width: 50, editable: true, render: (v) => v ? '✓' : '✗' },
    ],
  },
  {
    key: 'sales', label: 'Vendite', icon: '💰', table: 'sales',
    select: 'id, created_at, store_id, user_id, total, payment_method, customer_name, customer_nationality, acquisition_channel, movement_type, invoice_number',
    orderBy: 'created_at',
    columns: [
      { key: 'created_at', label: 'Data/Ora', width: 135, editable: true, type: 'datetime', render: (v) => v ? new Date(v).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '' },
      { key: 'payment_method', label: 'Pagamento', width: 70, editable: true },
      { key: '_store', label: 'Negozio', width: 120, render: (_, r) => r._storeName || '' },
      { key: 'invoice_number', label: 'N° Fatt.', width: 65, editable: true },
      { key: 'total', label: 'Totale', width: 70, editable: true, type: 'number' },
      { key: '_employee', label: 'Referente', width: 100, render: (_, r) => r._userName || '' },
      { key: 'customer_name', label: 'Customer', width: 110, editable: true },
      { key: 'customer_nationality', label: 'Nazionalità', width: 85, editable: true },
      { key: 'acquisition_channel', label: 'How Found', width: 90, editable: true },
      { key: 'movement_type', label: 'Tipo', width: 55, editable: true },
      { key: '_products', label: 'Prodotti', width: 200, render: (_, r) => r._products || '' },
    ],
  },
  {
    key: 'sale_items', label: 'Prodotti Venduti', icon: '🛒', table: 'sale_items',
    select: 'id, sale_id, product_id, product_name, qty, unit_price, line_total',
    orderBy: 'id',
    columns: [
      { key: '_sale_date', label: 'Data/Ora', width: 120, render: (_: any, r: any) => r._sale_date || '' },
      { key: '_invoice', label: 'Invoice', width: 60, render: (_: any, r: any) => r._invoice || '' },
      { key: '_customer', label: 'Cliente', width: 100, render: (_: any, r: any) => r._customer || '' },
      { key: '_payment', label: 'Pag.', width: 55, render: (_: any, r: any) => r._payment || '' },
      { key: 'product_name', label: 'Prodotto', width: 180, editable: true },
      { key: 'qty', label: 'Qty', width: 50, editable: true, type: 'number' },
      { key: 'unit_price', label: 'Prezzo', width: 70, editable: true, type: 'number' },
      { key: 'line_total', label: 'Totale', width: 70, editable: true, type: 'number' },
    ],
  },
  {
    key: 'shifts', label: 'Turni', icon: '⏰', table: 'shifts',
    select: 'id, opened_at, closed_at, period, status, fce, fcu, deposit_actual, user_id, store_id, created_at',
    orderBy: 'created_at',
    columns: [
      { key: 'created_at', label: 'Data/Ora', width: 135, editable: true, type: 'datetime', render: (v) => v ? new Date(v).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '' },
      { key: 'fce', label: 'FCE', width: 60, editable: true, type: 'number' },
      { key: 'fcu', label: 'FCU', width: 60, editable: true, type: 'number' },
      { key: '_employee', label: 'Referente', width: 100, render: (_, r) => r._userName || '' },
      { key: '_open', label: 'Checkin', width: 55, render: (_, r) => r.opened_at ? new Date(r.opened_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '' },
      { key: '_close', label: 'Checkout', width: 55, render: (_, r) => r.closed_at ? new Date(r.closed_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '—' },
      { key: '_store', label: 'Negozio', width: 120, render: (_, r) => r._storeName || '' },
      { key: 'period', label: 'Periodo', width: 65, editable: true },
      { key: 'status', label: 'Status', width: 65, editable: true },
      { key: 'deposit_actual', label: 'Deposit', width: 65, editable: true, type: 'number' },
    ],
  },
  {
    key: 'expenses', label: 'Spese', icon: '💸', table: 'expenses',
    select: 'id, amount, description, created_at, store_id, user_id',
    orderBy: 'created_at',
    columns: [
      { key: 'created_at', label: 'Data/Ora', width: 135, editable: true, type: 'datetime', render: (v: any) => v ? new Date(v).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '' },
      { key: '_store', label: 'Negozio', width: 140, render: (_, r) => r._storeName || '' },
      { key: '_employee', label: 'Dipendente', width: 120, render: (_, r) => r._userName || '' },
      { key: 'amount', label: 'Importo', width: 80, editable: true, type: 'number' },
      { key: 'description', label: 'Descrizione', width: 200, editable: true },
    ],
  },
  {
    key: 'fidelity', label: 'Members', icon: '💳', table: 'fidelity_cards',
    select: 'id, customer_name, email, phone, nationality, how_found, is_resident, card_number, points, created_at, store_id',
    orderBy: 'created_at',
    columns: [
      { key: '_date', label: 'Data', width: 90, render: (_, r) => new Date(r.created_at).toLocaleDateString('it-IT') },
      { key: '_store', label: 'Negozio', width: 140, render: (_, r) => r._storeName || '' },
      { key: 'customer_name', label: 'Nome', width: 140, editable: true },
      { key: 'phone', label: 'Telefono', width: 110, editable: true },
      { key: 'email', label: 'Email', width: 160, editable: true },
      { key: 'nationality', label: 'Nazionalità', width: 90, editable: true },
      { key: 'how_found', label: 'Fonte', width: 90, editable: true },
      { key: 'is_resident', label: 'Residente', width: 60, editable: true, render: (v) => v ? '✓' : '✗' },
      { key: 'points', label: 'Punti', width: 50, editable: true, type: 'number' },
      { key: 'card_number', label: 'N° Card', width: 100 },
    ],
  },
  {
    key: 'day_off', label: 'Giorni Liberi', icon: '📅', table: 'day_off_requests',
    select: 'id, date, notes, status, created_at, user_id, store_id',
    orderBy: 'created_at',
    columns: [
      { key: 'date', label: 'Data Richiesta', width: 100, editable: true },
      { key: '_store', label: 'Negozio', width: 140, render: (_, r) => r._storeName || '' },
      { key: '_employee', label: 'Dipendente', width: 120, render: (_, r) => r._userName || '' },
      { key: 'status', label: 'Status', width: 80, editable: true },
      { key: 'notes', label: 'Note', width: 200, editable: true },
    ],
  },
  {
    key: 'warehouse', label: 'Mov. Stock', icon: '🔄', table: 'warehouse_movements',
    select: 'id, product_name, movement_type, qty, destination_name, reference_type, notes, created_at, warehouse_id',
    orderBy: 'created_at',
    columns: [
      { key: '_date', label: 'Data', width: 90, render: (_, r) => new Date(r.created_at).toLocaleDateString('it-IT') },
      { key: '_time', label: 'Ora', width: 60, render: (_, r) => new Date(r.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) },
      { key: 'product_name', label: 'Prodotto', width: 140, editable: true },
      { key: 'movement_type', label: 'Tipo', width: 90, editable: true },
      { key: 'qty', label: 'Qty', width: 50, editable: true, type: 'number' },
      { key: 'destination_name', label: 'Destinazione', width: 120, editable: true },
      { key: 'reference_type', label: 'Riferimento', width: 100 },
      { key: 'notes', label: 'Note', width: 160, editable: true },
    ],
  },
  {
    key: 'tasks', label: 'Task', icon: '📋', table: 'tasks',
    select: 'id, description, status, priority, due_date, created_at, store_id, assigned_to',
    orderBy: 'created_at',
    columns: [
      { key: '_date', label: 'Creato', width: 90, render: (_, r) => new Date(r.created_at).toLocaleDateString('it-IT') },
      { key: '_store', label: 'Negozio', width: 140, render: (_, r) => r._storeName || '' },
      { key: '_assigned', label: 'Assegnato a', width: 120, render: (_, r) => r._userName || '' },
      { key: 'description', label: 'Descrizione', width: 200, editable: true },
      { key: 'status', label: 'Status', width: 80, editable: true },
      { key: 'priority', label: 'Priorità', width: 70, editable: true },
      { key: 'due_date', label: 'Scadenza', width: 90, editable: true },
    ],
  },
  {
    key: 'maintenance', label: 'Manutenzione', icon: '🔧', table: 'maintenance_logs',
    select: 'id, title, notes, completed, completed_at, created_at, store_id, user_id',
    orderBy: 'created_at',
    columns: [
      { key: '_date', label: 'Data', width: 90, render: (_, r) => new Date(r.created_at).toLocaleDateString('it-IT') },
      { key: '_store', label: 'Negozio', width: 140, render: (_, r) => r._storeName || '' },
      { key: '_employee', label: 'Dipendente', width: 120, render: (_, r) => r._userName || '' },
      { key: 'title', label: 'Titolo', width: 140, editable: true },
      { key: 'notes', label: 'Note', width: 200, editable: true },
      { key: 'completed', label: 'Fatto', width: 50, render: (v) => v ? '✓' : '✗' },
    ],
  },
  {
    key: 'notifications', label: 'Notifiche', icon: '🔔', table: 'notifications',
    select: 'id, type, title, message, read, created_at, store_id, user_id',
    orderBy: 'created_at',
    columns: [
      { key: '_date', label: 'Data', width: 90, render: (_, r) => new Date(r.created_at).toLocaleDateString('it-IT') },
      { key: '_time', label: 'Ora', width: 60, render: (_, r) => new Date(r.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) },
      { key: '_store', label: 'Negozio', width: 130, render: (_, r) => r._storeName || '' },
      { key: 'type', label: 'Tipo', width: 80 },
      { key: 'title', label: 'Titolo', width: 160 },
      { key: 'message', label: 'Messaggio', width: 250 },
      { key: 'read', label: 'Letto', width: 50, render: (v) => v ? '✓' : '✗' },
    ],
  },
  {
    key: 'ricarica', label: 'Ricarica', icon: '📥', table: 'stock_requests',
    select: 'id, product_name, qty_requested, qty_delivered, status, notes, created_at, store_id, user_id',
    orderBy: 'created_at',
    columns: [
      { key: '_date', label: 'Data', width: 85, render: (_, r) => new Date(r.created_at).toLocaleDateString('it-IT') },
      { key: '_time', label: 'Ora', width: 55, render: (_, r) => new Date(r.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) },
      { key: '_store', label: 'Negozio', width: 120, render: (_, r) => r._storeName || '' },
      { key: '_employee', label: 'Richiesto da', width: 110, render: (_, r) => r._userName || '' },
      { key: 'product_name', label: 'Prodotto', width: 180, editable: true },
      { key: 'qty_requested', label: 'Qty Rich.', width: 70, type: 'number' },
      { key: 'qty_delivered', label: 'Qty Conseg.', width: 80, editable: true, type: 'number' },
      { key: 'status', label: 'Stato', width: 90, editable: true, render: (v) => v === 'approved' ? '✅ Approvato' : v === 'rejected' ? '❌ Rifiutato' : v === 'owner_review' ? '⏳ In revisione' : v || '' },
      { key: 'notes', label: 'Note', width: 150, editable: true },
    ],
  },
  {
    key: 'checklist', label: 'Store Maint.', icon: '🧹', table: 'daily_checklists',
    select: 'id, date, shift_period, clean_floor, clean_door, clean_bathroom, clean_bancone, clean_shelfs, clean_products, throw_trash, expired_products, price_labels, maintenance_supplies, vending_on_off, vending_ricarica, deposits_delivery, store_id, user_id, created_at',
    orderBy: 'date',
    columns: [
      { key: '_store', label: 'Negozio', width: 120, render: (_, r) => r._storeName || '' },
      { key: 'date', label: 'Data', width: 85, editable: true },
      { key: 'shift_period', label: 'Turno', width: 70, editable: true },
      { key: 'clean_floor', label: 'Floor', width: 45, editable: true, render: (v) => v ? '✓' : '✗' },
      { key: 'clean_door', label: 'Door', width: 45, editable: true, render: (v) => v ? '✓' : '✗' },
      { key: 'clean_bathroom', label: 'Bath', width: 45, editable: true, render: (v) => v ? '✓' : '✗' },
      { key: 'clean_bancone', label: 'Banc.', width: 45, editable: true, render: (v) => v ? '✓' : '✗' },
      { key: 'clean_shelfs', label: 'Shelfs', width: 45, editable: true, render: (v) => v ? '✓' : '✗' },
      { key: 'clean_products', label: 'Prod.', width: 45, editable: true, render: (v) => v ? '✓' : '✗' },
      { key: 'throw_trash', label: 'Trash', width: 45, editable: true, render: (v) => v ? '✓' : '✗' },
      { key: 'expired_products', label: 'Expir.', width: 45, editable: true, render: (v) => v ? '✓' : '✗' },
      { key: 'price_labels', label: 'Labels', width: 45, editable: true, render: (v) => v ? '✓' : '✗' },
      { key: 'vending_on_off', label: 'Vend.', width: 45, editable: true, render: (v) => v ? '✓' : '✗' },
      { key: 'deposits_delivery', label: 'Dep.', width: 45, editable: true, render: (v) => v ? '✓' : '✗' },
    ],
  },
  {
    key: 'person_counted', label: 'Person Counted', icon: '🔢', table: 'inventory_count_items',
    select: 'id, inventory_count_id, product_id, product_name, system_qty, counted_qty, status, mismatch_reason, attempt_count',
    orderBy: 'product_name',
    columns: [
      { key: 'product_name', label: 'Prodotto', width: 180, editable: true },
      { key: 'system_qty', label: 'Sistema', width: 65, type: 'number' },
      { key: 'counted_qty', label: 'Contato', width: 65, editable: true, type: 'number' },
      { key: '_diff', label: 'Diff', width: 55, render: (_: any, r: any) => { const d = (r.counted_qty ?? 0) - (r.system_qty ?? 0); return d === 0 ? '—' : d > 0 ? `+${d}` : `${d}` } },
      { key: 'status', label: 'Status', width: 80, render: (v: any) => v === 'match' ? '✅ Match' : v === 'mismatch' ? '⚠️ Non corr.' : v || '' },
      { key: 'mismatch_reason', label: 'Note', width: 150, editable: true },
      { key: 'attempt_count', label: 'Tentativi', width: 60, type: 'number' },
    ],
  },
  {
    key: 'inventory', label: 'Inventario', icon: '📊', table: 'products',
    select: 'id, name, category, stock, starting_point, store_id',
    orderBy: 'name',
    columns: [
      { key: '_store', label: 'Negozio', width: 120, render: (_, r) => r._storeName || '' },
      { key: 'name', label: 'Item Name', width: 200 },
      { key: 'category', label: 'Categoria', width: 110 },
      { key: 'stock', label: 'Current Inv.', width: 80, editable: true, type: 'number' },
      { key: 'starting_point', label: 'Starting Point', width: 90, editable: true, type: 'number' },
    ],
  },
  // ─── COMPUTED TABS ───
  {
    key: 'sold_items_daily', label: 'Sold Items', icon: '📦', table: 'sale_items', select: '', orderBy: '', computed: true,
    columns: [
      { key: 'date', label: 'Data', width: 90 },
      { key: 'product_name', label: 'Item Name', width: 200 },
      { key: 'sum_total', label: 'SUM SubTotal', width: 100 },
      { key: 'sum_qty', label: 'SUM QTY', width: 70 },
    ],
  },
  {
    key: 'cash_pos', label: 'Cash / POS', icon: '💵', table: 'sales', select: '', orderBy: '', computed: true,
    columns: [
      { key: 'date', label: 'Data', width: 90 },
      { key: 'cash', label: 'Cash', width: 80 },
      { key: 'pos', label: 'POS', width: 80 },
      { key: 'auto_consumo', label: 'AutoConsumo', width: 85 },
      { key: 'online', label: 'Online', width: 80 },
      { key: 'other', label: 'Altro', width: 80 },
      { key: 'grand_total', label: 'Grand Total', width: 90 },
    ],
  },
  {
    key: 'deposits', label: 'Deposits', icon: '🏦', table: 'shifts', select: '', orderBy: '', computed: true,
    columns: [
      { key: 'date', label: 'Data', width: 100 },
      { key: 'amount', label: 'Amount', width: 100 },
    ],
  },
  {
    key: 'avg_sales', label: 'Avg Sales/Cust.', icon: '📈', table: 'sales', select: '', orderBy: '', computed: true,
    columns: [
      { key: 'date', label: 'Data', width: 110 },
      { key: 'total_sales', label: 'Total Sales', width: 100 },
      { key: 'customers', label: 'Customers', width: 80 },
      { key: 'avg', label: 'Avg Sales/Customer', width: 120 },
    ],
  },
]

// ─── Styles ───
const CELL: React.CSSProperties = {
  border: '1px solid #D1D5DB', padding: '4px 6px', fontSize: 11, whiteSpace: 'nowrap',
  verticalAlign: 'middle', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 250,
}
const HEADER: React.CSSProperties = {
  ...CELL, background: '#F3F4F6', fontWeight: 700, fontSize: 10, textTransform: 'uppercase',
  letterSpacing: '0.03em', color: '#374151', position: 'sticky' as const, top: 0, zIndex: 2,
}

export default function SystemLogPage() {
  const router = useRouter()
  const supabase = createClient()
  const t = useT()
  const [activeTab, setActiveTab] = useState('products')
  const [rows, setRows] = useState<any[]>([])
  const [stores, setStores] = useState<any[]>([])
  const [selectedStore, setSelectedStore] = useState('all')
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0] })
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)
  const [orgStoreIds, setOrgStoreIds] = useState<string[]>([])
  const [editCell, setEditCell] = useState<{ rowId: string; colKey: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [warehouseIds, setWarehouseIds] = useState<string[]>([])
  const [currentUserId, setCurrentUserId] = useState<string>('')
  // New Sale modal
  const [showSaleModal, setShowSaleModal] = useState(false)
  const [saleProducts, setSaleProducts] = useState<any[]>([])
  const [saleCart, setSaleCart] = useState<{ productId: string; name: string; price: number; qty: number }[]>([])
  const [saleForm, setSaleForm] = useState({ payment_method: 'cash', customer_name: '', customer_nationality: '', acquisition_channel: 'walk-in', movement_type: 'sale', discount: 0, discount_reason: '', created_at: new Date().toISOString().slice(0, 16) })
  const [saleSearchQ, setSaleSearchQ] = useState('')
  const [saleSaving, setSaleSaving] = useState(false)
  const editRef = useRef<HTMLInputElement>(null)

  const tab = TABS.find(t => t.key === activeTab)!

  useEffect(() => { loadStores() }, [])
  useEffect(() => { if (orgStoreIds.length > 0) loadData() }, [activeTab, selectedStore, dateFrom, dateTo, orgStoreIds])

  async function loadStores() {
    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
    if (!user) { router.push('/login'); return }
    setCurrentUserId(user.id)
    const { data: profile } = await supabase.from('users').select('store_id, role').eq('id', user.id).single()
    if (profile?.role !== 'owner') { router.push('/login'); return }
    const { data: myStore } = await supabase.from('stores').select('organization_id').eq('id', profile.store_id).single()
    const oid = myStore?.organization_id
    const { data: storeList } = await supabase.from('stores').select('id,name').eq('organization_id', oid).eq('is_active', true).order('name')
    const allStores = storeList ?? []
    setStores(allStores)
    setOrgStoreIds(allStores.map(s => s.id))

    // Load warehouse IDs for warehouse_movements tab
    const { data: warehouses } = await supabase.from('warehouses').select('id').eq('organization_id', oid)
    setWarehouseIds((warehouses ?? []).map(w => w.id))

    setLoading(false)
  }

  async function loadData() {
    setLoading(true)
    setEditCell(null)
    const fromDate = `${dateFrom}T00:00:00`
    const toDate = `${dateTo}T23:59:59`
    const storeIds = selectedStore === 'all' ? orgStoreIds : [selectedStore]

    let data: any[] = []

    if (tab.key === 'products' || tab.key === 'employees' || tab.key === 'inventory') {
      // No date filter — just store filter + order by name/date
      let query = supabase.from(tab.table).select(tab.select)
        .in('store_id', storeIds)
        .order(tab.orderBy, { ascending: tab.key === 'products' || tab.key === 'inventory' })
        .limit(1000)
      const { data: result, error } = await query
      if (error) console.error(`Error loading ${tab.table}:`, error.message)
      data = result ?? []
    } else if (tab.key === 'person_counted') {
      // Load inventory_count_items via inventory_counts (which has store_id)
      const { data: counts } = await supabase.from('inventory_counts').select('id')
        .in('store_id', storeIds).order('created_at', { ascending: false }).limit(10)
      const countIds = (counts ?? []).map((c: any) => c.id)
      if (countIds.length > 0) {
        const { data: items } = await supabase.from('inventory_count_items').select(tab.select)
          .in('inventory_count_id', countIds).order('product_name')
        data = items ?? []
      }
    } else if (tab.key === 'checklist') {
      // Daily checklists — filter by store + date range on 'date' column
      let query = supabase.from('daily_checklists').select(tab.select)
        .in('store_id', storeIds)
        .gte('date', dateFrom).lte('date', dateTo)
        .order('date', { ascending: false })
        .limit(500)
      const { data: result, error } = await query
      if (error) console.error('Error loading daily_checklists:', error.message)
      data = result ?? []
    } else if (tab.key === 'ricarica') {
      // Ricarica = stock_requests from stores
      const { data: result } = await supabase.from('stock_requests').select(tab.select)
        .in('store_id', storeIds)
        .gte('created_at', fromDate).lte('created_at', toDate)
        .order('created_at', { ascending: false }).limit(500)
      data = result ?? []
    } else if (tab.key === 'sale_items') {
      // sale_items: no created_at, no store_id — load via sale_ids from sales in date range
      const { data: salesInRange } = await supabase
        .from('sales')
        .select('id')
        .in('store_id', storeIds)
        .gte('created_at', fromDate)
        .lte('created_at', toDate)
        .limit(500)
      const saleIds = (salesInRange ?? []).map(s => s.id)
      if (saleIds.length > 0) {
        // Build sale lookup for enriching items
        const { data: salesFull } = await supabase.from('sales')
          .select('id, created_at, customer_name, invoice_number, payment_method')
          .in('id', saleIds)
        const saleMap = new Map((salesFull ?? []).map((s: any) => [s.id, s]))

        const { data: items } = await supabase
          .from('sale_items')
          .select(tab.select)
          .in('sale_id', saleIds)
          .limit(1000)
        // Enrich each item with parent sale info
        data = (items ?? []).map((item: any) => {
          const sale = saleMap.get(item.sale_id)
          return {
            ...item,
            _sale_date: sale ? new Date(sale.created_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '',
            _customer: sale?.customer_name || '',
            _invoice: sale?.invoice_number || '',
            _payment: sale?.payment_method || '',
          }
        })
      }
    } else if (tab.computed) {
      // ─── COMPUTED TABS ───
      if (tab.key === 'sold_items_daily') {
        const { data: salesInRange } = await supabase.from('sales').select('id, created_at').in('store_id', storeIds).gte('created_at', fromDate).lte('created_at', toDate)
        const saleIds = (salesInRange ?? []).map(s => s.id)
        const saleDateMap = new Map((salesInRange ?? []).map(s => [s.id, new Date(s.created_at).toLocaleDateString('it-IT')]))
        if (saleIds.length > 0) {
          const { data: items } = await supabase.from('sale_items').select('sale_id, product_name, qty, line_total').in('sale_id', saleIds)
          const grouped: Record<string, Record<string, { total: number; qty: number }>> = {}
          for (const it of items ?? []) {
            const d = saleDateMap.get(it.sale_id) || '?'
            if (!grouped[d]) grouped[d] = {}
            if (!grouped[d][it.product_name]) grouped[d][it.product_name] = { total: 0, qty: 0 }
            grouped[d][it.product_name].total += it.line_total || 0
            grouped[d][it.product_name].qty += it.qty || 0
          }
          data = []; let idx = 0
          for (const [date, products] of Object.entries(grouped).sort()) {
            for (const [name, vals] of Object.entries(products).sort()) {
              data.push({ id: `comp-${idx++}`, date, product_name: name, sum_total: vals.total.toFixed(2), sum_qty: vals.qty })
            }
          }
        }
      } else if (tab.key === 'cash_pos') {
        const { data: sales } = await supabase.from('sales').select('created_at, total, payment_method').in('store_id', storeIds).gte('created_at', fromDate).lte('created_at', toDate)
        const grouped: Record<string, Record<string, number>> = {}
        for (const s of sales ?? []) {
          const d = new Date(s.created_at).toLocaleDateString('it-IT')
          if (!grouped[d]) grouped[d] = {}
          const pm = (s.payment_method || 'other').toLowerCase()
          grouped[d][pm] = (grouped[d][pm] || 0) + (s.total || 0)
        }
        data = Object.entries(grouped).sort().map(([date, methods], i) => ({
          id: `comp-${i}`, date,
          cash: (methods['cash'] || 0).toFixed(2),
          pos: (methods['pos'] || 0).toFixed(2),
          auto_consumo: (methods['auto_consumo'] || methods['autoconsumo'] || 0).toFixed(2),
          online: (methods['online'] || 0).toFixed(2),
          other: Object.entries(methods).filter(([k]) => !['cash','pos','auto_consumo','autoconsumo','online'].includes(k)).reduce((s, [,v]) => s + v, 0).toFixed(2),
          grand_total: Object.values(methods).reduce((s, v) => s + v, 0).toFixed(2),
        }))
      } else if (tab.key === 'deposits') {
        const { data: shifts } = await supabase.from('shifts').select('opened_at, fce, fcu, deposit_actual, store_id').in('store_id', storeIds).gte('opened_at', fromDate).lte('opened_at', toDate).eq('status', 'closed')
        const { data: sales } = await supabase.from('sales').select('created_at, total, payment_method').in('store_id', storeIds).gte('created_at', fromDate).lte('created_at', toDate)
        const { data: expenses } = await supabase.from('expenses').select('created_at, amount').in('store_id', storeIds).gte('created_at', fromDate).lte('created_at', toDate)
        const daily: Record<string, { fce: number; fcu: number; cash: number; expenses: number }> = {}
        for (const sh of shifts ?? []) {
          const d = new Date(sh.opened_at).toLocaleDateString('it-IT')
          if (!daily[d]) daily[d] = { fce: 0, fcu: 0, cash: 0, expenses: 0 }
          daily[d].fce += sh.fce || 0
          daily[d].fcu += sh.fcu || 0
        }
        for (const s of sales ?? []) {
          if ((s.payment_method || '').toLowerCase() === 'cash') {
            const d = new Date(s.created_at).toLocaleDateString('it-IT')
            if (!daily[d]) daily[d] = { fce: 0, fcu: 0, cash: 0, expenses: 0 }
            daily[d].cash += s.total || 0
          }
        }
        for (const e of expenses ?? []) {
          const d = new Date(e.created_at).toLocaleDateString('it-IT')
          if (daily[d]) daily[d].expenses += e.amount || 0
        }
        data = Object.entries(daily).sort().map(([date, v], i) => ({
          id: `comp-${i}`, date, amount: (v.fce + v.cash - v.expenses - v.fcu).toFixed(2),
        }))
      } else if (tab.key === 'avg_sales') {
        const { data: sales } = await supabase.from('sales').select('created_at, total, customer_name').in('store_id', storeIds).gte('created_at', fromDate).lte('created_at', toDate).eq('movement_type', 'sale')
        const daily: Record<string, { total: number; customers: Set<string> }> = {}
        for (const s of sales ?? []) {
          const d = new Date(s.created_at).toLocaleDateString('it-IT')
          if (!daily[d]) daily[d] = { total: 0, customers: new Set() }
          daily[d].total += s.total || 0
          daily[d].customers.add(s.customer_name || s.id || 'anon')
        }
        data = Object.entries(daily).sort().map(([date, v], i) => ({
          id: `comp-${i}`, date, total_sales: v.total.toFixed(2), customers: v.customers.size,
          avg: v.customers.size > 0 ? (v.total / v.customers.size).toFixed(2) : '0',
        }))
      }
    } else {
      // Normal tables with created_at and store_id
      let query = supabase
        .from(tab.table)
        .select(tab.select)
        .order(tab.orderBy, { ascending: false })
        .limit(500)

      // Date filter (skip for tables without created_at)
      query = query.gte(tab.orderBy, fromDate).lte(tab.orderBy, toDate)

      // Store filter
      if (tab.table === 'warehouse_movements') {
        if (warehouseIds.length > 0) query = query.in('warehouse_id', warehouseIds)
      } else {
        query = query.in('store_id', storeIds)
      }

      const { data: result, error } = await query
      if (error) {
        console.error(`Error loading ${tab.table}:`, error.message)
        // Retry without date filter
        const { data: fb } = await supabase
          .from(tab.table)
          .select(tab.select)
          .order('id', { ascending: false })
          .limit(200)
        data = fb ?? []
      } else {
        data = result ?? []
      }
    }

    // Resolve user names and store names
    const userIds = [...new Set(data.map(r => r.user_id || r.created_by || r.assigned_to).filter(Boolean))]
    const storeIdsInData = [...new Set(data.map(r => r.store_id).filter(Boolean))]

    let userMap = new Map<string, string>()
    let storeMap = new Map<string, string>()

    if (userIds.length > 0) {
      const { data: usersData } = await supabase.from('users').select('id, full_name').in('id', userIds)
      userMap = new Map((usersData ?? []).map(u => [u.id, u.full_name]))
    }
    if (storeIdsInData.length > 0) {
      const { data: storesData } = await supabase.from('stores').select('id, name').in('id', storeIdsInData)
      storeMap = new Map((storesData ?? []).map(s => [s.id, s.name]))
    }

    // Attach resolved names as _userName and _storeName
    data = data.map(r => ({
      ...r,
      _userName: userMap.get(r.user_id || r.created_by || r.assigned_to || '') || '',
      _storeName: storeMap.get(r.store_id || '') || '',
    }))

    // Enrich sales/customers tabs with product names
    if (tab.key === 'sales' && data.length > 0) {
      const saleIds = data.map(r => r.id).filter(Boolean)
      if (saleIds.length > 0) {
        const { data: items } = await supabase.from('sale_items').select('sale_id, product_name, qty').in('sale_id', saleIds)
        const productMap = new Map<string, string>()
        for (const it of items ?? []) {
          const existing = productMap.get(it.sale_id) || ''
          const entry = `${it.product_name} x${it.qty}`
          productMap.set(it.sale_id, existing ? `${existing}, ${entry}` : entry)
        }
        data = data.map(r => ({ ...r, _products: productMap.get(r.id) || '' }))
      }
    }

    setRows(data)
    setLoading(false)
  }

  function startEdit(rowId: string, colKey: string, currentValue: any) {
    // Boolean toggle (for checklist checkboxes)
    if (typeof currentValue === 'boolean') {
      toggleBoolean(rowId, colKey, currentValue)
      return
    }
    setEditCell({ rowId, colKey })
    // Format datetime for datetime-local input
    const col = tab.columns.find(c => c.key === colKey)
    if (col?.type === 'datetime' && currentValue) {
      const d = new Date(currentValue)
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
      setEditValue(local)
    } else {
      setEditValue(currentValue?.toString() ?? '')
    }
    setTimeout(() => editRef.current?.focus(), 50)
  }

  async function toggleBoolean(rowId: string, colKey: string, current: boolean) {
    const newVal = !current
    await supabase.from(tab.table).update({ [colKey]: newVal }).eq('id', rowId)
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, [colKey]: newVal } : r))
    setSavedMsg(newVal ? '✓ Attivato' : '✗ Disattivato')
    setTimeout(() => setSavedMsg(''), 1500)
  }

  async function saveEdit() {
    if (!editCell) return
    setSaving(true)
    const col = tab.columns.find(c => c.key === editCell.colKey)
    let value: any = editValue
    if (col?.type === 'number') value = parseFloat(editValue) || 0
    if (col?.type === 'datetime') value = editValue ? new Date(editValue).toISOString() : null

    // Try RPC that bypasses RLS for owner edits
    const { error: rpcError } = await supabase.rpc('owner_update_row', {
      p_table: tab.table,
      p_id: editCell.rowId,
      p_column: editCell.colKey,
      p_value: value?.toString() ?? '',
    })

    if (!rpcError) {
      setRows(prev => prev.map(r => r.id === editCell.rowId ? { ...r, [editCell.colKey]: value } : r))
      setSavedMsg('✓ Salvato')
      setTimeout(() => setSavedMsg(''), 2000)
    } else {
      // Fallback: direct update + verify
      await supabase.from(tab.table).update({ [editCell.colKey]: value }).eq('id', editCell.rowId)
      // Verify it actually persisted
      const { data: check } = await supabase.from(tab.table).select(editCell.colKey).eq('id', editCell.rowId).single()
      if (check && String(check[editCell.colKey]) === String(value)) {
        setRows(prev => prev.map(r => r.id === editCell.rowId ? { ...r, [editCell.colKey]: value } : r))
        setSavedMsg('✓ Salvato')
        setTimeout(() => setSavedMsg(''), 2000)
      } else {
        setSavedMsg('✗ RLS blocca la modifica — serve la migration')
        setTimeout(() => setSavedMsg(''), 4000)
      }
    }
    setEditCell(null)
    setSaving(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') saveEdit()
    if (e.key === 'Escape') setEditCell(null)
  }

  function exportCSV() {
    const headers = tab.columns.map(c => c.label)
    const csvRows = [headers.join(';')]
    for (const row of rows) {
      const values = tab.columns.map(col => {
        if (col.render) return col.render(row[col.key], row)
        return row[col.key]?.toString() ?? ''
      })
      csvRows.push(values.map(v => `"${(v || '').replace(/"/g, '""')}"`).join(';'))
    }
    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `log_${tab.key}_${dateFrom}_${dateTo}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function deleteRow(rowId: string) {
    if (!confirm('Sei sicuro di voler eliminare questa riga? Azione irreversibile.')) return
    // Try RPC first
    const { error: rpcErr } = await supabase.rpc('owner_delete_row', { p_table: tab.table, p_id: rowId })
    if (!rpcErr) {
      setRows(prev => prev.filter(r => r.id !== rowId))
      setSavedMsg('🗑 Eliminato')
      setTimeout(() => setSavedMsg(''), 2000)
      return
    }
    // Fallback
    const { error } = await supabase.from(tab.table).delete().eq('id', rowId)
    if (!error) {
      setRows(prev => prev.filter(r => r.id !== rowId))
      setSavedMsg('🗑 Eliminato')
      setTimeout(() => setSavedMsg(''), 2000)
    } else {
      setSavedMsg('✗ Impossibile eliminare')
      setTimeout(() => setSavedMsg(''), 3000)
    }
  }

  async function addRow() {
    const storeId = selectedStore !== 'all' ? selectedStore : orgStoreIds[0]
    if (!storeId && tab.table !== 'sale_items') { setSavedMsg('✗ Seleziona uno store'); setTimeout(() => setSavedMsg(''), 3000); return }
    if (tab.table === 'users') { setSavedMsg('✗ Usa la pagina Dipendenti per aggiungere personale'); setTimeout(() => setSavedMsg(''), 4000); return }
    if (tab.table === 'notifications') { setSavedMsg('✗ Le notifiche sono generate dal sistema'); setTimeout(() => setSavedMsg(''), 4000); return }
    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    let newRow: any = {}
    switch (tab.table) {
      case 'products': newRow = { id, name: '', price: 0, category: '', stock: 0, unit: 'pz', barcode: '', is_active: true, store_id: storeId, created_at: now }; break
      case 'sales': {
        // Open modal instead of adding empty row
        const stId = selectedStore !== 'all' ? selectedStore : orgStoreIds[0]
        const { data: prods } = await supabase.from('products').select('id, name, price, category, stock').eq('store_id', stId).eq('is_active', true).order('name')
        setSaleProducts(prods ?? [])
        setSaleCart([])
        setSaleForm({ payment_method: 'cash', customer_name: '', customer_nationality: '', acquisition_channel: 'walk-in', movement_type: 'sale', discount: 0, discount_reason: '', created_at: new Date().toISOString().slice(0, 16) })
        setSaleSearchQ('')
        setShowSaleModal(true)
        setSaving(false)
        return
      }
      case 'sale_items': newRow = { id, product_name: '', qty: 1, unit_price: 0, line_total: 0 }; break
      case 'shifts': newRow = { id, opened_at: now, period: 'morning', status: 'open', fce: 0, fcu: null, deposit_actual: null, store_id: storeId, user_id: currentUserId, created_at: now }; break
      case 'expenses': newRow = { id, amount: 0, description: '', store_id: storeId, user_id: currentUserId, created_at: now }; break
      case 'fidelity_cards': newRow = { id, customer_name: '', phone: '', email: '', nationality: '', how_found: '', is_resident: false, card_number: `FC-${Date.now()}`, points: 0, store_id: storeId, user_id: currentUserId, created_at: now }; break
      case 'day_off_requests': newRow = { id, date: new Date().toISOString().split('T')[0], notes: '', status: 'pending', store_id: storeId, user_id: currentUserId, created_at: now }; break
      case 'warehouse_movements': newRow = { id, product_name: '', movement_type: 'restock', qty: 0, destination_name: '', notes: '', warehouse_id: warehouseIds[0] || null, user_id: currentUserId, created_at: now }; break
      case 'tasks': newRow = { id, description: '', status: 'pending', priority: 'normal', due_date: null, store_id: storeId, user_id: currentUserId, created_at: now }; break
      case 'maintenance_logs': newRow = { id, title: '', notes: '', completed: false, store_id: storeId, user_id: currentUserId, created_at: now }; break
      case 'daily_checklists': newRow = { id, date: new Date().toISOString().split('T')[0], shift_period: 'morning', clean_floor: false, clean_door: false, clean_bathroom: false, clean_bancone: false, clean_shelfs: false, clean_products: false, throw_trash: false, expired_products: false, price_labels: false, maintenance_supplies: false, vending_on_off: false, vending_ricarica: false, deposits_delivery: false, store_id: storeId, user_id: currentUserId, created_at: now }; break
      case 'inventory_count_items': newRow = { id, product_name: '', system_qty: 0, counted_qty: 0, status: 'pending', mismatch_reason: '', attempt_count: 0 }; break
      default: newRow = { id, store_id: storeId, user_id: currentUserId, created_at: now }
    }
    const { data, error } = await supabase.from(tab.table).insert(newRow).select()
    if (error) { setSavedMsg(`✗ ${error.message}`); setTimeout(() => setSavedMsg(''), 4000); return }
    setSavedMsg('✅ Riga aggiunta — clicca sulle celle per compilare')
    setTimeout(() => setSavedMsg(''), 3000)
    loadData()
  }

  function getCellValue(row: any, col: TabDef['columns'][0]) {
    if (col.render) return col.render(row[col.key], row)
    const v = row[col.key]
    if (v === null || v === undefined) return ''
    if (typeof v === 'boolean') return v ? '✓' : '✗'
    return v.toString()
  }

  if (loading && stores.length === 0) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>{t('loading')}</div>

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>{t('db.title')}</h2>
          <p style={{ color: '#6B7280', fontSize: 12 }}>Gestione completa dati — stile foglio di calcolo · Clicca cella per modificare</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {savedMsg && <span style={{ fontSize: 12, fontWeight: 600, color: savedMsg.includes('✗') ? '#DC2626' : '#16A34A' }}>{savedMsg}</span>}
          {!tab.computed && <button onClick={addRow}
            style={{ background: '#7C3AED', color: 'white', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            ➕ Aggiungi Riga
          </button>}
          <button onClick={exportCSV} disabled={rows.length === 0}
            style={{ background: '#16A34A', color: 'white', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: rows.length === 0 ? 0.5 : 1 }}>
            📥 CSV
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 12, flexWrap: 'wrap', borderBottom: '2px solid #E5E7EB', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            style={{
              padding: '6px 12px', fontSize: 11, fontWeight: activeTab === t.key ? 700 : 500,
              border: '1px solid', borderBottom: 'none',
              borderColor: activeTab === t.key ? '#D1D5DB' : 'transparent',
              background: activeTab === t.key ? 'white' : 'transparent',
              color: activeTab === t.key ? '#111827' : '#6B7280',
              borderRadius: '6px 6px 0 0', cursor: 'pointer',
              marginBottom: activeTab === t.key ? -2 : 0,
              position: 'relative', zIndex: activeTab === t.key ? 1 : 0,
            }}>
            <span style={{ marginRight: 4 }}>{t.icon}</span>{t.label}
          </button>
        ))}
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
          Tutti
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

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 6, padding: '6px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: '#6B7280' }}>DA:</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ fontSize: 11, padding: '3px 6px', border: '1px solid #D1D5DB', borderRadius: 4 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: '#6B7280' }}>A:</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{ fontSize: 11, padding: '3px 6px', border: '1px solid #D1D5DB', borderRadius: 4 }} />
        </div>
        <div style={{ width: 1, height: 16, background: '#D1D5DB' }} />
        <span style={{ fontSize: 11, color: '#6B7280' }}>
          <strong>{rows.length}</strong> righe
        </span>
        <span style={{ fontSize: 9, color: '#9CA3AF' }}>
          Clicca su una cella per modificare · ESC annulla · ENTER salva
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Caricamento {tab.label}...</div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, background: 'white', border: '1px solid #E5E7EB', borderRadius: 4, color: '#9CA3AF' }}>
          Nessun dato in "{tab.label}" per il periodo selezionato
        </div>
      ) : (
        <div style={{ border: '1px solid #9CA3AF', borderRadius: 4, overflow: 'hidden', background: 'white' }}>
          <div style={{ maxHeight: '65vh', overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
              <thead>
                <tr>
                  <th style={{ ...HEADER, width: 28, textAlign: 'center' }}>#</th>
                  {tab.columns.map(col => (
                    <th key={col.key} style={{ ...HEADER, width: col.width }}>
                      {col.label}
                      {col.editable && <span style={{ color: '#16A34A', marginLeft: 2, fontSize: 8 }}>✎</span>}
                    </th>
                  ))}
                  <th style={{ ...HEADER, width: 30, textAlign: 'center' }}>🗑</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.id} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FAFAFA' }}>
                    <td style={{ ...CELL, textAlign: 'center', color: '#9CA3AF', fontSize: 9 }}>{i + 1}</td>
                    {tab.columns.map(col => {
                      const isEditing = editCell?.rowId === row.id && editCell?.colKey === col.key
                      const cellVal = getCellValue(row, col)

                      return (
                        <td
                          key={col.key}
                          onClick={() => col.editable && !isEditing ? startEdit(row.id, col.key, row[col.key]) : null}
                          style={{
                            ...CELL,
                            cursor: col.editable ? 'cell' : 'default',
                            background: isEditing ? '#FEF3C7' : undefined,
                            padding: isEditing ? 0 : CELL.padding,
                            outline: isEditing ? '2px solid #F59E0B' : col.editable ? '1px dashed transparent' : undefined,
                          }}
                          title={col.editable ? 'Clicca per modificare' : cellVal}
                        >
                          {isEditing ? (
                            <input
                              ref={editRef}
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onBlur={saveEdit}
                              onKeyDown={handleKeyDown}
                              type={col.type === 'number' ? 'number' : col.type === 'datetime' ? 'datetime-local' : 'text'}
                              style={{
                                width: '100%', border: 'none', outline: 'none',
                                background: '#FEF3C7', padding: '4px 6px', fontSize: 11,
                                fontFamily: 'inherit',
                              }}
                            />
                          ) : (
                            <span style={{ color: col.editable ? '#111827' : '#6B7280' }}>
                              {cellVal}
                            </span>
                          )}
                        </td>
                      )
                    })}
                    <td style={{ ...CELL, textAlign: 'center' }}>
                      {!tab.computed && <button onClick={() => deleteRow(row.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#DC2626', opacity: 0.4, padding: 0 }}
                        title="Elimina riga"
                        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}>
                        ✗
                      </button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderTop: '2px solid #9CA3AF', background: '#F3F4F6', fontSize: 10, color: '#6B7280' }}>
            <span>{tab.icon} {tab.label} · {rows.length} righe</span>
            <span>{dateFrom} → {dateTo}</span>
          </div>
        </div>
      )}

      {/* ═══ NEW SALE MODAL ═══ */}
      {showSaleModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowSaleModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 16, width: '90%', maxWidth: 700, maxHeight: '90vh', overflow: 'auto', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>🛒 Nuova Vendita</h3>
              <button onClick={() => setShowSaleModal(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer' }}>✕</button>
            </div>

            {/* Product search & add */}
            <div style={{ marginBottom: 16 }}>
              <input
                placeholder="🔍 Cerca prodotto..."
                value={saleSearchQ}
                onChange={e => setSaleSearchQ(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #D1D5DB', borderRadius: 8, fontSize: 13, marginBottom: 8 }}
              />
              <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid #E5E7EB', borderRadius: 8 }}>
                {saleProducts
                  .filter(p => !saleSearchQ || p.name.toLowerCase().includes(saleSearchQ.toLowerCase()))
                  .slice(0, 20)
                  .map(p => (
                    <div key={p.id} onClick={() => {
                      const existing = saleCart.find(c => c.productId === p.id)
                      if (existing) setSaleCart(prev => prev.map(c => c.productId === p.id ? { ...c, qty: c.qty + 1 } : c))
                      else setSaleCart(prev => [...prev, { productId: p.id, name: p.name, price: p.price, qty: 1 }])
                      setSaleSearchQ('')
                    }}
                    style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F0FDF4')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                    >
                      <span style={{ fontWeight: 600 }}>{p.name}</span>
                      <span style={{ color: '#6B7280' }}>€{p.price?.toFixed(2)} · Stock: {p.stock}</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Cart */}
            {saleCart.length > 0 && (
              <div style={{ marginBottom: 16, border: '1.5px solid #7C3AED', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ background: '#7C3AED', color: 'white', padding: '6px 12px', fontSize: 12, fontWeight: 700 }}>Carrello ({saleCart.length} prodotti)</div>
                {saleCart.map((item, i) => (
                  <div key={item.productId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid #E5E7EB' }}>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{item.name}</span>
                    <span style={{ fontSize: 12, color: '#6B7280' }}>€{item.price.toFixed(2)}</span>
                    <button onClick={() => setSaleCart(prev => prev.map(c => c.productId === item.productId ? { ...c, qty: Math.max(1, c.qty - 1) } : c))}
                      style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #D1D5DB', background: 'white', cursor: 'pointer', fontWeight: 700 }}>−</button>
                    <span style={{ fontWeight: 700, fontSize: 14, width: 24, textAlign: 'center' }}>{item.qty}</span>
                    <button onClick={() => setSaleCart(prev => prev.map(c => c.productId === item.productId ? { ...c, qty: c.qty + 1 } : c))}
                      style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: '#7C3AED', color: 'white', cursor: 'pointer', fontWeight: 700 }}>+</button>
                    <span style={{ fontWeight: 700, fontSize: 13, width: 60, textAlign: 'right' }}>€{(item.price * item.qty).toFixed(2)}</span>
                    <button onClick={() => setSaleCart(prev => prev.filter(c => c.productId !== item.productId))}
                      style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: 16 }}>✕</button>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#F9FAFB', fontWeight: 700 }}>
                  <span>Subtotale</span>
                  <span>€{saleCart.reduce((s, c) => s + c.price * c.qty, 0).toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Sale details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280' }}>Data e Ora</label>
                <input type="datetime-local" value={saleForm.created_at} onChange={e => setSaleForm(p => ({ ...p, created_at: e.target.value }))}
                  style={{ width: '100%', padding: '8px', border: '1.5px solid #D1D5DB', borderRadius: 8, fontSize: 13 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280' }}>Pagamento</label>
                <select value={saleForm.payment_method} onChange={e => setSaleForm(p => ({ ...p, payment_method: e.target.value }))}
                  style={{ width: '100%', padding: '8px', border: '1.5px solid #D1D5DB', borderRadius: 8, fontSize: 13 }}>
                  <option value="cash">💵 Cash</option>
                  <option value="pos">💳 POS</option>
                  <option value="other">🌐 Online</option>
                  <option value="split">Split</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280' }}>Tipo</label>
                <select value={saleForm.movement_type} onChange={e => setSaleForm(p => ({ ...p, movement_type: e.target.value }))}
                  style={{ width: '100%', padding: '8px', border: '1.5px solid #D1D5DB', borderRadius: 8, fontSize: 13 }}>
                  <option value="sale">Vendita</option>
                  <option value="autoconsumo">Autoconsumo</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280' }}>Cliente</label>
                <input value={saleForm.customer_name} onChange={e => setSaleForm(p => ({ ...p, customer_name: e.target.value }))}
                  placeholder="Nome cliente" style={{ width: '100%', padding: '8px', border: '1.5px solid #D1D5DB', borderRadius: 8, fontSize: 13 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280' }}>Nazionalità</label>
                <input value={saleForm.customer_nationality} onChange={e => setSaleForm(p => ({ ...p, customer_nationality: e.target.value }))}
                  placeholder="es. Italia" style={{ width: '100%', padding: '8px', border: '1.5px solid #D1D5DB', borderRadius: 8, fontSize: 13 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280' }}>Sconto €</label>
                <input type="number" min="0" value={saleForm.discount || ''} onChange={e => setSaleForm(p => ({ ...p, discount: parseFloat(e.target.value) || 0 }))}
                  placeholder="0" style={{ width: '100%', padding: '8px', border: '1.5px solid #D1D5DB', borderRadius: 8, fontSize: 13 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280' }}>Motivo sconto</label>
                <input value={saleForm.discount_reason} onChange={e => setSaleForm(p => ({ ...p, discount_reason: e.target.value }))}
                  placeholder="es. Cliente fisso" style={{ width: '100%', padding: '8px', border: '1.5px solid #D1D5DB', borderRadius: 8, fontSize: 13 }} />
              </div>
            </div>

            {/* Total & Submit */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#F0FDF4', borderRadius: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>Totale:</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: '#16A34A' }}>
                €{Math.max(0, saleCart.reduce((s, c) => s + c.price * c.qty, 0) - (saleForm.discount || 0)).toFixed(2)}
              </span>
            </div>

            <button
              disabled={saleCart.length === 0 || saleSaving}
              onClick={async () => {
                setSaleSaving(true)
                const storeId = selectedStore !== 'all' ? selectedStore : orgStoreIds[0]
                const subtotal = saleCart.reduce((s, c) => s + c.price * c.qty, 0)
                const total = Math.max(0, subtotal - (saleForm.discount || 0))
                const saleId = crypto.randomUUID()
                // Find current open shift for this store
                const { data: openShift } = await supabase.from('shifts').select('id').eq('store_id', storeId).eq('status', 'open').order('created_at', { ascending: false }).limit(1).single()
                // Generate invoice number
                const { count } = await supabase.from('sales').select('id', { count: 'exact', head: true }).eq('store_id', storeId)
                const invNum = `INV-${String((count || 0) + 1).padStart(4, '0')}`
                // Insert sale
                await supabase.from('sales').insert({
                  id: saleId, store_id: storeId, user_id: currentUserId,
                  shift_id: openShift?.id || null,
                  total, subtotal, payment_method: saleForm.payment_method,
                  movement_type: saleForm.movement_type,
                  customer_name: saleForm.customer_name || null,
                  customer_nationality: saleForm.customer_nationality || null,
                  acquisition_channel: saleForm.acquisition_channel || null,
                  invoice_number: invNum,
                  discount_amount: saleForm.discount || 0,
                  discount_reason: saleForm.discount_reason || null,
                  created_at: saleForm.created_at ? new Date(saleForm.created_at).toISOString() : new Date().toISOString(),
                })
                // Insert sale items
                await supabase.from('sale_items').insert(saleCart.map(c => ({
                  id: crypto.randomUUID(), sale_id: saleId,
                  product_id: c.productId, product_name: c.name,
                  qty: c.qty, unit_price: c.price, line_total: c.price * c.qty,
                })))
                // Decrement stock
                for (const c of saleCart) {
                  await supabase.rpc('increment_stock', { product_id: c.productId, qty: -c.qty })
                }
                setSaleSaving(false)
                setShowSaleModal(false)
                setSavedMsg('✅ Vendita creata con prodotti!')
                setTimeout(() => setSavedMsg(''), 3000)
                loadData()
              }}
              style={{ width: '100%', padding: '12px', background: saleCart.length === 0 ? '#D1D5DB' : '#16A34A', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: saleCart.length === 0 ? 'not-allowed' : 'pointer' }}
            >
              {saleSaving ? '⏳ Creazione...' : '✅ Crea Vendita'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
