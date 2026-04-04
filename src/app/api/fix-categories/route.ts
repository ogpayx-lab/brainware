import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// API per fixare categorie: cambia i prodotti con "Semi" nel nome da qualsiasi categoria a "seeds"
// Aggiunge anche i nuovi valori all'enum se necessario
export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Prima prova ad aggiungere i nuovi valori all'enum (se esiste come enum)
  const newCategories = ['cosmetics', 'clothes', 'seeds', 'vape', 'food']
  for (const cat of newCategories) {
    try {
      await supabase.rpc('exec_sql', { sql: `ALTER TYPE product_category ADD VALUE IF NOT EXISTS '${cat}'` })
    } catch (e) {
      // Se l'enum non esiste o rpc non è disponibile, prova direttamente
    }
  }

  // Fix prodotti con "Semi" o "semi" nel nome → categoria seeds
  const { data: semiProducts, error: fetchErr } = await supabase
    .from('products')
    .select('id, name, category')
    .or('name.ilike.semi %,name.ilike.% semi %')

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  let fixed = 0
  let errors = 0
  const details: any[] = []

  for (const p of (semiProducts ?? [])) {
    if (p.category !== 'seeds') {
      const { error } = await supabase.from('products').update({ category: 'seeds' }).eq('id', p.id)
      if (error) {
        errors++
        details.push({ name: p.name, error: error.message })
      } else {
        fixed++
        details.push({ name: p.name, from: p.category, to: 'seeds' })
      }
    }
  }

  return NextResponse.json({ 
    success: true, 
    total_found: semiProducts?.length ?? 0,
    fixed, 
    errors,
    details
  })
}
