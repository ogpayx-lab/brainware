import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// API per aggiornare SOLO i prezzi dei prodotti esistenti (match per nome)
// NON crea nuovi prodotti
export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { store_id, prices } = await req.json()
  if (!store_id || !prices || !Array.isArray(prices)) {
    return NextResponse.json({ error: 'store_id and prices array required' }, { status: 400 })
  }

  // Carica prodotti esistenti
  const { data: existing } = await supabase.from('products').select('id, name, price').eq('store_id', store_id)
  const existingMap = new Map((existing ?? []).map(p => [p.name.toLowerCase().trim(), p]))

  let updated = 0, notFound = 0, errors = 0
  const notFoundList: string[] = []
  const errorList: any[] = []

  for (const item of prices) {
    const name = item.name?.trim()
    if (!name) continue
    const price = parseFloat(item.price) || 0

    const product = existingMap.get(name.toLowerCase())

    if (!product) {
      notFound++
      notFoundList.push(name)
      continue
    }

    const { error } = await supabase.from('products').update({ price }).eq('id', product.id)
    if (error) {
      errors++
      errorList.push({ name, error: error.message })
    } else {
      updated++
    }
  }

  return NextResponse.json({ success: true, updated, notFound, notFoundList, errors, errorList, total: prices.length })
}
