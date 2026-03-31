'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmt } from '@/lib/utils'

const SA_CARD = { background: '#1E293B', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 } as React.CSSProperties
const SA_TD = { padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 13, color: 'rgba(255,255,255,0.8)' }
const SA_TH = { fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', padding: '10px 16px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)' }

export default function SuperAdminAnalyticsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [data, setData] = useState<any>(null)
  const [period, setPeriod] = useState<'7' | '30' | '90' | '365'>('30')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [period])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/superadmin/login'); return }

    const fromDate = new Date(Date.now() - parseInt(period) * 24 * 60 * 60 * 1000).toISOString()
    const prevFrom = new Date(Date.now() - parseInt(period) * 2 * 24 * 60 * 60 * 1000).toISOString()

    const [{ data: sales }, { data: prevSales }, { data: stores }, { data: employees }, { data: lowStock }, { data: expenses }] = await Promise.all([
      supabase.from('sales').select('total, payment_method, movement_type, created_at, store_id, stores(name)').eq('movement_type', 'sale').gte('created_at', fromDate),
      supabase.from('sales').select('total').eq('movement_type', 'sale').gte('created_at', prevFrom).lt('created_at', fromDate),
      supabase.from('stores').select('id, name, city').eq('is_active', true),
      supabase.from('users').select('id').eq('role', 'employee').eq('is_active', true),
      supabase.from('low_stock_products').select('name, stock, store_name'),
      supabase.from('expenses').select('amount').gte('created_at', fromDate),
    ])

    const totalRev = (sales ?? []).reduce((s, x) => s + x.total, 0)
    const prevRev = (prevSales ?? []).reduce((s, x) => s + x.total, 0)
    const revGrowth = prevRev > 0 ? ((totalRev - prevRev) / prevRev * 100) : 0
    const totalTxn = (sales ?? []).length
    const avgSale = totalTxn > 0 ? totalRev / totalTxn : 0
    const totalExpenses = (expenses ?? []).reduce((s, e) => s + e.amount, 0)

    // By store
    const byStore: Record<string, { name: string; revenue: number; txn: number }> = {}
    for (const sale of (sales ?? [])) {
      const sid = sale.store_id
      const sname = (sale.stores as any)?.name ?? sid
      if (!byStore[sid]) byStore[sid] = { name: sname, revenue: 0, txn: 0 }
      byStore[sid].revenue += sale.total
      byStore[sid].txn++
    }
    const topStores = Object.values(byStore).sort((a, b) => b.revenue - a.revenue).slice(0, 5)

    // By category from sale_items
    const { data: items } = await supabase.from('sale_items').select('line_total, products(category)').gte('created_at', fromDate)
    const byCat: Record<string, number> = {}
    for (const item of (items ?? [])) {
      const cat = (item.products as any)?.category ?? 'other'
      byCat[cat] = (byCat[cat] ?? 0) + item.line_total
    }

    setData({
      totalRev, prevRev, revGrowth, totalTxn, avgSale, totalExpenses,
      owners: 0, stores: (stores ?? []).length, employees: (employees ?? []).length,
      topStores, byCat, lowStock: lowStock ?? [],
      ops: { varianza: -2.30, scontiPct: 2.9, maintenance: 94.2 }
    })
    setLoading(false)
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><div style={{ color: 'rgba(255,255,255,0.4)' }}>Caricamento...</div></div>
  if (!data) return null

  const catLabel: Record<string, string> = { flowers: 'Flowers', hashish: 'Hashish', oils: 'Oli & Estratti', edibles: 'Edibles', accessories: 'Accessori', other: 'Altro' }
  const totalCatRev = Object.values(data.byCat as Record<string, number>).reduce((s, v) => s + v, 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ color: 'white', fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700 }}>Analytics Globale</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 4 }}>Metriche aggregate di tutti gli owner e negozi</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {(['7', '30', '90', '365'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{ padding: '6px 14px', borderRadius: 8, border: 'none', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)', background: period === p ? '#22C55E' : 'rgba(255,255,255,0.07)', color: period === p ? 'white' : 'rgba(255,255,255,0.5)' }}>
              {p === '365' ? 'Anno' : `${p} giorni`}
            </button>
          ))}
          <button style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 8, color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)' }}> Esporta</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Revenue Totale', value: fmt(data.totalRev), change: `${data.revGrowth >= 0 ? '' : ''} ${Math.abs(data.revGrowth).toFixed(1)}% vs periodo prec.`, up: data.revGrowth >= 0 },
          { label: 'Transazioni', value: data.totalTxn.toString(), change: `Tutti i negozi attivi` },
          { label: 'Scontrino Medio', value: fmt(data.avgSale), change: `su ${data.totalTxn} transazioni` },
          { label: 'Valore Stock', value: '', change: `${data.stores} negozi attivi` },
          { label: 'Dipendenti Attivi', value: data.employees.toString(), change: 'su tutti gli store' },
          { label: 'Spese Totali', value: fmt(data.totalExpenses), change: 'periodo selezionato' },
        ].map(k => (
          <div key={k.label} style={SA_CARD}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 26, fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'white', lineHeight: 1, marginBottom: 4 }}>{k.value}</div>
            <div style={{ fontSize: 12, color: k.up === false ? '#FCA5A5' : '#22C55E' }}>{k.change}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Top stores */}
        <div style={SA_CARD}>
          <h4 style={{ color: 'white', fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Top 5 Negozi per Revenue</h4>
          {data.topStores.length === 0 && <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>Nessun dato</p>}
          {data.topStores.map((s: any, i: number) => (
            <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 700, minWidth: 20 }}>{i + 1}</span>
                <div>
                  <div style={{ color: 'white', fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{s.txn} transazioni</div>
                </div>
              </div>
              <span style={{ color: '#22C55E', fontWeight: 700 }}>{fmt(s.revenue)}</span>
            </div>
          ))}
        </div>

        {/* By category */}
        <div style={SA_CARD}>
          <h4 style={{ color: 'white', fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Vendite per Categoria</h4>
          {Object.entries(data.byCat as Record<string, number>).sort((a, b) => b[1] - a[1]).map(([cat, rev]) => {
            const pct = totalCatRev > 0 ? (rev / totalCatRev * 100) : 0
            return (
              <div key={cat} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{catLabel[cat] ?? cat}</span>
                  <span style={{ color: 'white', fontWeight: 600, fontSize: 13 }}>{fmt(rev)} ({pct.toFixed(1)}%)</span>
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: '#22C55E', borderRadius: 2 }} />
                </div>
              </div>
            )
          })}
          {Object.keys(data.byCat).length === 0 && <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>Nessun dato per categoria</p>}
        </div>
      </div>

      {/* KPI Operativi */}
      <div style={SA_CARD}>
        <h4 style={{ color: 'white', fontWeight: 700, fontSize: 15, marginBottom: 16 }}>KPI Operativi Globali</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[
            { label: 'Varianza Cassa Media', value: fmt(data.ops.varianza), note: 'Nella norma', color: '#22C55E' },
            { label: 'Sconti Applicati', value: `${data.ops.scontiPct}%`, note: 'del totale vendite', color: '#F59E0B' },
            { label: 'Manutenzioni Completate', value: `${data.ops.maintenance}%`, note: 'Eccellente', color: '#22C55E' },
          ].map(k => (
            <div key={k.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>{k.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 4 }}>{k.value}</div>
              <span style={{ fontSize: 11, color: k.color }}>{k.note}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
