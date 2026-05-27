import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const DEMO_EMAIL = 'demo@brain-ware.ai'
const SEED_SECRET = 'brainware-seed-2026'

export async function POST(req: NextRequest) {
  try {
    const { secret } = await req.json()
    if (secret !== SEED_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // 1. Get demo user
    const { data: demoUser } = await supabase.from('users').select('id, store_id').eq('role', 'owner').limit(10)
    const demo = demoUser?.find((u: any) => true) // get first owner
    if (!demo) return NextResponse.json({ error: 'No demo user found' }, { status: 404 })

    // Also try to find by email
    const { data: authUsers } = await supabase.auth.admin.listUsers()
    const demoAuth = authUsers?.users?.find(u => u.email === DEMO_EMAIL)
    const userId = demoAuth?.id || demo.id
    const storeId = demo.store_id

    if (!storeId) return NextResponse.json({ error: 'No store found for demo user' }, { status: 404 })

    // Get all stores for this owner
    const { data: allStores } = await supabase.from('stores').select('id, name').limit(10)
    const stores = allStores || [{ id: storeId, name: 'Demo Store' }]

    // 2. Clean old demo data
    for (const store of stores) {
      await supabase.from('sale_items').delete().in('sale_id',
        (await supabase.from('sales').select('id').eq('store_id', store.id)).data?.map((s: any) => s.id) || []
      )
      await supabase.from('sales').delete().eq('store_id', store.id)
      await supabase.from('expenses').delete().eq('store_id', store.id)
      await supabase.from('inventory_count_items').delete().in('inventory_count_id',
        (await supabase.from('inventory_counts').select('id').eq('store_id', store.id)).data?.map((c: any) => c.id) || []
      )
      await supabase.from('inventory_counts').delete().eq('store_id', store.id)
      await supabase.from('maintenance_logs').delete().eq('store_id', store.id)
      await supabase.from('shifts').delete().eq('store_id', store.id)
      await supabase.from('products').delete().eq('store_id', store.id)
      await supabase.from('fidelity_cards').delete().eq('store_id', store.id)
      await supabase.from('notifications').delete().eq('store_id', store.id)
    }

    // 3. Create stores if less than 3
    const storeNames = ['BrainWare Demo - Amsterdam', 'BrainWare Demo - Barcelona', 'BrainWare Demo - Berlin', 'BrainWare Demo - Lisbon', 'BrainWare Demo - Prague', 'BrainWare Demo - Milano']
    const finalStores: any[] = []

    if (stores.length < 3) {
      for (const sn of storeNames) {
        const existing = stores.find(s => s.name === sn)
        if (existing) { finalStores.push(existing); continue }
        const { data } = await supabase.from('stores').insert({ name: sn, city: sn.split(' - ')[1]?.split(' ')[0] || 'Roma', is_active: true }).select().single()
        if (data) finalStores.push(data)
      }
    } else {
      finalStores.push(...stores)
    }

    // Use first store as primary
    const primaryStore = finalStores[0] || { id: storeId }

    // Update demo user to primary store
    await supabase.from('users').update({ store_id: primaryStore.id }).eq('id', userId)

    // 4. Products per store (cannabis/vape focused)
    const PRODUCTS = [
      // Flowers
      { name: 'Amnesia Haze CBD', category: 'flowers', price: 8.00, cost: 3.50, unit: 'g', stock: 450, stock_alert: 50 },
      { name: 'Lemon Haze Premium', category: 'flowers', price: 10.00, cost: 4.00, unit: 'g', stock: 320, stock_alert: 40 },
      { name: 'White Widow Light', category: 'flowers', price: 7.50, cost: 3.00, unit: 'g', stock: 280, stock_alert: 30 },
      { name: 'Purple Haze Indoor', category: 'flowers', price: 12.00, cost: 5.00, unit: 'g', stock: 180, stock_alert: 25 },
      { name: 'Critical Kush CBD', category: 'flowers', price: 9.00, cost: 3.80, unit: 'g', stock: 350, stock_alert: 40 },
      { name: 'Gorilla Glue #4', category: 'flowers', price: 11.00, cost: 4.50, unit: 'g', stock: 220, stock_alert: 30 },
      { name: 'OG Kush Premium', category: 'flowers', price: 13.00, cost: 5.50, unit: 'g', stock: 150, stock_alert: 20 },
      { name: 'Strawberry Haze', category: 'flowers', price: 8.50, cost: 3.60, unit: 'g', stock: 400, stock_alert: 45 },
      { name: 'Blue Dream CBD', category: 'flowers', price: 9.50, cost: 4.00, unit: 'g', stock: 270, stock_alert: 35 },
      { name: 'Mango Kush Light', category: 'flowers', price: 7.00, cost: 2.80, unit: 'g', stock: 500, stock_alert: 60 },
      // Hashish
      { name: 'Charas Nepalese CBD', category: 'hashish', price: 12.00, cost: 5.00, unit: 'g', stock: 200, stock_alert: 25 },
      { name: 'Polline Premium', category: 'hashish', price: 8.00, cost: 3.20, unit: 'g', stock: 350, stock_alert: 40 },
      { name: 'Moonrock CBD', category: 'hashish', price: 18.00, cost: 8.00, unit: 'g', stock: 80, stock_alert: 15 },
      { name: 'Afghan Gold Hash', category: 'hashish', price: 10.00, cost: 4.20, unit: 'g', stock: 160, stock_alert: 20 },
      { name: 'Ice-O-Lator Extract', category: 'hashish', price: 15.00, cost: 6.50, unit: 'g', stock: 120, stock_alert: 20 },
      // Oils
      { name: 'CBD Oil 10% Full Spectrum', category: 'oils', price: 35.00, cost: 14.00, unit: 'pz', stock: 85, stock_alert: 15 },
      { name: 'CBD Oil 20% Premium', category: 'oils', price: 55.00, cost: 22.00, unit: 'pz', stock: 45, stock_alert: 10 },
      { name: 'CBG Oil 5%', category: 'oils', price: 28.00, cost: 11.00, unit: 'pz', stock: 60, stock_alert: 10 },
      { name: 'CBD Vape Liquid Mango', category: 'oils', price: 18.00, cost: 7.00, unit: 'pz', stock: 95, stock_alert: 15 },
      { name: 'CBD Vape Liquid Mint', category: 'oils', price: 18.00, cost: 7.00, unit: 'pz', stock: 110, stock_alert: 15 },
      // Edibles
      { name: 'CBD Gummies Mix 300mg', category: 'edibles', price: 22.00, cost: 8.00, unit: 'pz', stock: 70, stock_alert: 12 },
      { name: 'Hemp Tea Relax', category: 'edibles', price: 8.00, cost: 2.50, unit: 'pz', stock: 200, stock_alert: 30 },
      { name: 'CBD Chocolate Bar', category: 'edibles', price: 12.00, cost: 4.50, unit: 'pz', stock: 55, stock_alert: 10 },
      { name: 'Hemp Protein Powder', category: 'edibles', price: 25.00, cost: 10.00, unit: 'pz', stock: 40, stock_alert: 8 },
      // Accessories
      { name: 'Vaporizzatore Mighty+', category: 'accessories', price: 349.00, cost: 200.00, unit: 'pz', stock: 8, stock_alert: 3 },
      { name: 'Grinder Premium 4 Parti', category: 'accessories', price: 25.00, cost: 8.00, unit: 'pz', stock: 60, stock_alert: 10 },
      { name: 'Cartine RAW King Size', category: 'accessories', price: 2.50, cost: 0.80, unit: 'pz', stock: 500, stock_alert: 80 },
      { name: 'Pax 3 Vaporizer', category: 'accessories', price: 199.00, cost: 110.00, unit: 'pz', stock: 12, stock_alert: 3 },
      { name: 'Bilancino Digitale 0.01g', category: 'accessories', price: 15.00, cost: 5.00, unit: 'pz', stock: 35, stock_alert: 8 },
      { name: 'Bong in vetro 30cm', category: 'accessories', price: 45.00, cost: 15.00, unit: 'pz', stock: 20, stock_alert: 5 },
    ]

    // Insert products for each store
    const productsByStore: Record<string, any[]> = {}
    for (const store of finalStores) {
      const prods = PRODUCTS.map(p => ({
        ...p,
        store_id: store.id,
        stock: p.stock + Math.floor(Math.random() * 50) - 25,
        is_active: true,
      }))
      const { data: inserted } = await supabase.from('products').insert(prods).select()
      productsByStore[store.id] = inserted || []
    }

    // 5. Employee names for variety
    const empNames = ['Marco Rossi', 'Giulia Bianchi', 'Luca Ferrari', 'Sofia Romano', 'Alessandro Conti', 'Valentina Ricci']

    // 6. Create shifts and sales for the last 30 days
    const now = new Date()
    const customerNames = ['Marco T.', 'Giulia S.', 'Andrea P.', 'Luca M.', 'Sofia B.', 'Chiara R.', 'Matteo L.', 'Elena V.', 'Roberto G.', 'Francesca D.', 'Tourist DE', 'Tourist UK', 'Tourist FR', 'Tourist US', null, null, null]
    const nationalities = ['IT', 'IT', 'IT', 'IT', 'IT', 'DE', 'DE', 'GB', 'FR', 'US', 'NL', 'ES', null]
    const channels: any[] = ['walk-in', 'walk-in', 'walk-in', 'social', 'google', 'referral', 'other']

    let invoiceCounter = 1000
    let totalSalesCreated = 0

    for (const store of finalStores.slice(0, 3)) {
      const products = productsByStore[store.id] || []
      if (products.length === 0) continue

      for (let dayOffset = 30; dayOffset >= 0; dayOffset--) {
        const day = new Date(now)
        day.setDate(day.getDate() - dayOffset)
        const dayStr = day.toISOString().split('T')[0]

        for (const period of ['morning', 'evening'] as const) {
          const shiftStart = new Date(`${dayStr}T${period === 'morning' ? '08:00' : '14:00'}:00`)
          const shiftEnd = new Date(`${dayStr}T${period === 'morning' ? '14:00' : '21:00'}:00`)
          const empName = empNames[Math.floor(Math.random() * empNames.length)]
          const fce = 50

          const { data: shift } = await supabase.from('shifts').insert({
            store_id: store.id, user_id: userId, period,
            status: (dayOffset === 0 && period === 'evening') ? 'open' : 'closed',
            fce, fcu: dayOffset === 0 ? null : 50,
            deposit_actual: dayOffset === 0 ? null : Math.floor(80 + Math.random() * 200),
            opened_at: shiftStart.toISOString(),
            closed_at: dayOffset === 0 && period === 'evening' ? null : shiftEnd.toISOString(),
            created_at: shiftStart.toISOString(),
          }).select().single()

          if (!shift) continue

          // Sales per shift (6-18 per shift)
          const numSales = 6 + Math.floor(Math.random() * 13)
          for (let s = 0; s < numSales; s++) {
            const numItems = 1 + Math.floor(Math.random() * 3)
            const items: any[] = []
            let subtotal = 0

            for (let i = 0; i < numItems; i++) {
              const prod = products[Math.floor(Math.random() * products.length)]
              const qty = prod.unit === 'g' ? [1, 2, 3, 5, 10][Math.floor(Math.random() * 5)] : 1
              const lineTotal = prod.price * qty
              subtotal += lineTotal
              items.push({ product_id: prod.id, product_name: prod.name, qty, unit_price: prod.price, line_total: lineTotal })
            }

            const discountPct = Math.random() > 0.85 ? [5, 10, 15][Math.floor(Math.random() * 3)] : 0
            const discountAmt = subtotal * discountPct / 100
            const total = subtotal - discountAmt
            const paymentMethod = Math.random() > 0.45 ? 'cash' : 'pos'
            const saleTime = new Date(shiftStart.getTime() + Math.random() * (shiftEnd.getTime() - shiftStart.getTime()))

            invoiceCounter++
            const { data: sale } = await supabase.from('sales').insert({
              shift_id: shift.id, store_id: store.id, user_id: userId,
              payment_method: paymentMethod, subtotal, discount_amount: discountAmt, discount_pct: discountPct,
              total, customer_name: customerNames[Math.floor(Math.random() * customerNames.length)],
              customer_nationality: nationalities[Math.floor(Math.random() * nationalities.length)],
              acquisition_channel: channels[Math.floor(Math.random() * channels.length)],
              invoice_number: `INV-${invoiceCounter}`,
              cash_received: paymentMethod === 'cash' ? Math.ceil(total / 5) * 5 : null,
              cash_change: paymentMethod === 'cash' ? Math.ceil(total / 5) * 5 - total : null,
              created_at: saleTime.toISOString(),
              movement_type: 'sale',
            }).select().single()

            if (sale) {
              await supabase.from('sale_items').insert(items.map(it => ({ ...it, sale_id: sale.id })))
              totalSalesCreated++
            }
          }

          // Expenses (1-2 per shift)
          if (Math.random() > 0.4) {
            const expDescs = ['Pulizia negozio', 'Sacchetti carta', 'Acqua dipendenti', 'Materiale imballo', 'Piccola manutenzione']
            await supabase.from('expenses').insert({
              shift_id: shift.id, store_id: store.id, user_id: userId,
              amount: [5, 8, 10, 12, 15, 20][Math.floor(Math.random() * 6)],
              description: expDescs[Math.floor(Math.random() * expDescs.length)],
              created_at: shiftStart.toISOString(),
            })
          }

          // Maintenance logs
          if (period === 'morning') {
            const tasks = ['Pulizia vetrine', 'Controllo temperatura', 'Verifica scorte', 'Pulizia pavimento', 'Organizzazione scaffali']
            for (const task of tasks) {
              await supabase.from('maintenance_logs').insert({
                shift_id: shift.id, store_id: store.id, user_id: userId,
                title: task, completed: Math.random() > 0.15,
                completed_at: Math.random() > 0.15 ? new Date(shiftStart.getTime() + 3600000).toISOString() : null,
                created_at: shiftStart.toISOString(),
              })
            }
          }
        }
      }
    }

    // 7. Fidelity cards
    const fidelityCustomers = [
      { name: 'Marco Taviani', phone: '+39 333 1234567', email: 'marco@email.it', nationality: 'IT', points: 340 },
      { name: 'Giulia Santini', phone: '+39 339 2345678', email: 'giulia@email.it', nationality: 'IT', points: 520 },
      { name: 'Thomas Mueller', phone: '+49 170 1234567', email: 'thomas@email.de', nationality: 'DE', points: 180 },
      { name: 'Sophie Bernard', phone: '+33 6 12345678', email: 'sophie@email.fr', nationality: 'FR', points: 95 },
      { name: 'James Wilson', phone: '+44 7911 123456', email: 'james@email.uk', nationality: 'GB', points: 260 },
      { name: 'Luca Ferrari', phone: '+39 347 3456789', email: 'luca.f@email.it', nationality: 'IT', points: 410 },
      { name: 'Elena Volkov', phone: '+39 320 4567890', email: 'elena@email.it', nationality: 'RU', points: 150 },
      { name: 'Andrea Pellegrini', phone: '+39 348 5678901', email: 'andrea.p@email.it', nationality: 'IT', points: 680 },
    ]

    for (const fc of fidelityCustomers) {
      await supabase.from('fidelity_cards').insert({
        store_id: primaryStore.id,
        card_number: `FC-2026-${String(Math.floor(1000 + Math.random() * 9000))}`,
        customer_name: fc.name, customer_phone: fc.phone, customer_email: fc.email,
        customer_nationality: fc.nationality, points: fc.points, is_active: true, created_by: userId,
      })
    }

    // 8. Store config
    await supabase.from('store_config').upsert({
      store_id: primaryStore.id,
      fcu_default: 50,
      morning_shift_start: '08:00', morning_shift_end: '14:00',
      evening_shift_start: '14:00', evening_shift_end: '21:00',
      punctuality_tolerance_min: 5,
      stock_alert_threshold: 10,
    }, { onConflict: 'store_id' })

    // 9. Brand config
    await supabase.from('brand_config').upsert({
      store_id: primaryStore.id,
      brand_name: 'BrainWare Demo',
      logo_letter: 'B',
      primary_color: '#6366F1',
    }, { onConflict: 'store_id' })

    // 10. Notifications
    const notifTexts = [
      { title: '📦 Scorta bassa: Amnesia Haze CBD', body: 'Il prodotto Amnesia Haze CBD è sotto la soglia minima (50g). Ordina rifornimento.', type: 'stock_alert' },
      { title: '💰 Vendita sopra media', body: 'Vendita di €349.00 (Vaporizzatore Mighty+) registrata da Marco R.', type: 'sale' },
      { title: '🔧 Manutenzione completata', body: 'Checklist mattutina completata al 100% da Giulia B.', type: 'maintenance' },
      { title: '📊 Report giornaliero', body: 'Revenue totale ieri: €2.450. +12% vs media settimanale.', type: 'report' },
      { title: '💳 Nuova Fidelity Card', body: 'Nuova carta fedeltà emessa per Andrea Pellegrini (680 punti).', type: 'fidelity' },
    ]
    for (const n of notifTexts) {
      await supabase.from('notifications').insert({
        store_id: primaryStore.id, user_id: userId,
        title: n.title, body: n.body, type: n.type, read: false,
      })
    }

    return NextResponse.json({
      success: true,
      stores: finalStores.length,
      products: Object.values(productsByStore).flat().length,
      sales: totalSalesCreated,
      fidelity: fidelityCustomers.length,
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message, stack: err.stack?.slice(0, 500) }, { status: 500 })
  }
}
