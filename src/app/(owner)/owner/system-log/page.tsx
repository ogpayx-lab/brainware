'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ─── Tab definitions ───
interface TabDef {
  key: string
  label: string
  icon: string
  table: string
  select: string
  columns: { key: string; label: string; width?: number; editable?: boolean; type?: string; render?: (v: any, row: any) => string }[]
  orderBy: string
}

const TABS: TabDef[] = [
  {
    key: 'sales', label: 'Vendite', icon: '💰', table: 'sales',
    select: 'id, created_at, store_id, user_id, total, payment_method, customer_name, customer_nationality, acquisition_channel, movement_type, invoice_number, stores(name), users(full_name)',
    orderBy: 'created_at',
    columns: [
      { key: '_date', label: 'Data', width: 90, render: (_, r) => new Date(r.created_at).toLocaleDateString('it-IT') },
      { key: '_time', label: 'Ora', width: 60, render: (_, r) => new Date(r.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) },
      { key: '_store', label: 'Negozio', width: 140, render: (_, r) => r.stores?.name || '' },
      { key: '_employee', label: 'Dipendente', width: 120, render: (_, r) => r.users?.full_name || '' },
      { key: 'total', label: 'Totale', width: 80, editable: true, type: 'number' },
      { key: 'payment_method', label: 'Pagamento', width: 80, editable: true },
      { key: 'customer_name', label: 'Cliente', width: 120, editable: true },
      { key: 'customer_nationality', label: 'Nazionalità', width: 90, editable: true },
      { key: 'acquisition_channel', label: 'Canale', width: 80, editable: true },
      { key: 'movement_type', label: 'Tipo', width: 60, editable: true },
      { key: 'invoice_number', label: 'N° Fattura', width: 80, editable: true },
    ],
  },
  {
    key: 'sale_items', label: 'Prodotti Venduti', icon: '🛒', table: 'sale_items',
    select: 'id, sale_id, product_id, product_name, qty, unit_price, line_total, created_at, sales(created_at, stores(name), users(full_name))',
    orderBy: 'created_at',
    columns: [
      { key: '_date', label: 'Data', width: 90, render: (_, r) => r.sales ? new Date(r.sales.created_at).toLocaleDateString('it-IT') : '' },
      { key: '_store', label: 'Negozio', width: 140, render: (_, r) => r.sales?.stores?.name || '' },
      { key: 'product_name', label: 'Prodotto', width: 160, editable: true },
      { key: 'qty', label: 'Qty', width: 50, editable: true, type: 'number' },
      { key: 'unit_price', label: 'Prezzo', width: 70, editable: true, type: 'number' },
      { key: 'line_total', label: 'Totale', width: 70, editable: true, type: 'number' },
      { key: 'sale_id', label: 'Sale ID', width: 80, render: (v) => v?.slice(0, 8) || '' },
    ],
  },
  {
    key: 'shifts', label: 'Turni', icon: '⏰', table: 'shifts',
    select: 'id, opened_at, closed_at, period, status, deposit_actual, user_id, store_id, created_at, users(full_name), stores(name)',
    orderBy: 'created_at',
    columns: [
      { key: '_date', label: 'Data', width: 90, render: (_, r) => new Date(r.opened_at || r.created_at).toLocaleDateString('it-IT') },
      { key: '_open', label: 'Apertura', width: 60, render: (_, r) => r.opened_at ? new Date(r.opened_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '' },
      { key: '_close', label: 'Chiusura', width: 60, render: (_, r) => r.closed_at ? new Date(r.closed_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '—' },
      { key: '_store', label: 'Negozio', width: 140, render: (_, r) => r.stores?.name || '' },
      { key: '_employee', label: 'Dipendente', width: 120, render: (_, r) => r.users?.full_name || '' },
      { key: 'period', label: 'Periodo', width: 70, editable: true },
      { key: 'status', label: 'Status', width: 70, editable: true },
      { key: 'deposit_actual', label: 'Deposit', width: 70, editable: true, type: 'number' },
    ],
  },
  {
    key: 'expenses', label: 'Spese', icon: '💸', table: 'expenses',
    select: 'id, amount, description, created_at, store_id, user_id, users(full_name), stores(name)',
    orderBy: 'created_at',
    columns: [
      { key: '_date', label: 'Data', width: 90, render: (_, r) => new Date(r.created_at).toLocaleDateString('it-IT') },
      { key: '_time', label: 'Ora', width: 60, render: (_, r) => new Date(r.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) },
      { key: '_store', label: 'Negozio', width: 140, render: (_, r) => r.stores?.name || '' },
      { key: '_employee', label: 'Dipendente', width: 120, render: (_, r) => r.users?.full_name || '' },
      { key: 'amount', label: 'Importo', width: 80, editable: true, type: 'number' },
      { key: 'description', label: 'Descrizione', width: 200, editable: true },
    ],
  },
  {
    key: 'fidelity', label: 'Fidelity', icon: '💳', table: 'fidelity_cards',
    select: 'id, customer_name, customer_email, customer_phone, code, created_at, store_id, created_by, users(full_name), stores(name)',
    orderBy: 'created_at',
    columns: [
      { key: '_date', label: 'Data', width: 90, render: (_, r) => new Date(r.created_at).toLocaleDateString('it-IT') },
      { key: '_store', label: 'Negozio', width: 140, render: (_, r) => r.stores?.name || '' },
      { key: 'customer_name', label: 'Cliente', width: 140, editable: true },
      { key: 'customer_email', label: 'Email', width: 160, editable: true },
      { key: 'customer_phone', label: 'Telefono', width: 110, editable: true },
      { key: 'code', label: 'Codice', width: 100 },
      { key: '_created_by', label: 'Creata da', width: 120, render: (_, r) => r.users?.full_name || '' },
    ],
  },
  {
    key: 'day_off', label: 'Giorni Liberi', icon: '📅', table: 'day_off_requests',
    select: 'id, date, notes, status, created_at, user_id, store_id, users(full_name), stores(name)',
    orderBy: 'created_at',
    columns: [
      { key: 'date', label: 'Data Richiesta', width: 100, editable: true },
      { key: '_store', label: 'Negozio', width: 140, render: (_, r) => r.stores?.name || '' },
      { key: '_employee', label: 'Dipendente', width: 120, render: (_, r) => r.users?.full_name || '' },
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
    select: 'id, description, status, priority, due_date, created_at, store_id, assigned_to, users(full_name), stores(name)',
    orderBy: 'created_at',
    columns: [
      { key: '_date', label: 'Creato', width: 90, render: (_, r) => new Date(r.created_at).toLocaleDateString('it-IT') },
      { key: '_store', label: 'Negozio', width: 140, render: (_, r) => r.stores?.name || '' },
      { key: '_assigned', label: 'Assegnato a', width: 120, render: (_, r) => r.users?.full_name || '' },
      { key: 'description', label: 'Descrizione', width: 200, editable: true },
      { key: 'status', label: 'Status', width: 80, editable: true },
      { key: 'priority', label: 'Priorità', width: 70, editable: true },
      { key: 'due_date', label: 'Scadenza', width: 90, editable: true },
    ],
  },
  {
    key: 'maintenance', label: 'Manutenzione', icon: '🔧', table: 'maintenance_tasks',
    select: 'id, title, description, status, completed_at, created_at, store_id, user_id, users(full_name), stores(name)',
    orderBy: 'created_at',
    columns: [
      { key: '_date', label: 'Data', width: 90, render: (_, r) => new Date(r.created_at).toLocaleDateString('it-IT') },
      { key: '_store', label: 'Negozio', width: 140, render: (_, r) => r.stores?.name || '' },
      { key: '_employee', label: 'Dipendente', width: 120, render: (_, r) => r.users?.full_name || '' },
      { key: 'title', label: 'Titolo', width: 140, editable: true },
      { key: 'description', label: 'Descrizione', width: 200, editable: true },
      { key: 'status', label: 'Status', width: 80, editable: true },
    ],
  },
  {
    key: 'notifications', label: 'Notifiche', icon: '🔔', table: 'notifications',
    select: 'id, type, title, message, read, created_at, store_id, user_id, stores(name), users(full_name)',
    orderBy: 'created_at',
    columns: [
      { key: '_date', label: 'Data', width: 90, render: (_, r) => new Date(r.created_at).toLocaleDateString('it-IT') },
      { key: '_time', label: 'Ora', width: 60, render: (_, r) => new Date(r.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) },
      { key: '_store', label: 'Negozio', width: 130, render: (_, r) => r.stores?.name || '' },
      { key: 'type', label: 'Tipo', width: 80 },
      { key: 'title', label: 'Titolo', width: 160 },
      { key: 'message', label: 'Messaggio', width: 250 },
      { key: 'read', label: 'Letto', width: 50, render: (v) => v ? '✓' : '✗' },
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
  const [activeTab, setActiveTab] = useState('sales')
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
  const editRef = useRef<HTMLInputElement>(null)

  const tab = TABS.find(t => t.key === activeTab)!

  useEffect(() => { loadStores() }, [])
  useEffect(() => { if (orgStoreIds.length > 0) loadData() }, [activeTab, selectedStore, dateFrom, dateTo, orgStoreIds])

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

    let query = supabase
      .from(tab.table)
      .select(tab.select)
      .order(tab.orderBy, { ascending: false })
      .gte(tab.orderBy, fromDate)
      .lte(tab.orderBy, toDate)
      .limit(500)

    // Handle store filtering
    if (tab.table === 'warehouse_movements') {
      if (warehouseIds.length > 0) query = query.in('warehouse_id', warehouseIds)
    } else if (tab.table === 'sale_items') {
      // sale_items don't have store_id directly, filter by sales.store_id won't work in simple query
      // Load all and filter later or skip store filter
    } else {
      query = query.in('store_id', storeIds)
    }

    const { data, error } = await query
    if (error) {
      console.error(`Error loading ${tab.table}:`, error)
      // Retry without date filter in case column doesn't exist
      const { data: fallback } = await supabase
        .from(tab.table)
        .select(tab.select)
        .order('created_at', { ascending: false })
        .limit(200)
      setRows(fallback ?? [])
    } else {
      setRows(data ?? [])
    }
    setLoading(false)
  }

  function startEdit(rowId: string, colKey: string, currentValue: any) {
    setEditCell({ rowId, colKey })
    setEditValue(currentValue?.toString() ?? '')
    setTimeout(() => editRef.current?.focus(), 50)
  }

  async function saveEdit() {
    if (!editCell) return
    setSaving(true)
    const col = tab.columns.find(c => c.key === editCell.colKey)
    let value: any = editValue
    if (col?.type === 'number') value = parseFloat(editValue) || 0

    const { error } = await supabase
      .from(tab.table)
      .update({ [editCell.colKey]: value })
      .eq('id', editCell.rowId)

    if (!error) {
      setRows(prev => prev.map(r => r.id === editCell.rowId ? { ...r, [editCell.colKey]: value } : r))
      setSavedMsg('✓ Salvato')
      setTimeout(() => setSavedMsg(''), 2000)
    } else {
      setSavedMsg('✗ Errore')
      setTimeout(() => setSavedMsg(''), 3000)
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
    const { error } = await supabase.from(tab.table).delete().eq('id', rowId)
    if (!error) {
      setRows(prev => prev.filter(r => r.id !== rowId))
      setSavedMsg('🗑 Eliminato')
      setTimeout(() => setSavedMsg(''), 2000)
    }
  }

  function getCellValue(row: any, col: TabDef['columns'][0]) {
    if (col.render) return col.render(row[col.key], row)
    const v = row[col.key]
    if (v === null || v === undefined) return ''
    if (typeof v === 'boolean') return v ? '✓' : '✗'
    return v.toString()
  }

  if (loading && stores.length === 0) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>Caricamento...</div>

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>📋 System Log</h2>
          <p style={{ color: '#6B7280', fontSize: 12 }}>Visualizzazione e modifica dati grezzi — stile foglio di calcolo</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {savedMsg && <span style={{ fontSize: 12, fontWeight: 600, color: savedMsg.includes('✗') ? '#DC2626' : '#16A34A' }}>{savedMsg}</span>}
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

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 6, padding: '6px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: '#6B7280' }}>STORE:</label>
          <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)}
            style={{ fontSize: 11, padding: '3px 6px', border: '1px solid #D1D5DB', borderRadius: 4, background: 'white' }}>
            <option value="all">Tutti</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div style={{ width: 1, height: 16, background: '#D1D5DB' }} />
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
                              type={col.type === 'number' ? 'number' : 'text'}
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
                      <button onClick={() => deleteRow(row.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#DC2626', opacity: 0.4, padding: 0 }}
                        title="Elimina riga"
                        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}>
                        ✗
                      </button>
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
    </div>
  )
}
