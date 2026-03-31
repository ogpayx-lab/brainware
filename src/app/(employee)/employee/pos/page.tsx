'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmt, calcCart, categoryLabel } from '@/lib/utils'
import type { Product, ProductCategory } from '@/types/database'

type Mode = 'negozio' | 'online' | 'trasferimento'

const CATEGORIES: ProductCategory[] = ['flowers','hashish','oils','edibles','accessories']

export default function POSPage() {
  const router = useRouter()
  const supabase = createClient()
  const searchParams = useSearchParams()
  const initialMode = (searchParams.get('mode') as Mode) || 'negozio'

  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<{product:Product;qty:number;line_total:number}[]>([])
  const [mode, setMode] = useState<Mode>(initialMode)
  const [activeCat, setActiveCat] = useState<ProductCategory|'all'>('all')
  const [search, setSearch] = useState('')
  const [discount, setDiscount] = useState({ type:'pct' as 'pct'|'fixed'|'promo', value:'', applied:false, promoCode:'' })
  const [customer, setCustomer] = useState({ name:'', nationality:'Italia', channel:'Walk-in', email:'' })
  const [showCash, setShowCash] = useState(false)
  const [showPOS, setShowPOS] = useState(false)
  const [cashReceived, setCashReceived] = useState('')
  const [posRef, setPosRef] = useState('')
  const [saving, setSaving] = useState(false)
  const [storeId, setStoreId] = useState<string|null>(null)
  const [shiftId, setShiftId] = useState<string|null>(null)
  const [userId, setUserId] = useState<string|null>(null)
  const [loading, setLoading] = useState(true)
  // Transfer mode
  const [destStore, setDestStore] = useState('')
  const [transferReason, setTransferReason] = useState('')
  const [stores, setStores] = useState<any[]>([])
  // Online mode
  const [shipping, setShipping] = useState({ type:'delivery' as 'delivery'|'long_distance', name:'', address:'', city:'', cap:'', phone:'', courier:'GLS', tracking:'', notes:'' })
  const [shippingCost, setShippingCost] = useState(5)

  useEffect(() => { loadData() }, [])
  useEffect(() => { setShippingCost(shipping.type==='delivery'?5:9.90) }, [shipping.type])

  async function loadData() {
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUserId(user.id)
    const { data: profile } = await supabase.from('users').select('store_id,stores(organization_id)').eq('id', user.id).single()
    if (!profile?.store_id) { router.push('/login'); return }
    setStoreId(profile.store_id)
    const { data: shift } = await supabase.from('shifts').select('id').eq('user_id', user.id).eq('status','open').single()
    if (!shift) { router.push('/employee/shift/open'); return }
    setShiftId(shift.id)
    const { data: prods } = await supabase.from('products').select('*').eq('store_id', profile.store_id).eq('is_active', true).order('name')
    setProducts(prods ?? [])
    const orgId = (profile.stores as any)?.organization_id
    if (orgId) {
      const { data: storeList } = await supabase.from('stores').select('id,name').eq('organization_id', orgId).neq('id', profile.store_id)
      setStores(storeList ?? [])
    }
    setLoading(false)
  }

  function addToCart(product: Product) {
    setCart(prev => {
      const ex = prev.find(i => i.product.id===product.id)
      if (ex) return prev.map(i => i.product.id===product.id ? {...i,qty:i.qty+1,line_total:(i.qty+1)*i.product.price} : i)
      return [...prev, { product, qty:1, line_total:product.price }]
    })
  }
  function updateQty(id: string, delta: number) {
    setCart(prev => prev.map(i => i.product.id===id ? {...i,qty:Math.max(0,i.qty+delta),line_total:Math.max(0,i.qty+delta)*i.product.price} : i).filter(i=>i.qty>0))
  }

  const discPct = discount.applied && discount.type==='pct' ? parseFloat(discount.value)||0 : 0
  const discFixed = discount.applied && discount.type==='fixed' ? parseFloat(discount.value)||0 : 0
  const { subtotal, discount: discAmt, total } = calcCart(cart, discPct)
  const finalTotal = mode==='online' ? total + shippingCost : total
  const cashNum = parseFloat(cashReceived)||0
  const change = Math.max(0, cashNum - total)

  async function completeSale(method: 'cash'|'pos'|'other') {
    if (!shiftId||!storeId||!userId||cart.length===0) return
    setSaving(true)
    const mvType = mode==='online' ? 'sale' : mode==='trasferimento' ? 'trasferimento' : 'sale'
    const { data: sale } = await supabase.from('sales').insert({
      shift_id:shiftId, store_id:storeId, user_id:userId,
      movement_type:mvType, payment_method:method,
      subtotal, discount_amount:discAmt, discount_pct:discPct,
      total:mode==='online'?finalTotal:total,
      cash_received:method==='cash'?cashNum:null, cash_change:method==='cash'?change:null,
      pos_reference:method==='pos'?posRef:null,
      customer_name:customer.name||null, customer_nationality:customer.nationality||null,
      acquisition_channel:customer.channel.toLowerCase().replace('-','') as any,
      customer_email:customer.email||null,
    }).select('id').single()
    if (sale) {
      await supabase.from('sale_items').insert(cart.map(i => ({ sale_id:sale.id, product_id:i.product.id, product_name:i.product.name, qty:i.qty, unit_price:i.product.price, line_total:i.line_total })))
      if (mode==='online') {
        await supabase.from('online_orders').insert({ sale_id:sale.id, store_id:storeId, user_id:userId, delivery_type:shipping.type, recipient_name:shipping.name, address:shipping.address, city:shipping.city, cap:shipping.cap, phone:shipping.phone, courier:shipping.courier, tracking_number:shipping.tracking||null, delivery_notes:shipping.notes||null, shipping_cost:shippingCost })
      }
    }
    setCart([]); setCustomer({name:'',nationality:'Italia',channel:'Walk-in',email:''}); setDiscount({type:'pct',value:'',applied:false,promoCode:''}); setCashReceived(''); setPosRef(''); setShowCash(false); setShowPOS(false); setSaving(false)
    loadData()
  }

  const filtered = products.filter(p => (activeCat==='all'||p.category===activeCat) && (!search||p.name.toLowerCase().includes(search.toLowerCase())))
  const popular = [...products].sort((a,b) => b.stock-a.stock).slice(0,3)

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>Caricamento...</div>

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-surface)', display:'flex', flexDirection:'column' }}>
      {/* Cash modal */}
      {showCash && (
        <div className="modal-overlay">
          <div className="modal">
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Pagamento</div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:8 }}>
                <div><div style={{ fontSize:12, color:'var(--text-secondary)' }}>Totale da pagare</div><div style={{ fontSize:28, fontFamily:'var(--font-heading)', fontWeight:700 }}>{fmt(total)}</div></div>
                <span className="badge badge-success">Contanti</span>
              </div>
            </div>
            <div className="input-group" style={{ marginBottom:12 }}>
              <label className="input-label">Importo ricevuto</label>
              <div className="input-with-prefix"><span className="input-prefix"></span><input className="input" type="number" placeholder="0.00" value={cashReceived} onChange={e => setCashReceived(e.target.value)} autoFocus /></div>
            </div>
            <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
              {[10,20,50,100,200].map(a => <button key={a} onClick={() => setCashReceived(a.toString())} className="btn btn-secondary" style={{ flex:1, minWidth:50, padding:'8px 4px', fontSize:13 }}>{a}</button>)}
              <button onClick={() => setCashReceived(total.toFixed(2))} className="btn btn-secondary" style={{ flex:1, minWidth:50, padding:'8px 4px', fontSize:13 }}>Esatto</button>
            </div>
            {cashReceived && (
              <div style={{ background:cashNum>=total?'var(--success-light)':'var(--danger-light)', borderRadius:8, padding:12, marginBottom:16, textAlign:'center', fontWeight:700, fontSize:18, color:cashNum>=total?'var(--brand-primary-dark)':'var(--danger)' }}>
                {cashNum>=total ? `Resto: ${fmt(change)}` : `Mancano: ${fmt(total-cashNum)}`}
              </div>
            )}
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-secondary" style={{ flex:1 }} onClick={() => setShowCash(false)}>Annulla</button>
              <button className="btn btn-primary" style={{ flex:2 }} disabled={cashNum<total||saving} onClick={() => completeSale('cash')}>Conferma Vendita</button>
            </div>
          </div>
        </div>
      )}
      {/* POS modal */}
      {showPOS && (
        <div className="modal-overlay">
          <div className="modal">
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Pagamento POS</div>
              <div style={{ fontSize:28, fontFamily:'var(--font-heading)', fontWeight:700, marginTop:8 }}>{fmt(total)}</div>
            </div>
            <div style={{ background:'var(--bg-surface)', borderRadius:8, padding:12, marginBottom:14, fontSize:14, color:'var(--text-secondary)' }}>Procedi con il pagamento tramite terminale POS</div>
            <div className="input-group" style={{ marginBottom:16 }}>
              <label className="input-label">Rif. Transazione: #{posRef||'TXN-2026-XXXX'}</label>
              <input className="input" placeholder="#TXN-..." value={posRef} onChange={e => setPosRef(e.target.value)} />
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-secondary" style={{ flex:1 }} onClick={() => setShowPOS(false)}>Annulla</button>
              <button className="btn btn-primary" style={{ flex:2 }} disabled={saving} onClick={() => completeSale('pos')}>Conferma Pagamento POS</button>
            </div>
          </div>
        </div>
      )}

      {/* Mode selector */}
      <div style={{ background:'var(--bg-primary)', borderBottom:'1px solid var(--border-subtle)', padding:'var(--space-sm) var(--space-lg)' }}>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <span style={{ fontSize:10, fontWeight:700, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'0.05em' }}>MODALIT DIPENDENTE</span>
          <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
            {(['negozio','online','trasferimento'] as Mode[]).map(m => (
              <button key={m} onClick={() => setMode(m)} style={{ padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:600, border:`1.5px solid ${mode===m?'var(--brand-primary)':'var(--border-default)'}`, background:mode===m?'var(--brand-primary-light)':'transparent', color:mode===m?'var(--brand-primary)':'var(--text-secondary)', cursor:'pointer' }}>
                {m==='negozio'?'Negozio':m==='online'?'Online':'Trasferimento'}
              </button>
            ))}
          </div>
          <button style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--text-primary)' }} onClick={() => router.push('/employee/dashboard')}></button>
        </div>
      </div>

      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        {/* Left: Catalog */}
        <div style={{ flex:1, overflowY:'auto', padding:'var(--space-lg)' }}>
          <div style={{ display:'flex', gap:8, marginBottom:'var(--space-md)' }}>
            <div style={{ flex:1, position:'relative' }}>
              <input className="input" placeholder="Cerca prodotto..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft:36 }} />
              <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:16 }}></span>
            </div>
            <button className="btn btn-secondary" style={{ fontSize:12 }}> Scan QR Code</button>
          </div>

          <div style={{ display:'flex', gap:6, overflowX:'auto', marginBottom:'var(--space-lg)', paddingBottom:4 }}>
            {(['all',...CATEGORIES] as (ProductCategory|'all')[]).map(c => (
              <button key={c} onClick={() => setActiveCat(c)} className={`badge ${activeCat===c?'badge-brand':'badge-gray'}`} style={{ cursor:'pointer', border:'none', padding:'6px 14px', whiteSpace:'nowrap' }}>
                {c==='all'?'Tutto':categoryLabel[c]}
              </button>
            ))}
          </div>

          {!search && activeCat==='all' && (
            <>
              <h4 style={{ marginBottom:'var(--space-md)', fontSize:13, color:'var(--text-secondary)' }}>Piu Venduti</h4>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'var(--space-md)', marginBottom:'var(--space-xl)' }}>
                {popular.map(p => (
                  <div key={p.id} className="card card-sm" style={{ cursor:'pointer' }} onClick={() => addToCart(p)}>
                    <div style={{ fontWeight:600, fontSize:13, marginBottom:2 }}>{p.name}</div>
                    <div style={{ fontSize:12, color:'var(--text-secondary)' }}>{fmt(p.price)}/{p.unit}</div>
                    <div style={{ fontSize:11, color:p.stock<=p.stock_alert?'var(--danger)':'var(--success)', marginTop:4, fontWeight:600 }}>Stock: {p.stock}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:'var(--space-md)' }}>
            {filtered.map(p => (
              <div key={p.id} className="card card-sm" style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <div>
                  <div style={{ fontWeight:600, fontSize:13 }}>{p.name}</div>
                  <div style={{ fontSize:12, color:'var(--text-secondary)' }}>{fmt(p.price)}/{p.unit}</div>
                  <span className={`badge badge-indigo`} style={{ fontSize:10, marginTop:4 }}>{categoryLabel[p.category]}</span>
                </div>
                <div style={{ fontSize:11, color:p.stock<=p.stock_alert?'var(--danger)':'var(--success)', fontWeight:600 }}>Stock: {p.stock}</div>
                <button className="btn btn-primary" style={{ padding:8, fontSize:12 }} disabled={p.stock===0} onClick={() => addToCart(p)}>
                  {p.stock===0?'Esaurito':'+ Aggiungi'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Cart */}
        {cart.length > 0 && (
          <div style={{ width:360, borderLeft:'1px solid var(--border-subtle)', background:'var(--bg-primary)', display:'flex', flexDirection:'column', overflowY:'auto' }}>
            <div style={{ padding:'12px var(--space-lg) 8px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h4>{mode==='trasferimento'?'Prodotti da Trasferire':'Carrello'} ({cart.reduce((s,i)=>s+i.qty,0)})</h4>
              <button onClick={() => setCart([])} style={{ background:'none', border:'none', color:'var(--danger)', fontSize:12, cursor:'pointer' }}>Svuota</button>
            </div>
            {mode==='trasferimento' && <div style={{ margin:'0 var(--space-lg) 8px', fontSize:12, color:'var(--text-secondary)', background:'var(--bg-surface)', borderRadius:8, padding:8 }}>Movimento inventario  non conteggiato come vendita</div>}
            <div style={{ flex:1, overflowY:'auto', padding:'0 var(--space-lg)' }}>
              {cart.map(item => (
                <div key={item.product.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 0', borderBottom:'1px solid var(--border-subtle)' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600 }}>{item.product.name}</div>
                    <div style={{ fontSize:12, color:'var(--text-secondary)' }}>{fmt(item.product.price)}/{item.product.unit}  {item.qty}</div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <button onClick={() => updateQty(item.product.id,-1)} className="btn btn-secondary" style={{ width:26,height:26,padding:0 }}></button>
                    <span style={{ fontWeight:700, minWidth:20, textAlign:'center' }}>{item.qty}</span>
                    <button onClick={() => updateQty(item.product.id,1)} className="btn btn-secondary" style={{ width:26,height:26,padding:0 }}>+</button>
                  </div>
                  <span style={{ fontWeight:700, fontSize:13, minWidth:52, textAlign:'right' }}>{fmt(item.line_total)}</span>
                </div>
              ))}

              {/* Sconto */}
              {mode!=='trasferimento' && (
                <div style={{ marginTop:12, padding:12, background:'var(--bg-surface)', borderRadius:10 }}>
                  <div style={{ fontSize:12, fontWeight:600, marginBottom:8 }}>Sconto & Promozioni</div>
                  <div style={{ display:'flex', gap:6, marginBottom:8 }}>
                    {(['pct','fixed','promo'] as const).map(t => (
                      <button key={t} onClick={() => setDiscount(d=>({...d,type:t}))} style={{ flex:1, padding:'5px', borderRadius:6, fontSize:11, border:`1px solid ${discount.type===t?'var(--brand-primary)':'var(--border-default)'}`, background:discount.type===t?'var(--brand-primary-light)':'transparent', color:discount.type===t?'var(--brand-primary)':'var(--text-secondary)', cursor:'pointer' }}>
                        {t==='pct'?'% Perc.':t==='fixed'?' Fisso':'Promo'}
                      </button>
                    ))}
                  </div>
                  {discount.type!=='promo' ? (
                    <div style={{ display:'flex', gap:8 }}>
                      <input className="input" type="number" min="0" placeholder={discount.type==='pct'?'10':'5.00'} value={discount.value} onChange={e => setDiscount(d=>({...d,value:e.target.value}))} style={{ flex:1, height:34, fontSize:13 }} />
                      <button onClick={() => setDiscount(d=>({...d,applied:!d.applied}))} className={`btn ${discount.applied?'btn-danger':'btn-secondary'}`} style={{ padding:'0 12px', fontSize:12 }}>{discount.applied?'Rimuovi':'Applica'}</button>
                    </div>
                  ) : (
                    <div style={{ display:'flex', gap:8 }}>
                      <input className="input" placeholder="Codice promo..." value={discount.promoCode} onChange={e => setDiscount(d=>({...d,promoCode:e.target.value}))} style={{ flex:1, height:34, fontSize:13 }} />
                      <button className="btn btn-secondary" style={{ padding:'0 12px', fontSize:12 }}>Verifica</button>
                    </div>
                  )}
                  {discount.applied && discount.value && <div style={{ fontSize:12, color:'var(--danger)', marginTop:4 }}>Sconto {discount.type==='pct'?`${discount.value}%`:`${discount.value}`} applicato: {fmt(discAmt)}</div>}
                </div>
              )}

              {/* Dati cliente / spedizione */}
              {mode==='negozio' && (
                <div style={{ marginTop:12 }}>
                  <div style={{ fontSize:12, fontWeight:600, marginBottom:8 }}>Dati Cliente</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    <input className="input" placeholder="Nome cliente" value={customer.name} onChange={e => setCustomer(c=>({...c,name:e.target.value}))} style={{ height:34, fontSize:13 }} />
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                      <select className="input" value={customer.nationality} onChange={e => setCustomer(c=>({...c,nationality:e.target.value}))} style={{ height:34, fontSize:12 }}>
                        {['Italia','Germania','Francia','UK','USA','Spagna','Altra'].map(n => <option key={n}>{n}</option>)}
                      </select>
                      <select className="input" value={customer.channel} onChange={e => setCustomer(c=>({...c,channel:e.target.value}))} style={{ height:34, fontSize:12 }}>
                        {['Walk-in','Social','Google','Referral','Altro'].map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <input className="input" type="email" placeholder="Email (opzionale)" value={customer.email} onChange={e => setCustomer(c=>({...c,email:e.target.value}))} style={{ height:34, fontSize:13 }} />
                  </div>
                </div>
              )}
              {mode==='online' && (
                <div style={{ marginTop:12 }}>
                  <div style={{ fontSize:12, fontWeight:600, marginBottom:8 }}>Tipo Spedizione</div>
                  <div className="toggle-group" style={{ marginBottom:10 }}>
                    <button className={`toggle-option ${shipping.type==='delivery'?'active':''}`} onClick={() => setShipping(s=>({...s,type:'delivery'}))}>Delivery (+5.00)</button>
                    <button className={`toggle-option ${shipping.type==='long_distance'?'active':''}`} onClick={() => setShipping(s=>({...s,type:'long_distance'}))}>Long Distance (+9.90)</button>
                  </div>
                  <div style={{ fontSize:11, color:'var(--text-tertiary)', marginBottom:8 }}>Consegna in prossimita del negozio</div>
                  {[{label:'Nome destinatario',key:'name',ph:'Mario Rossi'},{label:'Indirizzo spedizione',key:'address',ph:'Via Roma 42'},{label:'Corriere',key:'courier',ph:'GLS'},{label:'Tracking / Note',key:'tracking',ph:'#TXN...'},{label:'Citta',key:'city',ph:'Milano'},{label:'CAP',key:'cap',ph:'20100'},{label:'Telefono',key:'phone',ph:'+39 333...'}].map(f => (
                    <input key={f.key} className="input" placeholder={`${f.label}`} value={(shipping as any)[f.key]} onChange={e => setShipping(s=>({...s,[f.key]:e.target.value}))} style={{ height:34, fontSize:12, marginBottom:6 }} />
                  ))}
                </div>
              )}
              {mode==='trasferimento' && (
                <div style={{ marginTop:12 }}>
                  <div style={{ fontSize:12, fontWeight:600, marginBottom:8 }}>Destinazione Trasferimento</div>
                  <select className="input" value={destStore} onChange={e => setDestStore(e.target.value)} style={{ marginBottom:6 }}>
                    <option value="">Seleziona negozio...</option>
                    {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <input className="input" placeholder="Motivo trasferimento" value={transferReason} onChange={e => setTransferReason(e.target.value)} style={{ height:34, fontSize:12, marginBottom:6 }} />
                  <input className="input" placeholder="Note (opzionale)" style={{ height:34, fontSize:12 }} />
                </div>
              )}
            </div>

            {/* Totale + bottoni */}
            <div style={{ padding:'var(--space-md) var(--space-lg)', borderTop:'1px solid var(--border-subtle)', background:'var(--bg-surface)' }}>
              {mode!=='trasferimento' ? (
                <>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:13, color:'var(--text-secondary)' }}>Subtotale</span><span style={{ fontSize:13 }}>{fmt(subtotal)}</span>
                  </div>
                  {discount.applied && discAmt > 0 && <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:13, color:'var(--text-secondary)' }}>Sconto ({discount.type==='pct'?`${discount.value}%`:`${discount.value}`})</span>
                    <span style={{ fontSize:13, color:'var(--danger)' }}>{fmt(discAmt)}</span>
                  </div>}
                  {mode==='online' && <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:13, color:'var(--text-secondary)' }}>Spedizione</span><span style={{ fontSize:13 }}>+{fmt(shippingCost)}</span>
                  </div>}
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
                    <span style={{ fontWeight:700, fontSize:16 }}>Totale</span>
                    <span style={{ fontFamily:'var(--font-heading)', fontWeight:700, fontSize:22 }}>{fmt(finalTotal)}</span>
                  </div>
                  {mode==='negozio' ? (
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                      <button className="btn btn-primary btn-lg" onClick={() => setShowCash(true)} disabled={saving} style={{ background:'var(--success)' }}> CONTANTI</button>
                      <button className="btn btn-primary btn-lg" onClick={() => setShowPOS(true)} disabled={saving} style={{ background:'var(--accent-blue)' }}> POS</button>
                    </div>
                  ) : (
                    <button className="btn btn-primary btn-full btn-lg" disabled={saving||!shipping.name} onClick={() => completeSale('other')}>
                      {saving?'Conferma...':' CONFERMA ORDINE ONLINE'}
                    </button>
                  )}
                </>
              ) : (
                <>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:13, color:'var(--text-secondary)' }}>Totale Prodotti</span><span style={{ fontSize:13 }}>{cart.reduce((s,i)=>s+i.qty,0)} articoli</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
                    <span style={{ fontSize:13, color:'var(--text-secondary)' }}>Mov. Inventario</span><span style={{ fontSize:13 }}>{cart.length} prodotti</span>
                  </div>
                  <button className="btn btn-primary btn-full btn-lg" disabled={saving||!destStore} onClick={() => completeSale('other')}>
                    {saving?'Conferma...':'CONFERMA TRASFERIMENTO'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
