
import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmt, calcCart, categoryLabel } from '@/lib/utils'
import type { Product, ProductCategory } from '@/types/database'
import { BottomNav } from '@/components/employee/BottomNav'

type Mode = 'negozio' | 'online' | 'trasferimento' | 'autoconsumo'
const CATEGORIES: ProductCategory[] = ['flowers', 'hashish', 'oils', 'edibles', 'accessories', 'cosmetics', 'clothes', 'seeds', 'vape', 'food']

interface RecentSale {
  id: string
  created_at: string
  total: number
  payment_method: string
  customer_name: string | null
  sale_items: { product_name: string; qty: number; line_total: number }[]
}

export default function POSContent() {
  const router = useRouter()
  const supabase = createClient()
  const searchParams = useSearchParams()
  const initialMode = (searchParams.get('mode') as Mode) || 'negozio'

  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<{ product: Product; qty: number; line_total: number }[]>([])
  const [mode, setMode] = useState<Mode>(initialMode)
  const [activeCat, setActiveCat] = useState<ProductCategory | 'all'>('all')
  const [search, setSearch] = useState('')
  const [discount, setDiscount] = useState({ type: 'pct' as 'pct' | 'fixed' | 'promo', value: '', applied: false, promoCode: '', promoId: '', promoDiscount: 0 })
  const [customer, setCustomer] = useState({ name: '', nationality: 'Italia', channel: 'Walk-in', email: '', notes: '' })
  const [natSearch, setNatSearch] = useState(false)
  const [showCash, setShowCash] = useState(false)
  const [showPOS, setShowPOS] = useState(false)
  const [showSplit, setShowSplit] = useState(false)
  const [splitCash, setSplitCash] = useState('')
  const [cashReceived, setCashReceived] = useState('')
  const [posRef, setPosRef] = useState('')
  const [saving, setSaving] = useState(false)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [shiftId, setShiftId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [destStore, setDestStore] = useState('')
  const [transferReason, setTransferReason] = useState('')
  const [autoconsumoNotes, setAutoconsumoNotes] = useState('')
  const [stores, setStores] = useState<any[]>([])
  const [shipping, setShipping] = useState({ type: 'delivery' as 'delivery' | 'long_distance', name: '', address: '', city: '', cap: '', phone: '', courier: 'GLS', tracking: '', notes: '' })
  const [shippingCost, setShippingCost] = useState(5)
  const [deliverySteps, setDeliverySteps] = useState([false, false, false, false, false])
  const [customerError, setCustomerError] = useState('')
  // Last sale & history
  const [lastSale, setLastSale] = useState<RecentSale | null>(null)
  const [recentSales, setRecentSales] = useState<RecentSale[]>([])
  const [showHistory, setShowHistory] = useState(false)
  // QR Scanner
  const [showQR, setShowQR] = useState(false)
  const [qrError, setQrError] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  // Promo codes
  const [promoError, setPromoError] = useState('')
  const [promoList, setPromoList] = useState<any[]>([])
  // Mobile cart
  const [mobileCartOpen, setMobileCartOpen] = useState(false)
  // Referente vendita
  const [storeEmployees, setStoreEmployees] = useState<{ id: string; full_name: string }[]>([])
  const [referente, setReferente] = useState<string>('')
  const [checkedInIds, setCheckedInIds] = useState<Set<string>>(new Set())
  // Storno vendita
  const [stornoId, setStornoId] = useState<string | null>(null)
  const [showStornoConfirm, setShowStornoConfirm] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])
  useEffect(() => { setShippingCost(shipping.type === 'delivery' ? 5 : 9.90) }, [shipping.type])

  async function loadData() {
    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
    if (!user) { router.push('/login'); return }
    setUserId(user.id)
    const { data: profile } = await supabase.from('users').select('store_id,stores(organization_id)').eq('id', user.id).single()
    if (!profile?.store_id) { router.push('/login'); return }
    setStoreId(profile.store_id)
    const { data: shift } = await supabase.from('shifts').select('id').eq('store_id', profile.store_id).eq('status', 'open').order('created_at', { ascending: false }).limit(1).single()
    if (!shift) { router.push('/employee/shift/open'); return }
    setShiftId(shift.id)
    const { data: prods } = await supabase.from('products').select('*').eq('store_id', profile.store_id).eq('is_active', true).order('name')
    setProducts(prods ?? [])
    const orgId = (profile.stores as any)?.organization_id
    if (orgId) {
      const { data: storeList } = await supabase.from('stores').select('id,name').eq('organization_id', orgId).neq('id', profile.store_id)
      setStores(storeList ?? [])
    }
    // Load all employees of this store (for referente selector)
    const { data: emps } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('store_id', profile.store_id)
      .in('role', ['employee', 'manager'])
      .eq('is_active', true)
      .order('full_name')
    setStoreEmployees(emps ?? [])
    // Default referente: active employee from localStorage (store account model)
    const activeEmpId = typeof window !== 'undefined' ? localStorage.getItem('activeEmployeeId') : null
    setReferente(activeEmpId || user.id)

    // Load who is checked-in to this shift
    const { data: checkins } = await supabase
      .from('shift_checkins')
      .select('user_id')
      .eq('shift_id', shift.id)
      .is('checked_out_at', null)
    setCheckedInIds(new Set((checkins || []).map((c: any) => c.user_id)))
    // Carica ultime vendite del turno
    const { data: salesData } = await supabase
      .from('sales')
      .select('id,created_at,total,payment_method,customer_name,sale_items(product_name,qty,line_total)')
      .eq('shift_id', shift.id)
      .eq('movement_type', 'sale')
      .order('created_at', { ascending: false })
      .limit(10)
    setRecentSales(salesData ?? [])
    if (salesData && salesData.length > 0) setLastSale(salesData[0])
    // Load active promo codes
    const { data: promos } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('store_id', profile.store_id)
      .eq('is_active', true)
      .order('code')
    setPromoList((promos ?? []).filter(p => !p.expires_at || new Date(p.expires_at) >= new Date()))
    setLoading(false)
  }

  function addToCart(product: Product) {
    setCart(prev => {
      const ex = prev.find(i => i.product.id === product.id)
      if (ex) return prev.map(i => i.product.id === product.id ? { ...i, qty: i.qty + 1, line_total: (i.qty + 1) * i.product.price } : i)
      return [...prev, { product, qty: 1, line_total: product.price }]
    })
  }
  function updateQty(id: string, delta: number) {
    setCart(prev => prev.map(i => i.product.id === id ? { ...i, qty: Math.max(0, i.qty + delta), line_total: Math.max(0, i.qty + delta) * i.product.price } : i).filter(i => i.qty > 0))
  }

  // ---- Discount calculation ----
  const discPct = discount.applied && discount.type === 'pct' ? parseFloat(discount.value) || 0 : 0
  const discFixed = discount.applied && discount.type === 'fixed' ? parseFloat(discount.value) || 0 : 0
  const discPromo = discount.applied && discount.type === 'promo' ? discount.promoDiscount : 0
  const { subtotal, discount: discAmt, total } = calcCart(cart, discPct, discFixed + discPromo)
  const finalTotal = mode === 'online' ? total + shippingCost : total
  const cashNum = parseFloat(cashReceived) || 0
  const change = Math.max(0, cashNum - total)

  // ---- Promo code verification ----
  function applyPromo(promoId: string) {
    if (!promoId) {
      setDiscount(d => ({ ...d, applied: false, promoId: '', promoDiscount: 0 }))
      return
    }
    const promo = promoList.find(p => p.id === promoId)
    if (!promo) return
    const promoAmt = promo.type === 'pct' ? subtotal * (promo.value / 100) : promo.value
    setDiscount(d => ({ ...d, type: 'promo', applied: true, promoId: promo.id, promoCode: promo.code, promoDiscount: promoAmt }))
  }

  // ---- QR Scanner ----
  async function startQR() {
    setQrError('')
    setShowQR(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
        scanQRLoop()
      }
    } catch (e: any) {
      setQrError('Impossibile accedere alla fotocamera: ' + (e.message || 'permesso negato'))
    }
  }
  function stopQR() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setShowQR(false)
  }
  function scanQRLoop() {
    if (!videoRef.current || !streamRef.current) return
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const check = () => {
      if (!videoRef.current || !streamRef.current) return
      canvas.width = videoRef.current.videoWidth
      canvas.height = videoRef.current.videoHeight
      ctx?.drawImage(videoRef.current, 0, 0)
      // Try to use BarcodeDetector if available
      if ('BarcodeDetector' in window) {
        const bd = new (window as any).BarcodeDetector({ formats: ['qr_code', 'ean_13', 'ean_8', 'code_128'] })
        bd.detect(canvas).then((barcodes: any[]) => {
          if (barcodes.length > 0) {
            const code = barcodes[0].rawValue
            stopQR()
            // Cerca prodotto per codice
            const prod = products.find(p => p.barcode === code || p.name.toLowerCase() === code.toLowerCase())
            if (prod) addToCart(prod)
            else setSearch(code)
          } else {
            requestAnimationFrame(check)
          }
        }).catch(() => requestAnimationFrame(check))
      } else {
        requestAnimationFrame(check)
      }
    }
    requestAnimationFrame(check)
  }

  // ---- Customer validation ----
  function validateCustomer(): boolean {
    if (mode === 'negozio' && !customer.name.trim()) {
      setCustomerError('Il nome del cliente è obbligatorio')
      return false
    }
    setCustomerError('')
    return true
  }

  // ---- Complete sale ----
  async function completeSale(method: 'cash' | 'pos' | 'other') {
    if (!validateCustomer()) return
    if (!shiftId || !storeId || !userId || cart.length === 0) return
    setSaving(true)

    // Map canale acquisizione al valore corretto dell'enum
    const channelMap: Record<string, string> = {
      'walk-in': 'walk-in', 'walkin': 'walk-in',
      'regular-customer': 'walk-in',
      'tourist-back': 'walk-in',
      'social': 'social', 'google': 'google',
      'ai/chatgpt/gemini-etc..': 'other',
      'friends': 'referral',
      'referral': 'referral', 'other': 'other',
    }
    const rawChannel = customer.channel.toLowerCase().replace(/\s+/g, '-')
    const channel = channelMap[rawChannel] || 'walk-in'

    const mvType = mode === 'trasferimento' ? 'trasferimento' : mode === 'autoconsumo' ? 'autoconsumo' : 'sale'
    const saleUserId = referente || userId
    const autoconsumoTotal = mode === 'autoconsumo' ? 0 : (mode === 'online' ? finalTotal : total)
    const { data: sale, error: saleError } = await supabase.from('sales').insert({
      shift_id: shiftId, store_id: storeId, user_id: saleUserId, created_by: saleUserId,
      movement_type: mvType, payment_method: mode === 'autoconsumo' ? 'other' : method,
      subtotal: mode === 'autoconsumo' ? 0 : subtotal, discount_amount: mode === 'autoconsumo' ? 0 : discAmt, discount_pct: mode === 'autoconsumo' ? 0 : discPct,
      total: autoconsumoTotal,
      cash_received: null, cash_change: null,
      split_cash_amount: method === 'split' ? parseFloat(splitCash) || 0 : null,
      pos_reference: (method === 'pos' || method === 'split') ? posRef : null,
      customer_name: customer.name || null, customer_nationality: customer.nationality || null,
      acquisition_channel: channel as any,
      customer_email: customer.email || null,
      notes: mode === 'autoconsumo' ? (autoconsumoNotes || null) : (customer.notes || null),
    }).select('id').single()

    if (saleError || !sale) {
      alert(`❌ Errore nel salvataggio della vendita: ${saleError?.message || 'Nessun dato restituito'}`)
      setSaving(false)
      return
    }

    // Inserisci righe vendita
    const { error: itemsError } = await supabase.from('sale_items').insert(
      cart.map(i => ({ sale_id: sale.id, product_id: i.product.id, product_name: i.product.name, qty: i.qty, unit_price: i.product.price, line_total: i.line_total }))
    )
    if (itemsError) {
      console.error('Errore inserimento items:', itemsError.message)
    }

    // ✅ Scala stock dall'inventario (atomico via DB)
    for (const item of cart) {
      await supabase.rpc('increment_stock', { product_id: item.product.id, qty: -item.qty })
    }

    if (mode === 'online') {
      await supabase.from('online_orders').insert({ sale_id: sale.id, store_id: storeId, user_id: userId, delivery_type: shipping.type, recipient_name: shipping.name, address: shipping.address, city: shipping.city, cap: shipping.cap, phone: shipping.phone, courier: shipping.courier, tracking_number: shipping.tracking || null, delivery_notes: shipping.notes || null, shipping_cost: shippingCost })
    }

    // Notifica store (non blocca se fallisce)
    try {
      const msgTotal = mode === 'autoconsumo' ? '' : ` — ${fmt(mode === 'online' ? finalTotal : total)}`
      const msgType = mode === 'autoconsumo' ? '🍽 Autoconsumo' : (method === 'cash' ? 'Contanti' : 'POS')
      await supabase.from('notifications').insert({
        store_id: storeId,
        type: mode === 'autoconsumo' ? 'autoconsumo' : 'sale',
        title: mode === 'autoconsumo' ? '🍽 Autoconsumo registrato' : '💰 Nuova vendita',
        message: `${msgType}${msgTotal} — ${mode === 'autoconsumo' ? `Prodotti: ${cart.map(i => `${i.product.name} ×${i.qty}`).join(', ')}${autoconsumoNotes ? ` | Note: ${autoconsumoNotes}` : ''}` : `Cliente: ${customer.name || 'Anonimo'}`}`,
        user_id: userId,
      })
    } catch { }

    setCart([])
    setCustomer({ name: '', nationality: 'Italia', channel: 'Walk-in', email: '', notes: '' })
    setDiscount({ type: 'pct', value: '', applied: false, promoCode: '', promoId: '', promoDiscount: 0 })
    setCashReceived(''); setPosRef(''); setSplitCash(''); setShowCash(false); setShowPOS(false); setShowSplit(false)
    setSaving(false)
    loadData()
  }

  const filtered = products.filter(p =>
    (activeCat === 'all' || p.category === activeCat) &&
    (!search || p.name.toLowerCase().includes(search.toLowerCase())) &&
    p.stock > 0
  )
  const popular = [...products].filter(p => p.stock > 0).sort((a, b) => b.stock - a.stock).slice(0, 3)

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>Caricamento...</div>

  // ── Storno vendita ──
  async function voidSale(saleId: string) {
    if (!storeId || !userId) return
    setStornoId(saleId)

    // Get sale details
    const { data: sale } = await supabase
      .from('sales')
      .select('*, sale_items(product_id, product_name, qty, unit_price, line_total)')
      .eq('id', saleId)
      .single()

    if (!sale) { setStornoId(null); return }

    // Restore stock using atomic increment
    for (const item of (sale.sale_items || [])) {
      if (item.product_id) {
        await supabase.rpc('increment_stock', { product_id: item.product_id, qty: item.qty })
      }
    }

    // Delete sale items (trigger restores stock)
    await supabase.from('sale_items').delete().eq('sale_id', saleId)

    // Delete the sale
    await supabase.from('sales').delete().eq('id', saleId)

    // Notify owner
    try {
      const empName = storeEmployees.find(e => e.id === userId)?.full_name || 'Dipendente'
      await supabase.from('notifications').insert({
        store_id: storeId,
        type: 'sale',
        title: '⚠️ Vendita annullata',
        message: `${empName} ha annullato una vendita di ${fmt(sale.total)} — Cliente: ${sale.customer_name || 'Anonimo'}`,
        user_id: userId,
      })
    } catch { }

    setStornoId(null)
    setShowStornoConfirm(null)
    loadData()
  }

  const canCheckout = cart.length > 0 && (mode === 'autoconsumo' || mode !== 'negozio' || customer.name.trim() !== '')

  // ---- Shared render functions (used by both desktop panel and mobile bottom sheet) ----
  function renderCartItems() {
    return cart.map(item => (
      <div key={item.product.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{item.product.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{fmt(item.product.price)} × {item.qty}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => updateQty(item.product.id, -1)} className="btn btn-secondary" style={{ width: 26, height: 26, padding: 0 }}>−</button>
          <span style={{ fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{item.qty}</span>
          <button onClick={() => updateQty(item.product.id, 1)} className="btn btn-secondary" style={{ width: 26, height: 26, padding: 0 }}>+</button>
        </div>
        <span style={{ fontWeight: 700, fontSize: 13, minWidth: 52, textAlign: 'right' }}>{fmt(item.line_total)}</span>
      </div>
    ))
  }

  function renderCartExtras() {
    return (
      <>
        {/* Referente vendita */}
        {mode !== 'trasferimento' && storeEmployees.length > 1 && (
          <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-surface)', borderRadius: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>👤 Referente Vendita</div>
            <select
              className="input"
              value={referente}
              onChange={e => setReferente(e.target.value)}
              style={{ height: 36, fontSize: 13, width: '100%' }}
            >
              {/* Checked-in employees first */}
              {storeEmployees.filter(e => checkedInIds.has(e.id)).length > 0 && (
                <optgroup label="🟢 In turno">
                  {storeEmployees.filter(e => checkedInIds.has(e.id)).map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name}{emp.id === userId ? ' (tu)' : ''}
                    </option>
                  ))}
                </optgroup>
              )}
              {/* Others */}
              {storeEmployees.filter(e => !checkedInIds.has(e.id)).length > 0 && (
                <optgroup label="⚪ Non in turno">
                  {storeEmployees.filter(e => !checkedInIds.has(e.id)).map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name}{emp.id === userId ? ' (tu)' : ''}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            {referente && referente !== userId && (
              <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 4, fontWeight: 600 }}>
                ⚠️ La vendita sarà attribuita a {storeEmployees.find(e => e.id === referente)?.full_name}
              </div>
            )}
          </div>
        )}
        {/* Sconto */}
        {mode !== 'trasferimento' && mode !== 'autoconsumo' && (
          <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-surface)', borderRadius: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>🏷️ Sconto / Maggiorazione</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {(['pct', 'fixed', 'promo'] as const).map(t => (
                <button key={t} onClick={() => setDiscount(d => ({ ...d, type: t, applied: false, promoDiscount: 0 }))} style={{ flex: 1, padding: '5px', borderRadius: 6, fontSize: 11, border: `1px solid ${discount.type === t ? 'var(--brand-primary)' : 'var(--border-default)'}`, background: discount.type === t ? 'var(--brand-primary-light)' : 'transparent', color: discount.type === t ? 'var(--brand-primary)' : 'var(--text-secondary)', cursor: 'pointer' }}>
                  {t === 'pct' ? '% %' : t === 'fixed' ? '€ Fisso' : '🎟 Promo'}
                </button>
              ))}
            </div>
            {discount.type !== 'promo' ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="input" type="number" placeholder={discount.type === 'pct' ? 'Es: 10 (sconto) o -10 (upsell)' : 'Es: 5 (sconto) o -5 (upsell)'} value={discount.value} onChange={e => setDiscount(d => ({ ...d, value: e.target.value, applied: false }))} style={{ flex: 1, height: 34, fontSize: 13 }} />
                <button onClick={() => setDiscount(d => ({ ...d, applied: !!d.value }))} className={`btn ${discount.applied ? 'btn-danger' : 'btn-secondary'}`} style={{ padding: '0 12px', fontSize: 12 }}>{discount.applied ? 'Rimuovi' : 'Applica'}</button>
              </div>
            ) : (
              <div>
                <select
                  className="input"
                  value={discount.promoId}
                  onChange={e => applyPromo(e.target.value)}
                  style={{ height: 36, fontSize: 13 }}
                >
                  <option value="">Seleziona promo...</option>
                  {promoList.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.type === 'pct' ? `${p.value}%` : `€${p.value}`}{p.description ? ` (${p.description})` : ''}
                    </option>
                  ))}
                </select>
                {promoList.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>Nessuna promo attiva disponibile</div>
                )}
              </div>
            )}
            {promoError && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>⚠️ {promoError}</div>}
            {discount.applied && discAmt !== 0 && (
              <div style={{ fontSize: 12, color: discAmt > 0 ? 'var(--success)' : 'var(--warning)', marginTop: 4, fontWeight: 600 }}>
                {discAmt > 0 ? `✅ Sconto: -${fmt(discAmt)}` : `📈 Maggiorazione: +${fmt(Math.abs(discAmt))}`}
              </div>
            )}
          </div>
        )}
        {/* Dati cliente */}
        {(mode === 'negozio' || mode === 'autoconsumo') && mode !== 'autoconsumo' && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>👤 Dati Cliente <span style={{ color: 'var(--danger)' }}>*</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ position: 'relative' }}>
                <input className="input" placeholder="Nazionalità / Nome cliente *" value={customer.name}
                  onChange={e => { setCustomer(c => ({ ...c, name: e.target.value, nationality: e.target.value })); setCustomerError(''); setNatSearch(true) }}
                  onFocus={() => setNatSearch(true)}
                  style={{ height: 38, fontSize: 14, borderColor: customerError ? 'var(--danger)' : undefined }} />
                {natSearch && customer.name && (() => {
                    const countries = [
                      'Unknown',
                      'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Arabia Saudita', 'Argentina', 'Armenia', 'Australia',
                      'Austria', 'Azerbaigian', 'Bahamas', 'Bahrain', 'Bangladesh', 'Belgio', 'Bielorussia', 'Bolivia', 'Bosnia ed Erzegovina',
                      'Botswana', 'Brasile', 'Bulgaria', 'Burkina Faso', 'Cambogia', 'Camerun', 'Canada', 'Ciad', 'Cile', 'Cina', 'Cipro',
                      'Colombia', 'Corea del Sud', 'Costa Rica', "Costa d'Avorio", 'Croazia', 'Cuba', 'Danimarca', 'Ecuador', 'Egitto',
                      'El Salvador', 'Emirati Arabi Uniti', 'Estonia', 'Etiopia', 'Filippine', 'Finlandia', 'Francia',
                      'Georgia', 'Germania', 'Ghana', 'Giamaica', 'Giappone', 'Giordania', 'Grecia',
                      'Guatemala', 'Guinea', 'Haiti', 'Honduras', 'India', 'Indonesia',
                      'Iran', 'Iraq', 'Irlanda', 'Islanda', 'Israele', 'Italia', 'Kazakistan', 'Kenya',
                      'Kuwait', 'Laos', 'Lettonia', 'Libano', 'Libia', 'Liechtenstein', 'Lituania', 'Lussemburgo',
                      'Madagascar', 'Malawi', 'Malaysia', 'Maldive', 'Mali', 'Malta', 'Marocco', 'Mauritius', 'Messico',
                      'Moldavia', 'Monaco', 'Mongolia', 'Montenegro', 'Mozambico', 'Myanmar', 'Namibia', 'Nepal',
                      'Nicaragua', 'Niger', 'Nigeria', 'Norvegia', 'Nuova Zelanda', 'Oman', 'Paesi Bassi', 'Pakistan', 'Panama',
                      'Paraguay', 'Perù', 'Polonia', 'Portogallo', 'Qatar', 'Regno Unito', 'Rep. Ceca', 'Rep. Dominicana', 'Romania',
                      'Russia', 'Senegal', 'Serbia', 'Singapore', 'Siria', 'Slovacchia', 'Slovenia', 'Somalia', 'Spagna', 'Sri Lanka', 'Stati Uniti',
                      'Sudafrica', 'Sudan', 'Svezia', 'Svizzera', 'Tanzania', 'Thailandia',
                      'Togo', 'Trinidad e Tobago', 'Tunisia', 'Turchia', 'Ucraina', 'Uganda', 'Ungheria',
                      'Uruguay', 'Uzbekistan', 'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe'
                    ]
                    const filtered = countries.filter(c => c.toLowerCase().startsWith(customer.name.toLowerCase()))
                    if (filtered.length === 0 || (filtered.length === 1 && filtered[0] === customer.name)) return null
                    return (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999, background: 'var(--bg-primary)', border: '1px solid var(--border-default)', borderRadius: 8, maxHeight: 160, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                        {filtered.slice(0, 8).map(c => (
                          <div key={c} onClick={() => { setCustomer(prev => ({ ...prev, name: c, nationality: c })); setNatSearch(false) }}
                            style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            {c}
                          </div>
                        ))}
                      </div>
                    )
                  })()}
              </div>
              {customerError && <div style={{ fontSize: 12, color: 'var(--danger)' }}>⚠️ {customerError}</div>}
              <select className="input" value={customer.channel} onChange={e => setCustomer(c => ({ ...c, channel: e.target.value }))} style={{ height: 34, fontSize: 12 }}>
                {['Walk-in', 'Regular Customer', 'Tourist Back', 'Google', 'Social', 'AI/ChatGPT/Gemini Etc..', 'Friends'].map(c => <option key={c}>{c}</option>)}
              </select>
              <input className="input" type="email" placeholder="Email (opzionale)" value={customer.email} onChange={e => setCustomer(c => ({ ...c, email: e.target.value }))} style={{ height: 34, fontSize: 13 }} />
              <textarea className="input" placeholder="Note sul cliente (opzionale)" value={customer.notes} onChange={e => setCustomer(c => ({ ...c, notes: e.target.value }))} rows={2} style={{ fontSize: 13, resize: 'none' }} />
            </div>
          </div>
        )}
        {mode === 'online' && (
          <div style={{ marginTop: 12 }}>
            <div style={{ background: 'var(--bg-surface)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>📦 Step Preparazione</div>
              {['Controlla disponibilità', 'Prepara e imballa', 'Stampa etichetta', 'Affida al corriere', 'Inserisci tracking'].map((step, i) => (
                <div key={i} onClick={() => setDeliverySteps(s => { const n = [...s]; n[i] = !n[i]; return n })} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: i < 4 ? '1px solid var(--border-subtle)' : 'none', cursor: 'pointer' }}>
                  <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${deliverySteps[i] ? 'var(--success)' : 'var(--border-default)'}`, background: deliverySteps[i] ? 'var(--success)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {deliverySteps[i] && <span style={{ color: 'white', fontSize: 12 }}>✓</span>}
                  </div>
                  <span style={{ fontSize: 12, color: deliverySteps[i] ? 'var(--text-tertiary)' : 'var(--text-primary)', textDecoration: deliverySteps[i] ? 'line-through' : 'none' }}>{step}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
              <button className={`toggle-option ${shipping.type === 'delivery' ? 'active' : ''}`} onClick={() => setShipping(s => ({ ...s, type: 'delivery' }))}>🛵 Delivery +5€</button>
              <button className={`toggle-option ${shipping.type === 'long_distance' ? 'active' : ''}`} onClick={() => setShipping(s => ({ ...s, type: 'long_distance' }))}>🚚 Long +9.90€</button>
            </div>
            {[{ label: 'Nome destinatario *', key: 'name', ph: 'Mario Rossi' }, { label: 'Indirizzo', key: 'address', ph: 'Via Roma 42' }, { label: 'Città', key: 'city', ph: 'Milano' }, { label: 'CAP', key: 'cap', ph: '20100' }, { label: 'Telefono', key: 'phone', ph: '+39 333...' }, { label: 'Corriere', key: 'courier', ph: 'GLS' }, { label: 'Tracking', key: 'tracking', ph: '#TXN...' }].map(f => (
              <input key={f.key} className="input" placeholder={f.label} value={(shipping as any)[f.key]} onChange={e => setShipping(s => ({ ...s, [f.key]: e.target.value }))} style={{ height: 34, fontSize: 12, marginBottom: 6 }} />
            ))}
          </div>
        )}
        {mode === 'trasferimento' && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>📍 Destinazione</div>
            <select className="input" value={destStore} onChange={e => setDestStore(e.target.value)} style={{ marginBottom: 6 }}>
              <option value="">Seleziona negozio...</option>
              {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input className="input" placeholder="Motivo trasferimento" value={transferReason} onChange={e => setTransferReason(e.target.value)} style={{ height: 34, fontSize: 12 }} />
          </div>
        )}
        {mode === 'autoconsumo' && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>📝 Note Autoconsumo</div>
            <textarea className="input" placeholder="Es: campione per cliente, test qualità, degustazione staff..." value={autoconsumoNotes} onChange={e => setAutoconsumoNotes(e.target.value)} rows={2} style={{ fontSize: 13, resize: 'none' }} />
          </div>
        )}
      </>
    )
  }

  function renderCartFooter() {
    return (
      <div style={{ padding: 'var(--space-md) var(--space-lg)', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
        {mode === 'autoconsumo' ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Prodotti</span><span style={{ fontWeight: 700 }}>{cart.reduce((s, i) => s + i.qty, 0)}</span>
            </div>
            <div style={{ background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 12, color: '#92400E', textAlign: 'center' }}>
              🍽 Questi prodotti verranno scalati dall'inventario come autoconsumo (€0)
            </div>
            <button className="btn btn-primary btn-full btn-lg" disabled={saving || cart.length === 0} onClick={() => completeSale('other')} style={{ background: '#F59E0B' }}>
              {saving ? 'Conferma...' : '🍽 CONFERMA AUTOCONSUMO'}
            </button>
          </>
        ) : mode !== 'trasferimento' ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Subtotale</span><span style={{ fontSize: 13 }}>{fmt(subtotal)}</span>
            </div>
            {discount.applied && discAmt !== 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{discAmt > 0 ? 'Sconto' : 'Maggiorazione'}</span>
                <span style={{ fontSize: 13, color: discAmt > 0 ? 'var(--danger)' : 'var(--warning)' }}>{discAmt > 0 ? `-${fmt(discAmt)}` : `+${fmt(Math.abs(discAmt))}`}</span>
              </div>
            )}
            {mode === 'online' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Spedizione</span><span style={{ fontSize: 13 }}>+{fmt(shippingCost)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>Totale</span>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 22 }}>{fmt(finalTotal)}</span>
            </div>
            {!canCheckout && <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 8, textAlign: 'center' }}>⚠️ Inserisci il nome del cliente per procedere</div>}
            {mode === 'negozio' ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button className="btn btn-primary btn-lg" onClick={() => { setMobileCartOpen(false); if (validateCustomer()) setShowCash(true) }} disabled={saving} style={{ background: 'var(--success)' }}>💵 CONTANTI</button>
                  <button className="btn btn-primary btn-lg" onClick={() => { setMobileCartOpen(false); if (validateCustomer()) setShowPOS(true) }} disabled={saving} style={{ background: 'var(--accent-blue)' }}>💳 POS</button>
                </div>
                <button className="btn btn-lg" onClick={() => { setMobileCartOpen(false); if (validateCustomer()) { setSplitCash(''); setShowSplit(true) } }} disabled={saving} style={{ background: '#7C3AED', color: 'white', width: '100%', marginTop: 8 }}>💵+💳 SPLIT</button>
              </>
            ) : (
              <button className="btn btn-primary btn-full btn-lg" disabled={saving || !shipping.name} onClick={() => completeSale('other')} style={{ opacity: deliverySteps.every(Boolean) ? 1 : 0.7 }}>
                {saving ? 'Conferma...' : deliverySteps.every(Boolean) ? '✅ CONFERMA ORDINE' : `🚧 ${5 - deliverySteps.filter(Boolean).length} step mancanti`}
              </button>
            )}
          </>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Articoli</span><span style={{ fontWeight: 700 }}>{cart.reduce((s, i) => s + i.qty, 0)}</span>
            </div>
            <button className="btn btn-primary btn-full btn-lg" disabled={saving || !destStore} onClick={() => completeSale('other')}>
              {saving ? 'Conferma...' : '📦 CONFERMA TRASFERIMENTO'}
            </button>
          </>
        )}
      </div>
    )
  }

  return (
    <div style={{ height: '100dvh', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', overflow: 'hidden', paddingBottom: 56 }}>
      {/* QR Scanner Modal */}
      {showQR && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 380 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h4>📷 Scan Prodotto</h4>
              <button onClick={stopQR} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer' }}>×</button>
            </div>
            {qrError ? (
              <div style={{ background: '#FEF2F2', border: '1px solid #EF4444', borderRadius: 8, padding: 12, fontSize: 13, color: '#EF4444', marginBottom: 12 }}>
                {qrError}
                <br /><span style={{ fontSize: 12 }}>Vai su Impostazioni del telefono e abilita la fotocamera per BrainWare.</span>
              </div>
            ) : (
              <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#000', marginBottom: 12 }}>
                <video ref={videoRef} style={{ width: '100%', height: 220, objectFit: 'cover' }} playsInline muted />
                {/* Mirino */}
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 140, height: 140, border: '2px solid #22C55E', borderRadius: 8, boxShadow: '0 0 0 1000px rgba(0,0,0,0.4)' }} />
              </div>
            )}
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 12 }}>
              Inquadra il QR code o barcode del prodotto
            </div>
            <button className="btn btn-secondary btn-full" onClick={stopQR}>Annulla</button>
          </div>
        </div>
      )}

      {/* Cash modal */}
      {showCash && (
        <div className="modal-overlay">
          <div className="modal">
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pagamento</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <div><div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Totale da pagare</div><div style={{ fontSize: 28, fontFamily: 'var(--font-heading)', fontWeight: 700 }}>{fmt(total)}</div></div>
                <span className="badge badge-success">Contanti</span>
              </div>
            </div>
            <div style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center' }}>Conferma il pagamento in contanti</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowCash(false)}>Annulla</button>
              <button className="btn btn-primary" style={{ flex: 2 }} disabled={saving} onClick={() => completeSale('cash')}>💵 Conferma Vendita</button>
            </div>
          </div>
        </div>
      )}
      {/* POS modal */}
      {showPOS && (
        <div className="modal-overlay">
          <div className="modal">
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pagamento POS</div>
              <div style={{ fontSize: 28, fontFamily: 'var(--font-heading)', fontWeight: 700, marginTop: 8 }}>{fmt(total)}</div>
            </div>
            <div style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 14, color: 'var(--text-secondary)' }}>Procedi con il pagamento tramite terminale POS</div>
            <div className="input-group" style={{ marginBottom: 16 }}>
              <label className="input-label">Rif. Transazione</label>
              <input className="input" placeholder="#TXN-..." value={posRef} onChange={e => setPosRef(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowPOS(false)}>Annulla</button>
              <button className="btn btn-primary" style={{ flex: 2 }} disabled={saving} onClick={() => completeSale('pos')}>Conferma Pagamento POS</button>
            </div>
          </div>
        </div>
      )}
      {/* Split modal */}
      {showSplit && (
        <div className="modal-overlay">
          <div className="modal">
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pagamento Split</div>
              <div style={{ fontSize: 28, fontFamily: 'var(--font-heading)', fontWeight: 700, marginTop: 8 }}>{fmt(total)}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>💵 Contanti</label>
                <input className="input" type="number" step="0.01" placeholder="0.00" value={splitCash}
                  onChange={e => setSplitCash(e.target.value)}
                  style={{ fontSize: 20, fontWeight: 700, textAlign: 'center', height: 48 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>💳 POS</label>
                <div style={{ fontSize: 20, fontWeight: 700, textAlign: 'center', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface)', borderRadius: 8, color: (total - (parseFloat(splitCash) || 0)) >= 0 ? 'var(--accent-blue)' : 'var(--danger)' }}>
                  {fmt(total - (parseFloat(splitCash) || 0))}
                </div>
              </div>
            </div>
            <div className="input-group" style={{ marginBottom: 16 }}>
              <label className="input-label">Rif. POS (opzionale)</label>
              <input className="input" placeholder="#TXN-..." value={posRef} onChange={e => setPosRef(e.target.value)} />
            </div>
            {(parseFloat(splitCash) || 0) <= 0 && <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 8 }}>⚠️ Inserisci l'importo in contanti</div>}
            {(total - (parseFloat(splitCash) || 0)) < 0 && <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 8 }}>⚠️ L'importo contanti supera il totale</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowSplit(false)}>Annulla</button>
              <button className="btn btn-primary" style={{ flex: 2, background: '#7C3AED' }}
                disabled={saving || (parseFloat(splitCash) || 0) <= 0 || (total - (parseFloat(splitCash) || 0)) < 0}
                onClick={() => completeSale('split' as any)}>💵+💳 Conferma Split</button>
            </div>
          </div>
        </div>
      )}

      {/* Cronologia vendite modal */}
      {showHistory && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h4>📋 Vendite di questo turno</h4>
              <button onClick={() => setShowHistory(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer' }}>×</button>
            </div>
            {recentSales.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 'var(--space-xl)' }}>Nessuna vendita ancora</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
                {recentSales.map((s, i) => (
                  <div key={s.id} style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 10, border: i === 0 ? '1.5px solid var(--brand-primary)' : '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: i === 0 ? 'var(--brand-primary)' : 'var(--text-primary)' }}>
                          {i === 0 ? '🆕 ' : ''}{fmt(s.total)}
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
                          background: s.payment_method === 'cash' ? '#DCFCE7' : s.payment_method === 'split' ? '#EDE9FE' : '#DBEAFE',
                          color: s.payment_method === 'cash' ? '#16A34A' : s.payment_method === 'split' ? '#7C3AED' : '#2563EB',
                        }}>
                          {s.payment_method === 'cash' ? '💵 CASH' : s.payment_method === 'split' ? '💵+💳 SPLIT' : '💳 POS'}
                        </span>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{new Date(s.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      Cliente: {s.customer_name || 'Anonimo'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>
                      {s.sale_items?.map(it => `${it.product_name} ×${it.qty}`).join(' · ')}
                    </div>
                    {/* Storno button */}
                    {showStornoConfirm === s.id ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 600 }}>Confermi lo storno?</span>
                        <button
                          onClick={() => voidSale(s.id)}
                          disabled={stornoId === s.id}
                          className="btn btn-danger"
                          style={{ padding: '4px 12px', fontSize: 11 }}
                        >
                          {stornoId === s.id ? 'Annullamento...' : '✅ Sì, annulla'}
                        </button>
                        <button
                          onClick={() => setShowStornoConfirm(null)}
                          className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: 11 }}
                        >No</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowStornoConfirm(s.id)}
                        style={{
                          background: 'none', border: '1px solid var(--danger)',
                          borderRadius: 6, padding: '3px 10px', fontSize: 11,
                          color: 'var(--danger)', cursor: 'pointer', fontWeight: 600,
                        }}
                      >
                        ❌ Annulla vendita
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mode selector + history button */}
      <div style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-subtle)', padding: 'var(--space-sm) var(--space-lg)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['negozio', 'online', 'trasferimento', 'autoconsumo'] as Mode[]).map(m => (
              <button key={m} onClick={() => setMode(m)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: `1.5px solid ${mode === m ? 'var(--brand-primary)' : 'var(--border-default)'}`, background: mode === m ? 'var(--brand-primary-light)' : 'transparent', color: mode === m ? 'var(--brand-primary)' : 'var(--text-secondary)', cursor: 'pointer' }}>
                {m === 'negozio' ? '🏪 Negozio' : m === 'online' ? '🌐 Online' : m === 'trasferimento' ? '📦 Transfer' : '🍽 Autoconsumo'}
              </button>
            ))}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
            {recentSales.length > 0 && (
              <button onClick={() => setShowHistory(true)} style={{ position: 'relative', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 20, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                📋 {recentSales.length}
                {lastSale && <span style={{ position: 'absolute', top: -4, right: -4, background: 'var(--brand-primary)', color: 'white', borderRadius: '50%', width: 14, height: 14, fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>!</span>}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Ultima vendita banner (se esiste) */}
      {lastSale && cart.length === 0 && (
        <div style={{ background: 'var(--brand-primary-light)', borderBottom: '1px solid var(--brand-primary)', padding: '8px var(--space-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12 }}>
            <span style={{ fontWeight: 700, color: 'var(--brand-primary-dark)' }}>✅ Ultima vendita: {fmt(lastSale.total)}</span>
            <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>{new Date(lastSale.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} · {lastSale.customer_name || 'Anonimo'}</span>
          </div>
          <button onClick={() => setShowHistory(true)} style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--brand-primary)', fontWeight: 600, cursor: 'pointer' }}>Vedi tutto →</button>
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {/* Left: Catalog – always full width on mobile */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-lg)', paddingBottom: cart.length > 0 ? 80 : 'var(--space-lg)' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--space-md)' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input className="input" placeholder="Cerca prodotto..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16 }}>🔍</span>
            </div>
            <button className="btn btn-secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }} onClick={startQR}>📷 Scan</button>
          </div>

          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 'var(--space-lg)', paddingBottom: 4 }}>
            {(['all', ...CATEGORIES] as (ProductCategory | 'all')[]).map(c => (
              <button key={c} onClick={() => setActiveCat(c)} className={`badge ${activeCat === c ? 'badge-brand' : 'badge-gray'}`} style={{ cursor: 'pointer', border: 'none', padding: '6px 14px', whiteSpace: 'nowrap' }}>
                {c === 'all' ? 'Tutto' : categoryLabel[c]}
              </button>
            ))}
          </div>

          {!search && activeCat === 'all' && (
            <>
              <h4 style={{ marginBottom: 'var(--space-md)', fontSize: 13, color: 'var(--text-secondary)' }}>⭐ Più Venduti</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
                {popular.map(p => (
                  <div key={p.id} className="card card-sm" style={{ cursor: 'pointer' }} onClick={() => addToCart(p)}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{fmt(p.price)}/{p.unit}</div>

                  </div>
                ))}
              </div>
            </>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 'var(--space-md)' }}>
            {filtered.map(p => (
              <div key={p.id} className="card card-sm" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{fmt(p.price)}/{p.unit}</div>
                  <span className="badge badge-indigo" style={{ fontSize: 10, marginTop: 4 }}>{categoryLabel[p.category]}</span>
                </div>

                <button className="btn btn-primary" style={{ padding: 8, fontSize: 12 }} disabled={p.stock === 0} onClick={() => addToCart(p)}>
                  {p.stock === 0 ? 'Esaurito' : '+ Aggiungi'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ═══════════════ DESKTOP CART (side panel) ═══════════════ */}
        {cart.length > 0 && (
          <div className="pos-cart-desktop" style={{ width: 360, borderLeft: '1px solid var(--border-subtle)', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '12px var(--space-lg) 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <h4>{mode === 'trasferimento' ? 'Prodotti' : 'Carrello'} ({cart.reduce((s, i) => s + i.qty, 0)})</h4>
              <button onClick={() => setCart([])} style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 12, cursor: 'pointer' }}>Svuota</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 var(--space-lg)', minHeight: 0 }}>
              {renderCartItems()}
              {renderCartExtras()}
            </div>

            <div style={{ flexShrink: 0 }}>
              {renderCartFooter()}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════ MOBILE CART (bottom sheet) ═══════════════ */}
      {cart.length > 0 && (
        <>
          {/* Collapsed bar — always visible when cart has items */}
          {!mobileCartOpen && (
            <div
              className="pos-cart-mobile-bar"
              onClick={() => setMobileCartOpen(true)}
              style={{
                position: 'fixed', bottom: 56, left: 0, right: 0, zIndex: 90,
                background: 'var(--brand-primary)', color: 'white',
                padding: '10px 20px', display: 'none', /* hidden on desktop, shown via CSS */
                alignItems: 'center', justifyContent: 'space-between',
                cursor: 'pointer', boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: '2px 10px', fontSize: 13, fontWeight: 700 }}>
                  {cart.reduce((s, i) => s + i.qty, 0)}
                </span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Vedi carrello</span>
              </div>
              <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>{fmt(finalTotal)}</span>
            </div>
          )}

          {/* Expanded sheet */}
          {mobileCartOpen && (
            <div className="pos-cart-mobile-sheet" style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'none' /* shown via CSS */ }}>
              <div onClick={() => setMobileCartOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: 'var(--bg-primary)',
                borderRadius: '20px 20px 0 0',
                maxHeight: '85vh', display: 'flex', flexDirection: 'column',
                boxShadow: '0 -8px 30px rgba(0,0,0,0.2)',
                animation: 'slideUp 0.25s ease',
              }}>
                {/* Handle */}
                <div onClick={() => setMobileCartOpen(false)} style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 6px', cursor: 'pointer' }}>
                  <div style={{ width: 40, height: 4, borderRadius: 4, background: 'var(--border-strong)' }} />
                </div>
                <div style={{ padding: '0 var(--space-lg) 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4>{mode === 'trasferimento' ? 'Prodotti' : 'Carrello'} ({cart.reduce((s, i) => s + i.qty, 0)})</h4>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button onClick={() => setCart([])} style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 12, cursor: 'pointer' }}>Svuota</button>
                    <button onClick={() => setMobileCartOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
                  </div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '0 var(--space-lg)', WebkitOverflowScrolling: 'touch' }}>
                  {renderCartItems()}
                  {renderCartExtras()}
                </div>
                {renderCartFooter()}
              </div>
            </div>
          )}
        </>
      )}

      <BottomNav />
    </div>
  )
}
