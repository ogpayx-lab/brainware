'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmt, formatTime } from '@/lib/utils'
import { BottomNav } from '@/components/employee/BottomNav'

export default function EmployeeSalesLog() {
  const router = useRouter()
  const supabase = createClient()
  const [sales, setSales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'cash' | 'pos'>('all')
  const [shiftId, setShiftId] = useState<string | null>(null)
  const [summary, setSummary] = useState({ total: 0, cash: 0, pos: 0, count: 0, discounts: 0 })

  useEffect(() => { loadSales() }, [])

  async function loadSales() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase.from('users').select('store_id').eq('id', user.id).single()
    if (!profile?.store_id) { setLoading(false); return }

    // Find open shift
    const { data: openShift } = await supabase
      .from('shifts')
      .select('id')
      .eq('store_id', profile.store_id)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!openShift) { setLoading(false); return }
    setShiftId(openShift.id)

    // Load all sales for this shift with items
    const { data: salesData } = await supabase
      .from('sales')
      .select('*, sale_items(id, product_name, qty, unit_price, line_total)')
      .eq('shift_id', openShift.id)
      .order('created_at', { ascending: false })

    const allSales = salesData ?? []
    setSales(allSales)

    const totalCash = allSales.filter(s => s.payment_method === 'cash').reduce((sum, s) => sum + Number(s.total), 0)
    const totalPos = allSales.filter(s => s.payment_method === 'pos').reduce((sum, s) => sum + Number(s.total), 0)
    const totalDiscounts = allSales.reduce((sum, s) => sum + Number(s.discount_amount || 0), 0)
    setSummary({
      total: totalCash + totalPos,
      cash: totalCash,
      pos: totalPos,
      count: allSales.length,
      discounts: totalDiscounts,
    })

    setLoading(false)
  }

  const filtered = filter === 'all' ? sales : sales.filter(s => s.payment_method === filter)

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div style={{ color: 'var(--text-secondary)' }}>Caricamento...</div>
    </div>
  )

  return (
    <div className="page" style={{ paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-subtle)', padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => router.back()} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', padding: 0 }}>←</button>
            <h3 style={{ margin: 0, fontSize: 18 }}>🧾 Registro Vendite</h3>
          </div>
          <span className="badge badge-brand" style={{ fontSize: 11 }}>{summary.count} vendite</span>
        </div>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 12, padding: '12px 14px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 4 }}>💰 Totale</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--brand-primary)' }}>{fmt(summary.total)}</div>
          </div>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 12, padding: '12px 14px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 4 }}>💵 Cash</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{fmt(summary.cash)}</div>
          </div>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 12, padding: '12px 14px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 4 }}>💳 POS</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#7C3AED' }}>{fmt(summary.pos)}</div>
          </div>
        </div>

        {summary.discounts > 0 && (
          <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 10, padding: '8px 12px', fontSize: 12, color: '#92400E', display: 'flex', justifyContent: 'space-between' }}>
            <span>🏷️ Sconti concessi</span>
            <strong>−{fmt(summary.discounts)}</strong>
          </div>
        )}

        {/* Filter Tabs */}
        <div style={{ display: 'flex', gap: 6 }}>
          {([
            { key: 'all', label: 'Tutte', count: sales.length },
            { key: 'cash', label: '💵 Cash', count: sales.filter(s => s.payment_method === 'cash').length },
            { key: 'pos', label: '💳 POS', count: sales.filter(s => s.payment_method === 'pos').length },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              style={{
                padding: '6px 14px', borderRadius: 20, border: 'none',
                background: filter === tab.key ? 'var(--brand-primary)' : 'var(--bg-surface)',
                color: filter === tab.key ? 'white' : 'var(--text-secondary)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Sales List */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🧾</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Nessuna vendita registrata</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Le vendite appariranno qui</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((sale) => (
              <SaleCard key={sale.id} sale={sale} />
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}

function SaleCard({ sale }: { sale: any }) {
  const [expanded, setExpanded] = useState(false)
  const items = sale.sale_items ?? []

  return (
    <div
      style={{
        background: 'var(--bg-primary)', borderRadius: 14, border: '1px solid var(--border-subtle)',
        overflow: 'hidden', transition: 'box-shadow 0.15s',
      }}
    >
      {/* Sale Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
          cursor: 'pointer',
        }}
      >
        {/* Payment icon */}
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: sale.payment_method === 'cash' ? 'rgba(34,197,94,0.1)' : 'rgba(124,58,237,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
        }}>
          {sale.payment_method === 'cash' ? '💵' : '💳'}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>
              {sale.customer_name || 'Anonimo'}
            </span>
            <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--brand-primary)' }}>
              {fmt(sale.total)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', gap: 8, alignItems: 'center' }}>
              <span>{sale.invoice_number}</span>
              {sale.customer_nationality && <span>🌍 {sale.customer_nationality}</span>}
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              {formatTime(sale.created_at)}
            </span>
          </div>
          {Number(sale.discount_amount) > 0 && (
            <div style={{ fontSize: 11, color: '#F59E0B', marginTop: 2, fontWeight: 600 }}>
              🏷️ Sconto: −{fmt(sale.discount_amount)} ({sale.discount_reason || 'N/D'})
            </div>
          )}
        </div>

        <span style={{
          fontSize: 12, color: 'var(--text-tertiary)',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
        }}>
          ▼
        </span>
      </div>

      {/* Expanded items */}
      {expanded && items.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '10px 16px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 6 }}>
            📦 {items.length} prodott{items.length === 1 ? 'o' : 'i'}
          </div>
          {items.map((item: any, i: number) => (
            <div key={item.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 0',
              borderBottom: i < items.length - 1 ? '1px solid var(--border-subtle)' : 'none',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{item.product_name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {Number(item.qty) % 1 === 0 ? Number(item.qty) : Number(item.qty).toFixed(2)} × {fmt(item.unit_price)}
                </div>
              </div>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{fmt(item.line_total)}</span>
            </div>
          ))}
          {Number(sale.discount_amount) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', marginTop: 4, borderTop: '1px dashed var(--border-subtle)' }}>
              <span style={{ fontSize: 12, color: '#F59E0B' }}>Sconto applicato</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#F59E0B' }}>−{fmt(sale.discount_amount)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0', marginTop: 4, borderTop: '1px solid var(--border-subtle)' }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Totale</span>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--brand-primary)' }}>{fmt(sale.total)}</span>
          </div>
        </div>
      )}

      {expanded && items.length === 0 && (
        <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '12px 16px', fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>
          Nessun dettaglio prodotti disponibile
        </div>
      )}
    </div>
  )
}
