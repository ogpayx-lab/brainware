import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Proxy sicuro per Shopify Admin API
// Il token non viene mai esposto al browser
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  // Recupera la configurazione Shopify per lo store dell'utente
  const { data: profile } = await supabase.from('users').select('store_id').eq('id', user.id).single()
  if (!profile?.store_id) return NextResponse.json({ error: 'Store non trovato' }, { status: 404 })

  const { data: config } = await supabase.from('shopify_config').select('*').eq('store_id', profile.store_id).single()
  if (!config?.access_token) return NextResponse.json({ error: 'Shopify non configurato', not_configured: true }, { status: 200 })

  const endpoint = req.nextUrl.searchParams.get('endpoint') || 'orders.json?status=any&limit=50'

  try {
    const shopifyRes = await fetch(
      `https://${config.shopify_domain}/admin/api/2024-01/${endpoint}`,
      {
        headers: {
          'X-Shopify-Access-Token': config.access_token,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    )
    if (!shopifyRes.ok) {
      const err = await shopifyRes.text()
      return NextResponse.json({ error: `Shopify API error: ${shopifyRes.status}`, detail: err }, { status: shopifyRes.status })
    }
    const json = await shopifyRes.json()
    return NextResponse.json(json)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
