import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// API temporanea per bulk load prodotti + stock
// Chiamare con POST e body { store_id, products: [{ name, category, stock }] }
export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { store_id, products } = await req.json()
  if (!store_id || !products || !Array.isArray(products)) {
    return NextResponse.json({ error: 'store_id and products array required' }, { status: 400 })
  }

  // Carica prodotti esistenti
  const { data: existing } = await supabase.from('products').select('id, name').eq('store_id', store_id)
  const existingMap = new Map((existing ?? []).map(p => [p.name.toLowerCase(), p.id]))

  let created = 0, updated = 0, errors = 0

  for (const p of products) {
    const name = p.name?.trim()
    if (!name) continue
    const category = (p.category || 'accessories').toLowerCase()
    const stock = parseInt(p.stock) || 0

    const existingId = existingMap.get(name.toLowerCase())

    if (existingId) {
      // Prodotto già esiste → aggiorna solo stock
      const { error } = await supabase.from('products').update({ stock, category }).eq('id', existingId)
      if (error) errors++
      else updated++
    } else {
      // Prodotto nuovo → crea con stock
      const { error } = await supabase.from('products').insert({
        store_id,
        name,
        category,
        price: p.price || 0,
        cost: p.cost || null,
        unit: p.unit || 'pz',
        barcode: null,
        stock,
        stock_alert: 5,
      })
      if (error) errors++
      else created++
    }
  }

  return NextResponse.json({ success: true, created, updated, errors, total: products.length })
}
