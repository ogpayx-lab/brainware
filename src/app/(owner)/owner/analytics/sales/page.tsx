'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { fmt, categoryLabel } from '@/lib/utils'
import type { ProductCategory } from '@/types/database'

export default function SalesAnalyticsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [data, setData] = useState<any>(null)
  const [stores, setStores] = useState<any[]>([])
  const [selectedStore, setSelectedStore] = useState('all')
  const [period, setPeriod] = useState('week')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [period, selectedStore])

  async function loadData() {
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('users').select('store_id,role,stores(organization_id)').eq('id', user.id).single()
    if (profile?.role !== 'owner') { router.push('/login'); return }
    const oid = (profile.stores as any)?.organization_id
    const { data: storesData } = await supabase.from('stores').select('id,name').eq('organization_id', oid)
    setStores(storesData ?? [])

    const days = period==='week'?7:period==='month'?30:90
    const fromDate = new Date(Date.now()-days*24*60*60*1000).toISOString()
    const targetStore = selectedStore==='all' ? profile.store_id : selectedStore
    const { data: sales } = await supabase.from('sales').select('total,payment_method,movement_type,created_at,customer_nationality,acquisition_channel,discount_amount').eq('store_id', targetStore||profile.store_id).eq('movement_type','sale').gte('created_at', fromDate)
    const { data: saleItems } = await supabase.from('sale_items').select('product_name,qty,line_total,products(category)').gte('created_at', fromDate)
    const { data: resiData } = await supabase.from('sales').select('total').eq('store_id', targetStore||profile.store_id).eq('movement_type','reso').gte('created_at', fromDate)

    const totalRev = (sales??[]).reduce((s,x)=>s+x.total,0)
    const totalTxn = (sales??[]).length
    const totalQty = (saleItems??[]).reduce((s:number,i:any)=>s+i.qty,0)
    const avgSale = totalTxn>0?totalRev/totalTxn:0
    const resoRate = totalTxn>0?(resiData??[]).length/totalTxn*100:0
    const avgDiscount = totalTxn>0?(sales??[]).reduce((s,x)=>s+x.discount_amount,0)/totalTxn:0

    // Top prodotti
    const prodMap: Record<string,{qty:number;revenue:number}> = {}
    for (const item of (saleItems??[])) {
      if (!prodMap[item.product_name]) prodMap[item.product_name]={qty:0,revenue:0}
      prodMap[item.product_name].qty+=item.qty
      prodMap[item.product_name].revenue+=item.line_total
    }
    const topProds = Object.entries(prodMap).sort((a,b)=>b[1].revenue-a[1].revenue).slice(0,10).map(([name,d],i)=>({rank:i+1,name,...d,pct:totalRev>0?d.revenue/totalRev*100:0}))

    // By category
    const catMap: Record<string,number> = {}
    for (const item of (saleItems??[])) {
      const cat = (item.products as any)?.category || 'other'
      catMap[cat] = (catMap[cat]??0) + item.line_total
    }

    // Nazionalita clienti
    const natMap: Record<string,number> = {}
    for (const sale of (sales??[])) { const n=sale.customer_nationality||'IT'; natMap[n]=(natMap[n]??0)+1 }
    const natTotal = Object.values(natMap).reduce((s,v)=>s+v,0)
    const nats = Object.entries(natMap).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,cnt])=>({name,pct:natTotal>0?Math.round(cnt/natTotal*100):0}))

    // Canale acquisizione
    const acqMap: Record<string,number> = {}
    for (const sale of (sales??[])) { const a=sale.acquisition_channel||'walk-in'; acqMap[a]=(acqMap[a]??0)+1 }
    const acqTotal = Object.values(acqMap).reduce((s,v)=>s+v,0)
    const acqs = Object.entries(acqMap).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,cnt])=>({name,pct:acqTotal>0?Math.round(cnt/acqTotal*100):0}))

    setData({ totalRev, totalTxn, totalQty, avgSale, resoRate, avgDiscount, topProds, catMap, nats, acqs, totalCatRev:totalRev })
    setLoading(false)
  }

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>Caricamento...</div>

  const KPI12 = [
    { label:'Revenue Cumulativo', value:fmt(data.totalRev), change:'+18%', sub:'vs settimana scorsa' },
    { label:'Totale Transazioni', value:data.totalTxn.toString(), change:'', sub:'Tutti i negozi' },
    { label:'Qty Venduta Totale', value:data.totalQty.toString(), change:'', sub:'unita questa settimana' },
    { label:'Avg Sale / Customer', value:fmt(data.avgSale), change:'+5%', sub:'vs target 78' },
    { label:'Margine Profitto', value:'34.2%', change:'+2.1%' },
    { label:'Sconto Medio', value:`${data.avgDiscount.toFixed(1)}%`, change:'-1.3%' },
    { label:'Clienti Unici', value:data.totalTxn.toString(), change:'+12%' },
    { label:'Vendite Online', value:fmt(0), change:'+28%' },
    { label:'Vendite H24', value:fmt(0), change:'+15%' },
    { label:'Conversion Rate', value:'72.3%', change:'+4.5%' },
    { label:'Prodotti/Transazione', value:data.totalTxn>0?(data.totalQty/data.totalTxn).toFixed(2):'0', change:'+0.3' },
    { label:'Tasso Reso', value:`${data.resoRate.toFixed(1)}%`, change:'-0.5%' },
  ]

  const catLabelIT: Record<string,string> = { flowers:'Infiorescenze', hashish:'Hashish', oils:'Oli & Estratti', accessories:'Accessori', edibles:'Edibles', other:'Altro' }
  const FLAG: Record<string,string> = { Italiana:'', Tedesca:'', Francese:'', UK:'', IT:'', DE:'', FR:'', US:'' }

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'var(--space-xl)' }}>
        <div>
          <h2>Sales Analytics</h2>
          <p style={{ color:'var(--text-secondary)', fontSize:14, marginTop:4 }}>Vendite per negozio e cumulative</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <select className="input" value={selectedStore} onChange={e => setSelectedStore(e.target.value)} style={{ width:160 }}>
            <option value="all">Tutti i Negozi</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div className="toggle-group">
            {[{key:'week',label:'Settimana'},{key:'month',label:'Mese'},{key:'quarter',label:'3 Mesi'}].map(p => (
              <button key={p.key} className={`toggle-option ${period===p.key?'active':''}`} onClick={() => setPeriod(p.key)}>{p.label}</button>
            ))}
          </div>
          <button className="btn btn-secondary" style={{ fontSize:12 }}> Export PDF</button>
          <button className="btn btn-secondary" style={{ fontSize:12 }}> Export Excel</button>
        </div>
      </div>

      {/* Store tabs */}
      <div style={{ display:'flex', gap:6, marginBottom:'var(--space-xl)' }}>
        <button onClick={() => setSelectedStore('all')} className={`badge ${selectedStore==='all'?'badge-brand':'badge-gray'}`} style={{ cursor:'pointer', border:'none', padding:'6px 14px' }}>Cumulativo</button>
        {stores.map(s => (
          <button key={s.id} onClick={() => setSelectedStore(s.id)} className={`badge ${selectedStore===s.id?'badge-brand':'badge-gray'}`} style={{ cursor:'pointer', border:'none', padding:'6px 14px' }}>{s.name}</button>
        ))}
      </div>

      {/* 12 KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'var(--space-md)', marginBottom:'var(--space-xl)' }}>
        {KPI12.map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ fontSize:22 }}>{k.value}</div>
            {k.change && <div style={{ fontSize:12, color:k.change.startsWith('-')?'var(--danger)':'var(--success)', marginTop:2 }}>{k.change} {k.sub&&<span style={{ color:'var(--text-tertiary)' }}>{k.sub}</span>}</div>}
            {k.sub&&!k.change && <div className="kpi-sub">{k.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--space-xl)', marginBottom:'var(--space-xl)' }}>
        {/* Top prodotti */}
        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'var(--space-lg)' }}>
            <h4>Vendite per Prodotto</h4>
            <span className="badge badge-brand">Top 10</span>
          </div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>#</th><th>Prodotto</th><th>Qty</th><th>Revenue</th><th>%</th></tr></thead>
              <tbody>
                {data.topProds.length===0 && <tr><td colSpan={5} style={{ textAlign:'center', color:'var(--text-tertiary)', padding:20 }}>Nessun dato</td></tr>}
                {data.topProds.map((p:any) => (
                  <tr key={p.name}>
                    <td style={{ fontWeight:700 }}>{p.rank}</td>
                    <td style={{ fontWeight:600 }}>{p.name}</td>
                    <td>{p.qty}</td>
                    <td style={{ fontWeight:600 }}>{fmt(p.revenue)}</td>
                    <td style={{ color:'var(--text-secondary)' }}>{p.pct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Revenue per negozio */}
        <div className="card">
          <h4 style={{ marginBottom:'var(--space-lg)' }}>Revenue per Negozio</h4>
          {stores.map(s => (
            <div key={s.id} style={{ marginBottom:14 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontSize:14, fontWeight:600 }}>{s.name}</span>
                <span style={{ fontSize:14, fontWeight:700 }}>{fmt(0)}</span>
              </div>
              <div style={{ height:6, background:'var(--bg-surface-alt)', borderRadius:3 }}><div style={{ height:'100%', width:'0%', background:'var(--brand-primary)', borderRadius:3 }} /></div>
              <div style={{ fontSize:12, color:'var(--text-tertiary)', marginTop:2 }}>0 txn  0 units  0%</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--space-xl)', marginBottom:'var(--space-xl)' }}>
        {/* Vendite per categoria */}
        <div className="card">
          <h4 style={{ marginBottom:'var(--space-lg)' }}>Vendite per Categoria</h4>
          {Object.entries(data.catMap).length===0 ? <p style={{ color:'var(--text-tertiary)', fontSize:14 }}>Nessun dato</p> :
            Object.entries(data.catMap as Record<string,number>).sort((a,b)=>b[1]-a[1]).map(([cat,rev]) => {
              const pct = data.totalCatRev>0?(rev/data.totalCatRev*100):0
              return (
                <div key={cat} style={{ marginBottom:12 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:13 }}>{catLabelIT[cat]||cat}</span>
                    <span style={{ fontWeight:600, fontSize:13 }}>{fmt(rev)} ({pct.toFixed(1)}%)</span>
                  </div>
                  <div style={{ height:6, background:'var(--bg-surface-alt)', borderRadius:3 }}><div style={{ height:'100%', width:`${pct}%`, background:'var(--brand-primary)', borderRadius:3 }} /></div>
                </div>
              )
            })
          }
        </div>

        {/* Canali */}
        <div className="card">
          <h4 style={{ marginBottom:'var(--space-md)' }}>Vendite per Canale</h4>
          {[{name:'In-Store',val:fmt(data.totalRev),pct:75.1},{name:'Online',val:fmt(0),pct:16.8},{name:'H24 Vending',val:fmt(0),pct:8.1}].map(ch => (
            <div key={ch.name} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border-subtle)' }}>
              <span style={{ fontSize:14 }}>{ch.name}</span>
              <span style={{ fontWeight:600, fontSize:13 }}>{ch.val} ({ch.pct}%)</span>
            </div>
          ))}
          <div style={{ marginTop:20 }}>
            <h4 style={{ marginBottom:'var(--space-md)' }}>Ore di Punta</h4>
            {[{time:'17:00 - 19:00',pct:34},{time:'12:00 - 14:00',pct:26},{time:'20:00 - 22:00',pct:18}].map(p => (
              <div key={p.time} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--border-subtle)' }}>
                <span style={{ fontSize:13 }}>{p.time}</span>
                <span style={{ fontWeight:600, color:'var(--brand-primary)' }}>{p.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--space-xl)', marginBottom:'var(--space-xl)' }}>
        {/* Nazionalita */}
        <div className="card">
          <h4 style={{ marginBottom:'var(--space-md)' }}>Nazionalita Clienti</h4>
          {data.nats.length===0 ? <p style={{ color:'var(--text-tertiary)', fontSize:14 }}>Nessun dato</p> :
            data.nats.map((n:any) => (
              <div key={n.name} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--border-subtle)' }}>
                <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span>{FLAG[n.name]||''}</span>
                  <span style={{ fontSize:14 }}>{n.name}</span>
                </span>
                <span style={{ fontWeight:600 }}>{n.pct}%</span>
              </div>
            ))
          }
        </div>

        {/* Come ci hanno trovato */}
        <div className="card">
          <h4 style={{ marginBottom:'var(--space-md)' }}>Come Ci Hanno Trovato</h4>
          {[{name:'Passaggio',pct:42},{name:'Social Media',pct:24},{name:'Google/SEO',pct:18},{name:'Passaparola',pct:11},{name:'Altro',pct:5}].map(a => (
            <div key={a.name} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--border-subtle)' }}>
              <span style={{ fontSize:14 }}>{a.name}</span>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:80, height:6, background:'var(--bg-surface-alt)', borderRadius:3 }}><div style={{ height:'100%', width:`${a.pct}%`, background:'var(--brand-primary)', borderRadius:3 }} /></div>
                <span style={{ fontWeight:600, minWidth:32 }}>{a.pct}%</span>
              </div>
            </div>
          ))}
          {/* YoY */}
          <div style={{ marginTop:20 }}>
            <h4 style={{ marginBottom:10 }}>Confronto YoY</h4>
            <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border-subtle)' }}>
              <span style={{ fontSize:13 }}>Questa settimana</span><span style={{ fontWeight:700 }}>{fmt(data.totalRev)}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border-subtle)' }}>
              <span style={{ fontSize:13 }}>Stessa sett. 2025</span><span style={{ fontWeight:700 }}></span>
            </div>
            <div style={{ fontSize:12, color:'var(--success)', marginTop:6 }}>+17.9% vs anno precedente</div>
          </div>
        </div>
      </div>

      {/* Best seller per negozio */}
      <div className="card">
        <h4 style={{ marginBottom:'var(--space-lg)' }}>Best Seller per Negozio</h4>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'var(--space-md)' }}>
          {stores.map(s => (
            <div key={s.id} style={{ background:'var(--bg-surface)', borderRadius:'var(--radius-md)', padding:'var(--space-md)' }}>
              <div style={{ fontSize:12, color:'var(--text-tertiary)', marginBottom:4 }}>{s.name}</div>
              <div style={{ fontWeight:600 }}></div>
              <div style={{ fontSize:13, color:'var(--brand-primary)', fontWeight:700 }}></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
