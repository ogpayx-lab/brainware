import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// API per aggiornare prodotti esistenti (categoria + stock) SENZA cancellare
// Crea solo i prodotti che non esistono già
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
  const { data: existing } = await supabase.from('products').select('id, name, price, cost').eq('store_id', store_id)
  const existingMap = new Map((existing ?? []).map(p => [p.name.toLowerCase().trim(), p]))

  let created = 0, updated = 0, skipped = 0, errors = 0
  const errorDetails: any[] = []

  for (const p of products) {
    const name = p.name?.trim()
    if (!name) continue
    const category = (p.category || 'accessories').toLowerCase()
    const stock = parseInt(p.stock) ?? 0

    const existingProduct = existingMap.get(name.toLowerCase())

    if (existingProduct) {
      // Prodotto esiste → aggiorna solo categoria, stock e campi forniti
      // NON sovrascrive prezzo/costo se non forniti
      const updatePayload: any = { category, stock }
      if (p.price && parseFloat(p.price) > 0) updatePayload.price = parseFloat(p.price)
      if (p.cost && parseFloat(p.cost) > 0) updatePayload.cost = parseFloat(p.cost)
      
      const { error } = await supabase.from('products').update(updatePayload).eq('id', existingProduct.id)
      if (error) {
        errors++
        errorDetails.push({ name, error: error.message })
      } else {
        updated++
      }
    } else {
      // Prodotto nuovo → crea
      const { error } = await supabase.from('products').insert({
        store_id,
        name,
        category,
        price: parseFloat(p.price) || 0,
        cost: p.cost ? parseFloat(p.cost) : null,
        unit: p.unit || 'pz',
        barcode: null,
        stock,
        stock_alert: 5,
      })
      if (error) {
        errors++
        errorDetails.push({ name, error: error.message })
      } else {
        created++
      }
    }
  }

  return NextResponse.json({ 
    success: true, 
    existing_count: existing?.length ?? 0,
    created, 
    updated, 
    skipped,
    errors,
    errorDetails,
    total: products.length 
  })
}
