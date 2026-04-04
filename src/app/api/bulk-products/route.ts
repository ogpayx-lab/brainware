import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, supabaseKey)

  const { store_id, products } = await req.json()
  if (!store_id || !products || !Array.isArray(products)) {
    return NextResponse.json({ error: 'store_id and products array required' }, { status: 400 })
  }

  // Step 1: Prova a convertire la colonna category da ENUM a TEXT (se non già fatto)
  // Questo permette di usare qualsiasi categoria senza vincoli enum
  try {
    await supabase.rpc('exec_sql', { 
      sql: `ALTER TABLE products ALTER COLUMN category TYPE text;`
    })
  } catch (e) {
    // Se rpc non esiste o colonna già text, continua
  }

  // Step 2: Rimuovi TUTTI i prodotti esistenti per questo store (clean slate)
  const { error: deleteError } = await supabase.from('products').delete().eq('store_id', store_id)
  
  // Step 3: Inserisci tutti i prodotti nuovi
  let created = 0, errors = 0
  const errorDetails: any[] = []

  // Batch insert per performance
  const batchSize = 20
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize).map((p: any) => ({
      store_id,
      name: p.name?.trim() || '',
      category: (p.category || 'accessories').toLowerCase(),
      price: parseFloat(p.price) || 0,
      cost: p.cost ? parseFloat(p.cost) : null,
      unit: p.unit || 'pz',
      barcode: null,
      stock: parseInt(p.stock) || 0,
      stock_alert: 5,
      is_active: true,
    })).filter((p: any) => p.name)

    const { data, error } = await supabase.from('products').insert(batch)
    if (error) {
      errors += batch.length
      errorDetails.push({ batch: i, error: error.message })
    } else {
      created += batch.length
    }
  }

  return NextResponse.json({ 
    success: true, 
    deleted: deleteError ? `Error: ${deleteError.message}` : 'OK',
    created, 
    errors,
    errorDetails,
    total: products.length 
  })
}
